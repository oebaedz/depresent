# Peningkatan Presensi dePresent: QR Expiry Guard, Pemilihan Peserta Rapat, Tema Dark Teal & Dark Mode, serta Perbaikan Cetak ID Card

Rencana implementasi untuk menyempurnakan alur presensi mobile (validasi kedaluwarsa QR dinamis), fleksibilitas pemilihan guru peserta rapat kedinasan, pembaruan estetika modern dengan palet Dark Teal dan Dark Mode toggle, serta perbaikan cetak ID Card portrait guru.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Ringkasan keputusan berdasarkan konfirmasi pengguna:
> - **Perilaku QR Expired di HP**: Menampilkan peringatan kadaluarsa yang jelas, menonaktifkan pemilihan nama dan tombol simpan presensi, serta menginstruksikan guru untuk mengarahkan kamera ke layar proyektor rapat yang menampilkan QR bergulir terbaru (toleransi 60 detik).
> - **Pemilihan Peserta Rapat**: Agenda rapat mendukung opsi **Semua Guru** (default) atau **Pilih Guru Tertentu** dengan fitur *quick-filter* berdasarkan kelompok jabatan/mapel serta centang daftar guru manual. Perhitungan kehadiran (dashboard, laporan resmi SPJ, dan auto-alpa) hanya menghitung guru yang diundang.
> - **Tema Dark Teal & Dark Mode**: Menerapkan palet warna *Deep Teal* (`teal-950`, `teal-900`, `teal-800`, `teal-600`, aksen `emerald-500` & `amber-500`) dengan toggle *Light / Dark Mode* yang tersimpan di `localStorage` dan tersinkronisasi di seluruh komponen.
> - **Perbaikan Cetak ID Card**: Mengatasi masalah pemotongan overflow pada modal cetak, menambahkan kelas CSS cetak khusus (`print-color-adjust: exact`, `break-inside-avoid`, grid A4 3 kolom), dan memastikan QR ptk_id ter-render tajam tanpa terpotong.

---

## 1. Overview & Core Concept

- **Apa yang Dibangun**:
  1. **QR Expiry Guard**: Di halaman presensi mobile (`MobileCheckinView`), jika token QR proyektor telah kedaluwarsa (>60 detik), sistem secara tegas menonaktifkan formulir presensi dan tombol kirim, menampilkan banner instruksi pindai ulang.
  2. **Selective Meeting Attendees**: Di `MeetingsView`, admin rapat dapat menentukan apakah suatu agenda berlaku untuk seluruh dewan guru atau kelompok peserta spesifik (misalnya rapat MGMP guru mapel, rapat wali kelas, atau rapat pimpinan).
  3. **Dark Teal Palette & Dark Mode**: Transformasi gaya visual aplikasi ke *Deep Oceanic Teal*, menggantikan nuansa biru standar dengan palet teal yang teduh dan elegan, dilengkapi tombol pengalih tema terang/gelap pada bilah navigasi atas.
  4. **ID Card Printing Engine Fix**: Perbaikan tata letak cetak ID Card Portrait (54 x 85.6 mm) agar dapat dicetak ke kertas A4 (9 kartu per lembar) atau disimpan ke PDF dengan warna latar utuh dan tanpa terpotong batas modal.

- **Target Pengguna**: Pimpinan yayasan, kepala sekolah, notulis/panitia rapat, dan guru peserta kegiatan.

---

## 2. User Experience & Visual Design

### A. Alur Pengguna (User Flows)
1. **Guru Memindai QR Proyektor (Mobile Check-in)**:
   - Guru memindai QR dinamis di layar proyektor.
   - Jika QR masih aktif: nama guru yang diundang ke rapat tersebut muncul, guru memilih namanya dan menekan "Konfirmasi Kehadiran Saya". HP terkunci untuk 1 guru (Anti-Titip Absen).
   - Jika QR kedaluwarsa: muncul banner peringatan kuning-oranye tegas, tombol konfirmasi dinonaktifkan dengan label *"Kode QR Kedaluwarsa — Pindai Ulang di Layar"*, dan guru tidak dapat memilih atau mengirimkan presensi.
2. **Pembuatan / Pengeditan Agenda Rapat**:
   - Panitia memilih kategori, tanggal, waktu, pimpinan rapat, dan notulis.
   - Di bagian **Target Peserta Rapat**, terdapat pilihan:
     - `Semua Guru & Pegawai` (default)
     - `Pilih Guru Tertentu` (menampilkan ringkasan jumlah guru terpilih, tombol *Pilih Semua*, *Hapus Pilihan*, filter cepat per Jabatan, dan daftar checklist pencarian guru).
3. **Penyelarasan Presensi & Laporan**:
   - Dashboard KPI, layar proyektor, pengingat WhatsApp WAHA, dan Laporan Resmi SPJ secara otomatis menyesuaikan total peserta hanya dengan menghitung guru yang terdaftar dalam agenda tersebut.
4. **Cetak ID Card Portrait**:
   - Di menu Data Guru, panitia menekan "Cetak ID Card Portrait" (semua atau perorangan).
   - Jendela pratinjau cetak terbuka dengan opsi ukuran cetak A4 teroptimasi. Ketika tombol "Cetak / Simpan PDF" ditekan, browser membuka dialog cetak yang bersih: tanpa sidebar, tanpa latar overlay abu-abu, warna latar dan logo tetap tercetak tajam (`print-color-adjust: exact`).
5. **Dark Mode Toggle**:
   - Ikon Sun / Moon yang elegan di header atas memungkinkan pengalihan tema instan antara mode terang beraksen deep teal dan mode gelap teal pekat.

