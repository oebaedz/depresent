import React, { useState } from 'react';
import { Users, CheckCircle2, AlertTriangle, FileSpreadsheet, Send, MessageSquare, Clock, Search, Filter, RefreshCw, XCircle } from 'lucide-react';
import { Attendance, AttendanceStatus, Meeting, Teacher, SchoolProfile } from '../types';
import { recordAttendance, deleteAttendance } from '../lib/storage';
import { getWahaConfig, invokeWahaNotification } from '../lib/waha';

interface DashboardViewProps {
  meetings: Meeting[];
  teachers: Teacher[];
  attendances: Attendance[];
  schoolProfile: SchoolProfile;
  onRefresh: () => void;
  onNavigateToReports: () => void;
  onNavigateToScanner: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  meetings,
  teachers,
  attendances,
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

  const currentMeeting = meetings.find((m) => m.id === selectedMeetingId) || activeMeeting;

  // Filter attendances for current meeting
  const meetingAttendances = currentMeeting
    ? attendances.filter((a) => a.meeting_id === currentMeeting.id)
    : [];

  const attendanceMap = new Map<string, Attendance>();
  meetingAttendances.forEach((a) => attendanceMap.set(a.teacher_id, a));

  // Compute KPI metrics
  const totalTeachers = teachers.filter((t) => t.is_active).length;
  const hadirCount = meetingAttendances.filter((a) => a.status === 'hadir').length;
  const terlambatCount = meetingAttendances.filter((a) => a.status === 'terlambat').length;
  const izinCount = meetingAttendances.filter((a) => a.status === 'izin' || a.status === 'sakit').length;
  const belumCount = Math.max(0, totalTeachers - meetingAttendances.length);
  const totalPresent = hadirCount + terlambatCount;
  const attendancePercentage = totalTeachers > 0 ? Math.round((totalPresent / totalTeachers) * 100) : 0;

  // Filtered rows
  const rows = teachers
    .filter((t) => t.is_active)
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

  // WAHA: Kirim Rekap ke Grup WhatsApp
  const handleSendGroupRecap = async () => {
    if (!currentMeeting) return;
    const wahaConfig = getWahaConfig();
    const groupId = schoolProfile.waha_group_id || 'grup_sekolah';

    setWahaActionLoading('recap');
    setWahaFeedback(null);

    const message = wahaConfig.message_template_recap
      .replace('{rapat}', currentMeeting.title)
      .replace('{tanggal}', currentMeeting.meeting_date)
      .replace('{waktu}', `${currentMeeting.start_time} - ${currentMeeting.end_time}`)
      .replace('{ruang}', currentMeeting.room)
      .replace('{total}', String(totalTeachers))
      .replace('{hadir}', String(hadirCount))
      .replace('{terlambat}', String(terlambatCount))
      .replace('{izin}', String(izinCount))
      .replace('{belum}', String(belumCount))
      .replace('{persen}', String(attendancePercentage));

    const result = await invokeWahaNotification({
      action: 'group_recap',
      recipient: groupId,
      message,
      metadata: { meeting_id: currentMeeting.id },
    });

    setWahaActionLoading(null);
    setWahaFeedback(result.message);
    setTimeout(() => setWahaFeedback(null), 4000);
  };

