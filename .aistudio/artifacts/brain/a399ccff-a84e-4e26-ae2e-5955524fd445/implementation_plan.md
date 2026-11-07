# Pembaruan UI & Presensi: Sidebar Ringkas, Validasi Alasan RSVP, Eliminasi Nama Check-in, & Mobile Card View

Rencana komprehensif untuk merampingkan panel bawah sidebar (menghapus tombol Vercel & mengecilkan tombol sistem), mewajibkan pengisian alasan/catatan pada konfirmasi RSVP izin & sakit, mengeliminasi nama guru yang sudah presensi dari pilihan Check In mandiri HP secara real-time, serta mentransformasikan tabel panjang menjadi Card View responsif dan ringkas pada layar HP (Dashboard dan Ekspedisi).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Berdasarkan jawaban klarifikasi yang telah dikonfirmasi oleh pengguna:
> 1. **Check In Mandiri (Eliminasi Guru Sudah Hadir)**: Ketika 1 guru telah berhasil mengisi presensi di HP-nya sendiri untuk rapat terkait, namanya **langsung tidak muncul / disaring keluar** dari daftar pilihan saat guru lain membuka formulir scan QR proyektor.
> 2. **Mobile Card View**: Tampilan tabel daftar pegawai di halaman **Dashboard** dan **Buku Ekspedisi** akan **otomatis beralih ke Card View responsif di layar HP** (`< 640px` / sm) dan tetap berbentuk tabel standar berdensitas tinggi di layar Desktop/Tablet (`≥ 640px`), dengan menonjolkan poin penting: **Nama, NIY, Kelompok Guru, No HP, Status, dan Tombol Aksi Cepat**.
> 3. **Sidebar**: Tombol *Deploy Vercel* dihapus sepenuhnya dari bagian bawah sidebar. Tombol *Akses Admin*, *Status Supabase*, dan *WAHA WhatsApp* dirampingkan (*compact slim layout*) dengan padding dan font yang lebih proporsional agar tidak memadati layar.
> 4. **RSVP Izin & Sakit Wajib Alasan**: Ketika guru memilih opsi **Izin** atau **Sakit**, kolom alasan/catatan menjadi **wajib diisi (required)** dan formulir menolak pengiriman jika kolom tersebut kosong dengan pesan validasi yang jelas.

---

## 1. Overview & Core Concept

- **Apa yang Dibangun**:
  1. **Sidebar Kompak**: Menghilangkan tombol deploy Vercel dan merapikan tombol sistem (Admin Lock, Supabase, WAHA) menjadi tombol berprofil rendah (*low-profile compact buttons*) yang hemat ruang vertikal.
  2. **Validasi Formulir RSVP**: Menambahkan aturan validasi wajib pada halaman RSVP (`/ ?rsvp=...`) ketika status adalah *Izin* atau *Sakit*.
  3. **Check In Real-Time Filtering**: Memperbarui logika seleksi guru pada `MobileCheckinView.tsx` dan input manual agar mengecualikan guru yang sudah memiliki riwayat presensi (`attendance`) untuk agenda rapat aktif.
  4. **Mobile Card View pada Dashboard & Ekspedisi**: Menyediakan komponen kartu ringkas yang elegan khusus perangkat seluler, menampilkan informasi esensial tanpa tabel horizontal yang terpotong.

- **Target Pengguna**: Guru, panitia rapat, dan staf administrasi sekolah yang mengakses aplikasi baik melalui desktop proyektor maupun smartphone pribadi.

---

## 2. User Experience & Visual Design

### A. Perampingan Sidebar Bawah (`Sidebar.tsx`)
- Menghapus tombol *Deploy Vercel* beserta modal dependensinya dari navigasi bawah.
- Mengurangi tinggi vertikal tombol *Admin Lock*, *Supabase*, dan *WAHA*:
  - Padding diturunkan dari `py-2` ke `py-1.5 px-2.5`.
  - Menggunakan font `text-[10px]` dan ikon `w-3 h-3` yang presisi.
  - Penataan yang rapi menjaga kontras warna dark-teal khas dePresent tanpa kesan sesak.

