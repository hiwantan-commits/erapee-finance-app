# Dokumentasi Aplikasi Keuangan PT ERAPEE Anugrah Sejahtera

Dokumentasi ini menjelaskan arsitektur, struktur data, dan seluruh halaman aplikasi
akuntansi/keuangan internal PT ERAPEE Anugrah Sejahtera. Aplikasi berupa situs statis
(HTML + JavaScript modul ES + Tailwind CSS) yang di-hosting di Vercel, dengan seluruh
data tersimpan di Firebase Firestore dan autentikasi via Firebase Authentication.

## Daftar Isi

1. [Arsitektur & Teknologi](01-arsitektur.md) — stack teknologi, struktur folder, alur load halaman, tema gelap/terang.
2. [Struktur Data Firestore](02-struktur-data.md) — seluruh koleksi database, skema field, dan relasi antar koleksi.
3. [Referensi Halaman](03-halaman.md) — daftar lengkap setiap halaman: tujuan, fitur, koleksi yang diakses.
4. [Modul Akuntansi & Logika Bisnis](04-modul-akuntansi.md) — cara kerja `js/accounting.js`: klasifikasi akun, kalkulasi Neraca/Laba Rugi/Arus Kas, penyusutan aset & amortisasi sewa, mesin Jurnal Berulang.
5. [RBAC & Keamanan](05-rbac-keamanan.md) — empat peran pengguna, aturan akses per halaman, `firestore.rules`, dan praktik keamanan lain (XSS, CSV injection, dsb).
6. [Deployment & Operasional](06-deployment-operasional.md) — cara deploy ke Vercel, konfigurasi Firebase, backup otomatis ke Google Drive, dan catatan perawatan.

## Ringkasan Singkat

- **Tidak ada proses build.** Situs murni HTML/CSS/JS statis — tidak ada `package.json` di
  root, tidak ada bundler/transpiler. Setiap file `.html` di root repo adalah satu halaman,
  memuat controller-nya sendiri lewat `<script type="module" src="js/....js">`.
- **Backend**: Firebase Firestore (database dokumen NoSQL) + Firebase Authentication
  (login email/password). Tidak ada server aplikasi kustom — semua logika bisnis berjalan
  di klien (browser), dengan `firestore.rules` sebagai satu-satunya lapisan penegakan
  keamanan sungguhan di sisi server.
- **Hosting**: Vercel (situs statis, `vercel.json` hanya mengatur `cleanUrls` &
  `trailingSlash`).
- **Domain bisnis**: pembukuan/akuntansi double-entry (jurnal umum), manajemen aset tetap
  & sewa dibayar dimuka dengan penyusutan/amortisasi otomatis, invoice & kwitansi
  penjualan, laporan keuangan (Neraca, Laba Rugi, Arus Kas, Perubahan Modal), rekap pajak
  (PPN/PPh), analisis bisnis per unit usaha, dan audit trail lengkap.
- **Bahasa**: seluruh UI, nama variabel/fungsi, dan komentar kode ditulis dalam Bahasa
  Indonesia (istilah akuntansi & pajak Indonesia dipertahankan apa adanya, mis. "Neraca",
  "Laba Rugi", "PPN", "PPh 23").

## Cara Membaca Dokumentasi Ini

Dokumen ini murni deskriptif — mencerminkan kondisi kode per commit yang tertera di bagian
bawah masing-masing file, bukan rencana atau aspirasi. Jika ada perubahan besar di kemudian
hari (menu baru, koleksi Firestore baru, aturan RBAC baru), dokumentasi ini perlu
diperbarui secara manual — tidak ada mekanisme otomatis yang menyinkronkannya dengan kode.
