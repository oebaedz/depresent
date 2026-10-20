# dePresent - Sistem Presensi Kegiatan Yayasan / Sekolah (Revisi Arsitektur)

Penyempurnaan sistem presensi dePresent dengan rotasi **Dynamic Rolling QR Code tiap 15 detik** (tanpa PIN), standarisasi identitas **NIY (Nomor Induk Yayasan)**, kop surat resmi berbasis **Yayasan & Sekolah**, fleksibilitas **Pimpinan Rapat & Notulis per Agenda**, serta perbaikan tuntas mekanisme **sinkronisasi data real-time Supabase**.

### User Review & Critical Decisions

> [!IMPORTANT]
> Ringkasan spesifikasi revisi yang telah dikonfirmasi oleh pengguna:

1. **Dynamic Rolling QR 15 Detik (Tanpa Perlu PIN)**:
   - Proyektor menampilkan kode QR dinamis dengan rotasi cepat setiap **15 detik**.
   - Dilengkapi visual hitung mundur melingkar (*countdown timer ring*) 15 &rarr; 0 detik.
   - Karena token hanya bertahan 15 detik (+ toleransi jaringan 10 detik), tautan atau foto QR tidak mungkin dibagikan ke teman di luar ruangan.
   - Guru tidak perlu menghafal atau menginput PIN sehingga proses presensi berlangsung secepat kilat (1-2 detik setelah scan).
   - Skema database tabel guru tidak perlu diubah.
2. **Penggantian Istilah NIP Menjadi NIY (Nomor Induk Yayasan)**:
   - Seluruh antarmuka, tabel, pencarian, ID Card, dan berkas cetak diubah dari NIP menjadi **NIY (Nomor Induk Yayasan)** sesuai standar institusi yayasan/swasta.
3. **Kop Surat Berbasis Yayasan**:
   - Kolom `foundation_name` (Nama Yayasan, contoh: *YAYASAN PENDIDIKAN DAN SOSIAL HARAPAN BANGSA*) ditambahkan pada profil.
   - Pada Kop Surat, Nama Yayasan dicetak tegas di atas Nama Sekolah.
4. **Pimpinan Rapat & Notulis Spesifik Per Agenda Rapat**:
   - Setiap agenda rapat di `smp_meetings` memiliki penanggung jawab masing-masing: `leader_name`, `leader_niy`, `secretary_name`, dan `secretary_niy`.
   - Pada lembar cetak laporan resmi dan SPJ, titimangsa penandatangan menggunakan pimpinan dan notulis dari rapat bersangkutan.
5. **Perbaikan Masalah Sinkronisasi Database Supabase**:
   - *Akar Masalah*: Pada sistem sebelumnya, jika tabel Supabase baru dibuat dan masih bernilai kosong (`length === 0`), fungsi fetch secara keliru menganggap data gagal lalu memunculkan data dummy lokal. Selain itu, penyimpanan data baru tidak menampilkan pesan kesalahan jika terhambat izin RLS atau perbedaan nama kolom.
   - *Solusi Tuntas*:
     - Perbaikan logika fetch: jika Supabase terhubung, data kosong dari server dihormati (bukan dipaksa kembali ke dummy).
     - Tombol 1-klik **"Migrasi & Sinkronkan Data Awal ke Supabase"** di modal Supabase agar pengguna bisa langsung menyuntikkan data sekolah dan guru ke Supabase dengan satu ketukan.
     - Penanganan error eksplisit: setiap operasi insert/update ke Supabase yang gagal akan memunculkan notifikasi galat yang jelas (RLS, koneksi, atau skema) sehingga panitia mengetahui status riil data.

---

### 1. Overview & Core Concept

- **What It Does**: dePresent dirancang khusus untuk sekolah di bawah naungan yayasan pendidikan. Mengakomodasi presensi rapat dinas, briefing, dan workshop menggunakan kartu pengenal fisik guru ber-NIY atau scan proyektor ber-token 15 detik, terintegrasi penuh ke database Supabase dan notifikasi WAHA.
- **Key Value**: Mencegah titip absen tanpa memperlambat antrean, laporan SPJ resmi ber-kop yayasan, data rapat tersimpan aman di cloud Supabase.

---

### 2. User Experience & Visual Design

- **Alur Presensi Layar Proyektor (15 Detik Rolling)**:
  1. Layar proyektor menampilkan QR Code besar dengan timer cincin yang berputar dari 15 ke 0 detik.
  2. Guru mengarahkan kamera HP ke layar &rarr; membuka tautan `?checkin=ID_RAPAT&t=TOKEN`.
  3. Form presensi memverifikasi usia token (maks 25 detik). Jika valid, guru memilih namanya dan langsung menekan **"Konfirmasi Kehadiran"**.
  4. Seketika nama guru muncul di live feed layar proyektor dan tersimpan ke Supabase.
  5. Jika tautan difoto/dikirim via WhatsApp ke orang lain, saat dibuka token sudah lewat dari 25 detik dan sistem menampilkan peringatan: *"Kode QR telah kadaluarsa. Silakan scan ulang kode terbaru di layar proyektor."*