### B. Validasi Alasan RSVP Izin / Sakit (`RsvpConfirmationView.tsx`)
- Ketika guru memilih opsi **Akan Hadir**: Kolom catatan bersifat opsional.
- Ketika guru memilih opsi **Izin** atau **Sakit**:
  - Label berubah menjadi: `Alasan Izin (Wajib Diisi *)` atau `Keterangan Sakit (Wajib Diisi *)`.
  - Border input mendapatkan indikator penegasan (*amber/rose ring focus*).
  - Validasi *client-side* memblokir pengiriman formulir jika `notes.trim() === ''`, menampilkan peringatan visual interaktif: *"Mohon cantumkan alasan atau keterangan ketidakhadiran Anda."*

### C. Eliminasi Guru yang Sudah Check-In (`MobileCheckinView.tsx`)
- Pada saat guru memindai QR dinamis proyektor dan membuka halaman presensi di HP:
  - Aplikasi memuat data kehadiran rapat terkini dari Supabase/lokal.
  - Guru yang telah presensi (`attendanceMap` atau `checkedInTeacherIds`) disaring keluar dari daftar pilihan.
  - Daftar hanya menampilkan guru yang berstatus **Belum Hadir**.
  - Jumlah sisa guru yang belum presensi ditampilkan secara transparan (contoh: *Pilih nama Anda (tersisa 12 guru belum hadir)*).

### D. Responsive Card View Mobile (`DashboardView.tsx` & `InvitationsView.tsx`)
- **Breakpoint Responsif**:
  - `hidden sm:block`: Tabel komprehensif untuk desktop dan tablet.
  - `block sm:hidden`: Grid kartu (*cards list*) yang dioptimalkan untuk sentuhan jempol dan layar sempit.
- **Isi Card Mobile Dashboard**:
  - Header kartu: Nama lengkap (bold) & Badge status kehadiran (Hadir / Terlambat / Izin / Belum).
  - Sub-info (poin penting):
    - `NIY`: Nomor Induk Yayasan (monospace).
    - `Kelompok`: Guru Mapel / Kelompok Jabatan dengan tag kecil rapi.
    - `No HP`: Link cepat ke WhatsApp jika tersedia.
    - `Waktu & Metode`: Waktu scan (misal `08:15 WIB · Scan Proyektor`).
  - Baris aksi cepat: Tombol mini untuk ubah status manual (Hadir, Izin, Sakit, Alpa).
- **Isi Card Mobile Buku Ekspedisi**:
  - Header kartu: Nama guru & Status RSVP (Akan Hadir / Izin / Sakit / Belum Konfirmasi).
  - Sub-info:
    - `NIY` & `Kelompok / Jabatan`.
    - `No. WhatsApp` penerima.
    - `Status Pengiriman`: Terkirim WA (dengan jam pengiriman) atau Belum Dikirim.
    - `Catatan RSVP`: Alasan izin/sakit jika ada.
  - Baris aksi cepat: Tombol kirim undangan WA perorangan (*Send WA*) & Konfirmasi RSVP manual.

---

## 3. Key Product Decisions & Trade-Offs

1. **Eliminasi Guru di Check-in vs Tetap Tampil Disabled**:
   - *Pilihan*: Menghapus / menyaring keluar nama guru yang sudah presensi sepenuhnya dari daftar pilihan.
   - *Alasan*: Sesuai permintaan pengguna agar guru lain yang membuka tautan di HP tidak melihat nama rekan yang sudah selesai presensi, mengurangi panjang daftar secara drastis (*faster scroll & zero accidental double-taps*).

