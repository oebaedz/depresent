import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Mail,
  Send,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Copy,
  Search,
  Check,
  MessageSquare,
  Building2,
  Calendar,
  MapPin,
  User,
  HeartPulse,
  Save,
  Clock,
  RefreshCw,
  BellRing,
  Settings2,
  X,
  FileEdit,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import { Invitation, Meeting, RsvpStatus, SchoolProfile, Teacher, WahaConfig, DocumentSignature, SignerRole } from '../types';
import { sortTeachersStructuralFirst } from '../lib/teacherGroups';
import { ensureMeetingSignatures, getCachedDocumentSignatures, saveBatchInvitations, saveInvitation, saveMeeting, sortMeetingsClosestFirst } from '../lib/storage';
import { DEFAULT_WAHA_CONFIG, getWahaConfig, invokeWahaNotification, saveWahaConfig, fetchMessageTemplatesFromDb } from '../lib/waha';
import { generateUUID, isValidUUID } from '../lib/uuid';
import { UnconfirmedRsvpModal } from './UnconfirmedRsvpModal';
import { DigitalSignatureBadge } from './DigitalSignatureBadge';


interface InvitationsViewProps {
  meetings: Meeting[];
  teachers: Teacher[];
  invitations: Invitation[];
  onRefreshInvitations: () => void;
  schoolProfile: SchoolProfile;
}

