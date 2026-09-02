# Referensi Halaman

Setiap baris tabel berikut adalah satu halaman aplikasi. Kolom **Peran** memakai
singkatan **SA** = Super Admin, **A** = Admin, **AK** = Akuntan, **AU** = Auditor
(lihat [05-rbac-keamanan.md](05-rbac-keamanan.md) untuk penjelasan lengkap tiap peran).

---

## `index.html` — Dashboard & Audit

**Controller**: `js/dashboard-page.js`
**Peran**: SA · A · AK · AU

Ringkasan keuangan konsolidasi + status kepatuhan legal — halaman pertama yang dilihat
setiap pengguna setelah login.

- **Data**: `master_unit_usaha`, `pengaturan/profil_perusahaan` (badge status legal), dan
  seluruh isi `jurnal_transaksi` (lewat `ambilSemuaJurnalPusat()`). Tidak menulis apa pun.
- **Fitur**:
  - Sapaan personal + badge status Akta/NPWP/PKP (lengkap/warning berdasarkan data di
    Profil Pajak).
  - Kartu KPI: Total Pendapatan, Laba Bersih, Total Utang, Akumulasi Pajak.
  - Indikator keseimbangan jurnal (PASS / KOSONG / ERROR — dari `total_debit ===
    total_kredit` setiap jurnal).
  - Tabel profitabilitas per unit usaha (unit berstatus "Ditutup" disembunyikan dari
    baris, tapi tetap ikut dihitung penuh di baris TOTAL KESELURUHAN) + tren bulanan 12
    bulan terakhir + grafik batang Chart.js (Pendapatan vs Laba per bulan, sadar dark
    mode).

## `login.html` — Login

**Controller**: `js/login-page.js`
**Peran**: publik (belum login)

- **Data**: membaca `users/{email}` untuk resolusi role, `pengaturan_sistem/branding`
  untuk logo/favicon. Sesi hasil login disimpan di `sessionStorage`, bukan Firestore.
- **Fitur**: sign-in email/password via Firebase Auth; logo dinamis; toggle
  tampilkan/sembunyikan password; auto-redirect ke `/index` jika sudah punya sesi aktif;
  perlakuan khusus untuk `hi.wantan@gmail.com` sebagai Super Admin bootstrap bila belum
  ada dokumen `users`.

## `input-jurnal.html` — Input Jurnal

**Controller**: `js/journal-page.js`
**Peran**: SA · A · AK (Auditor diblokir di level path oleh `auth.js`, bukan cuma
disembunyikan dari menu)

Formulir pencatatan jurnal double-entry manual.

- **Data**: membaca `master_unit_usaha`, `master_coa`; menulis/membaca
  `jurnal_transaksi` & `bukti_transaksi` lewat `js/db.js`
  (`simpanJurnalPusat`/`ambilJurnalPerTanggal`/`ambilJurnalById`/`ambilBuktiTransaksi`);
  mengecek status tutup buku lewat `cekApakahPeriodeTerkunci()`.
- **Fitur**:
  - `id_jurnal` & `no_bukti` dibuat otomatis (urutan harian).
  - Tabel baris debit/kredit dinamis dengan autocomplete pencarian akun
    (`coa-autocomplete.js`) dan indikator keseimbangan langsung (live).
  - 10 template transaksi siap pakai (Gaji, Operasional, Pendapatan, Pembelian Aset, Jasa
    Website, Langganan SaaS, DP Proyek, Hosting Cloud, Panen Tunai, Sarana Pertanian).
  - Unggah bukti transaksi (gambar otomatis dikompresi ke JPEG ≤700 KB, atau PDF apa
    adanya), disimpan base64 di `bukti_transaksi`.
  - Mode edit lewat parameter URL `?edit=<id_jurnal>`.
  - Penolakan otomatis jika tanggal transaksi berada pada periode yang sudah tutup buku.

## `manajemen.html` — Buku Besar & Jurnal

**Controller**: `js/management-page.js`
**Peran**: SA · A · AK · AU

Daftar seluruh jurnal terposting — lihat, filter, edit, hapus, cetak, ekspor.

- **Data**: membaca `master_unit_usaha`; `ambilSemuaJurnalPusat()`/`hapusJurnalPusat()`
  (→ `jurnal_transaksi`, `bukti_transaksi`, `activity_logs`).
