import React, { useState } from 'react';
import { X, MessageSquare, Send, Check, AlertCircle, RefreshCw, Smartphone, ListFilter } from 'lucide-react';
import { getWahaConfig, getWahaLogs, invokeWahaNotification, saveWahaConfig, WahaLog } from '../lib/waha';
import { WahaConfig } from '../types';

interface WahaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WahaModal: React.FC<WahaModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<WahaConfig>(getWahaConfig());
  const [logs, setLogs] = useState<WahaLog[]>(getWahaLogs());
  const [testPhone, setTestPhone] = useState('081234567890');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'config' | 'templates' | 'logs'>('config');

  if (!isOpen) return null;

  const handleSave = () => {
    saveWahaConfig(config);
    setTestStatus('Pengaturan notifikasi WAHA berhasil disimpan!');
    setTimeout(() => setTestStatus(null), 2500);
  };

  const handleTestSend = async () => {
    setIsSendingTest(true);
    setTestStatus(null);
    const result = await invokeWahaNotification({
      action: 'check_in_confirmation',
      recipient: testPhone,
      message: `[TEST WAHA SMP] Halo, ini adalah pesan uji coba integrasi notifikasi presensi rapat via Supabase Edge Function (${config.edge_function_name}).`,
    });
    setIsSendingTest(false);
    setLogs(getWahaLogs());
    setTestStatus(result.message);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#072b2f] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-[#0f4950]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#0f4950] flex items-center justify-between bg-teal-950 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Integrasi WhatsApp (WAHA Edge Function)</h3>
              <p className="text-xs text-teal-200/80">Otomatisasi pesan scan kehadiran, reminder rapat, dan rekap grup</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-teal-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center gap-4 px-6 pt-3 border-b border-slate-200 dark:border-[#0f4950] bg-slate-50 dark:bg-[#031e21] text-xs font-medium text-slate-600 dark:text-teal-200">
          <button
            onClick={() => setActiveSubTab('config')}
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'config' ? 'border-teal-500 text-teal-900 dark:text-teal-200 font-bold' : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Konfigurasi & Uji Kirim
          </button>
          <button
            onClick={() => setActiveSubTab('templates')}
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'templates' ? 'border-teal-500 text-teal-900 dark:text-teal-200 font-bold' : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Template Pesan
          </button>
          <button
            onClick={() => {
              setLogs(getWahaLogs());
              setActiveSubTab('logs');
            }}
            className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'logs' ? 'border-teal-500 text-teal-900 dark:text-teal-200 font-bold' : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Log Notifikasi</span>
            <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-[#0b383d] text-slate-700 dark:text-teal-200 rounded-full text-[10px]">{logs.length}</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm flex-1">
          {activeSubTab === 'config' && (
            <div className="space-y-4">
              <div className="p-3 bg-teal-50 dark:bg-[#042024] border border-teal-200 dark:border-[#0f4950] rounded-lg text-xs text-teal-950 dark:text-teal-100">
                <p className="font-semibold text-teal-950 dark:text-white">Mekanisme Kerja WAHA Edge Function:</p>
                <p className="mt-1 text-teal-900 dark:text-teal-200/90">
                  Saat presensi tercatat, aplikasi memanggil endpoint Supabase Edge Function Anda (default: <code>waha-notify</code>), yang kemudian meneruskan instruksi kirim pesan ke server WhatsApp HTTP API (WAHA).
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-teal-100 mb-1">
                    Nama Supabase Edge Function
                  </label>
                  <input
                    type="text"
                    value={config.edge_function_name}
                    onChange={(e) => setConfig({ ...config, edge_function_name: e.target.value })}
                    placeholder="waha-notify"
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-teal-200/70 mt-1">Sesuai nama fungsi di folder <code>supabase/functions/waha-notify</code></p>
                </div>

                <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-[#0f4950] rounded-lg bg-slate-50 dark:bg-[#042024]">
                  <div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white block">Kirim WA Otomatis Saat Scan Guru</span>
                    <span className="text-[11px] text-slate-600 dark:text-teal-200/70 block">Kirim pesan personal instan ke guru yang kartu ID-nya baru saja di-scan</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.auto_notify_on_scan}
                    onChange={(e) => setConfig({ ...config, auto_notify_on_scan: e.target.checked })}
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-[#0f4950] rounded-lg bg-slate-50 dark:bg-[#042024]">
                  <div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white block">Status Fitur WAHA Global</span>
                    <span className="text-[11px] text-slate-600 dark:text-teal-200/70 block">Aktifkan atau nonaktifkan seluruh pengiriman pesan WhatsApp</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.is_enabled}
                    onChange={(e) => setConfig({ ...config, is_enabled: e.target.checked })}
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Test Trigger Area */}
              <div className="pt-3 border-t border-slate-200 dark:border-[#0f4950] space-y-2">
                <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                  Uji Coba Kirim Pesan Langsung
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Smartphone className="w-4 h-4 text-slate-400 dark:text-teal-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="081234567890"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-mono"
                    />
                  </div>
                  <button
                    onClick={handleTestSend}
                    disabled={isSendingTest || !testPhone}
                    className="px-4 py-2 bg-teal-800 hover:bg-teal-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {isSendingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>{isSendingTest ? 'Mengirim...' : 'Kirim Uji Coba'}</span>
                  </button>
                </div>
                {testStatus && (
                  <p className="text-xs text-slate-700 dark:text-teal-100 bg-slate-100 dark:bg-[#031e21] p-2 rounded border border-slate-200 dark:border-[#0f4950]">
                    {testStatus}
                  </p>
                )}
              </div>
            </div>
          )}

          {activeSubTab === 'templates' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-teal-100 mb-1">
                  1. Template Konfirmasi Saat Scan Guru
                </label>
                <textarea
                  rows={3}
                  value={config.message_template_scan}
                  onChange={(e) => setConfig({ ...config, message_template_scan: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-mono"
                />
                <p className="text-[11px] text-slate-500 dark:text-teal-200/70 mt-0.5">Placeholder tersedia: <code>{'{nama}'}</code>, <code>{'{rapat}'}</code>, <code>{'{jam}'}</code>, <code>{'{status}'}</code></p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-teal-100 mb-1">
                  2. Template Pengingat Rapat (Reminder)
                </label>
                <textarea
                  rows={4}
                  value={config.message_template_reminder}
                  onChange={(e) => setConfig({ ...config, message_template_reminder: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-mono"
                />
                <p className="text-[11px] text-slate-500 dark:text-teal-200/70 mt-0.5">Placeholder: <code>{'{rapat}'}</code>, <code>{'{tanggal}'}</code>, <code>{'{jam}'}</code>, <code>{'{ruang}'}</code>, <code>{'{pimpinan}'}</code></p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-teal-100 mb-1">
                  3. Template Rekapitulasi ke Grup WA
                </label>
                <textarea
                  rows={5}
                  value={config.message_template_recap}
                  onChange={(e) => setConfig({ ...config, message_template_recap: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-[#0f4950] rounded-lg bg-white dark:bg-[#031e21] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-mono"
                />
                <p className="text-[11px] text-slate-500 dark:text-teal-200/70 mt-0.5">Placeholder: <code>{'{rapat}'}</code>, <code>{'{total}'}</code>, <code>{'{hadir}'}</code>, <code>{'{terlambat}'}</code>, <code>{'{izin}'}</code>, <code>{'{belum}'}</code>, <code>{'{persen}'}</code></p>
              </div>
            </div>
          )}

          {activeSubTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-teal-100">Aktivitas Terakhir Pengiriman Pesan WAHA</span>
                <button
                  onClick={() => setLogs(getWahaLogs())}
                  className="text-xs text-slate-500 dark:text-teal-300 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Segarkan</span>
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-teal-300/70 text-xs">
                  Belum ada catatan pengiriman pesan.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {logs.map((log) => (
                    <div key={log.id} className="p-2.5 bg-slate-50 dark:bg-[#042024] border border-slate-200 dark:border-[#0f4950] rounded-lg text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-slate-500 dark:text-teal-400 text-[11px]">{log.timestamp}</span>
                        <span
                          className={`font-semibold text-[10px] uppercase ${
                            log.status === 'success'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : log.status === 'simulated'
                              ? 'text-teal-700 dark:text-teal-300'
                              : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                      <p className="text-slate-800 dark:text-white font-medium">Tujuan: {log.target} ({log.type})</p>
                      <p className="text-slate-600 dark:text-teal-100/80 line-clamp-2 text-[11px]">{log.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-[#0f4950] bg-slate-50 dark:bg-[#031e21] flex items-center justify-between">
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-700 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Simpan Pengaturan WAHA</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-[#0b383d] hover:bg-slate-300 dark:hover:bg-[#0f4950] text-slate-700 dark:text-teal-100 text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
