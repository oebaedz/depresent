# Rencana Akselerasi Performa & Pengamanan dePresent (Revisi)

Mengatasi kendala kelambatan penarikan data Supabase (*loading latency*), mengeliminasi *flash* data sekolah lama dengan strategi **Local-First (Stale-While-Revalidate)** berkecepatan 0ms, menuntaskan masalah "Rapat Tidak Ditemukan" pada Vercel, serta menerapkan proteksi PIN admin dan isolasi antarmuka presensi guru.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Penyebab Utama Kelambatan yang Ditemukan**:
> 1. **Redundansi 8x HTTP Request per Aksi**: Setiap kali aplikasi dibuka atau data disimpan/diperbarui, aplikasi memanggil `testSupabaseConnection()` (4 query HTTP beruntun) lalu memanggil `fetch*()` (4 query HTTP lagi). Di jaringan cloud Supabase, ini memakan waktu 3–7 detik.
> 2. **State React Menggunakan Data Dummy Awal**: `App.tsx` menginisialisasi state dengan objek dummy (`INITIAL_SCHOOL_PROFILE`), alih-alih membaca memori `localStorage` yang sudah tersimpan di browser secara sinkron.
> 3. **Non-Optimistic Writes**: Fungsi `saveTeacher` dan `saveMeeting` melakukan `await fetchTeachers()` (HTTP query ke server) sebelum menyimpan, sehingga tombol simpan/hapus terasa lambat.
>
> **Solusi Revisi Arsitektur**:
> - **Local-First Stale-While-Revalidate**: State awal langsung dimuat dari `localStorage` dalam **0 milidetik** saat pertama kali dibuka. Tidak ada jeda atau kedip nama sekolah lama.
> - **Eliminasi Network Overhead**: `testSupabaseConnection()` hanya dijalankan di dalam modal pengaturan Supabase, bukan di jalur render utama aplikasi.
> - **Optimistic UI Updates**: Tambah, ubah, dan hapus data langsung memperbarui tampilan dalam hitungan milidetik tanpa menunggu respon round-trip jaringan cloud.
> - **Sinkronisasi Instan Vercel**: Tautan QR proyektor membawa token kredensial publik Supabase sehingga HP guru langsung mengenali database sekolah seketika tanpa error "Rapat Tidak Ditemukan".
> - **Proteksi PIN Admin & Isolasi Presensi**: Dashboard admin terkunci PIN; halaman presensi di HP guru tidak memiliki tombol akses ke admin.

- **Keputusan 1**: Gunakan arsitektur *Local-First* agar nama yayasan, sekolah, agenda rapat, dan guru tampil instan (0ms).
- **Keputusan 2**: Terapkan *Optimistic Updates* pada simpan/edit/hapus data agar interaksi UI responsif seketika.
- **Keputusan 3**: Kunci menu admin dengan PIN (default: `1234`) dan isolasi total halaman presensi HP guru.

---

### 1. Overview & Core Concept

- **Apa yang Dilakukan**:
  - Mengubah paradigma pemuatan data menjadi **Local-First & Optimistic**: aplikasi membaca dan menampilkan data lokal seketika, lalu menyinkronkan pembaruan ke cloud Supabase di latar belakang (*background sync*).
  - Menyematkan konfigurasi publik Supabase pada link QR dinamis sehingga saat guru memindai proyektor di Vercel, HP langsung terhubung ke database dan menampilkan rapat tanpa *delay*.
  - Menghilangkan jeda *loading* yang sebelumnya menyebabkan HP guru sempat menampilkan "Rapat Tidak Ditemukan".
  - Memasang gerbang autentikasi PIN pada konsol admin dePresent dan menghapus semua tombol kembali/Home di layar presensi guru.
- **Target Pengguna**:
  - **Operator / Panitia**: Merasakan aplikasi dePresent yang sangat cepat, responsif saat input/edit/hapus rapat & guru, dan aman dari akses guru.
  - **Guru**: Memindai QR di layar panggung, halaman presensi terbuka cepat dalam hitungan detik, mengisi presensi dengan lancar, dan perangkat HP terkunci dari titip absen.

---

### 2. User Experience & Visual Design

#### A. Startup Instan Aplikasi (Admin & Proyektor)
- Saat membuka aplikasi dePresent di laptop sekolah:
  - Nama yayasan dan sekolah Anda langsung muncul dalam **0 milidetik** tanpa jeda (*zero layout shift*).
  - Agenda rapat aktif langsung terpilih dari cache lokal.
  - Penarikan data terbaru dari Supabase berjalan tenang di latar belakang (*silent revalidation*).

#### B. Akselerasi Simpan, Edit, dan Hapus (0ms Latency)
- Saat operator menambah agenda rapat, mengedit data guru ber-NIY, atau menghapus item:
  - Antarmuka tabel/kartu langsung terupdate seketika (*optimistic update*).
  - Data di-push ke Supabase secara asinkron tanpa memblokir interaksi pengguna.
  - Modal dialog konfirmasi hapus in-app yang aman dan cepat.

#### C. Alur Presensi Guru via Scan QR (Cepat & Terisolasi)
1. Guru memindai QR dinamis di layar proyektor.
2. HP guru langsung membaca token data & kredensial Supabase dari parameter URL.
3. Rapat langsung terdeteksi tanpa pesan "Rapat Tidak Ditemukan".
4. Guru mencari nama/NIY dan menekan tombol presensi.
5. Muncul tanda sukses resmi berlogo yayasan; HP terkunci untuk 1 guru (mencegah titip absen).
6. **Keamanan**: Tidak ada tombol Home atau menu navigasi admin di layar HP guru.

