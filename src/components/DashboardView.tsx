import React, { useEffect, useState } from 'react';
import { Users, CheckCircle2, AlertTriangle, AlertCircle, HeartPulse, FileSpreadsheet, Send, MessageSquare, Clock, Search, Filter, RefreshCw, XCircle, Share2, Phone, BellRing, X, Edit3, RotateCcw, Check, Copy } from 'lucide-react';
import { Attendance, AttendanceStatus, AutoReminderConfig, Invitation, Meeting, Teacher, SchoolProfile, WahaGroup } from '../types';
import { recordAttendance, deleteAttendance, getAutoReminderConfig, getWahaGroups } from '../lib/storage';
import { DEFAULT_WAHA_CONFIG, getWahaConfig, invokeWahaNotification, saveWahaConfig } from '../lib/waha';
import { AbsentTeachersModal } from './AbsentTeachersModal';
import { AutoReminderModal } from './AutoReminderModal';

interface DashboardViewProps {
  meetings: Meeting[];
  teachers: Teacher[];
  attendances: Attendance[];
  invitations?: Invitation[];
  schoolProfile: SchoolProfile;
  onRefresh: () => void;
  onNavigateToReports: () => void;
  onNavigateToScanner: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  meetings,
  teachers,
  attendances,
  invitations = [],
  schoolProfile,
  onRefresh,
  onNavigateToReports,
  onNavigateToScanner,
}) => {
  const activeMeeting = meetings.find((m) => m.status === 'active') || meetings[0];
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(activeMeeting?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus | 'belum'>('all');
  const [wahaActionLoading, setWahaActionLoading] = useState<string | null>(null);
  const [wahaFeedback, setWahaFeedback] = useState<string | null>(null);
  const [isAbsentModalOpen, setIsAbsentModalOpen] = useState(false);
  const [isAutoReminderModalOpen, setIsAutoReminderModalOpen] = useState(false);
  const [isGroupRecapModalOpen, setIsGroupRecapModalOpen] = useState(false);
  const [recapDraftMessage, setRecapDraftMessage] = useState('');
  const [recapTemplateDraft, setRecapTemplateDraft] = useState(() => getWahaConfig().message_template_recap);
  const [isEditingRecapTemplate, setIsEditingRecapTemplate] = useState(false);
  const [recapModalNotice, setRecapModalNotice] = useState<string | null>(null);

  const [wahaGroups, setWahaGroups] = useState<WahaGroup[]>(() => getWahaGroups(schoolProfile));
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => {
    const groups = getWahaGroups(schoolProfile);
    return groups.find((g) => g.is_default)?.group_id || groups[0]?.group_id || schoolProfile.waha_group_id || '';
  });
  const [autoReminderEnabled, setAutoReminderEnabled] = useState<boolean>(() => getAutoReminderConfig(schoolProfile).enabled);

  useEffect(() => {
    const groups = getWahaGroups(schoolProfile);
    setWahaGroups(groups);
    if (!selectedGroupId || !groups.some((g) => g.group_id === selectedGroupId)) {
      const def = groups.find((g) => g.is_default)?.group_id || groups[0]?.group_id || schoolProfile.waha_group_id || '';
      if (def) setSelectedGroupId(def);
    }
    setAutoReminderEnabled(getAutoReminderConfig(schoolProfile).enabled);
  }, [schoolProfile, selectedGroupId]);

  useEffect(() => {
    const handleGroupsUpdate = (e: Event) => {
      const custom = e as CustomEvent<WahaGroup[]>;
      const nextGroups = Array.isArray(custom.detail) ? custom.detail : getWahaGroups(schoolProfile);
      setWahaGroups(nextGroups);
      if (nextGroups.length > 0 && !nextGroups.some((g) => g.group_id === selectedGroupId)) {
        setSelectedGroupId(nextGroups.find((g) => g.is_default)?.group_id || nextGroups[0].group_id);
      }
    };
    const handleReminderUpdate = (e: Event) => {
      const custom = e as CustomEvent<AutoReminderConfig>;
      if (custom.detail) setAutoReminderEnabled(Boolean(custom.detail.enabled));
    };
    window.addEventListener('smp_waha_groups_updated', handleGroupsUpdate);
    window.addEventListener('smp_auto_reminder_updated', handleReminderUpdate);
    return () => {
      window.removeEventListener('smp_waha_groups_updated', handleGroupsUpdate);
      window.removeEventListener('smp_auto_reminder_updated', handleReminderUpdate);
    };
  }, [schoolProfile, selectedGroupId]);

  const currentMeeting = meetings.find((m) => m.id === selectedMeetingId) || activeMeeting;

  // Filter attendances for current meeting
  const meetingAttendances = currentMeeting
    ? attendances.filter((a) => a.meeting_id === currentMeeting.id)
    : [];

  const attendanceMap = new Map<string, Attendance>();
  meetingAttendances.forEach((a) => attendanceMap.set(a.teacher_id, a));

  // Filter active teachers according to current meeting target_type & invited_teacher_ids
  const isCustomMeeting =
    currentMeeting &&
    currentMeeting.target_type === 'custom' &&
    Array.isArray(currentMeeting.invited_teacher_ids) &&
    currentMeeting.invited_teacher_ids.length > 0;

  const relevantTeachers = teachers
    .filter((t) => t.is_active)
    .filter((t) => !isCustomMeeting || currentMeeting.invited_teacher_ids!.includes(t.id));

  // Compute KPI metrics
  const totalTeachers = relevantTeachers.length;
  const hadirCount = meetingAttendances.filter((a) => a.status === 'hadir').length;
  const terlambatCount = meetingAttendances.filter((a) => a.status === 'terlambat').length;
  const izinCount = meetingAttendances.filter((a) => a.status === 'izin' || a.status === 'sakit').length;
  const belumCount = Math.max(0, totalTeachers - meetingAttendances.length);
  const totalPresent = hadirCount + terlambatCount;
  const attendancePercentage = totalTeachers > 0 ? Math.round((totalPresent / totalTeachers) * 100) : 0;

  // Filtered rows
  const rows = relevantTeachers
    .filter((t) => {
      const niyVal = (t.niy || t.nip || '').toLowerCase();
      const matchSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        niyVal.includes(searchQuery.toLowerCase()) ||
        t.role_title.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      const att = attendanceMap.get(t.id);
      if (statusFilter === 'all') return true;
      if (statusFilter === 'belum') return !att;
      return att?.status === statusFilter;
    });

  const buildRenderedGroupRecap = (templateOverride?: string) => {
    if (!currentMeeting) return '';
    const wahaConfig = getWahaConfig();
    const tpl = templateOverride ?? wahaConfig.message_template_recap ?? DEFAULT_WAHA_CONFIG.message_template_recap;
    return tpl
      .replace(/\{rapat\}/g, currentMeeting.title)
      .replace(/\{tanggal\}/g, currentMeeting.meeting_date)
      .replace(/\{waktu\}/g, `${currentMeeting.start_time} - ${currentMeeting.end_time}`)
      .replace(/\{ruang\}/g, currentMeeting.room)
      .replace(/\{total\}/g, String(totalTeachers))
      .replace(/\{hadir\}/g, String(hadirCount))
      .replace(/\{terlambat\}/g, String(terlambatCount))
      .replace(/\{izin\}/g, String(izinCount))
      .replace(/\{belum\}/g, String(belumCount))
      .replace(/\{persen\}/g, String(attendancePercentage));
  };

  const handleOpenGroupRecapModal = () => {
    if (!currentMeeting) return;
    const wahaConfig = getWahaConfig();
    setRecapTemplateDraft(wahaConfig.message_template_recap || DEFAULT_WAHA_CONFIG.message_template_recap);
    setRecapDraftMessage(buildRenderedGroupRecap(wahaConfig.message_template_recap));
    setIsEditingRecapTemplate(false);
    setRecapModalNotice(null);
    setIsGroupRecapModalOpen(true);
  };

  const handleSaveRecapTemplateToDb = () => {
    const currentCfg = getWahaConfig();
    const updatedCfg = {
      ...currentCfg,
      message_template_recap: recapTemplateDraft,
    };
    saveWahaConfig(updatedCfg);
    setRecapDraftMessage(buildRenderedGroupRecap(recapTemplateDraft));
    setIsEditingRecapTemplate(false);
    setRecapModalNotice('Template rekap grup berhasil disimpan ke database!');
    setTimeout(() => setRecapModalNotice(null), 3000);
  };

  const handleResetRecapTemplate = () => {
    const def = DEFAULT_WAHA_CONFIG.message_template_recap;
    setRecapTemplateDraft(def);
    const currentCfg = getWahaConfig();
    saveWahaConfig({ ...currentCfg, message_template_recap: def });
    setRecapDraftMessage(buildRenderedGroupRecap(def));
    setRecapModalNotice('Template dikembalikan ke format bawaan.');
    setTimeout(() => setRecapModalNotice(null), 3000);
  };

  // WAHA: Kirim Rekap ke Grup WhatsApp (dari modal editor)
  const handleSendGroupRecap = async () => {
    if (!currentMeeting) return;
    const groupId = selectedGroupId || schoolProfile.waha_group_id || 'grup_sekolah';
    const messageToSend = recapDraftMessage.trim() || buildRenderedGroupRecap();

    setWahaActionLoading('recap');
    setWahaFeedback(null);

    const result = await invokeWahaNotification({
      action: 'group_recap',
      recipient: groupId,
      message: messageToSend,
      metadata: { meeting_id: currentMeeting.id },
    });

    setWahaActionLoading(null);
    if (result.success) {
      setIsGroupRecapModalOpen(false);
    } else {
      setRecapModalNotice(result.message);
    }
    setWahaFeedback(result.message);
    setTimeout(() => setWahaFeedback(null), 4000);
  };

  // WAHA: Kirim Reminder ke Guru yang Belum Hadir
  const handleSendReminderBlast = async () => {
    if (!currentMeeting) return;
    const wahaConfig = getWahaConfig();
    const unpresentTeachers = relevantTeachers.filter((t) => !attendanceMap.has(t.id) && t.phone_wa);

    if (unpresentTeachers.length === 0) {
      setWahaFeedback('Semua guru sudah hadir atau nomor WhatsApp belum terdaftar.');
      setTimeout(() => setWahaFeedback(null), 4000);
      return;
    }

    setWahaActionLoading('reminder');
    setWahaFeedback(null);

    const message = wahaConfig.message_template_reminder
      .replace('{rapat}', currentMeeting.title)
      .replace('{tanggal}', currentMeeting.meeting_date)
      .replace('{jam}', currentMeeting.start_time)
      .replace('{ruang}', currentMeeting.room)
      .replace('{pimpinan}', currentMeeting.leader_name);

    // Blast each unpresent teacher
    let successCount = 0;
    for (const t of unpresentTeachers) {
      await invokeWahaNotification({
        action: 'meeting_reminder',
        recipient: t.phone_wa,
        message,
        metadata: { teacher_id: t.id, meeting_id: currentMeeting.id },
      });
      successCount++;
    }

    setWahaActionLoading(null);
    setWahaFeedback(`Berhasil memicu pengingat via WhatsApp ke ${successCount} guru!`);
    setTimeout(() => setWahaFeedback(null), 4000);
  };

  // Quick inline status change (Hadir, Izin, Sakit, Reset)
  const handleQuickStatusChange = async (teacher: Teacher, status: AttendanceStatus | 'reset') => {
    if (!currentMeeting) return;

    if (status === 'reset') {
      const existing = attendanceMap.get(teacher.id);
      if (existing) {
        await deleteAttendance(existing.id);
        onRefresh();
      }
      return;
    }

    await recordAttendance({
      meetingId: currentMeeting.id,
      teacherId: teacher.id,
      status,
      method: 'manual',
      notes: status === 'izin' ? 'Izin Dinas/Keperluan' : status === 'sakit' ? 'Sakit' : 'Tepat Waktu',
    });
    onRefresh();
  };

  return (
    <div className="space-y-3 sm:space-y-5">
      {/* Top Controls: Agenda Selector & Refresh */}
      <div className="bg-white dark:bg-[#072b2f] p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4">
        <div className="hidden md:block min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base lg:text-lg font-bold text-slate-900 dark:text-white">Pemantauan Presensi Real-Time</h2>
            {isCustomMeeting && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800">
                Rapat Khusus ({totalTeachers})
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-teal-300/80 mt-0.5">
            Pantau statistik kehadiran, verifikasi guru belum hadir, dan kirim pengumuman via WAHA.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Meeting Selector */}
          <select
            value={selectedMeetingId}
            onChange={(e) => setSelectedMeetingId(e.target.value)}
            className="text-xs font-semibold border border-slate-300 dark:border-[#0f4950] rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-50 dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden flex-1 md:w-auto md:max-w-xs truncate min-w-0"
          >
            {meetings.map((m) => (
              <option key={m.id} value={m.id} className="dark:bg-[#072b2f]">
                {m.title} [{m.status.toUpperCase()}]{m.target_type === 'custom' ? ' (Khusus)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI 6-Strip Card (Compact 3x2 on mobile) */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {/* Total Peserta */}
        <div className="bg-white dark:bg-[#072b2f] p-2.5 sm:p-3.5 rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-teal-300/80 block truncate">Total</span>
          <span className="text-lg sm:text-2xl font-bold font-mono text-slate-900 dark:text-white mt-0.5 block tabular-nums">
            {totalTeachers}
          </span>
          <span className="hidden sm:block text-[11px] text-slate-400 dark:text-teal-400/70 mt-0.5">
            {isCustomMeeting ? 'Guru Terpilih' : 'Semua Guru'}
          </span>
        </div>

        {/* Hadir Tepat Waktu */}
        <div className="bg-white dark:bg-[#072b2f] p-2.5 sm:p-3.5 rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs">
          <span className="text-[10px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-400 block truncate">Hadir</span>
          <span className="text-lg sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block tabular-nums">
            {hadirCount}
          </span>
          <span className="hidden sm:block text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
            {totalTeachers > 0 ? Math.round((hadirCount / totalTeachers) * 100) : 0}% tepat waktu
          </span>
        </div>

        {/* Terlambat */}
        <div className="bg-white dark:bg-[#072b2f] p-2.5 sm:p-3.5 rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs">
          <span className="text-[10px] sm:text-xs font-semibold text-amber-700 dark:text-amber-400 block truncate">Terlambat</span>
          <span className="text-lg sm:text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5 block tabular-nums">
            {terlambatCount}
          </span>
          <span className="hidden sm:block text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">Toleransi Lewat</span>
        </div>

        {/* Izin / Sakit */}
        <div className="bg-white dark:bg-[#072b2f] p-2.5 sm:p-3.5 rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs">
          <span className="text-[10px] sm:text-xs font-semibold text-teal-700 dark:text-teal-300 block truncate">Izin / Sakit</span>
          <span className="text-lg sm:text-2xl font-bold font-mono text-teal-600 dark:text-teal-300 mt-0.5 block tabular-nums">
            {izinCount}
          </span>
          <span className="hidden sm:block text-[11px] text-teal-600/80 dark:text-teal-300/80 mt-0.5">Keterangan Resmi</span>
        </div>

        {/* Belum Hadir */}
        <div className="bg-white dark:bg-[#072b2f] p-2.5 sm:p-3.5 rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-teal-300/80 block truncate">Belum Hadir</span>
          <span className="text-lg sm:text-2xl font-bold font-mono text-slate-700 dark:text-teal-100 mt-0.5 block tabular-nums">
            {belumCount}
          </span>
          <span className="hidden sm:block text-[11px] text-slate-400 dark:text-teal-400/70 mt-0.5">Perlu Dikonfirmasi</span>
        </div>

        {/* Persentase Kehadiran */}
        <div className="bg-teal-900 dark:bg-[#042024] text-white p-2.5 sm:p-3.5 rounded-xl border border-teal-950 dark:border-teal-700/60 shadow-xs">
          <span className="text-[10px] sm:text-xs font-semibold text-teal-200 block truncate">Kehadiran</span>
          <span className="text-lg sm:text-2xl font-bold font-mono text-white mt-0.5 block tabular-nums">
            {attendancePercentage}%
          </span>
          <span className="hidden sm:block text-[11px] text-teal-200 mt-0.5">
            {totalPresent} dari {totalTeachers} hadir
          </span>
        </div>
      </div>

      {/* WAHA Quick Broadcast Toolbar */}
      <div className="bg-emerald-50/70 dark:bg-[#042024] border border-emerald-200 dark:border-[#0f4950] p-2.5 sm:p-3.5 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 hidden lg:block" />
          {wahaGroups.length > 0 ? (
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 shrink-0">Grup:</span>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="text-[11px] sm:text-xs font-semibold bg-white dark:bg-[#072b2f] border border-emerald-300 dark:border-emerald-700/60 text-slate-900 dark:text-white rounded-lg px-2 py-1 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 min-w-0 flex-1 lg:max-w-[230px] truncate"
                title="Pilih Grup WhatsApp Tujuan Rekap"
              >
                {wahaGroups.map((g) => (
                  <option key={g.id} value={g.group_id}>
                    {g.name} ({g.group_id})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="hidden lg:block text-xs truncate">
              <span className="font-bold text-emerald-900 dark:text-emerald-300">WhatsApp WAHA:</span>
              <span className="text-emerald-800 dark:text-emerald-200/90 ml-1">Kirim ringkasan kehadiran ke grup atau pengingat guru.</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 sm:flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={handleSendReminderBlast}
            disabled={wahaActionLoading !== null || belumCount === 0}
            className="px-2 sm:px-3 py-1.5 bg-white dark:bg-[#0b383d] text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/60 hover:bg-emerald-100 dark:hover:bg-[#0f4950] rounded-lg text-[10px] sm:text-xs font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            <Send className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{wahaActionLoading === 'reminder' ? 'Kirim...' : `Ingatkan (${belumCount})`}</span>
          </button>

          <button
            onClick={handleOpenGroupRecapModal}
            disabled={wahaActionLoading !== null || !currentMeeting}
            className="px-2 sm:px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-[10px] sm:text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-xs disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            <MessageSquare className="w-3 h-3 shrink-0" />
            <span>{wahaActionLoading === 'recap' ? 'Kirim...' : 'Rekap Grup'}</span>
          </button>

          <button
            onClick={() => setIsAbsentModalOpen(true)}
            className="px-2 sm:px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-[10px] sm:text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-xs whitespace-nowrap cursor-pointer"
            title="Ekspor infografis gambar & kirim daftar pegawai tidak hadir ke grup WA"
          >
            <Share2 className="w-3 h-3 shrink-0" />
            <span>Tidak Hadir</span>
          </button>

          <button
            onClick={() => setIsAutoReminderModalOpen(true)}
            className={`px-2 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-colors flex items-center justify-center gap-1 border whitespace-nowrap cursor-pointer ${
              autoReminderEnabled
                ? 'bg-teal-900 dark:bg-teal-700 text-white border-teal-800 dark:border-teal-500'
                : 'bg-white dark:bg-[#0b383d] text-slate-700 dark:text-teal-200 border-slate-300 dark:border-teal-700/60 hover:bg-slate-100 dark:hover:bg-[#0f4950]'
            }`}
            title="Atur Auto Reminder Rapat & RSVP Otomatis"
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${autoReminderEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
            <BellRing className="w-3 h-3 shrink-0 hidden sm:block" />
            <span>Auto</span>
          </button>
        </div>
      </div>

      {wahaFeedback && (
        <div className="p-2.5 sm:p-3 bg-emerald-100/80 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 rounded-lg text-xs font-medium">
          {wahaFeedback}
        </div>
      )}

      {/* Main Table: Attendance Records */}
      <div className="bg-white dark:bg-[#072b2f] rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs overflow-hidden">
        {/* Table Filter & Search Header */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-[#0f4950] flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Segmented Filter Buttons */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#031e21] rounded-lg text-[11px] sm:text-xs overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-[#072b2f] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-teal-300/80 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Semua ({totalTeachers})
            </button>
            <button
              onClick={() => setStatusFilter('hadir')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'hadir'
                  ? 'bg-white dark:bg-[#072b2f] text-emerald-800 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-teal-300/80 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Hadir ({hadirCount})
            </button>
            <button
              onClick={() => setStatusFilter('terlambat')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'terlambat'
                  ? 'bg-white dark:bg-[#072b2f] text-amber-800 dark:text-amber-300 shadow-xs'
                  : 'text-slate-600 dark:text-teal-300/80 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Telat ({terlambatCount})
            </button>
            <button
              onClick={() => setStatusFilter('izin')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'izin'
                  ? 'bg-white dark:bg-[#072b2f] text-teal-800 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-teal-300/80 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Izin ({izinCount})
            </button>
            <button
              onClick={() => setStatusFilter('belum')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'belum'
                  ? 'bg-white dark:bg-[#072b2f] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-teal-300/80 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Belum ({belumCount})
            </button>
          </div>

          {/* Search Input & Quick Jump Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-teal-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari guru..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-teal-300/60 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <button
              onClick={onNavigateToScanner}
              className="px-2.5 sm:px-3 py-1.5 bg-teal-700 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg text-[11px] sm:text-xs font-medium transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
            >
              Scan
            </button>

            <button
              onClick={onNavigateToReports}
              className="px-2.5 sm:px-3 py-1.5 bg-slate-100 dark:bg-[#0b383d] hover:bg-slate-200 dark:hover:bg-[#0f4950] text-slate-700 dark:text-teal-100 border border-slate-300 dark:border-teal-700/60 rounded-lg text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Laporan
            </button>
          </div>
        </div>

        {/* Desktop View: High-density Data Table (≥ sm) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#042024] border-b border-slate-200 dark:border-[#0f4950] text-slate-600 dark:text-teal-200 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-4 w-12 text-center">No</th>
                <th className="py-2.5 px-4">Nama Pegawai</th>
                <th className="py-2.5 px-4">Jabatan / Status</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4">Waktu Hadir</th>
                <th className="py-2.5 px-4">Metode</th>
                <th className="py-2.5 px-4 text-right">Ubah Status Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#0f4950] text-slate-700 dark:text-teal-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-teal-300/60">
                    Tidak ada data guru yang memenuhi filter.
                  </td>
                </tr>
              ) : (
                rows.map((teacher, index) => {
                  const att = attendanceMap.get(teacher.id);
                  const isPresent = !!att;
                  const timeFormatted = att
                    ? new Date(att.check_in_time).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : '-';

                  return (
                    <tr key={teacher.id} className="hover:bg-slate-50/80 dark:hover:bg-[#0b383d] transition-colors">
                      {/* No */}
                      <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-400 dark:text-teal-400/80 tabular-nums">
                        {index + 1}
                      </td>

                      {/* Nama & NIY */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white leading-tight">{teacher.name}</div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-teal-300 mt-0.5">
                          NIY. {teacher.niy || teacher.nip || '-'}
                        </div>
                      </td>

                      {/* Role & Rank */}
                      <td className="py-3 px-4 text-slate-600 dark:text-teal-100">
                        <div className="font-medium text-slate-800 dark:text-white">{teacher.role_title}</div>
                        <div className="text-[11px] text-slate-400 dark:text-teal-300/70">{teacher.rank_group}</div>
                      </td>

                      {/* Status Kehadiran (Propercase & Icon Cohesive with RSVP) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {att ? (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              att.status === 'hadir'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                : att.status === 'terlambat'
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                : att.status === 'izin'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30'
                                : att.status === 'sakit'
                                ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30'
                                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {att.status === 'hadir' ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>Hadir</span>
                              </>
                            ) : att.status === 'terlambat' ? (
                              <>
                                <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span>Terlambat</span>
                              </>
                            ) : att.status === 'izin' ? (
                              <>
                                <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span>Izin</span>
                              </>
                            ) : att.status === 'sakit' ? (
                              <>
                                <HeartPulse className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                                <span>Sakit</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                                <span>Tidak Hadir</span>
                              </>
                            )}
                          </span>
                        ) : currentMeeting?.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                            <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                            <span>Tidak Hadir</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-500 dark:text-teal-300/70 border border-slate-300/40 dark:border-teal-700/40">
                            <Clock className="w-3 h-3 text-slate-400 dark:text-teal-400 shrink-0" />
                            <span>Belum Hadir</span>
                          </span>
                        )}
                      </td>

                      {/* Waktu Hadir */}
                      <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-700 dark:text-teal-200">
                        {timeFormatted}
                      </td>

                      {/* Metode */}
                      <td className="py-3 px-4 text-[11px] text-slate-500 dark:text-teal-300/80">
                        {att ? (
                          att.method === 'card_scan' ? (
                            'Scan Kartu'
                          ) : att.method === 'projector_scan' ? (
                            'Scan Layar'
                          ) : (
                            'Manual TU'
                          )
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* Quick Status Modifiers */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleQuickStatusChange(teacher, 'hadir')}
                            title="Tandai Hadir"
                            className="px-2 py-1 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                          >
                            Hadir
                          </button>
                          <button
                            onClick={() => handleQuickStatusChange(teacher, 'izin')}
                            title="Tandai Izin"
                            className="px-2 py-1 text-[10px] font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 rounded border border-teal-200 dark:border-teal-800 transition-colors cursor-pointer"
                          >
                            Izin
                          </button>
                          <button
                            onClick={() => handleQuickStatusChange(teacher, 'sakit')}
                            title="Tandai Sakit"
                            className="px-2 py-1 text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                          >
                            Sakit
                          </button>
                          {isPresent && (
                            <button
                              onClick={() => handleQuickStatusChange(teacher, 'reset')}
                              title="Batalkan / Reset Presensi"
                              className="px-1.5 py-1 text-[10px] text-slate-400 hover:text-red-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                            >
                              &times;
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Touch-Friendly Card View (< sm, Poin Penting: NIY, Kelompok, No HP) */}
        <div className="block sm:hidden divide-y divide-slate-100 dark:divide-[#0f4950]/70">
          {rows.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 dark:text-teal-300/60">
              Tidak ada data guru yang memenuhi filter.
            </div>
          ) : (
            rows.map((teacher, index) => {
              const att = attendanceMap.get(teacher.id);
              const isPresent = !!att;
              const timeFormatted = att
                ? new Date(att.check_in_time).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : '-';

              return (
                <div key={teacher.id} className="p-3 space-y-2 bg-white dark:bg-[#072b2f]">
                  {/* Card Header: Nama & Status Kehadiran */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-slate-400 dark:text-teal-400/80 tabular-nums">#{index + 1}</span>
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs leading-snug truncate">
                          {teacher.name}
                        </h4>
                      </div>
                      <p className="text-[10.5px] text-slate-500 dark:text-teal-300/80 mt-0.5 truncate">
                        <span className="font-mono">NIY {teacher.niy || teacher.nip || '-'}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{teacher.teacher_group || 'Guru Mapel'}</span>
                      </p>
                    </div>

                    {/* Badge Status */}
                    <div className="shrink-0">
                      {att ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                            att.status === 'hadir'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : att.status === 'terlambat'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : att.status === 'izin'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30'
                              : att.status === 'sakit'
                              ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {att.status === 'hadir' && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />}
                          {att.status === 'terlambat' && <Clock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />}
                          {att.status === 'izin' && <AlertCircle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />}
                          {att.status === 'sakit' && <HeartPulse className="w-2.5 h-2.5 text-sky-600 dark:text-sky-400" />}
                          {att.status === 'alpa' && <XCircle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />}
                          <span className="capitalize">{att.status === 'alpa' ? 'Alpa' : att.status}</span>
                        </span>
                      ) : currentMeeting?.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                          <XCircle className="w-2.5 h-2.5 text-rose-600" />
                          <span>Alpa</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-500/10 text-slate-500 dark:text-teal-300/70">
                          <Clock className="w-2.5 h-2.5 text-slate-400" />
                          <span>Belum</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Compact Info Strip: No HP & Waktu Hadir */}
                  <div className="flex items-center justify-between gap-2 text-[10.5px] bg-slate-50 dark:bg-[#031e21] px-2.5 py-1.5 rounded-lg border border-slate-200/80 dark:border-[#0f4950]">
                    <div className="min-w-0 truncate">
                      {teacher.phone_wa ? (
                        <a
                          href={`https://wa.me/${teacher.phone_wa.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 font-medium"
                        >
                          <Phone className="w-2.5 h-2.5 shrink-0" />
                          <span>{teacher.phone_wa}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 dark:text-teal-400/50 italic">No. HP belum ada</span>
                      )}
                    </div>

                    <div className="shrink-0 font-mono text-[10px] text-slate-500 dark:text-teal-300/80 tabular-nums">
                      {isPresent ? timeFormatted : '-'}
                    </div>
                  </div>

                  {/* Quick Action Modifiers on Mobile */}
                  <div className="flex items-center justify-end gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-400 dark:text-teal-400/70 mr-auto">Ubah:</span>
                    <button
                      onClick={() => handleQuickStatusChange(teacher, 'hadir')}
                      className="px-2 py-1 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                    >
                      Hadir
                    </button>
                    <button
                      onClick={() => handleQuickStatusChange(teacher, 'izin')}
                      className="px-2 py-1 text-[10px] font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 rounded border border-teal-200 dark:border-teal-800 cursor-pointer"
                    >
                      Izin
                    </button>
                    <button
                      onClick={() => handleQuickStatusChange(teacher, 'sakit')}
                      className="px-2 py-1 text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-800 cursor-pointer"
                    >
                      Sakit
                    </button>
                    {isPresent && (
                      <button
                        onClick={() => handleQuickStatusChange(teacher, 'reset')}
                        title="Reset Presensi"
                        className="px-2 py-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded border border-rose-200 dark:border-rose-800 cursor-pointer"
                      >
                        Batal
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Kirim Rekap Tidak Hadir */}
      {currentMeeting && (
        <AbsentTeachersModal
          isOpen={isAbsentModalOpen}
          onClose={() => setIsAbsentModalOpen(false)}
          currentMeeting={currentMeeting}
          teachers={relevantTeachers}
          attendances={meetingAttendances}
          schoolProfile={schoolProfile}
        />
      )}

      {/* Modal Kirim & Edit Rekap Grup WA */}
      {isGroupRecapModalOpen && currentMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#072b2f] rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-[#0f4950]">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#0f4950] flex items-center justify-between bg-teal-950 text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Kirim & Edit Rekap ke Grup WA</h3>
                  <p className="text-[11px] text-teal-200/80 truncate max-w-xs sm:max-w-sm">
                    Agenda: {currentMeeting.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsGroupRecapModalOpen(false)}
                className="p-1.5 rounded-lg text-teal-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1 text-xs">
              {wahaGroups.length > 0 && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">
                    Grup WhatsApp Tujuan
                  </label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    {wahaGroups.map((g) => (
                      <option key={g.id} value={g.group_id}>
                        {g.name} ({g.group_id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-slate-800 dark:text-white">
                  {isEditingRecapTemplate ? 'Edit Template Default (Tersimpan di DB)' : 'Teks Pesan Rekap (Dapat Diedit)'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsEditingRecapTemplate((prev) => !prev)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 cursor-pointer transition-colors ${
                      isEditingRecapTemplate
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-slate-100 dark:bg-[#0b383d] text-slate-700 dark:text-teal-100 border-slate-300 dark:border-[#0f4950]'
                    }`}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{isEditingRecapTemplate ? 'Mode Pesan Siap Kirim' : 'Edit Template Default'}</span>
                  </button>
                  {isEditingRecapTemplate && (
                    <button
                      type="button"
                      onClick={handleResetRecapTemplate}
                      className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 dark:text-teal-300 hover:bg-slate-100 dark:hover:bg-[#0b383d] border border-slate-300 dark:border-[#0f4950] flex items-center gap-1 cursor-pointer"
                      title="Reset ke template bawaan"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {isEditingRecapTemplate ? (
                <div className="space-y-2">
                  <textarea
                    rows={8}
                    value={recapTemplateDraft}
                    onChange={(e) => setRecapTemplateDraft(e.target.value)}
                    className="w-full px-3 py-2 border border-teal-400 dark:border-teal-600 rounded-xl bg-white dark:bg-[#031e21] text-slate-900 dark:text-white font-mono leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-teal-300/80 leading-relaxed">
                    Placeholder tersedia: <code>{'{rapat}'}</code>, <code>{'{tanggal}'}</code>, <code>{'{waktu}'}</code>, <code>{'{ruang}'}</code>, <code>{'{total}'}</code>, <code>{'{hadir}'}</code>, <code>{'{terlambat}'}</code>, <code>{'{izin}'}</code>, <code>{'{belum}'}</code>, <code>{'{persen}'}</code>
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveRecapTemplateToDb}
                    className="px-3.5 py-2 bg-teal-800 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan Template ke DB & Terapkan</span>
                  </button>
                </div>
              ) : (
                <textarea
                  rows={9}
                  value={recapDraftMessage}
                  onChange={(e) => setRecapDraftMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-xl bg-slate-50 dark:bg-[#031e21] text-slate-900 dark:text-white font-mono leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              )}

              {recapModalNotice && (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-medium">
                  {recapModalNotice}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-[#0f4950] bg-slate-50 dark:bg-[#031e21] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(recapDraftMessage);
                  setRecapModalNotice('Teks rekap disalin ke clipboard!');
                  setTimeout(() => setRecapModalNotice(null), 2500);
                }}
                className="px-3 py-2 bg-white dark:bg-[#0b383d] border border-slate-300 dark:border-[#0f4950] text-slate-700 dark:text-teal-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Teks</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsGroupRecapModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-200 dark:bg-[#0b383d] text-slate-700 dark:text-teal-100 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSendGroupRecap}
                  disabled={wahaActionLoading === 'recap' || isEditingRecapTemplate || !recapDraftMessage.trim()}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {wahaActionLoading === 'recap' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{wahaActionLoading === 'recap' ? 'Mengirim...' : 'Kirim ke Grup WA'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Auto Reminder */}
      <AutoReminderModal
        isOpen={isAutoReminderModalOpen}
        onClose={() => setIsAutoReminderModalOpen(false)}
        meetings={meetings}
        teachers={teachers}
        attendances={attendances}
        invitations={invitations}
        schoolProfile={schoolProfile}
        selectedMeetingId={selectedMeetingId}
      />
    </div>
  );
};
