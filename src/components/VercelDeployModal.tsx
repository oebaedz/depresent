import React, { useState } from 'react';
import { X, Rocket, ExternalLink, GitBranch, Check, Copy, Shield, Globe, Terminal } from 'lucide-react';
import { getSupabaseCredentials } from '../lib/supabase';

interface VercelDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VercelDeployModal: React.FC<VercelDeployModalProps> = ({ isOpen, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { url, anonKey } = getSupabaseCredentials();

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const gitCommands = `# 1. Inisialisasi git di folder proyek Anda
git init
git add .
git commit -m "feat: PresensiQR SMP dengan Supabase & WAHA"

# 2. Buat repository baru di GitHub (github.com/new), lalu sambungkan:
git branch -M main
git remote add origin https://github.com/USERNAME/presensi-smp.git
git push -u origin main`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center">
              <Rocket className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Panduan Deploy ke Vercel via GitHub</h3>
              <p className="text-xs text-slate-300">Hosting web presensi sekolah Anda secara mandiri & cepat</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Status vercel.json */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5">
            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900">
              <p className="font-semibold">Konfigurasi vercel.json Telah Siap</p>
              <p className="text-emerald-800">
                File <code>vercel.json</code> dengan aturan Single-Page App (SPA) rewrite sudah tersedia di root proyek untuk mencegah error 404 saat halaman di-refresh.
              </p>
            </div>
          </div>

          {/* Step 1: Push to GitHub */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-blue-600" />
                <span>Langkah 1: Push Kode ke GitHub</span>
              </h4>
              <button
                onClick={() => handleCopy(gitCommands, 'git')}
                className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded hover:bg-slate-50 flex items-center gap-1"
              >
                {copiedKey === 'git' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'git' ? 'Tersalin' : 'Salin Perintah'}</span>
              </button>
            </div>
            <div className="bg-slate-900 text-slate-200 font-mono text-[11px] p-3 rounded-lg overflow-x-auto leading-relaxed border border-slate-700">
              <pre>{gitCommands}</pre>
            </div>
          </div>

          {/* Step 2: Import in Vercel */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              <span>Langkah 2: Hubungkan Repositori di Vercel</span>
            </h4>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-1.5">
              <p>1. Buka <strong>vercel.com</strong> dan login dengan akun GitHub Anda.</p>
              <p>2. Klik tombol <strong>Add New... &rarr; Project</strong>.</p>
              <p>3. Pilih repositori GitHub Anda lalu klik <strong>Import</strong>.</p>
              <p>4. Framework Preset akan otomatis terdeteksi sebagai <strong>Vite</strong>.</p>
            </div>
          </div>

          {/* Step 3: Environment Variables */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span>Langkah 3: Atur Environment Variables di Vercel</span>
            </h4>
            <p className="text-xs text-slate-700">
              Di bagian <strong>Environment Variables</strong> dashboard Vercel, tambahkan 2 variabel berikut:
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div>
                  <span className="font-mono font-semibold text-slate-900">VITE_SUPABASE_URL</span>
                  <p className="text-[11px] text-slate-700 truncate max-w-sm">{url || 'https://xxxx.supabase.co'}</p>
                </div>
                <button
                  onClick={() => handleCopy(url, 'env_url')}
                  className="px-2 py-1 border border-slate-300 rounded text-[11px] font-medium hover:bg-white flex items-center gap-1"
                >
                  {copiedKey === 'env_url' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>Salin Nilai</span>
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div>
                  <span className="font-mono font-semibold text-slate-900">VITE_SUPABASE_ANON_KEY</span>
                  <p className="text-[11px] text-slate-700 truncate max-w-sm">{anonKey ? `${anonKey.substring(0, 30)}...` : 'eyJhbGci...'}</p>
                </div>
                <button
                  onClick={() => handleCopy(anonKey, 'env_key')}
                  className="px-2 py-1 border border-slate-300 rounded text-[11px] font-medium hover:bg-white flex items-center gap-1"
                >
                  {copiedKey === 'env_key' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>Salin Nilai</span>
                </button>
              </div>
            </div>
          </div>

          {/* Step 4: Custom Domain */}
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2.5">
            <Globe className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Menghubungkan Domain Resmi Sekolah (sch.id)</p>
              <p className="text-blue-800">
                Setelah deploy selesai, masuk ke <strong>Project Settings &rarr; Domains</strong> di Vercel, lalu tambahkan subdomain sekolah Anda (misal: <code>presensi.smpn1harapanbangsa.sch.id</code>). Vercel akan otomatis menyediakan sertifikat SSL HTTPS gratis!
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <a
            href="https://vercel.com/new"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm"
          >
            <span>Buka Vercel Deploy</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded-lg transition-colors"
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
};