export const InvitationsView: React.FC<InvitationsViewProps> = ({
  meetings,
  teachers,
  invitations,
  onRefreshInvitations,
  schoolProfile,
}) => {
  // Urutkan rapat: yang terdekat yang akan dilaksanakan muncul di urutan teratas
  const sortedMeetingsList = useMemo(() => sortMeetingsClosestFirst(meetings), [meetings]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(() => sortedMeetingsList[0]?.id || meetings[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRsvp, setFilterRsvp] = useState<string>('all');
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [isSendingRechatBulk, setIsSendingRechatBulk] = useState(false);
  const [rechatProgress, setRechatProgress] = useState<{ current: number; total: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Sending indicator per teacher row (loading effect)
  const [sendingTeacherId, setSendingTeacherId] = useState<string | null>(null);
  const [sendingType, setSendingType] = useState<'invitation' | 'rechat' | null>(null);

  // Template Editor Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isUnconfirmedModalOpen, setIsUnconfirmedModalOpen] = useState(false);
  const [wahaConfig, setWahaConfig] = useState<WahaConfig>(() => getWahaConfig());

  // Sinkronkan template pesan dari database Supabase saat dimuat
  useEffect(() => {
    fetchMessageTemplatesFromDb()
      .then((cfg) => setWahaConfig(cfg))
      .catch((err) => console.warn('Could not load DB templates:', err));
  }, []);

  // 1 Nomor surat untuk 1 kegiatan (sama untuk seluruh peserta rapat)
  const [letterNumber, setLetterNumber] = useState<string>('421.3/048/SMP.M.1/X/2026');
  const [dispatchDate, setDispatchDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const currentMeeting = meetings.find((m) => m.id === selectedMeetingId) || sortedMeetingsList[0] || meetings[0];

  // Sync letter number from current meeting record or existing invitations of this meeting
  useEffect(() => {
    if (!currentMeeting) return;
    if (currentMeeting.letter_number && currentMeeting.letter_number !== '-') {
      setLetterNumber(currentMeeting.letter_number);
    } else {
      const inv = invitations.find(
        (i) => i.meeting_id === currentMeeting.id && i.letter_number && i.letter_number !== '-'
      );
      if (inv?.letter_number) {
        setLetterNumber(inv.letter_number);
        if (inv.dispatch_date) {
          setDispatchDate(inv.dispatch_date);
        }
      }
    }
  }, [currentMeeting, invitations]);

  // Teachers expected for this meeting (respecting target_type and invited_teacher_ids)
  const meetingTeachers = useMemo(() => {
    if (!currentMeeting) return [];
    const isCustom =
      currentMeeting.target_type === 'custom' &&
      Array.isArray(currentMeeting.invited_teacher_ids) &&
      currentMeeting.invited_teacher_ids.length > 0;

    const filtered = teachers.filter((t) => {
      if (!t.is_active) return false;
      if (isCustom) return currentMeeting.invited_teacher_ids!.includes(t.id);
      return true;
    });

    return sortTeachersStructuralFirst(filtered);
  }, [currentMeeting, teachers]);

  // Digital Signatures state for expedition book
  const [signatures, setSignatures] = useState<DocumentSignature[]>(() => {
    return currentMeeting ? getCachedDocumentSignatures(currentMeeting.id) : [];
  });

  useEffect(() => {
    if (!currentMeeting) return;
    let isMounted = true;
    ensureMeetingSignatures(currentMeeting, schoolProfile, meetingTeachers)
      .then((data) => {
        if (isMounted) setSignatures(data);
      })
      .catch((err) => console.warn(err));
    return () => {
      isMounted = false;
    };
  }, [currentMeeting?.id, schoolProfile.headmaster_name]);


  // Invitations map for current meeting: teacher_id -> Invitation
  const currentMeetingInvitationsMap = useMemo(() => {
    const map = new Map<string, Invitation>();
    if (!currentMeeting) return map;
    invitations
      .filter((inv) => inv.meeting_id === currentMeeting.id)
      .forEach((inv) => map.set(inv.teacher_id, inv));
    return map;
  }, [invitations, currentMeeting]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Metrics (Izin Dinas -> Izin)
  const stats = useMemo(() => {
    const total = meetingTeachers.length;
    let sentCount = 0;
    let attendingCount = 0;
    let permissionCount = 0;
    let sickCount = 0;
    let unconfirmedCount = 0;

    meetingTeachers.forEach((t) => {
      const inv = currentMeetingInvitationsMap.get(t.id);
      if (inv && inv.dispatch_status === 'sent') sentCount++;

      const rsvp = inv?.rsvp_status || 'unconfirmed';
      if (rsvp === 'attending') attendingCount++;
      else if (rsvp === 'permission') permissionCount++;
      else if (rsvp === 'sick') sickCount++;
      else unconfirmedCount++;
    });

    return { total, sentCount, attendingCount, permissionCount, sickCount, unconfirmedCount };
  }, [meetingTeachers, currentMeetingInvitationsMap]);

  // Apply single letter number to all teachers for this meeting and persist in DB
  const handleApplyLetterNumber = async () => {
    if (!currentMeeting || !letterNumber.trim()) return;
    const cleanNum = letterNumber.trim();

    // 1. Persist directly in current meeting record (both localStorage and Supabase DB)
    await saveMeeting({
      ...currentMeeting,
      letter_number: cleanNum,
    });

    // 2. Persist to all invitations for this meeting
    const toSave: Invitation[] = [];
    meetingTeachers.forEach((teacher) => {
      const existing = currentMeetingInvitationsMap.get(teacher.id);

      toSave.push({
        id: isValidUUID(existing?.id || '') ? existing!.id : generateUUID(),
        meeting_id: currentMeeting.id,
        teacher_id: teacher.id,
        letter_number: cleanNum,
        dispatch_date: dispatchDate,
        dispatch_channel: existing?.dispatch_channel || 'whatsapp',
        dispatch_status: existing?.dispatch_status || 'pending',
        sent_at: existing?.sent_at,
        rsvp_status: existing?.rsvp_status || 'unconfirmed',
        rsvp_notes: existing?.rsvp_notes || '',
        rsvp_at: existing?.rsvp_at,
        created_at: existing?.created_at || new Date().toISOString(),
      });
    });

    await saveBatchInvitations(toSave);
    onRefreshInvitations();
    showToast(`Nomor surat "${cleanNum}" berhasil disimpan di database & diterapkan untuk seluruh ${toSave.length} peserta rapat.`);
  };

  // Generate personalized WhatsApp message and RSVP URL
  const getPersonalizedUrl = (teacherId: string) => {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?rsvp=${currentMeeting.id}&t=${teacherId}`;
  };

  const getPersonalizedMessage = (teacher: Teacher) => {
    const rsvpUrl = getPersonalizedUrl(teacher.id);
    const dateFormatted = new Date(currentMeeting.meeting_date).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const activeLetterNum = letterNumber.trim() || '421.3/048/SMP.M.1/X/2026';
    const cfg = getWahaConfig();
    const template = cfg.message_template_invitation || DEFAULT_WAHA_CONFIG.message_template_invitation || '';

    return template
      .replace(/{no_surat}/g, activeLetterNum)
      .replace(/{agenda}/g, currentMeeting.title)
      .replace(/{nama}/g, teacher.name)
      .replace(/{jabatan}/g, teacher.role_title)
      .replace(/{tanggal}/g, dateFormatted)
      .replace(/{jam}/g, `${currentMeeting.start_time.slice(0, 5)} - ${currentMeeting.end_time.slice(0, 5)}`)
      .replace(/{ruang}/g, currentMeeting.room)
      .replace(/{pimpinan}/g, currentMeeting.leader_name)
      .replace(/{link_rsvp}/g, rsvpUrl)
      .replace(/{nama_sekolah}/g, schoolProfile.school_name || 'SMP Muhammadiyah 1 Gombong');
  };

  // Generate personalized Re-Chat follow-up message for unconfirmed teachers
  const getPersonalizedRechatMessage = (teacher: Teacher) => {
    const rsvpUrl = getPersonalizedUrl(teacher.id);
    const dateFormatted = new Date(currentMeeting.meeting_date).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const cfg = getWahaConfig();
    const template = cfg.message_template_rechat || DEFAULT_WAHA_CONFIG.message_template_rechat || '';

    return template
      .replace(/{agenda}/g, currentMeeting.title)
      .replace(/{nama}/g, teacher.name)
      .replace(/{jabatan}/g, teacher.role_title)
      .replace(/{tanggal}/g, dateFormatted)
      .replace(/{jam}/g, `${currentMeeting.start_time.slice(0, 5)} - ${currentMeeting.end_time.slice(0, 5)}`)
      .replace(/{ruang}/g, currentMeeting.room)
      .replace(/{pimpinan}/g, currentMeeting.leader_name)
      .replace(/{link_rsvp}/g, rsvpUrl)
      .replace(/{nama_sekolah}/g, schoolProfile.school_name || 'SMP Muhammadiyah 1 Gombong');
  };

  // Dispatch individual WhatsApp invitation with sending effect
  const handleSendSingleWA = async (teacher: Teacher) => {
    if (!teacher.phone_wa) {
      showToast(`Nomor WhatsApp untuk ${teacher.name} belum terdaftar.`, 'error');
      return;
    }

    setSendingTeacherId(teacher.id);
    setSendingType('invitation');

    try {
      const existing = currentMeetingInvitationsMap.get(teacher.id);
      const activeLetterNum = letterNumber.trim() || '421.3/048/SMP.M.1/X/2026';
      const msg = getPersonalizedMessage(teacher);

      const res = await invokeWahaNotification({
        action: 'invitation_dispatch',
        recipient: teacher.phone_wa,
        message: msg,
        metadata: {
          meetingId: currentMeeting.id,
          teacherId: teacher.id,
          letterNumber: activeLetterNum,
        },
      });

      if (res.success) {
        const updated: Invitation = {
          id: isValidUUID(existing?.id || '') ? existing!.id : generateUUID(),
          meeting_id: currentMeeting.id,
          teacher_id: teacher.id,
          letter_number: activeLetterNum,
          dispatch_date: dispatchDate,
          dispatch_channel: 'whatsapp',
          dispatch_status: 'sent',
          sent_at: new Date().toISOString(),
          rsvp_status: existing?.rsvp_status || 'unconfirmed',
          rsvp_notes: existing?.rsvp_notes || '',
          rsvp_at: existing?.rsvp_at,
          created_at: existing?.created_at || new Date().toISOString(),
        };
        await saveInvitation(updated);
        onRefreshInvitations();
        showToast(`Undangan berhasil dikirimkan ke WhatsApp ${teacher.name}`);
      } else {
        showToast(`Gagal kirim WA ke ${teacher.name}: ${res.message}`, 'error');
      }
    } finally {
      setSendingTeacherId(null);
      setSendingType(null);
    }
  };

  // Re-chat individual teacher who hasn't confirmed RSVP with sending effect
  const handleSendRechatSingle = async (teacher: Teacher) => {
    if (!teacher.phone_wa) {
      showToast(`Nomor WhatsApp untuk ${teacher.name} belum terdaftar.`, 'error');
      return;
    }

    setSendingTeacherId(teacher.id);
    setSendingType('rechat');

    try {
      const msg = getPersonalizedRechatMessage(teacher);

      const res = await invokeWahaNotification({
        action: 'invitation_dispatch',
        recipient: teacher.phone_wa,
        message: msg,
        metadata: {
          meetingId: currentMeeting.id,
          teacherId: teacher.id,
          type: 'rechat_reminder',
        },
      });

      if (res.success) {
        showToast(`Pengingat re-chat RSVP berhasil dikirim ke WhatsApp ${teacher.name}`);
      } else {
        showToast(`Gagal kirim re-chat ke ${teacher.name}: ${res.message}`, 'error');
      }
    } finally {
      setSendingTeacherId(null);
      setSendingType(null);
    }
  };

  // Bulk Re-Chat to all unconfirmed teachers
  const handleSendRechatBulk = async () => {
    const unconfirmedTeachers = meetingTeachers.filter((t) => {
      const inv = currentMeetingInvitationsMap.get(t.id);
      return !inv || inv.rsvp_status === 'unconfirmed';
    });

    if (unconfirmedTeachers.length === 0) {
      showToast('Semua guru dalam rapat ini sudah mengisi konfirmasi kehadiran.', 'info');
      return;
    }

    setIsSendingRechatBulk(true);
    setRechatProgress({ current: 0, total: unconfirmedTeachers.length });

    let successCount = 0;
    for (let i = 0; i < unconfirmedTeachers.length; i++) {
      const teacher = unconfirmedTeachers[i];
      setRechatProgress({ current: i + 1, total: unconfirmedTeachers.length });

      if (teacher.phone_wa) {
        const msg = getPersonalizedRechatMessage(teacher);
        const res = await invokeWahaNotification({
          action: 'invitation_dispatch',
          recipient: teacher.phone_wa,
          message: msg,
          metadata: {
            meetingId: currentMeeting.id,
            teacherId: teacher.id,
            type: 'bulk_rechat',
          },
        });
        if (res.success) {
          successCount++;
        }
      }
      await new Promise((r) => setTimeout(r, 600));
    }

    setIsSendingRechatBulk(false);
    setRechatProgress(null);
    showToast(`Re-Chat selesai! Berhasil mengirim pesan pengingat ke ${successCount} dari ${unconfirmedTeachers.length} guru.`);
  };

  // Bulk dispatch to all unsent teachers
  const handleSendBulkWA = async () => {
    const unsentTeachers = meetingTeachers.filter((t) => {
      const inv = currentMeetingInvitationsMap.get(t.id);
      return !inv || inv.dispatch_status !== 'sent';
    });

    if (unsentTeachers.length === 0) {
      showToast('Semua guru dalam rapat ini sudah menerima undangan.', 'info');
      return;
    }

    setIsSendingBulk(true);
    setBulkProgress({ current: 0, total: unsentTeachers.length });

    let successCount = 0;
    const toSave: Invitation[] = [];
    const activeLetterNum = letterNumber.trim() || '421.3/048/SMP.M.1/X/2026';

    for (let i = 0; i < unsentTeachers.length; i++) {
      const teacher = unsentTeachers[i];
      setBulkProgress({ current: i + 1, total: unsentTeachers.length });

      if (teacher.phone_wa) {
        const existing = currentMeetingInvitationsMap.get(teacher.id);
        const msg = getPersonalizedMessage(teacher);

        const res = await invokeWahaNotification({
          action: 'invitation_dispatch',
          recipient: teacher.phone_wa,
          message: msg,
        });

        if (res.success) {
          successCount++;
          toSave.push({
            id: isValidUUID(existing?.id || '') ? existing!.id : generateUUID(),
            meeting_id: currentMeeting.id,
            teacher_id: teacher.id,
            letter_number: activeLetterNum,
            dispatch_date: dispatchDate,
            dispatch_channel: 'whatsapp',
            dispatch_status: 'sent',
            sent_at: new Date().toISOString(),
            rsvp_status: existing?.rsvp_status || 'unconfirmed',
            rsvp_notes: existing?.rsvp_notes || '',
            rsvp_at: existing?.rsvp_at,
            created_at: existing?.created_at || new Date().toISOString(),
          });
        }
      }
      // Small throttle to avoid flooding
      await new Promise((r) => setTimeout(r, 600));
    }

    if (toSave.length > 0) {
      await saveBatchInvitations(toSave);
      onRefreshInvitations();
    }

    setIsSendingBulk(false);
    setBulkProgress(null);
    showToast(`Pengiriman massal selesai! Berhasil mengirim ${successCount} dari ${unsentTeachers.length} undangan.`);
  };

  // Quick manual RSVP change by panitia/TU
  const handleUpdateRsvpManual = async (teacher: Teacher, newStatus: RsvpStatus) => {
    const existing = currentMeetingInvitationsMap.get(teacher.id);
    const activeLetterNum = letterNumber.trim() || existing?.letter_number || '421.3/048/SMP.M.1/X/2026';

    const updated: Invitation = {
      id: isValidUUID(existing?.id || '') ? existing!.id : generateUUID(),
      meeting_id: currentMeeting.id,
      teacher_id: teacher.id,
      letter_number: activeLetterNum,
      dispatch_date: existing?.dispatch_date || dispatchDate,
      dispatch_channel: existing?.dispatch_channel || 'manual',
      dispatch_status: existing?.dispatch_status || 'sent',
      sent_at: existing?.sent_at || new Date().toISOString(),
      rsvp_status: newStatus,
      rsvp_notes: existing?.rsvp_notes || (newStatus === 'permission' ? 'Dikonfirmasi manual oleh Panitia' : ''),
      rsvp_at: new Date().toISOString(),
      created_at: existing?.created_at || new Date().toISOString(),
    };
    await saveInvitation(updated);
    onRefreshInvitations();
    const label = newStatus === 'attending' ? 'Hadir' : newStatus === 'permission' ? 'Izin' : newStatus === 'sick' ? 'Sakit' : 'Belum';
    showToast(`Status RSVP ${teacher.name} diubah menjadi ${label}.`);
  };

  // Copy RSVP link
  const handleCopyLink = (teacherId: string, teacherName: string) => {
    const url = getPersonalizedUrl(teacherId);
    navigator.clipboard.writeText(url);
    showToast(`Tautan RSVP untuk ${teacherName} berhasil disalin ke clipboard.`);
  };

  // Print Expedition Book
  const handlePrint = () => {
    window.print();
  };

  // Export Expedition Book to Excel (.xlsx) without per-participant letter number column
  const handleExportXLSX = () => {
    if (!currentMeeting) return;

    const rows: (string | number)[][] = [
      ['BUKU EKSPEDISI DAN TANDA TERIMA SURAT UNDANGAN'],
      [schoolProfile.school_name || 'SMP MUHAMMADIYAH 1 GOMBONG'],
      [schoolProfile.address || ''],
      [],
      ['Agenda Kegiatan', currentMeeting.title],
      ['Nomor Surat', letterNumber.trim() || '-'],
      ['Hari / Tanggal', currentMeeting.meeting_date],
      ['Waktu Pelaksanaan', `${currentMeeting.start_time.slice(0, 5)} - ${currentMeeting.end_time.slice(0, 5)} WIB`],
      ['Ruangan', currentMeeting.room],
      ['Pimpinan Rapat', currentMeeting.leader_name],
      ['Jumlah Penerima', `${meetingTeachers.length} Orang Guru/Pegawai`],
      [],
      ['REKAPITULASI EKSPEDISI'],
      ['Total Undangan', stats.total],
      ['Terkirim WhatsApp', stats.sentCount],
      ['Konfirmasi Hadir', stats.attendingCount],
      ['Konfirmasi Izin', stats.permissionCount],
      ['Konfirmasi Sakit', stats.sickCount],
      ['Belum Konfirmasi', stats.unconfirmedCount],
      [],
      [
        'No',
        'Nama Pegawai',
        'NIY',
        'Jabatan / Mapel',
        'Kelompok',
        'No. WhatsApp',
        'Tgl Kirim',
        'Media',
        'Status Kirim',
        'Konfirmasi',
        'Waktu Konfirmasi',
        'Keterangan / Catatan',
      ],
    ];

    meetingTeachers.forEach((teacher, idx) => {
      const inv = currentMeetingInvitationsMap.get(teacher.id);
      const rsvpLabel =
        inv?.rsvp_status === 'attending'
          ? 'Akan Hadir'
          : inv?.rsvp_status === 'permission'
          ? 'Izin'
          : inv?.rsvp_status === 'sick'
          ? 'Sakit'
          : '-';

      const rsvpTimeStr = inv?.rsvp_at
        ? `${new Date(inv.rsvp_at).toLocaleDateString('id-ID')} ${new Date(inv.rsvp_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
        : '-';

      rows.push([
        idx + 1,
        teacher.name,
        teacher.niy || '-',
        teacher.role_title,
        teacher.teacher_group || 'Guru Mapel',
        teacher.phone_wa || '-',
        inv?.dispatch_date || dispatchDate,
        inv?.dispatch_channel === 'whatsapp' ? 'WhatsApp' : 'Fisik/Manual',
        inv?.dispatch_status === 'sent' ? 'Terkirim' : 'Pending',
        rsvpLabel,
        rsvpTimeStr,
        inv?.rsvp_notes || '-',
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // Auto fit column widths
    const colWidths = [
      { wch: 5 },  // No
      { wch: 30 }, // Nama
      { wch: 18 }, // NIY
      { wch: 25 }, // Jabatan
      { wch: 20 }, // Kelompok
      { wch: 16 }, // WA
      { wch: 12 }, // Tgl Kirim
      { wch: 12 }, // Media
      { wch: 12 }, // Status
      { wch: 18 }, // RSVP
      { wch: 20 }, // Waktu RSVP
      { wch: 30 }, // Catatan
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Buku Ekspedisi');

    const cleanTitle = currentMeeting.title.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(workbook, `Ekspedisi_Undangan_${cleanTitle}_${currentMeeting.meeting_date}.xlsx`);
    showToast('File Excel Buku Ekspedisi berhasil diunduh.');
  };

  const expeditionHeadmasterSig = signatures.find(
    (s) => s.document_type === 'expedition_book' && s.signer_role === 'headmaster'
  );
  const isExpeditionHeadmasterSigned = expeditionHeadmasterSig?.status === 'signed';

  const handleSendExpeditionSignWa = async () => {
    if (!currentMeeting) return;
    const signUrl = `${window.location.origin}${window.location.pathname}?sign=${currentMeeting.id}&role=headmaster&doc=expedition_book`;
    const targetName = schoolProfile.headmaster_name || 'Kepala Sekolah';
    const textMsg = `*PERMOHONAN PENGESAHAN BUKU EKSPEDISI RESMI*\n` +
      `Yth. Bapak/Ibu *${targetName}* (Kepala Sekolah)\n` +
      `${schoolProfile.school_name || 'SMP Muhammadiyah 1 Gombong'}\n\n` +
      `Sehubungan dengan penerbitan dan pengiriman surat undangan agenda rapat kedinasan:\n` +
      `📌 *${currentMeeting.title}*\n` +
      `📄 Nomor Surat: ${letterNumber.trim() || '-'}\n` +
      `📅 Hari/Tanggal: ${currentMeeting.meeting_date}\n` +
      `⏰ Waktu: ${currentMeeting.start_time.slice(0, 5)} - ${currentMeeting.end_time.slice(0, 5)} WIB\n\n` +
      `📊 *Rekapitulasi Ekspedisi Undangan:*\n` +
      `- Total Penerima: ${stats.total} orang\n` +
      `- Terkirim WA: ${stats.sentCount} orang\n` +
      `- Konfirmasi Hadir: ${stats.attendingCount} orang\n` +
      `- Konfirmasi Izin/Sakit: ${stats.permissionCount + stats.sickCount} orang\n` +
      `- Belum Konfirmasi: ${stats.unconfirmedCount} orang\n\n` +
      `Mohon kesediaan Bapak Kepala Sekolah untuk memeriksa buku ekspedisi dan membubuhkan Tanda Tangan Elektronik Resmi (QR Verifikasi) melalui tautan di bawah ini:\n` +
      `👉 *Buka Lembar Pengesahan Ekspedisi:*\n${signUrl}\n\n` +
      `_Pesan otomatis dikirim melalui Sistem Presensi Resmi dePresent._`;

    const targetPhone = schoolProfile.phone || '';
    if (targetPhone) {
      try {
        const res = await invokeWahaNotification({
          action: 'invitation_dispatch',
          recipient: targetPhone,
          message: textMsg,
          metadata: {
            meetingId: currentMeeting.id,
            role: 'headmaster',
            doc: 'expedition_book',
            type: 'expedition_signature_request',
          },
        });
        if (res.success) {
          showToast(`Permohonan TTD Buku Ekspedisi berhasil dikirim ke WhatsApp Kepala Sekolah (${targetPhone})!`);
          return;
        }
      } catch (e) {
        console.warn('Waha notification failed, opening wa.me fallback:', e);
      }
    }

    const cleanPhone = targetPhone.replace(/\D/g, '');
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(textMsg)}`
      : `https://wa.me/?text=${encodeURIComponent(textMsg)}`;
    window.open(waUrl, '_blank');
    showToast('Membuka WhatsApp untuk permohonan TTD Buku Ekspedisi Kepala Sekolah.');
  };

  // Filtered teachers for dashboard display
  const displayedTeachers = useMemo(() => {

    return meetingTeachers.filter((t) => {
      const matchSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.niy && t.niy.toLowerCase().includes(searchQuery.toLowerCase())) ||
        t.role_title.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      if (filterRsvp === 'all') return true;
      const inv = currentMeetingInvitationsMap.get(t.id);
      const rsvp = inv?.rsvp_status || 'unconfirmed';
      if (filterRsvp === 'unsent') return !inv || inv.dispatch_status !== 'sent';
      return rsvp === filterRsvp;
    });
  }, [meetingTeachers, searchQuery, filterRsvp, currentMeetingInvitationsMap]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border text-sm font-medium transition-all ${
            toastMessage.type === 'error'
              ? 'bg-rose-950 text-rose-200 border-rose-800'
              : toastMessage.type === 'info'
              ? 'bg-sky-950 text-sky-200 border-sky-800'
              : 'bg-emerald-950 text-emerald-200 border-emerald-800'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Screen Only Top Bar */}
      <div className="no-print space-y-4">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                <Mail className="w-5 h-5" />
              </span>
              Surat Undangan & Buku Ekspedisi
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-teal-200/70 mt-1">
              Penerbitan surat dinas bersama, pengiriman tautan RSVP via WhatsApp WAHA, dan pencatatan buku ekspedisi kedinasan.
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsUnconfirmedModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Ekspor infografis gambar & kirim daftar guru belum konfirmasi ke WhatsApp grup"
            >
              <Share2 className="w-4 h-4" />
              Kirim Rekap Belum RSVP ke Grup
            </button>

            <button
              onClick={() => {
                setWahaConfig(getWahaConfig());
                setIsTemplateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-[#072b2f] dark:hover:bg-[#0b383d] text-slate-800 dark:text-teal-100 text-xs font-semibold border border-slate-300 dark:border-[#0f4950] transition-colors shadow-xs cursor-pointer"
            >
              <Settings2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Edit Template Pesan
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-[#072b2f] dark:hover:bg-[#0b383d] text-slate-800 dark:text-teal-100 text-xs font-semibold border border-slate-300 dark:border-[#0f4950] transition-colors shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Cetak Laporan Ekspedisi
            </button>

            <button
              onClick={handleSendExpeditionSignWa}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer ${
                isExpeditionHeadmasterSigned
                  ? 'bg-blue-900/90 hover:bg-blue-800 text-white border border-blue-500'
                  : 'bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white'
              }`}
              title="Kirim tautan persetujuan TTD Ekspedisi (QR Verifikasi) ke WhatsApp Kepala Sekolah"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isExpeditionHeadmasterSigned ? '✓ Ekspedisi Disahkan' : 'Kirim TTD Ekspedisi (WA)'}</span>
            </button>

            <button
              onClick={handleExportXLSX}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Ekspor Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* Meeting Selector & Single Letter Numbering Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Select Meeting (Sorted with nearest upcoming meeting first) */}
          <div className="bg-white dark:bg-[#072b2f] border border-slate-200 dark:border-[#0f4950] rounded-2xl p-4 shadow-xs space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-teal-300/80">
              Pilih Agenda Rapat (Terdekat)
            </label>
            <select
              value={selectedMeetingId}
              onChange={(e) => setSelectedMeetingId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#031e21] border border-slate-300 dark:border-[#0f4950] rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-teal-100 focus:outline-hidden focus:border-teal-500"
            >
              {sortedMeetingsList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.status === 'active' ? '🟢 [AKTIF] ' : m.status === 'upcoming' ? '⏱️ ' : '✓ '}
                  {m.meeting_date} • {m.title} ({m.category})
                </option>
              ))}
            </select>

            {currentMeeting && (
              <div className="pt-1 text-[11px] text-slate-500 dark:text-teal-200/70 space-y-0.5">
                <p>📍 {currentMeeting.room} • ⏰ {currentMeeting.start_time.slice(0, 5)} - {currentMeeting.end_time.slice(0, 5)} WIB</p>
                <p>👤 Pimpinan: <span className="font-semibold text-slate-700 dark:text-teal-200">{currentMeeting.leader_name}</span></p>
              </div>
            )}
          </div>

          {/* 1 Nomor Surat untuk 1 Kegiatan (Berlaku untuk semua peserta) */}
          <div className="lg:col-span-2 bg-white dark:bg-[#072b2f] border border-slate-200 dark:border-[#0f4950] rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-teal-300/80">
                Nomor Surat Kedinasan (1 Nomor untuk Kegiatan Ini)
              </span>
              <button
                type="button"
                onClick={handleApplyLetterNumber}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Simpan & Terapkan Nomor
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] text-slate-500 dark:text-teal-200/70 mb-1">
                  Nomor Surat Dinas Rapat
                </label>
                <input
                  type="text"
                  value={letterNumber}
                  onChange={(e) => setLetterNumber(e.target.value)}
                  placeholder="Contoh: 421.3/048/SMP.M.1/X/2026"
                  className="w-full bg-slate-50 dark:bg-[#031e21] border border-slate-300 dark:border-[#0f4950] rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-teal-100 font-mono font-medium focus:outline-hidden focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 dark:text-teal-200/70 mb-1">
                  Tanggal Pengiriman
                </label>
                <input
                  type="date"
                  value={dispatchDate}
                  onChange={(e) => setDispatchDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#031e21] border border-slate-300 dark:border-[#0f4950] rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-teal-100 focus:outline-hidden focus:border-teal-500"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-400 dark:text-teal-200/60">
              Nomor surat ini tercantum pada pesan WhatsApp guru, kop surat ekspedisi, serta rekapitulasi kehadiran.
            </p>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white dark:bg-[#072b2f] border border-slate-200 dark:border-[#0f4950] rounded-2xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 dark:text-teal-200/70 block">Total Undangan</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">{stats.total}</span>
          </div>

          <div className="bg-white dark:bg-[#072b2f] border border-teal-500/30 rounded-2xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-teal-600 dark:text-teal-400 block">Terkirim WA</span>
            <span className="text-2xl font-bold text-teal-600 dark:text-teal-400 font-mono tabular-nums">{stats.sentCount}</span>
          </div>

          <div className="bg-white dark:bg-[#072b2f] border border-emerald-500/30 rounded-2xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 block">Akan Hadir</span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">{stats.attendingCount}</span>
          </div>

          <div className="bg-white dark:bg-[#072b2f] border border-amber-500/30 rounded-2xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 block">Izin</span>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums">{stats.permissionCount}</span>
          </div>

          <div className="bg-white dark:bg-[#072b2f] border border-sky-500/30 rounded-2xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400 block">Sakit</span>
            <span className="text-2xl font-bold text-sky-600 dark:text-sky-400 font-mono tabular-nums">{stats.sickCount}</span>
          </div>

          <div className="bg-white dark:bg-[#072b2f] border border-amber-500/30 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 block">Belum Konfirmasi</span>
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums">{stats.unconfirmedCount}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsUnconfirmedModalOpen(true)}
              className="mt-2 text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
              title="Kirim daftar guru belum konfirmasi (gambar infografis & teks) ke grup WA"
            >
              <Share2 className="w-3 h-3" />
              <span>Kirim ke Grup WA</span>
            </button>
          </div>
        </div>

        {/* Bulk Action & Filters */}
        <div className="bg-white dark:bg-[#072b2f] border border-slate-200 dark:border-[#0f4950] rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search & Status Filter */}
          <div className="flex items-center gap-2.5 flex-1 flex-wrap">
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-4 h-4 text-slate-400 dark:text-teal-300/60 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama guru, NIY..."
                className="w-full bg-slate-50 dark:bg-[#031e21] border border-slate-300 dark:border-[#0f4950] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-teal-100 placeholder-slate-400 dark:placeholder-teal-300/40 focus:outline-hidden focus:border-teal-500"
              />
            </div>

            <select
              value={filterRsvp}
              onChange={(e) => setFilterRsvp(e.target.value)}
              className="bg-slate-50 dark:bg-[#031e21] border border-slate-300 dark:border-[#0f4950] rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-teal-100 focus:outline-hidden focus:border-teal-500"
            >
              <option value="all">Semua Status RSVP</option>
              <option value="unsent">Belum Terkirim WA</option>
              <option value="attending">Akan Hadir</option>
              <option value="permission">Izin</option>
              <option value="sick">Sakit</option>
              <option value="unconfirmed">Belum Konfirmasi</option>
            </select>
          </div>

          {/* Bulk Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Re-Chat Belum Konfirmasi */}
            <button
              onClick={handleSendRechatBulk}
              disabled={isSendingRechatBulk || isSendingBulk || stats.unconfirmedCount === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white text-xs font-bold shadow-md shadow-amber-950/30 transition-all disabled:opacity-50 cursor-pointer"
              title="Kirim pesan pengingat RSVP ke semua guru yang belum konfirmasi"
            >
              {isSendingRechatBulk ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>
                    Re-Chat ({rechatProgress?.current}/{rechatProgress?.total})...
                  </span>
                </>
              ) : (
                <>
                  <BellRing className="w-3.5 h-3.5" />
                  <span>Re-Chat Belum Konfirmasi ({stats.unconfirmedCount})</span>
                </>
              )}
            </button>

            {/* Bulk WhatsApp Dispatch Button */}
            <button
              onClick={handleSendBulkWA}
              disabled={isSendingBulk || isSendingRechatBulk || stats.total === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-600 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-teal-950/30 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSendingBulk ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>
                    Mengirim ({bulkProgress?.current}/{bulkProgress?.total})...
                  </span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Undangan WhatsApp (Massal)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Expedition Table (Screen View - Tanpa kolom No. Surat per peserta) */}
        <div className="bg-white dark:bg-[#072b2f] border border-slate-200 dark:border-[#0f4950] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#031e21] text-slate-600 dark:text-teal-200/90 border-b border-slate-200 dark:border-[#0f4950] uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3.5 w-12 text-center">No</th>
                  <th className="py-3 px-3.5">Nama Pegawai</th>
                  <th className="py-3 px-3.5">Jabatan / Kelompok</th>
                  <th className="py-3 px-3.5">No. WhatsApp</th>
                  <th className="py-3 px-3.5">Distribusi</th>
                  <th className="py-3 px-3.5">Status RSVP</th>
                  <th className="py-3 px-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#0f4950]/60 font-medium">
                {displayedTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-teal-300/60">
                      Tidak ada data guru yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  displayedTeachers.map((teacher, idx) => {
                    const inv = currentMeetingInvitationsMap.get(teacher.id);
                    const isSent = inv?.dispatch_status === 'sent';
                    const rsvp = inv?.rsvp_status || 'unconfirmed';

                    return (
                      <tr
                        key={teacher.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-[#0b383d]/50 transition-colors"
                      >
                        <td className="py-3 px-3.5 text-center font-mono text-slate-400 dark:text-teal-300/60">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-slate-900 dark:text-white leading-tight">
                            {teacher.name}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-teal-300/70 font-mono">
                            NIY: {teacher.niy || '-'}
                          </div>
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="text-slate-800 dark:text-teal-100">{teacher.role_title}</div>
                          <div className="text-[10px] text-slate-400 dark:text-teal-300/60">{teacher.teacher_group || 'Guru Mapel'}</div>
                        </td>
                        <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-teal-200/90">
                          {teacher.phone_wa || <span className="text-rose-400">(Belum ada)</span>}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {isSent ? (
                            <div className="flex flex-col">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" />
                                Terkirim WA
                              </span>
                              {inv?.sent_at && (
                                <span className="text-[10px] text-slate-400 dark:text-teal-300/60">
                                  {new Date(inv.sent_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 dark:text-teal-300/60">Belum Dikirim</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {rsvp === 'attending' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              Akan Hadir
                            </span>
                          )}
                          {rsvp === 'permission' && (
                            <div className="flex flex-col">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                                <AlertCircle className="w-3 h-3" />
                                Izin
                              </span>
                              {inv?.rsvp_notes && (
                                <span className="text-[10px] text-slate-400 dark:text-teal-200/70 max-w-[140px] truncate" title={inv.rsvp_notes}>
                                  {inv.rsvp_notes}
                                </span>
                              )}
                            </div>
                          )}
                          {rsvp === 'sick' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/30">
                              <HeartPulse className="w-3 h-3" />
                              Sakit
                            </span>
                          )}
                          {rsvp === 'unconfirmed' && (
                            <span className="text-[11px] text-slate-400 dark:text-teal-300/60 italic">Belum Konfirmasi</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Send WA Button with sending effect */}
                            <button
                              onClick={() => handleSendSingleWA(teacher)}
                              disabled={sendingTeacherId === teacher.id || isSendingBulk || isSendingRechatBulk}
                              title={
                                sendingTeacherId === teacher.id && sendingType === 'invitation'
                                  ? 'Sedang mengirim pesan...'
                                  : 'Kirim Undangan WhatsApp'
                              }
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                sendingTeacherId === teacher.id && sendingType === 'invitation'
                                  ? 'bg-teal-500/30 text-teal-300 border-teal-400 animate-pulse'
                                  : 'bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-300 border-teal-500/20'
                              } disabled:opacity-60`}
                            >
                              {sendingTeacherId === teacher.id && sendingType === 'invitation' ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-300" />
                              ) : (
                                <MessageSquare className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Re-Chat Belum Konfirmasi button (only for unconfirmed) */}
                            {rsvp === 'unconfirmed' && (
                              <button
                                onClick={() => handleSendRechatSingle(teacher)}
                                disabled={sendingTeacherId === teacher.id || isSendingBulk || isSendingRechatBulk}
                                title={
                                  sendingTeacherId === teacher.id && sendingType === 'rechat'
                                    ? 'Sedang mengirim re-chat...'
                                    : 'Kirim Pengingat / Re-Chat Konfirmasi Kehadiran'
                                }
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  sendingTeacherId === teacher.id && sendingType === 'rechat'
                                    ? 'bg-amber-500/30 text-amber-300 border-amber-400 animate-pulse'
                                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/20'
                                } disabled:opacity-60`}
                              >
                                {sendingTeacherId === teacher.id && sendingType === 'rechat' ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-300" />
                                ) : (
                                  <BellRing className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}

                            {/* Copy RSVP Link */}
                            <button
                              onClick={() => handleCopyLink(teacher.id, teacher.name)}
                              title="Salin Tautan RSVP"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#031e21] dark:hover:bg-[#0b383d] text-slate-600 dark:text-teal-200 border border-slate-300 dark:border-[#0f4950] transition-colors cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            {/* Manual RSVP Dropdown */}
                            <select
                              value={rsvp}
                              onChange={(e) => handleUpdateRsvpManual(teacher, e.target.value as RsvpStatus)}
                              className="bg-slate-50 dark:bg-[#031e21] border border-slate-300 dark:border-[#0f4950] rounded-lg px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-teal-200 focus:outline-hidden cursor-pointer"
                            >
                              <option value="unconfirmed">Belum</option>
                              <option value="attending">Hadir</option>
                              <option value="permission">Izin</option>
                              <option value="sick">Sakit</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PRINT-ONLY OFFICIAL EXPEDITION REPORT (BER-KOP SURAT & TANDA TANGAN)      */}
      {/* 1 Nomor Surat di Header Rapat, Hapus Kolom No. Surat per Peserta         */}
      {/* ========================================================================= */}
      <div className="hidden print:block print-container p-6 bg-white text-black font-sans leading-relaxed">
        {/* Kop Surat Resmi */}
        <div className="flex items-center gap-4 border-b-4 border-double border-black pb-3 mb-4">
          {schoolProfile.logo_url ? (
            <img
              src={schoolProfile.logo_url}
              alt="Logo Sekolah"
              className="w-20 h-20 object-contain shrink-0"
            />
          ) : (
            <div className="w-20 h-20 border-2 border-black flex items-center justify-center font-bold text-xs text-center p-1 shrink-0">
              LOGO SEKOLAH
            </div>
          )}
          <div className="flex-1 text-center">
            {schoolProfile.foundation_name && (
              <h3 className="text-xs font-bold uppercase tracking-wider text-black">
                {schoolProfile.foundation_name}
              </h3>
            )}
            <h1 className="text-xl font-black uppercase text-black tracking-tight">
              {schoolProfile.school_name || 'SMP MUHAMMADIYAH 1 GOMBONG'}
            </h1>
            <p className="text-[11px] text-black">
              {schoolProfile.address || 'Jl. Kauman No. 1, Gombong, Kebumen, Jawa Tengah'}
            </p>
            <p className="text-[10px] text-black">
              NPSN: {schoolProfile.npsn || '-'} • Telp: {schoolProfile.phone || '-'} • Email: {schoolProfile.email || '-'}
            </p>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-4">
          <h2 className="text-base font-black uppercase underline tracking-wide">
            BUKU EKSPEDISI DAN TANDA TERIMA SURAT UNDANGAN
          </h2>
          <p className="text-xs font-semibold mt-0.5">
            Agenda Kegiatan: {currentMeeting?.title}
          </p>
        </div>

        {/* Meeting Metadata (Tanpa kategori rapat dan tanpa tanggal pengiriman) */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs mb-4 border border-black p-3 bg-gray-50">
          <div>
            <span className="font-bold inline-block w-28">Nomor Surat</span>
            <span className="font-mono font-bold">: {letterNumber.trim() || '-'}</span>
          </div>
          <div>
            <span className="font-bold inline-block w-28">Pimpinan Rapat</span>
            <span>: {currentMeeting?.leader_name}</span>
          </div>
          <div>
            <span className="font-bold inline-block w-28">Hari, Tanggal</span>
            <span>
              : {currentMeeting ? new Date(currentMeeting.meeting_date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
            </span>
          </div>
          <div>
            <span className="font-bold inline-block w-28">Ruang / Tempat</span>
            <span>: {currentMeeting?.room}</span>
          </div>
          <div>
            <span className="font-bold inline-block w-28">Waktu Pelaksanaan</span>
            <span>: {currentMeeting?.start_time.slice(0, 5)} - {currentMeeting?.end_time.slice(0, 5)} WIB</span>
          </div>
          <div>
            <span className="font-bold inline-block w-28">Jumlah Penerima</span>
            <span>: {meetingTeachers.length} Orang Guru/Pegawai</span>
          </div>
        </div>

        {/* Official Expedition Table - Kolom Nama Pegawai, tanpa NIP, kolom Konfirmasi */}
        <table className="w-full text-[10px] border-collapse border border-black mb-6">
          <thead>
            <tr className="bg-gray-100 border-b border-black text-center font-bold">
              <th className="border border-black py-1.5 px-1 w-8">No</th>
              <th className="border border-black py-1.5 px-2 text-left">Nama Pegawai</th>
              <th className="border border-black py-1.5 px-2 text-left w-36">Jabatan / Mapel</th>
              <th className="border border-black py-1.5 px-1 w-24 text-center">Media & Tgl Kirim</th>
              <th className="border border-black py-1.5 px-2 w-28 text-center">Konfirmasi</th>
              <th className="border border-black py-1.5 px-2 w-32 text-left">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {meetingTeachers.map((teacher, idx) => {
              const inv = currentMeetingInvitationsMap.get(teacher.id);
              const isConfirmed = inv?.rsvp_status && inv.rsvp_status !== 'unconfirmed';

              return (
                <tr key={teacher.id} className="border-b border-black">
                  <td className="border border-black text-center py-1.5 font-bold">{idx + 1}</td>
                  <td className="border border-black px-2 py-1.5">
                    <div className="font-bold leading-tight">{teacher.name}</div>
                    <div className="text-[9px] text-gray-700 font-mono">NIY: {teacher.niy || '-'}</div>
                  </td>
                  <td className="border border-black px-2 py-1.5">{teacher.role_title}</td>
                  <td className="border border-black text-center py-1.5">
                    {inv?.dispatch_channel === 'whatsapp' ? 'WhatsApp' : 'Fisik'}<br />
                    <span className="text-[9px] text-gray-600">{inv?.dispatch_date || dispatchDate}</span>
                  </td>
                  <td className="border border-black text-center py-1.5 px-2 font-semibold">
                    {isConfirmed ? (
                      inv.rsvp_status === 'attending' ? (
                        <span>Akan Hadir</span>
                      ) : inv.rsvp_status === 'permission' ? (
                        <span>Izin</span>
                      ) : inv.rsvp_status === 'sick' ? (
                        <span>Sakit</span>
                      ) : (
                        '-'
                      )
                    ) : (
                      <span className="font-normal text-gray-500">-</span>
                    )}
                  </td>
                  <td className="border border-black py-1.5 px-2 text-[9px] text-gray-700">
                    {inv?.rsvp_notes || '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 2-Column Official Signature Block with Digital Signature Badges */}
        <div className="break-inside-avoid mt-8 grid grid-cols-2 text-center text-xs px-8">
          {/* Petugas Ekspedisi (QR Code Verifikasi) */}
          <div className="px-3">
            <DigitalSignatureBadge
              signature={signatures.find((s) => s.document_type === 'expedition_book' && s.signer_role === 'expedition_officer')}
              role="expedition_officer"
              roleTitle="Petugas Ekspedisi / TU"
              signerName="Petugas Ekspedisi / TU"
              signerNiy="-"
              schoolProfile={schoolProfile}
              isPrintView={true}
            />
          </div>

          {/* Kepala Sekolah (QR Code Verifikasi Resmi) */}
          <div className="px-3">
            <p className="text-gray-700 text-xs mb-1">
              {schoolProfile.city || 'Gombong'}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="text-gray-700 text-xs mb-1">Mengetahui,</p>
            <DigitalSignatureBadge
              signature={signatures.find((s) => s.document_type === 'expedition_book' && s.signer_role === 'headmaster')}
              role="headmaster"
              roleTitle="Kepala Sekolah"
              signerName={schoolProfile.headmaster_name || 'Kepala Sekolah'}
              signerNiy={schoolProfile.headmaster_niy}
              schoolProfile={schoolProfile}
              isPrintView={true}
            />
          </div>
        </div>

        {/* Official Document Print Footer */}
        <div className="mt-8 pt-3 border-t-2 border-black text-[9px] text-black flex justify-between items-center print-doc-footer break-inside-avoid">
          <div className="space-y-0.5">
            <div className="font-bold uppercase tracking-wider text-black">
              dePresent — Sistem Administrasi Rapat & Ekspedisi Kedinasan
            </div>
            <div className="text-[8px] text-gray-700">
              {schoolProfile.school_name || 'SMP Muhammadiyah 1 Gombong'} • NPSN: {schoolProfile.npsn || '-'} • Dokumen Terverifikasi Sah
            </div>
          </div>
          <div className="text-right space-y-0.5">
            <div>
              Waktu Cetak: <span className="font-mono font-bold text-black">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} pukul {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB</span>
            </div>
            <div className="text-[8px] font-mono text-gray-700">
              Kode Ekspedisi: DEP-EXP-{currentMeeting?.id?.slice(0, 8)?.toUpperCase()} • Dicetak Asli
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL EDIT TEMPLATE PESAN WHATSAPP (UNDANGAN & RE-CHAT)                  */}
      {/* ========================================================================= */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#072b2f] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-[#0f4950]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#0f4950] flex items-center justify-between bg-teal-950 text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center">
                  <Settings2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Edit Template Pesan WhatsApp</h3>
                  <p className="text-xs text-teal-200/80">Kustomisasi teks Undangan Resmi & Re-Chat Pengingat RSVP</p>
                </div>
              </div>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="p-1 rounded-lg text-teal-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-sm flex-1">
              {/* Template 1: Undangan Resmi */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 dark:text-teal-100 uppercase tracking-wider">
                    1. Template Surat Undangan Resmi & RSVP
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setWahaConfig({
                        ...wahaConfig,
                        message_template_invitation: DEFAULT_WAHA_CONFIG.message_template_invitation,
                      });
                    }}
                    className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    Reset Default
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={wahaConfig.message_template_invitation || DEFAULT_WAHA_CONFIG.message_template_invitation || ''}
                  onChange={(e) =>
                    setWahaConfig({ ...wahaConfig, message_template_invitation: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-[#0f4950] rounded-xl bg-slate-50 dark:bg-[#031e21] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-mono leading-relaxed"
                />
                <div className="text-[11px] text-slate-500 dark:text-teal-200/70 space-y-1">
                  <p className="font-semibold text-slate-700 dark:text-teal-200">Placeholder variabel:</p>
                  <div className="flex flex-wrap gap-1">
                    {['{no_surat}', '{agenda}', '{nama}', '{jabatan}', '{tanggal}', '{jam}', '{ruang}', '{pimpinan}', '{link_rsvp}', '{nama_sekolah}'].map((item) => (
                      <span key={item} className="px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-700 dark:text-teal-300 font-mono text-[10px] border border-teal-500/20">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Template 2: Re-Chat Belum Konfirmasi */}
              <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-[#0f4950]">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 dark:text-teal-100 uppercase tracking-wider">
                    2. Template Re-Chat Pengingat RSVP
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setWahaConfig({
                        ...wahaConfig,
                        message_template_rechat: DEFAULT_WAHA_CONFIG.message_template_rechat,
                      });
                    }}
                    className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    Reset Default
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={wahaConfig.message_template_rechat || DEFAULT_WAHA_CONFIG.message_template_rechat || ''}
                  onChange={(e) =>
                    setWahaConfig({ ...wahaConfig, message_template_rechat: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-[#0f4950] rounded-xl bg-slate-50 dark:bg-[#031e21] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-mono leading-relaxed"
                />
                <div className="text-[11px] text-slate-500 dark:text-teal-200/70 space-y-1">
                  <p className="font-semibold text-slate-700 dark:text-teal-200">Placeholder variabel:</p>
                  <div className="flex flex-wrap gap-1">
                    {['{agenda}', '{nama}', '{jabatan}', '{tanggal}', '{jam}', '{ruang}', '{pimpinan}', '{link_rsvp}', '{nama_sekolah}'].map((item) => (
                      <span key={item} className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono text-[10px] border border-amber-500/20">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-[#0f4950] bg-slate-50 dark:bg-[#031e21] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  saveWahaConfig(wahaConfig);
                  setIsTemplateModalOpen(false);
                  showToast('Template pesan WhatsApp berhasil diperbarui dan disimpan!');
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-700 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Simpan Perubahan Template</span>
              </button>
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-[#0b383d] hover:bg-slate-300 dark:hover:bg-[#0f4950] text-slate-700 dark:text-teal-100 text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KIRIM DAFTAR GURU BELUM KONFIRMASI KE GRUP (INFOGRAFIS GAMBAR + REKAP TEKS) */}
      {currentMeeting && (
        <UnconfirmedRsvpModal
          isOpen={isUnconfirmedModalOpen}
          onClose={() => setIsUnconfirmedModalOpen(false)}
          currentMeeting={currentMeeting}
          teachers={meetingTeachers}
          invitations={invitations}
          schoolProfile={schoolProfile}
          letterNumber={letterNumber}
        />
      )}
    </div>
  );
};