### B. Palet Warna & Tipografi
- **Mode Terang (Light Mode)**:
  - Background Canvas: Slate 50 (`#F8FAFC`)
  - Primary Brand: Deep Teal (`#0F766E` / `teal-700` & `#115E59` / `teal-800`)
  - Headers / Sidebar: Dark Teal Slate (`#042F2E` / `teal-950`)
  - Accent / Status: Emerald (`#10B981`), Amber (`#D97706`), Rose (`#E11D48`)
- **Mode Gelap (Dark Mode)**:
  - Background Canvas: Dark Neutral / Deep Teal (`#021B1A` / `#0F172A`)
  - Surface Containers: Dark Teal Slate (`#082F2D` / `#134E4A`) dengan garis batas halus (`border-teal-800/40`)
  - Typography: Crisp white (`#F8FAFC`) untuk judul, soft teal/slate (`#94A3B8` / `#5EEAD4`) untuk teks sekunder
  - Focus Ring: Teal 500 (`#14B8A6`)
- **Tipografi**: Display font `Plus Jakarta Sans`, tabular numerals `JetBrains Mono` / `tabular-nums` pada seluruh tabel dan jam.

---

## 3. Key Product Decisions & Trade-Offs

- **Penguncian Formulir saat QR Kedaluwarsa**:
  - *Keputusan*: Menampilkan peringatan jelas dan menonaktifkan interaksi tombol submit jika token QR >60 detik.
  - *Alasan*: Menjamin integritas kehadiran fisik di dalam ruangan rapat tanpa merusak pengalaman guru yang sudah berada di halaman.
- **Struktur Data Peserta Rapat (Selective Attendees)**:
  - *Keputusan*: Menambahkan `target_type: 'all' | 'custom'` dan `invited_teacher_ids: string[]` pada antarmuka `Meeting`.
  - *Alasan*: Menjaga kompatibilitas mundur dengan rapat-rapat yang sudah dibuat sebelumnya (jika `target_type` tidak ada atau `'all'`, sistem otomatis menganggap seluruh dewan guru sebagai peserta).
- **Perbaikan Cetak Berbasis CSS Media Print Murni**:
  - *Keputusan*: Menambahkan aturan cetak `@media print` terisolasi di mana elemen modal cetak menjadi satu-satunya kontainer yang ditampilkan, menonaktifkan overflow scrolling dan memicu tata letak grid A4 3x3 yang rapi.
  - *Alasan*: Menghindari ketergantungan pada library pihak ketiga yang berat dan memastikan hasil cetak PDF vektor tajam langsung dari browser.

---

## 4. Technical Architecture & Data Strategy

### Diagram Arsitektur & Alur Data

```
┌────────────────────────────────────────────────────────────────────────┐
│                        dePresent Architecture                          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [ Theme Store ] ───> LocalStorage ('smp_theme') ───> document.root   │
│                             │                                          │
│                             ▼                                          │
│                     [ Dark Teal Theme ]                                │
│                                                                        │
│  [ Meeting Model ]                                                     │
│     ├── target_type ('all' | 'custom')                                 │
│     └── invited_teacher_ids (string[])                                 │
│               │                                                        │
│               ▼                                                        │
│  ┌─────────────────────────┬─────────────────────────┐                 │
│  │ Dashboard / Reports     │ Mobile Checkin View     │                 │
│  │ - Filter expected PTK   │ - Filter selectable PTK │                 │
│  │ - Accurate % & Absent   │ - QR Expiry Guard       │                 │
│  └─────────────────────────┴─────────────────────────┘                 │
│                                                                        │
│  [ ID Card Generator ] ───> @media print CSS Engine ───> PDF / Printer │
│     ├── Standard Portrait (54 x 85.6 mm)                               │
│     ├── 3-column A4 grid layout                                        │
│     └── Forced background color preservation                           │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Rincian Komponen yang Dimodifikasi:
1. `src/types/index.ts`: Menambahkan properti `target_type` dan `invited_teacher_ids` pada antarmuka `Meeting`.
2. `src/components/MobileCheckinView.tsx`:
   - Penegakan `isTokenExpired`: blokir interaksi pemilihan guru dan formulir submit saat kedaluwarsa.
   - Filter `filteredTeachers` hanya menampilkan guru yang diundang ke rapat tersebut jika rapat bersangkutan memiliki `invited_teacher_ids`.
   - Penerapan warna dark teal.
3. `src/components/MeetingsView.tsx`:
   - Antarmuka pemilihan peserta rapat: tombol alih "Semua Guru" vs "Pilih Guru Tertentu".
   - Panel *quick-filter* per jabatan/kelompok guru + checklist nama guru dengan pencarian.
   - Tampilan badge jumlah peserta pada kartu agenda rapat.
4. `src/components/DashboardView.tsx` & `src/components/ReportsView.tsx`:
   - Perhitungan total peserta, persentase kehadiran, dan daftar guru belum hadir disaring berdasarkan `meeting.invited_teacher_ids`.
   - Laporan resmi SPJ dan ekspor Excel hanya memuat guru yang terdaftar dalam agenda.
5. `src/components/TeachersView.tsx` & `src/index.css`:
   - Perbaikan aturan `@media print` untuk ID Card portrait: menyembunyikan background overlay modal, menampilkan container cetak secara penuh, mengaktifkan `print-color-adjust: exact`, dan menata grid 3 kartu per baris.
6. `src/App.tsx`, `src/components/Sidebar.tsx`, dan navigasi:
   - State `theme` (`'light'` / `'dark'`) dengan inisialisasi dari `localStorage`.
   - Tombol toggle Sun / Moon di bilah navigasi atas.
   - Penyesuaian kelas tema dari biru standar ke Dark Teal (`bg-teal-950`, `bg-teal-900`, `text-teal-400`, dll.).
