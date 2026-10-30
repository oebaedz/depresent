import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  UserCheck,
  Calendar,
  MapPin,
  Search,
  ArrowLeft,
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
  Lock,
  User,
} from 'lucide-react';
import { Meeting, SchoolProfile, Teacher } from '../types';
import { recordAttendance } from '../lib/storage';
import { sound } from '../lib/audio';
import { getWahaConfig, invokeWahaNotification } from '../lib/waha';

interface MobileCheckinViewProps {
  meeting: Meeting | undefined;
  teachers: Teacher[];
  schoolProfile: SchoolProfile;
  onSuccess: () => void;
}

interface DeviceLockInfo {
  teacherId: string;
  teacherName: string;
  teacherNiy: string;
  teacherRole: string;
  checkInTime: string;
  statusText: string;
}

export const MobileCheckinView: React.FC<MobileCheckinViewProps> = ({
  meeting,
  teachers,
  schoolProfile,
  onSuccess,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkinDone, setCheckinDone] = useState<{
    teacher: Teacher;
    time: string;
    status: string;
    waNotice?: string;
  } | null>(null);

  // Validate dynamic 15s token (toleransi 60 detik untuk scan + pilih nama tanpa perlu PIN)
  const [isTokenExpired, setIsTokenExpired] = useState(false);

  // Verifikasi kehadiran mandiri per rapat
  const [existingDeviceLock, setExistingDeviceLock] = useState<DeviceLockInfo | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !meeting) return;

    // 1. Check existing device lock for this specific meeting
    const lockKey = `smp_device_lock_${meeting.id}`;
    const rawLock = localStorage.getItem(lockKey);
    if (rawLock) {
      try {
        const parsed = JSON.parse(rawLock) as DeviceLockInfo;
        setExistingDeviceLock(parsed);
      } catch (e) {
        console.warn('Failed to parse device lock:', e);
      }
    }

    // 2. Check token expiration
    const params = new URLSearchParams(window.location.search);
    const tok = params.get('tok');

    if (tok) {
      try {
        const decoded = atob(tok);
        const parts = decoded.split(':');
        if (parts.length >= 2) {
          const timestamp = Number(parts[1]);
          const ageSeconds = (Date.now() - timestamp) / 1000;
          // QR token valid for up to 60 seconds from moment of generation
          if (ageSeconds > 60) {
            setIsTokenExpired(true);
          }
        }
      } catch (e) {
        console.warn('Failed to parse rolling QR token:', e);
      }
    }
  }, [meeting]);

  if (!meeting) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 text-center">
        <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-md max-w-sm w-full space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-900">Rapat Tidak Ditemukan</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tautan presensi rapat tidak valid, agenda telah ditutup, atau kode QR dinamis telah kedaluwarsa.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Muat Ulang Halaman</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Silakan pindai ulang kode QR dinamis terbaru di layar proyektor atau hubungi panitia di ruangan rapat.
          </p>
        </div>
      </div>
    );
  }

  if (meeting.is_locked) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-[#031e21] flex items-center justify-center p-6 text-center">
        <div className="bg-white dark:bg-[#072b2f] p-7 rounded-2xl border border-amber-300 dark:border-amber-700 shadow-md max-w-sm w-full space-y-4">
          <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-300 dark:border-amber-700 shadow-xs">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
              Dokumen Telah Disahkan
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{meeting.title}</h3>
            <p className="text-xs text-slate-600 dark:text-teal-200/90 leading-relaxed">
              Presensi mandiri telah ditutup secara resmi karena agenda rapat ini telah disahkan dan terkunci dengan QR Code verifikasi resmi.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => (window.location.href = window.location.pathname)}
              className="w-full py-2.5 px-4 bg-teal-800 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <span>Kembali ke Beranda</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  let activeTeachers = teachers.filter((t) => t.is_active);
  const isCustomMeeting =
    meeting.target_type === 'custom' &&
    Array.isArray(meeting.invited_teacher_ids) &&
    meeting.invited_teacher_ids.length > 0;

  if (isCustomMeeting) {
    activeTeachers = activeTeachers.filter((t) => meeting.invited_teacher_ids!.includes(t.id));
  }

  const filteredTeachers = activeTeachers.filter((t) => {
    const q = searchQuery.toLowerCase();
    const niyVal = (t.niy || t.nip || '').toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      niyVal.includes(q) ||
      t.role_title.toLowerCase().includes(q)
    );
  });

  const selectedTeacher = activeTeachers.find((t) => t.id === selectedTeacherId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTokenExpired) return;
    if (!selectedTeacher) return;
    setIsSubmitting(true);

    const now = new Date();
    // Calculate status (Hadir vs Terlambat)
    let status: 'hadir' | 'terlambat' = 'hadir';
    const [startH, startM] = meeting.start_time.split(':').map(Number);
    const deadline = new Date(now);
    deadline.setHours(startH, startM, 0, 0);
    const toleranceMs = (meeting.tolerance_minutes || 15) * 60 * 1000;

    if (now.getTime() > deadline.getTime() + toleranceMs) {
      status = 'terlambat';
    }

    sound.playSuccess();

    await recordAttendance({
      meetingId: meeting.id,
      teacherId: selectedTeacher.id,
      status,
      method: 'projector_scan',
      notes: 'Presensi Mandiri via Scan Layar Proyektor HP',
    });

    const timeStr = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const statusLabel = status === 'hadir' ? 'Hadir Tepat Waktu' : 'Hadir Terlambat';

    // 1. Simpan catatan kehadiran perangkat lokal
    const lockInfo: DeviceLockInfo = {
      teacherId: selectedTeacher.id,
      teacherName: selectedTeacher.name,
      teacherNiy: selectedTeacher.niy || selectedTeacher.nip || '-',
      teacherRole: selectedTeacher.role_title,
      checkInTime: timeStr,
      statusText: statusLabel,
    };
    try {
      localStorage.setItem(`smp_device_lock_${meeting.id}`, JSON.stringify(lockInfo));
    } catch (e) {
      console.warn('Could not store device lock in localStorage:', e);
    }

    // 2. Trigger WAHA notification
    const wahaConfig = getWahaConfig();
    let waNotice = !wahaConfig.is_enabled ? 'Notifikasi WA dinonaktifkan' : !selectedTeacher.phone_wa ? 'No. WA guru belum terdaftar' : '';
    if (wahaConfig.is_enabled && wahaConfig.auto_notify_on_scan && selectedTeacher.phone_wa) {
      const msg = wahaConfig.message_template_scan
        .replace('{nama}', selectedTeacher.name)
        .replace('{rapat}', meeting.title)
        .replace('{jam}', timeStr)
        .replace('{status}', statusLabel);

      const res = await invokeWahaNotification({
        action: 'check_in_confirmation',
        recipient: selectedTeacher.phone_wa,
        message: msg,
        metadata: { meeting_id: meeting.id, teacher_id: selectedTeacher.id },
      });
      waNotice = res.success ? 'Konfirmasi WhatsApp otomatis telah terkirim!' : `Status WA: ${res.message}`;
    }

    setCheckinDone({
      teacher: selectedTeacher,
      time: timeStr,
      status: statusLabel,
      waNotice,
    });

    setIsSubmitting(false);
    onSuccess();
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#031e21] flex flex-col justify-between p-4 sm:p-6 text-slate-800 dark:text-teal-100 antialiased">
      <div className="max-w-md w-full mx-auto space-y-4">
        {/* Top Header */}
        <div className="bg-white dark:bg-[#072b2f] p-5 rounded-2xl border border-slate-200 dark:border-[#0f4950] shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            {schoolProfile.logo_url ? (
              <img
                src={schoolProfile.logo_url}
                alt="Logo"
                className="w-10 h-10 object-contain rounded-xl bg-slate-50 dark:bg-[#031e21] p-1 border border-slate-200 dark:border-[#0f4950]"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-teal-800 text-white font-bold flex items-center justify-center text-base">
                dP
              </div>
            )}
            <div>
              {schoolProfile.foundation_name && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 leading-tight">
                  {schoolProfile.foundation_name}
                </p>
              )}
              <h2 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                {schoolProfile.school_name || 'SMP HARAPAN BANGSA'}
              </h2>
              <span className="text-[10px] font-semibold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-[#031e21] px-2 py-0.5 rounded-md inline-block mt-0.5 border border-teal-200 dark:border-teal-800">
                Presensi Mandiri Guru
              </span>
            </div>
          </div>
        </div>

        {/* Meeting Info Card */}
        <div className="bg-teal-950 dark:bg-[#02181a] text-white p-5 rounded-2xl shadow-sm space-y-2.5 border border-teal-900 dark:border-[#0f4950]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-teal-300">
              Agenda Kegiatan Rapat
            </span>
            {isCustomMeeting && (
              <span className="text-[10px] bg-amber-400 text-teal-950 font-bold px-2 py-0.5 rounded-md">
                Rapat Khusus ({activeTeachers.length} Peserta)
              </span>
            )}
          </div>
          <h3 className="text-base font-bold leading-snug">
            {meeting.title}
          </h3>
          <div className="pt-1 flex flex-wrap items-center gap-3 text-xs text-teal-100">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-teal-400" />
              <span>{meeting.meeting_date} ({meeting.start_time?.slice(0, 5) || meeting.start_time} WIB)</span>
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-teal-400" />
              <span>{meeting.room}</span>
            </span>
          </div>
        </div>

        {/* Expired Token Warning */}
        {isTokenExpired && !existingDeviceLock && !checkinDone && (
          <div className="bg-amber-50 border-2 border-amber-400 p-4 rounded-2xl text-xs text-amber-950 space-y-2.5 animate-in fade-in duration-200 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span className="text-sm">Kode QR Layar Telah Kedaluwarsa</span>
            </div>
            <p className="text-[11px] text-amber-900 leading-relaxed">
              Kode QR berganti otomatis tiap 15 detik untuk memastikan kehadiran nyata di ruangan. Pengisian presensi telah <strong>dikunci</strong>. Silakan arahkan kamera HP Anda kembali ke layar proyektor untuk mendapatkan kode terbaru.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Muat Ulang Halaman</span>
            </button>
          </div>
        )}

        {/* SCREEN CASE 1: PERANGKAT SUDAH TERCATAT PRESENSI UNTUK RAPAT INI */}
        {existingDeviceLock && !checkinDone ? (
          <div className="bg-white dark:bg-[#072b2f] p-6 rounded-2xl border border-slate-200 dark:border-[#0f4950] shadow-sm space-y-5 text-center animate-in zoom-in-95 duration-200">
            <div className="relative mx-auto w-16 h-16">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 rounded-full flex items-center justify-center shadow-xs">
                <Smartphone className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white rounded-full p-1 border-2 border-white dark:border-[#072b2f] shadow-xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950 px-3 py-1 rounded-full inline-block">
                Presensi Berhasil
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-white pt-1">
                Presensi Anda Telah Tercatat
              </h3>
              <p className="text-xs text-slate-500 dark:text-teal-200/70">
                Kehadiran Anda pada agenda rapat ini telah berhasil diverifikasi.
              </p>
            </div>

            {/* Locked Teacher Info Box */}
            <div className="bg-slate-50 dark:bg-[#042024] p-4 rounded-xl border border-slate-200 dark:border-[#0f4950] text-left space-y-2 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-900 dark:bg-teal-800 text-white font-bold flex items-center justify-center shrink-0">
                  {existingDeviceLock.teacherName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-snug">
                    {existingDeviceLock.teacherName}
                  </h4>
                  <p className="text-slate-500 dark:text-teal-300/80 font-mono text-[11px] mt-0.5">
                    NIY. {existingDeviceLock.teacherNiy}
                  </p>
                  <p className="text-slate-600 dark:text-teal-200/90 text-xs">
                    {existingDeviceLock.teacherRole}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-[#0f4950] flex justify-between text-slate-600 dark:text-teal-200 text-[11px]">
                <span>Waktu Presensi:</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">{existingDeviceLock.checkInTime} WIB</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-teal-200 text-[11px]">
                <span>Status:</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">{existingDeviceLock.statusText}</span>
              </div>
            </div>

            <div className="p-3 bg-teal-50 dark:bg-[#031e21] border border-teal-200 dark:border-teal-800 rounded-xl text-[11px] text-teal-950 dark:text-teal-200 text-center leading-relaxed">
              Terima kasih, data kehadiran Anda telah masuk dalam laporan presensi kegiatan.
            </div>
          </div>
        ) : checkinDone ? (
          /* SCREEN CASE 2: SUCCESS JUST SUBMITTED */
          <div className="bg-white dark:bg-[#072b2f] p-6 rounded-2xl border border-slate-200 dark:border-[#0f4950] shadow-sm text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-3 py-1 rounded-full">
                {checkinDone.status}
              </span>
              <h4 className="text-base font-black text-slate-900 dark:text-white pt-2">
                {checkinDone.teacher.name}
              </h4>
              <p className="text-xs font-mono text-slate-500 dark:text-teal-300/80">
                NIY. {checkinDone.teacher.niy || checkinDone.teacher.nip || '-'}
              </p>
              <p className="text-xs text-slate-600 dark:text-teal-200/90">
                {checkinDone.teacher.role_title}
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-[#042024] rounded-xl border border-slate-200 dark:border-[#0f4950] text-xs space-y-1">
              <div className="flex justify-between text-slate-500 dark:text-teal-200/80">
                <span>Waktu Presensi:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{checkinDone.time} WIB</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-teal-200/80">
                <span>Metode:</span>
                <span className="font-semibold text-teal-900 dark:text-teal-300">Scan Layar Proyektor</span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-200 flex items-center justify-center gap-2">
              <Smartphone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{checkinDone.waNotice}</span>
            </div>

            <p className="text-xs text-slate-500 dark:text-teal-200/70">
              Nama Anda telah otomatis tercatat dan tampil di layar proyektor ruang rapat.
            </p>
          </div>
        ) : (
          /* SCREEN CASE 3: ACTIVE SELECTION FORM (FIRST TIME ON THIS PHONE) */
          <form onSubmit={handleSubmit} className="bg-white dark:bg-[#072b2f] p-6 rounded-2xl border border-slate-200 dark:border-[#0f4950] shadow-sm space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                  Cari & Pilih Nama Anda
                </label>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 dark:text-teal-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  disabled={isTokenExpired}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isTokenExpired ? 'Kode QR kadaluarsa — silakan pindai ulang...' : 'Ketik nama guru atau NIY...'}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-[#0f4950] rounded-xl bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden disabled:bg-slate-100 dark:disabled:bg-[#02181a] disabled:text-slate-400 dark:disabled:text-teal-400/50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Teacher Selection List */}
            <div className={`max-h-56 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-[#0f4950] rounded-xl p-2 bg-slate-50 dark:bg-[#031e21] ${isTokenExpired ? 'opacity-50 pointer-events-none' : ''}`}>
              {filteredTeachers.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 dark:text-teal-400/60">
                  {isCustomMeeting
                    ? 'Tidak ada nama yang terdaftar sebagai peserta pada rapat ini.'
                    : 'Tidak ada guru yang cocok dengan kata kunci.'}
                </div>
              ) : (
                filteredTeachers.map((t) => {
                  const isSelected = selectedTeacherId === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => !isTokenExpired && setSelectedTeacherId(t.id)}
                      className={`p-3 rounded-lg border transition-all flex items-center justify-between text-xs ${
                        isTokenExpired
                          ? 'border-slate-200 dark:border-[#0f4950] bg-white dark:bg-[#072b2f] cursor-not-allowed'
                          : isSelected
                          ? 'border-teal-600 dark:border-teal-400 bg-teal-50 dark:bg-[#042024] ring-2 ring-teal-500/30 cursor-pointer'
                          : 'border-slate-200 dark:border-[#0f4950] bg-white dark:bg-[#072b2f] hover:border-teal-300 dark:hover:border-teal-700 cursor-pointer'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className={`font-bold leading-tight ${isSelected ? 'text-teal-950 dark:text-teal-200' : 'text-slate-900 dark:text-white'}`}>
                          {t.name}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-teal-300/80 mt-0.5">
                          NIY. {t.niy || t.nip || '-'} · {t.role_title}
                        </p>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 dark:border-[#0f4950] bg-white dark:bg-[#031e21]'
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="submit"
              disabled={isTokenExpired || !selectedTeacherId || isSubmitting}
              className="w-full py-3 bg-teal-800 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <UserCheck className="w-4 h-4" />
              <span>
                {isTokenExpired
                  ? 'Kode QR Kadaluarsa — Pindai Ulang di Layar'
                  : isSubmitting
                  ? 'Mencatat Kehadiran...'
                  : 'Konfirmasi Kehadiran Saya'}
              </span>
            </button>
          </form>
        )}
      </div>

      <footer className="py-4 text-center text-xs text-slate-400 dark:text-teal-300/70">
        dePresent · Sistem Presensi Kegiatan & Rapat Yayasan
      </footer>
    </div>
  );
};
