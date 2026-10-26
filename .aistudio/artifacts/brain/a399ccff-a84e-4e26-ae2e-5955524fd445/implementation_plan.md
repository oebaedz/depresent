# Fitur Undangan Rapat, Konfirmasi Kehadiran (RSVP) WhatsApp, dan Laporan Ekspedisi Surat Resmi dePresent

Rencana implementasi untuk menambahkan sistem manajemen Undangan Rapat kedinasan dengan tautan konfirmasi kehadiran mandiri (RSVP) yang dikirimkan via WhatsApp ke masing-masing guru, pencatatan otomatis status kehadiran/izin/sakit, serta Buku/Laporan Ekspedisi Surat resmi ber-Kop Surat cetak dan ekspor Excel (.xlsx).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Ringkasan keputusan berdasarkan konfirmasi pengguna:
> - **Alur Konfirmasi Kehadiran (RSVP)**: Mengirimkan pesan WhatsApp personal ke nomor guru dengan tautan unik mandiri (`?rsvp=<meetingId>&t=<teacherId>`). Saat guru membuka tautan di HP mereka, tampil layar konfirmasi resmi dengan pilihan **Akan Hadir**, **Izin (Disertai Alasan)**, atau **Sakit (Disertai Keterangan)**. Panitia juga dapat mencatat atau memperbarui konfirmasi secara manual di dashboard.
> - **Format Laporan Ekspedisi Surat**: Menyediakan 2 format laporan ekspedisi yang lengkap:
>   1. **Format Cetak Resmi**: Menggunakan Kop Surat resmi sekolah lengkap dengan Nomor Surat, Perihal, Tabel Tanda Terima Ekspedisi (Nama, NIP/NIY, Nomor Surat, Waktu Kirim/Terima, Status Konfirmasi, dan Kolom Tanda Tangan Fisik), serta blok pengesahan 3 pihak (Kepala Sekolah, Pimpinan Rapat, Petugas Ekspedisi / Tata Usaha).
>   2. **Ekspor Excel (.xlsx)**: File spreadsheet rapi menggunakan SheetJS dengan metadata rapat, rekapitulasi angka pengiriman, dan baris detail ekspedisi.
> - **Penempatan Menu**: Ditambahkan sebagai menu tersendiri di Sidebar dengan nama **"Surat & Ekspedisi"** (antara Agenda Rapat dan Laporan Resmi).

---

## 1. Overview & Core Concept

- **Apa yang Dibangun**:
  1. **Manajemen Surat Undangan Rapat**: Panitia dapat memilih agenda rapat, mengisi Nomor Surat Dinas (e.g. `421.3/048/SMP.M.1/X/2026`), Perihal, Tanggal Pengiriman, serta memilih target penerima (semua peserta rapat atau dipilih perorangan/kelompok).
  2. **Pengiriman WhatsApp & Tautan RSVP Mandiri**: Mengintegrasikan layanan WAHA untuk mengirimkan pesan undangan WhatsApp personal berisikan agenda, tanggal, jam, tempat, dan tautan mandiri RSVP.
  3. **Layar Konfirmasi Mobile (RSVP Web View)**: Halaman mobile responsif bertema Dark Teal yang bersih dan ramah HP tanpa perlu login rumit. Guru langsung melihat ringkasan agenda, memilih status RSVP (*Akan Hadir*, *Izin*, *Sakit*), memasukkan catatan jika berhalangan, dan menekan konfirmasi dengan umpan balik instan.
  4. **Buku Ekspedisi Surat (Expedition Book)**: Tabel pembukuan ekspedisi surat keluar yang mencatat No, Nomor Surat, Nama Penerima, Jabatan/Kelompok, Tanggal & Jam Pengiriman, Kanal Distribusi (WhatsApp / Fisik), Status RSVP, Waktu Konfirmasi, Catatan, dan Tanda Tangan.
  5. **Cetak Kop Surat & Ekspor Excel**: Cetak siap pakai berstandar kedinasan (`print-color-adjust: exact`, `@media print`) dan tombol ekspor spreadsheet `.xlsx`.

- **Target Pengguna**: Petugas Tata Usaha (TU), Sekretaris/Panitia Rapat, Kepala Sekolah, dan Dewan Guru penerima undangan.

---

## 2. User Experience & Visual Design

### A. Alur Pengguna (User Flows)

1. **Pembuatan & Penyiapan Undangan (Panitia di Dashboard)**:
   - Panitia membuka menu **"Surat & Ekspedisi"** di Sidebar.
   - Memilih agenda rapat dari dropdown agenda yang tersedia.
   - Memasukkan format Nomor Pokok Surat (misal: `421.3/{no}/SMP.M.1/X/2026`) atau nomor surat otomatis berurutan.
   - Sistem menampilkan daftar peserta yang diundang beserta status pengiriman dan status RSVP saat ini.
