import { Teacher } from '../types';

export const DEFAULT_TEACHER_GROUPS = [
  'Struktural',
  'Wali Kelas',
  'Guru Mapel',
  'Guru Tahfizh',
  'Guru Ekstra',
  'Tenaga Kependidikan',
] as const;

export const TEACHER_GROUPS = DEFAULT_TEACHER_GROUPS;

export type TeacherGroupType = string;

const KEY_CUSTOM_TEACHER_GROUPS = 'smp_teacher_groups_v1';

/**
 * Mendapatkan daftar kelompok guru aktif (bisa dikustomisasi pengguna)
 */
export function getTeacherGroups(): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_TEACHER_GROUPS];
  try {
    const stored = localStorage.getItem(KEY_CUSTOM_TEACHER_GROUPS);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return [...DEFAULT_TEACHER_GROUPS];
}

/**
 * Menyimpan daftar kelompok guru dan memicu event reaktif
 */
export function saveTeacherGroups(groups: string[]): string[] {
  const clean = Array.from(new Set(groups.map((g) => g.trim()).filter(Boolean)));
  const finalGroups = clean.length > 0 ? clean : [...DEFAULT_TEACHER_GROUPS];
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEY_CUSTOM_TEACHER_GROUPS, JSON.stringify(finalGroups));
    window.dispatchEvent(new CustomEvent('smp_teacher_groups_updated', { detail: finalGroups }));
  }
  return finalGroups;
}

/**
 * Menambah kelompok guru baru
 */
export function addTeacherGroup(newGroup: string): string[] {
  const name = newGroup.trim();
  if (!name) return getTeacherGroups();
  const current = getTeacherGroups();
  if (!current.some((g) => g.toLowerCase() === name.toLowerCase())) {
    const updated = [...current, name];
    return saveTeacherGroups(updated);
  }
  return current;
}

/**
 * Menghapus kelompok guru dari daftar
 */
export function deleteTeacherGroup(groupToDelete: string): string[] {
  const current = getTeacherGroups();
  const filtered = current.filter((g) => g !== groupToDelete);
  return saveTeacherGroups(filtered.length > 0 ? filtered : [...DEFAULT_TEACHER_GROUPS]);
}

/**
 * Mereset daftar kelompok ke bawaan sistem
 */
export function resetTeacherGroups(): string[] {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(KEY_CUSTOM_TEACHER_GROUPS);
    window.dispatchEvent(new CustomEvent('smp_teacher_groups_updated', { detail: [...DEFAULT_TEACHER_GROUPS] }));
  }
  return [...DEFAULT_TEACHER_GROUPS];
}

/**
 * Mendapatkan kelompok guru berdasarkan properti teacher_group atau inferensi dari jabatan
 */
export function getTeacherGroup(teacher: Teacher): string {
  if (teacher.teacher_group && teacher.teacher_group.trim()) {
    return teacher.teacher_group.trim();
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
 * Kelompok kustom lainnya = 55
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

  return 55;
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
 * Warna badge kelompok untuk tampilan antarmuka dengan kontras tinggi
 */
export function getGroupBadgeColor(group: string): { bg: string; text: string; border: string } {
  switch (group) {
    case 'Struktural':
      return {
        bg: 'bg-indigo-100 dark:bg-indigo-950/80',
        text: 'text-indigo-900 dark:text-indigo-100 font-bold',
        border: 'border-indigo-300 dark:border-indigo-700',
      };
    case 'Wali Kelas':
      return {
        bg: 'bg-emerald-100 dark:bg-emerald-950/80',
        text: 'text-emerald-900 dark:text-emerald-100 font-bold',
        border: 'border-emerald-300 dark:border-emerald-700',
      };
    case 'Guru Tahfizh':
      return {
        bg: 'bg-teal-100 dark:bg-[#042d31]',
        text: 'text-teal-900 dark:text-teal-100 font-bold',
        border: 'border-teal-300 dark:border-teal-600',
      };
    case 'Guru Ekstra':
      return {
        bg: 'bg-amber-100 dark:bg-amber-950/80',
        text: 'text-amber-900 dark:text-amber-100 font-bold',
        border: 'border-amber-300 dark:border-amber-700',
      };
    case 'Tenaga Kependidikan':
      return {
        bg: 'bg-slate-200 dark:bg-[#0b383d]',
        text: 'text-slate-900 dark:text-white font-bold',
        border: 'border-slate-400 dark:border-[#0f4950]',
      };
    case 'Guru Mapel':
      return {
        bg: 'bg-sky-100 dark:bg-sky-950/80',
        text: 'text-sky-900 dark:text-sky-100 font-bold',
        border: 'border-sky-300 dark:border-sky-700',
      };
    default: {
      // Dynamic fallback color for custom user-created groups
      const hash = group.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const palettes = [
        { bg: 'bg-purple-100 dark:bg-purple-950/80', text: 'text-purple-900 dark:text-purple-100 font-bold', border: 'border-purple-300 dark:border-purple-700' },
        { bg: 'bg-rose-100 dark:bg-rose-950/80', text: 'text-rose-900 dark:text-rose-100 font-bold', border: 'border-rose-300 dark:border-rose-700' },
        { bg: 'bg-cyan-100 dark:bg-cyan-950/80', text: 'text-cyan-900 dark:text-cyan-100 font-bold', border: 'border-cyan-300 dark:border-cyan-700' },
        { bg: 'bg-lime-100 dark:bg-lime-950/80', text: 'text-lime-900 dark:text-lime-100 font-bold', border: 'border-lime-300 dark:border-lime-700' },
        { bg: 'bg-fuchsia-100 dark:bg-fuchsia-950/80', text: 'text-fuchsia-900 dark:text-fuchsia-100 font-bold', border: 'border-fuchsia-300 dark:border-fuchsia-700' },
      ];
      return palettes[hash % palettes.length];
    }
  }
}