- **Kop Surat Yayasan**:
  - Baris 1: Nama Yayasan (misal: *YAYASAN PENDIDIKAN ISLAM / MA'ARIF / DLL*)
  - Baris 2: Nama Sekolah (misal: *SMP ...*)
  - Baris 3: Alamat, NSS/NPSN, Kontak, Website
  - Garis ganda pembatas kop surat.

---

### 3. Key Product Decisions & Trade-Offs

- **Kenapa 15 Detik & Tanpa PIN?**:
  - Pengalaman guru tetap sangat cepat dan mudah (tanpa lupa PIN), namun celah titip absen tertutup karena jendela waktu 15 detik tidak memungkinkan pengiriman screenshot dan pembukaan link oleh pihak di luar ruangan.
- **Sinkronisasi Supabase yang Handal**:
  - Menyediakan modal Supabase dengan diagnostik lengkap:
    1. Tes koneksi aktif.
    2. Cek eksistensi tabel `smp_school_profile`, `smp_teachers`, `smp_meetings`, `smp_attendances`.
    3. Tombol *Seed / Sinkron Data Awal* ke Supabase jika tabel masih kosong.
    4. Feedback real-time saat data disimpan ke Supabase.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PROYECTOR (ROLLING 15S)                         │
│                                                                        │
│   • Loop 15 Detik: Generate Token Berwaktu                             │
│   • Tautan: ?checkin=MEETING_ID&tok=TIMESTAMP_BASE64                   │
│   • Visual Ring Animation: 15s ... 0s                                  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Scan Langsung di Ruangan
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FORM PRESENSI MANDIRI HP                        │
│                                                                        │
│   • Cek Usia Token <= 25 Detik                                         │
│   • Pilih Nama Guru / Masukkan NIY                                     │
│   • Klik Konfirmasi -> Tersimpan Langsung ke Supabase                 │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE DATABASE LAYER                         │
│                                                                        │
│   • smp_school_profile (foundation_name, school_name, npsn, ...)       │
│   • smp_teachers (id, ptk_id, niy, name, phone_wa, role_title)        │
│   • smp_meetings (id, title, leader_name, leader_niy, notulis_name)   │
│   • smp_attendances (meeting_id, teacher_id, check_in_time, status)    │
└────────────────────────────────────────────────────────────────────────┘
```

#### Modifikasi File yang Akan Dilakukan:
1. `src/types/index.ts`:
   - Mengganti `nip` & `headmaster_nip` & `secretary_nip` menjadi `niy`, `headmaster_niy`, `secretary_niy`.
   - Menambahkan `foundation_name` pada `SchoolProfile`.
   - Menambahkan `secretary_name` dan `secretary_niy` pada `Meeting`.
2. `src/lib/storage.ts`:
   - Memperbaiki logika pembacaan Supabase agar data kosong tidak fallback ke dummy data.
   - Menambahkan fungsi `syncInitialDataToSupabase()` untuk menyuntikkan data sekolah dan guru ke Supabase dengan 1 klik.
   - Memastikan error Supabase tertangkap dan dilaporkan dengan jelas.
3. `src/lib/supabase.ts`:
   - Memperbarui skrip SQL generator dengan kolom `foundation_name` dan `niy`.
4. `src/components/ProjectorView.tsx`:
   - Rotasi QR Code dinamis setiap 15 detik dengan indikator cincin visual melingkar.
5. `src/components/MobileCheckinView.tsx`:
   - Memvalidasi token waktu 15 detik (+ toleransi 10 detik) dan menampilkan pesan expired jika lewat batas.
   - Menampilkan input NIY (tanpa PIN agar cepat).
6. `src/components/SchoolProfileView.tsx`:
   - Menambahkan kolom input **Nama Yayasan** dan memperbarui Kop Surat.
7. `src/components/MeetingsView.tsx`:
   - Menambahkan kolom input Pimpinan Rapat (Nama & NIY) dan Notulis Rapat (Nama & NIY) khusus per agenda.
8. `src/components/ReportsView.tsx`:
   - Menampilkan Kop Surat dengan Nama Yayasan di atas Nama Sekolah, serta tanda tangan Pimpinan dan Notulis yang sesuai dengan agenda rapat yang dipilih.
9. `src/components/SupabaseModal.tsx`:
   - Menambahkan tombol *Sinkronkan Data Awal ke Supabase* dan indikator status sinkronisasi.
