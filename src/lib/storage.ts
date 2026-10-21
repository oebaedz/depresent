import { Attendance, AttendanceMethod, AttendanceStatus, Meeting, SchoolProfile, Teacher } from '../types';
import { INITIAL_ATTENDANCES, INITIAL_MEETINGS, INITIAL_SCHOOL_PROFILE, INITIAL_TEACHERS } from './demoData';
import { getSupabase } from './supabase';
import { generateUUID, isValidUUID } from './uuid';

const KEY_PROFILE = 'smp_school_profile_v3';
const KEY_TEACHERS = 'smp_teachers_v3';
const KEY_MEETINGS = 'smp_meetings_v3';
const KEY_ATTENDANCES = 'smp_attendances_v3';

// Helper to ensure all IDs in an array of records are valid UUIDs
function ensureValidUUIDs<T extends { id: string }>(records: T[]): T[] {
  return records.map((item) => ({
    ...item,
    id: isValidUUID(item.id) ? item.id : generateUUID(),
  }));
}

// Initialise local storage with demo data if empty
export function initLocalStorage() {
  if (typeof window === 'undefined') return;

  if (!localStorage.getItem(KEY_PROFILE)) {
    localStorage.setItem(KEY_PROFILE, JSON.stringify(INITIAL_SCHOOL_PROFILE));
  }
  if (!localStorage.getItem(KEY_TEACHERS)) {
    localStorage.setItem(KEY_TEACHERS, JSON.stringify(ensureValidUUIDs(INITIAL_TEACHERS)));
  }
  if (!localStorage.getItem(KEY_MEETINGS)) {
    localStorage.setItem(KEY_MEETINGS, JSON.stringify(ensureValidUUIDs(INITIAL_MEETINGS)));
  }
  if (!localStorage.getItem(KEY_ATTENDANCES)) {
    localStorage.setItem(KEY_ATTENDANCES, JSON.stringify(INITIAL_ATTENDANCES));
  }
}

// ---------------------------------------------------------------------------
// SYNCHRONOUS GETTERS (0ms Local-First State Initialization)
// ---------------------------------------------------------------------------
export function getCachedProfile(): SchoolProfile {
  if (typeof window === 'undefined') return INITIAL_SCHOOL_PROFILE;
  try {
    const stored = localStorage.getItem(KEY_PROFILE);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...INITIAL_SCHOOL_PROFILE, ...parsed };
    }
  } catch {
    // fallback
  }
  return INITIAL_SCHOOL_PROFILE;
}

export function getCachedTeachers(): Teacher[] {
  if (typeof window === 'undefined') return ensureValidUUIDs(INITIAL_TEACHERS);
  try {
    const stored = localStorage.getItem(KEY_TEACHERS);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return ensureValidUUIDs(parsed);
      }
    }
  } catch {
    // fallback
  }
  return ensureValidUUIDs(INITIAL_TEACHERS);
}

export function getCachedMeetings(): Meeting[] {
  if (typeof window === 'undefined') return ensureValidUUIDs(INITIAL_MEETINGS);
  try {
    const stored = localStorage.getItem(KEY_MEETINGS);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return ensureValidUUIDs(parsed);
      }
    }
  } catch {
    // fallback
  }
  return ensureValidUUIDs(INITIAL_MEETINGS);
}

export function getCachedAttendances(): Attendance[] {
  if (typeof window === 'undefined') return INITIAL_ATTENDANCES;
  try {
    const stored = localStorage.getItem(KEY_ATTENDANCES);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return INITIAL_ATTENDANCES;
}

// ---------------------------------------------------------------------------
// 1. SCHOOL PROFILE
// ---------------------------------------------------------------------------
export async function fetchSchoolProfile(): Promise<SchoolProfile> {
  initLocalStorage();
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase.from('smp_school_profile').select('*').limit(1);
      if (!error && data && data.length > 0) {
        const row = data[0];
        const mapped: SchoolProfile = {
          ...INITIAL_SCHOOL_PROFILE,
          ...row,
          foundation_name: row.foundation_name || INITIAL_SCHOOL_PROFILE.foundation_name,
          headmaster_niy: row.headmaster_niy || row.headmaster_nip || INITIAL_SCHOOL_PROFILE.headmaster_niy,
          admin_pin: row.admin_pin || INITIAL_SCHOOL_PROFILE.admin_pin || '1234',
        };
        localStorage.setItem(KEY_PROFILE, JSON.stringify(mapped));
        if (mapped.admin_pin) {
          localStorage.setItem('smp_admin_pin', mapped.admin_pin);
        }
        return mapped;
      }
    } catch (e) {
      console.warn('Fallback to local storage for school profile:', e);
    }
  }

  return getCachedProfile();
}

