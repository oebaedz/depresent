import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Calendar,
  MapPin,
  User,
  Users,
  Send,
  ArrowRight,
  School,
  Lock,
  FileCheck,
  Check,
  XCircle,
  ExternalLink,
  Sun,
  Moon,
  ChevronDown,
} from 'lucide-react';
import {
  DocumentSignature,
  DocumentType,
  Meeting,
  SchoolProfile,
  SignerRole,
  Teacher,
  Attendance,
} from '../types';
import {
  ensureMeetingSignatures,
  fetchDocumentSignatures,
  signDocumentStep,
} from '../lib/storage';
import { invokeWahaNotification } from '../lib/waha';
import { DigitalSignatureBadge } from './DigitalSignatureBadge';

interface SignatureApprovalViewProps {
  meetingId: string;
  roleParam?: SignerRole;
  docParam?: DocumentType;
  meetings: Meeting[];
  teachers: Teacher[];
  attendances: Attendance[];
  schoolProfile: SchoolProfile;
  onRefresh?: () => void;
}

export const SignatureApprovalView: React.FC<SignatureApprovalViewProps> = ({
  meetingId,
  roleParam = 'secretary',
  docParam = 'attendance_report',
  meetings,
  teachers,
  attendances,
  schoolProfile,
  onRefresh,
}) => {
  const [signatures, setSignatures] = useState<DocumentSignature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [activeRole, setActiveRole] = useState<SignerRole>(roleParam);

  // Theme support for maximum readability and contrast
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

  const currentMeeting = useMemo(() => {
    return meetings.find((m) => m.id === meetingId) || meetings[0];
  }, [meetings, meetingId]);

  // Load signatures from database
  const loadSignatures = async () => {
    if (!currentMeeting) return;
    setIsLoading(true);
    try {
      const sigs = await ensureMeetingSignatures(currentMeeting, schoolProfile, teachers);
      setSignatures(sigs);
    } catch (e) {
      console.warn('Error loading signatures:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSignatures();
  }, [currentMeeting?.id]);

  // Calculate attendees & absent employees
  const isCustomMeeting =
    currentMeeting &&
    currentMeeting.target_type === 'custom' &&
    Array.isArray(currentMeeting.invited_teacher_ids) &&
    currentMeeting.invited_teacher_ids.length > 0;

  const activeTeachers = useMemo(() => {
    return teachers
      .filter((t) => t.is_active)
      .filter((t) => !isCustomMeeting || currentMeeting?.invited_teacher_ids?.includes(t.id));
  }, [teachers, currentMeeting, isCustomMeeting]);

  const meetingAttendances = useMemo(() => {
    if (!currentMeeting) return [];
    return attendances.filter((a) => a.meeting_id === currentMeeting.id);
  }, [attendances, currentMeeting]);

  const attendanceMap = useMemo(() => {
    const map = new Map<string, Attendance>();
    meetingAttendances.forEach((a) => map.set(a.teacher_id, a));
    return map;
  }, [meetingAttendances]);

  // Stats calculation
  const total = activeTeachers.length;
  const hadir = meetingAttendances.filter((a) => a.status === 'hadir').length;
  const terlambat = meetingAttendances.filter((a) => a.status === 'terlambat').length;
  const izin = meetingAttendances.filter((a) => a.status === 'izin').length;
  const sakit = meetingAttendances.filter((a) => a.status === 'sakit').length;
  const tidakHadir = Math.max(0, total - (hadir + terlambat + izin + sakit));

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
          notes: currentMeeting?.status === 'completed' ? 'Tidak Hadir hingga Rapat Ditutup' : 'Belum Presensi',
        });
      }
    });
    return list;
  }, [activeTeachers, attendanceMap, currentMeeting]);

  const totalPresent = hadir + terlambat;
  const attendancePercentage = total > 0 ? Math.round((totalPresent / total) * 100) : 0;

  // Signatures for current document type
  const docSignatures = useMemo(() => {
    return signatures
      .filter((s) => s.document_type === docParam)
      .sort((a, b) => a.step_order - b.step_order);
  }, [signatures, docParam]);

  // Current signer
  const currentSigner = useMemo(() => {
    return docSignatures.find((s) => s.signer_role === activeRole);
  }, [docSignatures, activeRole]);

  // Check sequential eligibility
  const previousSigner = useMemo(() => {
    if (!currentSigner || currentSigner.step_order <= 1) return null;
    return docSignatures.find((s) => s.step_order === currentSigner.step_order - 1);
  }, [docSignatures, currentSigner]);

  const isStepLocked = Boolean(previousSigner && previousSigner.status !== 'signed');

  // Handle signature execution
  const handleApprove = async () => {
    if (!currentMeeting || !currentSigner) return;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await signDocumentStep(
        currentMeeting.id,
        docParam,
        activeRole
      );

      if (res.success && res.signature) {
        setFeedback({ text: res.message, type: 'success' });
        await loadSignatures();
        if (onRefresh) onRefresh();

        // Estafet WhatsApp automatic notification to next signer
        if (res.nextSignerRole) {
          const nextSig = signatures.find(
            (s) => s.document_type === docParam && s.signer_role === res.nextSignerRole
          );
          if (nextSig && nextSig.signer_phone) {
            const nextRoleLabel =
              nextSig.signer_role === 'leader'
                ? 'Pimpinan Rapat'
                : nextSig.signer_role === 'headmaster'
                ? 'Kepala Sekolah'
                : 'Notulis';

            const approvalUrl = `${window.location.origin}${window.location.pathname}?sign=${currentMeeting.id}&role=${nextSig.signer_role}&doc=${docParam}`;
            const message = `*PERMINTAAN TANDA TANGAN & PENGESAHAN DOKUMEN*\n` +
              `Yth. ${nextSig.signer_name} (${nextRoleLabel}),\n\n` +
              `Tahap tanda tangan sebelumnya telah disetujui. Mohon kesediaan Bapak/Ibu untuk memeriksa dan menandatangani dokumen:\n` +
              `• Agenda: *${currentMeeting.title}*\n` +
              `• Dokumen: *Laporan Daftar Hadir Rapat*\n\n` +
              `Silakan klik tautan resmi berikut untuk pengesahan elektronik:\n` +
              `👉 ${approvalUrl}\n\n` +
              `_${schoolProfile.school_name}_\n_dePresent made by Mr Zee_`;

            invokeWahaNotification({
              action: 'meeting_reminder',
              recipient: nextSig.signer_phone,
              message,
            }).catch((err) => console.warn('Estafet WA error:', err));
          }
        }
      } else {
        setFeedback({ text: res.message, type: 'error' });
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      setFeedback({ text: `Gagal memproses pengesahan: ${err}`, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDate = currentMeeting
    ? new Date(currentMeeting.meeting_date).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  const meetingTime = currentMeeting
    ? `${currentMeeting.start_time?.slice(0, 5) || currentMeeting.start_time} - ${currentMeeting.end_time?.slice(0, 5) || currentMeeting.end_time} WIB`
    : '';

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#031e21] text-slate-900 dark:text-teal-50 selection:bg-teal-600 selection:text-white transition-colors duration-150 py-4 sm:py-8 px-3 sm:px-6">
      {/* Top Floating Control Bar */}
      <div className="max-w-2xl mx-auto flex items-center justify-between mb-4 no-print">
        <a
          href={window.location.pathname}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-teal-300 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <span>← Kembali ke Aplikasi</span>
        </a>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-white dark:bg-[#072b2f] border border-slate-300 dark:border-[#0f4950] text-slate-700 dark:text-teal-200 hover:bg-slate-50 dark:hover:bg-[#0b383d] shadow-2xs transition-colors cursor-pointer"
            title="Ganti Tema (Light / Dark)"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
        </div>
      </div>

      <main className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-5">
        {/* Header Branding */}
        <header className="text-center space-y-1.5 px-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100 dark:bg-[#0b383d] border border-teal-300 dark:border-teal-700/60 text-teal-900 dark:text-teal-200 text-[11px] font-bold uppercase tracking-wider shadow-2xs">
            <School className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
            <span>{schoolProfile.school_name || 'SMP MUHAMMADIYAH 1 GOMBONG'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Persetujuan & Pengesahan Dokumen
          </h1>
          <p className="text-xs text-slate-600 dark:text-teal-200/80 font-medium">
            Pengesahan Elektronik Resmi Berjenjang dengan QR Verifikasi Otentik
          </p>
        </header>

        {/* 3-Step Sequential Progress Stepper (Mobile Optimized) */}
        <section aria-labelledby="stepper-heading" className="bg-white dark:bg-[#072b2f] border border-slate-200 dark:border-[#0f4950] rounded-2xl p-3.5 sm:p-4 shadow-sm">
          <h2 id="stepper-heading" className="sr-only">Alur Tanda Tangan Berjenjang</h2>
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-teal-300/80 mb-2.5 text-center">
            Alur Pengesahan Berjenjang:
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {docSignatures.map((sig) => {
              const isCurrent = sig.signer_role === activeRole;
              const isComplete = sig.status === 'signed';
              const roleTitle =
                sig.signer_role === 'secretary'
                  ? '1. Notulis'
                  : sig.signer_role === 'leader'
                  ? '2. Pimpinan'
                  : sig.signer_role === 'headmaster'
                  ? '3. Kepala'
                  : 'Ekspedisi';

              return (
                <button
                  key={sig.id}
                  type="button"
                  onClick={() => setActiveRole(sig.signer_role)}
                  className={`p-2 sm:p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between min-h-[72px] sm:min-h-[80px] ${
                    isCurrent
                      ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-600 dark:border-teal-400 ring-2 ring-teal-500/30 text-teal-950 dark:text-white'
                      : isComplete
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                      : 'bg-slate-50 dark:bg-[#031e21] border-slate-200 dark:border-[#0f4950] text-slate-600 dark:text-teal-300/60 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    {isComplete ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : isCurrent ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-teal-600 dark:bg-teal-400 animate-pulse shrink-0" />
                    ) : (
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                    )}
                    <span className="text-[11px] sm:text-xs font-black truncate">{roleTitle}</span>
                  </div>
                  <span className="text-[10px] truncate max-w-full font-semibold">
                    {sig.signer_name}
                  </span>
                  <span className={`text-[9px] font-mono font-bold mt-0.5 ${isComplete ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-teal-400/60'}`}>
                    {isComplete ? '✓ Sah' : 'Menunggu'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step Locked Warning Banner */}
        {isStepLocked && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3 shadow-xs">
            <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-900 dark:text-amber-300 text-xs sm:text-sm block">
                PENGESAHAN TAHAP INI BELUM DIBUKA
              </span>
              <p className="leading-relaxed text-[11px] sm:text-xs text-amber-800 dark:text-amber-200">
                Alur berjenjang: dokumen harus ditandatangani oleh{' '}
                <strong className="underline">
                  {previousSigner?.signer_role === 'secretary'
                    ? 'Notulis Rapat'
                    : previousSigner?.signer_role === 'leader'
                    ? 'Pimpinan Rapat'
                    : 'Petugas Ekspedisi'}{' '}
                  ({previousSigner?.signer_name})
                </strong>{' '}
                terlebih dahulu sebelum Anda dapat memberikan persetujuan.
              </p>
            </div>
          </div>
        )}

        {/* Agenda Details Card */}
        <section aria-labelledby="agenda-heading" className="bg-white dark:bg-[#072b2f] border border-slate-200 dark:border-[#0f4950] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-indigo-600" />

          <div className="flex items-start justify-between gap-2 border-b border-slate-200 dark:border-[#0f4950] pb-2.5 pt-1">
            <div className="min-w-0 flex-1">
              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 mb-1">
                {currentMeeting?.category || 'Rapat Dinas'}
              </span>
              <h2 id="agenda-heading" className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                {currentMeeting?.title}
              </h2>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-xs font-mono font-bold shrink-0">
              {attendancePercentage}% Hadir
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#031e21] p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-[#0f4950] text-slate-800 dark:text-teal-200">
              <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="truncate">{formattedDate}</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#031e21] p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-[#0f4950] text-slate-800 dark:text-teal-200">
              <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <span className="truncate">{meetingTime}</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#031e21] p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-[#0f4950] text-slate-800 dark:text-teal-200">
              <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="truncate">{currentMeeting?.room}</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#031e21] p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-[#0f4950] text-slate-800 dark:text-teal-200">
              <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">Pimpinan: {currentMeeting?.leader_name}</span>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* DETAIL DAFTAR NAMA YANG TIDAK HADIR (TRANSPARANSI SEBELUM TTD)             */}
        {/* ========================================================================= */}
        <section aria-labelledby="absent-heading" className="bg-white dark:bg-[#072b2f] border-2 border-rose-300 dark:border-rose-900/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-rose-200 dark:border-rose-900/60 pb-2">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <XCircle className="w-4 h-4 shrink-0" />
              <h3 id="absent-heading" className="text-xs sm:text-sm font-bold uppercase tracking-wide">
                Daftar Pegawai Tidak Hadir:
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700 font-mono">
              {absentTeachers.length} Orang
            </span>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-teal-200/80">
            Periksa rincian ketidakhadiran sebelum memberikan persetujuan resmi:
          </p>

          {absentTeachers.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs text-center font-bold">
              ✓ Seluruh peserta hadir lengkap (Nihil Pegawai Tidak Hadir).
            </div>
          ) : (
            <div className="overflow-x-auto max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-[#0f4950]">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-[#031e21] text-slate-700 dark:text-teal-200 font-bold sticky top-0 border-b border-slate-200 dark:border-[#0f4950]">
                  <tr>
                    <th className="py-2 px-2 w-8 text-center">No</th>
                    <th className="py-2 px-2.5">Nama Pegawai</th>
                    <th className="py-2 px-2.5 hidden sm:table-cell">Jabatan</th>
                    <th className="py-2 px-2.5 text-center">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#0f4950]">
                  {absentTeachers.map((item, idx) => (
                    <tr key={item.teacher.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="py-2 px-2 text-center font-mono font-bold text-slate-500 dark:text-teal-300">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-2.5">
                        <div className="font-bold text-slate-900 dark:text-white leading-tight">{item.teacher.name}</div>
                        <div className="text-[9.5px] text-slate-500 dark:text-teal-300/80 font-mono">
                          NIY: {item.teacher.niy || item.teacher.nip || '-'}
                        </div>
                        <div className="sm:hidden text-[10px] text-slate-500 dark:text-teal-300/80 mt-0.5">
                          {item.teacher.role_title}
                        </div>
                      </td>
                      <td className="py-2 px-2.5 text-slate-700 dark:text-teal-200 text-[11px] hidden sm:table-cell">
                        {item.teacher.role_title}
                      </td>
                      <td className="py-2 px-2.5 text-center">
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

        {/* Current Signer Card & Action (Mobile-First) */}
        {currentSigner && (
          <section aria-labelledby="signer-action-heading" className="bg-white dark:bg-[#072b2f] border-2 border-teal-600 dark:border-teal-500 rounded-2xl p-4 sm:p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#0f4950] pb-2.5">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-teal-700 dark:text-teal-300 block">
                  Pihak Penandatangan:
                </span>
                <h3 id="signer-action-heading" className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {currentSigner.signer_role === 'secretary'
                    ? 'Notulis Rapat'
                    : currentSigner.signer_role === 'leader'
                    ? 'Pimpinan Rapat'
                    : currentSigner.signer_role === 'headmaster'
                    ? 'Kepala Sekolah (Pengesahan Institusi)'
                    : 'Petugas Ekspedisi'}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">{currentSigner.signer_name}</span>
                <span className="text-[10px] text-slate-600 dark:text-teal-300 font-mono block">NIY: {currentSigner.signer_niy || '-'}</span>
              </div>
            </div>

            {/* If Already Signed: Show Certificate Badge */}
            {currentSigner.status === 'signed' ? (
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 dark:bg-[#042024] border border-emerald-300 dark:border-emerald-500/50 text-center space-y-3">
                <div className="w-11 h-11 mx-auto rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block">
                    Dokumen Telah Disahkan Secara Elektronik
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                    Disetujui pada{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {new Date(currentSigner.signed_at || '').toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}{' '}
                      pukul{' '}
                      {new Date(currentSigner.signed_at || '').toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}{' '}
                      WIB
                    </strong>
                  </p>
                  <p className="text-xs font-mono font-bold text-teal-800 dark:text-teal-300 mt-1">
                    Kode Verifikasi: {currentSigner.verification_code}
                  </p>
                </div>

                <div className="pt-2 flex justify-center">
                  <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200 dark:border-teal-800 text-slate-900 max-w-sm">
                    <DigitalSignatureBadge
                      signature={currentSigner}
                      role={currentSigner.signer_role}
                      roleTitle={
                        currentSigner.signer_role === 'secretary'
                          ? 'Notulis Rapat'
                          : currentSigner.signer_role === 'leader'
                          ? 'Pimpinan Rapat'
                          : 'Kepala Sekolah'
                      }
                      signerName={currentSigner.signer_name}
                      signerNiy={currentSigner.signer_niy}
                      schoolProfile={schoolProfile}
                    />
                  </div>
                </div>

                {/* Direct link to public verification view */}
                {currentSigner.verification_code && (
                  <div className="pt-2">
                    <a
                      href={`${window.location.origin}${window.location.pathname}?verify=${currentSigner.verification_code}&meeting=${currentSigner.meeting_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka Halaman Verifikasi Publik QR Code</span>
                    </a>
                  </div>
                )}
              </div>
            ) : (
              /* If Not Signed Yet: Action Button */
              <div className="space-y-3">
                {feedback && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      feedback.type === 'success'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                        : 'bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200'
                    }`}
                  >
                    {feedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-700 dark:text-rose-400" />
                    )}
                    <span>{feedback.text}</span>
                  </div>
                )}

                <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-[#031e21] border border-slate-200 dark:border-[#0f4950] text-xs text-slate-700 dark:text-teal-200 leading-relaxed">
                  Dengan mengklik tombol di bawah ini, saya menyatakan telah memeriksa dan menyetujui seluruh data kehadiran dan berita acara rapat ini secara sah.
                  <span className="block mt-1 text-teal-800 dark:text-teal-300 font-semibold">
                    ✓ Pengesahan ini otomatis menerbitkan QR Code Verifikasi Kedinasan resmi yang dapat dipindai publik.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isSubmitting || isStepLocked}
                  className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 hover:from-teal-600 hover:to-emerald-500 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer active:scale-[0.99]"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Menyimpan Pengesahan Digital...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      <span>Setujui & Sahkan Dokumen Resmi</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </section>
        )}

        {/* Footer info & attribution */}
        <footer className="text-center text-xs text-slate-500 dark:text-teal-300/70 space-y-1 pt-3 pb-6 border-t border-slate-200 dark:border-[#0f4950]">
          <p>© {new Date().getFullYear()} {schoolProfile.school_name || 'SMP Muhammadiyah 1 Gombong'}</p>
          <p>
            <a
              href="https://github.com/oebaedz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-teal-700 dark:text-teal-400 hover:underline"
            >
              <span>dePresent made by Mr Zee</span>
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
};
