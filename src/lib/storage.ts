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

// 1. SCHOOL PROFILE
export async function fetchSchoolProfile(): Promise<SchoolProfile> {
  initLocalStorage();
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase.from('smp_school_profile').select('*').limit(1);
      if (!error) {
        if (data && data.length > 0) {
          const row = data[0];
          const mapped: SchoolProfile = {
            ...INITIAL_SCHOOL_PROFILE,
            ...row,
            foundation_name: row.foundation_name || INITIAL_SCHOOL_PROFILE.foundation_name,
            headmaster_niy: row.headmaster_niy || row.headmaster_nip || INITIAL_SCHOOL_PROFILE.headmaster_niy,
          };
          localStorage.setItem(KEY_PROFILE, JSON.stringify(mapped));
          return mapped;
        } else {
          // Table exists in Supabase but is empty -> seed initial profile directly
          const initialPayload = {
            ...INITIAL_SCHOOL_PROFILE,
            id: isValidUUID(INITIAL_SCHOOL_PROFILE.id) ? INITIAL_SCHOOL_PROFILE.id : generateUUID(),
            headmaster_nip: INITIAL_SCHOOL_PROFILE.headmaster_niy,
          };
          await supabase.from('smp_school_profile').insert([initialPayload]);
          localStorage.setItem(KEY_PROFILE, JSON.stringify(initialPayload));
          return initialPayload;
        }
      }
    } catch (e) {
      console.warn('Fallback to local storage for school profile:', e);
    }
  }

  const stored = localStorage.getItem(KEY_PROFILE);
  return stored ? JSON.parse(stored) : INITIAL_SCHOOL_PROFILE;
}

