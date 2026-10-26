import { WahaConfig } from '../types';
import { getSupabase, getSupabaseCredentials } from './supabase';

const STORAGE_KEY_WAHA = 'smp_presensi_waha_config';

export const DEFAULT_WAHA_CONFIG: WahaConfig = {
  edge_function_name: 'waha-notify',
  is_enabled: true,
  auto_notify_on_scan: true,
  message_template_scan: 'Halo Bpk/Ibu *{nama}*, presensi kehadiran kegiatan/rapat *{rapat}* berhasil dicatat pada pukul *{jam} WIB* (Status: *{status}*). Terima kasih.',
  message_template_reminder: 'Pemberitahuan Sekolah:\nRapat/Kegiatan: *{rapat}*\nTanggal: {tanggal} pukul {jam} WIB\nRuang: {ruang}\nPemimpin: {pimpinan}\n\nMohon Bapak/Ibu hadir tepat waktu dan membawa ID Card fisik untuk presensi QR. Terima kasih.',
  message_template_recap: '📋 *REKAPITULASI KEHADIRAN RAPAT*\nAgenda: *{rapat}*\nTanggal: {tanggal} ({waktu} WIB)\nLokasi: {ruang}\n\n• Total Guru: {total} orang\n• Hadir Tepat Waktu: {hadir}\n• Terlambat: {terlambat}\n• Izin / Sakit: {izin}\n• Belum Presensi: {belum}\n\n*Persentase Kehadiran: {persen}%*\n_dePresent SMP_',
};

export const EDGE_FUNCTION_TEMPLATE_CODE = `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

// ===============================
// NORMALIZE WHATSAPP TARGET
// ===============================
function normalizeTarget(target: string): string {
  let value = String(target).trim()

  // Kalau sudah berupa chatId WAHA, jangan diubah.
  if (
    value.endsWith("@c.us") ||
    value.endsWith("@g.us") ||
    value.endsWith("@lid") ||
    value.endsWith("@newsletter")
  ) {
    return value
  }

  // Hilangkan karakter selain angka dan +
  value = value.replace(/[^\\d+]/g, "")

  // +628123456789 → 628123456789
  if (value.startsWith("+")) {
    value = value.substring(1)
  }

  // 08123456789 → 628123456789
  if (value.startsWith("08")) {
    value = "62" + value.substring(1)
  }

  // 8123456789 → 628123456789
  if (value.startsWith("8")) {
    value = "62" + value
  }

  return \`\${value}@c.us\`
}

serve(async (req) => {
  // CORS PREFLIGHT
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // AMBIL DATA: target dan message wajib diisi
    const { target, message } = await req.json()

    if (!target || !message) {
      return new Response(
        JSON.stringify({
          error: "target dan message wajib diisi",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      )
    }

    // ENVIRONMENT VARIABLES
    const WAHA_URL = Deno.env.get("WAHA_URL")
    const WAHA_API_KEY = Deno.env.get("WAHA_API_KEY")
    const WAHA_SESSION = Deno.env.get("WAHA_SESSION") || "default"

    if (!WAHA_URL || !WAHA_API_KEY) {
      throw new Error("WAHA_URL atau WAHA_API_KEY belum diset")
    }

    // NORMALIZE TARGET
    const chatId = normalizeTarget(target)

    // REQUEST KE WAHA (/api/sendText)
    const response = await fetch(\`\${WAHA_URL}/api/sendText\`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": WAHA_API_KEY,
      },
      body: JSON.stringify({
        session: WAHA_SESSION,
        chatId: chatId,
        text: message,
      }),
    })

    const result = await response.json()

    return new Response(
      JSON.stringify({
        success: response.ok,
        target: chatId,
        waha: result,
      }),
      {
        status: response.status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    )
  }
})
`;

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
  type: 'scan_confirm' | 'reminder' | 'group_recap' | 'invitation';
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

/**
 * Mengirim pesan notifikasi WhatsApp melalui Supabase Edge Function WAHA
 * Payload strictly matches: { target, message }
 */
