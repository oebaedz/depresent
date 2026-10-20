import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'smp_presensi_supabase_url';
const STORAGE_KEY_KEY = 'smp_presensi_supabase_anon_key';

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_URL) || '' : '';
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_KEY) || '' : '';

  return {
    url: (storedUrl || envUrl).trim(),
    anonKey: (storedKey || envKey).trim(),
  };
}

export function saveSupabaseCredentials(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
  }
  cachedClient = null; // reset client to re-init
}

let cachedClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey || !url.startsWith('http')) {
    return null;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return cachedClient;
  } catch (err) {
    console.error('Failed to init Supabase client:', err);
    return null;
  }
}

export async function testSupabaseConnection(url?: string, anonKey?: string): Promise<{
  success: boolean;
  message: string;
  tablesExist?: boolean;
  missingTables?: string[];
  teacherCount?: number;
}> {
  const creds = url && anonKey ? { url: url.trim(), anonKey: anonKey.trim() } : getSupabaseCredentials();

  if (!creds.url || !creds.anonKey) {
    return { success: false, message: 'URL dan Anon Key tidak boleh kosong.' };
  }
  if (!creds.url.startsWith('https://') && !creds.url.startsWith('http://')) {
    return { success: false, message: 'URL Supabase harus diawali https://' };
  }

  try {
    const testClient = createClient(creds.url, creds.anonKey);

    // 1. Check smp_school_profile
    const { error: profileErr } = await testClient.from('smp_school_profile').select('id').limit(1);

    // 2. Check smp_teachers
    const { count: teacherCount, error: teacherErr } = await testClient
      .from('smp_teachers')
      .select('*', { count: 'exact', head: true });

    // 3. Check smp_meetings
    const { error: meetingErr } = await testClient.from('smp_meetings').select('id').limit(1);

    // 4. Check smp_attendances
    const { error: attendanceErr } = await testClient.from('smp_attendances').select('id').limit(1);

    const missing: string[] = [];
    if (profileErr && profileErr.code === '42P01') missing.push('smp_school_profile');
    if (teacherErr && teacherErr.code === '42P01') missing.push('smp_teachers');
    if (meetingErr && meetingErr.code === '42P01') missing.push('smp_meetings');
    if (attendanceErr && attendanceErr.code === '42P01') missing.push('smp_attendances');

    if (missing.length > 0) {
      return {
        success: true,
        tablesExist: false,
        missingTables: missing,
        message: `Koneksi Supabase terhubung, namun tabel (${missing.join(', ')}) belum dibuat. Silakan salin skrip SQL di bawah dan jalankan di SQL Editor Supabase.`,
      };
    }

    if (profileErr || teacherErr || meetingErr || attendanceErr) {
      const err = profileErr || teacherErr || meetingErr || attendanceErr;
      return {
        success: false,
        message: `Terhubung ke Supabase namun terjadi error database: ${err?.message} (Kode: ${err?.code || 'RLS/Permission'})`,
      };
    }

    const count = typeof teacherCount === 'number' ? teacherCount : 0;
    return {
      success: true,
      tablesExist: true,
      teacherCount: count,
      message: `Koneksi berhasil! Terhubung ke Supabase, tabel smp_* aktif dengan ${count} data guru.`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Koneksi gagal: ${errorMsg}`,
    };
  }
}

export const SUPABASE_SQL_SCHEMA = `-- ============================================================
-- SKEMA RESMI DATABASE dePresent (YAYASAN & SEKOLAH)
-- Jalankan skrip ini di: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ============================================================

-- 1. TABEL PROFIL SEKOLAH & YAYASAN
CREATE TABLE IF NOT EXISTS smp_school_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foundation_name TEXT NOT NULL DEFAULT 'YAYASAN PENDIDIKAN HARAPAN BANGSA',
  school_name TEXT NOT NULL DEFAULT 'SMP HARAPAN BANGSA',
  npsn TEXT NOT NULL DEFAULT '20104567',
  address TEXT NOT NULL DEFAULT 'Jl. Ki Hajar Dewantara No. 45, Kecamatan Cerdas',
  city TEXT NOT NULL DEFAULT 'Kabupaten Pelajar',
  province TEXT NOT NULL DEFAULT 'Jawa Tengah',
  postal_code TEXT NOT NULL DEFAULT '55281',
  phone TEXT NOT NULL DEFAULT '(0274) 554321',
  email TEXT NOT NULL DEFAULT 'info@smpharapanbangsa.sch.id',
  website TEXT NOT NULL DEFAULT 'https://smpharapanbangsa.sch.id',
  headmaster_name TEXT NOT NULL DEFAULT 'Drs. H. Bambang Sudarsono, M.Pd.',
  headmaster_niy TEXT NOT NULL DEFAULT 'YHB-1994-001',
  headmaster_nip TEXT DEFAULT '',
  headmaster_rank TEXT NOT NULL DEFAULT 'Pembina Yayasan / Guru Utama',
  waha_group_id TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Pastikan kolom yayasan ada jika tabel sudah terbuat sebelumnya
ALTER TABLE smp_school_profile ADD COLUMN IF NOT EXISTS foundation_name TEXT DEFAULT 'YAYASAN PENDIDIKAN HARAPAN BANGSA';
ALTER TABLE smp_school_profile ADD COLUMN IF NOT EXISTS headmaster_niy TEXT DEFAULT 'YHB-1994-001';

-- 2. TABEL DATA GURU / PTK (NIY & ptk_id UUID)
CREATE TABLE IF NOT EXISTS smp_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ptk_id TEXT UNIQUE NOT NULL, -- Isi persis dari QR code kartu guru (UUID murni)
  niy TEXT NOT NULL DEFAULT '-', -- Nomor Induk Yayasan
  nip TEXT DEFAULT '-', -- Alias kompatibilitas
  name TEXT NOT NULL,
  phone_wa TEXT NOT NULL DEFAULT '',
  rank_group TEXT NOT NULL DEFAULT 'Guru Tetap Yayasan (GTY)',
  role_title TEXT NOT NULL DEFAULT 'Guru Mata Pelajaran',
  avatar_url TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE smp_teachers ADD COLUMN IF NOT EXISTS niy TEXT DEFAULT '-';
CREATE INDEX IF NOT EXISTS idx_smp_teachers_ptk_id ON smp_teachers (ptk_id);
CREATE INDEX IF NOT EXISTS idx_smp_teachers_niy ON smp_teachers (niy);

-- 3. TABEL AGENDA RAPAT (PIMPINAN & NOTULIS PER AGENDA)
CREATE TABLE IF NOT EXISTS smp_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Rapat Dinas',
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIME NOT NULL DEFAULT '08:00',
  end_time TIME NOT NULL DEFAULT '11:00',
  room TEXT NOT NULL DEFAULT 'Aula Pertemuan Utama Yayasan',
  leader_name TEXT NOT NULL,
  leader_niy TEXT DEFAULT '',
  secretary_name TEXT DEFAULT '',
  secretary_niy TEXT DEFAULT '',
  tolerance_minutes INT NOT NULL DEFAULT 15,
  status TEXT NOT NULL DEFAULT 'active', -- 'upcoming', 'active', 'completed'
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS leader_niy TEXT DEFAULT '';
ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS secretary_name TEXT DEFAULT '';
ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS secretary_niy TEXT DEFAULT '';

-- 4. TABEL REKAM KEHADIRAN (ATTENDANCES)
CREATE TABLE IF NOT EXISTS smp_attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES smp_meetings(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES smp_teachers(id) ON DELETE CASCADE,
  check_in_time TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  status TEXT NOT NULL DEFAULT 'hadir', -- 'hadir', 'terlambat', 'izin', 'sakit', 'alpa'
  method TEXT NOT NULL DEFAULT 'card_scan', -- 'card_scan', 'projector_scan', 'manual'
  notes TEXT DEFAULT '',
  wa_notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_attendance_per_meeting UNIQUE(meeting_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_smp_attendances_meeting ON smp_attendances (meeting_id);
CREATE INDEX IF NOT EXISTS idx_smp_attendances_teacher ON smp_attendances (teacher_id);

-- AKTIFKAN ROW LEVEL SECURITY (RLS) & BERIKAN IZIN AKSES ANONYMOUS LENGKAP
ALTER TABLE smp_school_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE smp_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE smp_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE smp_attendances ENABLE ROW LEVEL SECURITY;

-- Berikan izin akses penuh ke schema public untuk peranan anon & authenticated
GRANT ALL ON TABLE smp_school_profile TO anon, authenticated;
GRANT ALL ON TABLE smp_teachers TO anon, authenticated;
GRANT ALL ON TABLE smp_meetings TO anon, authenticated;
GRANT ALL ON TABLE smp_attendances TO anon, authenticated;

-- Kebijakan RLS Akses Penuh (Supabase Client Applet)
DROP POLICY IF EXISTS "Public All smp_school_profile" ON smp_school_profile;
CREATE POLICY "Public All smp_school_profile" ON smp_school_profile FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public All smp_teachers" ON smp_teachers;
CREATE POLICY "Public All smp_teachers" ON smp_teachers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public All smp_meetings" ON smp_meetings;
CREATE POLICY "Public All smp_meetings" ON smp_meetings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public All smp_attendances" ON smp_attendances;
CREATE POLICY "Public All smp_attendances" ON smp_attendances FOR ALL USING (true) WITH CHECK (true);
`;
