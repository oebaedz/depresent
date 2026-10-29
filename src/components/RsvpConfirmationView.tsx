import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, CheckCircle2, AlertCircle, Send, Check, HeartPulse, FileEdit, School, MessageSquare } from 'lucide-react';
import { Meeting, RsvpStatus, SchoolProfile, Teacher, Invitation } from '../types';
import { getCachedInvitations, submitRsvpConfirmation } from '../lib/storage';

interface RsvpConfirmationViewProps {
  meetingId: string;
  teacherId: string;
  meetings: Meeting[];
  teachers: Teacher[];
  schoolProfile: SchoolProfile;
  onDone?: () => void;
}

export const RsvpConfirmationView: React.FC<RsvpConfirmationViewProps> = ({
  meetingId,
  teacherId,
  meetings,
  teachers,
  schoolProfile,
  onDone,
}) => {
  const currentMeeting = meetings.find((m) => m.id === meetingId);
  const currentTeacher = teachers.find((t) => t.id === teacherId || t.ptk_id === teacherId);

  const [selectedStatus, setSelectedStatus] = useState<RsvpStatus>('attending');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<Invitation | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Load existing invitation record if teacher already confirmed
  useEffect(() => {
    if (currentMeeting && currentTeacher) {
      const list = getCachedInvitations();
      const existing = list.find(
        (inv) => inv.meeting_id === currentMeeting.id && inv.teacher_id === currentTeacher.id
      );
      if (existing && existing.rsvp_status !== 'unconfirmed') {
        setSelectedStatus(existing.rsvp_status);
        setNotes(existing.rsvp_notes || '');
        setSubmittedData(existing);
      }
    }
  }, [currentMeeting, currentTeacher]);

  if (!currentMeeting || !currentTeacher) {
    return (
      <div className="min-h-screen bg-[#031e21] text-teal-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#072b2f] border border-[#0f4950] rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Tautan Undangan Tidak Ditemukan</h2>
          <p className="text-sm text-teal-200/80">
            Agenda rapat atau data penerima undangan tidak valid atau telah diperbarui oleh panitia. Silakan hubungi bagian Tata Usaha sekolah.
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                if (typeof window !== 'undefined') window.location.href = window.location.pathname;
              }}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
            >
              Kembali ke Beranda dePresent
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedbackMessage(null);

    try {
      const res = await submitRsvpConfirmation(
        currentMeeting.id,
        currentTeacher.id,
        selectedStatus,
        notes.trim()
      );

      if (res.success && res.invitation) {
        setSubmittedData(res.invitation);
        setFeedbackMessage(res.message);
        setIsEditing(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedbackMessage(`Gagal menyimpan konfirmasi: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDate = new Date(currentMeeting.meeting_date).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Normalize phone for Ka TU WhatsApp contact
  const cleanKaTuPhone = (schoolProfile.phone || '08123456789').replace(/[^\d+]/g, '');
  const waKaTuTarget = cleanKaTuPhone.startsWith('0') ? '62' + cleanKaTuPhone.substring(1) : cleanKaTuPhone.replace(/^\+/, '');
  const waKaTuMessage = encodeURIComponent(
    `Assalamu'alaikum Ka TU ${schoolProfile.school_name}, saya ${currentTeacher.name} ingin konfirmasi terkait undangan rapat "${currentMeeting.title}".`
  );

  return (
    <div className="min-h-screen bg-radial from-[#052b30] via-[#031e21] to-[#011214] text-teal-50 flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-teal-500 selection:text-white relative overflow-hidden">
      {/* Decorative ambient glowing orbs */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-64 bg-gradient-to-r from-teal-500/20 via-indigo-500/20 to-purple-500/20 blur-3xl pointer-events-none rounded-full" />
      <div className="fixed bottom-0 right-1/4 w-72 h-72 bg-gradient-to-tl from-amber-500/10 via-emerald-500/10 to-teal-500/10 blur-3xl pointer-events-none rounded-full" />

      <main className="w-full max-w-lg space-y-5 relative z-10 my-6">
        {/* Header Branding */}
        <header className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-teal-500/15 via-indigo-500/15 to-purple-500/15 border border-indigo-400/30 text-indigo-200 text-xs font-semibold uppercase tracking-wider shadow-xs">
            <School className="w-3.5 h-3.5 text-indigo-300" />
            {schoolProfile.school_name || 'SMP Muhammadiyah 1 Gombong'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-xs">
            Konfirmasi Kehadiran Undangan
          </h1>
          <p className="text-xs text-slate-300/80 font-medium">
            Portal Resmi Konfirmasi Kehadiran & Ketertiban Persuratan Sekolah
          </p>
        </header>

        {/* Meeting Information Card with Accent Colors */}
        <section aria-labelledby="meeting-details-heading" className="bg-[#072b2f]/90 backdrop-blur-md border border-[#0f4950] rounded-2xl p-5 shadow-2xl space-y-4 relative overflow-hidden">
          {/* Top colored accent stripe */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-500" />

          <div className="flex items-start justify-between gap-3 border-b border-[#0f4950]/80 pb-3 pt-1">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400/15 text-amber-300 border border-amber-400/30 mb-1.5">
                {currentMeeting.category}
              </span>
              <h2 id="meeting-details-heading" className="text-lg font-bold text-white leading-snug">
                {currentMeeting.title}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-slate-200 bg-slate-900/40 p-2 rounded-xl border border-teal-900/50">
              <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <span className="font-medium">{formattedDate}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-200 bg-slate-900/40 p-2 rounded-xl border border-teal-900/50">
              <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <span className="font-mono font-medium">{currentMeeting.start_time?.slice(0, 5) || currentMeeting.start_time} - {currentMeeting.end_time?.slice(0, 5) || currentMeeting.end_time} WIB</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-200 bg-slate-900/40 p-2 rounded-xl border border-teal-900/50">
              <div className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400 shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <span className="font-medium truncate">{currentMeeting.room}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-200 bg-slate-900/40 p-2 rounded-xl border border-teal-900/50">
              <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0">
                <User className="w-4 h-4" />
              </div>
              <span className="font-medium truncate">Pimpinan: {currentMeeting.leader_name}</span>
            </div>
          </div>

          {currentMeeting.notes && (
            <div className="bg-[#031e21]/70 rounded-xl p-3 border border-indigo-900/40 text-xs text-indigo-100/90">
              <span className="font-semibold text-indigo-300 block mb-0.5">Catatan Agenda:</span>
              <p className="whitespace-pre-line text-slate-200">{currentMeeting.notes.split('[ATTENDEES_SYNC:')[0].trim()}</p>
            </div>
          )}
        </section>

        {/* Recipient Teacher Information with Indigo Accent */}
        <section aria-labelledby="teacher-info-heading" className="bg-[#072b2f]/90 backdrop-blur-md border border-indigo-500/30 rounded-2xl p-4 flex items-center gap-3.5 shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-lg shrink-0 shadow-md shadow-indigo-500/25">
            {currentTeacher.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold block">Penerima Undangan</span>
            <h2 id="teacher-info-heading" className="text-base font-bold text-white truncate">{currentTeacher.name}</h2>
            <p className="text-xs text-teal-200/90 truncate flex items-center gap-2 mt-0.5">
              <span>NIY: {currentTeacher.niy || '-'}</span>
              <span>•</span>
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-200 text-[10px] font-medium border border-indigo-500/30">{currentTeacher.role_title}</span>
            </p>
          </div>
        </section>

        {/* If already submitted and not editing: show confirmation card */}
        {submittedData && !isEditing ? (
          <div className={`border rounded-2xl p-6 text-center space-y-4 shadow-xl backdrop-blur-md ${
            submittedData.rsvp_status === 'attending'
              ? 'bg-[#042024]/95 border-emerald-500/50'
              : submittedData.rsvp_status === 'permission'
              ? 'bg-[#1a1c12]/95 border-amber-500/50'
              : 'bg-[#1c1218]/95 border-rose-500/50'
          }`}>
            <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center ${
              submittedData.rsvp_status === 'attending'
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                : submittedData.rsvp_status === 'permission'
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                : 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
            }`}>
              {submittedData.rsvp_status === 'attending' && <CheckCircle2 className="w-8 h-8" />}
              {submittedData.rsvp_status === 'permission' && <AlertCircle className="w-8 h-8" />}
              {submittedData.rsvp_status === 'sick' && <HeartPulse className="w-8 h-8" />}
            </div>

            <div className="space-y-1">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-300">Status Konfirmasi Anda</span>
              <h2 className={`text-2xl font-black ${
                submittedData.rsvp_status === 'attending'
                  ? 'text-emerald-300'
                  : submittedData.rsvp_status === 'permission'
                  ? 'text-amber-300'
                  : 'text-rose-300'
              }`}>
                {submittedData.rsvp_status === 'attending' && 'Akan Hadir'}
                {submittedData.rsvp_status === 'permission' && 'Izin'}
                {submittedData.rsvp_status === 'sick' && 'Sakit (Izin Medis)'}
              </h2>
              {submittedData.rsvp_at && (
                <p className="text-xs text-slate-300">
                  Dikonfirmasi pada {new Date(submittedData.rsvp_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} WIB
                </p>
              )}
            </div>

            {submittedData.rsvp_notes && (
              <div className="bg-black/30 rounded-xl p-3 border border-white/10 text-xs text-left">
                <span className="text-slate-300 block font-semibold mb-0.5">Catatan / Alasan:</span>
                <p className="text-white">{submittedData.rsvp_notes}</p>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-teal-100 text-xs font-semibold border border-slate-600 transition-colors cursor-pointer"
              >
                <FileEdit className="w-4 h-4 text-teal-300" />
                Ubah Pilihan Kehadiran
              </button>
            </div>
          </div>
        ) : (
          /* Confirmation Form with Rich Accent Buttons */
          <form onSubmit={handleSubmit} className="bg-[#072b2f]/90 backdrop-blur-md border border-[#0f4950] rounded-2xl p-5 space-y-4 shadow-xl">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-200 mb-2">
                Pilih Kepastian Kehadiran Anda
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Attending (Emerald Accent) */}
                <button
                  type="button"
                  onClick={() => setSelectedStatus('attending')}
                  className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer ${
                    selectedStatus === 'attending'
                      ? 'bg-gradient-to-b from-emerald-500/25 to-teal-900/40 border-emerald-400 text-emerald-200 shadow-md shadow-emerald-950/60 ring-2 ring-emerald-500/40'
                      : 'bg-slate-900/50 border-[#0f4950] text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-950/20'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedStatus === 'attending' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'bg-slate-800 text-emerald-400'}`}>
                    <Check className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <span className="text-xs font-bold">Akan Hadir</span>
                  <span className="text-[10px] text-slate-300/70">Hadir tepat waktu</span>
                </button>

                {/* Permission ("Izin" saja - Amber Accent) */}
                <button
                  type="button"
                  onClick={() => setSelectedStatus('permission')}
                  className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer ${
                    selectedStatus === 'permission'
                      ? 'bg-gradient-to-b from-amber-500/25 to-amber-950/40 border-amber-400 text-amber-200 shadow-md shadow-amber-950/60 ring-2 ring-amber-500/40'
                      : 'bg-slate-900/50 border-[#0f4950] text-slate-300 hover:border-amber-500/50 hover:bg-amber-950/20'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedStatus === 'permission' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-slate-800 text-amber-400'}`}>
                    <AlertCircle className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <span className="text-xs font-bold">Izin</span>
                  <span className="text-[10px] text-slate-300/70">Tugas / Keperluan</span>
                </button>

                {/* Sick (Rose Accent) */}
                <button
                  type="button"
                  onClick={() => setSelectedStatus('sick')}
                  className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer ${
                    selectedStatus === 'sick'
                      ? 'bg-gradient-to-b from-rose-500/25 to-rose-950/40 border-rose-400 text-rose-200 shadow-md shadow-rose-950/60 ring-2 ring-rose-500/40'
                      : 'bg-slate-900/50 border-[#0f4950] text-slate-300 hover:border-rose-500/50 hover:bg-rose-950/20'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedStatus === 'sick' ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-800 text-rose-400'}`}>
                    <HeartPulse className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <span className="text-xs font-bold">Sakit</span>
                  <span className="text-[10px] text-slate-300/70">Istirahat Medis</span>
                </button>
              </div>
            </div>

            {/* Optional Notes / Reason Input */}
            <div className="space-y-1.5">
              <label htmlFor="rsvp-notes" className="block text-xs font-medium text-slate-200">
                {selectedStatus === 'attending'
                  ? 'Catatan untuk Panitia (Opsional)'
                  : selectedStatus === 'permission'
                  ? 'Alasan Izin (Wajib dicatat)'
                  : 'Keterangan Sakit (Opsional)'}
              </label>
              <textarea
                id="rsvp-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  selectedStatus === 'attending'
                    ? 'Contoh: Hadir tepat waktu membawa laptop...'
                    : selectedStatus === 'permission'
                    ? 'Contoh: Menghadiri dinas luar MGMP / pelatihan dinas di Solo...'
                    : 'Contoh: Rawat inap / istirahat dokter...'
                }
                className="w-full bg-[#031e21] border border-[#0f4950] rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors resize-none"
              />
            </div>

            {feedbackMessage && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{feedbackMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold text-sm shadow-xl shadow-teal-950/60 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Menyimpan Konfirmasi...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Kirim Konfirmasi Kehadiran</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Direct WhatsApp Ka TU Contact Card (WhatsApp Emerald Theme) */}
        <section aria-labelledby="contact-heading" className="bg-[#072b2f]/90 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between gap-3 text-left shadow-md">
          <div className="min-w-0">
            <span id="contact-heading" className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
              Kontak Ka TU Sekolah
            </span>
            <p className="text-xs text-white font-semibold">Perlu izin langsung atau konfirmasi khusus?</p>
            <p className="text-[11px] text-slate-300">{schoolProfile.phone || 'Tata Usaha SMP'}</p>
          </div>
          <a
            href={`https://wa.me/${waKaTuTarget}?text=${waKaTuMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0 transition-colors shadow-md shadow-emerald-950/40"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WA Ka TU</span>
          </a>
        </section>

        {/* Footer info & branding attribution (made by Mr Zee here in footer) */}
        <footer className="text-center text-[11px] text-slate-400 space-y-1.5 pt-3 border-t border-teal-900/40">
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