2. **Otomatisasi Card View vs Toggle Manual**:
   - *Pilihan*: Otomatis beralih ke Card View pada mobile breakpoint Tailwind (`< sm`).
   - *Alasan*: Pengguna di smartphone secara alamiah kesulitan menggeser tabel 7 kolom secara horizontal (*anti horizontal scrollbar*), sementara pengguna laptop tetap mendapatkan tabel berdensitas tinggi untuk pencetakan dan monitoring.

3. **Penyimpanan Alasan RSVP**:
   - *Pilihan*: Alasan wajib tersimpan di kolom `rsvp_notes` pada tabel `invitations` Supabase dan tersinkronisasi ke laporan SPJ serta buku ekspedisi.

---

## 4. Technical Architecture & Data Strategy

### System Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          APLIKASI DEPRESENT                            │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
   ┌───────────────┐         ┌───────────────┐         ┌───────────────┐
   │  Sidebar.tsx  │         │  RSVP Form    │         │ Mobile CheckIn│
   │ ───────────── │         │ ───────────── │         │ ───────────── │
   │ • Hapus Vercel│         │ • Status Izin │         │ • Fetch Att.  │
   │ • Compact BTN │         │ • Status Sakit│         │ • Exclude IDs │
   │ • Slim layout │         │ • WAJIB Alasan│         │ • Clean List  │
   └───────────────┘         └───────────────┘         └───────────────┘
                                     │
                                     ▼
           ┌───────────────────────────────────────────────────┐
           │     RESPONSIVE VIEWS (DASHBOARD & EKSPEDISI)      │
           ├─────────────────────────┬─────────────────────────┤
           │  Desktop (≥ 640px)      │  Mobile (< 640px)       │
           │  ─────────────────      │  ────────────────       │
           │  Dense Data Table       │  Touch-friendly Cards   │
           │  Full Columns Grid      │  NIY, Kelompok, No WA   │
           └─────────────────────────┴─────────────────────────┘
```

### Rencana File yang Dimodifikasi:
1. `src/components/Sidebar.tsx`:
   - Hapus komponen button *Deploy Vercel* dan props/state terkait jika tidak dibutuhkan lagi di sidebar.
   - Rampingkan styling tombol *Admin Lock*, *Supabase*, dan *WAHA*.
2. `src/components/RsvpConfirmationView.tsx`:
   - Tambahkan validasi pada `handleSubmit` untuk memeriksa `notes.trim()` ketika status adalah `permission` atau `sick`.
   - Perbarui UI textarea dengan indikator required, pesan error, dan visual styling yang jelas.
3. `src/components/MobileCheckinView.tsx`:
   - Ambil data `attendances` rapat aktif dari storage/Supabase.
   - Filter `activeTeachers` dengan kondisi: `!checkedInTeacherIds.has(t.id)`.
   - Tampilkan badge informatif sisa guru yang belum presensi.
4. `src/components/DashboardView.tsx`:
   - Sembunyikan tabel pada mobile (`hidden sm:block`).
   - Tambahkan render Card View khusus mobile (`block sm:hidden`).
5. `src/components/InvitationsView.tsx`:
   - Sembunyikan tabel ekspedisi pada mobile (`hidden sm:block`).
   - Tambahkan render Card View ekspedisi khusus mobile (`block sm:hidden`).

---

## Verifikasi & Kriteria Keberhasilan
- [ ] Sidebar tidak menampilkan tombol Vercel; tombol admin, Supabase, dan WAHA tampil ramping dan estetik.
- [ ] Memilih Izin atau Sakit pada form RSVP mewajibkan input alasan; formulir tidak dapat dikirim jika kosong.
- [ ] Pada formulir Check In mandiri HP, guru yang sudah berhasil presensi langsung hilang dari daftar pilihan untuk guru berikutnya.
- [ ] Halaman Dashboard dan Buku Ekspedisi otomatis berganti menjadi kartu (*Card View*) di layar HP tanpa scrollbar horizontal tabel yang patah.
- [ ] `lint_applet` dan `compile_applet` lolos tanpa galat TypeScript atau kompilasi.