export async function saveSchoolProfile(profile: SchoolProfile): Promise<SchoolProfile> {
  const currentPin = profile.admin_pin || (typeof window !== 'undefined' ? localStorage.getItem('smp_admin_pin') : undefined) || '1234';
  const cleanProfile: SchoolProfile = {
    ...profile,
    id: isValidUUID(profile.id) ? profile.id : generateUUID(),
    admin_pin: currentPin,
  };
  // Instant local-first persist
  localStorage.setItem(KEY_PROFILE, JSON.stringify(cleanProfile));
  if (typeof window !== 'undefined') {
    localStorage.setItem('smp_admin_pin', currentPin);
  }

  const supabase = getSupabase();
  if (supabase) {
    const payload = {
      ...cleanProfile,
      headmaster_nip: cleanProfile.headmaster_niy, // compatibility
    };
    (async () => {
      try {
        const { error } = await supabase.from('smp_school_profile').upsert(payload);
        if (error) console.error('Error updating school profile in Supabase:', error.message);
      } catch (e) {
        console.warn('Could not sync school profile to Supabase:', e);
      }
    })();
  }
  return cleanProfile;
}

export async function updateAdminPinInDb(newPin: string): Promise<boolean> {
  const pin = newPin.trim();
  if (!pin) return false;

  if (typeof window !== 'undefined') {
    localStorage.setItem('smp_admin_pin', pin);
    const cached = getCachedProfile();
    const updated = { ...cached, admin_pin: pin };
    localStorage.setItem(KEY_PROFILE, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('smp_pin_updated', { detail: pin }));
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      const cached = getCachedProfile();
      const { error } = await supabase
        .from('smp_school_profile')
        .update({ admin_pin: pin })
        .eq('id', cached.id);

      if (error) {
        // Fallback: update any row in smp_school_profile
        await supabase.from('smp_school_profile').update({ admin_pin: pin }).neq('school_name', '');
      }
      return true;
    } catch (e) {
      console.warn('Could not sync admin PIN update to Supabase:', e);
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// 2. TEACHERS
// ---------------------------------------------------------------------------
export async function fetchTeachers(): Promise<Teacher[]> {
  initLocalStorage();
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase.from('smp_teachers').select('*').order('name', { ascending: true });
      if (!error && Array.isArray(data)) {
        if (data.length > 0) {
          const mappedTeachers: Teacher[] = data.map((row) => ({
            id: row.id,
            ptk_id: row.ptk_id,
            niy: row.niy || row.nip || '-',
            nip: row.nip || row.niy || '-',
            name: row.name,
            phone_wa: row.phone_wa || '',
            rank_group: row.rank_group || 'Guru Tetap Yayasan (GTY)',
            role_title: row.role_title || 'Guru Mata Pelajaran',
            avatar_url: row.avatar_url || '',
            is_active: row.is_active !== false,
            created_at: row.created_at,
          }));

          localStorage.setItem(KEY_TEACHERS, JSON.stringify(mappedTeachers));
          return mappedTeachers;
        } else {
          // Table exists but is empty -> auto seed from local
          const localTeachers = getCachedTeachers();
          const dbPayload = localTeachers.map((t) => ({
            id: t.id,
            ptk_id: t.ptk_id,
            niy: t.niy || t.nip || '-',
            nip: t.niy || t.nip || '-',
            name: t.name,
            phone_wa: t.phone_wa || '',
            rank_group: t.rank_group,
            role_title: t.role_title,
            avatar_url: t.avatar_url || '',
            is_active: t.is_active,
          }));
          (async () => {
            try {
              await supabase.from('smp_teachers').upsert(dbPayload, { onConflict: 'ptk_id' });
            } catch (e) {
              console.warn(e);
            }
          })();
          return localTeachers;
        }
      }
    } catch (e) {
      console.warn('Fallback to local storage for teachers:', e);
    }
  }

  return getCachedTeachers();
}

