import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, CheckCircle2, AlertCircle, Send, Check, HeartPulse, FileEdit, School } from 'lucide-react';
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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Tautan Undangan Tidak Ditemukan</h2>
          <p className="text-sm text-slate-400">
            Agenda rapat atau data penerima undangan tidak valid atau telah dihapus oleh panitia. Silakan hubungi bagian Tata Usaha sekolah.
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                if (typeof window !== 'undefined') window.location.href = window.location.pathname;
              }}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-semibold transition-colors"
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-teal-500 selection:text-white">
      {/* Decorative top ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-xl h-48 bg-teal-600/10 blur-3xl pointer-events-none rounded-full" />

      <main className="w-full max-w-lg space-y-5 relative z-10 my-6">
        {/* Header Branding */}
        <header className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold uppercase tracking-wider">
            <School className="w-3.5 h-3.5" />
            {schoolProfile.school_name || 'SMP Muhammadiyah 1 Gombong'}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Konfirmasi Kehadiran Undangan
          </h1>
          <p className="text-xs text-slate-400">
            Sistem Presensi & Persuratan Resmi <span className="font-semibold text-teal-400">dePresent</span>
          </p>
        </header>

        {/* Meeting Information Card */}
        <section aria-labelledby="meeting-details-heading" className="bg-slate-900/90 backdrop-blur-md border border-teal-900/40 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-950 text-teal-300 border border-teal-800/50 mb-1.5">
                {currentMeeting.category}
              </span>
              <h2 id="meeting-details-heading" className="text-lg font-bold text-white leading-snug">
                {currentMeeting.title}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Calendar className="w-4 h-4 text-teal-400 shrink-0" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Clock className="w-4 h-4 text-teal-400 shrink-0" />
              <span>{currentMeeting.start_time} - {currentMeeting.end_time} WIB</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <MapPin className="w-4 h-4 text-teal-400 shrink-0" />
              <span>{currentMeeting.room}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <User className="w-4 h-4 text-teal-400 shrink-0" />
              <span>Pimpinan: {currentMeeting.leader_name}</span>
            </div>
          </div>

          {currentMeeting.notes && (
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 text-xs text-slate-400">
              <span className="font-semibold text-slate-300 block mb-0.5">Catatan Agenda:</span>
              <p className="whitespace-pre-line">{currentMeeting.notes.split('[ATTENDEES_SYNC:')[0].trim()}</p>
            </div>
          )}
        </section>

        {/* Recipient Teacher Information */}
        <section aria-labelledby="teacher-info-heading" className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 font-bold flex items-center justify-center text-lg shrink-0">
            {currentTeacher.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">Penerima Undangan</span>
            <h2 id="teacher-info-heading" className="text-base font-bold text-white truncate">{currentTeacher.name}</h2>
            <p className="text-xs text-slate-400 truncate">
              NIY: {currentTeacher.niy || '-'} • {currentTeacher.role_title}
            </p>
          </div>
        </section>

        {/* If already submitted and not editing: show confirmation card */}
        {submittedData && !isEditing ? (
          <div className="bg-teal-950/40 border border-teal-500/30 rounded-2xl p-6 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 mx-auto rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <span className="text-xs uppercase font-bold tracking-wider text-teal-400">Status Konfirmasi Terkirim</span>
              <h2 className="text-2xl font-black text-white">
                {submittedData.rsvp_status === 'attending' && 'Akan Hadir'}
                {submittedData.rsvp_status === 'permission' && 'Izin Tidak Hadir'}
                {submittedData.rsvp_status === 'sick' && 'Sakit (Izin Medis)'}
              </h2>
              {submittedData.rsvp_at && (
                <p className="text-xs text-slate-400">
                  Dikonfirmasi pada {new Date(submittedData.rsvp_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} WIB
                </p>
              )}
            </div>

            {submittedData.rsvp_notes && (
              <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800 text-xs text-left">
                <span className="text-slate-400 block font-semibold mb-0.5">Catatan / Alasan:</span>
                <p className="text-slate-200">{submittedData.rsvp_notes}</p>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
              >
                <FileEdit className="w-4 h-4 text-teal-400" />
                Ubah Pilihan Kehadiran
              </button>
              {onDone && (
                <button
                  type="button"
                  onClick={onDone}
                  className="py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors"
                >
                  Selesai
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Confirmation Form */
          <form onSubmit={handleSubmit} className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Pilih Kepastian Kehadiran Anda
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Attending */}
                <button
                  type="button"
                  onClick={() => setSelectedStatus('attending')}
                  className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-center transition-all ${
                    selectedStatus === 'attending'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/50'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedStatus === 'attending' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                    <Check className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <span className="text-xs font-bold">Akan Hadir</span>
                  <span className="text-[10px] text-slate-400">Hadir tepat waktu</span>
                </button>

                {/* Permission */}
                <button
                  type="button"
                  onClick={() => setSelectedStatus('permission')}
                  className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-center transition-all ${
                    selectedStatus === 'permission'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-950/50'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedStatus === 'permission' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                    <AlertCircle className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <span className="text-xs font-bold">Izin Dinas</span>
                  <span className="text-[10px] text-slate-400">Tugas / Keperluan</span>
                </button>

                {/* Sick */}
                <button
                  type="button"
                  onClick={() => setSelectedStatus('sick')}
                  className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-center transition-all ${
                    selectedStatus === 'sick'
                      ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-md shadow-sky-950/50'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedStatus === 'sick' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                    <HeartPulse className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <span className="text-xs font-bold">Sakit</span>
                  <span className="text-[10px] text-slate-400">Istirahat Medis</span>
                </button>
              </div>
            </div>

            {/* Optional Notes / Reason Input */}
            <div className="space-y-1.5">
              <label htmlFor="rsvp-notes" className="block text-xs font-medium text-slate-300">
                {selectedStatus === 'attending'
                  ? 'Catatan untuk Panitia (Opsional)'
                  : selectedStatus === 'permission'
                  ? 'Alasan Izin / Tugas Luar (Wajib dicatat)'
                  : 'Keterangan Sakit (Opsional)'}
              </label>
              <textarea
                id="rsvp-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  selectedStatus === 'attending'
                    ? 'Contoh: Hadir bersama berkas RPP...'
                    : selectedStatus === 'permission'
                    ? 'Contoh: Menghadiri dinas luar MGMP / pelatihan dinas di Solo...'
                    : 'Contoh: Rawat inap / istirahat dokter...'
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-teal-500 transition-colors resize-none"
              />
            </div>

            {feedbackMessage && (
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-teal-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>{feedbackMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-bold text-sm shadow-lg shadow-teal-950/60 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
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

        {/* Footer info */}
        <footer className="text-center text-[11px] text-slate-400 space-y-1 pt-2">
          <p>
            Memerlukan perubahan mendadak? Hubungi Tata Usaha di {schoolProfile.phone || '(0287) 471195'}
          </p>
          <p>© {new Date().getFullYear()} {schoolProfile.school_name} • dePresent Meeting System</p>
        </footer>
      </main>
    </div>
  );
};
