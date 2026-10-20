import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Maximize2, Minimize2, Tv, Users, CheckCircle2, Clock, Calendar, MapPin, User, ExternalLink, Smartphone, Copy, Check, RotateCw, ShieldCheck } from 'lucide-react';
import { Attendance, Meeting, Teacher, SchoolProfile } from '../types';
import { recordAttendance } from '../lib/storage';
import { sound } from '../lib/audio';

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

  // Generate Rolling QR Token every 15 seconds
  const generateRollingQr = (meetingObj: Meeting) => {
    if (typeof window === 'undefined') return;
    const timestamp = Date.now();
    // Compact base64 token containing timestamp and meetingId
    const token = btoa(`${meetingObj.id}:${timestamp}`);
    const fullUrl = `${window.location.origin}${window.location.pathname}?checkin=${meetingObj.id}&tok=${token}`;
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
          return ROTATION_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [meeting]);

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

  const presentTeacherIds = new Set(meetingAttendances.map((a) => a.teacher_id));
  const totalTeachers = teachers.length;
  const presentCount = meetingAttendances.length;
  const attendanceRate = totalTeachers > 0 ? Math.round((presentCount / totalTeachers) * 100) : 0;

  // Direct checkin fallback from projector view
  const handleDirectSelfCheckin = async (teacherId: string) => {
    if (!meeting || !teacherId) return;
    const teacher = teachers.find((t) => t.id === teacherId);
    if (!teacher) return;

    sound.playSuccess();
    await recordAttendance({
      meetingId: meeting.id,
      teacherId: teacher.id,
      status: 'hadir',
      method: 'projector_scan',
      notes: 'Presensi via Scan Layar Proyektor',
    });

    setSelfCheckinSuccess(`${teacher.name} berhasil presensi!`);
    setSelectedTeacherForSelfCheckin('');
    onAttendanceRecorded();
    setTimeout(() => setSelfCheckinSuccess(null), 3000);
  };

  const unpresentTeachers = teachers.filter((t) => !presentTeacherIds.has(t.id));

  if (!meeting) {
    return (
      <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-500 space-y-3">
        <Tv className="w-12 h-12 mx-auto text-slate-300 stroke-1" />
        <h3 className="text-base font-bold text-slate-800">Tidak Ada Rapat Aktif</h3>
        <p className="text-xs text-slate-400">Silakan pilih atau aktifkan agenda rapat di menu Agenda Rapat.</p>
      </div>
    );
  }

  // Progress for countdown
  const progressPercent = Math.round((secondsRemaining / ROTATION_INTERVAL_SECONDS) * 100);

  return (
    <div className={`space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-950 p-8 overflow-y-auto' : ''}`}>
      {/* Top Meeting Header Bar */}
      <div className={`p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 ${
        isFullscreen ? 'bg-slate-900 border-slate-800 text-white' : 'bg-blue-950 border-blue-900 text-white'
      }`}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs uppercase font-bold tracking-wider text-blue-200">
              {schoolProfile.foundation_name || schoolProfile.school_name || 'YAYASAN'} · dePresent MODE PROYEKTOR
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white line-clamp-2">
            {meeting.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-blue-100">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-300" />
              <span>{meeting.meeting_date} ({meeting.start_time} - {meeting.end_time} WIB)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-300" />
              <span>{meeting.room}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-300" />
              <span>Pimpinan: {meeting.leader_name}</span>
            </span>
          </div>
        </div>

        {/* Big Live Digital Clock & Fullscreen Toggle */}
        <div className="flex items-center gap-5 shrink-0 self-start md:self-center">
          <div className="text-right">
            <div className="text-2xl md:text-3xl font-black font-mono tracking-tight text-emerald-400 tabular-nums">
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <p className="text-[11px] text-blue-200">
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10"
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
          isFullscreen ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          {/* Header with Anti-Proxy Rotating Badge */}
          <div className="space-y-1.5 w-full">
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>QR Dinamis (Berganti Tiap 15s)</span>
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Arahkan kamera HP Anda langsung ke proyektor di ruangan ini.
            </p>
          </div>

          {/* QR Code Container with 15-Second Countdown Ring */}
          <div className="relative p-4 bg-white rounded-2xl shadow-md border-2 border-slate-200 flex items-center justify-center">
            {qrDataUrl ? (
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
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span className="flex items-center gap-1 text-blue-600 font-semibold">
                <RotateCw className="w-3 h-3 animate-spin" />
                <span>Rotasi Kode</span>
              </span>
              <span className="font-bold text-slate-800 tabular-nums">
                {secondsRemaining} detik
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 pt-0.5">
              Kode QR kadaluarsa otomatis untuk mencegah link dibagikan ke luar ruangan rapat.
            </p>
          </div>

          {/* Direct Link & Copy Helper */}
          <div className="w-full flex items-center justify-center gap-2 text-xs pt-1">
            {onOpenMobileCheckin ? (
              <button
                onClick={() => onOpenMobileCheckin(meeting.id)}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-lg font-medium transition-colors flex items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5 text-blue-700" />
                <span>Buka Form HP</span>
              </button>
            ) : null}

            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors flex items-center gap-1.5"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'Tersalin!' : 'Salin Tautan'}</span>
            </button>
          </div>

          {/* KPI Mini-Bar */}
          <div className="w-full grid grid-cols-2 gap-3 pt-2">
            <div className={`p-3 rounded-xl border text-center ${
              isFullscreen ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className="text-[11px] text-slate-400 block font-medium">Kehadiran</span>
              <span className="text-xl font-bold font-mono text-emerald-600 tabular-nums">
                {presentCount} / {totalTeachers}
              </span>
            </div>

            <div className={`p-3 rounded-xl border text-center ${
              isFullscreen ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className="text-[11px] text-slate-400 block font-medium">Persentase</span>
              <span className="text-xl font-bold font-mono text-blue-600 tabular-nums">
                {attendanceRate}%
              </span>
            </div>
          </div>

          {/* Interactive Check-in Helper */}
          <div className={`w-full p-3 rounded-xl border text-left space-y-2 ${
            isFullscreen ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}>
            <span className="text-[11px] font-semibold text-slate-600 block">
              Bantuan Presensi di Layar (Jika Kamera HP Terkendala):
            </span>
            <div className="flex items-center gap-2">
              <select
                value={selectedTeacherForSelfCheckin}
                onChange={(e) => setSelectedTeacherForSelfCheckin(e.target.value)}
                className="text-xs border border-slate-300 rounded px-2 py-1.5 flex-1 bg-white text-slate-800 truncate"
              >
                <option value="">-- Pilih Nama Guru --</option>
                {unpresentTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.niy || t.nip || '-'})
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleDirectSelfCheckin(selectedTeacherForSelfCheckin)}
                disabled={!selectedTeacherForSelfCheckin}
                className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded text-xs font-medium disabled:opacity-50 transition-colors shrink-0"
              >
                Catat Hadir
              </button>
            </div>
            {selfCheckinSuccess && (
              <p className="text-[11px] text-emerald-600 font-medium">{selfCheckinSuccess}</p>
            )}
          </div>
        </div>

        {/* Right Column: Live Attendance Ticker / Feed */}
        <div className={`lg:col-span-7 p-6 rounded-2xl border shadow-xs space-y-4 flex flex-col ${
          isFullscreen ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between border-b pb-3 border-slate-200">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-bold tracking-wide uppercase">
                Daftar Hadir Real-Time (Live Feed)
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {presentCount} Guru Telah Hadir
            </span>
          </div>

          {/* Attendee Feed Stream */}
          <div className="space-y-2.5 overflow-y-auto max-h-[440px] flex-1 pr-1">
            {meetingAttendances.length === 0 ? (
              <div className="text-center py-16 text-slate-400 space-y-2">
                <Clock className="w-8 h-8 mx-auto text-slate-300 stroke-1 animate-pulse" />
                <p className="text-xs">Menunggu presensi guru pertama...</p>
                <p className="text-[11px] text-slate-400">Nama guru akan langsung muncul di sini begitu QR dipindai.</p>
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
                        ? 'border-emerald-400 bg-emerald-50/70 shadow-xs'
                        : isFullscreen
                        ? 'border-slate-800 bg-slate-800/60'
                        : 'border-slate-100 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`font-bold text-xs truncate ${isFullscreen ? 'text-white' : 'text-slate-900'}`}>
                            {teacher.name}
                          </p>
                          {idx === 0 && (
                            <span className="text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded uppercase shrink-0">
                              Baru Saja
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono">
                          NIY. {teacher.niy || teacher.nip || '-'} · {teacher.role_title}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-mono text-xs font-semibold text-slate-700">
                          {timeStr}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {att.method === 'card_scan' ? 'Scan Kartu' : 'Scan Proyektor'}
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