export async function saveTeacher(teacher: Teacher): Promise<Teacher> {
  const cleanId = isValidUUID(teacher.id) ? teacher.id : generateUUID();
  const cleanTeacher: Teacher = {
    ...teacher,
    id: cleanId,
    niy: teacher.niy || teacher.nip || '-',
    nip: teacher.niy || teacher.nip || '-',
    ptk_id: teacher.ptk_id.trim(),
  };

  // Instant local-first optimistic update
  const teachers = getCachedTeachers();
  const index = teachers.findIndex((t) => t.id === cleanTeacher.id || t.ptk_id === cleanTeacher.ptk_id);
  let updated: Teacher[];
  if (index >= 0) {
    updated = [...teachers];
    updated[index] = cleanTeacher;
  } else {
    updated = [cleanTeacher, ...teachers];
  }
  localStorage.setItem(KEY_TEACHERS, JSON.stringify(updated));

  const supabase = getSupabase();
  if (supabase) {
    const dbPayload = {
      id: cleanTeacher.id,
      ptk_id: cleanTeacher.ptk_id,
      niy: cleanTeacher.niy,
      nip: cleanTeacher.niy,
      name: cleanTeacher.name,
      phone_wa: cleanTeacher.phone_wa,
      rank_group: cleanTeacher.rank_group,
      role_title: cleanTeacher.role_title,
      avatar_url: cleanTeacher.avatar_url || '',
      is_active: cleanTeacher.is_active,
    };

    (async () => {
      try {
        const { error } = await supabase.from('smp_teachers').upsert(dbPayload, { onConflict: 'ptk_id' });
        if (error) console.error('Gagal simpan guru ke Supabase:', error.message);
      } catch (e) {
        console.warn('Could not sync teacher to Supabase:', e);
      }
    })();
  }
  return cleanTeacher;
}

export async function deleteTeacher(id: string): Promise<void> {
  // 1. Instant local update
  const teachers = getCachedTeachers();
  const updated = teachers.filter((t) => t.id !== id);
  localStorage.setItem(KEY_TEACHERS, JSON.stringify(updated));

  const attendances = getCachedAttendances();
  const updatedAtt = attendances.filter((a) => a.teacher_id !== id);
  localStorage.setItem(KEY_ATTENDANCES, JSON.stringify(updatedAtt));

  // 2. Background sync
  const supabase = getSupabase();
  if (supabase) {
    (async () => {
      try {
        await supabase.from('smp_attendances').delete().eq('teacher_id', id);
        await supabase.from('smp_teachers').delete().eq('id', id);
      } catch (e) {
        console.warn('Could not delete teacher in Supabase:', e);
      }
    })();
  }
}

export async function bulkImportTeachers(newTeachers: Omit<Teacher, 'id'>[]): Promise<number> {
  const currentTeachers = getCachedTeachers();
  const existingPtkMap = new Map<string, Teacher>();
  currentTeachers.forEach((t) => existingPtkMap.set(t.ptk_id.trim().toLowerCase(), t));

  const toSave: Teacher[] = [];
  let count = 0;

  for (const item of newTeachers) {
    const cleanPtk = item.ptk_id.trim();
    if (!cleanPtk) continue;

    const existing = existingPtkMap.get(cleanPtk.toLowerCase());
    const niyVal = item.niy || item.nip || '-';
    const teacherObj: Teacher = {
      id: existing && isValidUUID(existing.id) ? existing.id : generateUUID(),
      ptk_id: cleanPtk,
      niy: niyVal,
      nip: niyVal,
      name: item.name || 'Guru Baru',
      phone_wa: item.phone_wa || '',
      rank_group: item.rank_group || 'Guru Tetap Yayasan (GTY)',
      role_title: item.role_title || 'Guru Mata Pelajaran',
      avatar_url: item.avatar_url || '',
      is_active: true,
    };
    toSave.push(teacherObj);
    existingPtkMap.set(cleanPtk.toLowerCase(), teacherObj);
    count++;
  }

  const merged = Array.from(existingPtkMap.values());
  localStorage.setItem(KEY_TEACHERS, JSON.stringify(merged));

  const supabase = getSupabase();
  if (supabase && toSave.length > 0) {
    const dbPayload = toSave.map((t) => ({
      id: t.id,
      ptk_id: t.ptk_id,
      niy: t.niy,
      nip: t.niy,
      name: t.name,
      phone_wa: t.phone_wa,
      rank_group: t.rank_group,
      role_title: t.role_title,
      avatar_url: t.avatar_url,
      is_active: t.is_active,
    }));
    (async () => {
      try {
        await supabase.from('smp_teachers').upsert(dbPayload, { onConflict: 'ptk_id' });
      } catch (e) {
        console.warn('Bulk import sync warning:', e);
      }
    })();
  }

  return count;
}

