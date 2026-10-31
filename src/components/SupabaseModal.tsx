import React, { useState, useEffect } from 'react';
import { X, Database, Check, Copy, AlertTriangle, ExternalLink, RefreshCw, Globe, UploadCloud, CheckCircle2, Sparkles, UserCheck } from 'lucide-react';
import { getSupabaseCredentials, saveSupabaseCredentials, SUPABASE_SQL_SCHEMA, SUPABASE_SQL_MIGRATION_V4, SUPABASE_SQL_INVITATIONS, SUPABASE_SQL_LETTER_NUMBER, SUPABASE_SQL_SIGNATURES, SUPABASE_SQL_MESSAGE_TEMPLATES, SUPABASE_SQL_SIGNER_PROFILES, testSupabaseConnection } from '../lib/supabase';
import { syncInitialDataToSupabase } from '../lib/storage';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionSuccess: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose, onConnectionSuccess }) => {
  const current = getSupabaseCredentials();
  const [url, setUrl] = useState(current.url);
  const [anonKey, setAnonKey] = useState(current.anonKey);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    tablesExist?: boolean;
    missingTables?: string[];
    missingColumns?: string[];
    teacherCount?: number;
  } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedMigration, setCopiedMigration] = useState(false);
  const [copiedInvitationsSql, setCopiedInvitationsSql] = useState(false);
  const [copiedLetterNumberSql, setCopiedLetterNumberSql] = useState(false);
  const [copiedSignaturesSql, setCopiedSignaturesSql] = useState(false);
  const [copiedTemplatesSql, setCopiedTemplatesSql] = useState(false);
  const [copiedSignerProfilesSql, setCopiedSignerProfilesSql] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Auto-test on modal open if credentials already exist
  useEffect(() => {
    if (isOpen && current.url && current.anonKey) {
      testSupabaseConnection(current.url, current.anonKey).then(setTestResult);
    }
  }, [isOpen, current.url, current.anonKey]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    setSyncResult(null);
    const res = await testSupabaseConnection(url, anonKey);
    setTestResult(res);
    setIsTesting(false);
  };

  const handleSave = async () => {
    saveSupabaseCredentials(url, anonKey);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
    onConnectionSuccess();
    handleTest();
  };

  const handleSyncInitialData = async () => {
    // First save credentials
    saveSupabaseCredentials(url, anonKey);
    setIsSyncing(true);
    setSyncResult(null);

    const res = await syncInitialDataToSupabase();
    setIsSyncing(false);
    setSyncResult(res.message);
    if (res.success) {
      onConnectionSuccess();
      handleTest();
    }
  };

  const handleResetToDemo = () => {
    setUrl('');
    setAnonKey('');
    saveSupabaseCredentials('', '');
    setTestResult(null);
    setSyncResult('Kredensial dinonaktifkan, aplikasi beralih ke penyimpanan lokal browser.');
    setTimeout(() => setSyncResult(null), 3000);
    onConnectionSuccess();
  };

  const handleCopySql = async () => {
    await navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleCopyMigration = async () => {
    await navigator.clipboard.writeText(SUPABASE_SQL_MIGRATION_V4);
    setCopiedMigration(true);
    setTimeout(() => setCopiedMigration(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#072b2f] rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 dark:border-[#0f4950]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#0f4950] flex items-center justify-between bg-slate-50 dark:bg-[#031e21]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Koneksi Database Supabase</h3>
              <p className="text-xs text-slate-500 dark:text-teal-200/80">Integrasi tabel smp_school_profile, smp_teachers, smp_meetings, smp_attendances</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 dark:text-teal-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#0b383d] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Quick Guidance Box */}
          <div className="p-3.5 bg-teal-50 dark:bg-[#042024] border border-teal-200 dark:border-[#0f4950] rounded-lg text-xs text-teal-950 dark:text-teal-100 flex items-start gap-3">
            <Globe className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-teal-950 dark:text-white">Langkah Menghubungkan & Menyinkronkan Database Supabase:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-teal-900 dark:text-teal-200/90">
                <li>Buka dashboard project Supabase Anda di <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="underline font-medium inline-flex items-center gap-0.5">supabase.com <ExternalLink className="w-2.5 h-2.5" /></a>.</li>
                <li>Masuk ke menu <strong>Project Settings &rarr; API</strong>, salin <em>Project URL</em> dan <em>anon public key</em> ke formulir di bawah.</li>
                <li>Buka menu <strong>SQL Editor</strong> di Supabase, klik tombol <strong>"Salin Skrip SQL"</strong> di bawah lalu jalankan (Run) agar tabel <code>smp_*</code> dan izin RLS dibuat otomatis.</li>
              </ol>
            </div>
          </div>

          {/* Form Inputs */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-teal-100 mb-1">
                Supabase Project URL *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://xyzabcdefg.supabase.co"
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-teal-100 mb-1">
                Supabase Anon (Public) Key *
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Actions: Test, Save & Seed */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={handleTest}
              disabled={isTesting || !url || !anonKey}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-teal-100 bg-slate-100 dark:bg-[#0b383d] hover:bg-slate-200 dark:hover:bg-[#0f4950] border border-slate-300 dark:border-[#0f4950] rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Menguji...' : 'Uji Koneksi & Cek Tabel'}</span>
            </button>

            <button
              onClick={handleSave}
              className="px-4 py-2 text-xs font-medium text-white bg-teal-800 hover:bg-teal-700 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Simpan Kredensial</span>
            </button>

            {/* 1-Click Seed Button to push data to Supabase */}
            <button
              onClick={handleSyncInitialData}
              disabled={isSyncing || !url || !anonKey}
              title="Unggah data sekolah dan guru yang ada saat ini ke database Supabase Anda"
              className="px-3.5 py-2 text-xs font-semibold text-emerald-900 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-800 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <UploadCloud className={`w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 ${isSyncing ? 'animate-bounce' : ''}`} />
              <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Data Awal ke Supabase'}</span>
            </button>

            <button
              onClick={handleResetToDemo}
              className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-teal-300/70 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#0b383d] rounded-lg transition-colors ml-auto cursor-pointer"
            >
              Hapus Kredensial / Mode Lokal
            </button>
          </div>

          {/* Test Status Feedback */}
          {testResult && (
            <div
              className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                testResult.success
                  ? testResult.tablesExist
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                  : 'bg-red-50 border-red-300 text-red-950'
              }`}
            >
              {testResult.success ? (
                testResult.tablesExist ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1.5 flex-1">
                <p className="font-bold">
                  {testResult.success
                    ? testResult.tablesExist
                      ? 'Koneksi Supabase Berhasil & Siap Digunakan'
                      : 'Koneksi Terhubung, Tetapi Tabel Belum Dibuat'
                    : 'Koneksi Gagal'}
                </p>
                <p className="leading-relaxed">{testResult.message}</p>

                {testResult.success && !testResult.tablesExist && (
                  <div className="pt-2">
                    <button
                      onClick={handleCopySql}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Skrip SQL Sekarang</span>
                    </button>
                    <p className="text-[11px] text-amber-800 mt-1">
                      Buka tab <strong>SQL Editor</strong> di dashboard Supabase Anda, tempelkan skrip ini lalu klik <strong>Run</strong>.
                    </p>
                  </div>
                )}

                {testResult.success && testResult.tablesExist && testResult.teacherCount === 0 && (
                  <p className="text-[11px] text-emerald-800 font-medium pt-1">
                    Tabel database sudah aktif. Klik tombol hijau <strong>"Sinkronkan Data Awal ke Supabase"</strong> di atas agar database langsung terisi data guru & profil sekolah.
                  </p>
                )}
              </div>
            </div>
          )}

          {syncResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{syncResult}</span>
            </div>
          )}

          {savedSuccess && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Kredensial Supabase berhasil disimpan! Database siap digunakan.</span>
            </div>
          )}

          {/* Quick Migration Tool for Selective Attendees */}
          <div className="p-3.5 bg-amber-50 dark:bg-[#042024] border border-amber-300 dark:border-amber-700/60 rounded-xl space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                <h4 className="text-xs font-bold text-amber-950 dark:text-amber-200">
                  Update Skema Kolom Peserta Rapat (Selective Attendees)
                </h4>
              </div>
              <button
                onClick={handleCopyMigration}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  copiedMigration
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900'
                }`}
              >
                {copiedMigration ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin SQL Update Kolom</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-amber-900 dark:text-amber-200/90 leading-relaxed">
              Jika tabel <code>smp_meetings</code> Anda sudah ada di Supabase, jalankan baris perintah ini di SQL Editor untuk menambahkan kolom peserta khusus dan nomor surat:
            </p>
            <div className="rounded-lg bg-amber-950/90 p-2 text-amber-100 font-mono text-[11px] select-all">
              ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'all';<br />
              ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS invited_teacher_ids JSONB DEFAULT '[]'::jsonb;<br />
              ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS letter_number TEXT DEFAULT '-';<br />
              ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;<br />
              ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
            </div>
          </div>

          {/* Migration Card for letter_number */}
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 dark:bg-sky-950/40 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <h4 className="text-xs font-bold text-sky-950 dark:text-sky-200 uppercase tracking-wide">
                  Skema DB Kolom Nomor Surat (letter_number)
                </h4>
              </div>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(SUPABASE_SQL_LETTER_NUMBER);
                  setCopiedLetterNumberSql(true);
                  setTimeout(() => setCopiedLetterNumberSql(false), 2500);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  copiedLetterNumberSql
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-sky-100 dark:bg-sky-900/60 text-sky-950 dark:text-sky-100 border-sky-300 dark:border-sky-700 hover:bg-sky-200 dark:hover:bg-sky-800'
                }`}
              >
                {copiedLetterNumberSql ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin SQL Nomor Surat</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-sky-900 dark:text-sky-200/90 leading-relaxed">
              Jalankan perintah SQL ini agar nomor surat dinas tersimpan permanen di cloud (tabel <code>smp_meetings</code> & <code>smp_invitations</code>):
            </p>
            <div className="rounded-lg bg-sky-950/90 p-2 text-sky-100 font-mono text-[11px] select-all">
              ALTER TABLE smp_meetings ADD COLUMN IF NOT EXISTS letter_number TEXT DEFAULT '-';<br />
              ALTER TABLE smp_invitations ADD COLUMN IF NOT EXISTS letter_number TEXT DEFAULT '-';
            </div>
          </div>

          {/* Migration Card for smp_invitations */}
          <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 dark:bg-teal-950/40 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                <h4 className="text-xs font-bold text-teal-950 dark:text-teal-200 uppercase tracking-wide">
                  Tabel Surat Undangan & Ekspedisi (smp_invitations)
                </h4>
              </div>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(SUPABASE_SQL_INVITATIONS);
                  setCopiedInvitationsSql(true);
                  setTimeout(() => setCopiedInvitationsSql(false), 2500);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  copiedInvitationsSql
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-teal-100 dark:bg-teal-900/60 text-teal-950 dark:text-teal-100 border-teal-300 dark:border-teal-700 hover:bg-teal-200 dark:hover:bg-teal-800'
                }`}
              >
                {copiedInvitationsSql ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin SQL Tabel Undangan</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-teal-900 dark:text-teal-200/90 leading-relaxed">
              Jalankan skrip ini jika ingin mengaktifkan tabel <code>smp_invitations</code> untuk menyimpan status kirim surat dan konfirmasi kehadiran guru (RSVP):
            </p>
            <div className="rounded-lg bg-teal-950/90 p-2 text-teal-100 font-mono text-[11px] select-all overflow-x-auto max-h-24">
              <pre>{SUPABASE_SQL_INVITATIONS}</pre>
            </div>
          </div>

          {/* Migration Card for smp_document_signatures */}
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 dark:bg-indigo-950/40 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wide">
                  Tabel Tanda Tangan & QR Pengesahan (smp_document_signatures)
                </h4>
              </div>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(SUPABASE_SQL_SIGNATURES);
                  setCopiedSignaturesSql(true);
                  setTimeout(() => setCopiedSignaturesSql(false), 2500);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  copiedSignaturesSql
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-950 dark:text-indigo-100 border-indigo-300 dark:border-indigo-700 hover:bg-indigo-200 dark:hover:bg-indigo-800'
                }`}
              >
                {copiedSignaturesSql ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin SQL Tabel Tanda Tangan</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-indigo-900 dark:text-indigo-200/90 leading-relaxed">
              Jalankan skrip ini untuk membuat tabel <code>smp_document_signatures</code> agar persetujuan berjenjang dan QR verifikasi tersimpan langsung di database:
            </p>
            <div className="rounded-lg bg-indigo-950/90 p-2 text-indigo-100 font-mono text-[11px] select-all overflow-x-auto max-h-24">
              <pre>{SUPABASE_SQL_SIGNATURES}</pre>
            </div>
          </div>

          {/* Migration Card for smp_message_templates */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/40 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-200 uppercase tracking-wide">
                  Tabel Template Pesan WhatsApp (smp_message_templates)
                </h4>
              </div>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(SUPABASE_SQL_MESSAGE_TEMPLATES);
                  setCopiedTemplatesSql(true);
                  setTimeout(() => setCopiedTemplatesSql(false), 2500);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  copiedTemplatesSql
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-950 dark:text-emerald-100 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200 dark:hover:bg-emerald-800'
                }`}
              >
                {copiedTemplatesSql ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin SQL Template Pesan</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-emerald-900 dark:text-emerald-200/90 leading-relaxed">
              Jalankan skrip ini agar kustomisasi template pesan WhatsApp (surat undangan, re-chat RSVP, rekap rapat) tersimpan permanen di cloud:
            </p>
            <div className="rounded-lg bg-emerald-950/90 p-2 text-emerald-100 font-mono text-[11px] select-all overflow-x-auto max-h-24">
              <pre>{SUPABASE_SQL_MESSAGE_TEMPLATES}</pre>
            </div>
          </div>

          {/* Migration Card for smp_school_profile (Signer Profiles & WhatsApp) */}
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 dark:bg-sky-950/40 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <h4 className="text-xs font-bold text-sky-950 dark:text-sky-200 uppercase tracking-wide">
                  Kolom Penandatangan & No. WhatsApp (smp_school_profile)
                </h4>
              </div>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(SUPABASE_SQL_SIGNER_PROFILES);
                  setCopiedSignerProfilesSql(true);
                  setTimeout(() => setCopiedSignerProfilesSql(false), 2500);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  copiedSignerProfilesSql
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-sky-100 dark:bg-sky-900/60 text-sky-950 dark:text-sky-100 border-sky-300 dark:border-sky-700 hover:bg-sky-200 dark:hover:bg-sky-800'
                }`}
              >
                {copiedSignerProfilesSql ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin SQL Kolom Penandatangan</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-sky-900 dark:text-sky-200/90 leading-relaxed">
              Jalankan skrip ini untuk menambahkan kolom kontak WA Kepala Sekolah, serta identitas Staf Administrasi (penandatangan buku ekspedisi) di database:
            </p>
            <div className="rounded-lg bg-sky-950/90 p-2 text-sky-100 font-mono text-[11px] select-all overflow-x-auto max-h-24">
              <pre>{SUPABASE_SQL_SIGNER_PROFILES}</pre>
            </div>
          </div>


          {/* SQL Generator Section */}
          <div className="pt-2 border-t border-slate-200 dark:border-[#0f4950]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                  1-Click SQL Schema Lengkap (Tabel smp_*)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-teal-200/70">
                  Salin dan jalankan skrip ini di SQL Editor Supabase untuk membuat/memperbarui tabel.
                </p>
              </div>
              <button
                onClick={handleCopySql}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                  copiedSql
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white dark:bg-[#031e21] text-slate-700 dark:text-teal-200 border-slate-300 dark:border-[#0f4950] hover:bg-slate-50 dark:hover:bg-[#0b383d]'
                }`}
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Tersalin ke Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Skrip SQL</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative max-h-48 overflow-y-auto rounded-lg border border-slate-300 dark:border-[#0f4950] bg-slate-900 dark:bg-[#02181a] p-3 text-slate-200 dark:text-teal-100 font-mono text-[11px] leading-relaxed">
              <pre>{SUPABASE_SQL_SCHEMA}</pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-[#0f4950] bg-slate-50 dark:bg-[#031e21] flex items-center justify-between text-xs text-slate-500 dark:text-teal-300/70">
          <span>Tabel: smp_school_profile, smp_teachers, smp_meetings, smp_attendances</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-[#0b383d] hover:bg-slate-300 dark:hover:bg-[#0f4950] text-slate-700 dark:text-teal-100 font-medium rounded-lg transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
