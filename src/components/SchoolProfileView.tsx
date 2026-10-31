import React, { useState, useRef } from 'react';
import { School, Save, Check, Globe, Phone, Mail, MapPin, User, Shield, MessageSquare, Image, Upload, Trash2, Building2, Lock, KeyRound, AlertCircle } from 'lucide-react';
import { SchoolProfile } from '../types';
import { saveSchoolProfile } from '../lib/storage';

interface SchoolProfileViewProps {
  profile: SchoolProfile;
  onRefresh: () => void;
  adminPin?: string;
  onUpdateAdminPin?: (newPin: string) => void;
}

export const SchoolProfileView: React.FC<SchoolProfileViewProps> = ({
  profile,
  onRefresh,
  adminPin = '1234',
  onUpdateAdminPin,
}) => {
  const [formData, setFormData] = useState<SchoolProfile>({ ...profile });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Admin PIN management state
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinMessage, setPinMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('File harus berupa gambar (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Ukuran file maksimal 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setFormData((prev) => ({ ...prev, logo_url: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setFormData((prev) => ({ ...prev, logo_url: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await saveSchoolProfile(formData);
    setIsSaving(false);
    setSaveSuccess(true);
    onRefresh();
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleUpdatePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage(null);

    if (currentPinInput !== adminPin) {
      setPinMessage({ type: 'error', text: 'PIN lama tidak sesuai.' });
      return;
    }

    if (newPinInput.length < 4) {
      setPinMessage({ type: 'error', text: 'PIN baru minimal 4 angka.' });
      return;
    }

    if (newPinInput !== confirmPinInput) {
      setPinMessage({ type: 'error', text: 'Konfirmasi PIN baru tidak cocok.' });
      return;
    }

    if (onUpdateAdminPin) {
      onUpdateAdminPin(newPinInput);
    }
    setPinMessage({ type: 'success', text: 'PIN Admin berhasil diubah!' });
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setTimeout(() => setPinMessage(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#072b2f] p-5 rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Profil Yayasan, Sekolah & Kop Surat</h2>
          <p className="text-xs text-slate-500 dark:text-teal-200/80 mt-0.5">
            Nama Yayasan akan otomatis tampil di atas Nama Sekolah pada kop surat resmi laporan presensi.
          </p>
        </div>

        {saveSuccess && (
          <div className="px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Profil & logo yayasan berhasil disimpan!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-7 bg-white dark:bg-[#072b2f] p-6 rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs">
          <form onSubmit={handleSubmit} className="space-y-5 text-xs">
            {/* Logo Upload Section */}
            <div className="p-4 bg-slate-50 dark:bg-[#042024] rounded-xl border border-slate-200 dark:border-[#0f4950] space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-1.5">
                <Image className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Upload Logo Aplikasi & Yayasan</span>
              </h3>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Logo Preview */}
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 dark:border-[#0f4950] bg-white dark:bg-[#031e21] flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                  {formData.logo_url ? (
                    <img
                      src={formData.logo_url}
                      alt="Logo Yayasan"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <div className="text-center text-slate-400 dark:text-teal-400/60">
                      <Image className="w-6 h-6 mx-auto mb-0.5 stroke-1" />
                      <span className="text-[10px]">No Logo</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="logo-file-input"
                    />
                    <label
                      htmlFor="logo-file-input"
                      className="px-3.5 py-2 bg-teal-800 hover:bg-teal-700 text-white rounded-lg font-medium cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Pilih File Logo</span>
                    </label>

                    {formData.logo_url && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-3 py-2 bg-slate-200 dark:bg-[#0b383d] hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-600 dark:text-teal-200 hover:text-red-600 rounded-lg transition-colors inline-flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Logo</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-teal-200/70">
                    Format: PNG, JPG, SVG, WebP (Maks 2 MB). Tampil di Sidebar, ID Card, dan Kop Surat.
                  </p>
                  {uploadError && (
                    <p className="text-[11px] text-red-600 dark:text-red-300 font-medium bg-red-50 dark:bg-red-950/40 p-2 rounded-lg border border-red-200 dark:border-red-900/60">
                      {uploadError}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-100 dark:border-[#0f4950] pb-2 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-teal-800 dark:text-teal-300" />
              <span>Identitas Yayasan & Sekolah</span>
            </h3>

            {/* Nama Yayasan */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">
                Nama Yayasan (Tampil di atas Nama Sekolah pada Kop Surat) *
              </label>
              <input
                type="text"
                required
                value={formData.foundation_name || ''}
                onChange={(e) => setFormData({ ...formData, foundation_name: e.target.value })}
                placeholder="Contoh: YAYASAN PENDIDIKAN HARAPAN BANGSA"
                className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-teal-950 dark:text-teal-200 focus:ring-2 focus:ring-teal-600 focus:outline-hidden font-bold uppercase"
              />
            </div>

            {/* Nama Sekolah */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">
                Nama Resmi Sekolah *
              </label>
              <input
                type="text"
                required
                value={formData.school_name}
                onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                placeholder="Contoh: SMP HARAPAN BANGSA"
                className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden font-bold uppercase"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">Nomor Pokok Sekolah Nasional (NPSN)</label>
                <input
                  type="text"
                  value={formData.npsn}
                  onChange={(e) => setFormData({ ...formData, npsn: e.target.value })}
                  placeholder="20104567"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">Kode Pos</label>
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  placeholder="55281"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">Alamat Lengkap</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Jl. Ki Hajar Dewantara No. 45, Kompleks Yayasan"
                className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">Kota / Kabupaten</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Kabupaten Cerdas"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">Provinsi</label>
                <input
                  type="text"
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  placeholder="Jawa Tengah"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">No. Telepon</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(0274) 554321"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">Email Resmi</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="info@smpharapanbangsa.sch.id"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">Website</label>
                <input
                  type="text"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://smpharapanbangsa.sch.id"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                />
              </div>
            </div>

            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-100 dark:border-[#0f4950] pb-2 pt-3 flex items-center gap-1.5">
              <User className="w-4 h-4 text-teal-800 dark:text-teal-300" />
              <span>Pimpinan Sekolah (Kepala Sekolah)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">Nama Kepala Sekolah</label>
                <input
                  type="text"
                  value={formData.headmaster_name}
                  onChange={(e) => setFormData({ ...formData, headmaster_name: e.target.value })}
                  placeholder="Drs. H. Bambang Sudarsono, M.Pd."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">NIY Kepala Sekolah</label>
                <input
                  type="text"
                  value={formData.headmaster_niy}
                  onChange={(e) => setFormData({ ...formData, headmaster_niy: e.target.value })}
                  placeholder="YHB-1994-001"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">No. HP / WhatsApp *</label>
                <input
                  type="text"
                  value={formData.headmaster_phone || ''}
                  onChange={(e) => setFormData({ ...formData, headmaster_phone: e.target.value })}
                  placeholder="081234567800"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden font-mono"
                />
              </div>
            </div>

            {/* Staf Administrasi (Pengganti Petugas Ekspedisi) */}
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-100 dark:border-[#0f4950] pb-2 pt-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Staf Administrasi (Penandatangan Buku Ekspedisi)</span>
              </span>
              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-normal">
                Pengganti Petugas Ekspedisi
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">
                  Nama Staf Administrasi *
                </label>
                <input
                  type="text"
                  value={formData.admin_staff_name || ''}
                  onChange={(e) => setFormData({ ...formData, admin_staff_name: e.target.value })}
                  placeholder="Contoh: Siti Aminah, A.Md."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">
                  NIY Staf Administrasi
                </label>
                <input
                  type="text"
                  value={formData.admin_staff_niy || ''}
                  onChange={(e) => setFormData({ ...formData, admin_staff_niy: e.target.value })}
                  placeholder="YHB-2015-089"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">
                  No. HP / WhatsApp *
                </label>
                <input
                  type="text"
                  value={formData.admin_staff_phone || ''}
                  onChange={(e) => setFormData({ ...formData, admin_staff_phone: e.target.value })}
                  placeholder="081234567899"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden font-mono"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-teal-300/70">
              Nama dan nomor ini digunakan untuk integrasi pengiriman tautan persetujuan Tanda Tangan Elektronik Buku Ekspedisi secara resmi via WhatsApp.
            </p>

            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-100 dark:border-[#0f4950] pb-2 pt-3 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Integrasi WhatsApp Group Yayasan / Sekolah (WAHA)</span>
            </h3>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-teal-100 mb-1">
                WhatsApp Group ID (Untuk Kirim Rekapitulasi Rapat)
              </label>
              <input
                type="text"
                value={formData.waha_group_id}
                onChange={(e) => setFormData({ ...formData, waha_group_id: e.target.value })}
                placeholder="120363045612398@g.us atau ID grup WA Anda"
                className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
              />
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-[#0f4950] flex items-center justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-teal-800 hover:bg-teal-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Profil Yayasan & Sekolah'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right: Live Preview Kop Surat Yayasan */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-[#072b2f] p-6 rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 dark:border-[#0f4950] pb-2">
              <Shield className="w-4 h-4 text-teal-800 dark:text-teal-300" />
              <span>Pratinjau Kop Surat Resmi Yayasan</span>
            </h3>

            {/* Official Indonesian Foundation & School Letterhead Box */}
            <div className="p-5 border border-slate-300 rounded-lg bg-white shadow-2xs space-y-3 font-serif">
              <div className="text-center relative pb-2">
                <div className="w-12 h-12 absolute left-0 top-0 flex items-center justify-center font-bold text-xs text-blue-950">
                  {formData.logo_url ? (
                    <img src={formData.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    'LOGO'
                  )}
                </div>

                <div className="px-14">
                  {/* BARIS 1: NAMA YAYASAN */}
                  <h4 className="text-xs font-black uppercase tracking-wider text-blue-950 leading-tight">
                    {formData.foundation_name || 'YAYASAN PENDIDIKAN HARAPAN BANGSA'}
                  </h4>

                  {/* BARIS 2: NAMA SEKOLAH */}
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-tight mt-0.5">
                    {formData.school_name || 'SMP HARAPAN BANGSA'}
                  </h3>

                  <p className="text-[9px] text-slate-600 font-sans mt-1">
                    {formData.address || 'Jl. Ki Hajar Dewantara No. 45'} · NPSN: {formData.npsn || '20104567'}
                  </p>
                  <p className="text-[9px] text-slate-500 font-sans">
                    Telp: {formData.phone || '-'} · Email: {formData.email || '-'} · Website: {formData.website || '-'}
                  </p>
                </div>
              </div>

              {/* Double Horizontal Divider (Kop Line) */}
              <div className="space-y-0.5">
                <div className="border-b-2 border-slate-900" />
                <div className="border-b border-slate-900" />
              </div>

              {/* Sample Document Title */}
              <div className="text-center pt-2 font-sans">
                <h5 className="text-xs font-bold uppercase underline tracking-wide text-slate-900">
                  DAFTAR HADIR PESERTA KEGIATAN
                </h5>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Nomor: 042 / YHB-SMP / RPT / 2026
                </p>
              </div>

              <div className="pt-4 text-center text-[10px] font-sans text-slate-500">
                <p>Kop surat ini akan otomatis tercetak di lembar laporan resmi presensi (PDF).</p>
              </div>
            </div>
          </div>

          {/* Keamanan & PIN Akses Admin */}
          <div className="bg-white dark:bg-[#072b2f] p-5 rounded-xl border border-slate-200 dark:border-[#0f4950] shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
              <Lock className="w-4 h-4 text-teal-800 dark:text-teal-300" />
              <span>Keamanan & PIN Akses Admin</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-teal-200/80">
              PIN ini digunakan untuk mengunci konsol admin agar guru yang melakukan scan presensi tidak dapat membuka menu pengaturan atau data sekolah.
            </p>

            <form onSubmit={handleUpdatePinSubmit} className="space-y-3 pt-1">
              {pinMessage && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                    pinMessage.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900'
                  }`}
                >
                  {pinMessage.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <span>{pinMessage.text}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-teal-100 mb-1">
                  PIN Lama
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={currentPinInput}
                  onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Masukkan PIN saat ini"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg text-xs font-mono bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-teal-100 mb-1">
                    PIN Baru (4-6 Angka)
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="PIN baru"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg text-xs font-mono bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-teal-100 mb-1">
                    Ulangi PIN Baru
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={confirmPinInput}
                    onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="Konfirmasi"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-[#0f4950] rounded-lg text-xs font-mono bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!currentPinInput || !newPinInput || !confirmPinInput}
                className="w-full py-2 px-3 bg-teal-800 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Simpan Perubahan PIN</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
