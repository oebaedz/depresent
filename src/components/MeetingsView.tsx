import React, { useState } from 'react';
import { Calendar, Plus, Edit2, Trash2, CheckCircle, Clock, MapPin, User, FileEdit, X, Users } from 'lucide-react';
import { Meeting, Teacher } from '../types';
import { deleteMeeting, saveMeeting } from '../lib/storage';
import { generateUUID } from '../lib/uuid';

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

  // Delete confirmation modal state
  const [deleteTargetMeeting, setDeleteTargetMeeting] = useState<Meeting | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState<Omit<Meeting, 'id'>>({
    title: '',
    category: 'Rapat Dinas',
    meeting_date: new Date().toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '11:00',
    room: 'Aula Pertemuan Utama Yayasan',
    leader_name: 'Drs. H. Bambang Sudarsono, M.Pd.',
    leader_niy: 'YHB-1994-001',
    secretary_name: 'Siti Rahmawati, S.Pd.',
    secretary_niy: 'YHB-2008-028',
    tolerance_minutes: 15,
    status: 'active',
    notes: '',
  });

  const handleOpenAdd = () => {
    setEditingMeeting(null);
    setFormError(null);
    setFormData({
      title: '',
      category: 'Rapat Dinas',
      meeting_date: new Date().toISOString().split('T')[0],
      start_time: '08:00',
      end_time: '11:00',
      room: 'Aula Pertemuan Utama Yayasan',
      leader_name: teachers[0]?.name || 'Drs. H. Bambang Sudarsono, M.Pd.',
      leader_niy: teachers[0]?.niy || teachers[0]?.nip || 'YHB-1994-001',
      secretary_name: teachers[1]?.name || 'Siti Rahmawati, S.Pd.',
      secretary_niy: teachers[1]?.niy || teachers[1]?.nip || 'YHB-2008-028',
      tolerance_minutes: 15,
      status: 'active',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m: Meeting) => {
    setEditingMeeting(m);
    setFormError(null);
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

    await saveMeeting(meetingToSave);
    setIsModalOpen(false);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Agenda Rapat & Kegiatan Yayasan (Tabel smp_meetings)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pimpinan rapat dan notulis dapat diatur berbeda di tiap meeting untuk titimangsa laporan SPJ kedinasan.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 self-start md:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Buat Agenda Rapat Baru</span>
        </button>
      </div>

      {/* Meeting Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {meetings.map((m) => {
          const isActive = m.status === 'active';

          return (
            <div
              key={m.id}
              className={`p-5 rounded-xl border shadow-xs flex flex-col justify-between transition-all ${
                isActive
                  ? 'border-blue-500 bg-white ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
                    {m.category}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      m.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : m.status === 'upcoming'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {m.status}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                  {m.title}
                </h3>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{m.meeting_date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono">{m.start_time} - {m.end_time} WIB</span>
                    <span className="text-[10px] text-slate-400">({m.tolerance_minutes}m toleransi)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{m.room}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">
                      Pimpinan: <strong>{m.leader_name}</strong> {m.leader_niy ? `(${m.leader_niy})` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileEdit className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      Notulis: <strong>{m.secretary_name || '-'}</strong> {m.secretary_niy ? `(${m.secretary_niy})` : ''}
                    </span>
                  </div>
                </div>

                {m.notes && (
                  <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 line-clamp-2">
                    {m.notes}
                  </p>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                {!isActive ? (
                  <button
                    onClick={() => handleSetActive(m)}
                    className="text-xs font-semibold text-blue-900 hover:text-blue-700 flex items-center gap-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Jadikan Rapat Aktif</span>
                  </button>
                ) : (
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Sedang Berlangsung</span>
                  </span>
                )}

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(m)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                    title="Edit Rapat"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTargetMeeting(m)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Hapus Rapat"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingMeeting ? 'Edit Agenda Rapat' : 'Buat Agenda Rapat Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-medium">
                  {formError}
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama / Agenda Kegiatan *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Contoh: Rapat Koordinasi Kurikulum & Disiplin Guru"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as Meeting['category'] })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden bg-white"
                  >
                    <option value="Rapat Dinas">Rapat Dinas Yayasan</option>
                    <option value="Workshop">Workshop / Pelatihan</option>
                    <option value="Briefing">Briefing Pagi</option>
                    <option value="MGMP">MGMP Sekolah</option>
                    <option value="Upacara">Upacara / Apel</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={formData.meeting_date}
                    onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mulai (WIB)</label>
                  <input
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Selesai (WIB)</label>
                  <input
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Toleransi (Menit)</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={formData.tolerance_minutes}
                    onChange={(e) => setFormData({ ...formData, tolerance_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tempat / Ruang</label>
                <input
                  type="text"
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  placeholder="Aula Pertemuan Utama Yayasan"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              {/* Pimpinan Rapat (Nama & NIY) */}
              <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 block text-[11px] uppercase tracking-wide">
                    Pimpinan Rapat (Tampil di Tanda Tangan SPJ Laporan)
                  </span>
                  {teachers.length > 0 && (
                    <select
                      onChange={(e) => {
                        const t = teachers.find((x) => x.id === e.target.value);
                        if (t) {
                          setFormData((prev) => ({
                            ...prev,
                            leader_name: t.name,
                            leader_niy: t.niy || t.nip || '',
                          }));
                        }
                      }}
                      className="text-[11px] px-2 py-1 bg-white border border-blue-300 rounded text-blue-950 font-medium"
                      defaultValue=""
                    >
                      <option value="" disabled>-- Pilih dari Daftar Guru --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.niy || t.nip || '-'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Nama Pimpinan Rapat *</label>
                    <input
                      type="text"
                      required
                      value={formData.leader_name}
                      onChange={(e) => setFormData({ ...formData, leader_name: e.target.value })}
                      placeholder="Nama Pimpinan Rapat"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">NIY Pimpinan Rapat</label>
                    <input
                      type="text"
                      value={formData.leader_niy || ''}
                      onChange={(e) => setFormData({ ...formData, leader_niy: e.target.value })}
                      placeholder="Contoh: YHB-1994-001"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-mono focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Notulis Rapat (Nama & NIY) */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wide">
                    Notulis / Panitia Rapat
                  </span>
                  {teachers.length > 0 && (
                    <select
                      onChange={(e) => {
                        const t = teachers.find((x) => x.id === e.target.value);
                        if (t) {
                          setFormData((prev) => ({
                            ...prev,
                            secretary_name: t.name,
                            secretary_niy: t.niy || t.nip || '',
                          }));
                        }
                      }}
                      className="text-[11px] px-2 py-1 bg-white border border-slate-300 rounded text-slate-800 font-medium"
                      defaultValue=""
                    >
                      <option value="" disabled>-- Pilih dari Daftar Guru --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.niy || t.nip || '-'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Nama Notulis</label>
                    <input
                      type="text"
                      value={formData.secretary_name || ''}
                      onChange={(e) => setFormData({ ...formData, secretary_name: e.target.value })}
                      placeholder="Nama Notulis Rapat Ini"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">NIY Notulis</label>
                    <input
                      type="text"
                      value={formData.secretary_niy || ''}
                      onChange={(e) => setFormData({ ...formData, secretary_niy: e.target.value })}
                      placeholder="Contoh: YHB-2008-028"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-mono focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Kegiatan</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as Meeting['status'] })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden bg-white"
                >
                  <option value="active">Active (Sedang Berlangsung & Pemindaian Dibuka)</option>
                  <option value="upcoming">Upcoming (Jadwal Mendatang)</option>
                  <option value="completed">Completed (Selesai)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan / Pokok Bahasan</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Catatan agenda atau instruksi untuk peserta..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-lg font-semibold shadow-xs"
                >
                  Simpan Agenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS RAPAT */}
      {deleteTargetMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                Konfirmasi Hapus Agenda Rapat
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus agenda <strong className="text-slate-900">{deleteTargetMeeting.title}</strong> ({deleteTargetMeeting.meeting_date})?
              </p>
              <p className="text-[11px] text-red-600 bg-red-50 p-2 rounded-lg font-medium">
                Peringatan: Seluruh riwayat presensi yang telah tercatat untuk rapat ini akan ikut terhapus secara permanen.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTargetMeeting(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
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