  // WAHA: Kirim Reminder ke Guru yang Belum Hadir
  const handleSendReminderBlast = async () => {
    if (!currentMeeting) return;
    const wahaConfig = getWahaConfig();
    const unpresentTeachers = teachers.filter((t) => t.is_active && !attendanceMap.has(t.id) && t.phone_wa);

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
    <div className="space-y-6">
      {/* Top Controls: Agenda Selector & Quick Actions */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Dashboard Pemantauan Presensi Real-Time</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pantau statistik kehadiran, verifikasi guru belum hadir, dan kirim pengumuman via WAHA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Meeting Selector */}
          <select
            value={selectedMeetingId}
            onChange={(e) => setSelectedMeetingId(e.target.value)}
            className="text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:ring-2 focus:ring-blue-600 focus:outline-hidden max-w-xs truncate"
          >
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} [{m.status.toUpperCase()}]
              </option>
            ))}
          </select>

          <button
            onClick={onRefresh}
            title="Segarkan Data"
            className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI 5-Strip Card */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Peserta */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Total Guru/PTK</span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block tabular-nums">
            {totalTeachers}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">Peserta Terdaftar</span>
        </div>

        {/* Hadir Tepat Waktu */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-emerald-700 block">Hadir Tepat Waktu</span>
          <span className="text-2xl font-bold font-mono text-emerald-600 mt-1 block tabular-nums">
            {hadirCount}
          </span>
          <span className="text-[11px] text-emerald-600/80 mt-1 block">
            {totalTeachers > 0 ? Math.round((hadirCount / totalTeachers) * 100) : 0}% dari total
          </span>
        </div>

        {/* Terlambat */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-amber-700 block">Hadir Terlambat</span>
          <span className="text-2xl font-bold font-mono text-amber-600 mt-1 block tabular-nums">
            {terlambatCount}
          </span>
          <span className="text-[11px] text-amber-600/80 mt-1 block">Toleransi Lewat</span>
        </div>

        {/* Izin / Sakit */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-blue-700 block">Izin / Sakit</span>
          <span className="text-2xl font-bold font-mono text-blue-600 mt-1 block tabular-nums">
            {izinCount}
          </span>
          <span className="text-[11px] text-blue-600/80 mt-1 block">Keterangan Resmi</span>
        </div>

        {/* Belum Hadir */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-600 block">Belum Hadir</span>
          <span className="text-2xl font-bold font-mono text-slate-700 mt-1 block tabular-nums">
            {belumCount}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">Perlu Dikonfirmasi</span>
        </div>

        {/* Persentase Kehadiran */}
        <div className="bg-blue-900 text-white p-4 rounded-xl border border-blue-950 shadow-xs">
          <span className="text-xs font-semibold text-blue-200 block">Tingkat Kehadiran</span>
          <span className="text-2xl font-bold font-mono text-white mt-1 block tabular-nums">
            {attendancePercentage}%
          </span>
          <span className="text-[11px] text-blue-200 mt-1 block">
            {totalPresent} dari {totalTeachers} hadir
          </span>
        </div>
      </div>

      {/* WAHA Quick Broadcast Toolbar */}
      <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="w-4 h-4 text-emerald-700 shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-emerald-900">Integrasi WhatsApp (WAHA Edge Function):</span>
            <span className="text-emerald-800 ml-1">Kirim ringkasan kehadiran langsung ke WhatsApp Group sekolah atau blast pengingat.</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSendReminderBlast}
            disabled={wahaActionLoading !== null || belumCount === 0}
            className="px-3 py-1.5 bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-100 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="w-3 h-3 text-emerald-600" />
            <span>{wahaActionLoading === 'reminder' ? 'Mengirim...' : `Ingatkan ${belumCount} Guru Belum Hadir`}</span>
          </button>

          <button
            onClick={handleSendGroupRecap}
            disabled={wahaActionLoading !== null}
            className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <MessageSquare className="w-3 h-3" />
            <span>{wahaActionLoading === 'recap' ? 'Mengirim...' : 'Kirim Rekap ke Grup WA'}</span>
          </button>
        </div>
      </div>

      {wahaFeedback && (
        <div className="p-3 bg-emerald-100/80 border border-emerald-300 text-emerald-950 rounded-lg text-xs font-medium">
          {wahaFeedback}
        </div>
      )}

      {/* Main Table: Attendance Records */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Filter & Search Header */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Segmented Filter Buttons */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({totalTeachers})
            </button>
            <button
              onClick={() => setStatusFilter('hadir')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                statusFilter === 'hadir' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hadir ({hadirCount})
            </button>
            <button
              onClick={() => setStatusFilter('terlambat')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                statusFilter === 'terlambat' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Terlambat ({terlambatCount})
            </button>
            <button
              onClick={() => setStatusFilter('izin')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                statusFilter === 'izin' ? 'bg-white text-blue-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Izin / Sakit ({izinCount})
            </button>
            <button
              onClick={() => setStatusFilter('belum')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                statusFilter === 'belum' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Belum ({belumCount})
            </button>
          </div>

          {/* Search Input & Action Buttons */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari guru..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <button
              onClick={onNavigateToScanner}
              className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-medium transition-colors shadow-xs whitespace-nowrap"
            >
              Buka Scanner
            </button>

            <button
              onClick={onNavigateToReports}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
            >
              Cetak SPJ
            </button>
          </div>
        </div>

        {/* High-density Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-4 w-12 text-center">No</th>
                <th className="py-2.5 px-4">Nama Guru & NIY</th>
                <th className="py-2.5 px-4">Jabatan / Status</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4">Waktu Hadir</th>
                <th className="py-2.5 px-4">Metode</th>
                <th className="py-2.5 px-4 text-right">Ubah Status Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
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
                    <tr key={teacher.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* No */}
                      <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-400 tabular-nums">
                        {index + 1}
                      </td>

                      {/* Nama & NIY */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 leading-tight">{teacher.name}</div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          NIY. {teacher.niy || teacher.nip || '-'}
                        </div>
                      </td>

                      {/* Role & Rank */}
                      <td className="py-3 px-4 text-slate-600">
                        <div>{teacher.role_title}</div>
                        <div className="text-[11px] text-slate-400">{teacher.rank_group}</div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {att ? (
                          <span
                            className={`inline-block font-semibold text-[11px] px-2 py-0.5 rounded ${
                              att.status === 'hadir'
                                ? 'bg-emerald-100 text-emerald-800'
                                : att.status === 'terlambat'
                                ? 'bg-amber-100 text-amber-800'
                                : att.status === 'izin'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {att.status.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Belum Hadir</span>
                        )}
                      </td>

                      {/* Waktu Hadir */}
                      <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-700">
                        {timeFormatted}
                      </td>

                      {/* Metode */}
                      <td className="py-3 px-4 text-[11px] text-slate-500">
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
                            className="px-2 py-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors"
                          >
                            Hadir
                          </button>
                          <button
                            onClick={() => handleQuickStatusChange(teacher, 'izin')}
                            title="Tandai Izin"
                            className="px-2 py-1 text-[10px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                          >
                            Izin
                          </button>
                          <button
                            onClick={() => handleQuickStatusChange(teacher, 'sakit')}
                            title="Tandai Sakit"
                            className="px-2 py-1 text-[10px] font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 rounded border border-amber-200 transition-colors"
                          >
                            Sakit
                          </button>
                          {isPresent && (
                            <button
                              onClick={() => handleQuickStatusChange(teacher, 'reset')}
                              title="Batalkan / Reset Presensi"
                              className="px-1.5 py-1 text-[10px] text-slate-400 hover:text-red-600 transition-colors"
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
      </div>
    </div>
  );
};
