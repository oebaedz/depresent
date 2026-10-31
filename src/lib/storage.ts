import { Attendance, AttendanceMethod, AttendanceStatus, DocumentSignature, DocumentType, Invitation, Meeting, RsvpStatus, SchoolProfile, SignerRole, Teacher } from '../types';
import { INITIAL_ATTENDANCES, INITIAL_MEETINGS, INITIAL_SCHOOL_PROFILE, INITIAL_TEACHERS } from './demoData';
import { getSupabase } from './supabase';
import { generateUUID, isValidUUID } from './uuid';
import { getTeacherGroup, sortTeachersStructuralFirst } from './teacherGroups';

const KEY_PROFILE = 'smp_school_profile_v3';
const KEY_TEACHERS = 'smp_teachers_v3';
const KEY_MEETINGS = 'smp_meetings_v3';
const KEY_ATTENDANCES = 'smp_attendances_v3';
const KEY_INVITATIONS = 'smp_invitations_v1';
const KEY_SIGNATURES = 'smp_document_signatures_v1';

// Helper to ensure all IDs in an array of records are valid UUIDs
function ensureValidUUIDs<T extends { id: string }>(records: T[]): T[] {
  return records.map((item) => ({
    ...item,
    id: isValidUUID(item.id) ? item.id : generateUUID(),
  }));
}

// Initialise local storage and purge any old demo data
export function initLocalStorage() {
  if (typeof window === 'undefined') return;

  try {
    // Purge legacy demo profile
    const rawProfile = localStorage.getItem(KEY_PROFILE);
    if (rawProfile && (rawProfile.includes('SMP HARAPAN BANGSA') || rawProfile.includes('YAYASAN PENDIDIKAN HARAPAN BANGSA'))) {
      localStorage.removeItem(KEY_PROFILE);
    }
    // Purge legacy demo teachers
    const rawTeachers = localStorage.getItem(KEY_TEACHERS);
    if (rawTeachers && (rawTeachers.includes('Bambang Sudarsono') || rawTeachers.includes('Ahmad Fauzi') || rawTeachers.includes('Hendra Gunawan'))) {
      localStorage.removeItem(KEY_TEACHERS);
    }
    // Purge legacy demo meetings
    const rawMeetings = localStorage.getItem(KEY_MEETINGS);
    if (rawMeetings && (rawMeetings.includes('Rapat Koordinasi Dewan Guru') || rawMeetings.includes('Kurikulum Merdeka Sekolah Yayasan') || rawMeetings.includes('PORSENI'))) {
      localStorage.removeItem(KEY_MEETINGS);
    }
  } catch (e) {
    console.warn('Error purging legacy demo data:', e);
  }

  if (!localStorage.getItem(KEY_PROFILE)) {
    localStorage.setItem(KEY_PROFILE, JSON.stringify(INITIAL_SCHOOL_PROFILE));
  }
  if (!localStorage.getItem(KEY_TEACHERS)) {
    localStorage.setItem(KEY_TEACHERS, JSON.stringify([]));
  }
  if (!localStorage.getItem(KEY_MEETINGS)) {
    localStorage.setItem(KEY_MEETINGS, JSON.stringify([]));
  }
  if (!localStorage.getItem(KEY_ATTENDANCES)) {
    localStorage.setItem(KEY_ATTENDANCES, JSON.stringify([]));
  }
  if (!localStorage.getItem(KEY_INVITATIONS)) {
    localStorage.setItem(KEY_INVITATIONS, JSON.stringify([]));
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
      if (parsed.school_name === 'SMP HARAPAN BANGSA') {
        parsed.school_name = '';
        parsed.foundation_name = '';
      }
      return { ...INITIAL_SCHOOL_PROFILE, ...parsed };
    }
  } catch {
    // fallback
  }
  return INITIAL_SCHOOL_PROFILE;
}

export function getCachedTeachers(): Teacher[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(KEY_TEACHERS);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // filter out legacy demo data
        const clean = parsed.filter(
          (t: Teacher) =>
            !t.name?.includes('Bambang Sudarsono') &&
            !t.name?.includes('Ahmad Fauzi') &&
            !t.name?.includes('Hendra Gunawan')
        );
        const enriched = clean.map((t: Teacher) => ({
          ...t,
          teacher_group: t.teacher_group || getTeacherGroup(t),
        }));
        return sortTeachersStructuralFirst(ensureValidUUIDs(enriched));
      }
    }
  } catch {
    // fallback
  }
  return [];
}

export function getCachedMeetings(): Meeting[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(KEY_MEETINGS);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const clean = parsed.filter(
          (m: Meeting) =>
            !m.title?.includes('Rapat Koordinasi Dewan Guru') &&
            !m.title?.includes('Kurikulum Merdeka Sekolah Yayasan') &&
            !m.title?.includes('PORSENI')
        );
        return ensureValidUUIDs(clean);
      }
    }
  } catch {
    // fallback
  }
  return [];
}