// ---------------------------------------------------------------------------
// 3. MEETINGS
// ---------------------------------------------------------------------------
export async function fetchMeetings(): Promise<Meeting[]> {
  initLocalStorage();
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('smp_meetings')
        .select('*')
        .order('meeting_date', { ascending: false });

      if (!error && Array.isArray(data)) {
        if (data.length > 0) {
          const mappedMeetings: Meeting[] = data.map((row) => ({
            id: row.id,
            title: row.title,
            category: row.category,
            meeting_date: row.meeting_date,
            start_time: row.start_time,
            end_time: row.end_time,
            room: row.room,
            leader_name: row.leader_name,
            leader_niy: row.leader_niy || '',
            secretary_name: row.secretary_name || '',
            secretary_niy: row.secretary_niy || '',
            tolerance_minutes: row.tolerance_minutes || 15,
            status: row.status || 'active',
            notes: row.notes || '',
            created_at: row.created_at,
          }));

          localStorage.setItem(KEY_MEETINGS, JSON.stringify(mappedMeetings));
          return mappedMeetings;
        } else {
          // Table exists but is empty -> auto seed
          const localMeetings = getCachedMeetings();
          (async () => {
            try {
              await supabase.from('smp_meetings').upsert(localMeetings);
            } catch (e) {
              console.warn(e);
            }
          })();
          return localMeetings;
        }
      }
    } catch (e) {
      console.warn('Fallback to local storage for meetings:', e);
    }
  }

  return getCachedMeetings();
}

// Single meeting fetch optimized for rapid mobile checkin lookup
export async function fetchSingleMeeting(meetingId: string): Promise<Meeting | null> {
  const cached = getCachedMeetings().find((m) => m.id === meetingId);
  if (cached) return cached;

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('smp_meetings').select('*').eq('id', meetingId).single();
      if (!error && data) {
        const mapped: Meeting = {
          id: data.id,
          title: data.title,
          category: data.category,
          meeting_date: data.meeting_date,
          start_time: data.start_time,
          end_time: data.end_time,
          room: data.room,
          leader_name: data.leader_name,
          leader_niy: data.leader_niy || '',
          secretary_name: data.secretary_name || '',
          secretary_niy: data.secretary_niy || '',
          tolerance_minutes: data.tolerance_minutes || 15,
          status: data.status || 'active',
          notes: data.notes || '',
          created_at: data.created_at,
        };
        const current = getCachedMeetings();
        localStorage.setItem(KEY_MEETINGS, JSON.stringify([mapped, ...current.filter((m) => m.id !== mapped.id)]));
        return mapped;
      }
    } catch (e) {
      console.warn('Single meeting fetch error:', e);
    }
  }
  return null;
}

export async function saveMeeting(meeting: Meeting): Promise<Meeting> {
  const cleanMeeting: Meeting = {
    ...meeting,
    id: isValidUUID(meeting.id) ? meeting.id : generateUUID(),
  };

  // Instant local-first update
  const meetings = getCachedMeetings();
  const index = meetings.findIndex((m) => m.id === cleanMeeting.id);
  let updated: Meeting[];
  if (index >= 0) {
    updated = [...meetings];
    updated[index] = cleanMeeting;
  } else {
    updated = [cleanMeeting, ...meetings];
  }
  localStorage.setItem(KEY_MEETINGS, JSON.stringify(updated));

  const supabase = getSupabase();
  if (supabase) {
    (async () => {
      try {
        const { error } = await supabase.from('smp_meetings').upsert(cleanMeeting);
        if (error) console.error('Error saving meeting to Supabase:', error.message);
      } catch (e) {
        console.warn('Could not sync meeting to Supabase:', e);
      }
    })();
  }
  return cleanMeeting;
}

export async function deleteMeeting(id: string): Promise<void> {
  // Instant local update
  const meetings = getCachedMeetings();
  const updated = meetings.filter((m) => m.id !== id);
  localStorage.setItem(KEY_MEETINGS, JSON.stringify(updated));

  const attendances = getCachedAttendances();
  const updatedAtt = attendances.filter((a) => a.meeting_id !== id);
  localStorage.setItem(KEY_ATTENDANCES, JSON.stringify(updatedAtt));

  const supabase = getSupabase();
  if (supabase) {
    (async () => {
      try {
        await supabase.from('smp_attendances').delete().eq('meeting_id', id);
        await supabase.from('smp_meetings').delete().eq('id', id);
      } catch (e) {
        console.warn('Could not delete meeting in Supabase:', e);
      }
    })();
  }
}

