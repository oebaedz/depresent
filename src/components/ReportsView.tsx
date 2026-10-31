import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Printer,
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Calendar,
  MapPin,
  User,
  Check,
  Building2,
  Share2,
  UserX,
  ShieldCheck,
  Send,
  Copy,
  ExternalLink,
  Lock,
  Unlock,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { Attendance, Meeting, SchoolProfile, Teacher, DocumentSignature, SignerRole } from '../types';
import { sortTeachersStructuralFirst } from '../lib/teacherGroups';
import { AbsentTeachersModal } from './AbsentTeachersModal';
import { DigitalSignatureBadge } from './DigitalSignatureBadge';
import { ensureMeetingSignatures, fetchDocumentSignatures, getCachedDocumentSignatures, toggleLockMeeting } from '../lib/storage';
import { invokeWahaNotification } from '../lib/waha';


interface ReportsViewProps {
  meetings: Meeting[];
  teachers: Teacher[];
  attendances: Attendance[];
  schoolProfile: SchoolProfile;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  meetings,
  teachers,
  attendances,
  schoolProfile,
}) => {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(meetings[0]?.id || '');
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [isAbsentModalOpen, setIsAbsentModalOpen] = useState(false);

  const currentMeeting = meetings.find((m) => m.id === selectedMeetingId) || meetings[0];

  const meetingAttendances = currentMeeting
    ? attendances.filter((a) => a.meeting_id === currentMeeting.id)
    : [];

  const attendanceMap = new Map<string, Attendance>();
  meetingAttendances.forEach((a) => attendanceMap.set(a.teacher_id, a));

  // Filter active teachers according to current meeting's target_type & invited_teacher_ids, sorted structural-first
  const isCustomMeeting =
    currentMeeting &&
    currentMeeting.target_type === 'custom' &&
    Array.isArray(currentMeeting.invited_teacher_ids) &&
    currentMeeting.invited_teacher_ids.length > 0;

  const activeTeachers = sortTeachersStructuralFirst(
    teachers
      .filter((t) => t.is_active)
      .filter((t) => !isCustomMeeting || currentMeeting.invited_teacher_ids!.includes(t.id))
  );

  // Digital Signatures state for this meeting
  const [signatures, setSignatures] = useState<DocumentSignature[]>(() => {
    return currentMeeting ? getCachedDocumentSignatures(currentMeeting.id) : [];
  });
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false);
  const [signatureFeedback, setSignatureFeedback] = useState<string | null>(null);

  const loadSignatures = async () => {
    if (!currentMeeting) return;
    setIsLoadingSignatures(true);
    try {
      const data = await ensureMeetingSignatures(currentMeeting, schoolProfile, activeTeachers);
      setSignatures(data);
    } catch (err) {
      console.warn('Failed to ensure meeting signatures:', err);
    } finally {
      setIsLoadingSignatures(false);
    }
  };

  useEffect(() => {
    loadSignatures();
  }, [currentMeeting?.id, schoolProfile.headmaster_name]);

  const total = activeTeachers.length;
  const hadir = meetingAttendances.filter((a) => a.status === 'hadir').length;
  const terlambat = meetingAttendances.filter((a) => a.status === 'terlambat').length;
  const izin = meetingAttendances.filter((a) => a.status === 'izin').length;
  const sakit = meetingAttendances.filter((a) => a.status === 'sakit').length;
  const tidakHadir = Math.max(0, total - (hadir + terlambat + izin + sakit));
  const rate = total > 0 ? Math.round(((hadir + terlambat) / total) * 100) : 0;

  const secretarySig = signatures.find(
    (s) => s.document_type === 'attendance_report' && s.signer_role === 'secretary'
  );
  const leaderSig = signatures.find(
    (s) => s.document_type === 'attendance_report' && s.signer_role === 'leader'
  );
  const headmasterSig = signatures.find(
    (s) => s.document_type === 'attendance_report' && s.signer_role === 'headmaster'
  );

  const isSecretarySigned = secretarySig?.status === 'signed';
  const isLeaderSigned = leaderSig?.status === 'signed';
  const isHeadmasterSigned = headmasterSig?.status === 'signed';

  // Find phone numbers
  const secretaryTeacher = teachers.find(
    (t) => t.name.toLowerCase() === currentMeeting?.secretary_name?.toLowerCase() || (t.niy && t.niy === currentMeeting?.secretary_niy)
  );
  const leaderTeacher = teachers.find(
    (t) => t.name.toLowerCase() === currentMeeting?.leader_name?.toLowerCase() || (t.niy && t.niy === currentMeeting?.leader_niy)
  );

  const secretaryPhone = secretaryTeacher?.phone_wa || secretarySig?.signer_phone || '';
  const leaderPhone = leaderTeacher?.phone_wa || leaderSig?.signer_phone || '';
  const headmasterPhone = schoolProfile.phone || headmasterSig?.signer_phone || '';

  const getSignUrl = (role: SignerRole) => {
    if (typeof window === 'undefined' || !currentMeeting) return '';
    return `${window.location.origin}${window.location.pathname}?sign=${currentMeeting.id}&role=${role}&doc=attendance_report`;
  };

  const handleCopySignUrl = (role: SignerRole, label: string) => {
    const url = getSignUrl(role);
    if (!url) return;
    navigator.clipboard.writeText(url);
    setSignatureFeedback(`Tautan persetujuan & TTD digital untuk ${label} berhasil disalin!`);
    setTimeout(() => setSignatureFeedback(null), 4000);
  };

  const handleSendSignWa = async (role: SignerRole, label: string, targetName: string, targetPhone?: string) => {
    if (!currentMeeting) return;
    const url = getSignUrl(role);
    const textMsg = `*PERMOHONAN PENGESAHAN & TANDA TANGAN ELEKTRONIK*\n` +
      `Yth. Bapak/Ibu *${targetName}* (${label})\n` +
      `${schoolProfile.school_name || 'SMP Muhammadiyah 1 Gombong'}\n\n` +
      `Sehubungan dengan selesainya agenda rapat kedinasan:\n` +
      `📌 *${currentMeeting.title}*\n` +
      `📅 Hari/Tanggal: ${currentMeeting.meeting_date}\n` +
      `⏰ Waktu: ${currentMeeting.start_time.slice(0, 5)} - ${currentMeeting.end_time.slice(0, 5)} WIB\n` +
      `🏛️ Tempat: ${currentMeeting.room}\n\n` +
      `📊 *Rekapitulasi Kehadiran Peserta:*\n` +
      `- Total Pegawai: ${total} orang\n` +
      `- Hadir: ${hadir + terlambat} orang (${rate}%)\n` +
      `- Izin / Sakit: ${izin + sakit} orang\n` +
      `- Tidak Hadir: ${tidakHadir} orang\n\n` +
      `Mohon kesediaan Bapak/Ibu untuk memeriksa berkas daftar hadir dan membubuhkan Tanda Tangan Elektronik resmi melalui tautan di bawah ini:\n` +
      `👉 *Buka Lembar Pengesahan:*\n${url}\n\n` +
      `_Pesan otomatis dikirim melalui Sistem Presensi Resmi dePresent._`;

    if (targetPhone) {
      try {
        const res = await invokeWahaNotification({
          action: 'invitation_dispatch',
          recipient: targetPhone,
          message: textMsg,
          metadata: {
            meetingId: currentMeeting.id,
            role,
            type: 'signature_request',
          },
        });
        if (res.success) {
          setSignatureFeedback(`Permohonan TTD via WhatsApp berhasil dikirim ke ${targetName} (${targetPhone})!`);
          setTimeout(() => setSignatureFeedback(null), 4000);
          return;
        }
      } catch (e) {
        console.warn('Waha notification failed, opening wa.me fallback:', e);
      }
    }

    const cleanPhone = (targetPhone || '').replace(/\D/g, '');
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(textMsg)}`
      : `https://wa.me/?text=${encodeURIComponent(textMsg)}`;
    window.open(waUrl, '_blank');
    setSignatureFeedback(`Membuka WhatsApp untuk mengirim permohonan TTD ke ${targetName}.`);
    setTimeout(() => setSignatureFeedback(null), 4000);
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };


  // Export to Excel XLSX using SheetJS
  const handleExportXLSX = () => {
    if (!currentMeeting) return;

    // 1. Sheet Rekap
    const rekapData = [
      ['DAFTAR HADIR PESERTA KEGIATAN'],
      [schoolProfile.foundation_name || 'YAYASAN PENDIDIKAN HARAPAN BANGSA'],
      [schoolProfile.school_name || 'SMP HARAPAN BANGSA'],
      ['NPSN: ' + (schoolProfile.npsn || '-'), 'Alamat: ' + (schoolProfile.address || '-')],
      [],
      ['INFORMASI AGENDA RAPAT'],
      ['Nama Agenda:', currentMeeting.title],
      ['Kategori:', currentMeeting.category],
      ['Hari / Tanggal:', currentMeeting.meeting_date],
      ['Waktu Pelaksanaan:', `${currentMeeting.start_time} - ${currentMeeting.end_time} WIB`],
      ['Tempat / Ruang:', currentMeeting.room],
      ['Pimpinan Rapat:', currentMeeting.leader_name + (currentMeeting.leader_niy ? ` (NIY. ${currentMeeting.leader_niy})` : '')],
      ['Notulis Rapat:', (currentMeeting.secretary_name || '-') + (currentMeeting.secretary_niy ? ` (NIY. ${currentMeeting.secretary_niy})` : '')],
      [],
      ['RINGKASAN KEHADIRAN'],
      ['Total Pegawai Terdaftar:', total],
      ['Hadir Tepat Waktu:', hadir],
      ['Hadir Terlambat:', terlambat],
      ['Izin Dinas:', izin],
      ['Sakit:', sakit],
      ['Tidak Hadir:', tidakHadir],
      ['Persentase Kehadiran:', `${rate}%`],
      [],
      ['Mengetahui,', 'Pimpinan Rapat,', 'Notulis Rapat,'],
      ['Kepala Sekolah,', '', ''],
      [],
      [],
      [
        schoolProfile.headmaster_name,
        currentMeeting.leader_name,
        currentMeeting.secretary_name || '-',
      ],
      [
        'NIY. ' + (schoolProfile.headmaster_niy || '-'),
        'NIY. ' + (currentMeeting.leader_niy || '-'),
        'NIY. ' + (currentMeeting.secretary_niy || '-'),
      ],
    ];

    // 2. Sheet Rincian Peserta (Kolom Nama Pegawai satukan Nama & NIY)
    const detailHeaders = [
      'No',
      'Nama Pegawai',
      'Jabatan / Mata Pelajaran',
      'Pangkat / Status',
      'Status Kehadiran',
      'Jam Hadir',
      'Verifikasi',
      'Catatan / Keterangan',
    ];

    const detailRows = activeTeachers.map((t, idx) => {
      const att = attendanceMap.get(t.id);
      const isPresent = att && (att.status === 'hadir' || att.status === 'terlambat');
      const statusText = att
        ? att.status === 'alpa'
          ? 'TIDAK HADIR'
          : att.status.toUpperCase()
        : currentMeeting.status === 'completed'
        ? 'TIDAK HADIR'
        : 'BELUM HADIR';

      return [
        idx + 1,
        `${t.name} (NIY: ${t.niy || t.nip || '-'})`,
        t.role_title,
        t.rank_group,
        statusText,
        att ? new Date(att.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-',
        isPresent ? 'Verified' : '-',
        att?.notes || '-',
      ];
    });

    const detailSheetData = [detailHeaders, ...detailRows];

    // Build workbook
    const wb = XLSX.utils.book_new();
    const wsRekap = XLSX.utils.aoa_to_sheet(rekapData);
    const wsDetail = XLSX.utils.aoa_to_sheet(detailSheetData);

    XLSX.utils.book_append_sheet(wb, wsRekap, 'Ringkasan Rapat');
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Daftar Hadir Rinci');

    const cleanTitle = currentMeeting.title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Presensi_${cleanTitle}_${currentMeeting.meeting_date}.xlsx`;

    XLSX.writeFile(wb, filename);

    setExportSuccess(`File Excel "${filename}" berhasil diunduh!`);
    setTimeout(() => setExportSuccess(null), 4000);
  };

  const handleToggleLock = async () => {
    if (!currentMeeting) return;
    const nextLocked = !currentMeeting.is_locked;
    if (nextLocked) {
      if (
        !window.confirm(
          `Kunci agenda rapat "${currentMeeting.title}"?\n\nSetelah dikunci, seluruh hasil pengesahan dan presensi berstatus resmi terkunci (data kehadiran dilindungi dari perubahan).`
        )
      ) {
        return;
      }
    } else {
      if (
        !window.confirm(
          `Buka kunci agenda rapat "${currentMeeting.title}"?\n\nPeringatan: Membuka kunci rapat memungkinkan perubahan data pada dokumen yang telah disahkan.`
        )
      ) {
        return;
      }
    }
    await toggleLockMeeting(currentMeeting.id, nextLocked);
    currentMeeting.is_locked = nextLocked;
    setSignatureFeedback(
      nextLocked
        ? `Rapat "${currentMeeting.title}" berhasil dikunci resmi (Status Disahkan & Dilindungi).`
        : `Kunci rapat "${currentMeeting.title}" berhasil dibuka.`
    );
    setTimeout(() => setSignatureFeedback(null), 4000);
    loadSignatures();
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="bg-white dark:bg-[#072b2f] p-5 rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Laporan Resmi & Berkas Presensi Kedinasan</h2>
            {currentMeeting?.is_locked && (
              <span className="text-[10px] font-bold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>Terkunci Resmi</span>
              </span>
            )}
            {isCustomMeeting && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 dark:bg-[#031e21] text-teal-900 dark:text-teal-200 border border-teal-200 dark:border-teal-800">
                Rapat Khusus ({total} Peserta)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-teal-200/80 mt-0.5">
            Format resmi ber-Kop Surat Yayasan, daftar hadir ber-NIY, tanda tangan pimpinan rapat & notulis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Select Meeting */}
          <select
            value={selectedMeetingId}
            onChange={(e) => setSelectedMeetingId(e.target.value)}
            className="text-xs font-semibold border border-slate-300 dark:border-[#0f4950] rounded-lg px-3 py-2 bg-slate-50 dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden w-full sm:w-auto sm:max-w-xs truncate min-w-0"
          >
            {meetings.map((m) => (
              <option key={m.id} value={m.id} className="bg-white dark:bg-[#072b2f] text-slate-900 dark:text-white">
                {m.title} ({m.meeting_date}){m.is_locked ? ' 🔒' : ''}{m.target_type === 'custom' ? ' [Khusus]' : ''}
              </option>
            ))}
          </select>

          {/* Lock / Unlock Meeting Button */}
          <button
            onClick={handleToggleLock}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
              currentMeeting?.is_locked
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
            title={currentMeeting?.is_locked ? 'Buka Kunci Rapat' : 'Kunci Dokumen & Rapat Ini'}
          >
            {currentMeeting?.is_locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>{currentMeeting?.is_locked ? 'Buka Kunci' : 'Kunci Rapat'}</span>
          </button>

          {/* Kirim Rekap Tidak Hadir ke WA Grup Button */}
          <button
            onClick={() => setIsAbsentModalOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Ekspor infografis gambar & kirim daftar pegawai tidak hadir ke grup WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Kirim Rekap Tidak Hadir ke Grup WA</span>
          </button>

          {/* Export XLSX Button */}
          <button
            onClick={handleExportXLSX}
            className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Ekspor File Excel (.xlsx)</span>
          </button>

          {/* Print PDF Button */}
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-teal-800 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Dokumen Resmi (PDF)</span>
          </button>
        </div>
      </div>

      {/* Warning / Status Banner for Locked Meeting */}
      {currentMeeting?.is_locked && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 rounded-lg text-xs font-semibold flex items-center justify-between gap-2 no-print shadow-xs">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              Agenda rapat ini telah <strong>Disahkan & Terkunci Resmi</strong>. Data presensi dan penandatanganan dilindungi demi integritas hukum dokumen.
            </span>
          </div>
          <button
            onClick={handleToggleLock}
            className="text-[11px] underline font-bold hover:text-amber-950 dark:hover:text-amber-100 cursor-pointer shrink-0"
          >
            Buka Kunci
          </button>
        </div>
      )}

      {exportSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-lg text-xs font-medium flex items-center gap-2 no-print">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{exportSuccess}</span>
        </div>
      )}

      {signatureFeedback && (
        <div className="p-3 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200 rounded-lg text-xs font-medium flex items-center gap-2 no-print shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <span>{signatureFeedback}</span>
        </div>
      )}

      {/* PANEL KONTROL ALUR TANDA TANGAN DIGITAL BERJENJANG (WHATSAPP & SUPABASE DB) */}
      <div className="bg-white dark:bg-[#072b2f] p-5 rounded-xl border border-slate-300 dark:border-[#0f4950] shadow-xs no-print space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-[#0f4950] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/30">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Alur Persetujuan & Tanda Tangan Digital (WhatsApp)
                {isHeadmasterSigned ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    Lengkap (3/3 Sah)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                    Progres: {(isSecretarySigned ? 1 : 0) + (isLeaderSigned ? 1 : 0)} / 3 Tahap
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-600 dark:text-teal-200/90 font-medium">
                Alur berjenjang: Notulis memverifikasi presensi ➔ Pimpinan menyetujui jalannya rapat ➔ Kepala Sekolah mengesahkan dokumen dengan QR Code verifikasi otentik.
              </p>
            </div>
          </div>

          <div className="text-[11px] text-slate-600 dark:text-teal-300 bg-slate-100 dark:bg-[#031e21] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-[#0f4950] shrink-0 font-medium">
            Penyimpanan: <span className="font-bold text-teal-800 dark:text-teal-300">Supabase DB</span>
          </div>
        </div>

        {/* 3 Sequential Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* TAHAP 1: NOTULIS RAPAT */}
          <div className={`p-4 rounded-xl border transition-all ${
            isSecretarySigned
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
              : 'bg-slate-50 dark:bg-[#031e21] border-slate-300 dark:border-[#0f4950]'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 dark:bg-[#0f4950] text-slate-800 dark:text-teal-100">
                Tahap 1 • Validasi
              </span>
              {isSecretarySigned ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Disahkan
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-400">
                  <Clock className="w-3.5 h-3.5" /> Menunggu TTD
                </span>
              )}
            </div>

            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              Notulis Rapat
            </h4>
            <p className="text-xs font-bold text-teal-800 dark:text-teal-300 truncate">
              {currentMeeting?.secretary_name || 'Belum Ditentukan'}
            </p>
            <p className="text-[10px] text-slate-600 dark:text-teal-300/80 font-mono mb-3">
              {currentMeeting?.secretary_niy ? `NIY. ${currentMeeting.secretary_niy}` : 'NIY: -'}
            </p>

            {isSecretarySigned ? (
              <div className="text-[10px] bg-white dark:bg-[#072b2f] p-2 rounded-lg border border-emerald-300 dark:border-emerald-800 space-y-0.5 mb-2">
                <div className="font-mono text-emerald-900 dark:text-emerald-300 font-bold truncate">
                  {secretarySig?.verification_code}
                </div>
                <div className="text-slate-600 dark:text-teal-300/80 font-medium">
                  Disahkan pukul {secretarySig?.signed_at ? new Date(secretarySig.signed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'} WIB
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-slate-600 dark:text-teal-300/70 mb-2">
                Tanda tangan QR verifikasi notula & daftar hadir.
              </div>
            )}

            <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-[#0f4950]">
              <button
                type="button"
                onClick={() => handleSendSignWa('secretary', 'Notulis Rapat', currentMeeting?.secretary_name || 'Notulis', secretaryPhone)}
                className="flex-1 py-1.5 px-2 bg-teal-700 hover:bg-teal-600 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                title="Kirim tautan persetujuan TTD ke WhatsApp Notulis"
              >
                <Send className="w-3 h-3" />
                <span>Kirim WA</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopySignUrl('secretary', 'Notulis')}
                className="p-1.5 bg-white dark:bg-[#072b2f] hover:bg-slate-100 dark:hover:bg-[#0b383d] text-slate-800 dark:text-teal-100 border border-slate-300 dark:border-[#0f4950] rounded-lg text-[11px] cursor-pointer"
                title="Salin tautan TTD Notulis"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>

              <a
                href={getSignUrl('secretary')}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 bg-white dark:bg-[#072b2f] hover:bg-slate-100 dark:hover:bg-[#0b383d] text-slate-800 dark:text-teal-100 border border-slate-300 dark:border-[#0f4950] rounded-lg text-[11px] flex items-center justify-center cursor-pointer"
                title="Buka form TTD Notulis"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* TAHAP 2: PIMPINAN RAPAT */}
          <div className={`p-4 rounded-xl border transition-all ${
            isLeaderSigned
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
              : !isSecretarySigned
              ? 'bg-slate-100 dark:bg-[#031e21]/50 border-slate-200 dark:border-[#0f4950]/60 opacity-80'
              : 'bg-slate-50 dark:bg-[#031e21] border-slate-300 dark:border-[#0f4950]'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 dark:bg-[#0f4950] text-slate-800 dark:text-teal-100">
                Tahap 2 • Persetujuan
              </span>
              {isLeaderSigned ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Disahkan
                </span>
              ) : !isSecretarySigned ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-teal-300/80">
                  <Lock className="w-3.5 h-3.5" /> Menunggu Notulis
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-400">
                  <Clock className="w-3.5 h-3.5" /> Siap Ditandatangani
                </span>
              )}
            </div>

            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              Pimpinan Rapat
            </h4>
            <p className="text-xs font-bold text-teal-800 dark:text-teal-300 truncate">
              {currentMeeting?.leader_name || 'Belum Ditentukan'}
            </p>
            <p className="text-[10px] text-slate-600 dark:text-teal-300/80 font-mono mb-3">
              {currentMeeting?.leader_niy ? `NIY. ${currentMeeting.leader_niy}` : 'NIY: -'}
            </p>

            {isLeaderSigned ? (
              <div className="text-[10px] bg-white dark:bg-[#072b2f] p-2 rounded-lg border border-emerald-300 dark:border-emerald-800 space-y-0.5 mb-2">
                <div className="font-mono text-emerald-900 dark:text-emerald-300 font-bold truncate">
                  {leaderSig?.verification_code}
                </div>
                <div className="text-slate-600 dark:text-teal-300/80 font-medium">
                  Disahkan pukul {leaderSig?.signed_at ? new Date(leaderSig.signed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'} WIB
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-slate-600 dark:text-teal-300/70 mb-2">
                {!isSecretarySigned
                  ? 'Alur berjenjang: Notulis harus TTD terlebih dahulu.'
                  : 'Siap ditandatangani oleh pimpinan rapat (QR Code).'}
              </div>
            )}

            <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-[#0f4950]">
              <button
                type="button"
                onClick={() => handleSendSignWa('leader', 'Pimpinan Rapat', currentMeeting?.leader_name || 'Pimpinan', leaderPhone)}
                className="flex-1 py-1.5 px-2 bg-teal-700 hover:bg-teal-600 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                title="Kirim tautan persetujuan TTD ke WhatsApp Pimpinan Rapat"
              >
                <Send className="w-3 h-3" />
                <span>Kirim WA</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopySignUrl('leader', 'Pimpinan Rapat')}
                className="p-1.5 bg-white dark:bg-[#072b2f] hover:bg-slate-100 dark:hover:bg-[#0b383d] text-slate-800 dark:text-teal-100 border border-slate-300 dark:border-[#0f4950] rounded-lg text-[11px] cursor-pointer"
                title="Salin tautan TTD Pimpinan"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>

              <a
                href={getSignUrl('leader')}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 bg-white dark:bg-[#072b2f] hover:bg-slate-100 dark:hover:bg-[#0b383d] text-slate-800 dark:text-teal-100 border border-slate-300 dark:border-[#0f4950] rounded-lg text-[11px] flex items-center justify-center cursor-pointer"
                title="Buka form TTD Pimpinan"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* TAHAP 3: KEPALA SEKOLAH */}
          <div className={`p-4 rounded-xl border transition-all ${
            isHeadmasterSigned
              ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800'
              : !isLeaderSigned
              ? 'bg-slate-100 dark:bg-[#031e21]/50 border-slate-200 dark:border-[#0f4950]/60 opacity-80'
              : 'bg-slate-50 dark:bg-[#031e21] border-slate-300 dark:border-[#0f4950]'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-200 border border-blue-300 dark:border-blue-800">
                Tahap 3 • Pengesahan & QR Code
              </span>
              {isHeadmasterSigned ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-900 dark:text-blue-300">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Sah & Terverifikasi
                </span>
              ) : !isLeaderSigned ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-teal-300/80">
                  <Lock className="w-3.5 h-3.5" /> Menunggu Pimpinan
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-400">
                  <Clock className="w-3.5 h-3.5" /> Siap Disahkan
                </span>
              )}
            </div>

            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              Kepala Sekolah
            </h4>
            <p className="text-xs font-bold text-teal-800 dark:text-teal-300 truncate">
              {schoolProfile.headmaster_name || 'Kepala Sekolah'}
            </p>
            <p className="text-[10px] text-slate-600 dark:text-teal-300/80 font-mono mb-3">
              {schoolProfile.headmaster_niy ? `NIY. ${schoolProfile.headmaster_niy}` : 'NIY: -'}
            </p>

            {isHeadmasterSigned ? (
              <div className="text-[10px] bg-white dark:bg-[#072b2f] p-2 rounded-lg border border-blue-300 dark:border-blue-800 space-y-0.5 mb-2">
                <div className="font-mono text-blue-950 dark:text-blue-300 font-bold truncate">
                  {headmasterSig?.verification_code}
                </div>
                <div className="text-slate-600 dark:text-teal-300/80 font-medium">
                  Disahkan pukul {headmasterSig?.signed_at ? new Date(headmasterSig.signed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'} WIB
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-slate-600 dark:text-teal-300/70 mb-2">
                {!isLeaderSigned
                  ? 'Alur berjenjang: Pimpinan Rapat harus TTD terlebih dahulu.'
                  : 'Menerbitkan QR Code Verifikasi Otentik Resmi Sekolah.'}
              </div>
            )}

            <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-[#0f4950]">
              <button
                type="button"
                onClick={() => handleSendSignWa('headmaster', 'Kepala Sekolah', schoolProfile.headmaster_name || 'Kepala Sekolah', headmasterPhone)}
                className="flex-1 py-1.5 px-2 bg-blue-800 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                title="Kirim tautan pengesahan TTD ke WhatsApp Kepala Sekolah"
              >
                <Send className="w-3 h-3" />
                <span>Kirim WA</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopySignUrl('headmaster', 'Kepala Sekolah')}
                className="p-1.5 bg-white dark:bg-[#072b2f] hover:bg-slate-100 dark:hover:bg-[#0b383d] text-slate-800 dark:text-teal-100 border border-slate-300 dark:border-[#0f4950] rounded-lg text-[11px] cursor-pointer"
                title="Salin tautan TTD Kepala Sekolah"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>

              <a
                href={getSignUrl('headmaster')}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 bg-white dark:bg-[#072b2f] hover:bg-slate-100 dark:hover:bg-[#0b383d] text-slate-800 dark:text-teal-100 border border-slate-300 dark:border-[#0f4950] rounded-lg text-[11px] flex items-center justify-center cursor-pointer"
                title="Buka form TTD Kepala Sekolah"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Official Printable Report Document */}
      <div className="bg-white text-slate-900 p-8 md:p-12 rounded-xl border border-slate-300 shadow-sm max-w-4xl mx-auto report-printable-area print:border-none print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-none">
        {/* 1. Official Foundation & School Letterhead (Kop Surat) */}
        <div className="border-b-4 border-double border-slate-900 pb-3 mb-6 text-center relative font-serif">
          {/* Logo */}
          <div className="absolute left-2 top-1 w-16 h-16 flex items-center justify-center font-bold text-xs text-blue-950 font-sans">
            {schoolProfile.logo_url ? (
              <img
                src={schoolProfile.logo_url}
                alt="Logo"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full border border-slate-300 flex items-center justify-center text-slate-400">
                LOGO
              </div>
            )}
          </div>

          <div className="px-16">
            {/* BARIS 1: NAMA YAYASAN */}
            <h2 className="text-sm md:text-base font-black uppercase tracking-wider text-blue-950 leading-tight">
              {schoolProfile.foundation_name || 'YAYASAN PENDIDIKAN HARAPAN BANGSA'}
            </h2>

            {/* BARIS 2: NAMA SEKOLAH */}
            <h1 className="text-lg md:text-xl font-black uppercase tracking-tight text-slate-900 leading-tight mt-0.5">
              {schoolProfile.school_name || 'SMP HARAPAN BANGSA'}
            </h1>

            <p className="text-[11px] text-slate-700 font-sans mt-1">
              {schoolProfile.address || 'Jl. Ki Hajar Dewantara No. 45, Kompleks Yayasan'} · NPSN: {schoolProfile.npsn || '20104567'}
            </p>
            <p className="text-[10px] text-slate-600 font-sans">
              Telepon: {schoolProfile.phone || '-'} · Email: {schoolProfile.email || '-'} · Website: {schoolProfile.website || '-'}
            </p>
          </div>
        </div>

        {/* 2. Document Title & Metadata */}
        <div className="text-center space-y-1 mb-6 font-sans">
          <h2 className="text-sm md:text-base font-black uppercase underline tracking-wider text-slate-900">
            DAFTAR HADIR PESERTA KEGIATAN
          </h2>
          <p className="text-xs font-bold text-slate-800">
            {currentMeeting?.title}
          </p>
        </div>

        {/* 3. Meeting Schedule Info Table */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 font-sans text-xs space-y-2 print:bg-white print:border-slate-400">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <span className="text-slate-600 block text-[10px] font-medium">Hari / Tanggal</span>
              <span className="font-bold text-slate-900">{currentMeeting?.meeting_date}</span>
            </div>
            <div>
              <span className="text-slate-600 block text-[10px] font-medium">Waktu</span>
              <span className="font-bold text-slate-900 font-mono">{currentMeeting?.start_time} - {currentMeeting?.end_time} WIB</span>
            </div>
            <div>
              <span className="text-slate-600 block text-[10px] font-medium">Tempat</span>
              <span className="font-bold text-slate-900">{currentMeeting?.room}</span>
            </div>
            <div>
              <span className="text-slate-600 block text-[10px] font-medium">Pimpinan Rapat</span>
              <span className="font-bold text-slate-900">{currentMeeting?.leader_name}</span>
            </div>
          </div>
        </div>

        {/* 4. Tabular Attendance Grid with NIY & Signature Columns */}
        <div className="mb-6 overflow-x-auto print:overflow-visible report-table-wrapper">
          <table className="w-full text-left border-collapse border border-slate-400 text-xs font-sans">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-400 text-slate-900 font-bold uppercase text-[10px] tracking-wider text-center">
                <th className="py-2 px-2 border-r border-slate-400 w-10">No</th>
                <th className="py-2 px-3 border-r border-slate-400 text-left">Nama Pegawai</th>
                <th className="py-2 px-3 border-r border-slate-400 text-left">Jabatan</th>
                <th className="py-2 px-2 border-r border-slate-400 w-24">Jam Hadir</th>
                <th className="py-2 px-2 border-r border-slate-400 w-24">Status</th>
                <th className="py-2 px-3 border-slate-400 w-28 text-center">Verifikasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {activeTeachers.map((t, index) => {
                const att = attendanceMap.get(t.id);
                const isPresent = att && (att.status === 'hadir' || att.status === 'terlambat');
                const isAbsent = (att && att.status === 'alpa') || (!att && currentMeeting?.status === 'completed');

                return (
                  <tr key={t.id} className="hover:bg-slate-50/50 print:hover:bg-white page-break-inside-avoid">
                    {/* Explicit high-contrast text-slate-900 so number is clearly visible in both light & dark mode */}
                    <td className="py-2 px-2 text-center border-r border-slate-300 font-mono font-bold text-slate-900 tabular-nums">
                      {index + 1}
                    </td>

                    {/* Nama Pegawai (Nama & NIY digabung) */}
                    <td className="py-2 px-3 border-r border-slate-300">
                      <div className="font-bold text-slate-900 leading-tight">{t.name}</div>
                      <div className="text-[10px] text-slate-600 font-mono">NIY: {t.niy || t.nip || '-'}</div>
                    </td>

                    <td className="py-2 px-3 border-r border-slate-300 text-slate-800 text-[11px]">
                      <div className="font-semibold text-slate-900">{t.role_title}</div>
                      <div className="text-[10px] text-slate-600">{t.rank_group}</div>
                    </td>

                    {/* Explicit high-contrast text-slate-900 so check-in time is clearly visible in both light & dark mode */}
                    <td className="py-2 px-2 border-r border-slate-300 text-center font-mono font-bold text-slate-900 text-[11px] tabular-nums">
                      {att ? (
                        <span>{new Date(att.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>

                    <td className="py-2 px-2 border-r border-slate-300 text-center text-[10px] font-bold">
                      {att ? (
                        <span
                          className={
                            att.status === 'hadir'
                              ? 'text-emerald-800'
                              : att.status === 'terlambat'
                              ? 'text-amber-800'
                              : att.status === 'alpa'
                              ? 'text-red-700'
                              : 'text-blue-800'
                          }
                        >
                          {att.status === 'alpa' ? 'TIDAK HADIR' : att.status.toUpperCase()}
                        </span>
                      ) : isAbsent ? (
                        <span className="text-red-700 font-bold">TIDAK HADIR</span>
                      ) : (
                        <span className="text-slate-400 font-normal">BELUM HADIR</span>
                      )}
                    </td>

                    {/* Verification Column: Verified if present, - if not present */}
                    <td className="py-1 px-3 border-slate-300 text-xs text-center">
                      {isPresent ? (
                        <div className="flex items-center justify-center gap-1.5 text-emerald-800 text-[10px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-mono font-bold">Verified</span>
                        </div>
                      ) : (
                        <span className="font-mono text-slate-400 font-bold text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 5. Attendance Recapitulation Box */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-300 mb-8 font-sans text-xs print:bg-white print:border-slate-400 recap-box page-break-inside-avoid break-inside-avoid">
          <h4 className="font-bold text-slate-900 mb-2 uppercase text-[11px] tracking-wide">
            Rekapitulasi Kehadiran Peserta:
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-slate-800 font-medium">
            <div>
              Total Pegawai: <strong className="font-mono text-slate-900">{total}</strong> orang
            </div>
            <div>
              Hadir Tepat: <strong className="font-mono text-emerald-800 font-bold">{hadir}</strong> orang
            </div>
            <div>
              Terlambat: <strong className="font-mono text-amber-800 font-bold">{terlambat}</strong> orang
            </div>
            <div>
              Izin / Sakit: <strong className="font-mono text-blue-800 font-bold">{izin + sakit}</strong> orang
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>Tidak Hadir: <strong className="font-mono text-red-700 font-bold">{tidakHadir}</strong> orang</span>
              {tidakHadir > 0 && (
                <button
                  type="button"
                  onClick={() => setIsAbsentModalOpen(true)}
                  className="no-print text-[10px] text-rose-700 font-bold underline hover:text-rose-900 cursor-pointer"
                  title="Kirim daftar pegawai tidak hadir ke grup WhatsApp"
                >
                  (Kirim ke Grup WA)
                </button>
              )}
            </div>
            <div>
              Persentase: <strong className="font-mono text-slate-900 font-bold">{rate}%</strong>
            </div>
          </div>
        </div>

        {/* 6. Formal Closing Signatures with Digital Signatures (QR Code Verifikasi Resmi) */}
        <div className="pt-6 w-full signature-block page-break-inside-avoid break-inside-avoid">
          <table className="w-full text-center text-xs font-sans border-none signature-table">
            <tbody>
              <tr>
                {/* Kepala Sekolah (QR Code Verifikasi Resmi) */}
                <td className="w-1/3 align-top px-2">
                  <p className="text-slate-700 font-semibold mb-1">Mengetahui,</p>
                  <DigitalSignatureBadge
                    signature={headmasterSig}
                    role="headmaster"
                    roleTitle="Kepala Sekolah"
                    signerName={schoolProfile.headmaster_name || 'Kepala Sekolah'}
                    signerNiy={schoolProfile.headmaster_niy}
                    schoolProfile={schoolProfile}
                    isPrintView={true}
                  />
                </td>

                {/* Pimpinan Rapat (QR Code Only) */}
                <td className="w-1/3 align-top px-2">
                  <p className="text-slate-700 font-semibold mb-1">&nbsp;</p>
                  <DigitalSignatureBadge
                    signature={leaderSig}
                    role="leader"
                    roleTitle="Pimpinan Rapat"
                    signerName={currentMeeting?.leader_name || 'Pimpinan Rapat'}
                    signerNiy={currentMeeting?.leader_niy}
                    schoolProfile={schoolProfile}
                    isPrintView={true}
                  />
                </td>

                {/* Notulis Rapat (QR Code Only) */}
                <td className="w-1/3 align-top px-2">
                  <p className="text-slate-700 font-semibold mb-1">
                    {schoolProfile.city || 'Kota'}, {currentMeeting?.meeting_date ? new Date(currentMeeting.meeting_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('id-ID')}
                  </p>
                  <DigitalSignatureBadge
                    signature={secretarySig}
                    role="secretary"
                    roleTitle="Notulis Rapat"
                    signerName={currentMeeting?.secretary_name || 'Notulis Rapat'}
                    signerNiy={currentMeeting?.secretary_niy}
                    schoolProfile={schoolProfile}
                    isPrintView={true}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Official Document Print Footer */}
        <div className="mt-8 pt-3 border-t-2 border-slate-400 text-[9px] text-slate-800 flex justify-between items-center print-doc-footer page-break-inside-avoid break-inside-avoid">
          <div className="space-y-0.5">
            <div className="font-bold uppercase tracking-wider text-slate-900">
              dePresent — Sistem Manajemen Presensi & Berita Acara Rapat Kedinasan
            </div>
            <div className="text-[8px] text-slate-600">
              {schoolProfile.school_name || 'SMP Muhammadiyah 1 Gombong'} • NPSN: {schoolProfile.npsn || '-'} • Dokumen Terverifikasi Sah
            </div>
          </div>
          <div className="text-right space-y-0.5">
            <div>
              Waktu Cetak: <span className="font-mono font-bold text-slate-900">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} pukul {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB</span>
            </div>
            <div className="text-[8px] font-mono text-slate-600">
              Kode Dokumen: DEP-SPJ-{currentMeeting?.id?.slice(0, 8)?.toUpperCase()} • Dicetak Asli
            </div>
          </div>
        </div>
      </div>

      {/* MODAL KIRIM DAFTAR PEGAWAI TIDAK HADIR KE GRUP WA (INFOGRAFIS GAMBAR + TEKS REKAP) */}
      {currentMeeting && (
        <AbsentTeachersModal
          isOpen={isAbsentModalOpen}
          onClose={() => setIsAbsentModalOpen(false)}
          currentMeeting={currentMeeting}
          teachers={activeTeachers}
          attendances={meetingAttendances}
          schoolProfile={schoolProfile}
        />
      )}
    </div>
  );
};
