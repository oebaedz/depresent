import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, CheckCircle2, Clock, UserCheck, AlertCircle, Volume2, Search, Smartphone, ShieldCheck, Zap } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { AttendanceStatus, Meeting, Teacher } from '../types';
import { recordAttendance } from '../lib/storage';
import { sound } from '../lib/audio';
import { getWahaConfig, invokeWahaNotification } from '../lib/waha';

interface ScannerViewProps {
  meetings: Meeting[];
  teachers: Teacher[];
  onAttendanceRecorded: () => void;
}

export const ScannerView: React.FC<ScannerViewProps> = ({ meetings, teachers, onAttendanceRecorded }) => {
  // Find current active meeting
  const activeMeetings = meetings.filter((m) => m.status === 'active');
  const defaultMeeting = activeMeetings.length > 0 ? activeMeetings[0] : meetings[0];
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(defaultMeeting?.id || '');

  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Success modal/card for last scanned teacher
  const [lastScanned, setLastScanned] = useState<{
    teacher: Teacher;
    status: AttendanceStatus;
    time: string;
    waStatus?: string;
  } | null>(null);

  // Manual fallback search
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedTimeRef = useRef<{ [ptkId: string]: number }>({});

  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId) || defaultMeeting;

  // Enumerate cameras
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back camera if available, or first camera
          const backCam = devices.find((d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('belakang'));
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        }
      })
      .catch((err) => {
        console.warn('Could not enumerate cameras:', err);
      });

    return () => {
      stopScanner();
    };
  }, []);

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
    }
    setIsScanning(false);
  };

  const processAttendance = useCallback(async (teacher: Teacher, method: 'card_scan' | 'manual') => {
    if (!selectedMeeting) return;
    setIsRecording(true);

    // Verify attendee invitation if target_type is custom
    if (selectedMeeting.target_type === 'custom' && selectedMeeting.invited_teacher_ids && selectedMeeting.invited_teacher_ids.length > 0) {
      if (!selectedMeeting.invited_teacher_ids.includes(teacher.id)) {
        sound.playWarning();
        setCameraError(`${teacher.name} bukan peserta yang diundang pada agenda "${selectedMeeting.title}".`);
        setTimeout(() => setCameraError(null), 4000);
        setIsRecording(false);
        return;
      }
    }

    // Calculate status (Hadir vs Terlambat)
    // Meeting start_time is "HH:mm" (e.g. "08:00")
    let status: AttendanceStatus = 'hadir';
    const now = new Date();
    const [startH, startM] = selectedMeeting.start_time.split(':').map(Number);
    const meetingStartDate = new Date(now);
    meetingStartDate.setHours(startH, startM, 0, 0);

    const toleranceMs = (selectedMeeting.tolerance_minutes || 15) * 60 * 1000;
    const deadlineMs = meetingStartDate.getTime() + toleranceMs;

    if (now.getTime() > deadlineMs) {
      status = 'terlambat';
    }

    // Play synthetic chime
    sound.playSuccess();

    // Record attendance
    const { attendance } = await recordAttendance({
      meetingId: selectedMeeting.id,
      teacherId: teacher.id,
      status,
      method,
      notes: status === 'terlambat' ? `Terlambat (${now.toLocaleTimeString('id-ID')})` : 'Tepat Waktu',
    });

    const timeStr = new Date(attendance.check_in_time).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setLastScanned({
      teacher,
      status,
      time: timeStr,
      waStatus: 'Mengirim...',
    });

    onAttendanceRecorded();
    setIsRecording(false);

    // Trigger WAHA notification if configured
    const wahaConfig = getWahaConfig();
    if (wahaConfig.is_enabled && wahaConfig.auto_notify_on_scan && teacher.phone_wa) {
      const message = wahaConfig.message_template_scan
        .replace('{nama}', teacher.name)
        .replace('{rapat}', selectedMeeting.title)
        .replace('{jam}', timeStr)
        .replace('{status}', status === 'hadir' ? 'Hadir Tepat Waktu' : 'Hadir Terlambat');

      invokeWahaNotification({
        action: 'check_in_confirmation',
        recipient: teacher.phone_wa,
        message,
        metadata: {
          meeting_id: selectedMeeting.id,
          teacher_id: teacher.id,
        },
      }).then((res) => {
        setLastScanned((prev) =>
          prev
            ? {
                ...prev,
                waStatus: res.success ? 'Terkirim via WhatsApp' : `Gagal WA: ${res.message}`,
              }
            : null
        );
      });
    } else {
      setLastScanned((prev) =>
        prev
          ? {
              ...prev,
              waStatus: !wahaConfig.is_enabled
                ? 'WA dinonaktifkan'
                : !teacher.phone_wa
                ? 'No. WA guru kosong'
                : 'Auto-WA scan mati',
            }
          : null
      );
    }
  }, [selectedMeeting, onAttendanceRecorded]);

  // Handle scanned QR string
  const handleQrDecoded = useCallback((decodedText: string) => {
    // ID Card QR code contains purely the raw ptk_id UUID (e.g. "225b36db-f768-461f-b6d2-b3c399e06113")
    const cleanToken = decodedText.trim().replace(/^["']|["']$/g, '');
    if (!cleanToken) return;

    // Throttle duplicate scan for the same token within 3 seconds
    const lastScan = lastScannedTimeRef.current[cleanToken] || 0;
    if (Date.now() - lastScan < 3000) {
      return;
    }
    lastScannedTimeRef.current[cleanToken] = Date.now();

    // Match against teachers by ptk_id
    const matched = teachers.find(
      (t) =>
        t.ptk_id.trim().toLowerCase() === cleanToken.toLowerCase() ||
        (t.niy && t.niy.replace(/\s+/g, '') === cleanToken.replace(/\s+/g, '')) ||
        (t.nip && t.nip.replace(/\s+/g, '') === cleanToken.replace(/\s+/g, '')) ||
        t.id === cleanToken
    );

    if (matched) {
      processAttendance(matched, 'card_scan');
    } else {
      sound.playWarning();
      setCameraError(`QR Code "${cleanToken}" tidak cocok dengan data ptk_id guru di sistem.`);
      setTimeout(() => setCameraError(null), 4000);
    }
  }, [teachers, processAttendance]);

  const startScanner = async () => {
    setCameraError(null);
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-reader-container');
      }

      const cameraId = selectedCameraId || (cameras.length > 0 ? cameras[0].id : undefined);

      await html5QrCodeRef.current.start(
        cameraId ? { deviceId: { exact: cameraId } } : { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleQrDecoded(decodedText);
        },
        () => {
          // Ignore non-matching frame parsing noise
        }
      );

      setIsScanning(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Camera start failed:', err);
      setCameraError(`Tidak dapat mengakses kamera: ${msg}. Pastikan izin kamera telah diberikan di browser.`);
      setIsScanning(false);
    }
  };

  // Filter teachers for manual search based on meeting participants
  const eligibleTeachers =
    selectedMeeting?.target_type === 'custom' && selectedMeeting.invited_teacher_ids?.length
      ? teachers.filter((t) => selectedMeeting.invited_teacher_ids!.includes(t.id))
      : teachers;

  const filteredTeachers = searchQuery.trim()
    ? eligibleTeachers.filter((t) => {
        const q = searchQuery.toLowerCase();
        const niyVal = (t.niy || t.nip || '').toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          niyVal.includes(q) ||
          t.role_title.toLowerCase().includes(q)
        );
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Top Banner & Meeting Selector */}
      <div className="bg-white dark:bg-[#072b2f] p-5 rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-ping" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Pemindai QR Panitia (Scan Kartu Guru)</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-teal-200/80 mt-0.5">
            Arahkan kamera ke QR Code pada ID Card guru untuk mencatat kehadiran seketika.
          </p>
        </div>

        {/* Selected Meeting */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full md:w-auto">
          <label className="text-xs font-semibold text-slate-600 dark:text-teal-100 shrink-0">Agenda Rapat:</label>
          <select
            value={selectedMeetingId}
            onChange={(e) => setSelectedMeetingId(e.target.value)}
            className="text-xs font-medium border border-slate-300 dark:border-[#0f4950] rounded-lg px-3 py-1.5 bg-slate-50 dark:bg-[#031e21] text-slate-800 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden w-full sm:w-auto sm:max-w-xs truncate min-w-0"
          >
            {meetings.map((m) => (
              <option key={m.id} value={m.id} className="bg-white dark:bg-[#072b2f] text-slate-900 dark:text-white">
                {m.title} ({m.meeting_date}) [{m.status === 'active' ? 'AKTIF' : m.status}] {m.target_type === 'custom' ? `(${m.invited_teacher_ids?.length || 0} Undangan)` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Camera Scanner (Left) & Live Confirmation Card / Manual Search (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Camera Viewport */}
        <div className="lg:col-span-7 bg-white dark:bg-[#072b2f] p-6 rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-teal-800 dark:text-teal-300" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Jendela Pemindai Kamera</h3>
            </div>

            {/* Camera Selector */}
            {cameras.length > 1 && (
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  setSelectedCameraId(e.target.value);
                  if (isScanning) {
                    stopScanner().then(() => startScanner());
                  }
                }}
                className="text-xs border border-slate-300 dark:border-slate-700 rounded px-2 py-1 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 max-w-[180px] truncate"
              >
                {cameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label || `Kamera ${cam.id.substring(0, 4)}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Scanner Viewport */}
          <div className="relative rounded-lg overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center min-h-[340px]">
            <div id="qr-reader-container" className="w-full h-full max-w-sm" />

            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/90 text-white space-y-3 z-10">
                <div className="w-14 h-14 rounded-full bg-teal-900/40 border border-teal-500/40 flex items-center justify-center text-teal-400">
                  <Camera className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Kamera Belum Aktif</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Klik tombol di bawah untuk mengaktifkan kamera laptop atau webcam panitia.
                  </p>
                </div>
                <button
                  onClick={startScanner}
                  className="px-5 py-2.5 bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold rounded-lg transition-colors shadow-md flex items-center gap-2"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>Aktifkan Kamera Pemindai</span>
                </button>
              </div>
            )}

            {isScanning && (
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
                <div className="bg-slate-900/80 backdrop-blur-xs text-white px-3 py-1 rounded text-[11px] font-mono flex items-center gap-1.5 border border-slate-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Memindai...</span>
                </div>
                <button
                  onClick={stopScanner}
                  className="pointer-events-auto bg-slate-900/80 hover:bg-slate-800 text-white px-3 py-1 rounded text-[11px] border border-slate-700 transition-colors"
                >
                  Matikan Kamera
                </button>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-900 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span className="flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Bunyi audio bip chime aktif saat kartu terdeteksi</span>
            </span>
            <span className="font-mono text-[11px]">Format QR: Kode ptk_id</span>
          </div>
        </div>

        {/* Right Column: Scanned Teacher Confirmation Card & Quick Fallback */}
        <div className="lg:col-span-5 space-y-6">
          {/* Last Scanned Confirmation Card */}
          <div className="bg-white dark:bg-[#072b2f] p-6 rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#0f4950] pb-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Konfirmasi Presensi Terakhir</span>
              </h3>
              {lastScanned && (
                <span className="text-[11px] font-mono text-slate-500 dark:text-teal-300/80">
                  {lastScanned.time} WIB
                </span>
              )}
            </div>

            {lastScanned ? (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                {/* Status Indicator */}
                <div
                  className={`p-3 rounded-lg border flex items-center justify-between ${
                    lastScanned.status === 'hadir'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className={`w-5 h-5 ${
                        lastScanned.status === 'hadir' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                      }`}
                    />
                    <span className="font-bold text-xs uppercase tracking-wide">
                      {lastScanned.status === 'hadir' ? 'Hadir Tepat Waktu' : 'Hadir Terlambat'}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-semibold">{lastScanned.time}</span>
                </div>

                {/* Teacher Profile Summary */}
                <div className="p-4 bg-slate-50 dark:bg-[#042024] rounded-lg border border-slate-200 dark:border-[#0f4950] space-y-2.5">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-teal-900 dark:bg-teal-800 text-white flex items-center justify-center font-bold text-lg shrink-0">
                      {lastScanned.teacher.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-snug">
                        {lastScanned.teacher.name}
                      </h4>
                      <p className="text-xs font-mono text-slate-600 dark:text-teal-300/80 mt-0.5">
                        NIY. {lastScanned.teacher.niy || lastScanned.teacher.nip || '-'}
                      </p>
                      <p className="text-xs text-slate-700 dark:text-teal-100/90 mt-0.5">
                        {lastScanned.teacher.role_title} · {lastScanned.teacher.rank_group}
                      </p>
                    </div>
                  </div>

                  {/* WAHA Status */}
                  <div className="pt-2 border-t border-slate-200 dark:border-[#0f4950] flex items-center justify-between text-[11px] text-slate-600 dark:text-teal-200/80">
                    <span className="flex items-center gap-1 text-teal-700 dark:text-teal-300 font-medium">
                      <Smartphone className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      <span>{lastScanned.waStatus || 'WhatsApp Notif'}</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 dark:text-teal-400/60 truncate max-w-[140px]">
                      ptk_id: {lastScanned.teacher.ptk_id.substring(0, 8)}...
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 dark:text-teal-400/60 space-y-2">
                <Clock className="w-8 h-8 mx-auto text-slate-300 dark:text-teal-600/50 stroke-1" />
                <p className="text-xs text-slate-500 dark:text-teal-200/80">Belum ada kartu guru yang dipindai.</p>
                <p className="text-[11px] text-slate-400 dark:text-teal-400/60">
                  Scan QR ID Card atau gunakan formulir pencarian manual di bawah jika kartu tertinggal.
                </p>
              </div>
            )}
          </div>

          {/* Fallback Manual Check-in */}
          <div className="bg-white dark:bg-[#072b2f] p-6 rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Input Manual (Bila Kartu Tertinggal)</span>
            </h3>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari Nama Guru atau NIY..."
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-[#0f4950] bg-white dark:bg-[#031e21] text-slate-800 dark:text-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-600"
              />
            </div>

            {searchQuery && (
              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-[#0f4950] rounded-lg p-2 bg-slate-50 dark:bg-[#031e21]">
                {filteredTeachers.length === 0 ? (
                  <p className="text-center py-2 text-xs text-slate-400 dark:text-teal-400/60">Tidak ada guru yang cocok.</p>
                ) : (
                  filteredTeachers.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2 bg-white dark:bg-[#072b2f] rounded border border-slate-200 dark:border-[#0f4950] hover:border-teal-400 dark:hover:border-teal-500 text-xs transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">{t.name}</p>
                        <p className="font-mono text-[10px] text-slate-500 dark:text-teal-300/80">NIY. {t.niy || t.nip || '-'}</p>
                      </div>
                      <button
                        onClick={() => processAttendance(t, 'manual')}
                        disabled={isRecording}
                        className="px-2.5 py-1 bg-teal-800 hover:bg-teal-700 text-white rounded text-[11px] font-medium shrink-0 transition-colors shadow-xs cursor-pointer"
                      >
                        Presensi Hadir
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