- **Fitur**:
  - Pencarian teks bebas + filter Unit Usaha (opsi diurutkan abjad kode) + filter rentang
    tanggal.
  - Paginasi sisi klien, 10 baris/halaman — halaman aktif **dipertahankan** setelah
    hapus/reload (bukan direset ke halaman 1).
  - Baris jurnal tidak seimbang ditandai merah.
  - Menu aksi 3-titik per baris: Edit (→ `input-jurnal.html?edit=...`), Cetak (bukti
    cetak di jendela baru), Hapus.
  - Ekspor CSV (`Laporan_Jurnal_....csv`).

> **Catatan inkonsistensi RBAC**: berbeda dari Aset Tetap/Sewa/Invoice, halaman ini
> **tidak** menyembunyikan tombol Edit/Hapus untuk Auditor (tidak ada pengecekan `role`
> sama sekali di `js/management-page.js` maupun `manajemen.html`). Klik Edit/Hapus oleh
> Auditor tidak akan membocorkan/merusak data — `firestore.rules` tetap menolak tulisan
> apa pun dari peran selain Operator (SA/Admin/Akuntan) di level server — tapi pengguna
> Auditor akan melihat tombol yang ujungnya gagal dengan pesan error, bukan tombol yang
> memang disembunyikan seperti pada halaman lain.

## `master-data.html` — COA & Master Data

**Controller**: `js/master-page.js`
**Peran**: SA · A · AK

Data induk: Unit Usaha dan Chart of Accounts (COA).

- **Data**: CRUD penuh pada `master_unit_usaha` dan `master_coa`.
- **Fitur**: dua bagian CRUD independen (form + tabel) dengan menu Edit/Hapus 3-titik dan
  highlight baris saat diedit. Form COA punya checkbox `kategori_sewa` /
  `kategori_aset_tetap` (menentukan akun mana yang muncul di picker "Isi Otomatis" pada
  Sewa/Aset Tetap). Kode akun divalidasi harus berawalan digit 1–6
  (`isKodeAkunValid()`). Daftar Unit Usaha diurutkan abjad berdasarkan `kode`.

## `aset-tetap.html` — Aset Tetap

**Controller**: `js/assets-page.js`
**Peran**: SA · A · AK · AU (Auditor: form & menu aksi disembunyikan — tampilan
saja)

Register aset tetap & skedul penyusutan.

- **Data**: CRUD `aset_tetap`; membaca `master_unit_usaha`, `master_coa`; membaca baris
  jurnal terkait via `ambilBarisJurnalPerKodeAkun()`/`ambilSemuaJurnalPusat()`.
- **Fitur**:
  - Daftar aset dengan kolom Perolehan/Akumulasi Penyusutan/Nilai Buku terhitung
    otomatis.
  - Kelompok penyusutan Kelompok 1–4 & Bangunan Permanen/Tidak Permanen, metode Garis
    Lurus atau Saldo Menurun (Saldo Menurun tidak tersedia untuk Bangunan).
  - Fitur "Isi Otomatis dari Transaksi Jurnal" (`transaksi-picker.js`), memilih dari
    baris jurnal berakun bertanda `kategori_aset_tetap`.
  - Badge peringatan bila akun beban/akumulasi penyusutan belum diisi (aset ini akan
    dilewati generator Jurnal Berulang).
  - Riwayat baca-saja transaksi pembelian aset (kode akun berawalan "15"/"16").

## `sewa.html` — Sewa Dibayar Dimuka

**Controller**: `js/sewa-page.js`
**Peran**: SA · A · AK · AU (Auditor: read-only, sama seperti Aset Tetap)

Register sewa dibayar dimuka & skedul amortisasi. Mengikuti pola yang identik dengan Aset
Tetap.

- **Data**: CRUD `sewa_dibayar_dimuka`; membaca `master_unit_usaha`, `master_coa`, baris
  jurnal via `ambilBarisJurnalPerKodeAkun()`.
- **Fitur**: daftar sewa dengan total amortisasi terhitung; picker "Isi Otomatis dari
  Transaksi" (akun bertanda `kategori_sewa`); validasi tanggal mulai/selesai; amortisasi
  selalu garis lurus (tidak ada opsi saldo menurun untuk sewa).

## `jurnal-berulang.html` — Jurnal Berulang (Draft)

**Controller**: `js/recurring-page.js` + `js/recurring-db.js`
**Peran**: SA · A · AK (Auditor diblokir di level path)

