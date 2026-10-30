import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  MapPin,
  User,
  School,
  Copy,
  Check,
  Printer,
  ArrowLeft,
  XCircle,
  FileCheck,
  Sun,
  Moon,
  ExternalLink,
} from 'lucide-react';
import {
  Attendance,
  DocumentSignature,
  Meeting,
  SchoolProfile,
  Teacher,
} from '../types';
import { fetchDocumentSignatures, getCachedDocumentSignatures } from '../lib/storage';
import { sortTeachersStructuralFirst } from '../lib/teacherGroups';

interface SignatureVerificationViewProps {
  verificationCode: string;
  meetingId?: string;
  meetings: Meeting[];
  teachers: Teacher[];
  attendances: Attendance[];
  schoolProfile: SchoolProfile;
  onDone?: () => void;
}

export const SignatureVerificationView: React.FC<SignatureVerificationViewProps> = ({
  verificationCode,
  meetingId,
  meetings,
  teachers,
  attendances,
  schoolProfile,
  onDone,
}) => {
  const [signatures, setSignatures] = useState<DocumentSignature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Theme toggle for verification view
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('smp_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (typeof document !== 'undefined') {
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('smp_theme', next);
    }
  };

  // Find target meeting
  const resolvedMeeting = useMemo(() => {
    if (meetingId) {
      const found = meetings.find((m) => m.id === meetingId);
      if (found) return found;
    }
    // Search in cached signatures if meetingId is not in param
    const allCached = getCachedDocumentSignatures();
    const match = allCached.find(
      (s) => s.verification_code?.toLowerCase() === verificationCode.toLowerCase()
    );
    if (match) {
      const found = meetings.find((m) => m.id === match.meeting_id);
      if (found) return found;
    }
    return meetings[0];
  }, [meetings, meetingId, verificationCode]);

  // Load signatures
  useEffect(() => {
    let isMounted = true;
    const targetMeetingId = resolvedMeeting?.id || meetingId;

    if (targetMeetingId) {
      setIsLoading(true);
      fetchDocumentSignatures(targetMeetingId)
        .then((data) => {
          if (isMounted) {
            setSignatures(data);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          console.warn('Error fetching signatures for verification:', err);
          if (isMounted) setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [resolvedMeeting?.id, meetingId]);

  // Target signature verified
  const verifiedSignature = useMemo(() => {
    return signatures.find(
      (s) => s.verification_code?.toLowerCase() === verificationCode.toLowerCase()
    ) || signatures.find((s) => s.status === 'signed');
  }, [signatures, verificationCode]);

  const isOfficiallySigned = verifiedSignature && verifiedSignature.status === 'signed';

  // Active Teachers for this meeting
  const isCustomMeeting =
    resolvedMeeting &&
    resolvedMeeting.target_type === 'custom' &&
    Array.isArray(resolvedMeeting.invited_teacher_ids) &&
    resolvedMeeting.invited_teacher_ids.length > 0;

  const activeTeachers = useMemo(() => {
    return sortTeachersStructuralFirst(
      teachers
        .filter((t) => t.is_active)
        .filter((t) => !isCustomMeeting || resolvedMeeting?.invited_teacher_ids?.includes(t.id))
    );
  }, [teachers, resolvedMeeting, isCustomMeeting]);

  const meetingAttendances = useMemo(() => {
    if (!resolvedMeeting) return [];
    return attendances.filter((a) => a.meeting_id === resolvedMeeting.id);
  }, [attendances, resolvedMeeting]);

  const attendanceMap = useMemo(() => {
    const map = new Map<string, Attendance>();
    meetingAttendances.forEach((a) => map.set(a.teacher_id, a));
    return map;
  }, [meetingAttendances]);

  const total = activeTeachers.length;
  const hadir = meetingAttendances.filter((a) => a.status === 'hadir').length;
  const terlambat = meetingAttendances.filter((a) => a.status === 'terlambat').length;
  const izin = meetingAttendances.filter((a) => a.status === 'izin').length;
  const sakit = meetingAttendances.filter((a) => a.status === 'sakit').length;
  const tidakHadir = Math.max(0, total - (hadir + terlambat + izin + sakit));
  const rate = total > 0 ? Math.round(((hadir + terlambat) / total) * 100) : 0;

  // Filter absent teachers
  const absentTeachers = useMemo(() => {
    const list: { teacher: Teacher; notes: string }[] = [];
    activeTeachers.forEach((t) => {
      const att = attendanceMap.get(t.id);
      if (att) {
        if (att.status === 'alpa') {
          list.push({ teacher: t, notes: att.notes || 'Tanpa Keterangan (Alpa)' });
        }
      } else {
        list.push({
          teacher: t,
          notes: resolvedMeeting?.status === 'completed' ? 'Tidak Hadir hingga Rapat Ditutup' : 'Belum Presensi',
        });
      }
    });
    return list;
  }, [activeTeachers, attendanceMap, resolvedMeeting]);

  const handleCopyCode = () => {
    if (verifiedSignature?.verification_code || verificationCode) {
      navigator.clipboard.writeText(verifiedSignature?.verification_code || verificationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const roleName = (role: string) => {
    if (role === 'headmaster') return 'Kepala Sekolah';
    if (role === 'leader') return 'Pimpinan Rapat';
    if (role === 'secretary') return 'Notulis Rapat';
    if (role === 'expedition_officer') return 'Petugas Ekspedisi / TU';
    return role;
  };

  const formattedDate = resolvedMeeting?.meeting_date
    ? new Date(resolvedMeeting.meeting_date).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '-';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#031e21] text-slate-800 dark:text-teal-50 selection:bg-teal-600 selection:text-white transition-colors duration-150 py-6 px-3 sm:px-6 md:px-8">
      {/* Top Navbar */}
      <header className="max-w-3xl mx-auto flex items-center justify-between gap-3 mb-6 no-print">
        <button
          type="button"
          onClick={onDone || (() => (window.location.href = window.location.pathname))}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#072b2f] text-slate-700 dark:text-teal-200 border border-slate-300 dark:border-[#0f4950] hover:bg-slate-100 dark:hover:bg-[#0b383d] shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-white dark:bg-[#072b2f] text-slate-700 dark:text-teal-200 border border-slate-300 dark:border-[#0f4950] hover:bg-slate-100 dark:hover:bg-[#0b383d] shadow-2xs transition-colors cursor-pointer"
            title="Ganti Tema (Light / Dark Mode)"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-700 hover:bg-teal-600 text-white shadow-2xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Bukti</span>
          </button>
        </div>
      </header>

      {/* Main Verification Card */}
      <main className="max-w-3xl mx-auto space-y-5">
        {/* School Branding Header */}
        <div className="bg-white dark:bg-[#072b2f] p-5 rounded-2xl border border-slate-200 dark:border-[#0f4950] shadow-sm text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-indigo-600" />
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 dark:bg-[#0b383d] text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-700/60 text-[11px] font-bold uppercase tracking-wider mb-2">
            <School className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Portal Verifikasi Keaslian Dokumen Resmi</span>
          </div>

          <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {schoolProfile.school_name || 'SMP MUHAMMADIYAH 1 GOMBONG'}
          </h1>
          {schoolProfile.foundation_name && (
            <p className="text-xs font-semibold text-slate-600 dark:text-teal-200/80 mt-0.5 uppercase tracking-wide">
              {schoolProfile.foundation_name}
            </p>
          )}
          <p className="text-[11px] text-slate-500 dark:text-teal-300/70 mt-1 max-w-lg mx-auto">
            {schoolProfile.address || 'Gombong, Kebumen, Jawa Tengah'} • NPSN: {schoolProfile.npsn || '-'}
          </p>
        </div>

        {/* Verification Status Banner */}
        {isLoading ? (
          <div className="bg-white dark:bg-[#072b2f] p-8 rounded-2xl border border-slate-200 dark:border-[#0f4950] shadow-sm text-center space-y-3">
            <div className="w-10 h-10 border-3 border-teal-600/30 border-t-teal-600 rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-700 dark:text-teal-200">
              Memverifikasi kode sertifikasi dokumen elektronik...
            </p>
          </div>
        ) : isOfficiallySigned ? (
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50 dark:from-[#06383a] dark:via-[#072b2f] dark:to-[#042528] p-5 sm:p-6 rounded-2xl border-2 border-emerald-500/80 shadow-md space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0 shadow-xs">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-200/80 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-700 mb-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                  <span>Sah & Terverifikasi Resmi</span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                  Tanda Tangan Elektronik Otentik & Bersertifikasi
                </h2>
                <p className="text-xs text-slate-600 dark:text-teal-200/90 mt-1 leading-relaxed">
                  Dokumen ini telah disetujui dan disahkan secara elektronik melalui sistem dePresent sesuai dengan standar integritas dokumen digital.
                </p>
              </div>
            </div>

            {/* Verification Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="bg-white dark:bg-[#031e21] p-3 rounded-xl border border-emerald-200 dark:border-[#0f4950] space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-teal-400 block">
                  Kode Verifikasi Unik:
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-black text-sm text-emerald-800 dark:text-emerald-300 tracking-wide select-all">
                    {verifiedSignature?.verification_code}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="p-1 rounded-md text-slate-500 dark:text-teal-300 hover:bg-slate-100 dark:hover:bg-[#0b383d] transition-colors cursor-pointer"
                    title="Salin kode"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-[#031e21] p-3 rounded-xl border border-emerald-200 dark:border-[#0f4950] space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-teal-400 block">
                  Waktu Pengesahan (Resmi):
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white block">
                  {verifiedSignature?.signed_at ? (
                    <>
                      {new Date(verifiedSignature.signed_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}{' '}
                      pukul{' '}
                      {new Date(verifiedSignature.signed_at).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}{' '}
                      WIB
                    </>
                  ) : (
                    '-'
                  )}
                </span>
              </div>

              <div className="bg-white dark:bg-[#031e21] p-3 rounded-xl border border-emerald-200 dark:border-[#0f4950] space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-teal-400 block">
                  Penandatangan:
                </span>
                <span className="font-bold text-slate-900 dark:text-white block text-sm">
                  {verifiedSignature?.signer_name}
                </span>
                <span className="text-[11px] font-mono text-slate-600 dark:text-teal-300 block">
                  NIY: {verifiedSignature?.signer_niy || '-'}
                </span>
              </div>

              <div className="bg-white dark:bg-[#031e21] p-3 rounded-xl border border-emerald-200 dark:border-[#0f4950] space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-teal-400 block">
                  Jabatan / Peran Pengesah:
                </span>
                <span className="font-bold text-teal-800 dark:text-teal-300 block text-sm">
                  {roleName(verifiedSignature?.signer_role || '')}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-teal-400 block">
                  {verifiedSignature?.document_type === 'attendance_report'
                    ? 'Laporan Daftar Hadir Rapat'
                    : 'Buku Ekspedisi Undangan'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 dark:bg-amber-950/40 p-5 rounded-2xl border-2 border-amber-400 dark:border-amber-700 shadow-sm text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400 mx-auto" />
            <h2 className="text-base font-bold text-amber-900 dark:text-amber-200">
              Dokumen / Pengesahan Belum Selesai Ditandatangani
            </h2>
            <p className="text-xs text-amber-800 dark:text-amber-300/90 max-w-md mx-auto">
              Kode verifikasi <span className="font-mono font-bold font-semibold underline">{verificationCode || '-'}</span> terdaftar dalam sistem, namun belum memperoleh tanda tangan digital lengkap.
            </p>
          </div>
        )}

        {/* Agenda Information Card */}
        {resolvedMeeting && (
          <section aria-labelledby="agenda-heading" className="bg-white dark:bg-[#072b2f] p-5 rounded-2xl border border-slate-200 dark:border-[#0f4950] shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-[#0f4950] pb-2.5">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h3 id="agenda-heading" className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                  Informasi Agenda Rapat Kedinasan
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#031e21] text-slate-700 dark:text-teal-200 border border-slate-300 dark:border-[#0f4950]">
                {resolvedMeeting.category || 'Rapat Dinas'}
              </span>
            </div>

            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                {resolvedMeeting.title}
              </h2>
              {resolvedMeeting.letter_number && resolvedMeeting.letter_number !== '-' && (
                <p className="text-xs font-mono font-bold text-teal-700 dark:text-teal-300 mt-1">
                  Nomor Surat: {resolvedMeeting.letter_number}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-700 dark:text-teal-200">
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#031e21] p-2.5 rounded-xl border border-slate-200 dark:border-[#0f4950]">
                <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{formattedDate}</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#031e21] p-2.5 rounded-xl border border-slate-200 dark:border-[#0f4950]">
                <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>
                  {resolvedMeeting.start_time.slice(0, 5)} - {resolvedMeeting.end_time.slice(0, 5)} WIB
                </span>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#031e21] p-2.5 rounded-xl border border-slate-200 dark:border-[#0f4950]">
                <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="truncate">{resolvedMeeting.room}</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#031e21] p-2.5 rounded-xl border border-slate-200 dark:border-[#0f4950]">
                <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">Pimpinan: {resolvedMeeting.leader_name}</span>
              </div>
            </div>
          </section>
        )}

        {/* Attendance Statistics Box */}
        <section aria-labelledby="stats-heading" className="bg-white dark:bg-[#072b2f] p-5 rounded-2xl border border-slate-200 dark:border-[#0f4950] shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-[#0f4950] pb-2.5">
            <h3 id="stats-heading" className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              Rekapitulasi Kehadiran Peserta
            </h3>
            <span className="text-xs font-mono font-bold text-teal-800 dark:text-teal-300">
              {rate}% Kehadiran
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#031e21] border border-slate-200 dark:border-[#0f4950]">
              <span className="text-[10px] text-slate-500 dark:text-teal-300/70 block uppercase font-bold">Total Pegawai</span>
              <span className="text-base font-black text-slate-900 dark:text-white font-mono">{total}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block uppercase font-bold">Hadir Tepat</span>
              <span className="text-base font-black text-emerald-800 dark:text-emerald-400 font-mono">{hadir}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <span className="text-[10px] text-amber-700 dark:text-amber-300 block uppercase font-bold">Terlambat</span>
              <span className="text-base font-black text-amber-800 dark:text-amber-400 font-mono">{terlambat}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <span className="text-[10px] text-blue-700 dark:text-blue-300 block uppercase font-bold">Izin</span>
              <span className="text-base font-black text-blue-800 dark:text-blue-400 font-mono">{izin}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
              <span className="text-[10px] text-purple-700 dark:text-purple-300 block uppercase font-bold">Sakit</span>
              <span className="text-base font-black text-purple-800 dark:text-purple-400 font-mono">{sakit}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
              <span className="text-[10px] text-rose-700 dark:text-rose-300 block uppercase font-bold">Tidak Hadir</span>
              <span className="text-base font-black text-rose-800 dark:text-rose-400 font-mono">{tidakHadir}</span>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* DAFTAR PEGAWAI TIDAK HADIR (TRANSPARANSI DATA PUBLIK)                     */}
        {/* ========================================================================= */}
        <section aria-labelledby="absent-heading" className="bg-white dark:bg-[#072b2f] p-5 rounded-2xl border border-rose-300 dark:border-rose-800/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-rose-200 dark:border-rose-900/60 pb-2.5">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <XCircle className="w-4 h-4" />
              <h3 id="absent-heading" className="text-sm font-bold uppercase tracking-wide">
                Daftar Pegawai Tidak Hadir:
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700 font-mono">
              {absentTeachers.length} Orang
            </span>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-teal-200/80">
            Daftar pegawai yang tercatat tidak menghadiri kegiatan sesuai berita acara presensi resmi:
          </p>

          {absentTeachers.length === 0 ? (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs text-center font-semibold">
              ✓ Seluruh peserta hadir lengkap (Nihil Pegawai Tidak Hadir).
            </div>
          ) : (
            <div className="overflow-x-auto max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-[#0f4950]">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-[#031e21] text-slate-700 dark:text-teal-200 font-bold sticky top-0 border-b border-slate-200 dark:border-[#0f4950]">
                  <tr>
                    <th className="py-2 px-2.5 w-10 text-center">No</th>
                    <th className="py-2 px-3">Nama Pegawai</th>
                    <th className="py-2 px-3">Jabatan / Mapel</th>
                    <th className="py-2 px-3 text-center">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#0f4950]">
                  {absentTeachers.map((item, idx) => (
                    <tr key={item.teacher.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="py-2 px-2.5 text-center font-mono font-bold text-slate-500 dark:text-teal-300">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-900 dark:text-white">{item.teacher.name}</div>
                        <div className="text-[10px] text-slate-500 dark:text-teal-300/80 font-mono">
                          NIY: {item.teacher.niy || item.teacher.nip || '-'}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-teal-200 text-[11px]">
                        {item.teacher.role_title}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                          {item.notes}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Chain of Signatures (Alur Berjenjang Dokumen) */}
        <section aria-labelledby="chain-heading" className="bg-white dark:bg-[#072b2f] p-5 rounded-2xl border border-slate-200 dark:border-[#0f4950] shadow-sm space-y-3">
          <h3 id="chain-heading" className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-200 dark:border-[#0f4950] pb-2.5">
            Rantai Tanda Tangan Elektronik Dokumen
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {signatures
              .filter((s) => s.document_type === 'attendance_report')
              .sort((a, b) => a.step_order - b.step_order)
              .map((s) => {
                const isSigned = s.status === 'signed';
                return (
                  <div
                    key={s.id}
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      isSigned
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-50 dark:bg-[#031e21] border-slate-200 dark:border-[#0f4950]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-teal-400">
                        Tahap {s.step_order}
                      </span>
                      {isSigned ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> Sah
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-teal-300/60">
                          <Clock className="w-3 h-3" /> Belum
                        </span>
                      )}
                    </div>

                    <div className="font-bold text-slate-900 dark:text-white text-xs">
                      {roleName(s.signer_role)}
                    </div>
                    <div className="text-teal-800 dark:text-teal-300 font-semibold truncate">
                      {s.signer_name}
                    </div>

                    {isSigned && (
                      <div className="text-[9.5px] font-mono text-emerald-800 dark:text-emerald-300 pt-1 border-t border-emerald-200 dark:border-emerald-900/60">
                        {s.verification_code}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>

        {/* Footer info & attribution */}
        <footer className="text-center text-xs text-slate-500 dark:text-teal-300/70 space-y-1 pt-4 border-t border-slate-200 dark:border-[#0f4950]">
          <p>© {new Date().getFullYear()} {schoolProfile.school_name || 'SMP Muhammadiyah 1 Gombong'}</p>
          <p>
            <a
              href="https://github.com/oebaedz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-teal-700 dark:text-teal-300 hover:underline"
            >
              <span>dePresent made by Mr Zee</span>
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
};