export async function invokeWahaNotification(params: {
  action: 'check_in_confirmation' | 'meeting_reminder' | 'group_recap' | 'invitation_dispatch';
  recipient?: string; // target WhatsApp number or group chatId
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; message: string; responseData?: unknown }> {
  const config = getWahaConfig();
  if (!config.is_enabled) {
    return { success: false, message: 'Notifikasi WhatsApp dinonaktifkan di pengaturan WAHA.' };
  }

  const rawTarget = String(params.recipient || '').trim();
  const rawMessage = String(params.message || '').trim();

  const logType =
    params.action === 'check_in_confirmation'
      ? 'scan_confirm'
      : params.action === 'meeting_reminder'
      ? 'reminder'
      : params.action === 'invitation_dispatch'
      ? 'invitation'
      : 'group_recap';

  // 1. Strict validation matching Edge Function requirements: { target, message }
  if (!rawTarget) {
    const errorMsg = 'Nomor tujuan WhatsApp (target) belum diisi.';
    addWahaLog({
      type: logType,
      target: '(Kosong)',
      status: 'failed',
      message: rawMessage || '(Pesan kosong)',
      response: 'Error validasi: target wajib diisi',
    });
    return { success: false, message: errorMsg };
  }

  if (!rawMessage) {
    const errorMsg = 'Pesan WhatsApp (message) belum diisi.';
    addWahaLog({
      type: logType,
      target: rawTarget,
      status: 'failed',
      message: '(Pesan kosong)',
      response: 'Error validasi: message wajib diisi',
    });
    return { success: false, message: errorMsg };
  }

  // 2. Build payload strictly providing { target, message } with compatibility aliases
  const payload = {
    target: rawTarget,
    message: rawMessage,
    // Complementary aliases
    chatId: rawTarget,
    phone: rawTarget,
    action: params.action,
    metadata: params.metadata || {},
    timestamp: new Date().toISOString(),
  };

  const supabase = getSupabase();
  const { url, anonKey } = getSupabaseCredentials();

  // 3. Simulated fallback if Supabase is not connected
  if (!supabase || !url) {
    console.info('[WAHA Simulator] Edge function payload:', payload);
    addWahaLog({
      type: logType,
      target: rawTarget,
      status: 'simulated',
      message: rawMessage,
      response: 'Mode simulasi: Supabase belum terhubung. Pesan siap dikirim saat kredensial Supabase dihubungkan.',
    });
    return {
      success: true,
      message: 'Notifikasi disimulasikan (Supabase belum terhubung). Log tercatat.',
      responseData: { simulated: true, payload },
    };
  }

  // 4. Send request to Supabase Edge Function
  const functionName = config.edge_function_name.trim() || 'waha-notify';

  try {
    let data: any = null;
    let invokeError: any = null;

    try {
      const res = await supabase.functions.invoke(functionName, {
        body: payload,
      });
      data = res.data;
      invokeError = res.error;
    } catch (invErr) {
      invokeError = invErr;
    }

    // Handle invocation error
    if (invokeError) {
      let detailMsg = invokeError.message || 'Error memanggil Edge Function';
      try {
        if ('context' in invokeError && (invokeError as any).context) {
          const resBody = await (invokeError as any).context.json();
          if (resBody?.error) {
            detailMsg = resBody.error;
          } else if (resBody?.message) {
            detailMsg = resBody.message;
          }
        }
      } catch {
        // ignore json parse error on context
      }

      // Try direct HTTP fetch fallback to edge function endpoint
      if (url && anonKey) {
        try {
          const directEndpoint = `${url.replace(/\/$/, '')}/functions/v1/${functionName}`;
          const directFetch = await fetch(directEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${anonKey}`,
              apikey: anonKey,
            },
            body: JSON.stringify(payload),
          });

          const directJson = await directFetch.json().catch(() => null);

          if (directFetch.ok && directJson && directJson.success !== false && !directJson.error) {
            addWahaLog({
              type: logType,
              target: directJson.target || rawTarget,
              status: 'success',
              message: rawMessage,
              response: typeof directJson.waha === 'object' ? JSON.stringify(directJson.waha) : JSON.stringify(directJson),
            });
            return {
              success: true,
              message: `Pesan WhatsApp berhasil dikirim ke ${directJson.target || rawTarget}!`,
              responseData: directJson,
            };
          } else if (directJson && (directJson.error || directJson.success === false)) {
            const errReason = directJson.error || directJson.waha?.message || detailMsg;
            addWahaLog({
              type: logType,
              target: rawTarget,
              status: 'failed',
              message: rawMessage,
              response: `Error: ${errReason}`,
            });
            return {
              success: false,
              message: `Gagal mengirim WhatsApp: ${errReason}`,
              responseData: directJson,
            };
          }
        } catch {
          // direct fetch also failed
        }
      }

      addWahaLog({
        type: logType,
        target: rawTarget,
        status: 'failed',
        message: rawMessage,
        response: `Error Edge Function: ${detailMsg}`,
      });

      return {
        success: false,
        message: `Edge function '${functionName}' gagal: ${detailMsg}`,
      };
    }

    // Inspect returned data from Edge Function
    if (data) {
      // 1. Edge function returned error: e.g. "target dan message wajib diisi" or "WAHA_URL atau WAHA_API_KEY belum diset"
      if (data.error) {
        addWahaLog({
          type: logType,
          target: rawTarget,
          status: 'failed',
          message: rawMessage,
          response: `Error: ${data.error}`,
        });
        return {
          success: false,
          message: `Gagal mengirim WhatsApp: ${data.error}`,
          responseData: data,
        };
      }

      // 2. Edge function returned { success: false, ... }
      if (data.success === false) {
        let wahaErrorMsg = 'WAHA mengembalikan status gagal';
        if (data.waha) {
          if (typeof data.waha === 'string') {
            wahaErrorMsg = data.waha;
          } else if (typeof data.waha === 'object') {
            wahaErrorMsg = data.waha.message || data.waha.error || JSON.stringify(data.waha);
          }
        } else if (data.error) {
          wahaErrorMsg = data.error;
        }

        addWahaLog({
          type: logType,
          target: data.target || rawTarget,
          status: 'failed',
          message: rawMessage,
          response: `WAHA Error: ${wahaErrorMsg}`,
        });
        return {
          success: false,
          message: `Pengiriman WAHA gagal: ${wahaErrorMsg}`,
          responseData: data,
        };
      }

      // 3. Success response from Edge Function
      addWahaLog({
        type: logType,
        target: data.target || rawTarget,
        status: 'success',
        message: rawMessage,
        response: typeof data.waha === 'object' ? JSON.stringify(data.waha) : JSON.stringify(data || 'Terkirim ke WAHA'),
      });

      return {
        success: true,
        message: `Pesan WhatsApp berhasil dikirim ke ${data.target || rawTarget}!`,
        responseData: data,
      };
    }

    addWahaLog({
      type: logType,
      target: rawTarget,
      status: 'failed',
      message: rawMessage,
      response: 'Tidak ada data respon dari Edge Function.',
    });
    return {
      success: false,
      message: 'Tidak ada data respon dari Edge Function.',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    addWahaLog({
      type: logType,
      target: rawTarget,
      status: 'failed',
      message: rawMessage,
      response: `Exception: ${errorMsg}`,
    });
    return {
      success: false,
      message: `Gagal memanggil Edge function: ${errorMsg}`,
    };
  }
}