export async function saveSchoolProfile(profile: SchoolProfile): Promise<SchoolProfile> {
  const cleanProfile: SchoolProfile = {
    ...profile,
    id: isValidUUID(profile.id) ? profile.id : generateUUID(),
  };
  localStorage.setItem(KEY_PROFILE, JSON.stringify(cleanProfile));

  const supabase = getSupabase();
  if (supabase) {
    try {
      const payload = {
        ...cleanProfile,
        headmaster_nip: cleanProfile.headmaster_niy, // compatibility
      };
      const { data: existing } = await supabase.from('smp_school_profile').select('id').limit(1);
      if (existing && existing.length > 0) {
        const { error } = await supabase.from('smp_school_profile').update(payload).eq('id', existing[0].id);
        if (error) console.error('Error updating school profile in Supabase:', error.message);
      } else {
        const { error } = await supabase.from('smp_school_profile').insert([payload]);
        if (error) console.error('Error inserting school profile in Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Could not sync school profile to Supabase:', e);
    }
  }
  return cleanProfile;
}

// 2. TEACHERS
export async function fetchTeachers(): Promise<Teacher[]> {
  initLocalStorage();
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase.from('smp_teachers').select('*').order('name', { ascending: true });
      if (!error && Array.isArray(data)) {
        if (data.length > 0) {
          // Map database columns
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
          // Supabase table smp_teachers exists but is currently empty!
          // Auto-seed current teachers to Supabase so the user's DB immediately has data
          const stored = localStorage.getItem(KEY_TEACHERS);
          const rawTeachers: Teacher[] = stored ? JSON.parse(stored) : INITIAL_TEACHERS;
          const seedTeachers = ensureValidUUIDs(rawTeachers);

          const dbPayload = seedTeachers.map((t) => ({
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

          await supabase.from('smp_teachers').upsert(dbPayload, { onConflict: 'ptk_id' });
          localStorage.setItem(KEY_TEACHERS, JSON.stringify(seedTeachers));
          return seedTeachers;
        }
      }
      if (error) {
        console.warn('Supabase fetchTeachers error:', error.message);
      }
    } catch (e) {
      console.warn('Fallback to local storage for teachers:', e);
    }
  }

  const stored = localStorage.getItem(KEY_TEACHERS);
  const raw: Teacher[] = stored ? JSON.parse(stored) : INITIAL_TEACHERS;
  return ensureValidUUIDs(raw);
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

  const teachers = await fetchTeachers();
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
    try {
      const dbPayload = {
        id: cleanTeacher.id,
        ptk_id: cleanTeacher.ptk_id,
        niy: cleanTeacher.niy,
        nip: cleanTeacher.niy, // write both for compatibility
        name: cleanTeacher.name,
        phone_wa: cleanTeacher.phone_wa,
        rank_group: cleanTeacher.rank_group,
        role_title: cleanTeacher.role_title,
        avatar_url: cleanTeacher.avatar_url || '',
        is_active: cleanTeacher.is_active,
      };

      const { error } = await supabase.from('smp_teachers').upsert(dbPayload, { onConflict: 'ptk_id' });
      if (error) {
        console.error('Gagal simpan guru ke Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Could not sync teacher to Supabase:', e);
    }
  }
  return cleanTeacher;
}

export async function deleteTeacher(id: string): Promise<void> {
  const teachers = await fetchTeachers();
  const updated = teachers.filter((t) => t.id !== id);
  localStorage.setItem(KEY_TEACHERS, JSON.stringify(updated));

  // Also remove attendances for this teacher in local storage
  const attendances = await fetchAttendances();
  const updatedAtt = attendances.filter((a) => a.teacher_id !== id);
  localStorage.setItem(KEY_ATTENDANCES, JSON.stringify(updatedAtt));

  const supabase = getSupabase();
  if (supabase) {
    try {
      // Delete attendances first to prevent foreign key constraint violations
      await supabase.from('smp_attendances').delete().eq('teacher_id', id);
      const { error } = await supabase.from('smp_teachers').delete().eq('id', id);
      if (error) console.error('Could not delete teacher in Supabase:', error.message);
    } catch (e) {
      console.warn('Could not delete teacher in Supabase:', e);
    }
  }
}

export async function bulkImportTeachers(newTeachers: Omit<Teacher, 'id'>[]): Promise<number> {
  const currentTeachers = await fetchTeachers();
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
    try {
      const dbPayload = toSave.map((t) => ({
        id: t.id,
        ptk_id: t.ptk_id,
        niy: t.niy,
        nip: t.niy,
        name: t.name,
        phone_wa: t.phone_wa,
        rank_group: t.rank_group,
        role_title: t.role_title,
        avatar_url: t.avatar_url || '',
        is_active: t.is_active,
      }));

      const { error } = await supabase.from('smp_teachers').upsert(dbPayload, { onConflict: 'ptk_id' });
      if (error) {
        console.error('Error bulk import to Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Could not sync bulk teachers to Supabase:', e);
    }
  }

  return count;
}

// 3. MEETINGS
export async function fetchMeetings(): Promise<Meeting[]> {
  initLocalStorage();
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase.from('smp_meetings').select('*').order('meeting_date', { ascending: false });
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
          // Table exists in Supabase but is empty -> auto seed initial meetings
          const stored = localStorage.getItem(KEY_MEETINGS);
          const rawMeetings: Meeting[] = stored ? JSON.parse(stored) : INITIAL_MEETINGS;
          const seedMeetings = ensureValidUUIDs(rawMeetings);

          await supabase.from('smp_meetings').upsert(seedMeetings);
          localStorage.setItem(KEY_MEETINGS, JSON.stringify(seedMeetings));
          return seedMeetings;
        }
      }
    } catch (e) {
      console.warn('Fallback to local storage for meetings:', e);
    }
  }

  const stored = localStorage.getItem(KEY_MEETINGS);
  const raw: Meeting[] = stored ? JSON.parse(stored) : INITIAL_MEETINGS;
  return ensureValidUUIDs(raw);
}

export async function saveMeeting(meeting: Meeting): Promise<Meeting> {
  const cleanMeeting: Meeting = {
    ...meeting,
    id: isValidUUID(meeting.id) ? meeting.id : generateUUID(),
  };

  const meetings = await fetchMeetings();
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
    try {
      const { error } = await supabase.from('smp_meetings').upsert(cleanMeeting);
      if (error) {
        console.error('Error saving meeting to Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Could not sync meeting to Supabase:', e);
    }
  }
  return cleanMeeting;
}

export async function deleteMeeting(id: string): Promise<void> {
  const meetings = await fetchMeetings();
  const updated = meetings.filter((m) => m.id !== id);
  localStorage.setItem(KEY_MEETINGS, JSON.stringify(updated));

  // Also remove attendances for this meeting in local storage
  const attendances = await fetchAttendances();
  const updatedAtt = attendances.filter((a) => a.meeting_id !== id);
  localStorage.setItem(KEY_ATTENDANCES, JSON.stringify(updatedAtt));

  const supabase = getSupabase();
  if (supabase) {
    try {
      // Delete attendances first to prevent foreign key constraint violations
      await supabase.from('smp_attendances').delete().eq('meeting_id', id);
      const { error } = await supabase.from('smp_meetings').delete().eq('id', id);
      if (error) console.error('Could not delete meeting in Supabase:', error.message);
    } catch (e) {
      console.warn('Could not delete meeting in Supabase:', e);
    }
  }
}

