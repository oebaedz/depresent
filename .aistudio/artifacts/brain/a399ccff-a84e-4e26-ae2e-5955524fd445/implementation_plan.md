# Rencana Implementasi: Tanda Tangan Digital Berjenjang & Pengesahan Dokumen via WhatsApp

Berdasarkan arahan terbaru Anda:
1. **Penempatan Stempel vs QR Code**:
   - **Kepala Sekolah (Pengesahan Institusi)**: Memperoleh **Stempel Digital Resmi Kedinasan Sekolah** + **QR Code Verifikasi**.
   - **Pimpinan Rapat & Notulis Rapat** (serta Petugas TU): Cukup **QR Code Verifikasi Otentisitas** (tanpa stempel instansi, sesuai kaidah tata naskah dinas resmi).
2. **Database Supabase Diutamakan**: Semua status dan riwayat TTD tersimpan langsung ke PostgreSQL Supabase (`document_signatures`), dengan `localStorage` hanya sebagai cadangan luring.
3. **Alur Persetujuan Berjenjang (Sequential)**:
   - **Tahap 1**: Notulis Rapat tanda tangan (QR Code) untuk validasi notula & kehadiran.
   - **Tahap 2**: Pimpinan Rapat tanda tangan (QR Code) setelah Notulis selesai.
   - **Tahap 3**: Kepala Sekolah tanda tangan pengesahan final (**Stempel Resmi Sekolah + QR Code**) setelah Pimpinan Rapat selesai.
4. **Halaman Persetujuan Transparan**: Menampilkan rincian daftar nama guru/pegawai yang **Tidak Hadir** sebelum pejabat menekan tombol persetujuan.

---

## 1. Skema Database Supabase (`document_signatures`)

### SQL Tabel:
```sql
CREATE TABLE IF NOT EXISTS document_signatures (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- 'attendance_report' | 'expedition_book'
  signer_role TEXT NOT NULL,   -- 'secretary' (Tahap 1) | 'leader' (Tahap 2) | 'headmaster' (Tahap 3) | 'expedition_officer'
  step_order INTEGER NOT NULL, -- 1 = Notulis, 2 = Pimpinan, 3 = Kepala Sekolah
  signer_name TEXT NOT NULL,
  signer_niy TEXT,
  signer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'signed' | 'rejected'
  signed_at TIMESTAMPTZ,
  verification_code TEXT,      -- Kode verifikasi unik (contoh: DEP-2026-X8F9A)
  rejection_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signatures_meeting ON document_signatures(meeting_id);
```

### TypeScript Data Model (`src/types/index.ts`):
```typescript
export type DocumentType = 'attendance_report' | 'expedition_book';
export type SignerRole = 'secretary' | 'leader' | 'headmaster' | 'expedition_officer';
export type SignatureStatus = 'pending' | 'signed' | 'rejected';

export interface DocumentSignature {
  id: string;
  meeting_id: string;
  document_type: DocumentType;
  signer_role: SignerRole;
  step_order: number;
  signer_name: string;
  signer_niy: string;
  signer_phone?: string;
  status: SignatureStatus;
  signed_at?: string; // Format ISO string, tampilan dengan detik HH:mm:ss
  verification_code?: string;
  rejection_notes?: string;
  created_at: string;
}
```

---

## 2. Penyimpanan & Sinkronisasi (`src/lib/storage.ts`)

- `fetchDocumentSignatures(meetingId: string)`: Membaca langsung dari tabel Supabase `document_signatures` secara realtime.
- `saveDocumentSignature(sig: DocumentSignature)`: Melakukan upsert langsung ke database Supabase.
- Otomatis membuat 3 slot penandatangan terurut saat inisialisasi:
  1. **Notulis Rapat** (`step_order: 1`, `signer_role: 'secretary'`)
  2. **Pimpinan Rapat** (`step_order: 2`, `signer_role: 'leader'`)
  3. **Kepala Sekolah** (`step_order: 3`, `signer_role: 'headmaster'`)

---

## 3. Alur Berjenjang (Sequential) & Estafet WhatsApp

1. **Notulis Rapat (Tahap 1)**: Menerima WhatsApp pertama kali saat panitia memulai alur pengesahan atau rapat selesai.
2. **Pimpinan Rapat (Tahap 2)**: 
   - Notifikasi WhatsApp otomatis terkirim begitu Notulis klik Setujui.
   - Jika Pimpinan membuka tautan sebelum Notulis selesai, sistem menampilkan banner: *"Menunggu pengesahan Notulis Rapat terlebih dahulu"*.
