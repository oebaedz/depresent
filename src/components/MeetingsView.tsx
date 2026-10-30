import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  FileEdit,
  X,
  Users,
  Tag,
  AlertCircle,
  Check,
  Lock,
  Unlock,
} from 'lucide-react';
import { Meeting, Teacher } from '../types';
import {
  deleteMeeting,
  saveMeeting,
  completeMeetingAndMarkAbsent,
  getMeetingCategories,
  addMeetingCategory,
  deleteMeetingCategory,
  sortMeetingsClosestFirst,
  toggleLockMeeting,
} from '../lib/storage';
import { generateUUID } from '../lib/uuid';
import {
  getTeacherGroup,
  getGroupBadgeColor,
  sortTeachersStructuralFirst,
  getTeacherGroups,
  TeacherGroupType,
} from '../lib/teacherGroups';

interface MeetingsViewProps {
  meetings: Meeting[];
  teachers?: Teacher[];
  onRefresh: () => void;
  onSelectActiveMeeting: (id: string) => void;
}

export const MeetingsView: React.FC<MeetingsViewProps> = ({
  meetings,
  teachers = [],
  onRefresh,
  onSelectActiveMeeting,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Categories management state
  const [categories, setCategories] = useState<string[]>(() => getMeetingCategories());
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [categoryMsg, setCategoryMsg] = useState<string | null>(null);

  // Dynamic teacher groups state
  const [teacherGroups, setTeacherGroups] = useState<string[]>(() => getTeacherGroups());

  useEffect(() => {
    const handleGroupsUpdated = (e: CustomEvent<string[]>) => {
      setTeacherGroups(e.detail || getTeacherGroups());
    };
    window.addEventListener('smp_teacher_groups_updated', handleGroupsUpdated as EventListener);
    return () => {
      window.removeEventListener('smp_teacher_groups_updated', handleGroupsUpdated as EventListener);
    };
  }, []);

  // Status notification
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Delete confirmation modal state
  const [deleteTargetMeeting, setDeleteTargetMeeting] = useState<Meeting | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Complete meeting confirmation modal
  const [completingTargetMeeting, setCompletingTargetMeeting] = useState<Meeting | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const sortedTeachers = React.useMemo(() => sortTeachersStructuralFirst(teachers), [teachers]);
  const sortedMeetings = React.useMemo(() => sortMeetingsClosestFirst(meetings), [meetings]);

  // Attendee picker filters
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [attendeeRoleFilter, setAttendeeRoleFilter] = useState('all');
  const [attendeeGroupFilter, setAttendeeGroupFilter] = useState('all');

  const [formData, setFormData] = useState<Omit<Meeting, 'id'>>({
    title: '',
    category: categories[0] || 'Rapat Dinas',
    meeting_date: new Date().toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '11:00',
    room: 'Aula Pertemuan Utama Yayasan',
    leader_name: sortedTeachers[0]?.name || 'Drs. H. Bambang Sudarsono, M.Pd.',
    leader_niy: sortedTeachers[0]?.niy || sortedTeachers[0]?.nip || 'YHB-1994-001',
    secretary_name: sortedTeachers[1]?.name || 'Siti Rahmawati, S.Pd.',
    secretary_niy: sortedTeachers[1]?.niy || sortedTeachers[1]?.nip || 'YHB-2008-028',
    tolerance_minutes: 15,
    status: 'active',
    target_type: 'all',
    invited_teacher_ids: sortedTeachers.map((t) => t.id),
    notes: '',
  });

  const handleOpenAdd = () => {
    setEditingMeeting(null);
    setFormError(null);
    setAttendeeSearch('');
    setAttendeeRoleFilter('all');
    setAttendeeGroupFilter('all');
    setFormData({
      title: '',
      category: categories[0] || 'Rapat Dinas',
      meeting_date: new Date().toISOString().split('T')[0],
      start_time: '08:00',
      end_time: '11:00',
      room: 'Aula Pertemuan Utama Yayasan',
      leader_name: sortedTeachers[0]?.name || 'Drs. H. Bambang Sudarsono, M.Pd.',
      leader_niy: sortedTeachers[0]?.niy || sortedTeachers[0]?.nip || 'YHB-1994-001',
      secretary_name: sortedTeachers[1]?.name || 'Siti Rahmawati, S.Pd.',
      secretary_niy: sortedTeachers[1]?.niy || sortedTeachers[1]?.nip || 'YHB-2008-028',
      tolerance_minutes: 15,
      status: 'active',
      target_type: 'all',
      invited_teacher_ids: sortedTeachers.map((t) => t.id),
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m: Meeting) => {
    setEditingMeeting(m);
    setFormError(null);
    setAttendeeSearch('');
    setAttendeeRoleFilter('all');
    setFormData({
      title: m.title,
      category: m.category,
      meeting_date: m.meeting_date,
      start_time: m.start_time,
      end_time: m.end_time,
      room: m.room,
      leader_name: m.leader_name,
      leader_niy: m.leader_niy || '',
      secretary_name: m.secretary_name || '',
      secretary_niy: m.secretary_niy || '',
      tolerance_minutes: m.tolerance_minutes,
      status: m.status,
      target_type: m.target_type || 'all',
      invited_teacher_ids: Array.isArray(m.invited_teacher_ids) && m.invited_teacher_ids.length > 0
        ? m.invited_teacher_ids
        : teachers.map((t) => t.id),
      notes: m.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetMeeting) return;
    setIsDeleting(true);
    await deleteMeeting(deleteTargetMeeting.id);
    setIsDeleting(false);
    setDeleteTargetMeeting(null);
    onRefresh();
  };

  const handleSetActive = async (m: Meeting) => {
    const updated: Meeting = { ...m, status: 'active' };
    await saveMeeting(updated);
    onSelectActiveMeeting(m.id);
    onRefresh();
  };

  const handleToggleLock = async (m: Meeting) => {
    const nextLocked = !m.is_locked;
    if (nextLocked) {
      const confirmLock = window.confirm(
        `Kunci agenda rapat "${m.title}"?\n\nSetelah dikunci, rapat disahkan secara resmi dan presensi baru ditutup demi integritas data dokumen kedinasan.`
      );
      if (!confirmLock) return;
    } else {
      const confirmUnlock = window.confirm(
        `Buka kunci agenda rapat "${m.title}"?\n\nPeringatan: Membuka kunci rapat yang sudah disahkan memungkinkan perubahan data kehadiran.`
      );
      if (!confirmUnlock) return;
    }

    await toggleLockMeeting(m.id, nextLocked);
    setActionSuccessMsg(
      nextLocked
        ? `Rapat "${m.title}" berhasil dikunci resmi (Status Disahkan & Dilindungi).`
        : `Kunci rapat "${m.title}" berhasil dibuka.`
    );
    setTimeout(() => setActionSuccessMsg(null), 4000);
    onRefresh();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.title.trim()) {
      setFormError('Judul rapat/kegiatan wajib diisi.');
      return;
    }

    const meetingToSave: Meeting = {
      id: editingMeeting ? editingMeeting.id : generateUUID(),
      ...formData,
    };

    try {
      await saveMeeting(meetingToSave);

      // Ketika status rapat diset completed (selesai), otomatis ubah kehadiran yang belum hadir jadi Tidak Hadir
      if (meetingToSave.status === 'completed') {
        const res = await completeMeetingAndMarkAbsent(meetingToSave.id, teachers);
        setActionSuccessMsg(
          `Rapat selesai disimpan. ${res.updatedCount} guru yang belum presensi otomatis ditandai "Tidak Hadir".`
        );
        setTimeout(() => setActionSuccessMsg(null), 4000);
      } else {
        setActionSuccessMsg(
          editingMeeting
            ? `Agenda rapat "${meetingToSave.title}" berhasil diperbarui!`
            : `Agenda rapat baru "${meetingToSave.title}" berhasil dibuat dan disimpan!`
        );
        setTimeout(() => setActionSuccessMsg(null), 4000);
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setFormError(`Gagal menyimpan rapat: ${errMsg}`);
    }
  };

  const handleExecuteCompleteMeeting = async () => {
    if (!completingTargetMeeting) return;
    setIsCompleting(true);
    const res = await completeMeetingAndMarkAbsent(completingTargetMeeting.id, teachers);
    setIsCompleting(false);
    setCompletingTargetMeeting(null);
    setActionSuccessMsg(
      `Rapat "${completingTargetMeeting.title}" telah diselesaikan. Sebanyak ${res.updatedCount} guru yang belum presensi otomatis ditandai "Tidak Hadir".`
    );
    setTimeout(() => setActionSuccessMsg(null), 4000);
    onRefresh();
  };

  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cat = newCategoryInput.trim();
    if (!cat) return;
    const updated = addMeetingCategory(cat);
    setCategories(updated);
    setNewCategoryInput('');
    setCategoryMsg(`Kategori "${cat}" berhasil ditambahkan!`);
    setTimeout(() => setCategoryMsg(null), 2500);
  };

  const handleDeleteCategoryClick = (cat: string) => {
    const updated = deleteMeetingCategory(cat);
    setCategories(updated);
    setCategoryMsg(`Kategori "${cat}" dihapus.`);
    setTimeout(() => setCategoryMsg(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white dark:bg-[#072b2f] p-5 rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Agenda Rapat & Kegiatan Yayasan (Tabel smp_meetings)</h2>
          <p className="text-xs text-slate-500 dark:text-teal-200/80 mt-0.5">
            Pimpinan rapat, notulis, dan target peserta (semua guru / guru terpilih) dapat diatur secara fleksibel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Menu Input & Kelola Kategori Rapat */}
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-teal-100 bg-slate-100 dark:bg-[#0b383d] hover:bg-slate-200 dark:hover:bg-[#0f4950] border border-slate-300 dark:border-[#0f4950] rounded-lg transition-colors flex items-center gap-1.5"
            title="Kelola daftar kategori rapat"
          >
            <Tag className="w-3.5 h-3.5 text-teal-800 dark:text-teal-300" />
            <span>Daftar Kategori Rapat</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-600 rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Agenda Rapat Baru</span>
          </button>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Meeting Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sortedMeetings.map((m) => {
          const isActive = m.status === 'active';
          const isCompleted = m.status === 'completed';
          const isCustom = m.target_type === 'custom' && Array.isArray(m.invited_teacher_ids) && m.invited_teacher_ids.length > 0;

          return (
            <div
              key={m.id}
              className={`p-5 rounded-xl border shadow-xs flex flex-col justify-between transition-all ${
                isActive
                  ? 'border-teal-500 bg-white dark:bg-[#072b2f] ring-2 ring-teal-500/30'
                  : isCompleted
                  ? 'border-slate-200 dark:border-[#0f4950]/60 bg-slate-50/60 dark:bg-[#031e21]/70'
                  : 'border-slate-200 dark:border-[#0f4950] bg-white dark:bg-[#072b2f] hover:border-teal-400 dark:hover:border-teal-600'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-teal-900 dark:text-teal-200 bg-teal-50 dark:bg-[#031e21] border border-teal-200 dark:border-teal-800/80 px-2 py-0.5 rounded">
                      {m.category}
                    </span>
                    {m.is_locked && (
                      <span className="text-[10px] font-bold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                        <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span>Terkunci (Disahkan)</span>
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      m.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : m.status === 'upcoming'
                        ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                        : 'bg-slate-200 text-slate-700 dark:bg-[#031e21] dark:text-teal-300/70 border dark:border-[#0f4950]'
                    }`}
                  >
                    {m.status === 'completed' ? 'Selesai' : m.status}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
                  {m.title}
                </h3>

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-teal-100/80">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-teal-400 shrink-0" />
                    <span>{m.meeting_date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-teal-400 shrink-0" />
                    <span className="font-mono">{m.start_time?.slice(0, 5) || m.start_time} - {m.end_time?.slice(0, 5) || m.end_time} WIB</span>
                    <span className="text-[10px] text-slate-400 dark:text-teal-300/70">({m.tolerance_minutes}m toleransi)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-teal-400 shrink-0" />
                    <span className="truncate">{m.room}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span>
                      {isCustom ? (
                        <span className="font-semibold text-teal-900 dark:text-teal-200 bg-teal-50 dark:bg-[#031e21] px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                          {m.invited_teacher_ids!.length} Peserta Khusus
                        </span>
                      ) : (
                        <span>Semua Guru ({teachers.length})</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span className="truncate">
                      Pimpinan: <strong className="text-slate-800 dark:text-white">{m.leader_name}</strong> {m.leader_niy ? `(${m.leader_niy})` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileEdit className="w-3.5 h-3.5 text-slate-400 dark:text-teal-400 shrink-0" />
                    <span className="truncate">
                      Notulis: <strong className="text-slate-800 dark:text-white">{m.secretary_name || '-'}</strong> {m.secretary_niy ? `(${m.secretary_niy})` : ''}
                    </span>
                  </div>
                </div>

                {m.notes && (
                  <p className="text-[11px] text-slate-500 dark:text-teal-200/80 bg-slate-50 dark:bg-[#031e21] p-2 rounded border border-slate-100 dark:border-[#0f4950] line-clamp-2">
                    {m.notes}
                  </p>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-[#0f4950] flex items-center justify-between gap-2">
                <div>
                  {isCompleted ? (
                    <span className="text-xs font-semibold text-slate-500 dark:text-teal-300/70 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 dark:text-teal-400" />
                      <span>Selesai (Ditutup)</span>
                    </span>
                  ) : isActive ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Aktif</span>
                      </span>
                      <button
                        onClick={() => setCompletingTargetMeeting(m)}
                        className="text-[11px] font-bold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors"
                        title="Selesaikan rapat & otomatis tandai belum hadir jadi Tidak Hadir"
                      >
                        <CheckCircle2 className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                        <span>Selesaikan</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSetActive(m)}
                        className="text-xs font-semibold text-teal-800 dark:text-teal-300 hover:text-teal-600 flex items-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Aktifkan</span>
                      </button>
                      <button
                        onClick={() => setCompletingTargetMeeting(m)}
                        className="text-[11px] font-medium text-slate-500 dark:text-teal-300/70 hover:text-slate-800 dark:hover:text-teal-100 underline"
                      >
                        Selesaikan
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {/* Lock / Unlock Toggle Button */}
                  <button
                    onClick={() => handleToggleLock(m)}
                    className={`p-1.5 rounded transition-colors ${
                      m.is_locked
                        ? 'text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60'
                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-teal-200 hover:bg-slate-100 dark:hover:bg-[#0b383d]'
                    }`}
                    title={m.is_locked ? 'Buka Kunci Rapat' : 'Kunci Rapat (Lindungi Integritas Pengesahan)'}
                  >
                    {m.is_locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => {
                      if (m.is_locked) {
                        if (!window.confirm(`Rapat "${m.title}" telah disahkan & terkunci resmi. Tetap ingin mengedit agenda ini?`)) {
                          return;
                        }
                      }
                      handleOpenEdit(m);
                    }}
                    className="p-1.5 text-slate-500 dark:text-teal-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#0b383d] rounded"
                    title={m.is_locked ? 'Edit Rapat (Terkunci)' : 'Edit Rapat'}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      if (m.is_locked) {
                        alert(`Rapat "${m.title}" telah disahkan secara resmi dan terkunci. Buka kunci terlebih dahulu jika ingin menghapusnya.`);
                        return;
                      }
                      setDeleteTargetMeeting(m);
                    }}
                    className={`p-1.5 rounded ${
                      m.is_locked
                        ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-60'
                        : 'text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40'
                    }`}
                    title={m.is_locked ? 'Tidak dapat dihapus (Rapat Terkunci)' : 'Hapus Rapat'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Tambah / Edit Rapat */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#072b2f] rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-[#0f4950] max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#0f4950] flex items-center justify-between bg-slate-50 dark:bg-[#031e21]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingMeeting ? 'Edit Agenda Rapat' : 'Buat Agenda Rapat Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 dark:text-teal-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 rounded-lg text-xs font-medium">
                  {formError}
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">
                  Nama / Agenda Kegiatan *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Contoh: Rapat Koordinasi Kurikulum & Disiplin Guru"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700 dark:text-teal-100">Kategori</label>
                    <button
                      type="button"
                      onClick={() => setIsCategoryModalOpen(true)}
                      className="text-[10px] text-teal-700 dark:text-teal-300 hover:underline font-semibold"
                    >
                      + Kelola Kategori
                    </button>
                  </div>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg focus:ring-2 focus:ring-teal-600 focus:outline-hidden bg-white dark:bg-[#031e21] text-slate-900 dark:text-white"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c} className="bg-white dark:bg-[#072b2f] text-slate-900 dark:text-white">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={formData.meeting_date}
                    onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">Mulai (WIB)</label>
                  <input
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">Selesai (WIB)</label>
                  <input
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">Toleransi (Menit)</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={formData.tolerance_minutes}
                    onChange={(e) => setFormData({ ...formData, tolerance_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">Tempat / Ruang</label>
                <input
                  type="text"
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  placeholder="Aula Pertemuan Utama Yayasan"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                />
              </div>

              {/* Pimpinan Rapat (Nama & NIY) */}
              <div className="p-3.5 bg-teal-50/70 dark:bg-[#042024] rounded-xl border border-teal-200 dark:border-[#0f4950] space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="font-bold text-teal-900 dark:text-teal-200 block text-[11px] uppercase tracking-wide">
                    Pimpinan Rapat (Tampil di Tanda Tangan SPJ Laporan)
                  </span>
                  {sortedTeachers.length > 0 && (
                    <select
                      onChange={(e) => {
                        const t = sortedTeachers.find((x) => x.id === e.target.value);
                        if (t) {
                          setFormData((prev) => ({
                            ...prev,
                            leader_name: t.name,
                            leader_niy: t.niy || t.nip || '',
                          }));
                        }
                      }}
                      className="text-[11px] px-2 py-1 bg-white dark:bg-[#031e21] border border-teal-300 dark:border-[#0f4950] rounded text-teal-950 dark:text-white font-medium w-full sm:w-auto max-w-full sm:max-w-xs truncate min-w-0 cursor-pointer"
                      defaultValue=""
                    >
                      <option value="" disabled>-- Pilih Pimpinan Rapat --</option>
                      {sortedTeachers.map((t) => (
                        <option key={t.id} value={t.id} className="bg-white dark:bg-[#072b2f]">
                          {t.name} ({t.niy || t.nip || '-'}) - {t.role_title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-teal-200/80 mb-1">Nama Pimpinan Rapat *</label>
                    <input
                      type="text"
                      required
                      value={formData.leader_name}
                      onChange={(e) => setFormData({ ...formData, leader_name: e.target.value })}
                      placeholder="Nama Pimpinan Rapat"
                      className="w-full px-3 py-1.5 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-teal-200/80 mb-1">NIY Pimpinan Rapat</label>
                    <input
                      type="text"
                      value={formData.leader_niy || ''}
                      onChange={(e) => setFormData({ ...formData, leader_niy: e.target.value })}
                      placeholder="Contoh: YHB-1994-001"
                      className="w-full px-3 py-1.5 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Notulis Rapat (Nama & NIY) */}
              <div className="p-3.5 bg-slate-50 dark:bg-[#042024] rounded-xl border border-slate-200 dark:border-[#0f4950] space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="font-bold text-slate-800 dark:text-teal-200 block text-[11px] uppercase tracking-wide">
                    Notulis / Panitia Rapat
                  </span>
                  {sortedTeachers.length > 0 && (
                    <select
                      onChange={(e) => {
                        const t = sortedTeachers.find((x) => x.id === e.target.value);
                        if (t) {
                          setFormData((prev) => ({
                            ...prev,
                            secretary_name: t.name,
                            secretary_niy: t.niy || t.nip || '',
                          }));
                        }
                      }}
                      className="text-[11px] px-2 py-1 bg-white dark:bg-[#031e21] border border-slate-300 dark:border-[#0f4950] rounded text-slate-800 dark:text-white font-medium w-full sm:w-auto max-w-full sm:max-w-xs truncate min-w-0 cursor-pointer"
                      defaultValue=""
                    >
                      <option value="" disabled>-- Pilih Notulis Rapat --</option>
                      {sortedTeachers.map((t) => (
                        <option key={t.id} value={t.id} className="bg-white dark:bg-[#072b2f]">
                          {t.name} ({t.niy || t.nip || '-'}) - {t.role_title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-teal-200/80 mb-1">Nama Notulis</label>
                    <input
                      type="text"
                      value={formData.secretary_name || ''}
                      onChange={(e) => setFormData({ ...formData, secretary_name: e.target.value })}
                      placeholder="Nama Notulis Rapat Ini"
                      className="w-full px-3 py-1.5 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-teal-200/80 mb-1">NIY Notulis</label>
                    <input
                      type="text"
                      value={formData.secretary_niy || ''}
                      onChange={(e) => setFormData({ ...formData, secretary_niy: e.target.value })}
                      placeholder="Contoh: YHB-2008-028"
                      className="w-full px-3 py-1.5 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* TARGET PESERTA RAPAT (SEMUA vs PILIH GURU TERTENTU) */}
              <div className="p-4 bg-slate-50 dark:bg-[#042024] rounded-xl border border-slate-200 dark:border-[#0f4950] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wide">
                      Target Peserta Rapat
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-teal-200/70">
                      Tentukan apakah agenda ini wajib untuk seluruh guru atau kelompok peserta tertentu
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-100 dark:bg-[#031e21] text-teal-900 dark:text-teal-200 border border-teal-200 dark:border-teal-800">
                    {formData.target_type === 'all'
                      ? `Semua Guru (${teachers.length})`
                      : `${formData.invited_teacher_ids?.length || 0} Terpilih`}
                  </span>
                </div>

                {/* Segmented Switch */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/70 dark:bg-[#031e21] rounded-lg border dark:border-[#0f4950]">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        target_type: 'all',
                        invited_teacher_ids: teachers.map((t) => t.id),
                      }))
                    }
                    className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors ${
                      formData.target_type === 'all'
                        ? 'bg-white dark:bg-[#0b383d] text-teal-900 dark:text-teal-200 shadow-xs'
                        : 'text-slate-600 dark:text-teal-200/70 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Semua Guru ({teachers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        target_type: 'custom',
                        invited_teacher_ids: prev.invited_teacher_ids?.length ? prev.invited_teacher_ids : teachers.map((t) => t.id),
                      }))
                    }
                    className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors ${
                      formData.target_type === 'custom'
                        ? 'bg-white dark:bg-[#0b383d] text-teal-900 dark:text-teal-200 shadow-xs'
                        : 'text-slate-600 dark:text-teal-200/70 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Pilih Guru Tertentu
                  </button>
                </div>

                {/* Selective Attendee Picker */}
                {formData.target_type === 'custom' && (
                  <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                    {/* Quick Select by Group Buttons */}
                    <div className="bg-slate-100/80 dark:bg-[#031e21] p-2.5 rounded-xl border border-slate-200 dark:border-[#0f4950] space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-700 dark:text-teal-200 uppercase tracking-wide">
                          Pilih Cepat Berdasarkan Kelompok:
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                invited_teacher_ids: sortedTeachers.map((t) => t.id),
                              }))
                            }
                            className="text-teal-700 dark:text-teal-300 hover:underline font-bold"
                          >
                            Semua ({sortedTeachers.length})
                          </button>
                          <span className="text-slate-300 dark:text-teal-700">·</span>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                invited_teacher_ids: [],
                              }))
                            }
                            className="text-rose-600 dark:text-rose-400 hover:underline font-bold"
                          >
                            Kosongkan
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {teacherGroups.map((grp) => {
                          const groupTeachers = sortedTeachers.filter((t) => t.is_active && getTeacherGroup(t) === grp);
                          if (groupTeachers.length === 0) return null;

                          const groupIds = groupTeachers.map((t) => t.id);
                          const currentSelected = formData.invited_teacher_ids || [];
                          const allInGroupSelected = groupIds.every((id) => currentSelected.includes(id));
                          const countInGroupSelected = groupIds.filter((id) => currentSelected.includes(id)).length;

                          return (
                            <button
                              key={grp}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => {
                                  const current = prev.invited_teacher_ids || [];
                                  if (allInGroupSelected) {
                                    // Deselect this group
                                    const next = current.filter((id) => !groupIds.includes(id));
                                    return { ...prev, invited_teacher_ids: next };
                                  } else {
                                    // Select all in this group
                                    const next = Array.from(new Set([...current, ...groupIds]));
                                    return { ...prev, invited_teacher_ids: next };
                                  }
                                });
                              }}
                              className={`px-2.5 py-1 text-[11px] rounded-lg font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                allInGroupSelected
                                  ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                                  : countInGroupSelected > 0
                                  ? 'bg-teal-50 dark:bg-[#0b383d] text-teal-900 dark:text-teal-200 border-teal-400 dark:border-teal-700 font-bold'
                                  : 'bg-white dark:bg-[#072b2f] text-slate-700 dark:text-teal-200 border-slate-300 dark:border-[#0f4950] hover:bg-slate-50 dark:hover:bg-[#0b383d]'
                              }`}
                            >
                              <span>{grp}</span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                allInGroupSelected
                                  ? 'bg-teal-950 text-teal-200'
                                  : 'bg-slate-200 dark:bg-[#031e21] text-slate-700 dark:text-teal-300'
                              }`}>
                                {countInGroupSelected}/{groupTeachers.length}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Filter Tabs & Search */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setAttendeeGroupFilter('all')}
                          className={`px-2.5 py-1 text-[11px] rounded-md font-semibold border cursor-pointer ${
                            attendeeGroupFilter === 'all'
                              ? 'bg-teal-800 text-white border-teal-800'
                              : 'bg-white dark:bg-[#031e21] text-slate-600 dark:text-teal-200 border-slate-300 dark:border-[#0f4950]'
                          }`}
                        >
                          Semua Kelompok
                        </button>
                        {teacherGroups.map((grp: string) => (
                          <button
                            key={grp}
                            type="button"
                            onClick={() => setAttendeeGroupFilter(grp)}
                            className={`px-2.5 py-1 text-[11px] rounded-md font-medium border cursor-pointer ${
                              attendeeGroupFilter === grp
                                ? 'bg-teal-800 text-white border-teal-800'
                                : 'bg-white dark:bg-[#031e21] text-slate-600 dark:text-teal-200 border-slate-300 dark:border-[#0f4950]'
                            }`}
                          >
                            {grp}
                          </button>
                        ))}
                      </div>

                      <input
                        type="text"
                        value={attendeeSearch}
                        onChange={(e) => setAttendeeSearch(e.target.value)}
                        placeholder="Cari nama guru, NIY, jabatan, atau mapel..."
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-teal-300/60 focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                      />
                    </div>

                    {/* Checklist of teachers sorted structural-first */}
                    <div className="max-h-56 overflow-y-auto space-y-1 p-2 bg-white dark:bg-[#031e21] rounded-xl border border-slate-200 dark:border-[#0f4950]">
                      {sortedTeachers
                        .filter((t) => t.is_active)
                        .filter((t) => {
                          const grp = getTeacherGroup(t);
                          if (attendeeGroupFilter !== 'all' && grp !== attendeeGroupFilter) return false;
                          if (!attendeeSearch) return true;
                          const q = attendeeSearch.toLowerCase();
                          return (
                            t.name.toLowerCase().includes(q) ||
                            (t.niy || t.nip || '').toLowerCase().includes(q) ||
                            t.role_title.toLowerCase().includes(q) ||
                            grp.toLowerCase().includes(q)
                          );
                        })
                        .map((t) => {
                          const isChecked = (formData.invited_teacher_ids || []).includes(t.id);
                          const grp = getTeacherGroup(t);
                          const badgeColor = getGroupBadgeColor(grp);

                          return (
                            <label
                              key={t.id}
                              className={`p-2.5 rounded-lg border flex items-center justify-between text-xs cursor-pointer transition-colors ${
                                isChecked
                                  ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/60 text-slate-900 dark:text-white'
                                  : 'border-slate-200 dark:border-[#0f4950]/80 text-slate-600 dark:text-teal-200/80 hover:bg-slate-50 dark:hover:bg-[#072b2f]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    const currentList = formData.invited_teacher_ids || [];
                                    const nextList = isChecked
                                      ? currentList.filter((id) => id !== t.id)
                                      : [...currentList, t.id];
                                    setFormData((prev) => ({ ...prev, invited_teacher_ids: nextList }));
                                  }}
                                  className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold truncate text-slate-900 dark:text-white">{t.name}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${badgeColor.bg} ${badgeColor.text} ${badgeColor.border}`}>
                                      {grp}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-teal-300/80 font-mono mt-0.5">
                                    NIY. {t.niy || t.nip || '-'} · <span className="font-sans font-medium text-slate-700 dark:text-teal-200">{t.role_title}</span>
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] text-slate-400 dark:text-teal-400/80 shrink-0 hidden sm:inline-block">{t.rank_group}</span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">Status Kegiatan</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as Meeting['status'] })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg focus:ring-2 focus:ring-teal-600 focus:outline-hidden bg-white dark:bg-[#031e21] text-slate-900 dark:text-white"
                >
                  <option value="active" className="bg-white dark:bg-[#072b2f]">Active (Sedang Berlangsung & Pemindaian Dibuka)</option>
                  <option value="upcoming" className="bg-white dark:bg-[#072b2f]">Upcoming (Jadwal Mendatang)</option>
                  <option value="completed" className="bg-white dark:bg-[#072b2f]">Completed (Selesai - Otomatis ubah belum hadir jadi Tidak Hadir)</option>
                </select>
                {formData.status === 'completed' && (
                  <p className="text-[11px] text-amber-800 dark:text-amber-200 mt-1.5 flex items-center gap-1.5 font-medium bg-amber-50 dark:bg-amber-950/60 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Saat disimpan, seluruh guru peserta yang belum presensi akan otomatis ditandai status "Tidak Hadir".</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">Catatan / Pokok Bahasan</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Catatan agenda atau instruksi untuk peserta..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-[#0f4950] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-[#0b383d] hover:bg-slate-300 dark:hover:bg-[#0f4950] rounded-lg text-slate-700 dark:text-teal-100 font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-800 hover:bg-teal-700 text-white rounded-lg font-semibold shadow-xs transition-colors"
                >
                  Simpan Agenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SELESAIKAN RAPAT & TANDAI TIDAK HADIR */}
      {completingTargetMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#072b2f] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-[#0f4950] p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Selesaikan Agenda Rapat?
              </h3>
              <p className="text-xs text-slate-600 dark:text-teal-100/80 leading-relaxed">
                Anda akan menyelesaikan sesi rapat <strong className="text-slate-900 dark:text-white">{completingTargetMeeting.title}</strong>.
              </p>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs text-left leading-relaxed">
                <span className="font-bold block mb-1">Ketentuan Otomatis:</span>
                Seluruh guru dan staf yang berstatus <strong>Belum Hadir</strong> akan otomatis diubah statusnya menjadi <strong>Tidak Hadir (Alpa)</strong> di database presensi.
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isCompleting}
                onClick={() => setCompletingTargetMeeting(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-[#0b383d] hover:bg-slate-200 dark:hover:bg-[#0f4950] text-slate-700 dark:text-teal-100 rounded-xl text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isCompleting}
                onClick={handleExecuteCompleteMeeting}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isCompleting ? 'Memproses...' : 'Ya, Selesaikan & Tandai Tidak Hadir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KELOLA DAFTAR KATEGORI RAPAT */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#072b2f] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-[#0f4950] p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#0f4950]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Kelola Daftar Kategori Rapat</h3>
                  <p className="text-[11px] text-slate-500 dark:text-teal-200/70">Kategori dapat dipilih saat membuat atau mengedit agenda</p>
                </div>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 text-slate-400 dark:text-teal-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#0b383d]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {categoryMsg && (
              <div className="p-2.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{categoryMsg}</span>
              </div>
            )}

            {/* Form Tambah Kategori Baru */}
            <form onSubmit={handleAddCategorySubmit} className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-teal-100 uppercase tracking-wide">
                Tambah Kategori Baru
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  placeholder="Contoh: Rapat Pleno, Evaluasi Bulanan..."
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg text-xs bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={!newCategoryInput.trim()}
                  className="px-4 py-2 bg-teal-800 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors shrink-0"
                >
                  Tambah
                </button>
              </div>
            </form>

            {/* List Kategori Saat Ini */}
            <div className="space-y-2 pt-2">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-teal-100 uppercase tracking-wide">
                Daftar Kategori Tersedia ({categories.length})
              </label>
              <div className="max-h-52 overflow-y-auto space-y-1.5 p-2 bg-slate-50 dark:bg-[#031e21] rounded-xl border border-slate-200 dark:border-[#0f4950]">
                {categories.map((cat) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between p-2.5 bg-white dark:bg-[#072b2f] rounded-lg border border-slate-200 dark:border-[#0f4950] text-xs"
                  >
                    <span className="font-semibold text-slate-800 dark:text-white">{cat}</span>
                    {categories.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCategoryClick(cat)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded"
                        title="Hapus Kategori"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 bg-teal-900 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS RAPAT */}
      {deleteTargetMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#072b2f] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-[#0f4950] p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-300 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Konfirmasi Hapus Agenda Rapat
              </h3>
              <p className="text-xs text-slate-600 dark:text-teal-100/80 leading-relaxed">
                Apakah Anda yakin ingin menghapus agenda <strong className="text-slate-900 dark:text-white">{deleteTargetMeeting.title}</strong> ({deleteTargetMeeting.meeting_date})?
              </p>
              <p className="text-[11px] text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border dark:border-red-900/60 p-2 rounded-lg font-medium">
                Peringatan: Seluruh riwayat presensi yang telah tercatat untuk rapat ini akan ikut terhapus secara permanen.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTargetMeeting(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-[#0b383d] hover:bg-slate-200 dark:hover:bg-[#0f4950] text-slate-700 dark:text-teal-100 rounded-xl text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Agenda Rapat'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
