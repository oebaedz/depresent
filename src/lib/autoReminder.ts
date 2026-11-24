import { Attendance, AutoReminderConfig, Invitation, Meeting, SchoolProfile, Teacher } from '../types';
import {
  getAutoReminderConfig,
  getWahaGroups,
  isAutoReminderAlreadySent,
  markAutoReminderSent,
  saveAutoReminderConfig,
} from './storage';
import { getWahaConfig, invokeWahaNotification } from './waha';

let isReminderCheckRunning = false;

function parseMeetingDateTime(meetingDate: string, timeStr: string): Date | null {
  if (!meetingDate) return null;
  const cleanDate = meetingDate.slice(0, 10);
  const cleanTime = (timeStr || '08:00').slice(0, 5);
  const dt = new Date(`${cleanDate}T${cleanTime}:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function formatIndonesianDate(meetingDate: string): string {
  try {
    return new Date(meetingDate).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return meetingDate;
  }
}

export interface AutoReminderRunResult {
  triggeredCount: number;
  results: string[];
  checkedAt: string;
}

export async function runAutoReminderCheck(params: {
  meetings: Meeting[];
  teachers: Teacher[];
  attendances: Attendance[];
  invitations: Invitation[];
  schoolProfile: SchoolProfile;
  forceMeetingId?: string;
}): Promise<AutoReminderRunResult> {
  const checkedAt = new Date().toISOString();
  if (isReminderCheckRunning) {
    return { triggeredCount: 0, results: [], checkedAt };
  }

  const config: AutoReminderConfig = getAutoReminderConfig(params.schoolProfile);
  if (!config.enabled && !params.forceMeetingId) {
    return { triggeredCount: 0, results: [], checkedAt };
  }

  const wahaConfig = getWahaConfig();
  if (!wahaConfig.is_enabled) {
    return {
      triggeredCount: 0,
      results: params.forceMeetingId ? ['Fitur WAHA global sedang dinonaktifkan.'] : [],
      checkedAt,
    };
  }

  isReminderCheckRunning = true;
  const results: string[] = [];
  let triggeredCount = 0;

  try {
    const now = new Date();
    const groups = getWahaGroups(params.schoolProfile);
    const defaultGroupId =
      config.target_group_id?.trim() ||
      groups.find((g) => g.is_default)?.group_id ||
      groups[0]?.group_id ||
      params.schoolProfile.waha_group_id ||
      '';

    const candidateMeetings = params.forceMeetingId
      ? params.meetings.filter((m) => m.id === params.forceMeetingId)
      : params.meetings.filter((m) => m.status !== 'completed');

    for (const meeting of candidateMeetings) {
      const startDt = parseMeetingDateTime(meeting.meeting_date, meeting.start_time);
      if (!startDt) continue;

      const diffMs = startDt.getTime() - now.getTime();
      const diffMinutes = diffMs / (1000 * 60);
      const diffHours = diffMs / (1000 * 60 * 60);

      // Eligible teachers for this meeting
      const isCustom =
        meeting.target_type === 'custom' &&
        Array.isArray(meeting.invited_teacher_ids) &&
        meeting.invited_teacher_ids.length > 0;

      const eligibleTeachers = params.teachers
        .filter((t) => t.is_active)
        .filter((t) => !isCustom || meeting.invited_teacher_ids!.includes(t.id));

      const meetingAttendances = params.attendances.filter((a) => a.meeting_id === meeting.id);
      const attendedTeacherIds = new Set(meetingAttendances.map((a) => a.teacher_id));

      const meetingInvitations = new Map<string, Invitation>();
      params.invitations
        .filter((inv) => inv.meeting_id === meeting.id)
        .forEach((inv) => meetingInvitations.set(inv.teacher_id, inv));

      const dateFormatted = formatIndonesianDate(meeting.meeting_date);
      const originUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';

      // ---------------------------------------------------------------------
      // 1. PRE-MEETING REMINDER (e.g. 15/30/60/120 mins before start)
      // ---------------------------------------------------------------------
      const inPreMeetingWindow = params.forceMeetingId
        ? true
        : diffMinutes <= config.remind_before_minutes && diffMinutes >= -15;

      const preKey = `pre_${meeting.id}_${meeting.meeting_date}`;
      const shouldRunPre = inPreMeetingWindow && (!isAutoReminderAlreadySent(preKey) || Boolean(params.forceMeetingId));

      if (shouldRunPre) {
        let sentRecipients = 0;

        // Send individual reminders if mode targets teachers
        if (
          config.target_mode === 'unpresent_teachers' ||
          config.target_mode === 'both_teachers_and_group'
        ) {
          const targets = eligibleTeachers.filter((t) => !attendedTeacherIds.has(t.id) && t.phone_wa?.trim());
          const msg = wahaConfig.message_template_reminder
            .replace(/\{rapat\}/g, meeting.title)
            .replace(/\{tanggal\}/g, dateFormatted)
            .replace(/\{jam\}/g, meeting.start_time.slice(0, 5))
            .replace(/\{ruang\}/g, meeting.room)
            .replace(/\{pimpinan\}/g, meeting.leader_name);

          for (const teacher of targets) {
            const res = await invokeWahaNotification({
              action: 'meeting_reminder',
              recipient: teacher.phone_wa.trim(),
              message: `*[Auto Reminder]*\n${msg}`,
              isAutoReminder: true,
              metadata: { meeting_id: meeting.id, teacher_id: teacher.id, auto_type: 'pre_meeting' },
            });
            if (res.success) sentRecipients++;
          }
        } else if (config.target_mode === 'unconfirmed_rsvp') {
          const targets = eligibleTeachers.filter((t) => {
            if (!t.phone_wa?.trim()) return false;
            const inv = meetingInvitations.get(t.id);
            return !inv || inv.rsvp_status === 'unconfirmed';
          });

          for (const teacher of targets) {
            const rsvpLink = originUrl ? `${originUrl}?rsvp=${meeting.id}&t=${teacher.id}` : '';
            const msg = (wahaConfig.message_template_rechat || wahaConfig.message_template_reminder)
              .replace(/\{nama\}/g, teacher.name)
              .replace(/\{agenda\}/g, meeting.title)
              .replace(/\{rapat\}/g, meeting.title)
              .replace(/\{tanggal\}/g, dateFormatted)
              .replace(/\{jam\}/g, meeting.start_time.slice(0, 5))
              .replace(/\{ruang\}/g, meeting.room)
              .replace(/\{pimpinan\}/g, meeting.leader_name)
              .replace(/\{link_rsvp\}/g, rsvpLink)
              .replace(/\{nama_sekolah\}/g, params.schoolProfile.school_name || 'Sekolah');

            const res = await invokeWahaNotification({
              action: 'meeting_reminder',
              recipient: teacher.phone_wa.trim(),
              message: `*[Auto Reminder RSVP]*\n${msg}`,
              isAutoReminder: true,
              metadata: { meeting_id: meeting.id, teacher_id: teacher.id, auto_type: 'pre_meeting_rsvp' },
            });
            if (res.success) sentRecipients++;
          }
        }

        // Send group reminder if mode includes group
        if (
          (config.target_mode === 'group' || config.target_mode === 'both_teachers_and_group') &&
          defaultGroupId
        ) {
          const baseMsg = wahaConfig.message_template_reminder
            .replace(/\{rapat\}/g, meeting.title)
            .replace(/\{tanggal\}/g, dateFormatted)
            .replace(/\{jam\}/g, meeting.start_time.slice(0, 5))
            .replace(/\{ruang\}/g, meeting.room)
            .replace(/\{pimpinan\}/g, meeting.leader_name);

          const unpresentCount = Math.max(0, eligibleTeachers.length - attendedTeacherIds.size);
          const groupMessage =
            `⏰ *PENGINGAT RAPAT OTOMATIS (${config.remind_before_minutes} Menit Menjelang)*\n\n` +
            `${baseMsg}\n\n` +
            `• Status Presensi Saat Ini: *${attendedTeacherIds.size}/${eligibleTeachers.length}* hadir (${unpresentCount} belum presensi).`;

          const res = await invokeWahaNotification({
            action: 'group_recap',
            recipient: defaultGroupId,
            message: groupMessage,
            isAutoReminder: true,
            metadata: { meeting_id: meeting.id, auto_type: 'pre_meeting_group' },
          });
          if (res.success) sentRecipients++;
        }

        if (sentRecipients > 0 || !params.forceMeetingId) {
          markAutoReminderSent({
            key: preKey,
            meeting_id: meeting.id,
            meeting_title: meeting.title,
            type: 'pre_meeting',
            sent_at: now.toISOString(),
            recipient_count: sentRecipients,
            summary:
              sentRecipients > 0
                ? `Terkirim ke ${sentRecipients} penerima (${meeting.title})`
                : `Tidak ada penerima WA valid untuk ${meeting.title}`,
          });
          if (sentRecipients > 0) {
            triggeredCount += sentRecipients;
            results.push(`Pengingat rapat "${meeting.title}" dikirim ke ${sentRecipients} penerima.`);
          } else if (params.forceMeetingId) {
            results.push(`Tidak ada penerima valid untuk "${meeting.title}" (cek nomor WA guru / ID grup).`);
          }
        }
      }

      // ---------------------------------------------------------------------
      // 2. RSVP BEFORE REMINDER (e.g. H-1 / 6-24 hours before start)
      // ---------------------------------------------------------------------
      if (config.rsvp_remind_hours_before > 0 && !params.forceMeetingId) {
        const inRsvpWindow = diffHours <= config.rsvp_remind_hours_before && diffHours > 0.5;
        const rsvpKey = `rsvp_${meeting.id}_${meeting.meeting_date}`;

        if (inRsvpWindow && !isAutoReminderAlreadySent(rsvpKey)) {
          const unconfirmedTargets = eligibleTeachers.filter((t) => {
            if (!t.phone_wa?.trim()) return false;
            const inv = meetingInvitations.get(t.id);
            return !inv || inv.rsvp_status === 'unconfirmed';
          });

          let rsvpSentCount = 0;
          for (const teacher of unconfirmedTargets) {
            const rsvpLink = originUrl ? `${originUrl}?rsvp=${meeting.id}&t=${teacher.id}` : '';
            const msg = (wahaConfig.message_template_rechat || wahaConfig.message_template_reminder)
              .replace(/\{nama\}/g, teacher.name)
              .replace(/\{agenda\}/g, meeting.title)
              .replace(/\{rapat\}/g, meeting.title)
              .replace(/\{tanggal\}/g, dateFormatted)
              .replace(/\{jam\}/g, meeting.start_time.slice(0, 5))
              .replace(/\{ruang\}/g, meeting.room)
              .replace(/\{pimpinan\}/g, meeting.leader_name)
              .replace(/\{link_rsvp\}/g, rsvpLink)
              .replace(/\{nama_sekolah\}/g, params.schoolProfile.school_name || 'Sekolah');

            const res = await invokeWahaNotification({
              action: 'meeting_reminder',
              recipient: teacher.phone_wa.trim(),
              message: `*[Auto Reminder RSVP]*\n${msg}`,
              isAutoReminder: true,
              metadata: { meeting_id: meeting.id, teacher_id: teacher.id, auto_type: 'rsvp_before' },
            });
            if (res.success) rsvpSentCount++;
          }

          markAutoReminderSent({
            key: rsvpKey,
            meeting_id: meeting.id,
            meeting_title: meeting.title,
            type: 'rsvp_before',
            sent_at: now.toISOString(),
            recipient_count: rsvpSentCount,
            summary:
              rsvpSentCount > 0
                ? `Pengingat RSVP dikirim ke ${rsvpSentCount} guru`
                : `Semua peserta telah RSVP atau tanpa nomor WA`,
          });

          if (rsvpSentCount > 0) {
            triggeredCount += rsvpSentCount;
            results.push(`Pengingat RSVP "${meeting.title}" dikirim ke ${rsvpSentCount} guru belum konfirmasi.`);
          }
        }
      }
    }

    if (triggeredCount > 0) {
      await saveAutoReminderConfig({
        ...config,
        last_run_at: now.toISOString(),
      });
    }
  } finally {
    isReminderCheckRunning = false;
  }

  return { triggeredCount, results, checkedAt };
}

export function getNextScheduledReminderInfo(
  meetings: Meeting[],
  config: AutoReminderConfig
): { meetingTitle: string; triggerTimeText: string; isDueSoon: boolean } | null {
  const now = new Date();
  let closest: { meeting: Meeting; triggerAt: Date } | null = null;

  for (const m of meetings) {
    if (m.status === 'completed') continue;
    const startDt = parseMeetingDateTime(m.meeting_date, m.start_time);
    if (!startDt) continue;

    const triggerAt = new Date(startDt.getTime() - config.remind_before_minutes * 60 * 1000);
    // Still relevant if meeting started less than 15 minutes ago
    if (startDt.getTime() + 15 * 60 * 1000 < now.getTime()) continue;

    if (!closest || triggerAt.getTime() < closest.triggerAt.getTime()) {
      closest = { meeting: m, triggerAt };
    }
  }

  if (!closest) return null;

  const diffMs = closest.triggerAt.getTime() - now.getTime();
  const isDueSoon = diffMs <= 0;
  const triggerTimeText = closest.triggerAt.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    meetingTitle: closest.meeting.title,
    triggerTimeText,
    isDueSoon,
  };
}
