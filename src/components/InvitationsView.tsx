import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Mail,
  Send,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Copy,
  ExternalLink,
  Search,
  Sparkles,
  MessageSquare,
  Building2,
  Calendar,
  MapPin,
  User,
  HeartPulse,
  RefreshCw,
  Edit2
} from 'lucide-react';
import { Invitation, Meeting, RsvpStatus, SchoolProfile, Teacher } from '../types';
import { sortTeachersStructuralFirst } from '../lib/teacherGroups';
import { saveBatchInvitations, saveInvitation } from '../lib/storage';
import { invokeWahaNotification } from '../lib/waha';

interface InvitationsViewProps {
  meetings: Meeting[];
  teachers: Teacher[];
  invitations: Invitation[];
  onRefreshInvitations: () => void;
  schoolProfile: SchoolProfile;
}

export const InvitationsView: React.FC<InvitationsViewProps> = ({
  meetings,
  teachers,
  invitations,
  onRefreshInvitations,
  schoolProfile,
}) => {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(meetings[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRsvp, setFilterRsvp] = useState<string>('all');
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Letter numbering settings
  const [letterPrefix, setLetterPrefix] = useState('421.3');
  const [letterSuffix, setLetterSuffix] = useState('/SMP.M.1/X/2026');
  const [startNumber, setStartNumber] = useState(1);
  const [dispatchDate, setDispatchDate] = useState(() => new Date().toISOString().split('T')[0]);

  const currentMeeting = meetings.find((m) => m.id === selectedMeetingId) || meetings[0];

  // Teachers expected for this meeting (respecting target_type and invited_teacher_ids)
  const meetingTeachers = useMemo(() => {
    if (!currentMeeting) return [];
    const isCustom =
      currentMeeting.target_type === 'custom' &&
      Array.isArray(currentMeeting.invited_teacher_ids) &&
      currentMeeting.invited_teacher_ids.length > 0;

    const filtered = teachers.filter((t) => {
      if (!t.is_active) return false;
      if (isCustom) return currentMeeting.invited_teacher_ids!.includes(t.id);
      return true;
    });

    return sortTeachersStructuralFirst(filtered);
  }, [currentMeeting, teachers]);

  // Invitations map for current meeting: teacher_id -> Invitation
  const currentMeetingInvitationsMap = useMemo(() => {
    const map = new Map<string, Invitation>();
    if (!currentMeeting) return map;
    invitations
      .filter((inv) => inv.meeting_id === currentMeeting.id)
      .forEach((inv) => map.set(inv.teacher_id, inv));
    return map;
  }, [invitations, currentMeeting]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Metrics
  const stats = useMemo(() => {
    const total = meetingTeachers.length;
    let sentCount = 0;
    let attendingCount = 0;
    let permissionCount = 0;
    let sickCount = 0;
    let unconfirmedCount = 0;

    meetingTeachers.forEach((t) => {
      const inv = currentMeetingInvitationsMap.get(t.id);
      if (inv && inv.dispatch_status === 'sent') sentCount++;

      const rsvp = inv?.rsvp_status || 'unconfirmed';
      if (rsvp === 'attending') attendingCount++;
      else if (rsvp === 'permission') permissionCount++;
      else if (rsvp === 'sick') sickCount++;
      else unconfirmedCount++;
    });

    return { total, sentCount, attendingCount, permissionCount, sickCount, unconfirmedCount };
  }, [meetingTeachers, currentMeetingInvitationsMap]);

  // Generate automated letter numbers for all teachers in this meeting
  const handleGenerateLetterNumbers = async () => {
    if (!currentMeeting) return;
    const toSave: Invitation[] = [];

    meetingTeachers.forEach((teacher, idx) => {
      const numStr = String(startNumber + idx).padStart(3, '0');
      const letterNum = `${letterPrefix}/${numStr}${letterSuffix}`;
      const existing = currentMeetingInvitationsMap.get(teacher.id);

      toSave.push({
        id: existing?.id || Math.random().toString(36).substring(2, 9),
        meeting_id: currentMeeting.id,
        teacher_id: teacher.id,
        letter_number: letterNum,
        dispatch_date: dispatchDate,
        dispatch_channel: existing?.dispatch_channel || 'whatsapp',
        dispatch_status: existing?.dispatch_status || 'pending',
        sent_at: existing?.sent_at,
        rsvp_status: existing?.rsvp_status || 'unconfirmed',
        rsvp_notes: existing?.rsvp_notes || '',
        rsvp_at: existing?.rsvp_at,
        created_at: existing?.created_at || new Date().toISOString(),
      });
    });

    await saveBatchInvitations(toSave);
    onRefreshInvitations();
    showToast(`Berhasil menerbitkan nomor surat otomatis untuk ${toSave.length} guru.`);
  };

  // Generate personalized WhatsApp message and RSVP URL
  const getPersonalizedUrl = (teacherId: string) => {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?rsvp=${currentMeeting.id}&t=${teacherId}`;
  };

  const getPersonalizedMessage = (teacher: Teacher, letterNum?: string) => {
    const rsvpUrl = getPersonalizedUrl(teacher.id);
    const dateFormatted = new Date(currentMeeting.meeting_date).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return `*SURAT UNDANGAN KEDINASAN*
Nomor: ${letterNum || '-'}
Perihal: Undangan ${currentMeeting.title}

Kepada Yth.
*${teacher.name}*
${teacher.role_title}
di Tempat

Assalamu'alaikum Wr. Wb.
Mengharap kehadiran Bapak/Ibu pada rapat dinas dengan rincian:

• Agenda: *${currentMeeting.title}*
• Hari/Tanggal: ${dateFormatted}
• Waktu: Pukul *${currentMeeting.start_time} - ${currentMeeting.end_time} WIB*
• Ruangan: ${currentMeeting.room}
• Pimpinan: ${currentMeeting.leader_name}

Mohon mengisi *Konfirmasi Kehadiran (RSVP)* melalui tautan resmi berikut:
👉 ${rsvpUrl}

Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.
Wassalamu'alaikum Wr. Wb.

_Tata Usaha & Kepanitiaan ${schoolProfile.school_name}_
_Aplikasi dePresent_`;
  };

  // Dispatch individual WhatsApp invitation
  const handleSendSingleWA = async (teacher: Teacher) => {
    if (!teacher.phone_wa) {
      showToast(`Nomor WhatsApp untuk ${teacher.name} belum terdaftar.`, 'error');
      return;
    }

    const existing = currentMeetingInvitationsMap.get(teacher.id);
    const letterNum = existing?.letter_number || `${letterPrefix}/${String(startNumber).padStart(3, '0')}${letterSuffix}`;
    const msg = getPersonalizedMessage(teacher, letterNum);

    const res = await invokeWahaNotification({
      action: 'invitation_dispatch',
      recipient: teacher.phone_wa,
      message: msg,
      metadata: {
        meetingId: currentMeeting.id,
        teacherId: teacher.id,
        letterNumber: letterNum,
      },
    });

    if (res.success) {
      const updated: Invitation = {
        id: existing?.id || Math.random().toString(36).substring(2, 9),
        meeting_id: currentMeeting.id,
        teacher_id: teacher.id,
        letter_number: letterNum,
        dispatch_date: dispatchDate,
        dispatch_channel: 'whatsapp',
        dispatch_status: 'sent',
        sent_at: new Date().toISOString(),
        rsvp_status: existing?.rsvp_status || 'unconfirmed',
        rsvp_notes: existing?.rsvp_notes || '',
        rsvp_at: existing?.rsvp_at,
        created_at: existing?.created_at || new Date().toISOString(),
      };
      await saveInvitation(updated);
      onRefreshInvitations();
      showToast(`Undangan berhasil dikirimkan ke WhatsApp ${teacher.name}`);
    } else {
      showToast(`Gagal kirim WA ke ${teacher.name}: ${res.message}`, 'error');
    }
  };

  // Bulk dispatch to all unsent teachers
  const handleSendBulkWA = async () => {
    const unsentTeachers = meetingTeachers.filter((t) => {
      const inv = currentMeetingInvitationsMap.get(t.id);
      return !inv || inv.dispatch_status !== 'sent';
    });

    if (unsentTeachers.length === 0) {
      showToast('Semua guru dalam rapat ini sudah menerima undangan.', 'info');
      return;
    }

    setIsSendingBulk(true);
    setBulkProgress({ current: 0, total: unsentTeachers.length });

    let successCount = 0;
    const toSave: Invitation[] = [];

    for (let i = 0; i < unsentTeachers.length; i++) {
      const teacher = unsentTeachers[i];
      setBulkProgress({ current: i + 1, total: unsentTeachers.length });

      if (teacher.phone_wa) {
        const existing = currentMeetingInvitationsMap.get(teacher.id);
        const letterNum = existing?.letter_number || `${letterPrefix}/${String(startNumber + i).padStart(3, '0')}${letterSuffix}`;
        const msg = getPersonalizedMessage(teacher, letterNum);

        const res = await invokeWahaNotification({
          action: 'invitation_dispatch',
          recipient: teacher.phone_wa,
          message: msg,
        });

        if (res.success) {
          successCount++;
          toSave.push({
            id: existing?.id || Math.random().toString(36).substring(2, 9),
            meeting_id: currentMeeting.id,
            teacher_id: teacher.id,
            letter_number: letterNum,
            dispatch_date: dispatchDate,
            dispatch_channel: 'whatsapp',
            dispatch_status: 'sent',
            sent_at: new Date().toISOString(),
            rsvp_status: existing?.rsvp_status || 'unconfirmed',
            rsvp_notes: existing?.rsvp_notes || '',
            rsvp_at: existing?.rsvp_at,
            created_at: existing?.created_at || new Date().toISOString(),
          });
        }
      }
      // Small throttle to avoid flooding
      await new Promise((r) => setTimeout(r, 600));
    }

    if (toSave.length > 0) {
      await saveBatchInvitations(toSave);
      onRefreshInvitations();
    }

    setIsSendingBulk(false);
    setBulkProgress(null);
    showToast(`Pengiriman massal selesai! Berhasil mengirim ${successCount} dari ${unsentTeachers.length} undangan.`);
  };

  // Quick manual RSVP change by panitia/TU
  const handleUpdateRsvpManual = async (teacher: Teacher, newStatus: RsvpStatus) => {
    const existing = currentMeetingInvitationsMap.get(teacher.id);
    const updated: Invitation = {
      id: existing?.id || Math.random().toString(36).substring(2, 9),
      meeting_id: currentMeeting.id,
      teacher_id: teacher.id,
      letter_number: existing?.letter_number || '-',
      dispatch_date: existing?.dispatch_date || dispatchDate,
      dispatch_channel: existing?.dispatch_channel || 'manual',
      dispatch_status: existing?.dispatch_status || 'sent',
      sent_at: existing?.sent_at || new Date().toISOString(),
      rsvp_status: newStatus,
      rsvp_notes: existing?.rsvp_notes || (newStatus === 'permission' ? 'Dikonfirmasi manual oleh Panitia' : ''),
      rsvp_at: new Date().toISOString(),
      created_at: existing?.created_at || new Date().toISOString(),
    };
    await saveInvitation(updated);
    onRefreshInvitations();
    showToast(`Status RSVP ${teacher.name} diubah menjadi ${newStatus}.`);
  };

  // Copy RSVP link
  const handleCopyLink = (teacherId: string, teacherName: string) => {
    const url = getPersonalizedUrl(teacherId);
    navigator.clipboard.writeText(url);
    showToast(`Tautan RSVP untuk ${teacherName} berhasil disalin ke clipboard.`);
  };

  // Print Expedition Book
  const handlePrint = () => {
    window.print();
  };

  // Export Expedition Book to Excel (.xlsx)
  const handleExportXLSX = () => {
    if (!currentMeeting) return;

    const rows: (string | number)[][] = [
      ['BUKU EKSPEDISI DAN TANDA TERIMA SURAT UNDANGAN DINAS'],
      [schoolProfile.school_name || 'SMP MUHAMMADIYAH 1 GOMBONG'],
      [schoolProfile.address || ''],
      [],
      ['Agenda Rapat', currentMeeting.title],
      ['Kategori', currentMeeting.category],
      ['Hari / Tanggal', currentMeeting.meeting_date],
      ['Waktu', `${currentMeeting.start_time} - ${currentMeeting.end_time} WIB`],
      ['Ruangan', currentMeeting.room],
      ['Pimpinan Rapat', currentMeeting.leader_name],
      [],
      ['REKAPITULASI EKSPEDISI'],
      ['Total Undangan', stats.total],
      ['Terkirim WhatsApp', stats.sentCount],
      ['Konfirmasi Hadir', stats.attendingCount],
      ['Konfirmasi Izin', stats.permissionCount],
      ['Konfirmasi Sakit', stats.sickCount],
      ['Belum Konfirmasi', stats.unconfirmedCount],
      [],
      [
        'No',
        'Nomor Surat',
        'Nama Guru / Pegawai',
        'NIY / NIP',
        'Jabatan / Mapel',
        'Kelompok',
        'No. WhatsApp',
        'Tgl Kirim',
        'Media',
        'Status Kirim',
        'Konfirmasi Kehadiran',
        'Waktu Konfirmasi',
        'Catatan / Alasan',
      ],
    ];

    meetingTeachers.forEach((teacher, idx) => {
      const inv = currentMeetingInvitationsMap.get(teacher.id);
      const rsvpLabel =
        inv?.rsvp_status === 'attending'
          ? 'Akan Hadir'
          : inv?.rsvp_status === 'permission'
          ? 'Izin'
          : inv?.rsvp_status === 'sick'
          ? 'Sakit'
          : 'Belum Konfirmasi';

      rows.push([
        idx + 1,
        inv?.letter_number || '-',
        teacher.name,
        teacher.niy || teacher.nip || '-',
        teacher.role_title,
        teacher.teacher_group || 'Guru Mapel',
        teacher.phone_wa || '-',
        inv?.dispatch_date || '-',
        inv?.dispatch_channel === 'whatsapp' ? 'WhatsApp' : 'Fisik/Manual',
        inv?.dispatch_status === 'sent' ? 'Terkirim' : 'Pending',
        rsvpLabel,
        inv?.rsvp_at ? new Date(inv.rsvp_at).toLocaleString('id-ID') : '-',
        inv?.rsvp_notes || '',
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // Auto fit column widths
    const colWidths = [
      { wch: 5 },  // No
      { wch: 28 }, // No Surat
      { wch: 30 }, // Nama
      { wch: 18 }, // NIY
      { wch: 25 }, // Jabatan
      { wch: 20 }, // Kelompok
      { wch: 16 }, // WA
      { wch: 12 }, // Tgl Kirim
      { wch: 12 }, // Media
      { wch: 12 }, // Status
      { wch: 18 }, // RSVP
      { wch: 20 }, // Waktu RSVP
      { wch: 30 }, // Catatan
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Buku Ekspedisi');

    const cleanTitle = currentMeeting.title.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(workbook, `Ekspedisi_Undangan_${cleanTitle}_${currentMeeting.meeting_date}.xlsx`);
    showToast('File Excel Buku Ekspedisi berhasil diunduh.');
  };

  // Filtered teachers for dashboard display
  const displayedTeachers = useMemo(() => {
    return meetingTeachers.filter((t) => {
      const matchSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.niy && t.niy.toLowerCase().includes(searchQuery.toLowerCase())) ||
        t.role_title.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      if (filterRsvp === 'all') return true;
      const inv = currentMeetingInvitationsMap.get(t.id);
      const rsvp = inv?.rsvp_status || 'unconfirmed';
      if (filterRsvp === 'unsent') return !inv || inv.dispatch_status !== 'sent';
      return rsvp === filterRsvp;
    });
  }, [meetingTeachers, searchQuery, filterRsvp, currentMeetingInvitationsMap]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border text-sm font-medium transition-all ${
            toastMessage.type === 'error'
              ? 'bg-rose-950 text-rose-200 border-rose-800'
              : toastMessage.type === 'info'
              ? 'bg-sky-950 text-sky-200 border-sky-800'
              : 'bg-emerald-950 text-emerald-200 border-emerald-800'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Screen Only Top Bar */}
      <div className="no-print space-y-4">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                <Mail className="w-5 h-5" />
              </span>
              Surat Undangan & Buku Ekspedisi
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Penerbitan surat undangan resmi, pengiriman tautan RSVP via WhatsApp WAHA, dan pencatatan buku ekspedisi kedinasan.
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Cetak Laporan Ekspedisi
            </button>

            <button
              onClick={handleExportXLSX}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Ekspor Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* Meeting Selector & Numbering Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Select Meeting */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pilih Agenda Rapat
            </label>
            <select
              value={selectedMeetingId}
              onChange={(e) => setSelectedMeetingId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-teal-500"
            >
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.meeting_date} • {m.title} ({m.category})
                </option>
              ))}
            </select>

            {currentMeeting && (
              <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                <p>📍 {currentMeeting.room} • ⏰ {currentMeeting.start_time} - {currentMeeting.end_time} WIB</p>
                <p>👤 Pimpinan: <span className="font-semibold text-slate-700 dark:text-slate-300">{currentMeeting.leader_name}</span></p>
              </div>
            )}
          </div>

          {/* Letter Numbering Generator */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Format Penomoran Surat Dinas
              </span>
              <button
                type="button"
                onClick={handleGenerateLetterNumbers}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30 text-xs font-semibold transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Terbitkan Nomor Otomatis
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Prefix / Kode</label>
                <input
                  type="text"
                  value={letterPrefix}
                  onChange={(e) => setLetterPrefix(e.target.value)}
                  placeholder="421.3"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Suffix / Indeks & Tahun</label>
                <input
                  type="text"
                  value={letterSuffix}
                  onChange={(e) => setLetterSuffix(e.target.value)}
                  placeholder="/SMP.M.1/X/2026"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Tgl Pengiriman</label>
                <input
                  type="date"
                  value={dispatchDate}
                  onChange={(e) => setDispatchDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Contoh keluaran:{' '}
              <span className="font-mono text-teal-600 dark:text-teal-400 font-semibold">
                {letterPrefix}/{String(startNumber).padStart(3, '0')}{letterSuffix}
              </span>
            </p>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Total Undangan</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">{stats.total}</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-teal-500/30 rounded-2xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-teal-600 dark:text-teal-400 block">Terkirim WA</span>
            <span className="text-2xl font-bold text-teal-600 dark:text-teal-400 font-mono tabular-nums">{stats.sentCount}</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-2xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 block">Akan Hadir</span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">{stats.attendingCount}</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-amber-500/30 rounded-2xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 block">Izin Dinas</span>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums">{stats.permissionCount}</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-sky-500/30 rounded-2xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400 block">Sakit</span>
            <span className="text-2xl font-bold text-sky-600 dark:text-sky-400 font-mono tabular-nums">{stats.sickCount}</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Belum Konfirmasi</span>
            <span className="text-2xl font-bold text-slate-500 dark:text-slate-400 font-mono tabular-nums">{stats.unconfirmedCount}</span>
          </div>
        </div>

        {/* Bulk Action & Filters */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search & Status Filter */}
          <div className="flex items-center gap-2.5 flex-1 flex-wrap">
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama guru, NIY..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-teal-500"
              />
            </div>

            <select
              value={filterRsvp}
              onChange={(e) => setFilterRsvp(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-teal-500"
            >
              <option value="all">Semua Status RSVP</option>
              <option value="unsent">Belum Terkirim WA</option>
              <option value="attending">Akan Hadir</option>
              <option value="permission">Izin Dinas</option>
              <option value="sick">Sakit</option>
              <option value="unconfirmed">Belum Konfirmasi</option>
            </select>
          </div>

          {/* Bulk WhatsApp Dispatch Button */}
          <div>
            <button
              onClick={handleSendBulkWA}
              disabled={isSendingBulk || stats.total === 0}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-600 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-teal-950/30 transition-all disabled:opacity-50"
            >
              {isSendingBulk ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>
                    Mengirim ({bulkProgress?.current}/{bulkProgress?.total})...
                  </span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Undangan WhatsApp (Massal)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Expedition Table (Screen View) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3.5 w-12 text-center">No</th>
                  <th className="py-3 px-3.5">No. Surat</th>
                  <th className="py-3 px-3.5">Nama Guru / Pegawai</th>
                  <th className="py-3 px-3.5">Jabatan / Kelompok</th>
                  <th className="py-3 px-3.5">No. WhatsApp</th>
                  <th className="py-3 px-3.5">Distribusi</th>
                  <th className="py-3 px-3.5">Status RSVP</th>
                  <th className="py-3 px-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {displayedTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Tidak ada data guru yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  displayedTeachers.map((teacher, idx) => {
                    const inv = currentMeetingInvitationsMap.get(teacher.id);
                    const isSent = inv?.dispatch_status === 'sent';
                    const rsvp = inv?.rsvp_status || 'unconfirmed';

                    return (
                      <tr
                        key={teacher.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-3.5 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-teal-700 dark:text-teal-400 font-semibold whitespace-nowrap">
                          {inv?.letter_number || '-'}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-slate-900 dark:text-white leading-tight">
                            {teacher.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            NIY: {teacher.niy || teacher.nip || '-'}
                          </div>
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="text-slate-800 dark:text-slate-200">{teacher.role_title}</div>
                          <div className="text-[10px] text-slate-400">{teacher.teacher_group || 'Guru Mapel'}</div>
                        </td>
                        <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-slate-300">
                          {teacher.phone_wa || <span className="text-rose-400">(Belum ada)</span>}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {isSent ? (
                            <div className="flex flex-col">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" />
                                Terkirim WA
                              </span>
                              {inv?.sent_at && (
                                <span className="text-[10px] text-slate-400">
                                  {new Date(inv.sent_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">Belum Dikirim</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {rsvp === 'attending' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              Akan Hadir
                            </span>
                          )}
                          {rsvp === 'permission' && (
                            <div className="flex flex-col">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <AlertCircle className="w-3 h-3" />
                                Izin Dinas
                              </span>
                              {inv?.rsvp_notes && (
                                <span className="text-[10px] text-slate-400 max-w-[140px] truncate" title={inv.rsvp_notes}>
                                  {inv.rsvp_notes}
                                </span>
                              )}
                            </div>
                          )}
                          {rsvp === 'sick' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                              <HeartPulse className="w-3 h-3" />
                              Sakit
                            </span>
                          )}
                          {rsvp === 'unconfirmed' && (
                            <span className="text-[11px] text-slate-400 italic">Belum Konfirmasi</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Send WA Button */}
                            <button
                              onClick={() => handleSendSingleWA(teacher)}
                              title="Kirim Undangan WhatsApp"
                              className="p-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/20 transition-colors"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>

                            {/* Copy RSVP Link */}
                            <button
                              onClick={() => handleCopyLink(teacher.id, teacher.name)}
                              title="Salin Tautan RSVP"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            {/* Manual RSVP Dropdown */}
                            <select
                              value={rsvp}
                              onChange={(e) => handleUpdateRsvpManual(teacher, e.target.value as RsvpStatus)}
                              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 focus:outline-hidden"
                            >
                              <option value="unconfirmed">Belum</option>
                              <option value="attending">Hadir</option>
                              <option value="permission">Izin</option>
                              <option value="sick">Sakit</option>
                            </select>
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

      {/* ========================================================================= */}
      {/* PRINT-ONLY OFFICIAL EXPEDITION REPORT (BER-KOP SURAT & TANDA TANGAN)      */}
      {/* ========================================================================= */}
      <div className="hidden print:block print-container p-6 bg-white text-black font-sans leading-relaxed">
        {/* Kop Surat Resmi */}
        <div className="flex items-center gap-4 border-b-4 border-double border-black pb-3 mb-4">
          {schoolProfile.logo_url ? (
            <img
              src={schoolProfile.logo_url}
              alt="Logo Sekolah"
              className="w-20 h-20 object-contain shrink-0"
            />
          ) : (
            <div className="w-20 h-20 border-2 border-black flex items-center justify-center font-bold text-xs text-center p-1 shrink-0">
              LOGO SEKOLAH
            </div>
          )}
          <div className="flex-1 text-center">
            {schoolProfile.foundation_name && (
              <h3 className="text-xs font-bold uppercase tracking-wider text-black">
                {schoolProfile.foundation_name}
              </h3>
            )}
            <h1 className="text-xl font-black uppercase text-black tracking-tight">
              {schoolProfile.school_name || 'SMP MUHAMMADIYAH 1 GOMBONG'}
            </h1>
            <p className="text-[11px] text-black">
              {schoolProfile.address || 'Jl. Kauman No. 1, Gombong, Kebumen, Jawa Tengah'}
            </p>
            <p className="text-[10px] text-black">
              NPSN: {schoolProfile.npsn || '-'} • Telp: {schoolProfile.phone || '-'} • Email: {schoolProfile.email || '-'}
            </p>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-4">
          <h2 className="text-base font-black uppercase underline tracking-wide">
            BUKU EKSPEDISI DAN TANDA TERIMA SURAT UNDANGAN DINAS
          </h2>
          <p className="text-xs font-semibold mt-0.5">
            Agenda Kegiatan: {currentMeeting?.title}
          </p>
        </div>

        {/* Meeting Metadata */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-4 border border-black p-3 bg-gray-50">
          <div>
            <span className="font-bold inline-block w-28">Kategori Rapat</span>
            <span>: {currentMeeting?.category}</span>
          </div>
          <div>
            <span className="font-bold inline-block w-28">Pimpinan Rapat</span>
            <span>: {currentMeeting?.leader_name}</span>
          </div>
          <div>
            <span className="font-bold inline-block w-28">Hari, Tanggal</span>
            <span>
              : {currentMeeting ? new Date(currentMeeting.meeting_date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
            </span>
          </div>
          <div>
            <span className="font-bold inline-block w-28">Ruang / Tempat</span>
            <span>: {currentMeeting?.room}</span>
          </div>
          <div>
            <span className="font-bold inline-block w-28">Waktu Pelaksanaan</span>
            <span>: {currentMeeting?.start_time} - {currentMeeting?.end_time} WIB</span>
          </div>
          <div>
            <span className="font-bold inline-block w-28">Jumlah Penerima</span>
            <span>: {meetingTeachers.length} Orang Guru/Pegawai</span>
          </div>
        </div>

        {/* Official Expedition Table */}
        <table className="w-full text-[10px] border-collapse border border-black mb-6">
          <thead>
            <tr className="bg-gray-100 border-b border-black text-center font-bold">
              <th className="border border-black py-1.5 px-1 w-8">No</th>
              <th className="border border-black py-1.5 px-2 w-32">Nomor Surat</th>
              <th className="border border-black py-1.5 px-2">Nama Guru / Pegawai</th>
              <th className="border border-black py-1.5 px-2 w-28">NIY / NIP</th>
              <th className="border border-black py-1.5 px-2">Jabatan</th>
              <th className="border border-black py-1.5 px-1 w-20">Media & Tgl Kirim</th>
              <th className="border border-black py-1.5 px-1 w-20">Status RSVP</th>
              <th className="border border-black py-1.5 px-2 w-28">Tanda Tangan / Paraf Bukti Terima</th>
            </tr>
          </thead>
          <tbody>
            {meetingTeachers.map((teacher, idx) => {
              const inv = currentMeetingInvitationsMap.get(teacher.id);
              const rsvpLabel =
                inv?.rsvp_status === 'attending'
                  ? 'Akan Hadir'
                  : inv?.rsvp_status === 'permission'
                  ? 'Izin'
                  : inv?.rsvp_status === 'sick'
                  ? 'Sakit'
                  : 'Belum Konfirmasi';

              const isOdd = (idx + 1) % 2 !== 0;

              return (
                <tr key={teacher.id} className="border-b border-black">
                  <td className="border border-black text-center py-1.5 font-bold">{idx + 1}</td>
                  <td className="border border-black px-1.5 py-1.5 font-mono">{inv?.letter_number || '-'}</td>
                  <td className="border border-black px-1.5 py-1.5 font-bold">{teacher.name}</td>
                  <td className="border border-black px-1.5 py-1.5 font-mono">{teacher.niy || teacher.nip || '-'}</td>
                  <td className="border border-black px-1.5 py-1.5">{teacher.role_title}</td>
                  <td className="border border-black text-center py-1.5">
                    {inv?.dispatch_channel === 'whatsapp' ? 'WhatsApp' : 'Fisik'}<br />
                    <span className="text-[9px] text-gray-600">{inv?.dispatch_date || '-'}</span>
                  </td>
                  <td className="border border-black text-center py-1.5 font-semibold">
                    {rsvpLabel}
                  </td>
                  <td className="border border-black py-1.5 px-2 h-9 align-middle">
                    <div className="flex items-center justify-between text-gray-500">
                      <span className="font-bold text-[9px]">{idx + 1}.</span>
                      <span className="text-[8px] text-gray-400">
                        {inv?.rsvp_status === 'attending' ? '(Konfirmasi WA)' : '..................'}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 3-Column Official Signature Block */}
        <div className="break-inside-avoid mt-8 grid grid-cols-3 text-center text-xs">
          {/* Petugas Ekspedisi */}
          <div className="flex flex-col justify-between h-28">
            <p>
              Petugas Ekspedisi / TU,
            </p>
            <div>
              <p className="font-bold underline uppercase">( ............................................ )</p>
              <p className="text-[10px] text-gray-600">NIP / NIY: -</p>
            </div>
          </div>

          {/* Pimpinan Rapat */}
          <div className="flex flex-col justify-between h-28">
            <p>
              Pimpinan Rapat,
            </p>
            <div>
              <p className="font-bold underline uppercase">
                {currentMeeting?.leader_name || '( ............................................ )'}
              </p>
              <p className="text-[10px] text-gray-600">
                NIY: {currentMeeting?.leader_niy || '-'}
              </p>
            </div>
          </div>

          {/* Kepala Sekolah */}
          <div className="flex flex-col justify-between h-28">
            <div>
              <p>Mengetahui,</p>
              <p>Kepala Sekolah,</p>
            </div>
            <div>
              <p className="font-bold underline uppercase">
                {schoolProfile.headmaster_name || '( ............................................ )'}
              </p>
              <p className="text-[10px] text-gray-600">
                NIY: {schoolProfile.headmaster_niy || schoolProfile.headmaster_nip || '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer print note */}
        <div className="mt-6 pt-2 border-t border-gray-400 text-[9px] text-gray-500 flex justify-between">
          <span>Dicetak dari Sistem dePresent • {schoolProfile.school_name}</span>
          <span>Waktu Cetak: {new Date().toLocaleString('id-ID')}</span>
        </div>
      </div>
    </div>
  );
};