#### D. Gerbang PIN Admin
- Tampilan dialog kunci PIN yang elegan bergaya institusional.
- Keypad angka cepat dan dukungan input keyboard.
- Fitur ganti PIN di menu Profil Yayasan & Sekolah.

---

### 3. Key Product Decisions & Trade-Offs

- **Keputusan 1: Local-First Stale-While-Revalidate (SWR)**
  - *Pendekatan*: Inisialisasi state React langsung dari `localStorage`:
    ```ts
    const [schoolProfile, setSchoolProfile] = useState<SchoolProfile>(() => getCachedProfile());
    const [meetings, setMeetings] = useState<Meeting[]>(() => getCachedMeetings());
    const [teachers, setTeachers] = useState<Teacher[]>(() => getCachedTeachers());
    ```
  - *Alasan*: Menghilangkan keluhan "proses tarik data sangat lama sehingga app menampilkan nama sekolah mode lama". Aplikasi langsung menampilkan identitas sekolah asli pengguna sejak frame pertama.
- **Keputusan 2: Pemisahan Jalur Diagnostic vs. Data Fetching**
  - *Pendekatan*: Mencabut pemanggilan `testSupabaseConnection()` dari siklus `loadAllData()`. Pengecekan tabel hanya dilakukan ketika operator membuka modal Supabase.
  - *Alasan*: Mengurangi 50% beban kueri HTTP dan memangkas waktu muat hingga beberapa detik.
- **Keputusan 3: Penulisan Optimistik (Optimistic Writes)**
  - *Pendekatan*: Pada `saveTeacher`, `saveMeeting`, `deleteTeacher`, dan `deleteMeeting`, simpan ke `localStorage` dan perbarui state seketika, lalu jalankan `upsert`/`delete` ke Supabase tanpa melakukan query `fetch` ganda.
  - *Alasan*: Pengguna tidak merasakan *freeze* atau *loading spinner* yang mengganggu saat mengelola data rapat dan guru.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                      LOCAL STORAGE CACHE                        │
│  - Profil Sekolah & Yayasan (Kop Surat)                         │
│  - Daftar Guru & NIY                                            │
│  - Agenda Rapat & Kegiatan                                      │
│  - Riwayat Presensi                                             │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Baca Sinkron (0 ms) pada Startup
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REACT STATE INITIALIZATION                   │
│  - UI langsung render identitas sekolah asli                    │
│  - Tanpa kedip / tanpa data dummy lama                          │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Revalidasi Asinkron di Background
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SUPABASE POSTGRESQL                       │
│  - Tarik data pembaruan (Promise.all paralel)                   │
│  - Update cache lokal jika ada data baru                        │
│  - Tulis langsung (Optimistic Upsert tanpa query ganda)         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              ALUR QR PROYEKTOR -> HP GURU DI VERCEL             │
│  1. Proyektor buat link: ?checkin={id}&tok={hash}&sc={cred}     │
│  2. HP Guru buka link -> parse {cred} -> konek Supabase instan  │
│  3. Cari rapat di database -> Rapat Ditemukan seketika          │
│  4. Layar sandboxed: Tanpa tombol kembali ke Home/Admin         │
└─────────────────────────────────────────────────────────────────┘
```

#### File & Komponen yang Dioptimalkan:
1. `src/lib/storage.ts`:
   - Implementasi getter sinkron: `getCachedProfile()`, `getCachedTeachers()`, `getCachedMeetings()`, `getCachedAttendances()`.
   - Refactoring `save*` dan `delete*` menjadi *optimistic*: simpan ke cache lokal langsung, kirim satu kueri tunggal ke Supabase tanpa re-fetch internal yang lambat.
2. `src/lib/supabase.ts`:
   - Penambahan `encodeSupabaseCredentials` dan `decodeSupabaseCredentials` untuk parameter `sc`.
   - Otomatis inisialisasi kredensial jika parameter `sc` terdeteksi di URL HP guru.
3. `src/App.tsx`:
   - Gunakan lazy initial state dari cache lokal (0ms rendering).
   - Jalankan `loadAllData()` sebagai proses *background revalidation* tanpa blocking.
   - Pemasangan `AdminPinGate` (PIN default `1234` atau PIN tersimpan).
   - Penanganan khusus rute `checkin`: tidak menampilkan tombol navigasi admin.
4. `src/components/ProjectorView.tsx`:
   - Menyertakan token kredensial publik Supabase pada string QR dinamis.
5. `src/components/MobileCheckinView.tsx`:
   - Menghapus total tombol Home / "Buka Aplikasi Utama".
   - Tampilan loading skeleton dan error yang rapi dan tertutup.
6. `src/components/SchoolProfileView.tsx`:
   - Menambahkan pengaturan ubah PIN Admin dengan verifikasi.

---

### 5. Verification Plan

1. **Uji Coba Kecepatan Render Awal**:
   - Refresh aplikasi di browser dan pastikan nama yayasan/sekolah yang sudah diinput langsung tampil tanpa menampilkan teks dummy default sama sekali.
2. **Uji Coba Respon Input/Edit/Hapus**:
   - Tambah/edit/hapus agenda rapat dan guru; verifikasi aksi berlangsung instan tanpa jeda tunggu.
3. **Uji Coba Presensi HP Guru di Vercel**:
   - Buka tautan presensi hasil scan QR di perangkat lain; verifikasi bahwa informasi rapat langsung tampil dengan cepat tanpa tulisan "Rapat Tidak Ditemukan".
4. **Uji Coba Keamanan PIN**:
   - Buka konsol admin pada tab baru atau sesi baru dan pastikan PIN diminta.
   - Cek halaman presensi guru dan pastikan tidak ada jalan keluar menuju dashboard admin.
5. **Kompilasi & Lint**:
   - Menjalankan `compile_applet` dan `lint_applet` untuk memastikan kode bebas galat.
