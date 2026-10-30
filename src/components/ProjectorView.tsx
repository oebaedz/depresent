import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Maximize2, Minimize2, Tv, Users, CheckCircle2, Clock, Calendar, MapPin, User, ExternalLink, Smartphone, Copy, Check, RotateCw, ShieldCheck, Lock } from 'lucide-react';
import { Attendance, Meeting, Teacher, SchoolProfile } from '../types';
import { recordAttendance } from '../lib/storage';
import { sound } from '../lib/audio';
import { encodeSupabaseCredentials, getSupabaseCredentials } from '../lib/supabase';

const ROTATION_INTERVAL_SECONDS = 15;

interface ProjectorViewProps {
  meeting: Meeting | undefined;
  teachers: Teacher[];
  attendances: Attendance[];
  schoolProfile: SchoolProfile;
  onAttendanceRecorded: () => void;
  onOpenMobileCheckin?: (meetingId: string) => void;
}

export const ProjectorView: React.FC<ProjectorViewProps> = ({
  meeting,
  teachers,
  attendances,
  schoolProfile,
  onAttendanceRecorded,
  onOpenMobileCheckin,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [checkinUrl, setCheckinUrl] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [selectedTeacherForSelfCheckin, setSelectedTeacherForSelfCheckin] = useState<string>('');
  const [selfCheckinSuccess, setSelfCheckinSuccess] = useState<string | null>(null);

  // Dynamic Rolling QR Timer (15 seconds)
  const [secondsRemaining, setSecondsRemaining] = useState(ROTATION_INTERVAL_SECONDS);

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Generate Rolling QR Token every 15 seconds with embedded Supabase sync token
  const generateRollingQr = (meetingObj: Meeting) => {
    if (typeof window === 'undefined') return;
    const timestamp = Date.now();
    // Compact base64 token containing timestamp and meetingId
    const token = btoa(`${meetingObj.id}:${timestamp}`);

    // Embed public Supabase credentials so mobile phones scanning in Vercel connect instantly
    const creds = getSupabaseCredentials();
    let syncParam = '';
    if (creds.url && creds.anonKey) {
      const encoded = encodeSupabaseCredentials(creds.url, creds.anonKey);
      if (encoded) {
        syncParam = `&sc=${encodeURIComponent(encoded)}`;
      }
    }

    const fullUrl = `${window.location.origin}${window.location.pathname}?checkin=${meetingObj.id}&tok=${token}${syncParam}`;
    setCheckinUrl(fullUrl);

    QRCode.toDataURL(fullUrl, {
      width: 320,
      margin: 1.5,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then(setQrDataUrl)
      .catch(console.error);
  };

  useEffect(() => {
    if (!meeting) return;

    // Initial QR
    generateRollingQr(meeting);
    setSecondsRemaining(ROTATION_INTERVAL_SECONDS);

    // Countdown interval
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          generateRollingQr(meeting);
          onAttendanceRecorded();
          return ROTATION_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [meeting, onAttendanceRecorded]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleCopyLink = () => {
    if (!checkinUrl) return;
    navigator.clipboard.writeText(checkinUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Map attendances to teachers
  const meetingAttendances = attendances
    .filter((a) => a.meeting_id === meeting?.id)
    .sort((a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime());

  // Filter relevant teachers if custom attendees are selected
  const relevantTeachers =
    meeting?.target_type === 'custom' && meeting.invited_teacher_ids && meeting.invited_teacher_ids.length > 0
      ? teachers.filter((t) => meeting.invited_teacher_ids!.includes(t.id))
      : teachers;

  // Separate actual present (hadir / terlambat) from permission/sick (izin / sakit)
  const presentAttendances = meetingAttendances.filter((a) => a.status === 'hadir' || a.status === 'terlambat');
  const izinSakitAttendances = meetingAttendances.filter((a) => a.status === 'izin' || a.status === 'sakit');
  const presentTeacherIds = new Set(presentAttendances.map((a) => a.teacher_id));
  const totalTeachers = relevantTeachers.length;
  const presentCount = presentAttendances.length;
  const izinSakitCount = izinSakitAttendances.length;
  const attendanceRate = totalTeachers > 0 ? Math.round((presentCount / totalTeachers) * 100) : 0;

  // Direct checkin fallback from projector view
  const handleDirectSelfCheckin = async (teacherId: string) => {
    if (!meeting || !teacherId) return;
    if (meeting.is_locked) {
      sound.playWarning();
      return;
    }
    const teacher = relevantTeachers.find((t) => t.id === teacherId);
    if (!teacher) return;

    sound.playSuccess();
    await recordAttendance({
      meetingId: meeting.id,
      teacherId: teacher.id,
      status: 'hadir',
      method: 'manual',
      notes: 'Presensi Manual di Layar',
    });

    setSelfCheckinSuccess(`${teacher.name} berhasil presensi!`);
    setSelectedTeacherForSelfCheckin('');
    onAttendanceRecorded();
    setTimeout(() => setSelfCheckinSuccess(null), 3000);
  };

  const unpresentTeachers = relevantTeachers.filter((t) => !presentTeacherIds.has(t.id));

  if (!meeting) {
    return (
      <div className="bg-white dark:bg-[#072b2f] p-12 rounded-xl border border-slate-200 dark:border-[#0f4950] text-center text-slate-500 dark:text-teal-200/70 space-y-3">
        <Tv className="w-12 h-12 mx-auto text-slate-300 dark:text-teal-600/50 stroke-1" />
        <h3 className="text-base font-bold text-slate-800 dark:text-white">Tidak Ada Rapat Aktif</h3>
        <p className="text-xs text-slate-400 dark:text-teal-300/60">Silakan pilih atau aktifkan agenda rapat di menu Agenda Rapat.</p>
      </div>
    );
  }

  // Progress for countdown
  const progressPercent = Math.round((secondsRemaining / ROTATION_INTERVAL_SECONDS) * 100);

  return (
    <div className={`space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-[#031e21] p-8 overflow-y-auto text-white' : ''}`}>
      {/* Top Meeting Header Bar */}
      <div className={`p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 ${
        isFullscreen ? 'bg-[#072b2f] border-[#0f4950] text-white' : 'bg-teal-950 dark:bg-[#072b2f] border-teal-900 dark:border-[#0f4950] text-white'
      }`}>
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold tracking-wider text-teal-200">
              <span className="uppercase">{schoolProfile.school_name || 'SMP MUHAMMADIYAH 1 KUDUS'}</span> · <span className="font-extrabold normal-case text-white">dePresent</span> MODE PROYEKTOR
            </span>
            {meeting.is_locked && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 flex items-center gap-1 shadow-xs ml-1">
                <Lock className="w-3 h-3" />
                <span>Rapat Terkunci Resmi</span>
              </span>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white line-clamp-2">
            {meeting.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-teal-100">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-300" />
              <span>{meeting.meeting_date} ({meeting.start_time?.slice(0, 5) || meeting.start_time} - {meeting.end_time?.slice(0, 5) || meeting.end_time} WIB)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-teal-300" />
              <span>{meeting.room}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-teal-300" />
              <span>Pimpinan: {meeting.leader_name}</span>
            </span>
          </div>
        </div>

        {/* Big Live Digital Clock & Fullscreen Toggle */}
        <div className="flex items-center gap-5 shrink-0 self-start md:self-center">
          <div className="text-right">
            <div className="text-2xl md:text-3xl font-black font-mono tracking-tight text-teal-300 tabular-nums">
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <p className="text-[11px] text-teal-200">
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-teal-800/50 hover:bg-teal-700 text-white transition-colors border border-teal-700/60"
            title={isFullscreen ? 'Keluar Fullscreen' : 'Mode Layar Penuh (Fullscreen)'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Grid: QR Display with 15s Rolling Countdown (Left) & Real-time Live Ticker Feed (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Big Rolling QR Stage */}
        <div className={`lg:col-span-5 p-6 rounded-2xl border shadow-xs flex flex-col items-center justify-center text-center space-y-4 ${
          isFullscreen ? 'bg-[#072b2f] border-[#0f4950] text-white' : 'bg-white dark:bg-[#072b2f] border-slate-200 dark:border-[#0f4950] text-slate-900 dark:text-teal-50'
        }`}>
          {/* Header */}
          <div className="space-y-1.5 w-full">
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-[#042024] px-2.5 py-1 rounded-md flex items-center gap-1.5 border border-teal-200/60 dark:border-[#0f4950]">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>{meeting.is_locked ? 'Status Rapat Terkunci' : 'QR Dinamis (Berganti Tiap 15s)'}</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-teal-200/70">
              {meeting.is_locked ? 'Presensi mandiri telah ditutup resmi.' : 'Arahkan kamera HP Anda langsung ke proyektor di ruangan ini.'}
            </p>
          </div>

          {/* QR Code Container with 15-Second Countdown Ring */}
          <div className="relative p-4 bg-white rounded-2xl shadow-md border-2 border-teal-800/20 dark:border-teal-500/30 flex items-center justify-center">
            {meeting.is_locked ? (
              <div className="w-60 h-60 flex flex-col items-center justify-center p-4 bg-amber-50 border border-amber-300 rounded-xl text-center space-y-2">
                <Lock className="w-12 h-12 text-amber-600 mx-auto" />
                <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                  Presensi Ditutup
                </span>
                <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
                  Agenda rapat ini telah disahkan dan terkunci resmi dengan tanda tangan digital kedinasan.
                </p>
              </div>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code Presensi Rapat"
                className="w-60 h-60 object-contain rounded-lg transition-opacity duration-300"
              />
            ) : (
              <div className="w-60 h-60 flex items-center justify-center text-xs text-slate-400">
                Menghasilkan QR...
              </div>
            )}
          </div>

          {/* 15-Second Progress Bar & Countdown Indicator */}
          <div className="w-full max-w-[280px] space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-teal-300">
              <span className="flex items-center gap-1 text-teal-600 dark:text-teal-300 font-semibold">
                <RotateCw className="w-3 h-3 animate-spin" />
                <span>Rotasi Kode</span>
              </span>
              <span className="font-bold text-slate-800 dark:text-white tabular-nums">
                {secondsRemaining} detik
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-[#042024] h-2 rounded-full overflow-hidden">
              <div
                className="bg-teal-600 dark:bg-teal-400 h-full rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 dark:text-teal-300/60 pt-0.5">
              Kode QR berganti secara berkala untuk menjaga kebaruan sesi presensi.
            </p>
          </div>

          {/* Direct Link & Copy Helper */}
          <div className="w-full flex items-center justify-center gap-2 text-xs pt-1">
            {onOpenMobileCheckin ? (
              <button
                onClick={() => onOpenMobileCheckin(meeting.id)}
                className="px-3 py-1.5 bg-teal-50 dark:bg-[#042024] hover:bg-teal-100 dark:hover:bg-[#0b383d] text-teal-800 dark:text-teal-200 border border-teal-200/60 dark:border-[#0f4950] rounded-lg font-medium transition-colors flex items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5 text-teal-600 dark:text-teal-300" />
                <span>Buka Form HP</span>
              </button>
            ) : null}

            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 bg-slate-100 dark:bg-[#042024] hover:bg-slate-200 dark:hover:bg-[#0b383d] text-slate-700 dark:text-teal-200 border border-slate-200 dark:border-[#0f4950] rounded-lg font-medium transition-colors flex items-center gap-1.5"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'Tersalin!' : 'Salin Tautan'}</span>
            </button>
          </div>

          {/* KPI Mini-Bar */}
          <div className="w-full grid grid-cols-2 gap-3 pt-2">
            <div className={`p-3 rounded-xl border text-center ${
              isFullscreen ? 'bg-[#042024] border-[#0f4950]' : 'bg-slate-50 dark:bg-[#042024] border-slate-200 dark:border-[#0f4950]'
            }`}>
              <span className="text-[11px] text-slate-500 dark:text-teal-200 block font-semibold">Guru Hadir</span>
              <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                {presentCount} / {totalTeachers}
              </span>
              {izinSakitCount > 0 && (
                <span className="text-[10px] text-amber-700 dark:text-amber-300 block font-semibold mt-0.5">
                  ({izinSakitCount} Izin / Sakit)
                </span>
              )}
            </div>

            <div className={`p-3 rounded-xl border text-center ${
              isFullscreen ? 'bg-[#042024] border-[#0f4950]' : 'bg-slate-50 dark:bg-[#042024] border-slate-200 dark:border-[#0f4950]'
            }`}>
              <span className="text-[11px] text-slate-500 dark:text-teal-200 block font-semibold">Persentase Hadir</span>
              <span className="text-xl font-bold font-mono text-teal-700 dark:text-teal-300 tabular-nums">
                {attendanceRate}%
              </span>
            </div>
          </div>

          {/* Interactive Check-in Helper */}
          <div className={`w-full p-3 rounded-xl border text-left space-y-2 ${
            isFullscreen ? 'bg-[#042024] border-[#0f4950]' : 'bg-slate-50 dark:bg-[#042024] border-slate-200 dark:border-[#0f4950]'
          }`}>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-teal-100 block">
              Bantuan Presensi di Layar (Jika Kamera HP Terkendala):
            </span>
            <div className="flex items-center gap-2">
              <select
                value={selectedTeacherForSelfCheckin}
                onChange={(e) => setSelectedTeacherForSelfCheckin(e.target.value)}
                className="text-xs border border-slate-300 dark:border-[#0f4950] rounded px-2 py-1.5 flex-1 bg-white dark:bg-[#072b2f] text-slate-900 dark:text-white truncate"
              >
                <option value="" className="text-slate-500 dark:text-teal-300/80">-- Pilih Nama Guru --</option>
                {unpresentTeachers.map((t) => (
                  <option key={t.id} value={t.id} className="dark:bg-[#072b2f]">
                    {t.name} ({t.niy || t.nip || '-'})
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleDirectSelfCheckin(selectedTeacherForSelfCheckin)}
                disabled={!selectedTeacherForSelfCheckin}
                className="px-3 py-1.5 bg-teal-800 hover:bg-teal-700 text-white rounded text-xs font-semibold disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
              >
                Catat Hadir
              </button>
            </div>
            {selfCheckinSuccess && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{selfCheckinSuccess}</p>
            )}
          </div>
        </div>

        {/* Right Column: Live Attendance Ticker / Feed */}
        <div className={`lg:col-span-7 p-6 rounded-2xl border shadow-xs space-y-4 flex flex-col ${
          isFullscreen ? 'bg-[#072b2f] border-[#0f4950] text-white' : 'bg-white dark:bg-[#072b2f] border-slate-200 dark:border-[#0f4950] text-slate-900 dark:text-white'
        }`}>
          <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-[#0f4950] flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-600 dark:text-teal-300" />
              <h3 className="text-sm font-bold tracking-wide uppercase">
                Daftar Hadir Real-Time (Live Feed)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-teal-900 dark:text-teal-100 bg-teal-100/90 dark:bg-[#042024] px-2.5 py-1 rounded-md border border-teal-300/80 dark:border-[#0f4950]">
                {presentCount} Guru Telah Hadir
              </span>
              {izinSakitCount > 0 && (
                <span className="text-xs font-mono font-semibold text-amber-900 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/70 px-2 py-1 rounded-md border border-amber-300/80 dark:border-amber-800">
                  {izinSakitCount} Izin / Sakit
                </span>
              )}
            </div>
          </div>

          {/* Attendee Feed Stream */}
          <div className="space-y-2.5 overflow-y-auto max-h-[440px] flex-1 pr-1">
            {meetingAttendances.length === 0 ? (
              <div className="text-center py-16 text-slate-400 dark:text-teal-300/60 space-y-2">
                <Clock className="w-8 h-8 mx-auto text-slate-300 dark:text-teal-600/50 stroke-1 animate-pulse" />
                <p className="text-xs">Menunggu presensi guru pertama...</p>
                <p className="text-[11px] text-slate-400 dark:text-teal-300/50">Nama guru akan langsung muncul di sini begitu QR dipindai.</p>
              </div>
            ) : (
              meetingAttendances.map((att, idx) => {
                const teacher = teachers.find((t) => t.id === att.teacher_id);
                if (!teacher) return null;
                const timeStr = new Date(att.check_in_time).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <div
                    key={att.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      idx === 0
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-xs'
                        : isFullscreen
                        ? 'border-[#0f4950] bg-[#042024]/80'
                        : 'border-slate-100 dark:border-[#0f4950]/60 bg-slate-50 dark:bg-[#042024]/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      <div className="w-8 h-8 rounded-lg bg-teal-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`font-bold text-xs truncate ${isFullscreen ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                            {teacher.name}
                          </p>
                          {idx === 0 && (
                            <span className="text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded uppercase shrink-0">
                              Baru Saja
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-teal-200/70 font-mono">
                          NIY. {teacher.niy || teacher.nip || '-'} · {teacher.role_title}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        {att.status === 'izin' ? (
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded">
                            Izin
                          </span>
                        ) : att.status === 'sakit' ? (
                          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded">
                            Sakit
                          </span>
                        ) : att.status === 'alpa' ? (
                          <span className="text-[10px] font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/70 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded">
                            Tidak Hadir
                          </span>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="font-mono text-xs font-semibold text-slate-700 dark:text-teal-200">
                              {timeStr}
                            </span>
                          </>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-teal-300/60">
                        {att.method === 'card_scan'
                          ? 'Scan Kartu'
                          : att.method === 'manual'
                          ? 'Manual'
                          : 'Scan Layar'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
