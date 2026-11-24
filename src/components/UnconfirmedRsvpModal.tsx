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
  Plus,
} from 'lucide-react';
import { Meeting, Teacher, Invitation, SchoolProfile, WahaGroup } from '../types';
import { invokeWahaNotification } from '../lib/waha';
import { captureElementAsPng } from '../lib/infographicExport';
import { addWahaGroup, getWahaGroups } from '../lib/storage';

interface UnconfirmedRsvpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMeeting: Meeting;
  teachers: Teacher[];
  invitations: Invitation[];
  schoolProfile: SchoolProfile;
  letterNumber?: string;
}

export const UnconfirmedRsvpModal: React.FC<UnconfirmedRsvpModalProps> = ({
  isOpen,
  onClose,
  currentMeeting,
  teachers,
  invitations,
  schoolProfile,
  letterNumber,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);
  const [savedGroups, setSavedGroups] = useState<WahaGroup[]>(() => getWahaGroups(schoolProfile));
  const [targetGroup, setTargetGroup] = useState<string>(() => {
    const groups = getWahaGroups(schoolProfile);
    return groups.find((g) => g.is_default)?.group_id || groups[0]?.group_id || schoolProfile.waha_group_id || '';
  });
  const [showSaveGroupForm, setShowSaveGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [isSendingWA, setIsSendingWA] = useState(false);
  const [isSendingImageOnly, setIsSendingImageOnly] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);

  // Sync group target if schoolProfile changes
  useEffect(() => {
    const groups = getWahaGroups(schoolProfile);
    setSavedGroups(groups);
    if (!targetGroup) {
      const def = groups.find((g) => g.is_default)?.group_id || groups[0]?.group_id || schoolProfile.waha_group_id || '';
      if (def) setTargetGroup(def);
    }
  }, [schoolProfile, targetGroup]);

  useEffect(() => {
    const handleGroupsUpdate = (e: Event) => {
      const custom = e as CustomEvent<WahaGroup[]>;
      if (Array.isArray(custom.detail)) setSavedGroups(custom.detail);
      else setSavedGroups(getWahaGroups(schoolProfile));
    };
    window.addEventListener('smp_waha_groups_updated', handleGroupsUpdate);
    return () => window.removeEventListener('smp_waha_groups_updated', handleGroupsUpdate);
  }, [schoolProfile]);

  const isTargetAlreadySaved = savedGroups.some((g) => g.group_id.trim() === targetGroup.trim());

  const handleSaveNewGroupToDb = async () => {
    const cleanId = targetGroup.trim();
    if (!cleanId) return;
    setIsSavingGroup(true);
    const res = await addWahaGroup(newGroupName.trim() || cleanId, cleanId, savedGroups.length === 0);
    setSavedGroups(res.groups);
    setNewGroupName('');
    setShowSaveGroupForm(false);
    setIsSavingGroup(false);
    setStatusMessage({
      text: res.syncedToDb ? 'Grup berhasil disimpan ke database.' : 'Grup berhasil disimpan ke daftar lokal.',
      type: 'success',
    });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  if (!isOpen) return null;

  // Filter teachers belonging to this meeting
  const eligibleTeachers =
    currentMeeting.target_type === 'custom' && currentMeeting.invited_teacher_ids?.length
      ? teachers.filter((t) => currentMeeting.invited_teacher_ids!.includes(t.id))
      : teachers;

  const meetingInvitationsMap = new Map<string, Invitation>();
  invitations
    .filter((inv) => inv.meeting_id === currentMeeting.id)
    .forEach((inv) => meetingInvitationsMap.set(inv.teacher_id, inv));

  // Count metrics
  let attendingCount = 0;
  let permissionCount = 0;
  let sickCount = 0;
  const unconfirmedTeachers: Teacher[] = [];

  eligibleTeachers.forEach((t) => {
    const inv = meetingInvitationsMap.get(t.id);
    const rsvp = inv?.rsvp_status || 'unconfirmed';
    if (rsvp === 'attending') attendingCount++;
    else if (rsvp === 'permission') permissionCount++;
    else if (rsvp === 'sick') sickCount++;
    else unconfirmedTeachers.push(t);
  });

  const confirmedCount = attendingCount + permissionCount + sickCount;
  const totalCount = eligibleTeachers.length;

  const formattedDate = new Date(currentMeeting.meeting_date).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const meetingTime = `${currentMeeting.start_time?.slice(0, 5) || currentMeeting.start_time} - ${currentMeeting.end_time?.slice(0, 5) || currentMeeting.end_time} WIB`;

  // WhatsApp recap text generator
  const generateWhatsAppMessage = () => {
    const activeLetter = letterNumber?.trim() || currentMeeting.letter_number || '-';
    let text = `📢 *PEMBERITAHUAN: REKAP KONFIRMASI KEHADIRAN (RSVP)*\n`;
    text += `*${schoolProfile.school_name || 'SMP MUHAMMADIYAH 1 GOMBONG'}*\n\n`;
    text += `Agenda: *${currentMeeting.title}*\n`;
    text += `• No. Surat: ${activeLetter}\n`;
    text += `• Hari/Tanggal: ${formattedDate}\n`;
    text += `• Waktu: ${meetingTime}\n`;
    text += `• Ruangan: ${currentMeeting.room}\n`;
    text += `• Pimpinan Rapat: ${currentMeeting.leader_name}\n\n`;

    text += `📊 *REKAPITULASI RSVP SEMENTARA:*\n`;
    text += `• Total Undangan: ${totalCount} orang\n`;
    text += `• Sudah Konfirmasi: ${confirmedCount} orang\n`;
    text += `  - Hadir: ${attendingCount}\n`;
    text += `  - Izin: ${permissionCount}\n`;
    text += `  - Sakit: ${sickCount}\n`;
    text += `• *Belum Konfirmasi: ${unconfirmedTeachers.length} orang*\n\n`;

    if (unconfirmedTeachers.length > 0) {
      text += `⚠️ *DAFTAR GURU/PEGAWAI BELUM KONFIRMASI:*\n`;
      unconfirmedTeachers.forEach((t, i) => {
        text += `${i + 1}. *${t.name}* (${t.role_title})\n`;
      });
      text += `\nMohon Bapak/Ibu yang namanya tercantum di atas untuk segera mengisi tautan RSVP yang telah dikirimkan ke nomor WhatsApp masing-masing demi kelancaran persiapan konsumsi & administrasi rapat.\n\n`;
    } else {
      text += `Alhamdulillah, seluruh guru/pegawai undangan telah lengkap mengonfirmasi kehadiran.\n\n`;
    }

    text += `Terima kasih atas kerja samanya.\n_Wassalamu'alaikum Wr. Wb._\n\n`;
    text += `_Panitia Kegiatan & Tata Usaha_\n`;
    text += `_dePresent made by Mr Zee_`;
    return text;
  };

  const recapText = generateWhatsAppMessage();

  // Download image directly as PNG file (pixel-identical via html-to-image)
  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    setIsExportingImage(true);
    setStatusMessage(null);
    try {
      const { blob } = await captureElementAsPng(cardRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rekap-belum-rsvp-${currentMeeting.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage({ text: 'Gambar infografis berhasil diunduh sesuai desain pratinjau!', type: 'success' });
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error('Failed to download image:', err);
      setStatusMessage({ text: 'Gagal membuat file gambar untuk diunduh. Silakan coba lagi.', type: 'error' });
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setIsExportingImage(false);
    }
  };

  // Copy image to clipboard with seamless fallback
  const handleCopyImage = async () => {
    if (!cardRef.current) return;
    setIsExportingImage(true);
    setStatusMessage(null);
    try {
      const { blob } = await captureElementAsPng(cardRef.current);

      let copiedToClipboard = false;
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          copiedToClipboard = true;
          setCopiedImage(true);
          setStatusMessage({
            text: 'Gambar berhasil disalin ke clipboard! Silakan tempel (Ctrl+V) langsung di WhatsApp Web.',
            type: 'success',
          });
          setTimeout(() => setCopiedImage(false), 3000);
          setTimeout(() => setStatusMessage(null), 4000);
        } catch (clipErr) {
          console.warn('Browser blocked direct image clipboard write:', clipErr);
        }
      }

      if (!copiedToClipboard) {
        navigator.clipboard.writeText(recapText);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rekap-belum-rsvp-${currentMeeting.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setStatusMessage({
          text: 'Teks rekap otomatis disalin & file gambar telah diunduh untuk dilampirkan ke WhatsApp!',
          type: 'info',
        });
        setTimeout(() => setStatusMessage(null), 5000);
      }
    } catch (err) {
      console.error('Failed to copy image:', err);
      navigator.clipboard.writeText(recapText);
      setStatusMessage({ text: 'Teks rekap berhasil disalin ke clipboard.', type: 'info' });
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setIsExportingImage(false);
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

  // Send image + full recap via WAHA without downloading
  const handleSendToGroup = async () => {
    const target = targetGroup.trim();
    if (!target) {
      targetInputRef.current?.focus();
      setStatusMessage({ text: 'Masukkan nomor WhatsApp target atau Chat ID grup (misal: 120363xxx@g.us atau 0812xxx)', type: 'error' });
      return;
    }

    setIsSendingWA(true);
    setStatusMessage(null);

    let imgDataUrl: string | undefined;
    if (cardRef.current) {
      try {
        const exported = await captureElementAsPng(cardRef.current);
        imgDataUrl = exported.dataUrl;
      } catch (err) {
        console.warn('Could not capture infographic PNG before WAHA send:', err);
      }
    }

    const result = await invokeWahaNotification({
      action: 'unconfirmed_rsvp_recap',
      recipient: target,
      message: recapText,
      image: imgDataUrl,
      filename: `rekap-belum-konfirmasi-${currentMeeting.id.substring(0, 6)}.png`,
      metadata: {
        meetingId: currentMeeting.id,
        unconfirmedCount: unconfirmedTeachers.length,
      },
    });

    setIsSendingWA(false);

    if (result.success) {
      const responseType = (result.responseData as { type?: string } | undefined)?.type;
      if (imgDataUrl && responseType === 'text') {
        setStatusMessage({
          text: `Pesan teks terkirim ke ${target}, tetapi GAMBAR tidak terlampir karena Edge Function Anda belum mendukung base64 (masih hanya membaca "url"). Perbarui skrip di menu Integrasi WAHA → Skrip Edge Function.`,
          type: 'error',
        });
      } else {
        setStatusMessage({
          text: imgDataUrl
            ? `Berhasil! Gambar infografis & rekap dikirim langsung via WAHA ke ${target}.`
            : `Berhasil! Rekap dikirim via WAHA ke ${target}.`,
          type: 'success',
        });
      }
    } else {
      setStatusMessage({ text: result.message, type: 'error' });
    }
  };

  // Send infographic PNG directly via WAHA with compact caption (no download needed)
  const handleSendImageOnlyViaWaha = async () => {
    const target = targetGroup.trim();
    if (!target) {
      targetInputRef.current?.focus();
      setStatusMessage({ text: 'Isi terlebih dahulu Nomor WA / Chat ID Grup Target di kolom atas untuk mengirim gambar via WAHA.', type: 'error' });
      return;
    }
    if (!cardRef.current) return;

    setIsSendingImageOnly(true);
    setStatusMessage(null);

    try {
      const { dataUrl } = await captureElementAsPng(cardRef.current);
      const shortCaption = `📢 *Infografis Rekap Konfirmasi Kehadiran (RSVP)*\nAgenda: *${currentMeeting.title}*\nTanggal: ${formattedDate} (${meetingTime})\nBelum Konfirmasi: *${unconfirmedTeachers.length} guru/pegawai*`;

      const result = await invokeWahaNotification({
        action: 'unconfirmed_rsvp_recap',
        recipient: target,
        message: shortCaption,
        image: dataUrl,
        filename: `rekap-belum-konfirmasi-${currentMeeting.id.substring(0, 6)}.png`,
        metadata: {
          meetingId: currentMeeting.id,
          unconfirmedCount: unconfirmedTeachers.length,
          imageOnly: true,
        },
      });

      if (result.success) {
        const responseType = (result.responseData as { type?: string } | undefined)?.type;
        if (responseType === 'text') {
          setStatusMessage({
            text: `Edge Function merespons type "text" — gambar belum terlampir. Silakan update kode Edge Function Supabase Anda dari menu Integrasi WAHA → Skrip Edge Function.`,
            type: 'error',
          });
        } else {
          setStatusMessage({
            text: `Berhasil! Gambar infografis dikirim langsung via WAHA ke ${target} tanpa perlu diunduh.`,
            type: 'success',
          });
        }
      } else {
        setStatusMessage({ text: result.message, type: 'error' });
      }
    } catch (err) {
      console.error('Failed to capture/send image via WAHA:', err);
      setStatusMessage({ text: 'Gagal memproses gambar infografis untuk dikirim via WAHA.', type: 'error' });
    } finally {
      setIsSendingImageOnly(false);
    }
  };

  // Open WhatsApp Web with prefilled message
  const handleOpenWhatsAppWeb = () => {
    const encoded = encodeURIComponent(recapText);
    const cleanTarget = targetGroup.replace(/[^0-9]/g, '');
    const url = cleanTarget
      ? `https://web.whatsapp.com/send?phone=${cleanTarget}&text=${encoded}`
      : `https://web.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-[#072b2f] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 dark:border-[#0f4950] animate-in fade-in duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#0f4950] flex items-center justify-between bg-gradient-to-r from-teal-950 via-[#072b2f] to-indigo-950 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300 flex items-center justify-center shadow-xs">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Kirim Rekap Belum Konfirmasi ke Grup WA</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  {unconfirmedTeachers.length} Guru
                </span>
              </h3>
              <p className="text-xs text-teal-200/80">
                Ekspor infografis gambar resmi & kirim laporan rekapitulasi data ke grup WhatsApp
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
              <div className="flex-1 min-w-0 space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-teal-200">
                  Grup WA / Nomor Target:
                </label>

                {savedGroups.length > 0 && (
                  <select
                    value={isTargetAlreadySaved ? targetGroup.trim() : '__custom__'}
                    onChange={(e) => {
                      if (e.target.value !== '__custom__') {
                        setTargetGroup(e.target.value);
                        setShowSaveGroupForm(false);
                      } else {
                        targetInputRef.current?.focus();
                      }
                    }}
                    className="w-full bg-white dark:bg-[#072b2f] border border-slate-300 dark:border-[#0f4950] rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  >
                    {savedGroups.map((g) => (
                      <option key={g.id} value={g.group_id}>
                        {g.name} ({g.group_id}){g.is_default ? ' • Utama' : ''}
                      </option>
                    ))}
                    <option value="__custom__">+ Input Manual Nomor / Chat ID Lain...</option>
                  </select>
                )}

                <div className="flex items-center gap-2">
                  <input
                    ref={targetInputRef}
                    type="text"
                    value={targetGroup}
                    onChange={(e) => setTargetGroup(e.target.value)}
                    placeholder="Contoh: 120363024823924@g.us atau 08123456789"
                    className="w-full bg-white dark:bg-[#072b2f] border border-slate-300 dark:border-[#0f4950] rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                  {targetGroup.trim() && !isTargetAlreadySaved && !showSaveGroupForm && (
                    <button
                      type="button"
                      onClick={() => setShowSaveGroupForm(true)}
                      className="px-2.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-[11px] font-semibold whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer"
                      title="Simpan grup ini ke Daftar Grup DB"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Simpan DB</span>
                    </button>
                  )}
                </div>

                {showSaveGroupForm && !isTargetAlreadySaved && (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-teal-50 dark:bg-[#042024] border border-teal-200 dark:border-[#0f4950]">
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Nama grup (mis. Grup Pengurus)"
                      className="flex-1 bg-white dark:bg-[#072b2f] border border-slate-300 dark:border-[#0f4950] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={handleSaveNewGroupToDb}
                      disabled={isSavingGroup}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
                    >
                      {isSavingGroup ? 'Simpan...' : 'Simpan'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSaveGroupForm(false)}
                      className="px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-800 dark:text-teal-300 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                )}

                <p className="text-[11px] text-slate-500 dark:text-teal-300/70">
                  Pilih dari daftar grup tersimpan atau masukkan Chat ID grup (akhiran <code>@g.us</code>).
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap sm:self-end">
                <button
                  type="button"
                  onClick={handleSendToGroup}
                  disabled={isSendingWA || isSendingImageOnly || !targetGroup.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSendingWA ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{isSendingWA ? 'Mengirim...' : 'Kirim Gambar & Teks WAHA'}</span>
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
                <ImageIcon className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Pratinjau Infografis Gambar (Ekspor Gambar)</span>
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleSendImageOnlyViaWaha}
                disabled={isSendingImageOnly || isSendingWA || isExportingImage}
                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                title="Langsung kirim gambar infografis ini ke WhatsApp via WAHA tanpa perlu unduh file"
              >
                {isSendingImageOnly ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{isSendingImageOnly ? 'Mengirim Gambar...' : 'Kirim Gambar via WAHA'}</span>
              </button>

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
          {/* THE INFOGRAPHIC CARD (CAPTURED AS PIXEL-IDENTICAL PNG VIA html-to-image)  */}
          {/* ========================================================================= */}
          <div className="overflow-x-auto pb-2 flex justify-center">
            <div
              ref={cardRef}
              id="unconfirmed-rsvp-infographic"
              className="infographic-light-card w-[720px] bg-white text-slate-900 p-7 rounded-2xl border-2 border-slate-300 shadow-xl font-sans space-y-5 shrink-0"
              style={{ minWidth: '720px' }}
            >
              {/* Header Kop Resmi */}
              <div className="flex items-center gap-4 border-b-2 border-teal-800 pb-4">
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
                    <h3 className="text-xs font-bold uppercase tracking-wider text-teal-800">
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
                <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                  REKAPITULASI KONFIRMASI KEHADIRAN (RSVP)
                </span>
                <h1 className="text-base font-black text-slate-900 uppercase">
                  DAFTAR GURU & PEGAWAI BELUM MENGISI KONFIRMASI
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
                  <span className="text-slate-500 font-semibold block text-[10px]">Nomor Surat Dinas</span>
                  <span className="font-mono font-bold text-slate-900">{letterNumber?.trim() || currentMeeting.letter_number || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block text-[10px]">Pimpinan Rapat</span>
                  <span className="font-bold text-slate-900">{currentMeeting.leader_name}</span>
                </div>
              </div>

              {/* 4-Stat Metric Row */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-600 uppercase block">Total Undangan</span>
                  <span className="text-xl font-black font-mono text-slate-900">{totalCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">Akan Hadir</span>
                  <span className="text-xl font-black font-mono text-emerald-700">{attendingCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-800 uppercase block">Izin / Sakit</span>
                  <span className="text-xl font-black font-mono text-amber-700">{permissionCount + sickCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300">
                  <span className="text-[10px] font-bold text-rose-800 uppercase block">Belum Konfirmasi</span>
                  <span className="text-xl font-black font-mono text-rose-700">{unconfirmedTeachers.length}</span>
                </div>
              </div>

              {/* Unconfirmed Teachers Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center justify-between">
                  <span>Daftar Guru / Pegawai yang Belum Konfirmasi:</span>
                  <span className="text-[11px] font-semibold text-rose-700">({unconfirmedTeachers.length} Orang)</span>
                </h4>

                {unconfirmedTeachers.length === 0 ? (
                  <div className="p-6 text-center bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 font-medium text-xs">
                    ✓ Luar biasa! Seluruh guru dan pegawai telah lengkap mengonfirmasi kehadiran.
                  </div>
                ) : (
                  <table className="w-full text-[11px] border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-center">
                        <th className="py-2 px-2 border border-slate-300 w-10">No</th>
                        <th className="py-2 px-3 border border-slate-300 text-left">Nama Pegawai</th>
                        <th className="py-2 px-3 border border-slate-300 text-left">Jabatan / Mata Pelajaran</th>
                        <th className="py-2 px-3 border border-slate-300 text-center w-28">Status RSVP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unconfirmedTeachers.map((teacher, idx) => (
                        <tr key={teacher.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                          <td className="py-2 px-2 border border-slate-300 text-center font-mono font-bold text-slate-600">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 border border-slate-300">
                            <div className="font-bold text-slate-900">{teacher.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">NIY: {teacher.niy || '-'}</div>
                          </td>
                          <td className="py-2 px-3 border border-slate-300 text-slate-700">
                            {teacher.role_title}
                          </td>
                          <td className="py-2 px-3 border border-slate-300 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              Belum Konfirmasi
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Himbauan & Footer info */}
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-950 text-[11px] space-y-1">
                <p className="font-bold">⚠️ Perhatian bagi Bapak/Ibu Pegawai:</p>
                <p>
                  Mohon segera membuka pesan WhatsApp resmi dan mengklik tautan RSVP yang telah dibagikan untuk kepastian konsumsi, presensi digital, serta kelancaran rapat.
                </p>
              </div>

              {/* Card Footer */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
                <span>Diterbitkan oleh Panitia & Tata Usaha • {schoolProfile.school_name}</span>
                <span className="font-mono">
                  Waktu Generate: {new Date().toLocaleDateString('id-ID')} {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
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
            {unconfirmedTeachers.length} guru belum konfirmasi dari {totalCount} total peserta
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
