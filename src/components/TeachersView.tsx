import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Users,
  Plus,
  Upload,
  Printer,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  Shield,
  FileText,
  QrCode,
  Layers,
  RotateCcw,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { SchoolProfile, Teacher } from '../types';
import { bulkImportTeachers, deleteTeacher, saveTeacher } from '../lib/storage';
import { generateUUID } from '../lib/uuid';
import {
  getTeacherGroup,
  getGroupBadgeColor,
  sortTeachersStructuralFirst,
  getTeacherGroups,
  addTeacherGroup,
  deleteTeacherGroup,
  resetTeacherGroups,
  DEFAULT_TEACHER_GROUPS,
} from '../lib/teacherGroups';

interface TeachersViewProps {
  teachers: Teacher[];
  schoolProfile: SchoolProfile;
  onRefresh: () => void;
}

export const TeachersView: React.FC<TeachersViewProps> = ({ teachers, schoolProfile, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedTeacherForPrint, setSelectedTeacherForPrint] = useState<Teacher | null>(null);

  // Dynamic teacher groups state
  const [groups, setGroups] = useState<string[]>(() => getTeacherGroups());
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupModalMsg, setGroupModalMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync groups across views reactively
  useEffect(() => {
    const handleGroupsUpdated = (e: CustomEvent<string[]>) => {
      setGroups(e.detail || getTeacherGroups());
    };
    window.addEventListener('smp_teacher_groups_updated', handleGroupsUpdated as EventListener);
    return () => {
      window.removeEventListener('smp_teacher_groups_updated', handleGroupsUpdated as EventListener);
    };
  }, []);

  // Single teacher edit state
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation modal state
  const [deleteTargetTeacher, setDeleteTargetTeacher] = useState<Teacher | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState<Omit<Teacher, 'id'>>({
    ptk_id: '',
    niy: '',
    name: '',
    phone_wa: '',
    rank_group: 'Pegawai Tetap Yayasan',
    role_title: 'Guru Mata Pelajaran',
    teacher_group: 'Guru Mapel',
    avatar_url: '',
    is_active: true,
  });

  // Bulk import state
  const [bulkText, setBulkText] = useState('');
  const [bulkParsed, setBulkParsed] = useState<Omit<Teacher, 'id'>[]>([]);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // QR Code data URL cache for print view
  const [qrCache, setQrCache] = useState<{ [ptkId: string]: string }>({});

  // Generate QR for all printed cards
  useEffect(() => {
    const generateQrs = async () => {
      const cache: { [ptkId: string]: string } = {};
      const listToGen = selectedTeacherForPrint ? [selectedTeacherForPrint] : teachers;

      for (const t of listToGen) {
        try {
          // As instructed: ID card QR content is purely the raw ptk_id UUID (e.g. "225b36db-f768-461f-b6d2-b3c399e06113")
          const url = await QRCode.toDataURL(t.ptk_id.trim(), {
            width: 220,
            margin: 1,
            color: { dark: '#0F172A', light: '#FFFFFF' },
          });
          cache[t.ptk_id] = url;
        } catch (e) {
          console.error(e);
        }
      }
      setQrCache(cache);
    };

    if (isPrintModalOpen) {
      generateQrs();
    }
  }, [isPrintModalOpen, selectedTeacherForPrint, teachers]);

  const handleOpenAdd = () => {
    setEditingTeacher(null);
    setFormError(null);
    setFormData({
      ptk_id: generateUUID(),
      niy: '',
      name: '',
      phone_wa: '',
      rank_group: 'Pegawai Tetap Yayasan',
      role_title: 'Guru Mata Pelajaran',
      teacher_group: 'Guru Mapel',
      avatar_url: '',
      is_active: true,
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (t: Teacher) => {
    setEditingTeacher(t);
    setFormError(null);
    setFormData({
      ptk_id: t.ptk_id,
      niy: t.niy || t.nip || '',
      name: t.name,
      phone_wa: t.phone_wa,
      rank_group: t.rank_group,
      role_title: t.role_title,
      teacher_group: t.teacher_group || getTeacherGroup(t),
      avatar_url: t.avatar_url || '',
      is_active: t.is_active,
    });
    setIsAddModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetTeacher) return;
    setIsDeleting(true);
    await deleteTeacher(deleteTargetTeacher.id);
    setIsDeleting(false);
    setDeleteTargetTeacher(null);
    onRefresh();
  };

  // Group Management Handlers
  const handleAddGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newGroupName.trim();
    if (!clean) return;
    if (groups.some((g) => g.toLowerCase() === clean.toLowerCase())) {
      setGroupModalMsg({ type: 'error', text: `Kelompok "${clean}" sudah ada!` });
      return;
    }
    const updated = addTeacherGroup(clean);
    setGroups(updated);
    setNewGroupName('');
    setGroupModalMsg({ type: 'success', text: `Kelompok "${clean}" berhasil ditambahkan!` });
    setTimeout(() => setGroupModalMsg(null), 3000);
  };

  const handleDeleteGroup = (groupToDelete: string) => {
    const teacherCount = teachers.filter((t) => getTeacherGroup(t) === groupToDelete).length;
    if (teacherCount > 0) {
      if (!confirm(`Terdapat ${teacherCount} guru dalam kelompok "${groupToDelete}". Hapus kelompok ini? Guru terkait akan dialihkan ke kelompok umum.`)) {
        return;
      }
    }
    const updated = deleteTeacherGroup(groupToDelete);
    setGroups(updated);
    setGroupModalMsg({ type: 'success', text: `Kelompok "${groupToDelete}" berhasil dihapus!` });
    setTimeout(() => setGroupModalMsg(null), 3000);
  };

  const handleResetGroups = () => {
    if (confirm('Kembalikan daftar kelompok ke standar bawaan sistem?')) {
      const reset = resetTeacherGroups();
      setGroups(reset);
      setGroupModalMsg({ type: 'success', text: 'Daftar kelompok berhasil dikembalikan ke standar!' });
      setTimeout(() => setGroupModalMsg(null), 3000);
    }
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.name.trim() || !formData.ptk_id.trim()) {
      setFormError('Nama Guru dan Kode QR (ptk_id) wajib diisi.');
      return;
    }

    const draft = {
      ...formData,
      ptk_id: formData.ptk_id.trim(),
      niy: formData.niy.trim() || '-',
      nip: formData.niy.trim() || '-',
    };

    const teacherToSave: Teacher = {
      id: editingTeacher ? editingTeacher.id : generateUUID(),
      ...draft,
      teacher_group: formData.teacher_group || getTeacherGroup(draft as Teacher),
    };

    await saveTeacher(teacherToSave);
    setIsAddModalOpen(false);
    onRefresh();
  };

  // Parse bulk text (CSV, tab-separated, or comma-separated)
  const handleParseBulk = (text: string) => {
    setBulkText(text);
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsed: Omit<Teacher, 'id'>[] = [];

    for (const line of lines) {
      const parts = line.includes('\t')
        ? line.split('\t')
        : line.includes(';')
        ? line.split(';')
        : line.split(',');

      if (parts.length >= 2) {
        let name = parts[0]?.trim() || '';
        let niy = parts[1]?.trim() || '-';
        let wa = parts[2]?.trim() || '';
        let ptk_id = parts[3]?.trim() || '';
        let role = parts[4]?.trim() || 'Guru Mata Pelajaran';
        let rank = parts[5]?.trim() || 'Pegawai Tetap Yayasan';
        let grp = parts[6]?.trim() || '';

        if (parts[0]?.length === 36 && parts[0]?.includes('-')) {
          ptk_id = parts[0].trim();
          name = parts[1]?.trim() || '';
          niy = parts[2]?.trim() || '-';
          wa = parts[3]?.trim() || '';
          role = parts[4]?.trim() || 'Guru Mata Pelajaran';
        }

        if (!ptk_id) {
          ptk_id = generateUUID();
        }

        if (name && name.toLowerCase() !== 'nama' && name.toLowerCase() !== 'nama guru') {
          const draft = {
            name,
            niy,
            nip: niy,
            phone_wa: wa,
            ptk_id,
            role_title: role,
            rank_group: rank,
            is_active: true,
          };
          parsed.push({
            ...draft,
            teacher_group: grp || getTeacherGroup(draft as Teacher),
          });
        }
      }
    }

    setBulkParsed(parsed);
  };

  const handleExecuteImport = async () => {
    if (bulkParsed.length === 0) return;
    const count = await bulkImportTeachers(bulkParsed);
    setImportStatus(`Berhasil mengimpor & menyinkronkan ${count} data guru!`);
    onRefresh();
    setTimeout(() => {
      setImportStatus(null);
      setIsBulkModalOpen(false);
      setBulkText('');
      setBulkParsed([]);
    }, 2000);
  };

  const sortedTeachers = React.useMemo(() => sortTeachersStructuralFirst(teachers), [teachers]);

  const filteredTeachers = sortedTeachers.filter((t) => {
    const grp = getTeacherGroup(t);
    if (selectedGroupFilter !== 'all' && grp !== selectedGroupFilter) return false;
    const q = searchQuery.toLowerCase();
    const niyVal = (t.niy || t.nip || '').toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      niyVal.includes(q) ||
      t.role_title.toLowerCase().includes(q) ||
      grp.toLowerCase().includes(q) ||
      t.ptk_id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Action Controls */}
      <div className="bg-white dark:bg-[#072b2f] p-5 rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Data Guru & ID Card Portrait (Tabel smp_teachers)</h2>
          <p className="text-xs text-slate-500 dark:text-teal-300/80 mt-0.5">
            Daftar PTK ber-NIY (Nomor Induk Yayasan), pengelompokan struktural/tendik, impor token ptk_id kartu fisik, dan cetak ID Card portrait.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Manage Groups Button */}
          <button
            onClick={() => {
              setNewGroupName('');
              setGroupModalMsg(null);
              setIsGroupModalOpen(true);
            }}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-teal-100 bg-slate-100 dark:bg-[#0b383d] hover:bg-slate-200 dark:hover:bg-[#0f4950] border border-slate-300 dark:border-teal-700/60 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Kelola daftar kelompok guru (tambah, edit, hapus)"
          >
            <Layers className="w-3.5 h-3.5 text-teal-600 dark:text-teal-300" />
            <span>Atur Kelompok</span>
          </button>

          {/* Bulk Import Button */}
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-teal-100 bg-slate-100 dark:bg-[#0b383d] hover:bg-slate-200 dark:hover:bg-[#0f4950] border border-slate-300 dark:border-teal-700/60 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-teal-600 dark:text-teal-300" />
            <span>Unggah / Impor Massal</span>
          </button>

          {/* Print All Cards Button */}
          <button
            onClick={() => {
              setSelectedTeacherForPrint(null);
              setIsPrintModalOpen(true);
            }}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-teal-100 bg-slate-100 dark:bg-[#0b383d] hover:bg-slate-200 dark:hover:bg-[#0f4950] border border-slate-300 dark:border-teal-700/60 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-teal-600 dark:text-teal-300" />
            <span>Cetak ID Card Portrait</span>
          </button>

          {/* Add Teacher Button */}
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Guru</span>
          </button>
        </div>
      </div>

      {/* Search & Group Filter Bar */}
      <div className="bg-white dark:bg-[#072b2f] p-4 rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 dark:text-teal-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan nama, NIY, kelompok, mapel, atau ptk_id..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-teal-300/60 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            />
          </div>

          <div className="text-xs text-slate-500 dark:text-teal-300 font-mono self-end sm:self-center">
            Menampilkan: <span className="font-bold text-slate-900 dark:text-white">{filteredTeachers.length}</span> dari {teachers.length} Guru
          </div>
        </div>

        {/* Group Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-[#0f4950]/80">
          <button
            onClick={() => setSelectedGroupFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              selectedGroupFilter === 'all'
                ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                : 'bg-slate-50 dark:bg-[#031e21] text-slate-600 dark:text-teal-200 border-slate-300 dark:border-[#0f4950] hover:bg-slate-100 dark:hover:bg-[#0b383d]'
            }`}
          >
            Semua ({sortedTeachers.length})
          </button>
          {groups.map((grp) => {
            const count = sortedTeachers.filter((t) => getTeacherGroup(t) === grp).length;
            const isSelected = selectedGroupFilter === grp;
            return (
              <button
                key={grp}
                onClick={() => setSelectedGroupFilter(grp)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                    : 'bg-slate-50 dark:bg-[#031e21] text-slate-600 dark:text-teal-200 border-slate-300 dark:border-[#0f4950] hover:bg-slate-100 dark:hover:bg-[#0b383d]'
                }`}
              >
                <span>{grp}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected
                    ? 'bg-teal-950 text-teal-200'
                    : 'bg-slate-200 dark:bg-[#0b383d] text-slate-700 dark:text-teal-200'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Teachers Data Table */}
      <div className="bg-white dark:bg-[#072b2f] rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#042024] border-b border-slate-200 dark:border-[#0f4950] text-slate-600 dark:text-teal-200 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-4 w-12 text-center">No</th>
                <th className="py-2.5 px-4">Nama Lengkap & NIY</th>
                <th className="py-2.5 px-4">Kode QR (ptk_id)</th>
                <th className="py-2.5 px-4">Jabatan / Status</th>
                <th className="py-2.5 px-4">No. WhatsApp</th>
                <th className="py-2.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#0f4950] text-slate-700 dark:text-teal-100">
              {filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-teal-300/60">
                    Tidak ada guru yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-[#0b383d] transition-colors">
                    <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-400 dark:text-teal-400/80 tabular-nums">
                      {idx + 1}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white leading-tight">{t.name}</div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-teal-300 mt-0.5">
                        NIY. {t.niy || t.nip || '-'}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-[#031e21] border border-teal-200 dark:border-teal-800/80 rounded px-1.5 py-0.5 block max-w-[200px] truncate" title={t.ptk_id}>
                        {t.ptk_id}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-600 dark:text-teal-100">
                      {(() => {
                        const grp = getTeacherGroup(t);
                        const badgeColor = getGroupBadgeColor(grp);
                        return (
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-900 dark:text-white">{t.role_title}</span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${badgeColor.bg} ${badgeColor.text} ${badgeColor.border}`}>
                                {grp}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-teal-300/70 mt-0.5">{t.rank_group}</div>
                          </div>
                        );
                      })()}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-700 dark:text-teal-200">
                      {t.phone_wa || '-'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedTeacherForPrint(t);
                            setIsPrintModalOpen(true);
                          }}
                          title="Cetak ID Card Portrait"
                          className="p-1.5 text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-white hover:bg-teal-50 dark:hover:bg-[#0b383d] rounded transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(t)}
                          title="Edit Data Guru"
                          className="p-1.5 text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-white hover:bg-teal-50 dark:hover:bg-[#0b383d] rounded transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTargetTeacher(t)}
                          title="Hapus Data Guru"
                          className="p-1.5 text-slate-400 dark:text-rose-400 hover:text-red-600 dark:hover:text-rose-300 hover:bg-red-50 dark:hover:bg-rose-950/50 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Tambah / Edit Guru */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#072b2f] rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-[#0f4950]">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#0f4950] flex items-center justify-between bg-slate-50 dark:bg-[#042024]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingTeacher ? 'Edit Data Guru' : 'Tambah Guru Baru'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeacher} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 rounded-lg text-xs font-medium">
                  {formError}
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">
                  Nama Lengkap & Gelar *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Drs. Ahmad Fauzi, M.Pd."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-teal-300/60 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">
                    NIY (Nomor Induk Yayasan)
                  </label>
                  <input
                    type="text"
                    value={formData.niy}
                    onChange={(e) => setFormData({ ...formData, niy: e.target.value })}
                    placeholder="Contoh: YHB-2002-014"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-teal-300/60 focus:ring-2 focus:ring-teal-500 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">
                    No. WhatsApp (WAHA)
                  </label>
                  <input
                    type="text"
                    value={formData.phone_wa}
                    onChange={(e) => setFormData({ ...formData, phone_wa: e.target.value })}
                    placeholder="08123456789"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-teal-300/60 focus:ring-2 focus:ring-teal-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">
                  Kode QR ID Card (ptk_id UUID) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.ptk_id}
                  onChange={(e) => setFormData({ ...formData, ptk_id: e.target.value })}
                  placeholder="225b36db-f768-461f-b6d2-b3c399e06113"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-teal-50/50 dark:bg-[#031e21] text-teal-900 dark:text-teal-200 placeholder:text-slate-400 dark:placeholder:text-teal-300/60 focus:ring-2 focus:ring-teal-500 focus:outline-hidden font-mono"
                />
                <p className="text-[10px] text-slate-500 dark:text-teal-300/70 mt-1">
                  Isi persis token UUID dari fisik kartu guru. Scanner mencocokkan kode UUID ini langsung.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">
                    Jabatan / Guru Mapel
                  </label>
                  <input
                    type="text"
                    value={formData.role_title}
                    onChange={(e) => setFormData({ ...formData, role_title: e.target.value })}
                    placeholder="Guru Bahasa Indonesia"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-teal-300/60 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">
                    Pangkat / Status Kepegawaian
                  </label>
                  <input
                    type="text"
                    list="rank_group_options"
                    value={formData.rank_group}
                    onChange={(e) => setFormData({ ...formData, rank_group: e.target.value })}
                    placeholder="Pegawai Tetap Yayasan"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-teal-300/60 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                  <datalist id="rank_group_options">
                    <option value="Pegawai Tetap Yayasan" />
                    <option value="Guru Tetap Yayasan (GTY)" />
                    <option value="Guru Tidak Tetap (GTT)" />
                    <option value="Pegawai Tidak Tetap (PTT)" />
                    <option value="Tenaga Kependidikan" />
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">
                  Kelompok Guru & Pegawai *
                </label>
                <select
                  value={formData.teacher_group || 'Guru Mapel'}
                  onChange={(e) => setFormData({ ...formData, teacher_group: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden text-xs font-semibold cursor-pointer"
                >
                  {groups.map((grp) => (
                    <option key={grp} value={grp} className="bg-white dark:bg-[#072b2f]">
                      {grp}
                    </option>
                  ))}
                  {formData.teacher_group && !groups.includes(formData.teacher_group) && (
                    <option value={formData.teacher_group} className="bg-white dark:bg-[#072b2f]">
                      {formData.teacher_group} (Kustom)
                    </option>
                  )}
                </select>
                <p className="text-[10px] text-slate-500 dark:text-teal-300/70 mt-1">
                  Kelompok mempermudah seleksi peserta rapat khusus (Struktural, Wali Kelas, dsb.) dan mengurutkan pejabat di bagian teratas laporan.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-[#0f4950] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-[#0b383d] hover:bg-slate-300 dark:hover:bg-[#0f4950] rounded-lg text-slate-700 dark:text-teal-100 font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS GURU */}
      {deleteTargetTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#072b2f] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-[#0f4950] p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-rose-950/60 text-red-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Konfirmasi Hapus Data Guru
              </h3>
              <p className="text-xs text-slate-600 dark:text-teal-200/90 leading-relaxed">
                Apakah Anda yakin ingin menghapus data guru <strong className="text-slate-900 dark:text-white">{deleteTargetTeacher.name}</strong> (NIY: {deleteTargetTeacher.niy || deleteTargetTeacher.nip || '-'})?
              </p>
              <p className="text-[11px] text-red-600 dark:text-rose-300 bg-red-50 dark:bg-rose-950/50 border border-red-200 dark:border-rose-900 p-2.5 rounded-lg font-medium">
                Peringatan: Seluruh data riwayat kehadiran terkait guru ini juga akan terhapus secara permanen.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTargetTeacher(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-[#0b383d] hover:bg-slate-200 dark:hover:bg-[#0f4950] text-slate-700 dark:text-teal-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Data Guru'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Impor Massal CSV */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#072b2f] rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 dark:border-[#0f4950] max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#0f4950] flex items-center justify-between bg-slate-50 dark:bg-[#042024]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-teal-600 dark:text-teal-300" />
                <span>Unggah & Impor Massal Data Guru</span>
              </h3>
              <button onClick={() => setIsBulkModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              <div className="p-3 bg-teal-50 dark:bg-[#042024] border border-teal-200 dark:border-[#0f4950] rounded-lg text-teal-900 dark:text-teal-200 space-y-1">
                <p className="font-semibold">Format Kolom (Bisa Copy-Paste langsung dari Excel / Spreadsheet):</p>
                <p className="font-mono text-[11px] text-teal-800 dark:text-teal-300">
                  Nama Guru [TAB/KOMA] NIY [TAB/KOMA] No_WhatsApp [TAB/KOMA] ptk_id [TAB/KOMA] Jabatan
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">
                  Tempelkan Teks dari Excel / CSV di sini:
                </label>
                <textarea
                  rows={6}
                  value={bulkText}
                  onChange={(e) => handleParseBulk(e.target.value)}
                  placeholder={`Drs. Bambang Sudarsono\tYHB-1994-001\t081234567890\t225b36db-f768-461f-b6d2-b3c399e06113\tKepala Sekolah\nSiti Rahmawati, S.Pd.\tYHB-2008-028\t081234567891\t7b8c2e41-61a0-4359-994c-88e5d321041a\tGuru Matematika`}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-teal-300/60 font-mono text-[11px] focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              {bulkParsed.length > 0 && (
                <div className="space-y-2">
                  <span className="font-bold text-slate-800 dark:text-white block">
                    Pratinjau Data Terdeteksi ({bulkParsed.length} Guru):
                  </span>
                  <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-[#0f4950] rounded-lg divide-y divide-slate-100 dark:divide-[#0f4950] bg-white dark:bg-[#031e21]">
                    {bulkParsed.map((item, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between text-[11px] hover:bg-slate-50 dark:hover:bg-[#0b383d]">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">{item.name}</span>
                          <span className="text-slate-400 dark:text-teal-300/70 ml-2 font-mono">NIY: {item.niy}</span>
                          <span className="text-teal-700 dark:text-teal-300 ml-2 font-mono">ptk_id: {item.ptk_id.substring(0, 8)}...</span>
                        </div>
                        <span className="text-slate-500 dark:text-teal-200/80">{item.role_title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importStatus && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 rounded-lg font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{importStatus}</span>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-200 dark:border-[#0f4950] bg-slate-50 dark:bg-[#042024] flex items-center justify-between">
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-[#0b383d] hover:bg-slate-300 dark:hover:bg-[#0f4950] text-slate-700 dark:text-teal-100 rounded-lg text-xs font-medium cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={bulkParsed.length === 0}
                className="px-5 py-2 bg-teal-700 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Impor {bulkParsed.length} Guru</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ID Card Generator & Cetak PORTRAIT */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs id-card-modal-backdrop">
          <div className="bg-white dark:bg-[#072b2f] rounded-xl shadow-2xl max-w-5xl w-full overflow-hidden border border-slate-200 dark:border-[#0f4950] max-h-[92vh] flex flex-col id-card-modal-content">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#0f4950] flex items-center justify-between bg-teal-950 text-white no-print">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-teal-400" />
                <div>
                  <h3 className="text-sm font-bold">
                    {selectedTeacherForPrint
                      ? `Cetak ID Card Portrait: ${selectedTeacherForPrint.name}`
                      : `Cetak ID Card Portrait Guru (${teachers.length} Guru)`}
                  </h3>
                  <p className="text-[11px] text-teal-200">
                    Standar Kartu Tegak (Portrait) 54 mm x 85.6 mm ber-Kop Yayasan & QR Code ptk_id
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / Simpan PDF</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Portrait Area */}
            <div className="p-8 overflow-y-auto flex-1 bg-slate-100 dark:bg-[#031e21] print:bg-white print:p-0 id-card-print-container">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4 justify-items-center id-card-grid">
                {(selectedTeacherForPrint ? [selectedTeacherForPrint] : teachers).map((t) => (
                  /* Standard Portrait ID-1 Card (54mm width x 85.6mm height, approx 250px x 395px) */
                  <div
                    key={t.id}
                    className="w-[260px] bg-white rounded-2xl shadow-md border-2 border-slate-300 overflow-hidden flex flex-col justify-between text-center page-break-inside-avoid print:shadow-none relative id-card-portrait-unit"
                    style={{ minHeight: '415px' }}
                  >
                    {/* Top Lanyard Punch Slot Indicator */}
                    <div className="pt-2 pb-1 bg-teal-950 flex justify-center">
                      <div className="w-10 h-1.5 rounded-full bg-teal-800 border border-teal-700" />
                    </div>

                    {/* Card Header (Yayasan & School Identity & Logo) */}
                    <div className="bg-teal-950 text-white px-3 py-2.5 border-b-2 border-amber-400 flex flex-col items-center space-y-1">
                      {schoolProfile.logo_url ? (
                        <img
                          src={schoolProfile.logo_url}
                          alt="Logo"
                          className="w-10 h-10 object-contain bg-white rounded-full p-1 shadow-xs"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-teal-700 text-white font-black text-xs flex items-center justify-center shadow-xs">
                          dP
                        </div>
                      )}
                      <div className="text-center px-1">
                        {schoolProfile.foundation_name && (
                          <p className="text-[8px] font-bold uppercase tracking-wider text-amber-300 leading-tight truncate max-w-[240px]">
                            {schoolProfile.foundation_name}
                          </p>
                        )}
                        <p className="text-[10px] font-black uppercase tracking-tight text-white leading-tight">
                          {schoolProfile.school_name || 'SMP HARAPAN BANGSA'}
                        </p>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-teal-200 mt-0.5">
                          KARTU TANDA PENGENAL GURU
                        </p>
                      </div>
                    </div>

                    {/* Card Body (Teacher Photo/Avatar & Info) */}
                    <div className="px-4 py-2 flex-1 flex flex-col items-center justify-between space-y-1.5 bg-gradient-to-b from-white to-slate-50">
                      {/* Avatar */}
                      <div className="w-13 h-13 rounded-full bg-teal-950 text-white font-bold text-base flex items-center justify-center border-2 border-teal-600 shadow-xs mt-0.5">
                        {t.name.charAt(0)}
                      </div>

                      {/* Name & Details */}
                      <div className="space-y-0.5 w-full">
                        <h4 className="font-black text-slate-900 text-xs leading-snug line-clamp-2 px-1">
                          {t.name}
                        </h4>
                        <p className="text-[10px] font-mono text-slate-800 font-bold">
                          NIY. {t.niy || t.nip || '-'}
                        </p>
                        <p className="text-[10px] font-semibold text-teal-900">
                          {t.role_title}
                        </p>
                        <p className="text-[9px] text-slate-500">
                          {t.rank_group}
                        </p>
                      </div>

                      {/* Prominent Centered Portrait QR Code */}
                      <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-2xs text-center my-0.5">
                        {qrCache[t.ptk_id] ? (
                          <img
                            src={qrCache[t.ptk_id]}
                            alt={`QR ${t.name}`}
                            className="w-26 h-26 object-contain mx-auto"
                          />
                        ) : (
                          <div className="w-26 h-26 flex items-center justify-center text-[10px] text-slate-400">
                            QR
                          </div>
                        )}
                        <span className="text-[8px] font-black text-slate-600 block mt-1 uppercase tracking-widest">
                          SCAN PRESENSI KEGIATAN
                        </span>
                      </div>

                      <div className="text-[8px] font-mono text-slate-400 truncate max-w-[230px]">
                        ptk_id: {t.ptk_id}
                      </div>
                    </div>

                    {/* Card Bottom Strip */}
                    <div className="bg-teal-950 text-teal-200 px-3 py-1.5 border-t border-teal-900 text-[8px] font-medium flex items-center justify-between">
                      <span>NPSN: {schoolProfile.npsn || '20104567'}</span>
                      <span className="font-bold text-amber-300">dePresent</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 dark:border-[#0f4950] bg-slate-50 dark:bg-[#042024] flex items-center justify-between no-print">
              <span className="text-xs text-slate-500 dark:text-teal-300/80">
                Format ID Card Portrait: Siap dicetak pada kertas foto/PVC atau disimpan sebagai PDF.
              </span>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-[#0b383d] hover:bg-slate-300 dark:hover:bg-[#0f4950] text-slate-700 dark:text-teal-100 text-xs font-medium rounded-lg cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ATUR DAFTAR KELOMPOK GURU */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#072b2f] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-[#0f4950] flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#0f4950] flex items-center justify-between bg-slate-50 dark:bg-[#042024]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-teal-100 dark:bg-[#0b383d] text-teal-800 dark:text-teal-200">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Atur Daftar Kelompok Guru
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-teal-300/80">
                    Kelola kelompok untuk klasifikasi guru dan seleksi rapat
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsGroupModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-teal-300 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#0b383d] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Notification Message */}
              {groupModalMsg && (
                <div
                  className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                    groupModalMsg.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{groupModalMsg.text}</span>
                </div>
              )}

              {/* Form Tambah Kelompok Baru */}
              <form onSubmit={handleAddGroup} className="space-y-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-teal-100">
                  Tambah Kelompok Baru:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Misal: Guru BP / BK, Tim IT, dsb..."
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-teal-300/60 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    disabled={!newGroupName.trim()}
                    className="px-3.5 py-2 bg-teal-700 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>
              </form>

              {/* Daftar Kelompok Saat Ini */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-teal-200">
                  <span>Daftar Kelompok Aktif ({groups.length}):</span>
                  <button
                    type="button"
                    onClick={handleResetGroups}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-teal-300 dark:hover:text-white flex items-center gap-1 hover:underline cursor-pointer"
                    title="Kembalikan kelompok ke setelan awal"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset ke Standar</span>
                  </button>
                </div>

                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {groups.map((grp) => {
                    const badge = getGroupBadgeColor(grp);
                    const teacherCount = teachers.filter((t) => getTeacherGroup(t) === grp).length;
                    const isDefault = (DEFAULT_TEACHER_GROUPS as readonly string[]).includes(grp);

                    return (
                      <div
                        key={grp}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-[#0f4950] bg-slate-50 dark:bg-[#042024] transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`px-2.5 py-1 rounded-md text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {grp}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-teal-300/80 font-mono">
                            {teacherCount} Guru
                          </span>
                          {isDefault && (
                            <span className="text-[10px] text-slate-400 dark:text-teal-400/60 italic hidden sm:inline">
                              (Bawaan)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(grp)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 dark:text-teal-400 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-[#0b383d] transition-colors cursor-pointer"
                            title={`Hapus kelompok ${grp}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 dark:border-[#0f4950] bg-slate-50 dark:bg-[#042024] flex items-center justify-between">
              <span className="text-[11px] text-slate-500 dark:text-teal-300/80">
                Perubahan tersimpan otomatis di perangkat ini
              </span>
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="px-4 py-2 bg-teal-800 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