2. **Pengiriman Undangan (Broadcast / Individual WAHA)**:
   - Panitia menekan tombol *"Kirim Undangan WhatsApp (Semua)"* atau tombol kirim per guru.
   - Sistem menyusun pesan personal dengan format rapi (Nama Guru, Agenda, Hari/Tanggal, Waktu, Lokasi, Pimpinan) serta menyematkan URL konfirmasi:
     `https://app-url/?rsvp=<meetingId>&t=<teacherId>`
   - Status pengiriman surat otomatis berubah menjadi *Terkirim (WA)* dengan tanggal & jam pengiriman tercatat di buku ekspedisi.
3. **Konfirmasi Kehadiran oleh Guru di Smartphone**:
   - Guru mengklik tautan RSVP dari pesan WhatsApp.
   - Aplikasi memuat **Layar Konfirmasi Kehadiran dePresent** yang dioptimalkan untuk layar ponsel:
     - Kartu ringkasan agenda dinas (Judul, Tanggal, Jam, Ruangan, Pimpinan).
     - Identitas penerima surat (Nama, NIP/NIY, Jabatan).
     - 3 Pilihan Status:
       - **Akan Hadir** (Aksen Emerald / Hijau)
       - **Izin Dinas / Keperluan** (Aksen Amber / Kuning) + formulir catatan alasan
       - **Sakit** (Aksen Sky / Biru) + formulir keterangan
     - Tombol konfirmasi dengan status tersimpan seketika.
     - Guru menerima pesan terima kasih dan kartu bukti konfirmasi digital.
4. **Pencetakan Buku Ekspedisi Surat**:
   - Panitia menekan tombol *"Cetak Laporan Ekspedisi"*.
   - Dialog cetak browser terbuka menampilkan format lembar kedinasan:
     - Kop Surat resmi sekolah (Logo, Nama Yayasan, Nama Sekolah, Alamat, NPSN, Kontak).
     - Judul: **BUKU EKSPEDISI DAN TANDA TERIMA SURAT UNDANGAN**.
     - Rincian agenda: Nomor Surat Pokok, Perihal, Hari/Tanggal, Waktu, Tempat.
     - Tabel ekspedisi bergaris tegas: No, Nama Pegawai / Guru, Jabatan, Tanggal Kirim, Media Kirim, Status Konfirmasi Kehadiran, Tanda Tangan / Bukti Terima.
     - Titimangsa dan 3 kolom pengesahan: Kepala Sekolah, Pimpinan Rapat, dan Petugas Ekspedisi / Pengadministrasi Persuratan.
5. **Ekspor File Excel (.xlsx)**:
   - Panitia menekan tombol *"Ekspor Excel (.xlsx)"*.
   - File tersimpan dengan nama rapi: `Buku_Ekspedisi_Undangan_<Nama_Rapat>_<Tanggal>.xlsx`.

### B. Visual Identity & Theme
- Mengikuti palet **Deep Oceanic Teal** (`teal-950`, `teal-900`, `teal-800`, `teal-600`) dengan mode terang (*Light*) dan gelap (*Dark*) yang konsisten.
- Kartu ringkasan metrik ekspedisi menggunakan kartu ringkas bergaris tipis (`border border-teal-800/30`):
  - Total Penerima Undangan
  - Undangan Terkirim via WA
  - Konfirmasi Akan Hadir
  - Konfirmasi Izin / Sakit
  - Belum Konfirmasi
- Layar cetak (@media print) memiliki margin A4 standar, tabel bergaris hitam solid 1px kedinasan, teks 11pt–12pt, dan tanpa elemen tombol antarmuka layar (`no-print`).

---

## 3. Key Product Decisions & Trade-Offs

- **Alur RSVP Mandiri Berbasis URL Query Param (`?rsvp=...`)**:
  - *Keputusan*: Menggunakan query parameter `?rsvp=<meetingId>&t=<teacherId>` yang langsung memicu view mandiri tanpa login password yang membebani guru.
  - *Alasan*: Guru dapat langsung mengonfirmasi dalam 3 detik setelah menerima pesan WhatsApp. ID guru dan ID rapat sudah terverifikasi di parameter URL.
- **Penyimpanan Lokal-Pertama dengan Sinkronisasi Supabase**:
  - *Keputusan*: Model data `Invitation` disimpan di `localStorage` (`smp_invitations_v1`) dan disiapkan untuk tabel Supabase `smp_invitations`.
  - *Alasan*: Memastikan aplikasi bekerja 100% instan secara offline / lokal tanpa jeda jaringan, serta tetap sinkron ketika database Supabase terhubung.