Antrean draft penyusutan/amortisasi bulanan otomatis, menunggu persetujuan sebelum ikut
memengaruhi Neraca/Laba Rugi.

- **Data**: baca/tulis `draf_jurnal_berulang`; membaca `aset_tetap`,
  `sewa_dibayar_dimuka`, `master_coa`; saat disetujui memanggil
  `simpanJurnalPusat()`/`hapusJurnalPusat()` (→ `jurnal_transaksi`, `bukti_transaksi`,
  `activity_logs`) dengan `lewatiKuncPeriode: true` supaya backfill ke bulan yang sudah
  tutup buku tetap bisa diposting.
- **Fitur**:
  - Tombol "Generate Ulang" untuk memindai ulang aset/sewa & membuat draft bulan yang
    belum diproses.
  - Tab PENDING / APPROVED / REJECTED.
  - Pilih banyak via checkbox + aksi massal Setujui/Tolak Terpilih (diproses satu per
    satu, satu kegagalan tidak menghentikan sisanya).
  - Per baris: Setujui/Tolak (jika PENDING), atau Edit Jurnal / "Hapus & Batalkan
    Persetujuan" (jika APPROVED — pembatalan tunduk pada kunci periode NORMAL, berbeda
    dari alur approval yang sengaja bisa menembusnya).
  - Banner peringatan untuk aset/sewa yang akunnya belum lengkap.
  - ID draft deterministik & idempoten (`{MODUL}_{sumberId}_{periode}`).

Lihat [04-modul-akuntansi.md](04-modul-akuntansi.md) untuk algoritma generate & posting
secara detail.

## `analisa-bisnis.html` — Analisis Bisnis

**Controller**: `js/business-analytics-page.js` (controller terbesar, ±1000 baris)
**Peran**: SA · A · AK · AU

Analitik profitabilitas, rasio, dan proyeksi per unit usaha — murni baca (tidak menulis
apa pun).

