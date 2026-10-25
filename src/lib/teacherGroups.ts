import { Teacher } from '../types';

export const TEACHER_GROUPS = [
  'Struktural',
  'Wali Kelas',
  'Guru Mapel',
  'Guru Tahfizh',
  'Guru Ekstra',
  'Tenaga Kependidikan',
] as const;

export type TeacherGroupType = typeof TEACHER_GROUPS[number];

/**
 * Mendapatkan kelompok guru berdasarkan properti teacher_group atau inferensi dari jabatan
 */
export function getTeacherGroup(teacher: Teacher): TeacherGroupType {
  if (teacher.teacher_group && (TEACHER_GROUPS as readonly string[]).includes(teacher.teacher_group)) {
    return teacher.teacher_group as TeacherGroupType;
  }

  const role = (teacher.role_title || '').toLowerCase();
  const rank = (teacher.rank_group || '').toLowerCase();
  const name = (teacher.name || '').toLowerCase();

  // 1. Struktural: Kepala Sekolah, Wakasek, KTU, dsb.
  if (
    role.includes('kepala sekolah') ||
    role.includes('kepala madrasah') ||
    role.includes('wakasek') ||
    role.includes('wks') ||
    role.includes('waka') ||
    role.includes('direktur') ||
    role.includes('kepala tata usaha') ||
    role.includes('ktu') ||
    role.includes('koordinator') ||
    name.includes('bambang sudarsono') ||
    rank.includes('pembina yayasan')
  ) {
    return 'Struktural';
  }

  // 2. Wali Kelas
  if (role.includes('wali kelas') || role.includes('walas')) {
    return 'Wali Kelas';
  }

  // 3. Guru Tahfizh / Al-Qur'an
  if (
    role.includes('tahfizh') ||
    role.includes('tahfidz') ||
    role.includes("qur'an") ||
    role.includes('quran')
  ) {
    return 'Guru Tahfizh';
  }

  // 4. Guru Ekstra / Pembina
  if (
    role.includes('ekstra') ||
    role.includes('pramuka') ||
    role.includes('osis') ||
    role.includes('pelatih') ||
    role.includes('pembina')
  ) {
    return 'Guru Ekstra';
  }

  // 5. Tenaga Kependidikan
  if (
    role.includes('tata usaha') ||
    role.includes('tendik') ||
    role.includes('tu') ||
    role.includes('administrasi') ||
    role.includes('staf') ||
    role.includes('operator') ||
    role.includes('satpam') ||
    role.includes('kebersihan') ||
    role.includes('pustakawan') ||
    rank.includes('tenaga kependidikan')
  ) {
    return 'Tenaga Kependidikan';
  }

  // Default: Guru Mata Pelajaran
  return 'Guru Mapel';
}

/**
 * Menghitung bobot urutan struktural:
 * Kepala Sekolah = 1
 * Wakasek Kurikulum = 2
 * Wakasek Kesiswaan = 3
 * Wakasek Sarpras = 4
 * Wakasek Humas = 5
 * Wakasek Lainnya / KTU = 6
 * Struktural lainnya = 7
 * Wali Kelas = 10
 * Guru Mapel = 20
 * Guru Tahfizh = 30
 * Guru Ekstra = 40
 * Tenaga Kependidikan = 50
 */
export function getTeacherRank(teacher: Teacher): number {
  const group = getTeacherGroup(teacher);
  const role = (teacher.role_title || '').toLowerCase();
  const name = (teacher.name || '').toLowerCase();

  if (group === 'Struktural') {
    if (
      role.includes('kepala sekolah') ||
      role.includes('kepala madrasah') ||
      name.includes('bambang sudarsono')
    ) {
      return 1;
    }
    if (role.includes('kurikulum')) return 2;
    if (role.includes('kesiswaan')) return 3;
    if (role.includes('sarpras')) return 4;
    if (role.includes('humas')) return 5;
    if (role.includes('ktu') || role.includes('kepala tata usaha')) return 6;
    return 7;
  }

  if (group === 'Wali Kelas') return 10;
  if (group === 'Guru Mapel') return 20;
  if (group === 'Guru Tahfizh') return 30;
  if (group === 'Guru Ekstra') return 40;
  if (group === 'Tenaga Kependidikan') return 50;

  return 60;
}

/**
 * Mengurutkan guru dengan struktural di posisi teratas, diikuti Wali Kelas, Guru Mapel, dsb.
 */
export function sortTeachersStructuralFirst(teachers: Teacher[]): Teacher[] {
  return [...teachers].sort((a, b) => {
    const rankA = getTeacherRank(a);
    const rankB = getTeacherRank(b);

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    // Jika setingkat, urutkan nama secara alfabetis
    return (a.name || '').localeCompare(b.name || '', 'id');
  });
}

/**
 * Warna badge kelompok untuk tampilan antarmuka
 */
export function getGroupBadgeColor(group: string): { bg: string; text: string; border: string } {
  switch (group) {
    case 'Struktural':
      return {
        bg: 'bg-indigo-50 dark:bg-indigo-950/60',
        text: 'text-indigo-800 dark:text-indigo-200',
        border: 'border-indigo-200 dark:border-indigo-800',
      };
    case 'Wali Kelas':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/60',
        text: 'text-emerald-800 dark:text-emerald-200',
        border: 'border-emerald-200 dark:border-emerald-800',
      };
    case 'Guru Tahfizh':
      return {
        bg: 'bg-teal-50 dark:bg-[#031e21]',
        text: 'text-teal-800 dark:text-teal-200',
        border: 'border-teal-200 dark:border-[#0f4950]',
      };
    case 'Guru Ekstra':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/60',
        text: 'text-amber-800 dark:text-amber-200',
        border: 'border-amber-200 dark:border-amber-800',
      };
    case 'Tenaga Kependidikan':
      return {
        bg: 'bg-slate-100 dark:bg-[#0b383d]',
        text: 'text-slate-800 dark:text-teal-100',
        border: 'border-slate-300 dark:border-[#0f4950]',
      };
    case 'Guru Mapel':
    default:
      return {
        bg: 'bg-sky-50 dark:bg-sky-950/60',
        text: 'text-sky-800 dark:text-sky-200',
        border: 'border-sky-200 dark:border-sky-800',
      };
  }
}
