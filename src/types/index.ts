export interface Teacher {
  id: string;
  ptk_id: string; // The exact UUID token on the ID Card QR (e.g. "225b36db-f768-461f-b6d2-b3c399e06113")
  niy: string; // Nomor Induk Yayasan (formerly NIP)
  nip?: string; // backwards compatibility alias for database
  name: string;
  phone_wa: string;
  rank_group: string; // Pangkat / Golongan (e.g. "Pembina / IV-a" atau "Guru Tetap Yayasan")
  role_title: string; // Jabatan / Mapel (e.g. "Guru Bahasa Indonesia")
  avatar_url?: string;
  is_active: boolean;
  created_at?: string;
}

export interface Meeting {
  id: string;
  title: string;
  category: string; // e.g. 'Rapat Dinas', 'Workshop', 'Briefing', 'MGMP', etc.
  meeting_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  room: string;
  leader_name: string; // Pimpinan Rapat spesifik
  leader_niy?: string;
  secretary_name?: string; // Notulis Rapat spesifik
  secretary_niy?: string;
  tolerance_minutes: number; // e.g. 15 mins late tolerance
  status: 'upcoming' | 'active' | 'completed';
  target_type?: 'all' | 'custom'; // 'all' = semua dewan guru, 'custom' = guru tertentu
  invited_teacher_ids?: string[]; // array ID guru yang diundang
  notes?: string;
  created_at?: string;
}

export type AttendanceStatus = 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alpa';
export type AttendanceMethod = 'card_scan' | 'projector_scan' | 'manual';

export interface Attendance {
  id: string;
  meeting_id: string;
  teacher_id: string;
  check_in_time: string; // ISO string
  status: AttendanceStatus;
  method: AttendanceMethod;
  notes?: string;
  wa_notified?: boolean;
  created_at?: string;
}

export interface SchoolProfile {
  id: string;
  foundation_name: string; // Nama Yayasan di atas nama sekolah (contoh: YAYASAN PENDIDIKAN HARAPAN BANGSA)
  school_name: string;
  npsn: string;
  address: string;
  city: string;
  province: string;
  postal_code: string;
  phone: string;
  email: string;
  website: string;
  headmaster_name: string;
  headmaster_niy: string; // NIY Kepala Sekolah
  headmaster_nip?: string; // alias
  headmaster_rank: string;
  waha_group_id: string; // e.g. "120363024823924@g.us"
  logo_url?: string;
  admin_pin?: string; // PIN akses admin tersinkronisasi di database (default: '1234')
}

export interface WahaConfig {
  edge_function_name: string; // default "waha-notify"
  is_enabled: boolean;
  auto_notify_on_scan: boolean;
  message_template_scan: string;
  message_template_reminder: string;
  message_template_recap: string;
}

export interface AttendanceWithTeacher extends Attendance {
  teacher: Teacher;
}