- **Dukungan Konfirmasi Manual oleh Panitia**:
  - *Keputusan*: Selain konfirmasi online dari HP guru, tabel ekspedisi di dashboard admin memiliki tombol cepat untuk menandai status RSVP jika ada guru yang konfirmasi secara lisan/telepon.
  - *Alasan*: Menghindari kebuntuan jika ada guru senior yang kesulitan membuka browser di ponselnya.

---

## 4. Technical Architecture & Data Strategy

### Diagram Arsitektur & Alur Data

```
┌────────────────────────────────────────────────────────────────────────┐
│              Sistem Undangan & Ekspedisi Surat dePresent               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [ Agenda Rapat ] ───> [ Pilih Penerima (Semua / Tertentu) ]           │
│                              │                                         │
│                              ▼                                         │
│                 [ Surat & Ekspedisi View ]                             │
│                  - Input No. Surat & Tanggal Kirim                     │
│                  - Preview Format Pesan WA & Link                      │
│                  - Generate / Sync Data 'Invitation'                   │
│                              │                                         │
│             ┌────────────────┴────────────────┐                        │
│             ▼                                 ▼                        │
│   [ Kirim WhatsApp WAHA ]           [ Input Manual Panitia ]           │
│    Payload: { target, message }      (Ubah status RSVP langsung)       │
│    Link: ?rsvp=meeting&t=teacher              │                        │
│             │                                 │                        │
│             ▼                                 │                        │
│   [ Guru Terima Pesan WA ]                    │                        │
│             │                                 │                        │
│             ▼                                 │                        │
│   [ Layar Konfirmasi Mobile ]                 │                        │
│    - Pilih Hadir / Izin / Sakit               │                        │
│    - Catatan tambahan (opsional)              │                        │
│             │                                 │                        │
│             └────────────────┬────────────────┘                        │
│                              │                                         │
│                              ▼                                         │
│                   [ Buku Ekspedisi Surat ]                             │
│                              │                                         │
│             ┌────────────────┴────────────────┐                        │
│             ▼                                 ▼                        │
│   [ Cetak Kop Surat Resmi ]          [ Ekspor Excel .xlsx ]            │
│   - Format Dinas bergaris            - SheetJS Workbook                │
│   - 3 Kolom Tanda Tangan             - Tabel Data & Rekap              │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Rincian Model Data & State:
1. **Model Data `Invitation` (di `src/types/index.ts`)**:
   ```typescript
   export type RsvpStatus = 'unconfirmed' | 'attending' | 'permission' | 'sick';
   export type DispatchChannel = 'whatsapp' | 'manual' | 'printed';
   export type DispatchStatus = 'pending' | 'sent' | 'failed';

   export interface Invitation {
     id: string;
     meeting_id: string;
     teacher_id: string;
     letter_number: string; // e.g. "421.3/048/SMP.M.1/X/2026"
     dispatch_date: string; // YYYY-MM-DD
     dispatch_channel: DispatchChannel;
     dispatch_status: DispatchStatus;
     sent_at?: string; // ISO string
     rsvp_status: RsvpStatus;
     rsvp_notes?: string;
     rsvp_at?: string; // ISO string
     created_at?: string;
   }
   ```
2. **Helpers Penyimpanan (di `src/lib/storage.ts`)**:
   - `getCachedInvitations()`: Mengambil daftar undangan dari cache `localStorage`.
   - `saveInvitation(invitation)`: Menambah atau memperbarui rekaman ekspedisi undangan.
   - `saveBatchInvitations(invitations)`: Menyimpan sekaligus daftar undangan saat broadcast atau pembuatan nomor surat massal.
   - `submitRsvpConfirmation(meetingId, teacherId, status, notes)`: Fungsi aman untuk mencatat konfirmasi kehadiran guru dari halaman mobile.
3. **Komponen Baru**:
   - `src/components/InvitationsView.tsx`: Halaman utama Surat & Ekspedisi dengan filter rapat, ringkasan KPI ekspedisi, broadcast WAHA, tabel ekspedisi, cetak Kop Surat resmi, dan ekspor XLSX.
   - `src/components/RsvpConfirmationView.tsx`: Tampilan responsif mobile saat URL berparameter `?rsvp=...` diakses guru dari WhatsApp.
4. **Pembaruan Navigasi & Tampilan**:
   - `src/components/Sidebar.tsx`: Menambahkan opsi navigasi `'invitations'` dengan label **"Surat & Ekspedisi"** dan ikon surat dinas (`ScrollText` atau `FileSpreadsheet`).
   - `src/App.tsx`: Menangani deteksi URL query parameter `?rsvp=...`, menghubungkan tab navigasi ke `InvitationsView`, dan menyediakan state undangan yang reaktif.