3. **Kepala Sekolah (Tahap 3 - Final)**:
   - Notifikasi WhatsApp pengesahan akhir otomatis terkirim begitu Pimpinan Rapat klik Setujui.
   - Begitu Kepala Sekolah menyetujui, berkas dinyatakan **Sah & Lengkap**.

---

## 4. Halaman Persetujuan Mandiri (`src/components/SignatureApprovalView.tsx`)

Parameter URL: `?sign=<meetingId>&doc=<attendance_report|expedition_book>&role=<role>`
- **Stepper 3 Tahap**: Menampilkan posisi alur saat ini.
- **Ringkasan Agenda Rapat**: Nama rapat, tanggal, jam, ruangan, dan persentase kehadiran.
- **Tabel Daftar Guru TIDAK HADIR**: Menampilkan nama guru, NIY, mapel/jabatan, dan alasan tidak hadir agar pimpinan & kepala sekolah melihat rincian riil sebelum menandatangani.
- **Tombol Pengesahan**: Sekali klik untuk menerbitkan tanda tangan elektronik resmi beserta kode otentikasi.

---

## 5. Visualisasi Hasil Kolom TTD pada Dokumen Cetak SPJ & Ekspedisi

### Aturan Visual:
| Pejabat | Elemen Tanda Tangan Digital |
| :--- | :--- |
| **Notulis Rapat** (Tahap 1) | **QR Code Verifikasi** (60x60px) + Kode Otentikasi + Waktu Pengesahan (dengan detik) |
| **Pimpinan Rapat** (Tahap 2) | **QR Code Verifikasi** (60x60px) + Kode Otentikasi + Waktu Pengesahan (dengan detik) |
| **Kepala Sekolah** (Tahap 3) | **Stempel Kedinasan Biru Resmi Sekolah** + **QR Code Verifikasi** + Waktu Pengesahan (dengan detik) |

### Contoh Tata Letak Kolom Tanda Tangan:

```
+---------------------------+  +---------------------------+  +---------------------------+
|      NOTULIS RAPAT,       |  |      PIMPINAN RAPAT,      |  |        MENGETAHUI,        |
|                           |  |                           |  |      KEPALA SEKOLAH,      |
|                           |  |                           |  |                           |
|       [ QR CODE ]         |  |       [ QR CODE ]         |  |   [ STEMPEL ] [ QR CODE ] |
|      +-----------+        |  |      +-----------+        |  |   +---------+ +---------+ |
|      | █▀▀▀█ ▄ █ |        |  |      | █▀▀▀█ ▄ █ |        |  |  /  SMP MUH \ | █▀▀▀█ █ | |
|      | ▀▀▀▀▀ ▀ ▀ |        |  |      | ▀▀▀▀▀ ▀ ▀ |        |  | |  TERSAH- | | ▀▀▀▀▀ ▀ | |
|      +-----------+        |  |      +-----------+        |  |  \   IKAN  / +---------+ |
|      DEP-SEC-4A12B        |  |      DEP-LDR-7C89F        |  |   +-------+ DEP-HDS-9E21D |
|                           |  |                           |  |                           |
|      NAMA NOTULIS         |  |    NAMA PIMPINAN RAPAT    |  |     NAMA KEPALA SEKOLAH   |
|   NIY. 19850314...        |  |    NIY. 19780211...       |  |     NIY. 19740512...      |
|  [TTD Elektronik Sah]     |  |   [TTD Elektronik Sah]    |  |  [Tersertifikasi Resmi]   |
+---------------------------+  +---------------------------+  +---------------------------+
```

---

## 6. Langkah-Langkah Pengerjaan
1. **Model Data**: Definisikan `DocumentSignature` dan enum terkait di `src/types/index.ts`.
2. **Database Supabase**: Implementasikan fungsi baca/tulis langsung ke Supabase `document_signatures` di `src/lib/storage.ts`.
3. **Komponen Visual TTD (`DigitalSignatureBadge.tsx`)**: Menampilkan QR Code (semua pejabat) dan Stempel Kedinasan Biru (khusus Kepala Sekolah).
4. **Halaman Publik Persetujuan (`SignatureApprovalView.tsx`)**: Lengkap dengan stepper urutan penandatanganan dan tabel pegawai yang tidak hadir.
5. **Panel Kontrol di Laporan & Ekspedisi**: Bilah kontrol pengiriman tautan WhatsApp WAHA dan pemantauan status TTD real-time.
6. **Routing & Integrasi Cetak**: Menghubungkan parameter URL `?sign=...` di `src/App.tsx` dan memasang stempel/QR di `ReportsView.tsx` dan `InvitationsView.tsx`.
7. **Pengujian**: Verifikasi alur berjenjang dan kompilasi build `compile_applet`.
