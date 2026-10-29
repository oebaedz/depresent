import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Share2,
  Download,
  Copy,
  Send,
  Check,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Users,
  Calendar,
  Clock,
  MapPin,
  RefreshCw,
  Image as ImageIcon,
  UserX,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { Meeting, Teacher, Attendance, SchoolProfile } from '../types';
import { invokeWahaNotification } from '../lib/waha';

interface AbsentTeachersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMeeting: Meeting;
  teachers: Teacher[];
  attendances: Attendance[];
  schoolProfile: SchoolProfile;
}

export const AbsentTeachersModal: React.FC<AbsentTeachersModalProps> = ({
  isOpen,
  onClose,
  currentMeeting,
  teachers,
  attendances,
  schoolProfile,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [targetGroup, setTargetGroup] = useState<string>(schoolProfile.waha_group_id || '');
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [isSendingWA, setIsSendingWA] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);

  useEffect(() => {
    if (schoolProfile.waha_group_id && !targetGroup) {
      setTargetGroup(schoolProfile.waha_group_id);
    }
  }, [schoolProfile.waha_group_id, targetGroup]);

  if (!isOpen) return null;

  // Filter participants for this meeting
  const activeTeachers =
    currentMeeting.target_type === 'custom' && currentMeeting.invited_teacher_ids?.length
      ? teachers.filter((t) => currentMeeting.invited_teacher_ids!.includes(t.id))
      : teachers;

  const attendanceMap = new Map<string, Attendance>();
  attendances
    .filter((a) => a.meeting_id === currentMeeting.id)
    .forEach((a) => attendanceMap.set(a.teacher_id, a));

  let hadir = 0;
  let terlambat = 0;
  let izin = 0;
  let sakit = 0;
  let tidakHadirCount = 0;
  const absentTeachers: { teacher: Teacher; notes: string }[] = [];

  activeTeachers.forEach((t) => {
    const att = attendanceMap.get(t.id);
    if (att) {
      if (att.status === 'hadir') hadir++;
      else if (att.status === 'terlambat') terlambat++;
      else if (att.status === 'izin') izin++;
      else if (att.status === 'sakit') sakit++;
      else if (att.status === 'alpa') {
        tidakHadirCount++;
        absentTeachers.push({ teacher: t, notes: att.notes || 'Tanpa Keterangan (Alpa)' });
      }
    } else {
      // If no attendance record
      if (currentMeeting.status === 'completed') {
        tidakHadirCount++;
        absentTeachers.push({ teacher: t, notes: 'Tidak Hadir hingga Rapat Ditutup' });
      } else {
        // Rapat sedang berlangsung / aktif: belum hadir
        tidakHadirCount++;
        absentTeachers.push({ teacher: t, notes: 'Belum Hadir / Belum Presensi' });
      }
    }
  });

  const total = activeTeachers.length;
  const rate = total > 0 ? Math.round(((hadir + terlambat) / total) * 100) : 0;

  const formattedDate = new Date(currentMeeting.meeting_date).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const meetingTime = `${currentMeeting.start_time?.slice(0, 5) || currentMeeting.start_time} - ${currentMeeting.end_time?.slice(0, 5) || currentMeeting.end_time} WIB`;

  // Generate formatted WhatsApp announcement
  const generateWhatsAppMessage = () => {
    let text = `📋 *LAPORAN KEHADIRAN & DAFTAR PEGAWAI TIDAK HADIR*\n`;
    text += `*${schoolProfile.school_name || 'SMP MUHAMMADIYAH 1 GOMBONG'}*\n\n`;
    text += `Agenda: *${currentMeeting.title}*\n`;
    text += `• Hari/Tanggal: ${formattedDate}\n`;
    text += `• Waktu: ${meetingTime}\n`;
    text += `• Ruangan: ${currentMeeting.room}\n`;
    text += `• Pimpinan Rapat: ${currentMeeting.leader_name}\n\n`;

    text += `📊 *REKAPITULASI KEHADIRAN KEDINASAN:*\n`;
    text += `• Total Pegawai Terdaftar: ${total} orang\n`;
    text += `• Hadir Tepat Waktu: ${hadir} orang\n`;
    text += `• Hadir Terlambat: ${terlambat} orang\n`;
    text += `• Izin: ${izin} orang\n`;
    text += `• Sakit: ${sakit} orang\n`;
    text += `• *Tidak Hadir: ${absentTeachers.length} orang*\n`;
    text += `• *Tingkat Kehadiran: ${rate}%*\n\n`;

    if (absentTeachers.length > 0) {
      text += `🚫 *DAFTAR GURU/PEGAWAI TIDAK HADIR:*\n`;
      absentTeachers.forEach((item, i) => {
        text += `${i + 1}. *${item.teacher.name}* (NIY: ${item.teacher.niy || '-'} - ${item.teacher.role_title}) [${item.notes}]\n`;
      });
      text += `\nLaporan ini dicatat secara resmi ke dalam SPJ Daftar Hadir Kegiatan Sekolah.\n\n`;
    } else {
      text += `Alhamdulillah, seluruh guru & pegawai hadir lengkap (Nihil Tidak Hadir).\n\n`;
    }

    text += `Terima kasih atas disiplin dan dedikasi Bapak/Ibu semua.\n_Wassalamu'alaikum Wr. Wb._\n\n`;
    text += `_${schoolProfile.school_name}_\n`;
    text += `_dePresent made by Mr Zee_`;
    return text;
  };

  const recapText = generateWhatsAppMessage();

  // Export card as high-res PNG
  const generateImage = async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    setIsExportingImage(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const dataUrl = canvas.toDataURL('image/png');
      setImageDataUrl(dataUrl);
      setIsExportingImage(false);
      return dataUrl;
    } catch (err) {
      console.error('Failed to generate image:', err);
      setIsExportingImage(false);
      return null;
    }
  };

  // Download image
  const handleDownloadImage = async () => {
    let url = imageDataUrl;
    if (!url) {
      url = await generateImage();
    }
    if (!url) {
      setStatusMessage({ text: 'Gagal membuat gambar infografis.', type: 'error' });
      return;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap-tidak-hadir-${currentMeeting.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setStatusMessage({ text: 'Gambar infografis tidak hadir berhasil diunduh!', type: 'success' });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Copy image to clipboard
  const handleCopyImage = async () => {
    let url = imageDataUrl;
    if (!url) {
      url = await generateImage();
    }
    if (!url) return;

    try {
      const res = await fetch(url);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopiedImage(true);
      setStatusMessage({ text: 'Gambar berhasil disalin ke clipboard! Silakan paste (Ctrl+V) langsung di WhatsApp Web.', type: 'success' });
      setTimeout(() => setCopiedImage(false), 3000);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.warn('Clipboard image write failed:', err);
      setStatusMessage({ text: 'Browser tidak mengizinkan salin gambar langsung. Silakan gunakan tombol Unduh Gambar.', type: 'info' });
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Copy text message
  const handleCopyText = () => {
    navigator.clipboard.writeText(recapText);
    setCopiedText(true);
    setStatusMessage({ text: 'Teks rekap berhasil disalin!', type: 'success' });
    setTimeout(() => setCopiedText(false), 2500);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Send via WAHA to Group
  const handleSendToGroup = async () => {
    const target = targetGroup.trim();
    if (!target) {
      setStatusMessage({ text: 'Masukkan nomor WhatsApp target atau Chat ID grup (misal: 120363xxx@g.us atau 0812xxx)', type: 'error' });
      return;
    }

    setIsSendingWA(true);
    setStatusMessage(null);

    let imgBase64 = imageDataUrl;
    if (!imgBase64) {
      imgBase64 = await generateImage();
    }

    const result = await invokeWahaNotification({
      action: 'absent_recap',
      recipient: target,
      message: recapText,
      image: imgBase64 || undefined,
      filename: `rekap-tidak-hadir-${currentMeeting.id.substring(0, 6)}.png`,
      metadata: {
        meetingId: currentMeeting.id,
        absentCount: absentTeachers.length,
      },
    });

    setIsSendingWA(false);

    if (result.success) {
      setStatusMessage({ text: `Berhasil! Laporan tidak hadir & infografis dikirim ke WhatsApp (${target}).`, type: 'success' });
    } else {
      setStatusMessage({ text: result.message, type: 'error' });
    }
  };

  // Open WhatsApp Web
  const handleOpenWhatsAppWeb = () => {
    const encoded = encodeURIComponent(recapText);
    const cleanTarget = targetGroup.replace(/[^0-9]/g, '');
    const url = cleanTarget
      ? `https://web.whatsapp.com/send?phone=${cleanTarget}&text=${encoded}`
      : `https://web.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-[#072b2f] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 dark:border-[#0f4950] animate-in fade-in duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#0f4950] flex items-center justify-between bg-gradient-to-r from-teal-950 via-[#072b2f] to-rose-950 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-400/30 text-rose-300 flex items-center justify-center shadow-xs">
              <UserX className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Kirim Daftar Tidak Hadir ke Grup WA</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-400/30">
                  {absentTeachers.length} Pegawai
                </span>
              </h3>
              <p className="text-xs text-teal-200/80">
                Ekspor infografis gambar SPJ & kirim rekapitulasi data pegawai tidak hadir ke grup WhatsApp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-teal-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 dark:text-teal-100">
          {/* Target Group & Fast Action Bar */}
          <div className="bg-slate-50 dark:bg-[#031e21] p-4 rounded-xl border border-slate-200 dark:border-[#0f4950] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-teal-200 mb-1">
                  Nomor WA / Chat ID Grup Target:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={targetGroup}
                    onChange={(e) => setTargetGroup(e.target.value)}
                    placeholder="Contoh: 120363024823924@g.us atau 08123456789"
                    className="w-full bg-white dark:bg-[#072b2f] border border-slate-300 dark:border-[#0f4950] rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-teal-300/70 mt-1">
                  Masukkan ID grup WhatsApp (akhiran <code>@g.us</code>) atau nomor pengurus kegiatan.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap sm:self-end">
                <button
                  type="button"
                  onClick={handleSendToGroup}
                  disabled={isSendingWA || !targetGroup.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 via-rose-700 to-teal-800 hover:from-rose-500 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-rose-950/40 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSendingWA ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{isSendingWA ? 'Mengirim...' : 'Kirim ke Grup WA'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenWhatsAppWeb}
                  className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Buka di WhatsApp Web"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka WA Web</span>
                </button>
              </div>
            </div>

            {/* Status message */}
            {statusMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : statusMessage.type === 'error'
                    ? 'bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300'
                    : 'bg-sky-500/15 border border-sky-500/30 text-sky-700 dark:text-sky-300'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}
          </div>

          {/* Quick Toolbar: Download Image & Copy Text */}
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-200 dark:border-[#0f4950] pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-white flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Pratinjau Infografis Gambar (Ekspor Gambar)</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={isExportingImage}
                className="px-3 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isExportingImage ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>Unduh Gambar (.PNG)</span>
              </button>

              <button
                type="button"
                onClick={handleCopyImage}
                disabled={isExportingImage}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#072b2f] hover:bg-slate-100 dark:hover:bg-[#0b383d] text-slate-800 dark:text-teal-100 border border-slate-300 dark:border-[#0f4950] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Salin Gambar agar bisa langsung Paste (Ctrl+V) di WA Web"
              >
                {copiedImage ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedImage ? 'Tersalin!' : 'Salin Gambar'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyText}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#072b2f] hover:bg-slate-100 dark:hover:bg-[#0b383d] text-slate-800 dark:text-teal-100 border border-slate-300 dark:border-[#0f4950] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText ? 'Tersalin!' : 'Salin Teks WA'}</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* THE INFOGRAPHIC CARD (THIS NODE WILL BE CAPTURED BY html2canvas AS IMAGE)  */}
          {/* ========================================================================= */}
          <div className="overflow-x-auto pb-2 flex justify-center">
            <div
              ref={cardRef}
              id="absent-teachers-infographic"
              className="w-[720px] bg-white text-slate-900 p-7 rounded-2xl border-2 border-slate-300 shadow-xl font-sans space-y-5 shrink-0"
              style={{ minWidth: '720px' }}
            >
              {/* Header Kop Resmi */}
              <div className="flex items-center gap-4 border-b-2 border-rose-900 pb-4">
                {schoolProfile.logo_url ? (
                  <img
                    src={schoolProfile.logo_url}
                    alt="Logo Sekolah"
                    className="w-16 h-16 object-contain shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-teal-800 text-white font-bold flex items-center justify-center text-xl shrink-0">
                    dP
                  </div>
                )}
                <div className="flex-1 text-center">
                  {schoolProfile.foundation_name && (
                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                      {schoolProfile.foundation_name}
                    </h3>
                  )}
                  <h2 className="text-lg font-black uppercase text-slate-900 tracking-tight">
                    {schoolProfile.school_name || 'SMP MUHAMMADIYAH 1 GOMBONG'}
                  </h2>
                  <p className="text-[11px] text-slate-600">
                    {schoolProfile.address || 'Jl. Kauman No. 1, Gombong, Kebumen, Jawa Tengah'}
                  </p>
                </div>
              </div>

              {/* Title Badge */}
              <div className="text-center space-y-1">
                <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300">
                  REKAPITULASI PRESENSI KEDINASAN
                </span>
                <h1 className="text-base font-black text-slate-900 uppercase">
                  LAPORAN & DAFTAR PEGAWAI TIDAK HADIR
                </h1>
                <p className="text-xs font-bold text-teal-800">
                  Agenda: {currentMeeting.title}
                </p>
              </div>

              {/* Agenda Information Bar */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 font-semibold block text-[10px]">Hari / Tanggal</span>
                  <span className="font-bold text-slate-900">{formattedDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block text-[10px]">Waktu & Ruang</span>
                  <span className="font-bold text-slate-900">{meetingTime} • {currentMeeting.room}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block text-[10px]">Pimpinan Rapat</span>
                  <span className="font-bold text-slate-900">{currentMeeting.leader_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block text-[10px]">Persentase Kehadiran</span>
                  <span className="font-bold text-emerald-700 font-mono text-sm">{rate}%</span>
                </div>
              </div>

              {/* 5-Stat Metric Row */}
              <div className="grid grid-cols-5 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-600 uppercase block">Total Peserta</span>
                  <span className="text-lg font-black font-mono text-slate-900">{total}</span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">Hadir Tepat</span>
                  <span className="text-lg font-black font-mono text-emerald-700">{hadir}</span>
                </div>
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-800 uppercase block">Terlambat</span>
                  <span className="text-lg font-black font-mono text-amber-700">{terlambat}</span>
                </div>
                <div className="p-2 rounded-xl bg-sky-50 border border-sky-200">
                  <span className="text-[10px] font-bold text-sky-800 uppercase block">Izin / Sakit</span>
                  <span className="text-lg font-black font-mono text-sky-700">{izin + sakit}</span>
                </div>
                <div className="p-2 rounded-xl bg-rose-50 border border-rose-300">
                  <span className="text-[10px] font-bold text-rose-800 uppercase block">Tidak Hadir</span>
                  <span className="text-lg font-black font-mono text-rose-700">{absentTeachers.length}</span>
                </div>
              </div>

              {/* Absent Teachers Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center justify-between">
                  <span>Daftar Guru / Pegawai Tidak Hadir:</span>
                  <span className="text-[11px] font-semibold text-rose-700">({absentTeachers.length} Orang)</span>
                </h4>

                {absentTeachers.length === 0 ? (
                  <div className="p-6 text-center bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 font-medium text-xs">
                    ✓ Luar biasa! Seluruh guru dan pegawai hadir lengkap (Nihil Tidak Hadir).
                  </div>
                ) : (
                  <table className="w-full text-[11px] border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-center">
                        <th className="py-2 px-2 border border-slate-300 w-10">No</th>
                        <th className="py-2 px-3 border border-slate-300 text-left">Nama Pegawai</th>
                        <th className="py-2 px-3 border border-slate-300 text-left">Jabatan / Mapel</th>
                        <th className="py-2 px-3 border border-slate-300 text-center w-40">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {absentTeachers.map((item, idx) => (
                        <tr key={item.teacher.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                          <td className="py-2 px-2 border border-slate-300 text-center font-mono font-bold text-slate-600">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 border border-slate-300">
                            <div className="font-bold text-slate-900">{item.teacher.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">NIY: {item.teacher.niy || item.teacher.nip || '-'}</div>
                          </td>
                          <td className="py-2 px-3 border border-slate-300 text-slate-700">
                            {item.teacher.role_title}
                          </td>
                          <td className="py-2 px-3 border border-slate-300 text-center">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              {item.notes}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Official SPJ Footnote */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-700 text-[11px] space-y-1">
                <p className="font-bold text-slate-900">Catatan SPJ Dokumen Resmi:</p>
                <p>
                  Data ini disinkronkan langsung dari pemindai QR presensi dan berita acara ketertiban kegiatan kedinasan {schoolProfile.school_name}.
                </p>
              </div>

              {/* Card Footer */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
                <span>Dokumen Resmi SPJ • {schoolProfile.school_name}</span>
                <span className="font-mono">
                  Waktu Cetak/Generate: {new Date().toLocaleDateString('id-ID')} {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
                </span>
              </div>
            </div>
          </div>

          {/* Text Message Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-teal-200 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Format Teks Pesan WhatsApp untuk Grup:</span>
              </label>
              <button
                type="button"
                onClick={handleCopyText}
                className="text-xs font-semibold text-teal-600 dark:text-teal-300 hover:underline cursor-pointer flex items-center gap-1"
              >
                {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText ? 'Tersalin' : 'Salin Teks'}</span>
              </button>
            </div>
            <textarea
              readOnly
              rows={8}
              value={recapText}
              className="w-full bg-slate-50 dark:bg-[#031e21] border border-slate-300 dark:border-[#0f4950] rounded-xl p-3 text-xs font-mono text-slate-800 dark:text-teal-100 leading-relaxed focus:outline-hidden"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-[#0f4950] bg-slate-50 dark:bg-[#031e21] flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-teal-300/70">
            {absentTeachers.length} pegawai tidak hadir dari {total} total peserta ({rate}% kehadiran)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-[#072b2f] dark:hover:bg-[#0b383d] text-slate-800 dark:text-teal-100 text-xs font-semibold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