// ---------------------------------------------------------------------------
// 3.1 MEETING CATEGORIES
// ---------------------------------------------------------------------------
const KEY_MEETING_CATEGORIES = 'smp_meeting_categories_v1';
export const DEFAULT_MEETING_CATEGORIES: string[] = [
  'Rapat Dinas',
  'Workshop',
  'Briefing',
  'MGMP',
  'Upacara',
  'Evaluasi & Raker',
  'Lainnya',
];

export function getMeetingCategories(): string[] {
  if (typeof window === 'undefined') return DEFAULT_MEETING_CATEGORIES;
  try {
    const stored = localStorage.getItem(KEY_MEETING_CATEGORIES);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_MEETING_CATEGORIES;
}

export function saveMeetingCategories(categories: string[]): string[] {
  const clean = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEY_MEETING_CATEGORIES, JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent('smp_categories_updated', { detail: clean }));
  }
  return clean;
}

export function addMeetingCategory(newCat: string): string[] {
  const cat = newCat.trim();
  if (!cat) return getMeetingCategories();
  const current = getMeetingCategories();
  if (!current.includes(cat)) {
    const updated = [...current, cat];
    return saveMeetingCategories(updated);
  }
  return current;
}

export function deleteMeetingCategory(catToDelete: string): string[] {
  const current = getMeetingCategories();
  const filtered = current.filter((c) => c !== catToDelete);
  return saveMeetingCategories(filtered.length > 0 ? filtered : DEFAULT_MEETING_CATEGORIES);
}

// ---------------------------------------------------------------------------
// 3.2 FINALIZE MEETING ATTENDANCE AS ABSENT (TIDAK HADIR)
// ---------------------------------------------------------------------------
export async function completeMeetingAndMarkAbsent(
  meetingId: string,
  teachers: Teacher[]
): Promise<{ updatedCount: number; attendances: Attendance[] }> {
  // 1. Mark meeting as completed
  const allMeetings = getCachedMeetings();
  const mIndex = allMeetings.findIndex((m) => m.id === meetingId);
  if (mIndex >= 0) {
    allMeetings[mIndex] = { ...allMeetings[mIndex], status: 'completed' };
    localStorage.setItem(KEY_MEETINGS, JSON.stringify(allMeetings));
  }

  // 2. Find active teachers without attendance in this meeting
  const allAttendances = getCachedAttendances();
  const meetingAtts = allAttendances.filter((a) => a.meeting_id === meetingId);
  const attendedTeacherIds = new Set(meetingAtts.map((a) => a.teacher_id));

  const activeTeachers = teachers.filter((t) => t.is_active);
  const nowIso = new Date().toISOString();
  const newAbsentAttendances: Attendance[] = [];

  for (const t of activeTeachers) {
    if (!attendedTeacherIds.has(t.id)) {
      const absentAtt: Attendance = {
        id: generateUUID(),
        meeting_id: meetingId,
        teacher_id: t.id,
        check_in_time: nowIso,
        status: 'alpa',
        method: 'manual',
        notes: 'Tidak Hadir (Otomatis saat rapat selesai)',
        wa_notified: false,
      };
      newAbsentAttendances.push(absentAtt);
      allAttendances.unshift(absentAtt);
    }
  }

  // 3. Persist attendances locally
  localStorage.setItem(KEY_ATTENDANCES, JSON.stringify(allAttendances));

  // 4. Background sync to Supabase
  const supabase = getSupabase();
  if (supabase) {
    (async () => {
      try {
        if (mIndex >= 0) {
          await supabase.from('smp_meetings').update({ status: 'completed' }).eq('id', meetingId);
        }
        if (newAbsentAttendances.length > 0) {
          await supabase.from('smp_attendances').upsert(newAbsentAttendances);
        }
      } catch (e) {
        console.warn('Could not sync completed meeting & absents to Supabase:', e);
      }
    })();
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smp_attendance_recorded'));
  }

  return { updatedCount: newAbsentAttendances.length, attendances: allAttendances };
}

