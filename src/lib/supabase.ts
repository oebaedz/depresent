import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'smp_presensi_supabase_url';
const STORAGE_KEY_KEY = 'smp_presensi_supabase_anon_key';

export function encodeSupabaseCredentials(url: string, anonKey: string): string {
  try {
    return btoa(JSON.stringify({ u: url.trim(), k: anonKey.trim() }));
  } catch {
    return '';
  }
}

export function decodeSupabaseCredentials(token: string): { url: string; anonKey: string } | null {
  try {
    const raw = atob(token.trim());
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.u === 'string' && typeof parsed.k === 'string') {
      return { url: parsed.u, anonKey: parsed.k };
    }
  } catch {
    // fallback or invalid
  }
  return null;
}

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  // Auto-extract from URL query parameter ?sc= if provided from projector QR scan
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const syncCred = params.get('sc');
    if (syncCred) {
      const decoded = decodeSupabaseCredentials(syncCred);
      if (decoded && decoded.url && decoded.anonKey) {
        localStorage.setItem(STORAGE_KEY_URL, decoded.url);
        localStorage.setItem(STORAGE_KEY_KEY, decoded.anonKey);
      }
    }
  }

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
  missingColumns?: string[];
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

    // Check if new columns exist in smp_meetings
    const missingCols: string[] = [];
    const { error: selectiveColErr } = await testClient.from('smp_meetings').select('invited_teacher_ids, target_type').limit(1);
    if (selectiveColErr && (selectiveColErr.message?.includes('invited_teacher_ids') || selectiveColErr.message?.includes('target_type') || selectiveColErr.code === 'PGRST204')) {
      missingCols.push('invited_teacher_ids');
    }

    if (profileErr || teacherErr || meetingErr || attendanceErr) {
      const err = profileErr || teacherErr || meetingErr || attendanceErr;
      return {
        success: false,
        message: `Terhubung ke Supabase namun terjadi error database: ${err?.message} (Kode: ${err?.code || 'RLS/Permission'})`,
      };
    }

    const count = typeof teacherCount === 'number' ? teacherCount : 0;
    if (missingCols.length > 0) {
      return {
        success: true,
        tablesExist: true,
        missingColumns: missingCols,
        teacherCount: count,
        message: `Koneksi Supabase terhubung! Namun tabel smp_meetings belum memiliki kolom "invited_teacher_ids". Aplikasi tetap berjalan normal dengan mode kompatibilitas, dan Anda dapat menyalin perintah "SQL Update Kolom" untuk meng-upgrade database.`,
      };
    }

    return {
      success: true,
      tablesExist: true,
      teacherCount: count,
      message: `Koneksi berhasil! Terhubung ke Supabase, seluruh tabel smp_* dan kolom selective attendees aktif (${count} data guru).`,
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
  admin_pin TEXT DEFAULT '1234',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Pastikan kolom yayasan, PIN, dan kontak penandatangan ada jika tabel sudah terbuat sebelumnya
ALTER TABLE smp_school_profile ADD COLUMN IF NOT EXISTS foundation_name TEXT DEFAULT 'YAYASAN PENDIDIKAN HARAPAN BANGSA';
ALTER TABLE smp_school_profile ADD COLUMN IF NOT EXISTS headmaster_niy TEXT DEFAULT 'YHB-1994-001';
ALTER TABLE smp_school_profile ADD COLUMN IF NOT EXISTS admin_pin TEXT DEFAULT '1234';
ALTER TABLE smp_school_profile ADD COLUMN IF NOT EXISTS headmaster_phone TEXT DEFAULT '';
ALTER TABLE smp_school_profile ADD COLUMN IF NOT EXISTS admin_staff_name TEXT DEFAULT 'Staf Administrasi';
ALTER TABLE smp_school_profile ADD COLUMN IF NOT EXISTS admin_staff_niy TEXT DEFAULT '-';
ALTER TABLE smp_school_profile ADD COLUMN IF NOT EXISTS admin_staff_phone TEXT DEFAULT '';

-- 2. TABEL DATA GURU / PTK (NIY & ptk_id UUID)
CREATE TABLE IF NOT EXISTS smp_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ptk_id TEXT UNIQUE NOT NULL, -- Isi persis dari QR code kartu guru (UUID murni)
  niy TEXT NOT NULL DEFAULT '-', -- Nomor Induk Yayasan
  nip TEXT DEFAULT '-', -- Alias kompatibilitas
  name TEXT NOT NULL,
  phone_wa TEXT NOT NULL DEFAULT '',
  rank_group TEXT NOT NULL DEFAULT 'Pegawai Tetap Yayasan',
  role_title TEXT NOT NULL DEFAULT 'Guru Mata Pelajaran',
  teacher_group TEXT NOT NULL DEFAULT 'Guru Mapel', -- 'Struktural', 'Wali Kelas', 'Guru Mapel', 'Guru Tahfizh', 'Guru Ekstra', 'Tenaga Kependidikan'
  avatar_url TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE smp_teachers ADD COLUMN IF NOT EXISTS niy TEXT DEFAULT '-';
ALTER TABLE smp_teachers ADD COLUMN IF NOT EXISTS teacher_group TEXT DEFAULT 'Guru Mapel';
CREATE INDEX IF NOT EXISTS idx_smp_teachers_ptk_id ON smp_teachers (ptk_id);
CREATE INDEX IF NOT EXISTS idx_smp_teachers_niy ON smp_teachers (niy);
CREATE INDEX IF NOT EXISTS idx_smp_teachers_group ON smp_teachers (teacher_group);

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
  target_type TEXT NOT NULL DEFAULT 'all', -- 'all' atau 'custom'
  invited_teacher_ids JSONB DEFAULT '[]'::jsonb, -- daftar ID guru peserta terpilih
  letter_number TEXT DEFAULT '-', -- nomor surat dinas resmi kegiatan
  notes TEXT DEFAULT '',
  is_locked BOOLEAN NOT NULL DEFAULT false, -- rapat terkunci setelah disahkan
  locked_at TIMESTAMPTZ, -- waktu rapat dikunci
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Pastikan kolom pimpinan, notulis, letter_number, locked, dan selective attendees ada jika tabel sudah terbuat sebelumnya
ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS leader_niy TEXT DEFAULT '';
ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS secretary_name TEXT DEFAULT '';
ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS secretary_niy TEXT DEFAULT '';
ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'all';
ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS invited_teacher_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS letter_number TEXT DEFAULT '-';
ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

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

-- 5. TABEL SURAT UNDANGAN & BUKU EKSPEDISI (INVITATIONS & RSVP)
CREATE TABLE IF NOT EXISTS smp_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES smp_meetings(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES smp_teachers(id) ON DELETE CASCADE,
  letter_number TEXT NOT NULL DEFAULT '-',
  dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  dispatch_channel TEXT NOT NULL DEFAULT 'whatsapp', -- 'whatsapp', 'manual', 'printed'
  dispatch_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  sent_at TIMESTAMPTZ,
  rsvp_status TEXT NOT NULL DEFAULT 'unconfirmed', -- 'unconfirmed', 'attending', 'permission', 'sick'
  rsvp_notes TEXT DEFAULT '',
  rsvp_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_invitation_per_meeting UNIQUE(meeting_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_smp_invitations_meeting ON smp_invitations (meeting_id);
CREATE INDEX IF NOT EXISTS idx_smp_invitations_teacher ON smp_invitations (teacher_id);
CREATE INDEX IF NOT EXISTS idx_smp_invitations_rsvp ON smp_invitations (rsvp_status);

-- 6. TABEL TANDA TANGAN & PENGESAHAN DOKUMEN DIGITAL (DOCUMENT SIGNATURES)
CREATE TABLE IF NOT EXISTS smp_document_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES smp_meetings(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'attendance_report', -- 'attendance_report', 'expedition_book'
  signer_role TEXT NOT NULL, -- 'secretary', 'leader', 'headmaster', 'expedition_officer'
  step_order INT NOT NULL DEFAULT 1, -- 1: Notulis, 2: Pimpinan, 3: Kepala Sekolah
  signer_name TEXT NOT NULL,
  signer_niy TEXT DEFAULT '-',
  signer_phone TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'signed', 'rejected'
  signed_at TIMESTAMPTZ,
  verification_code TEXT, -- e.g. "DEP-2026-X8F9A"
  rejection_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_signature_per_role UNIQUE(meeting_id, document_type, signer_role)
);

CREATE INDEX IF NOT EXISTS idx_smp_doc_sigs_meeting ON smp_document_signatures (meeting_id);
CREATE INDEX IF NOT EXISTS idx_smp_doc_sigs_verify ON smp_document_signatures (verification_code);
CREATE INDEX IF NOT EXISTS idx_smp_doc_sigs_status ON smp_document_signatures (status);

-- 7. TABEL TEMPLATE PESAN WHATSAPP (smp_message_templates)
CREATE TABLE IF NOT EXISTS smp_message_templates (
  id TEXT PRIMARY KEY, -- 'invitation', 'rechat', 'reminder', 'recap', 'scan'
  title TEXT NOT NULL,
  template_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- AKTIFKAN ROW LEVEL SECURITY (RLS) & BERIKAN IZIN AKSES ANONYMOUS LENGKAP
ALTER TABLE smp_school_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE smp_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE smp_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE smp_attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE smp_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE smp_document_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE smp_message_templates ENABLE ROW LEVEL SECURITY;

-- Berikan izin akses penuh ke schema public untuk peranan anon & authenticated
GRANT ALL ON TABLE smp_school_profile TO anon, authenticated;
GRANT ALL ON TABLE smp_teachers TO anon, authenticated;
GRANT ALL ON TABLE smp_meetings TO anon, authenticated;
GRANT ALL ON TABLE smp_attendances TO anon, authenticated;
GRANT ALL ON TABLE smp_invitations TO anon, authenticated;
GRANT ALL ON TABLE smp_document_signatures TO anon, authenticated;
GRANT ALL ON TABLE smp_message_templates TO anon, authenticated;

-- Kebijakan RLS Akses Penuh (Supabase Client Applet)
DROP POLICY IF EXISTS "Public All smp_school_profile" ON smp_school_profile;
CREATE POLICY "Public All smp_school_profile" ON smp_school_profile FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public All smp_teachers" ON smp_teachers;
CREATE POLICY "Public All smp_teachers" ON smp_teachers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public All smp_meetings" ON smp_meetings;
CREATE POLICY "Public All smp_meetings" ON smp_meetings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public All smp_attendances" ON smp_attendances;
CREATE POLICY "Public All smp_attendances" ON smp_attendances FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public All smp_invitations" ON smp_invitations;
CREATE POLICY "Public All smp_invitations" ON smp_invitations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public All smp_document_signatures" ON smp_document_signatures;
CREATE POLICY "Public All smp_document_signatures" ON smp_document_signatures FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public All smp_message_templates" ON smp_message_templates;
CREATE POLICY "Public All smp_message_templates" ON smp_message_templates FOR ALL USING (true) WITH CHECK (true);
`;


export const SUPABASE_SQL_MIGRATION_V4 = `-- ============================================================
-- SKRIP UPDATE CEPAT KOLOM PESERTA RAPAT, NOMOR SURAT & FITUR KUNCI (LOCK)
-- Jalankan skrip ini jika tabel smp_meetings sudah ada di Supabase Anda:
-- ============================================================
ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'all';
ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS invited_teacher_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS letter_number TEXT DEFAULT '-';
ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
`;

export const SUPABASE_SQL_LETTER_NUMBER = `-- ============================================================
-- SKEMA & MIGRASI KOLOM NOMOR SURAT KEDINASAN (letter_number)
-- Jalankan skrip ini di SQL Editor Supabase untuk mendukung penyimpanan nomor surat:
-- ============================================================
ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS letter_number TEXT DEFAULT '-';
ALTER TABLE smp_invitations ADD COLUMN IF NOT EXISTS letter_number TEXT DEFAULT '-';
`;

export const SUPABASE_SQL_INVITATIONS = `-- ============================================================
-- SKEMA TABEL SURAT UNDANGAN & BUKU EKSPEDISI (smp_invitations)
-- Jalankan skrip ini di SQL Editor Supabase untuk mengaktifkan
-- sinkronisasi cloud fitur Surat Undangan & Konfirmasi Kehadiran RSVP:
-- ============================================================
CREATE TABLE IF NOT EXISTS smp_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES smp_meetings(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES smp_teachers(id) ON DELETE CASCADE,
  letter_number TEXT NOT NULL DEFAULT '-',
  dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  dispatch_channel TEXT NOT NULL DEFAULT 'whatsapp',
  dispatch_status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  rsvp_status TEXT NOT NULL DEFAULT 'unconfirmed',
  rsvp_notes TEXT DEFAULT '',
  rsvp_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_invitation_per_meeting UNIQUE(meeting_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_smp_invitations_meeting ON smp_invitations (meeting_id);
CREATE INDEX IF NOT EXISTS idx_smp_invitations_teacher ON smp_invitations (teacher_id);
CREATE INDEX IF NOT EXISTS idx_smp_invitations_rsvp ON smp_invitations (rsvp_status);

ALTER TABLE smp_invitations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE smp_invitations TO anon, authenticated;

DROP POLICY IF EXISTS "Public All smp_invitations" ON smp_invitations;
CREATE POLICY "Public All smp_invitations" ON smp_invitations FOR ALL USING (true) WITH CHECK (true);
`;

export const SUPABASE_SQL_SIGNATURES = `-- ============================================================
-- TABEL TANDA TANGAN & PENGESAHAN DOKUMEN DIGITAL (smp_document_signatures)
-- Jalankan skrip ini di SQL Editor Supabase untuk mengaktifkan
-- sinkronisasi cloud persetujuan berjenjang & verifikasi QR code:
-- ============================================================
CREATE TABLE IF NOT EXISTS smp_document_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES smp_meetings(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'attendance_report', -- 'attendance_report', 'expedition_book'
  signer_role TEXT NOT NULL, -- 'secretary', 'leader', 'headmaster', 'expedition_officer'
  step_order INT NOT NULL DEFAULT 1, -- 1: Notulis, 2: Pimpinan, 3: Kepala Sekolah
  signer_name TEXT NOT NULL,
  signer_niy TEXT DEFAULT '-',
  signer_phone TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'signed', 'rejected'
  signed_at TIMESTAMPTZ,
  verification_code TEXT, -- e.g. "DEP-2026-X8F9A"
  rejection_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_signature_per_role UNIQUE(meeting_id, document_type, signer_role)
);

CREATE INDEX IF NOT EXISTS idx_smp_doc_sigs_meeting ON smp_document_signatures (meeting_id);
CREATE INDEX IF NOT EXISTS idx_smp_doc_sigs_verify ON smp_document_signatures (verification_code);
CREATE INDEX IF NOT EXISTS idx_smp_doc_sigs_status ON smp_document_signatures (status);

ALTER TABLE smp_document_signatures ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE smp_document_signatures TO anon, authenticated;

DROP POLICY IF EXISTS "Public All smp_document_signatures" ON smp_document_signatures;
CREATE POLICY "Public All smp_document_signatures" ON smp_document_signatures FOR ALL USING (true) WITH CHECK (true);
`;

export const SUPABASE_SQL_MESSAGE_TEMPLATES = `-- ============================================================
-- TABEL TEMPLATE PESAN WHATSAPP (smp_message_templates)
-- Jalankan skrip ini di SQL Editor Supabase untuk menyimpan
-- kustomisasi template pesan undangan, re-chat, dan rekap di database:
-- ============================================================
CREATE TABLE IF NOT EXISTS smp_message_templates (
  id TEXT PRIMARY KEY, -- 'invitation', 'rechat', 'reminder', 'recap', 'scan'
  title TEXT NOT NULL,
  template_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE smp_message_templates ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE smp_message_templates TO anon, authenticated;

DROP POLICY IF EXISTS "Public All smp_message_templates" ON smp_message_templates;
CREATE POLICY "Public All smp_message_templates" ON smp_message_templates FOR ALL USING (true) WITH CHECK (true);
`;

export const SUPABASE_SQL_SIGNER_PROFILES = `-- ============================================================
-- UPDATE PROFIL SEKOLAH: PENANDATANGAN ELEKTRONIK & NO. WA
-- Jalankan skrip ini di SQL Editor Supabase untuk menambahkan
-- kolom nomor WhatsApp Kepala Sekolah dan Staf Administrasi:
-- ============================================================
ALTER TABLE smp_school_profile 
ADD COLUMN IF NOT EXISTS headmaster_phone TEXT DEFAULT '';

ALTER TABLE smp_school_profile 
ADD COLUMN IF NOT EXISTS admin_staff_name TEXT DEFAULT 'Staf Administrasi';

ALTER TABLE smp_school_profile 
ADD COLUMN IF NOT EXISTS admin_staff_niy TEXT DEFAULT '-';

ALTER TABLE smp_school_profile 
ADD COLUMN IF NOT EXISTS admin_staff_phone TEXT DEFAULT '';
`;