export function getCachedAttendances(): Attendance[] {
  if (typeof window === 'undefined') return [];
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
  return [];
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
          headmaster_phone: row.headmaster_phone !== undefined ? row.headmaster_phone : (row.phone || INITIAL_SCHOOL_PROFILE.headmaster_phone),
          admin_staff_name: row.admin_staff_name || INITIAL_SCHOOL_PROFILE.admin_staff_name,
          admin_staff_niy: row.admin_staff_niy || INITIAL_SCHOOL_PROFILE.admin_staff_niy,
          admin_staff_phone: row.admin_staff_phone || INITIAL_SCHOOL_PROFILE.admin_staff_phone,
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
        if (error) {
          if (
            error.message?.includes('headmaster_phone') ||
            error.message?.includes('admin_staff') ||
            error.code === 'PGRST204'
          ) {
            const fallback: Record<string, any> = { ...payload };
            delete fallback.headmaster_phone;
            delete fallback.admin_staff_name;
            delete fallback.admin_staff_niy;
            delete fallback.admin_staff_phone;
            await supabase.from('smp_school_profile').upsert(fallback);
          } else {
            console.error('Error updating school profile in Supabase:', error.message);
          }
        }
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

// Cache whether remote Supabase smp_teachers table contains teacher_group column
let isTeacherGroupColumnSupported: boolean | null = typeof window !== 'undefined'
  ? (localStorage.getItem('smp_has_teacher_group_col') === 'true'
      ? true
      : localStorage.getItem('smp_has_teacher_group_col') === 'false'
      ? false
      : null)
  : null;

function formatTeacherForSupabase(t: Partial<Teacher>): Record<string, any> {
  const payload: Record<string, any> = {
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
  };
  // Only include teacher_group if column is confirmed to exist on remote Supabase
  if (isTeacherGroupColumnSupported === true && t.teacher_group) {
    payload.teacher_group = t.teacher_group;
  }
  return payload;
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
          // Detect whether remote table has teacher_group column
          const hasCol = 'teacher_group' in data[0];
          isTeacherGroupColumnSupported = hasCol;
          if (typeof window !== 'undefined') {
            localStorage.setItem('smp_has_teacher_group_col', String(hasCol));
          }

          const mappedTeachers: Teacher[] = data.map((row) => {
            const rawTeacher = {
              id: row.id,
              ptk_id: row.ptk_id,
              niy: row.niy || row.nip || '-',
              nip: row.nip || row.niy || '-',
              name: row.name,
              phone_wa: row.phone_wa || '',
              rank_group: row.rank_group || 'Guru Tetap Yayasan (GTY)',
              role_title: row.role_title || 'Guru Mata Pelajaran',
              teacher_group: row.teacher_group || '',
              avatar_url: row.avatar_url || '',
              is_active: row.is_active !== false,
              created_at: row.created_at,
            };
            return {
              ...rawTeacher,
              teacher_group: rawTeacher.teacher_group || getTeacherGroup(rawTeacher),
            };
          });

          const sortedTeachers = sortTeachersStructuralFirst(mappedTeachers);
          localStorage.setItem(KEY_TEACHERS, JSON.stringify(sortedTeachers));
          return sortedTeachers;
        } else {
          // Table exists but is empty -> auto seed from local
          const localTeachers = getCachedTeachers();
          const dbPayload = localTeachers.map((t) => formatTeacherForSupabase(t));
          (async () => {
            try {
              const { error: seedErr } = await supabase.from('smp_teachers').upsert(dbPayload, { onConflict: 'ptk_id' });
              if (seedErr) {
                if (seedErr.message?.includes('teacher_group') || seedErr.code === 'PGRST204') {
                  isTeacherGroupColumnSupported = false;
                  if (typeof window !== 'undefined') localStorage.setItem('smp_has_teacher_group_col', 'false');
                  const fallbackPayload = dbPayload.map((p) => {
                    const copy = { ...p };
                    delete (copy as any).teacher_group;
                    return copy;
                  });
                  await supabase.from('smp_teachers').upsert(fallbackPayload, { onConflict: 'ptk_id' });
                }
              }
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
  const inferredGroup = teacher.teacher_group || getTeacherGroup(teacher);
  const cleanTeacher: Teacher = {
    ...teacher,
    id: cleanId,
    niy: teacher.niy || teacher.nip || '-',
    nip: teacher.niy || teacher.nip || '-',
    ptk_id: teacher.ptk_id.trim(),
    teacher_group: inferredGroup,
  };

  // Instant local-first optimistic update with structural-first sorting
  const teachers = getCachedTeachers();
  const index = teachers.findIndex((t) => t.id === cleanTeacher.id || t.ptk_id === cleanTeacher.ptk_id);
  let updated: Teacher[];
  if (index >= 0) {
    updated = [...teachers];
    updated[index] = cleanTeacher;
  } else {
    updated = [cleanTeacher, ...teachers];
  }
  const sorted = sortTeachersStructuralFirst(updated);
  localStorage.setItem(KEY_TEACHERS, JSON.stringify(sorted));

  const supabase = getSupabase();
  if (supabase) {
    const dbPayload = formatTeacherForSupabase(cleanTeacher);

    (async () => {
      try {
        const { error } = await supabase.from('smp_teachers').upsert(dbPayload, { onConflict: 'ptk_id' });
        if (error) {
          if (error.message?.includes('teacher_group') || error.code === 'PGRST204') {
            isTeacherGroupColumnSupported = false;
            if (typeof window !== 'undefined') localStorage.setItem('smp_has_teacher_group_col', 'false');
            const fallbackPayload = { ...dbPayload };
            delete fallbackPayload.teacher_group;
            await supabase.from('smp_teachers').upsert(fallbackPayload, { onConflict: 'ptk_id' });
          } else {
            console.error('Gagal simpan guru ke Supabase:', error.message);
          }
        }
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
  localStorage.setItem(KEY_TEACHERS, JSON.stringify(sortTeachersStructuralFirst(updated)));

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
    const draft = {
      ...item,
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

    const teacherObj: Teacher = {
      ...draft,
      teacher_group: item.teacher_group || getTeacherGroup(draft as Teacher),
    };

    toSave.push(teacherObj);
    existingPtkMap.set(cleanPtk.toLowerCase(), teacherObj);
    count++;
  }

  const merged = sortTeachersStructuralFirst(Array.from(existingPtkMap.values()));
  localStorage.setItem(KEY_TEACHERS, JSON.stringify(merged));

  const supabase = getSupabase();
  if (supabase && toSave.length > 0) {
    const dbPayload: Record<string, any>[] = toSave.map((t) => formatTeacherForSupabase(t));
    (async () => {
      try {
        const { error: bulkErr } = await supabase.from('smp_teachers').upsert(dbPayload, { onConflict: 'ptk_id' });
        if (bulkErr && (bulkErr.message?.includes('teacher_group') || bulkErr.code === 'PGRST204')) {
          isTeacherGroupColumnSupported = false;
          if (typeof window !== 'undefined') localStorage.setItem('smp_has_teacher_group_col', 'false');
          const fallbackPayload = dbPayload.map((p) => {
            const copy = { ...p };
            delete copy.teacher_group;
            return copy;
          });
          await supabase.from('smp_teachers').upsert(fallbackPayload, { onConflict: 'ptk_id' });
        }
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

/**
 * Mengurutkan rapat berdasarkan yang terdekat yang akan dilaksanakan:
 * 1. Rapat 'active' (sedang berlangsung) prioritas teratas.
 * 2. Rapat hari ini / masa depan (upcoming) diurutkan kronologis terdekat lebih dulu (ascending tanggal & waktu).
 * 3. Rapat masa lalu / telah selesai (completed) diurutkan mundur (descending).
 */
export function sortMeetingsClosestFirst(meetings: Meeting[]): Meeting[] {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return [...meetings].sort((a, b) => {
    // 1. Rapat aktif selalu paling atas
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (b.status === 'active' && a.status !== 'active') return 1;

    const aDateTime = `${a.meeting_date}T${a.start_time || '00:00'}`;
    const bDateTime = `${b.meeting_date}T${b.start_time || '00:00'}`;

    const aIsUpcoming = a.status !== 'completed' && (a.meeting_date > todayStr || (a.meeting_date === todayStr && (a.end_time || a.start_time || '23:59') >= currentTimeStr));
    const bIsUpcoming = b.status !== 'completed' && (b.meeting_date > todayStr || (b.meeting_date === todayStr && (b.end_time || b.start_time || '23:59') >= currentTimeStr));

    // Jika satu rapat mendatang dan satu rapat lewat/selesai
    if (aIsUpcoming && !bIsUpcoming) return -1;
    if (!aIsUpcoming && bIsUpcoming) return 1;

    // Jika keduanya mendatang: rapat terdekat yang akan dilaksanakan lebih dulu (ascending)
    if (aIsUpcoming && bIsUpcoming) {
      return aDateTime.localeCompare(bDateTime);
    }

    // Jika keduanya sudah selesai/lampau: urutkan dari yang paling baru selesai (descending)
    return bDateTime.localeCompare(aDateTime);
  });
}

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
          const mappedMeetings: Meeting[] = data.map((row) => {
            let invitedIds: string[] | undefined = Array.isArray(row.invited_teacher_ids)
              ? row.invited_teacher_ids
              : (typeof row.invited_teacher_ids === 'string' && row.invited_teacher_ids.startsWith('[')
                  ? JSON.parse(row.invited_teacher_ids)
                  : undefined);

            let cleanNotes = row.notes || '';
            // Backward compatibility fallback: if column invited_teacher_ids wasn't added to Supabase table,
            // recover attendee IDs from the fallback tag in notes
            if ((!invitedIds || invitedIds.length === 0) && cleanNotes.includes('[ATTENDEES_SYNC:')) {
              const match = cleanNotes.match(/\[ATTENDEES_SYNC:(.*?)\]/);
              if (match && match[1]) {
                try {
                  invitedIds = JSON.parse(match[1]);
                  cleanNotes = cleanNotes.replace(/\[ATTENDEES_SYNC:.*?\]/g, '').trim();
                } catch {}
              }
            }

            return {
              id: row.id,
              title: row.title,
              category: row.category,
              meeting_date: row.meeting_date,
              start_time: (row.start_time || '08:00').slice(0, 5),
              end_time: (row.end_time || '11:00').slice(0, 5),
              room: row.room,
              leader_name: row.leader_name,
              leader_niy: row.leader_niy || '',
              secretary_name: row.secretary_name || '',
              secretary_niy: row.secretary_niy || '',
              tolerance_minutes: row.tolerance_minutes || 15,
              status: row.status || 'active',
              target_type: row.target_type || (invitedIds && invitedIds.length > 0 ? 'custom' : 'all'),
              invited_teacher_ids: invitedIds,
              letter_number: row.letter_number || '-',
              notes: cleanNotes,
              is_locked: Boolean(row.is_locked),
              locked_at: row.locked_at || undefined,
              created_at: row.created_at,
            };
          });

          localStorage.setItem(KEY_MEETINGS, JSON.stringify(mappedMeetings));
          return mappedMeetings;
        } else {
          // Table exists but is empty -> auto seed
          const localMeetings = getCachedMeetings();
          (async () => {
            try {
              const { error: seedErr } = await supabase.from('smp_meetings').upsert(localMeetings);
              if (seedErr && (seedErr.message?.includes('invited_teacher_ids') || seedErr.message?.includes('target_type') || seedErr.message?.includes('letter_number') || seedErr.code === 'PGRST204')) {
                const sanitized = localMeetings.map((m) => {
                  const copy: Record<string, any> = { ...m };
                  if (m.invited_teacher_ids && m.invited_teacher_ids.length > 0) {
                    copy.notes = `${m.notes || ''}\n[ATTENDEES_SYNC:${JSON.stringify(m.invited_teacher_ids)}]`.trim();
                  }
                  delete copy.invited_teacher_ids;
                  delete copy.target_type;
                  delete copy.letter_number;
                  return copy;
                });
                await supabase.from('smp_meetings').upsert(sanitized);
              }
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
        let invitedIds: string[] | undefined = Array.isArray(data.invited_teacher_ids)
          ? data.invited_teacher_ids
          : (typeof data.invited_teacher_ids === 'string' && data.invited_teacher_ids.startsWith('[')
              ? JSON.parse(data.invited_teacher_ids)
              : undefined);

        let cleanNotes = data.notes || '';
        if ((!invitedIds || invitedIds.length === 0) && cleanNotes.includes('[ATTENDEES_SYNC:')) {
          const match = cleanNotes.match(/\[ATTENDEES_SYNC:(.*?)\]/);
          if (match && match[1]) {
            try {
              invitedIds = JSON.parse(match[1]);
              cleanNotes = cleanNotes.replace(/\[ATTENDEES_SYNC:.*?\]/g, '').trim();
            } catch {}
          }
        }

        const mapped: Meeting = {
          id: data.id,
          title: data.title,
          category: data.category,
          meeting_date: data.meeting_date,
          start_time: (data.start_time || '08:00').slice(0, 5),
          end_time: (data.end_time || '11:00').slice(0, 5),
          room: data.room,
          leader_name: data.leader_name,
          leader_niy: data.leader_niy || '',
          secretary_name: data.secretary_name || '',
          secretary_niy: data.secretary_niy || '',
          tolerance_minutes: data.tolerance_minutes || 15,
          status: data.status || 'active',
          target_type: data.target_type || (invitedIds && invitedIds.length > 0 ? 'custom' : 'all'),
          invited_teacher_ids: invitedIds,
          letter_number: data.letter_number || '-',
          notes: cleanNotes,
          is_locked: Boolean(data.is_locked),
          locked_at: data.locked_at || undefined,
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
    start_time: (meeting.start_time || '08:00').slice(0, 5),
    end_time: (meeting.end_time || '11:00').slice(0, 5),
    letter_number: meeting.letter_number?.trim() || '-',
    is_locked: Boolean(meeting.is_locked),
    locked_at: meeting.locked_at || undefined,
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
    try {
      const { error } = await supabase.from('smp_meetings').upsert(cleanMeeting);
      if (error) {
        // If error indicates column invited_teacher_ids, target_type, letter_number, is_locked, or locked_at is missing in schema cache
        if (
          error.message?.includes('invited_teacher_ids') ||
          error.message?.includes('target_type') ||
          error.message?.includes('letter_number') ||
          error.message?.includes('is_locked') ||
          error.message?.includes('locked_at') ||
          error.code === 'PGRST204'
        ) {
          console.warn('Supabase smp_meetings table lacks new columns. Saving with compatibility fallback...');
          const fallbackPayload: Record<string, any> = { ...cleanMeeting };
          if (cleanMeeting.invited_teacher_ids && cleanMeeting.invited_teacher_ids.length > 0) {
            fallbackPayload.notes = `${cleanMeeting.notes || ''}\n[ATTENDEES_SYNC:${JSON.stringify(cleanMeeting.invited_teacher_ids)}]`.trim();
          }
          delete fallbackPayload.invited_teacher_ids;
          if (error.message?.includes('target_type')) {
            delete fallbackPayload.target_type;
          }
          if (error.message?.includes('letter_number')) {
            delete fallbackPayload.letter_number;
          }
          if (error.message?.includes('is_locked')) {
            delete fallbackPayload.is_locked;
          }
          if (error.message?.includes('locked_at')) {
            delete fallbackPayload.locked_at;
          }

          const { error: retryErr } = await supabase.from('smp_meetings').upsert(fallbackPayload);
          if (retryErr) {
            console.error('Retry upsert meeting failed:', retryErr.message);
          } else {
            console.log('Successfully saved meeting to Supabase using backward compatibility mode!');
          }
        } else {
          console.error('Error saving meeting to Supabase:', error.message);
        }
      }
    } catch (e) {
      console.warn('Could not sync meeting to Supabase:', e);
    }
  }
  return cleanMeeting;
}

export async function toggleLockMeeting(meetingId: string, isLocked: boolean): Promise<Meeting | null> {
  const meetings = getCachedMeetings();
  const meeting = meetings.find((m) => m.id === meetingId);
  if (!meeting) return null;

  const updated: Meeting = {
    ...meeting,
    is_locked: isLocked,
    locked_at: isLocked ? new Date().toISOString() : undefined,
  };

  return await saveMeeting(updated);
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
  const targetMeeting = mIndex >= 0 ? allMeetings[mIndex] : undefined;
  let targetTeachers = teachers.filter((t) => t.is_active);
  if (
    targetMeeting &&
    targetMeeting.target_type === 'custom' &&
    Array.isArray(targetMeeting.invited_teacher_ids) &&
    targetMeeting.invited_teacher_ids.length > 0
  ) {
    targetTeachers = targetTeachers.filter((t) => targetMeeting.invited_teacher_ids!.includes(t.id));
  }

  const allAttendances = getCachedAttendances();
  const meetingAtts = allAttendances.filter((a) => a.meeting_id === meetingId);
  const attendedTeacherIds = new Set(meetingAtts.map((a) => a.teacher_id));

  const nowIso = new Date().toISOString();
  const newAbsentAttendances: Attendance[] = [];

  for (const t of targetTeachers) {
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
    const { error: meetErr } = await supabase.from('smp_meetings').upsert(meetings);
    if (meetErr && (meetErr.message?.includes('invited_teacher_ids') || meetErr.message?.includes('target_type') || meetErr.code === 'PGRST204')) {
      const sanitized = meetings.map((m) => {
        const copy: Record<string, any> = { ...m };
        if (m.invited_teacher_ids && m.invited_teacher_ids.length > 0) {
          copy.notes = `${m.notes || ''}\n[ATTENDEES_SYNC:${JSON.stringify(m.invited_teacher_ids)}]`.trim();
        }
        delete copy.invited_teacher_ids;
        delete copy.target_type;
        return copy;
      });
      await supabase.from('smp_meetings').upsert(sanitized);
    }

    return {
      success: true,
      message: `Berhasil menyinkronkan data profil sekolah, ${teachers.length} guru, dan ${meetings.length} agenda rapat ke database Supabase!`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Gagal menyinkronkan data ke Supabase: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// INVITATION & EXPEDITION PERSISTENCE
// ---------------------------------------------------------------------------

export function getCachedInvitations(): Invitation[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(KEY_INVITATIONS);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export async function fetchInvitations(): Promise<Invitation[]> {
  const cached = getCachedInvitations();
  const supabase = getSupabase();
  if (!supabase) return cached;

  try {
    const { data, error } = await supabase.from('smp_invitations').select('*');
    if (error) {
      // If table doesn't exist yet, silently use local cache
      return cached;
    }
    if (data && Array.isArray(data)) {
      const mergedMap = new Map<string, Invitation>();
      cached.forEach((item) => mergedMap.set(item.id, item));
      data.forEach((item: any) => mergedMap.set(item.id, item));
      const list = Array.from(mergedMap.values());
      localStorage.setItem(KEY_INVITATIONS, JSON.stringify(list));
      return list;
    }
  } catch (e) {
    console.warn('Could not fetch invitations from Supabase, using local:', e);
  }
  return cached;
}

export async function saveInvitation(invitation: Invitation): Promise<void> {
  const cleanInvitation: Invitation = {
    ...invitation,
    id: isValidUUID(invitation.id) ? invitation.id : generateUUID(),
  };

  const list = getCachedInvitations();
  const index = list.findIndex(
    (inv) => inv.id === cleanInvitation.id || (inv.meeting_id === cleanInvitation.meeting_id && inv.teacher_id === cleanInvitation.teacher_id)
  );
  const updated = [...list];
  if (index >= 0) {
    updated[index] = cleanInvitation;
  } else {
    updated.unshift(cleanInvitation);
  }
  localStorage.setItem(KEY_INVITATIONS, JSON.stringify(updated));

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from('smp_invitations')
        .upsert(cleanInvitation, { onConflict: 'meeting_id,teacher_id' });
      if (error) {
        console.warn('Upsert smp_invitations failed in Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Could not sync invitation to Supabase:', e);
    }
  }
}

export async function saveBatchInvitations(invitations: Invitation[]): Promise<void> {
  if (invitations.length === 0) return;

  const sanitized = invitations.map((inv) => ({
    ...inv,
    id: isValidUUID(inv.id) ? inv.id : generateUUID(),
  }));

  const list = getCachedInvitations();
  const map = new Map<string, Invitation>();
  list.forEach((item) => map.set(`${item.meeting_id}_${item.teacher_id}`, item));
  sanitized.forEach((item) => map.set(`${item.meeting_id}_${item.teacher_id}`, item));

  const updated = Array.from(map.values());
  localStorage.setItem(KEY_INVITATIONS, JSON.stringify(updated));

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from('smp_invitations')
        .upsert(sanitized, { onConflict: 'meeting_id,teacher_id' });
      if (error) {
        console.warn('Batch upsert smp_invitations failed in Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Could not sync batch invitations to Supabase:', e);
    }
  }
}

export async function deleteInvitation(id: string): Promise<void> {
  const list = getCachedInvitations();
  const updated = list.filter((inv) => inv.id !== id);
  localStorage.setItem(KEY_INVITATIONS, JSON.stringify(updated));

  const supabase = getSupabase();
  if (supabase) {
    (async () => {
      try {
        await supabase.from('smp_invitations').delete().eq('id', id);
      } catch (e) {
        // graceful
      }
    })();
  }
}

/**
 * Konfirmasi kehadiran mandiri (RSVP) oleh guru melalui link web WhatsApp
 */
export async function submitRsvpConfirmation(
  meetingId: string,
  teacherId: string,
  rsvpStatus: RsvpStatus,
  rsvpNotes?: string
): Promise<{ success: boolean; invitation?: Invitation; message: string }> {
  const list = getCachedInvitations();
  let existing = list.find((inv) => inv.meeting_id === meetingId && inv.teacher_id === teacherId);

  const nowIso = new Date().toISOString();

  if (!existing) {
    // Buat entri undangan jika belum ada
    existing = {
      id: generateUUID(),
      meeting_id: meetingId,
      teacher_id: teacherId,
      letter_number: '-',
      dispatch_date: new Date().toISOString().split('T')[0],
      dispatch_channel: 'whatsapp',
      dispatch_status: 'sent',
      sent_at: nowIso,
      rsvp_status: rsvpStatus,
      rsvp_notes: rsvpNotes || '',
      rsvp_at: nowIso,
      created_at: nowIso,
    };
  } else {
    existing = {
      ...existing,
      rsvp_status: rsvpStatus,
      rsvp_notes: rsvpNotes !== undefined ? rsvpNotes : existing.rsvp_notes,
      rsvp_at: nowIso,
    };
  }

  await saveInvitation(existing);

  const statusLabel =
    rsvpStatus === 'attending'
      ? 'Akan Hadir'
      : rsvpStatus === 'permission'
      ? 'Izin'
      : rsvpStatus === 'sick'
      ? 'Sakit'
      : 'Belum Konfirmasi';

  return {
    success: true,
    invitation: existing,
    message: `Konfirmasi kehadiran Anda (${statusLabel}) berhasil dicatat. Terima kasih!`,
  };
}

// ============================================================================
// DOCUMENT SIGNATURES (PERSISTENCE DIRECT TO SUPABASE + SEQUENTIAL WORKFLOW)
// ============================================================================

export function getCachedDocumentSignatures(meetingId?: string): DocumentSignature[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(KEY_SIGNATURES);
  if (!stored) return [];
  try {
    const list: DocumentSignature[] = JSON.parse(stored);
    if (meetingId) {
      return list.filter((s) => s.meeting_id === meetingId);
    }
    return list;
  } catch {
    return [];
  }
}


/**
 * Mengambil seluruh tanda tangan dokumen untuk suatu rapat secara langsung dari Supabase Database.
 * Memprioritaskan database PostgreSQL dan memperbarui cache lokal.
 */
export async function fetchDocumentSignatures(meetingId: string): Promise<DocumentSignature[]> {
  const cachedAll = getCachedDocumentSignatures();
  const cachedForMeeting = cachedAll.filter((s) => s.meeting_id === meetingId);

  const supabase = getSupabase();
  if (supabase) {
    try {
      // 1. Coba baca dari tabel smp_document_signatures
      const { data, error } = await supabase
        .from('smp_document_signatures')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('step_order', { ascending: true });

      if (!error && data && Array.isArray(data)) {
        // Sync ke cache lokal
        const otherMeetingsSigs = cachedAll.filter((s) => s.meeting_id !== meetingId);
        const merged = [...otherMeetingsSigs, ...data];
        localStorage.setItem(KEY_SIGNATURES, JSON.stringify(merged));
        return data as DocumentSignature[];
      } else if (error && error.code === '42P01') {
        // Table doesn't exist yet, try creating table or fallback
        console.warn('Tabel smp_document_signatures belum ada di Supabase, menggunakan cache lokal.');
      }
    } catch (e) {
      console.warn('Error fetching signatures from Supabase:', e);
    }
  }

  return cachedForMeeting;
}

/**
 * Menyimpan data tanda tangan digital langsung ke database Supabase dan cache lokal.
 */
export async function saveDocumentSignature(sig: DocumentSignature): Promise<DocumentSignature> {
  const nowIso = new Date().toISOString();
  const cleanSig: DocumentSignature = {
    ...sig,
    id: sig.id || generateUUID(),
    created_at: sig.created_at || nowIso,
  };

  // 1. Simpan ke local cache segera
  const cached = getCachedDocumentSignatures();
  const idx = cached.findIndex((s) => s.id === cleanSig.id || (s.meeting_id === cleanSig.meeting_id && s.document_type === cleanSig.document_type && s.signer_role === cleanSig.signer_role));
  let updatedList: DocumentSignature[];
  if (idx >= 0) {
    updatedList = [...cached];
    updatedList[idx] = cleanSig;
  } else {
    updatedList = [...cached, cleanSig];
  }
  localStorage.setItem(KEY_SIGNATURES, JSON.stringify(updatedList));

  // 2. Simpan langsung ke Supabase PostgreSQL database
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.from('smp_document_signatures').upsert(cleanSig);
      if (error) {
        console.warn('Gagal upsert ke smp_document_signatures di Supabase:', error.message);
      }
    } catch (err) {
      console.warn('Koneksi Supabase error saat menyimpan tanda tangan:', err);
    }
  }

  return cleanSig;
}

/**
 * Memastikan slot penandatangan terurut tersedia untuk suatu rapat.
 * Jika belum ada di DB / cache, otomatis dibuatkan:
 * 1. Laporan Daftar Hadir:
 *    - Tahap 1: Notulis Rapat
 *    - Tahap 2: Pimpinan Rapat
 *    - Tahap 3: Kepala Sekolah (Pengesahan Final dengan Stempel Kedinasan)
 * 2. Buku Ekspedisi:
 *    - Tahap 1: Petugas Ekspedisi / TU
 *    - Tahap 2: Kepala Sekolah (Pengesahan Final dengan Stempel Kedinasan)
 */
export async function ensureMeetingSignatures(
  meeting: Meeting,
  profile: SchoolProfile,
  teachers: Teacher[]
): Promise<DocumentSignature[]> {
  const existing = await fetchDocumentSignatures(meeting.id);

  const needed: Omit<DocumentSignature, 'id' | 'created_at'>[] = [];

  // Pimpinan Rapat info
  const leaderTeacher = teachers.find((t) => t.name === meeting.leader_name);
  const leaderPhone = leaderTeacher?.phone_wa || '';
  const leaderNiy = meeting.leader_niy || leaderTeacher?.niy || leaderTeacher?.nip || '-';

  // Notulis info
  const secretaryTeacher = meeting.secretary_name ? teachers.find((t) => t.name === meeting.secretary_name) : undefined;
  const secretaryName = meeting.secretary_name || 'Notulis Rapat';
  const secretaryNiy = meeting.secretary_niy || secretaryTeacher?.niy || secretaryTeacher?.nip || '-';
  const secretaryPhone = secretaryTeacher?.phone_wa || '';

  // Kepala Sekolah info
  const headmasterName = profile.headmaster_name || 'Kepala Sekolah';
  const headmasterNiy = profile.headmaster_niy || profile.headmaster_nip || '-';
  const headmasterPhone = profile.headmaster_phone || profile.phone || '';

  // Staf Administrasi (menggantikan Petugas Ekspedisi)
  const adminStaffName = profile.admin_staff_name || 'Staf Administrasi';
  const adminStaffNiy = profile.admin_staff_niy || '-';
  const adminStaffPhone = profile.admin_staff_phone || '';

  // 1. Slot TTD Laporan Daftar Hadir (3 Tahap Terurut)
  // Step 1: Notulis
  if (!existing.some((s) => s.document_type === 'attendance_report' && s.signer_role === 'secretary')) {
    needed.push({
      meeting_id: meeting.id,
      document_type: 'attendance_report',
      signer_role: 'secretary',
      step_order: 1,
      signer_name: secretaryName,
      signer_niy: secretaryNiy,
      signer_phone: secretaryPhone,
      status: 'pending',
    });
  }

  // Step 2: Pimpinan Rapat
  if (!existing.some((s) => s.document_type === 'attendance_report' && s.signer_role === 'leader')) {
    needed.push({
      meeting_id: meeting.id,
      document_type: 'attendance_report',
      signer_role: 'leader',
      step_order: 2,
      signer_name: meeting.leader_name,
      signer_niy: leaderNiy,
      signer_phone: leaderPhone,
      status: 'pending',
    });
  }

  // Step 3: Kepala Sekolah
  const existingReportHeadSig = existing.find((s) => s.document_type === 'attendance_report' && s.signer_role === 'headmaster');
  if (!existingReportHeadSig) {
    needed.push({
      meeting_id: meeting.id,
      document_type: 'attendance_report',
      signer_role: 'headmaster',
      step_order: 3,
      signer_name: headmasterName,
      signer_niy: headmasterNiy,
      signer_phone: headmasterPhone,
      status: 'pending',
    });
  } else if (existingReportHeadSig.status === 'pending' && !existingReportHeadSig.signer_phone && headmasterPhone) {
    existingReportHeadSig.signer_phone = headmasterPhone;
    saveDocumentSignature(existingReportHeadSig).catch(() => {});
  }

  // 2. Slot TTD Buku Ekspedisi (2 Tahap)
  // Step 1: Staf Administrasi (menggantikan Petugas Ekspedisi)
  const existingExpSig = existing.find((s) => s.document_type === 'expedition_book' && s.signer_role === 'expedition_officer');
  if (!existingExpSig) {
    needed.push({
      meeting_id: meeting.id,
      document_type: 'expedition_book',
      signer_role: 'expedition_officer',
      step_order: 1,
      signer_name: adminStaffName,
      signer_niy: adminStaffNiy,
      signer_phone: adminStaffPhone,
      status: 'pending',
    });
  } else if (existingExpSig.status === 'pending') {
    if (existingExpSig.signer_name === 'Petugas Ekspedisi / TU' || !existingExpSig.signer_phone) {
      existingExpSig.signer_name = adminStaffName;
      existingExpSig.signer_niy = adminStaffNiy;
      existingExpSig.signer_phone = adminStaffPhone;
      saveDocumentSignature(existingExpSig).catch(() => {});
    }
  }

  // Step 2: Kepala Sekolah
  const existingHeadSig = existing.find((s) => s.document_type === 'expedition_book' && s.signer_role === 'headmaster');
  if (!existingHeadSig) {
    needed.push({
      meeting_id: meeting.id,
      document_type: 'expedition_book',
      signer_role: 'headmaster',
      step_order: 2,
      signer_name: headmasterName,
      signer_niy: headmasterNiy,
      signer_phone: headmasterPhone,
      status: 'pending',
    });
  } else if (existingHeadSig.status === 'pending' && !existingHeadSig.signer_phone && headmasterPhone) {
    existingHeadSig.signer_phone = headmasterPhone;
    saveDocumentSignature(existingHeadSig).catch(() => {});
  }

  if (needed.length > 0) {
    const toSave: DocumentSignature[] = needed.map((item) => ({
      ...item,
      id: generateUUID(),
      created_at: new Date().toISOString(),
    }));

    for (const sig of toSave) {
      await saveDocumentSignature(sig);
    }

    return await fetchDocumentSignatures(meeting.id);
  }

  return existing;
}

/**
 * Melakukan proses penandatanganan berjenjang (sequential approval)
 * Memvalidasi apakah tahap sebelumnya telah disetujui.
 */
export async function signDocumentStep(
  meetingId: string,
  docType: DocumentType,
  role: SignerRole,
  notes?: string
): Promise<{ success: boolean; signature?: DocumentSignature; message: string; nextSignerRole?: SignerRole }> {
  const sigs = await fetchDocumentSignatures(meetingId);
  const target = sigs.find((s) => s.document_type === docType && s.signer_role === role);

  if (!target) {
    return { success: false, message: 'Slot penandatangan tidak ditemukan.' };
  }

  // Aturan Berjenjang: Cek apakah penandatangan pada step_order sebelumnya sudah signed
  if (target.step_order > 1) {
    const previousSigner = sigs.find(
      (s) => s.document_type === docType && s.step_order === target.step_order - 1
    );
    if (!previousSigner || previousSigner.status !== 'signed') {
      const prevRoleName =
        previousSigner?.signer_role === 'secretary'
          ? 'Notulis Rapat'
          : previousSigner?.signer_role === 'leader'
          ? 'Pimpinan Rapat'
          : 'Petugas Ekspedisi';
      return {
        success: false,
        message: `Pengesahan belum dapat dilakukan. Menunggu tanda tangan dari ${prevRoleName} terlebih dahulu.`,
      };
    }
  }

  // Buat kode verifikasi unik bersertifikasi (misal: DEP-2026-X8F9A)
  const roleCode = role.substring(0, 3).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const year = new Date().getFullYear();
  const verificationCode = `DEP-${year}-${roleCode}${randomSuffix}`;

  const updated: DocumentSignature = {
    ...target,
    status: 'signed',
    signed_at: new Date().toISOString(),
    verification_code: verificationCode,
    rejection_notes: notes || undefined,
  };

  await saveDocumentSignature(updated);

  // Cari siapa penandatangan berikutnya dalam alur
  const nextSigner = sigs.find(
    (s) => s.document_type === docType && s.step_order === target.step_order + 1
  );

  // Jika ini adalah tahap pengesahan akhir (Kepala Sekolah atau tahap penutup alur tanda tangan):
  // Otomatis kunci rapat (is_locked = true) dan selesaikan agenda agar data kehadiran & pengesahan berintegritas hukum
  if (!nextSigner && (docType === 'attendance_report' || target.signer_role === 'headmaster')) {
    const meetings = getCachedMeetings();
    const currentM = meetings.find((m) => m.id === meetingId);
    if (currentM) {
      await saveMeeting({
        ...currentM,
        status: 'completed',
        is_locked: true,
        locked_at: new Date().toISOString(),
      });
    }
  }

  return {
    success: true,
    signature: updated,
    nextSignerRole: nextSigner?.signer_role,
    message: `Dokumen berhasil disetujui dan disahkan secara elektronik. Kode Verifikasi: ${verificationCode}.${
      !nextSigner ? ' Seluruh alur pengesahan telah selesai dan rapat otomatis terkunci resmi.' : ''
    }`,
  };
}