// ---------------------------------------------------------------------------
// 4. ATTENDANCES
// ---------------------------------------------------------------------------
export async function fetchAttendances(meetingId?: string): Promise<Attendance[]> {
  initLocalStorage();
  const supabase = getSupabase();

  if (supabase) {
    try {
      let query = supabase.from('smp_attendances').select('*');
      if (meetingId) {
        query = query.eq('meeting_id', meetingId);
      }
      const { data, error } = await query.order('check_in_time', { ascending: false });
      if (!error && Array.isArray(data)) {
        if (!meetingId) {
          localStorage.setItem(KEY_ATTENDANCES, JSON.stringify(data));
        }
        return data as Attendance[];
      }
    } catch (e) {
      console.warn('Fallback to local storage for attendances:', e);
    }
  }

  const all = getCachedAttendances();
  if (meetingId) {
    return all.filter((a) => a.meeting_id === meetingId);
  }
  return all;
}

export async function recordAttendance(params: {
  meetingId: string;
  teacherId: string;
  status: AttendanceStatus;
  method: AttendanceMethod;
  notes?: string;
  waNotified?: boolean;
}): Promise<{ attendance: Attendance; isNew: boolean }> {
  const all = getCachedAttendances();
  const existingIndex = all.findIndex((a) => a.meeting_id === params.meetingId && a.teacher_id === params.teacherId);

  const checkInTime = new Date().toISOString();
  let att: Attendance;
  let isNew = false;

  if (existingIndex >= 0) {
    att = {
      ...all[existingIndex],
      status: params.status,
      method: params.method,
      check_in_time: checkInTime,
      notes: params.notes ?? all[existingIndex].notes,
      wa_notified: params.waNotified ?? all[existingIndex].wa_notified,
    };
    all[existingIndex] = att;
  } else {
    isNew = true;
    att = {
      id: generateUUID(),
      meeting_id: params.meetingId,
      teacher_id: params.teacherId,
      check_in_time: checkInTime,
      status: params.status,
      method: params.method,
      notes: params.notes || '',
      wa_notified: params.waNotified || false,
    };
    all.unshift(att);
  }

  // Instant local persist
  localStorage.setItem(KEY_ATTENDANCES, JSON.stringify(all));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smp_attendance_recorded', { detail: att }));
  }

  // Background sync to Supabase
  const supabase = getSupabase();
  if (supabase) {
    (async () => {
      try {
        const { error } = await supabase.from('smp_attendances').upsert(att);
        if (error) console.error('Error saving attendance to Supabase:', error.message);
      } catch (e) {
        console.warn('Could not sync attendance to Supabase:', e);
      }
    })();
  }

  return { attendance: att, isNew };
}

export async function deleteAttendance(id: string): Promise<void> {
  const attendances = getCachedAttendances();
  const updated = attendances.filter((a) => a.id !== id);
  localStorage.setItem(KEY_ATTENDANCES, JSON.stringify(updated));

  const supabase = getSupabase();
  if (supabase) {
    (async () => {
      try {
        const { error } = await supabase.from('smp_attendances').delete().eq('id', id);
        if (error) console.error('Error deleting attendance in Supabase:', error.message);
      } catch (e) {
        console.warn('Could not delete attendance in Supabase:', e);
      }
    })();
  }
}

export async function syncInitialDataToSupabase(): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, message: 'Klien Supabase belum terhubung. Periksa URL dan Anon Key.' };
  }

  try {
    // 1. Sync Profile
    const profile = getCachedProfile();
    const profilePayload = {
      ...profile,
      headmaster_nip: profile.headmaster_niy,
    };
    await supabase.from('smp_school_profile').upsert(profilePayload);

    // 2. Sync Teachers
    const teachers = getCachedTeachers();
    const teachersPayload = teachers.map((t) => ({
      id: t.id,
      ptk_id: t.ptk_id,
      niy: t.niy || t.nip || '-',
      nip: t.niy || t.nip || '-',
      name: t.name,
      phone_wa: t.phone_wa || '',
      rank_group: t.rank_group,
      role_title: t.role_title,
      avatar_url: t.avatar_url || '',
      is_active: t.is_active,
    }));
    await supabase.from('smp_teachers').upsert(teachersPayload, { onConflict: 'ptk_id' });

    // 3. Sync Meetings
    const meetings = getCachedMeetings();
    await supabase.from('smp_meetings').upsert(meetings);

    return {
      success: true,
      message: `Berhasil menyinkronkan data profil sekolah, ${teachers.length} guru, dan ${meetings.length} agenda rapat ke database Supabase!`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Gagal menyinkronkan data ke Supabase: ${msg}` };
  }
}
