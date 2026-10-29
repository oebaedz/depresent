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
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);

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
      const res = await signDocumentStep(currentMeeting.id, docParam, activeRole);
      if (res.success) {
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

            // Fire and forget WA notification via WAHA
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
    <div className="min-h-screen bg-radial from-[#052b30] via-[#031e21] to-[#011214] text-slate-100 flex flex-col items-center justify-center p-3 sm:p-6 selection:bg-teal-500 selection:text-white relative overflow-hidden">
      {/* Decorative ambient glowing orbs */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 bg-gradient-to-r from-teal-500/15 via-indigo-500/15 to-purple-500/15 blur-3xl pointer-events-none rounded-full" />
      <div className="fixed bottom-0 right-1/4 w-80 h-80 bg-gradient-to-tl from-amber-500/10 via-emerald-500/10 to-teal-500/10 blur-3xl pointer-events-none rounded-full" />

      <main className="w-full max-w-2xl space-y-5 relative z-10 my-4 sm:my-8">
        {/* Header Branding */}
        <header className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-teal-500/15 via-indigo-500/15 to-purple-500/15 border border-indigo-400/30 text-indigo-200 text-xs font-semibold uppercase tracking-wider shadow-xs">
            <School className="w-3.5 h-3.5 text-indigo-300" />
            {schoolProfile.school_name || 'SMP MUHAMMADIYAH 1 GOMBONG'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-xs">
            Persetujuan & Pengesahan Dokumen
          </h1>
          <p className="text-xs text-slate-300 font-medium">
            Layanan Pengesahan Elektronik Resmi Tanda Tangan Berjenjang (UU ITE)
          </p>
        </header>

        {/* 3-Step Sequential Progress Stepper */}
        <section aria-labelledby="stepper-heading" className="bg-[#072b2f]/90 border border-teal-500/30 rounded-2xl p-4 shadow-xl backdrop-blur-md">
          <h2 id="stepper-heading" className="sr-only">Alur Tanda Tangan Berjenjang</h2>
          <div className="text-[10px] uppercase tracking-wider font-bold text-teal-300 mb-3 text-center">
            Alur Pengesahan Berjenjang:
          </div>

          <div className="grid grid-cols-3 gap-2">
            {docSignatures.map((sig) => {
              const isCurrent = sig.signer_role === activeRole;
              const isComplete = sig.status === 'signed';
              const roleTitle =
                sig.signer_role === 'secretary'
                  ? '1. Notulis'
                  : sig.signer_role === 'leader'
                  ? '2. Pimpinan'
                  : sig.signer_role === 'headmaster'
                  ? '3. Kepala Sekolah'
                  : 'Petugas Ekspedisi';

              return (
                <button
                  key={sig.id}
                  type="button"
                  onClick={() => setActiveRole(sig.signer_role)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between ${
                    isCurrent
                      ? 'bg-teal-500/20 border-teal-400 ring-2 ring-teal-500/40 text-white'
                      : isComplete
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-900/40 border-teal-900/40 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {isComplete ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : isCurrent ? (
                      <div className="w-3.5 h-3.5 rounded-full bg-teal-400 animate-pulse shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    )}
                    <span className="text-xs font-bold truncate">{roleTitle}</span>
                  </div>
                  <span className="text-[10px] truncate max-w-full font-medium opacity-90">
                    {sig.signer_name}
                  </span>
                  <span className="text-[9px] mt-1 font-mono">
                    {isComplete ? '✓ Disahkan' : 'Menunggu'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step Locked Warning Banner */}
        {isStepLocked && (
          <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-200 text-xs flex items-start gap-3 shadow-lg">
            <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-300 text-sm block">
                PENGESAHAN TAHAP INI BELUM DIBUKA
              </span>
              <p className="leading-relaxed">
                Berdasarkan aturan alur berjenjang, pengesahan dokumen ini harus ditandatangani oleh{' '}
                <strong className="text-white">
                  {previousSigner?.signer_role === 'secretary'
                    ? 'Notulis Rapat'
                    : previousSigner?.signer_role === 'leader'
                    ? 'Pimpinan Rapat'
                    : 'Petugas Ekspedisi'}{' '}
                  ({previousSigner?.signer_name})
                </strong>{' '}
                terlebih dahulu sebelum diserahkan kepada Anda.
              </p>
            </div>
          </div>
        )}

        {/* Agenda Details Card */}
        <section aria-labelledby="agenda-heading" className="bg-[#072b2f]/90 backdrop-blur-md border border-[#0f4950] rounded-2xl p-5 shadow-xl space-y-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-500" />

          <div className="flex items-start justify-between gap-3 border-b border-[#0f4950]/80 pb-3 pt-1">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400/15 text-amber-300 border border-amber-400/30 mb-1.5">
                {currentMeeting?.category || 'Rapat Dinas'}
              </span>
              <h2 id="agenda-heading" className="text-lg font-bold text-white leading-snug">
                {currentMeeting?.title}
              </h2>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold shrink-0">
              {attendancePercentage}% Hadir
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-slate-200 bg-slate-900/40 p-2.5 rounded-xl border border-teal-900/50">
              <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-200 bg-slate-900/40 p-2.5 rounded-xl border border-teal-900/50">
              <Clock className="w-4 h-4 text-sky-400 shrink-0" />
              <span>{meetingTime}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-200 bg-slate-900/40 p-2.5 rounded-xl border border-teal-900/50">
              <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="truncate">{currentMeeting?.room}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-200 bg-slate-900/40 p-2.5 rounded-xl border border-teal-900/50">
              <User className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">Pimpinan: {currentMeeting?.leader_name}</span>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* DETAIL DAFTAR NAMA YANG TIDAK HADIR (TRANSPARANSI SEBELUM TTD)             */}
        {/* ========================================================================= */}
        <section aria-labelledby="absent-heading" className="bg-[#072b2f]/90 backdrop-blur-md border border-rose-500/30 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-[#0f4950] pb-2.5">
            <div className="flex items-center gap-2 text-rose-300">
              <XCircle className="w-4 h-4 text-rose-400" />
              <h3 id="absent-heading" className="text-sm font-bold text-white uppercase tracking-wide">
                Daftar Pegawai Tidak Hadir:
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
              {absentTeachers.length} Orang
            </span>
          </div>

          <p className="text-[11px] text-slate-300">
            Daftar ini ditampilkan agar penandatangan memeriksa kepastian kehadiran peserta sebelum memberikan persetujuan:
          </p>

          {absentTeachers.length === 0 ? (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs text-center font-medium">
              ✓ Seluruh peserta hadir lengkap (Nihil Pegawai Tidak Hadir).
            </div>
          ) : (
            <div className="overflow-x-auto max-h-56 overflow-y-auto rounded-xl border border-[#0f4950]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#042024] text-slate-300 font-bold sticky top-0">
                  <tr>
                    <th className="py-2 px-2.5 w-10 text-center">No</th>
                    <th className="py-2 px-3">Nama Pegawai</th>
                    <th className="py-2 px-3">Jabatan / Mapel</th>
                    <th className="py-2 px-3 text-center">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0f4950]">
                  {absentTeachers.map((item, idx) => (
                    <tr key={item.teacher.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-2 px-2.5 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-white">{item.teacher.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          NIY: {item.teacher.niy || item.teacher.nip || '-'}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-300 text-[11px]">
                        {item.teacher.role_title}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
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

        {/* Current Signer Card & Action */}
        {currentSigner && (
          <section aria-labelledby="signer-action-heading" className="bg-[#072b2f]/95 backdrop-blur-md border border-teal-500/40 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#0f4950] pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-teal-300 block">
                  Pihak Penandatangan:
                </span>
                <h3 id="signer-action-heading" className="text-base font-bold text-white">
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
                <span className="text-xs font-bold text-slate-200 block">{currentSigner.signer_name}</span>
                <span className="text-[10px] text-teal-300 font-mono block">NIY: {currentSigner.signer_niy || '-'}</span>
              </div>
            </div>

            {/* If Already Signed: Show Certificate Badge */}
            {currentSigner.status === 'signed' ? (
              <div className="p-5 rounded-2xl bg-[#042024] border border-emerald-500/40 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                    Dokumen Telah Disahkan Secara Elektronik
                  </span>
                  <p className="text-xs text-slate-300 mt-1">
                    Disetujui pada{' '}
                    <strong className="text-white">
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
                  <p className="text-xs font-mono font-bold text-teal-300 mt-1">
                    Kode Verifikasi: {currentSigner.verification_code}
                  </p>
                </div>

                <div className="pt-2 flex justify-center">
                  <div className="p-3 bg-white rounded-xl shadow-xs text-slate-900 max-w-sm">
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
              </div>
            ) : (
              /* If Not Signed Yet: Action Button */
              <div className="space-y-3">
                {feedback && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      feedback.type === 'success'
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-200'
                        : 'bg-rose-500/15 border border-rose-500/30 text-rose-200'
                    }`}
                  >
                    {feedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{feedback.text}</span>
                  </div>
                )}

                <div className="p-3.5 rounded-xl bg-slate-900/50 border border-teal-900/50 text-xs text-slate-300 leading-relaxed">
                  Dengan mengklik tombol di bawah ini, saya menyatakan telah memeriksa dan menyetujui seluruh data kehadiran dan berita acara rapat ini secara sah.
                  {currentSigner.signer_role === 'headmaster' && (
                    <span className="block mt-1 text-teal-300 font-semibold">
                      ★ Pengesahan ini akan otomatis membubuhkan Stempel Digital Resmi Sekolah & QR Code Verifikasi Kedinasan.
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isSubmitting || isStepLocked}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold text-sm shadow-xl shadow-teal-950/60 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
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
        <footer className="text-center text-[11px] text-slate-400 space-y-1 pt-3 border-t border-teal-900/40">
          <p>© {new Date().getFullYear()} {schoolProfile.school_name || 'SMP Muhammadiyah 1 Gombong'}</p>
          <p>
            <a
              href="https://github.com/oebaedz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-teal-400 hover:text-teal-300 underline underline-offset-2 transition-colors"
            >
              <span>dePresent made by Mr Zee</span>
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
};
