import React, { useEffect, useState } from 'react';
import {
  BellRing,
  Check,
  Clock,
  Info,
  Play,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import {
  Attendance,
  AutoReminderConfig,
  AutoReminderTargetMode,
  Invitation,
  Meeting,
  SchoolProfile,
  Teacher,
  WahaGroup,
} from '../types';
import {
  AutoReminderHistoryItem,
  clearAutoReminderHistory,
  getAutoReminderConfig,
  getAutoReminderHistory,
  getWahaGroups,
  saveAutoReminderConfig,
} from '../lib/storage';
import { getNextScheduledReminderInfo, runAutoReminderCheck } from '../lib/autoReminder';

interface AutoReminderPanelProps {
  meetings: Meeting[];
  teachers: Teacher[];
  attendances: Attendance[];
  invitations: Invitation[];
  schoolProfile: SchoolProfile;
  selectedMeetingId?: string;
}

export const AutoReminderPanel: React.FC<AutoReminderPanelProps> = ({
  meetings,
  teachers,
  attendances,
  invitations,
  schoolProfile,
  selectedMeetingId,
}) => {
  const [config, setConfig] = useState<AutoReminderConfig>(() => getAutoReminderConfig(schoolProfile));
  const [groups, setGroups] = useState<WahaGroup[]>(() => getWahaGroups(schoolProfile));
  const [history, setHistory] = useState<AutoReminderHistoryItem[]>(() => getAutoReminderHistory());
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingNow, setIsTestingNow] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  useEffect(() => {
    setConfig(getAutoReminderConfig(schoolProfile));
    setGroups(getWahaGroups(schoolProfile));
  }, [schoolProfile]);

  useEffect(() => {
    const handleGroupsUpdate = (e: Event) => {
      const custom = e as CustomEvent<WahaGroup[]>;
      if (Array.isArray(custom.detail)) setGroups(custom.detail);
      else setGroups(getWahaGroups(schoolProfile));
    };
    const handleHistoryUpdate = (e: Event) => {
      const custom = e as CustomEvent<AutoReminderHistoryItem[]>;
      if (Array.isArray(custom.detail)) setHistory(custom.detail);
      else setHistory(getAutoReminderHistory());
    };
    const handleConfigUpdate = (e: Event) => {
      const custom = e as CustomEvent<AutoReminderConfig>;
      if (custom.detail) setConfig(custom.detail);
    };

    window.addEventListener('smp_waha_groups_updated', handleGroupsUpdate);
    window.addEventListener('smp_auto_reminder_history_updated', handleHistoryUpdate);
    window.addEventListener('smp_auto_reminder_updated', handleConfigUpdate);
    return () => {
      window.removeEventListener('smp_waha_groups_updated', handleGroupsUpdate);
      window.removeEventListener('smp_auto_reminder_history_updated', handleHistoryUpdate);
      window.removeEventListener('smp_auto_reminder_updated', handleConfigUpdate);
    };
  }, [schoolProfile]);

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    const res = await saveAutoReminderConfig(config);
    setConfig(res.config);
    setIsSaving(false);
    setFeedback({
      text: res.syncedToDb
        ? 'Pengaturan Auto Reminder disimpan & disinkronkan ke database.'
        : 'Pengaturan Auto Reminder disimpan secara lokal.',
      type: 'success',
    });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleTriggerNow = async () => {
    setIsTestingNow(true);
    setFeedback(null);
    await saveAutoReminderConfig(config);

    const activeOrSelected =
      meetings.find((m) => m.id === selectedMeetingId) ||
      meetings.find((m) => m.status === 'active') ||
      meetings.find((m) => m.status === 'upcoming') ||
      meetings[0];

    if (!activeOrSelected) {
      setIsTestingNow(false);
      setFeedback({ text: 'Belum ada agenda rapat aktif untuk dikirimkan pengingat.', type: 'info' });
      return;
    }

    const res = await runAutoReminderCheck({
      meetings,
      teachers,
      attendances,
      invitations,
      schoolProfile: { ...schoolProfile, auto_reminder_config: config },
      forceMeetingId: activeOrSelected.id,
    });

    setHistory(getAutoReminderHistory());
    setIsTestingNow(false);
    setFeedback({
      text: res.results[0] || `Pemeriksaan selesai (${res.triggeredCount} terkirim).`,
      type: res.triggeredCount > 0 ? 'success' : 'info',
    });
  };

  const nextSchedule = getNextScheduledReminderInfo(meetings, config);

  return (
    <div className="space-y-4">
      {/* Main Toggle */}
      <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-teal-200 dark:border-[#0f4950] bg-teal-50/70 dark:bg-[#042024]">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0 mt-0.5">
            <BellRing className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-900 dark:text-white block">
              Aktifkan Auto Reminder Rapat & RSVP
            </span>
            <span className="text-[11px] text-slate-600 dark:text-teal-200/80 block leading-snug">
              Mengirim pengingat otomatis via WAHA menjelang rapat dimulai (tanpa dobel kirim).
            </span>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-10 h-5.5 bg-slate-300 dark:bg-[#0b383d] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-600" />
        </label>
      </div>

      {/* Info Box about browser runtime */}
      <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <span>
          Scheduler memeriksa jadwal setiap 30 detik selama halaman aplikasi/layar proyektor aktif di browser. Anda juga bisa memicu pengiriman langsung lewat tombol <strong>Cek & Kirim Sekarang</strong>.
        </span>
      </div>

      {/* Timing & Target Settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Kirim Sebelum Rapat</span>
          </label>
          <select
            value={config.remind_before_minutes}
            onChange={(e) => setConfig({ ...config, remind_before_minutes: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
          >
            <option value={15}>15 menit sebelum mulai</option>
            <option value={30}>30 menit sebelum mulai</option>
            <option value={60}>1 jam (60 menit) sebelum mulai</option>
            <option value={120}>2 jam (120 menit) sebelum mulai</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Auto Re-Chat Belum RSVP</span>
          </label>
          <select
            value={config.rsvp_remind_hours_before}
            onChange={(e) => setConfig({ ...config, rsvp_remind_hours_before: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
          >
            <option value={0}>Nonaktif (Manual saja)</option>
            <option value={6}>6 jam sebelum rapat</option>
            <option value={12}>12 jam sebelum rapat</option>
            <option value={24}>24 jam (H-1) sebelum rapat</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Target Penerima</span>
          </label>
          <select
            value={config.target_mode}
            onChange={(e) => setConfig({ ...config, target_mode: e.target.value as AutoReminderTargetMode })}
            className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
          >
            <option value="unpresent_teachers">Guru yang Belum Hadir</option>
            <option value="unconfirmed_rsvp">Guru yang Belum RSVP</option>
            <option value="group">Grup WhatsApp Sekolah</option>
            <option value="both_teachers_and_group">Guru Belum Hadir + Grup WA</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">
            Grup WA Tujuan (Jika ke Grup)
          </label>
          <select
            value={config.target_group_id || ''}
            onChange={(e) => setConfig({ ...config, target_group_id: e.target.value })}
            disabled={config.target_mode !== 'group' && config.target_mode !== 'both_teachers_and_group'}
            className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
          >
            <option value="">Otomatis (Grup Utama Default)</option>
            {groups.map((g) => (
              <option key={g.id} value={g.group_id}>
                {g.name} ({g.group_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Next Scheduled Preview */}
      {nextSchedule && (
        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-[#0f4950] bg-slate-50 dark:bg-[#031e21] flex items-center justify-between gap-2 text-[11px]">
          <span className="text-slate-600 dark:text-teal-200/90 truncate">
            Jadwal terdekat: <strong className="text-slate-900 dark:text-white">{nextSchedule.meetingTitle}</strong>
          </span>
          <span
            className={`px-2 py-0.5 rounded font-mono font-semibold whitespace-nowrap shrink-0 ${
              nextSchedule.isDueSoon
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                : 'bg-slate-200 dark:bg-[#0b383d] text-slate-700 dark:text-teal-100'
            }`}
          >
            {nextSchedule.isDueSoon ? 'Siap / Aktif' : nextSchedule.triggerTimeText}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-3.5 py-2 bg-teal-800 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          <span>{isSaving ? 'Menyimpan...' : 'Simpan ke DB'}</span>
        </button>

        <button
          type="button"
          onClick={handleTriggerNow}
          disabled={isTestingNow}
          className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          {isTestingNow ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isTestingNow ? 'Mengirim...' : 'Cek & Kirim Sekarang'}</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-2.5 rounded-lg border text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-slate-100 dark:bg-[#031e21] border-slate-200 dark:border-[#0f4950] text-slate-700 dark:text-teal-100'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Sent History */}
      <div className="pt-2 border-t border-slate-200 dark:border-[#0f4950] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-white">
            Riwayat Auto Reminder ({history.length})
          </span>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => {
                clearAutoReminderHistory();
                setHistory([]);
              }}
              className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Reset Riwayat</span>
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="text-[11px] text-slate-500 dark:text-teal-300/70 py-2">
            Belum ada auto reminder yang terkirim.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            {history.map((item) => (
              <div
                key={item.key}
                className="p-2.5 rounded-lg border border-slate-200 dark:border-[#0f4950] bg-slate-50 dark:bg-[#031e21] flex items-center justify-between gap-2 text-[11px]"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-white truncate">{item.summary}</div>
                  <div className="text-slate-500 dark:text-teal-300/70 font-mono text-[10px]">
                    {item.type === 'pre_meeting' ? 'Menjelang Rapat' : 'Pengingat RSVP'} •{' '}
                    {new Date(item.sent_at).toLocaleString('id-ID')}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] shrink-0">
                  {item.recipient_count}x
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