- **Data**: `master_unit_usaha` + seluruh `jurnal_transaksi` via `ambilSemuaJurnalPusat()`.
- **Filter**: Unit Usaha (dropdown, opsi "Semua Unit Usaha") + rentang tanggal bebas
  (`filterTanggalDariBisnis`/`filterTanggalSampaiBisnis`, dengan tombol reset "Semua
  Periode") — diterapkan ke bagian berbasis Pendapatan/Beban di bawah ini.
  **Rasio Keuangan Kunci** dan **Proyeksi Arus Kas** sengaja **tidak** ikut difilter per
  unit karena akun Kas/Neraca yang mendasarinya tidak ditandai per unit usaha.
- **Fitur**:
  - Kartu KPI: margin konsolidasi (atau margin unit terpilih), unit berkinerja
    terbaik, unit yang perlu perhatian.
  - Tabel/kartu ranking profitabilitas per unit + grafik margin Chart.js.
  - Analisis konsentrasi vendor/pelanggan teratas (% konsentrasi top-N).
  - Struktur beban (breakdown biaya).
  - Perbandingan Year-over-Year (dua pemilih tahun) dengan indikator pertumbuhan +
    grafik Chart.js.
  - Rasio keuangan kunci dengan badge status kesehatan (ambang "baik jika lebih
    tinggi" / "baik jika lebih rendah" berbeda per rasio).
  - Proyeksi arus kas & estimasi keberlangsungan kas (cash runway) dari tren bulanan
    terbaru.

## `laporan.html` — Laporan Keuangan

**Controller**: `js/reports-page.js`
**Peran**: SA · A · AK · AU

Laporan keuangan terpadu: Neraca Saldo, Neraca (Posisi Keuangan), Laba Rugi, Perubahan
Modal.

- **Data**: seluruh `jurnal_transaksi` via `ambilSemuaJurnalPusat()`. Tidak menulis.
- **Fitur**:
  - Filter periode: Semua / per Tahun / per Bulan — **Neraca selalu kumulatif** tanpa
    peduli filter (karena saldo neraca memang akumulatif sejak awal, lihat
    [04-modul-akuntansi.md](04-modul-akuntansi.md)).
  - Kartu & tabel on-screen untuk setiap laporan.
  - Tata letak cetak berjenjang tersendiri (Kelas > Sub-Kelas > Akun) untuk Neraca,
    Laba Rugi, dan Perubahan Modal (`susunStrukturNeraca`/`susunStrukturLabaRugi`/
    `susunStrukturPerubahanModal` di `accounting.js`).
  - Ekspor CSV untuk Neraca Saldo dan Neraca.
  - Indikator SEIMBANG/TIDAK SEIMBANG.

## `invoice.html` — Invoice & Kwitansi

**Controller**: `js/invoice-list-page.js`
**Peran**: SA · A · AK · AU (Auditor: tanpa tombol "Buat Invoice Baru", tanpa opsi
Hapus — lihat/cetak saja)

Daftar invoice/kwitansi — modul penjualan berdiri sendiri (**tidak** menyentuh
`jurnal_transaksi`).

- **Data**: `invoice_penjualan` via `js/invoice-db.js` (list, hapus).
- **Fitur**: pencarian, paginasi (10/halaman — halaman aktif dipertahankan setelah
  hapus, sama seperti perbaikan di Buku Besar), menu 3-titik (Edit/Cetak →
  `invoice-baru.html?id=...`, Hapus).

## `invoice-baru.html` — Buat/Edit Invoice

**Controller**: `js/invoice-form-page.js`
**Peran**: SA · A · AK · AU (Auditor: form disembunyikan — lihat/cetak saja)

Formulir pembuatan/pengeditan Invoice sekaligus Kwitansi pasangannya, dengan tata letak
cetak.

- **Data**: `invoice_penjualan` via `js/invoice-db.js` (`simpanInvoice`,
  `generateNomorInvoiceBaru`).
- **Fitur**: tabel baris item (nama/satuan/kuantum/harga) dengan subtotal/diskon/PPN%/
  grand total berjalan; penomoran otomatis invoice+kwitansi berbagi urutan bulanan
  (`FT/NNN/MM/YYYY`, `KT/NNN/MM/YYYY`); tata letak cetak Invoice & Kwitansi terpisah,
  nominal kwitansi dieja dalam kata via `js/terbilang.js`; mode edit lewat `?id=...`.

## `histori.html` — Histori Audit

**Controller**: `js/history-page.js`
**Peran**: SA · A · AK · AU

Penampil jejak audit (`activity_logs`) — murni baca.

- **Data**: `activity_logs`.
- **Fitur**: pencarian + filter jenis aksi (CREATE/UPDATE/DELETE) + filter rentang
  tanggal; paginasi 15/halaman; badge warna per jenis aksi.

## `closing.html` — Tutup Buku Bulanan

**Controller**: `js/closing-page.js` + `js/closing-period.js`
**Peran**: SA · A saja (Akuntan & Auditor diblokir di level path)

Kontrol kunci periode akuntansi bulanan.

- **Data**: `pengaturan_sistem/pengaturan_tutup_buku` (baca/tulis `bulanTerkunci`).
- **Fitur**: form pemilih bulan tunggal; menampilkan periode yang sedang terkunci;
  mengunci satu bulan memblokir input/edit/hapus jurnal bertanggal ≤ bulan itu di
  **seluruh aplikasi** (ditegakkan di `simpanJurnalPusat()`/`hapusJurnalPusat()` di
  `js/db.js`) — kecuali proses approval Jurnal Berulang yang sengaja bisa menembus kunci
  ini untuk keperluan backfill historis.

## `pajak.html` — Rekapitulasi PPN & PPh

**Controller**: `js/tax-page.js`
**Peran**: SA · A · AK · AU

Rekap pajak bergaya Coretax: PPN Keluaran/Masukan, PPh 23, DPP PPh 21.

- **Data**: seluruh `jurnal_transaksi` via `ambilSemuaJurnalPusat()`, disaring ke
  `kode_pajak !== "NON"`. Memakai `CONFIG.TAX_RATES` (`PPN_EFEKTIF` 11%, `PPH23_JASA`
  2%) dari `js/config.js`. Tidak menulis.
- **Fitur**: filter masa pajak; heuristik arah PPN (Keluaran jika akun Pendapatan
  dikredit, selain itu Masukan); kartu rekap (PPN Keluaran/Masukan/Kurang-Lebih Bayar,
  PPh 23, DPP PPh 21); tabel dikelompokkan per masa pajak; tata letak cetak berjenjang.

## `profil-pajak.html` — Profil & Parameter Pajak

**Controller**: **tidak ada file `*-page.js` terpisah** — logikanya berupa
`<script type="module">` inline langsung di dalam `profil-pajak.html`, hanya memuat
`js/component.js` untuk sidebar/header bersama.
**Peran**: SA · A · AK (Auditor diblokir di level path)

Identitas legal perusahaan + referensi statis tarif pajak Coretax.

- **Data**: `pengaturan/profil_perusahaan` (baca/tulis nomor_akta, tanggal_akta,
  npwp_perseroan, status_pkp).
- **Fitur**: form edit identitas legal; tabel referensi tarif PPh Badan/PPN saat ini
  (statis, tertulis langsung di HTML, tidak tersimpan di database).

## `rekonsiliasi.html` — Laporan Arus Kas

**Controller**: `js/fiscal-page.js`
**Peran**: SA · A · AK · AU

> **Catatan penamaan**: nama file (`rekonsiliasi`) dan ikon sidebar-nya menyiratkan fitur
> "rekonsiliasi bank", tapi judul halaman, seluruh isinya, dan komentar di baris pertama
> `js/fiscal-page.js` ("Controller untuk rekonsiliasi.html (Laporan Arus Kas)") dengan
> jelas menyebutnya **Laporan Arus Kas (Cash Flow Statement)**. Ini bukan bug — memang
> tidak ada fitur rekonsiliasi bank terpisah di aplikasi ini; nama file/ikon sekadar sisa
> penamaan awal yang tidak diubah.

Mengklasifikasikan mutasi akun kas/bank (kode berawalan "11") ke Aktivitas
Operasi/Investasi/Pendanaan.

- **Data**: seluruh `jurnal_transaksi` via `ambilSemuaJurnalPusat()`. Tidak menulis.
- **Fitur**: filter periode; 4 kartu ringkasan (Operasi/Investasi/Pendanaan/perubahan
  neto); tabel detail + kartu mobile jurnal yang menyentuh kas dengan badge kategori;
  ekspor CSV; tata letak cetak berjenjang dengan Kas Awal/Akhir Periode
  (`susunStrukturArusKas` di `accounting.js`). Heuristik klasifikasi
  (`kalkulasiArusKas()`): akun lawan berkode "15"/"16" → Investasi; akun Ekuitas atau
  nama mengandung "pinjaman"/"kredit bank"/"obligasi" → Pendanaan; selain itu → Operasi.

## `branding.html` — Pengaturan Branding

**Controller**: `js/branding-page.js`
**Peran**: SA saja

Pengaturan logo & favicon aplikasi.

- **Data**: `pengaturan_sistem/branding` (logoUrl/faviconUrl sebagai data URI base64).
- **Fitur**: pemilih berkas dengan pratinjau langsung untuk logo dan favicon; gerbang
  peran tambahan di level JS (redirect ke `/index` dengan alert jika bukan Super Admin),
  bukan hanya disembunyikan dari menu.

## `users.html` — Manajemen Pengguna

**Controller**: `js/users-page.js`
**Peran**: SA saja (Admin pun diblokir di level path — fitur ini eksklusif Super Admin)

Manajemen pengguna & peran (RBAC).

- **Data**: CRUD `users` (ID dokumen = email).
- **Fitur**: form tambah pengguna (email + pilihan role) yang **sekaligus**
  menulis dokumen role Firestore **dan** membuat akun Firebase Auth sungguhan (lewat
  instance Firebase kedua/sementara, agar sesi Super Admin yang sedang login tidak
  terganggu), lalu mengirim email reset password; jika akun sudah ada, cukup kirim ulang
  email reset; tabel daftar pengguna dengan badge warna per role; "Cabut Akses"
  menghapus dokumen `users` (tidak menghapus akun Firebase Auth-nya).

## `profile.html` — Profil Saya

**Controller**: `js/profile-page.js`
**Peran**: semua pengguna terautentikasi (di luar `menuGroups` utama — diakses lewat
baris profil di sidebar/header)

Profil & keamanan akun milik pengguna yang sedang login.

- **Data**: `users/{email}` (perbarui nama tampilan via merge).
- **Fitur**: dua tab (Informasi Akun / Keamanan); editor nama tampilan (menulis ke
  Firestore + memperbarui `sessionStorage`); form ganti password via Firebase Auth
  `updatePassword` (menangani error `auth/requires-recent-login` dengan meminta
  re-autentikasi).