// 4. ATTENDANCES
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
        return data as Attendance[];
      }
    } catch (e) {
      console.warn('Fallback to local storage for attendances:', e);
    }
  }

  const stored = localStorage.getItem(KEY_ATTENDANCES);
  const all: Attendance[] = stored ? JSON.parse(stored) : INITIAL_ATTENDANCES;
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
  const all = await fetchAttendances();
  const existingIndex = all.findIndex((a) => a.meeting_id === params.meetingId && a.teacher_id === params.teacherId);

  const checkInTime = new Date().toISOString();
  let att: Attendance;
  let isNew = false;

  if (existingIndex >= 0) {
    att = {
      ...all[existingIndex],
      status: params.status,
      method: params.method,
      notes: params.notes || all[existingIndex].notes,
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

  localStorage.setItem(KEY_ATTENDANCES, JSON.stringify(all));

  const supabase = getSupabase();
  if (supabase) {
    try {
      // Validate that meetingId and teacherId are UUIDs before sending to Supabase
      if (isValidUUID(att.meeting_id) && isValidUUID(att.teacher_id)) {
        const { error } = await supabase.from('smp_attendances').upsert(att, { onConflict: 'meeting_id,teacher_id' });
        if (error) {
          console.error('Error saving attendance to Supabase:', error.message);
        }
      }
    } catch (e) {
      console.warn('Could not sync attendance to Supabase:', e);
    }
  }

  return { attendance: att, isNew };
}

export async function deleteAttendance(id: string): Promise<void> {
  const all = await fetchAttendances();
  const updated = all.filter((a) => a.id !== id);
  localStorage.setItem(KEY_ATTENDANCES, JSON.stringify(updated));

  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.from('smp_attendances').delete().eq('id', id);
    } catch (e) {
      console.warn('Could not delete attendance in Supabase:', e);
    }
  }
}

// 5. SEED / INITIAL SYNC TO SUPABASE
export async function syncInitialDataToSupabase(): Promise<{
  success: boolean;
  message: string;
  countTeachers: number;
  countMeetings: number;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      message: 'Supabase belum terhubung. Periksa URL dan Anon Key terlebih dahulu.',
      countTeachers: 0,
      countMeetings: 0,
    };
  }

  try {
    // 1. Sync School Profile
    const profile = await fetchSchoolProfile();
    const cleanProfilePayload = {
      ...profile,
      id: isValidUUID(profile.id) ? profile.id : generateUUID(),
      headmaster_nip: profile.headmaster_niy,
    };
    const { error: pErr } = await supabase.from('smp_school_profile').upsert(cleanProfilePayload);
    if (pErr) throw new Error(`Gagal sync profil: ${pErr.message}`);

    // 2. Sync Teachers
    const rawTeachers = await fetchTeachers();
    const teachers = ensureValidUUIDs(rawTeachers);
    const teacherPayload = teachers.map((t) => ({
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
    const { error: tErr } = await supabase.from('smp_teachers').upsert(teacherPayload, { onConflict: 'ptk_id' });
    if (tErr) throw new Error(`Gagal sync guru: ${tErr.message}`);

    // 3. Sync Meetings
    const rawMeetings = await fetchMeetings();
    const meetings = ensureValidUUIDs(rawMeetings);
    const { error: mErr } = await supabase.from('smp_meetings').upsert(meetings);
    if (mErr) throw new Error(`Gagal sync rapat: ${mErr.message}`);

    // Save cleaned UUID versions in local storage
    localStorage.setItem(KEY_PROFILE, JSON.stringify(cleanProfilePayload));
    localStorage.setItem(KEY_TEACHERS, JSON.stringify(teachers));
    localStorage.setItem(KEY_MEETINGS, JSON.stringify(meetings));

    return {
      success: true,
      message: `Berhasil menyinkronkan profil yayasan, ${teachers.length} guru, dan ${meetings.length} rapat ke database Supabase Anda!`,
      countTeachers: teachers.length,
      countMeetings: meetings.length,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Sinkronisasi gagal: ${errorMsg}`,
      countTeachers: 0,
      countMeetings: 0,
    };
  }
}
