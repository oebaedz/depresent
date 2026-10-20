import { WahaConfig } from '../types';
import { getSupabase, getSupabaseCredentials } from './supabase';

const STORAGE_KEY_WAHA = 'smp_presensi_waha_config';

export const DEFAULT_WAHA_CONFIG: WahaConfig = {
  edge_function_name: 'waha-notify',
  is_enabled: true,
  auto_notify_on_scan: true,
  message_template_scan: 'Halo Bpk/Ibu *{nama}*, presensi kehadiran kegiatan/rapat *{rapat}* berhasil dicatat pada pukul *{jam} WIB* (Status: *{status}*). Terima kasih.',
  message_template_reminder: 'Pemberitahuan Sekolah:\nRapat/Kegiatan: *{rapat}*\nTanggal: {tanggal} pukul {jam} WIB\nRuang: {ruang}\nPemimpin: {pimpinan}\n\nMohon Bapak/Ibu hadir tepat waktu dan membawa ID Card fisik untuk presensi QR. Terima kasih.',
  message_template_recap: '📋 *REKAPITULASI KEHADIRAN RAPAT*\nAgenda: *{rapat}*\nTanggal: {tanggal} ({waktu} WIB)\nLokasi: {ruang}\n\n• Total Guru: {total} orang\n• Hadir Tepat Waktu: {hadir}\n• Terlambat: {terlambat}\n• Izin / Sakit: {izin}\n• Belum Presensi: {belum}\n\n*Persentase Kehadiran: {persen}%*\n_PresensiQR SMP_',
};

export function getWahaConfig(): WahaConfig {
  if (typeof window === 'undefined') return DEFAULT_WAHA_CONFIG;
  const stored = localStorage.getItem(STORAGE_KEY_WAHA);
  if (!stored) return DEFAULT_WAHA_CONFIG;
  try {
    return { ...DEFAULT_WAHA_CONFIG, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_WAHA_CONFIG;
  }
}

export function saveWahaConfig(config: WahaConfig) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_WAHA, JSON.stringify(config));
  }
}

export interface WahaLog {
  id: string;
  timestamp: string;
  type: 'scan_confirm' | 'reminder' | 'group_recap';
  target: string; // phone number or group ID
  status: 'success' | 'failed' | 'simulated';
  message: string;
  response?: string;
}

const STORAGE_KEY_WAHA_LOGS = 'smp_presensi_waha_logs';

export function getWahaLogs(): WahaLog[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY_WAHA_LOGS);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function addWahaLog(log: Omit<WahaLog, 'id' | 'timestamp'>) {
  if (typeof window === 'undefined') return;
  const logs = getWahaLogs();
  const newLog: WahaLog = {
    ...log,
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
  const updated = [newLog, ...logs].slice(0, 50); // keep last 50 logs
  localStorage.setItem(STORAGE_KEY_WAHA_LOGS, JSON.stringify(updated));
}

export async function invokeWahaNotification(params: {
  action: 'check_in_confirmation' | 'meeting_reminder' | 'group_recap';
  recipient?: string; // phone number or groupId
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; message: string; responseData?: unknown }> {
  const config = getWahaConfig();
  if (!config.is_enabled) {
    return { success: false, message: 'Notifikasi WAHA dinonaktifkan di pengaturan.' };
  }

  const supabase = getSupabase();
  const { url, anonKey } = getSupabaseCredentials();

  // Clean phone number (e.g. 0812... -> 62812...)
  let target = params.recipient || '';
  if (target.startsWith('0')) {
    target = '62' + target.substring(1);
  }
  target = target.replace(/[^0-9@.c_gus]/g, '');

  const payload = {
    action: params.action,
    chatId: target.includes('@') ? target : `${target}@c.us`,
    phone: target,
    message: params.message,
    metadata: params.metadata || {},
    timestamp: new Date().toISOString(),
  };

  if (!supabase || !url) {
    // Simulated delivery for local demo/testing
    console.info('[WAHA Simulator] Edge function payload:', payload);
    addWahaLog({
      type: params.action === 'check_in_confirmation' ? 'scan_confirm' : params.action === 'meeting_reminder' ? 'reminder' : 'group_recap',
      target: target || 'Simulasi',
      status: 'simulated',
      message: params.message,
      response: 'Mode simulasi: Supabase belum terhubung. Pesan siap dikirim saat Edge Function dihubungkan.',
    });
    return {
      success: true,
      message: 'Notifikasi disimulasikan (Supabase belum terhubung). Pesan tercatat di log.',
      responseData: { simulated: true, payload },
    };
  }

  try {
    const functionName = config.edge_function_name.trim() || 'waha-notify';
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: payload,
    });

    if (error) {
      console.warn('Edge function invoke error:', error);
      addWahaLog({
        type: params.action === 'check_in_confirmation' ? 'scan_confirm' : params.action === 'meeting_reminder' ? 'reminder' : 'group_recap',
        target,
        status: 'failed',
        message: params.message,
        response: error.message || 'Error Edge Function',
      });
      return {
        success: false,
        message: `Edge function '${functionName}' merespon dengan error: ${error.message}`,
      };
    }

    addWahaLog({
      type: params.action === 'check_in_confirmation' ? 'scan_confirm' : params.action === 'meeting_reminder' ? 'reminder' : 'group_recap',
      target,
      status: 'success',
      message: params.message,
      response: JSON.stringify(data || 'Terkirim via WAHA'),
    });

    return {
      success: true,
      message: 'Pesan notifikasi WAHA berhasil dikirim melalui Supabase Edge Function!',
      responseData: data,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    addWahaLog({
      type: params.action === 'check_in_confirmation' ? 'scan_confirm' : params.action === 'meeting_reminder' ? 'reminder' : 'group_recap',
      target,
      status: 'failed',
      message: params.message,
      response: errorMsg,
    });
    return {
      success: false,
      message: `Gagal memanggil Edge function: ${errorMsg}`,
    };
  }
}
