# Deployment & Operasional

## Hosting: Vercel

Aplikasi di-deploy sebagai **situs statis murni** di Vercel — tidak ada proses build,
tidak ada `package.json` di root. Konfigurasi (`vercel.json`) hanya berisi:

```json
{
  "cleanUrls": true,
  "trailingSlash": false
}
```

`cleanUrls: true` memungkinkan navigasi ke `/input-jurnal` (tanpa `.html`) otomatis
menyajikan `input-jurnal.html` — inilah alasan seluruh tautan internal aplikasi
(`js/component.js`, `js/auth.js`, dsb.) ditulis tanpa ekstensi `.html`.

Deployment terjadi otomatis setiap kali branch yang terhubung di-push ke GitHub (perilaku
standar integrasi Vercel + GitHub) — tidak ada langkah build/test manual yang perlu
dijalankan sebelum deploy, karena tidak ada proses build sama sekali.

> **Sengaja tidak ada `package.json`**: menambahkannya berisiko membuat Vercel mendeteksi
> proyek sebagai aplikasi Node.js dan mengubah cara build/deploy-nya — dihindari secara
> sadar (lihat komentar di `scripts/backup-ke-drive.mjs`).

## Backend: Firebase

### Konfigurasi

Seluruh konfigurasi Firebase (API key, project ID, dst.) terpusat di `js/config.js`,
diimpor oleh setiap halaman yang butuh akses Firestore/Auth. Project ID:
`pt-erapee-finance`.

> Catatan: API key Firebase Web **bukan** rahasia yang perlu disembunyikan (berbeda dari
> API key server-side) — keamanan akses data sepenuhnya ditegakkan oleh
> `firestore.rules`, bukan dengan menyembunyikan key ini. Yang **harus** tetap rahasia
> adalah kredensial Service Account (`GOOGLE_SERVICE_ACCOUNT_KEY`) yang dipakai skrip
> backup — lihat di bawah.

### `firestore.rules` — Butuh Langkah Manual!

**Push kode ke GitHub/Vercel TIDAK men-deploy `firestore.rules`.** Vercel hanya
meng-hosting file statis; ia tidak tahu-menahu soal konfigurasi Firebase proyek. Setiap
kali `firestore.rules` diubah di repo, perubahan itu harus disalin manual ke:

- **Firebase Console** → Firestore Database → Rules → Publish, **atau**
- Firebase CLI: `firebase deploy --only firestore:rules`

Lihat [05-rbac-keamanan.md](05-rbac-keamanan.md) untuk detail lengkap isi aturan.

### Autentikasi

Firebase Authentication (metode email/password) menangani login. Peran (role) pengguna
**tidak** disimpan di Firebase Auth — hanya email & password. Peran disimpan terpisah di
dokumen Firestore `users/{email}` dan dibaca ulang setiap login (lihat
[02-struktur-data.md](02-struktur-data.md)).

Pembuatan akun pengguna baru (`users.html`) dilakukan lewat instance Firebase Auth
**kedua/sementara** di sisi klien (bukan lewat Admin SDK di server, karena memang tidak
ada server) — supaya proses provisioning akun baru tidak mengganggu sesi login Super
Admin yang sedang aktif melakukannya.

## Backup Otomatis ke Google Drive

### Alur

`.github/workflows/backup-drive.yml` menjadwalkan GitHub Actions berjalan **setiap hari
jam 19:17 UTC (02:17 WIB)**, menjalankan `scripts/backup-ke-drive.mjs` — bisa juga dipicu
manual lewat `workflow_dispatch`.

Skrip ini:

1. Login ke Firestore memakai **Service Account** (peran IAM read-only "Cloud Datastore
   Viewer") lewat JWT yang ditandatangani sendiri (RS256) — dibatasi kewenangannya lewat
   IAM Google Cloud, bukan lewat kode.
2. Login ke Google Drive memakai token **OAuth akun pengguna** (refresh token), **bukan**
   Service Account — karena Service Account tidak diberi kuota penyimpanan Drive sendiri
   oleh Google sejak pertengahan 2023 (kecuali lewat Shared Drive berbayar/Workspace,
   yang tidak tersedia untuk akun Gmail biasa). Berkas backup jadi terhitung ke kuota
   Drive pribadi pemilik refresh token, sama seperti mengunggah manual.
3. Mengambil seluruh dokumen dari koleksi berikut lewat Firestore REST API (dengan
   paginasi 300 dokumen/halaman):
   ```
   jurnal_transaksi, activity_logs, users, master_unit_usaha,
   master_coa, aset_tetap, bukti_transaksi, pengaturan, pengaturan_sistem
   ```
4. Menggabungkan semuanya jadi satu berkas JSON (`backup-erapee-YYYY-MM-DD.json`) dan
   mengunggahnya ke folder Google Drive tujuan.
5. **Rotasi otomatis**: menyimpan maksimal `MAKS_BACKUP_DISIMPAN = 30` berkas backup
   terbaru di folder tujuan — file yang lebih lama dihapus setiap kali backup baru
   sukses diunggah.

> **Celah cakupan yang perlu diperhatikan**: daftar `KOLEKSI_DIBACKUP` di skrip **belum**
> menyertakan tiga koleksi yang ditambahkan belakangan — `sewa_dibayar_dimuka`,
> `draf_jurnal_berulang`, dan `invoice_penjualan`. Data di tiga koleksi ini **tidak**
> ikut ter-backup harian sampai daftar tersebut diperbarui secara manual di
> `scripts/backup-ke-drive.mjs`.

### GitHub Secrets yang Dibutuhkan

Workflow ini memerlukan lima secret di repository GitHub (Settings → Secrets and
variables → Actions):

| Secret | Kegunaan |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | JSON key Service Account, akses baca Firestore (peran IAM "Cloud Datastore Viewer") |
| `GDRIVE_BACKUP_FOLDER_ID` | ID folder Google Drive tujuan upload backup |
| `GOOGLE_OAUTH_CLIENT_ID` | Client ID OAuth (akun pengguna, untuk akses Drive) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Client Secret OAuth pasangan di atas |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | Refresh token akun Google pemilik kuota Drive tujuan backup |

Skrip akan gagal secara eksplisit (`throw new Error`) dengan menyebutkan nama secret mana
yang belum diatur, jika salah satu dari kelimanya kosong.

### Memulihkan dari Backup

Skrip ini **hanya membuat backup**, tidak menyediakan mekanisme restore otomatis.
Memulihkan data dari salah satu berkas `backup-erapee-YYYY-MM-DD.json` di Drive perlu
dilakukan manual: unduh berkas, lalu tulis ulang setiap dokumen ke Firestore (mis. lewat
Firebase Console, `firebase firestore:import` dengan format yang sesuai, atau skrip
kustom yang membaca struktur JSON hasil backup dan menuliskannya balik lewat Firestore
REST API/Admin SDK).

## Alur Kerja Pengembangan (Git)

- Perubahan kode dikembangkan di branch fitur, diajukan sebagai Pull Request ke `main`.
- Setiap PR ditinjau lalu di-merge hanya setelah persetujuan eksplisit — tidak ada
  auto-merge.
- Tidak ada test suite otomatis (CI) di repo ini selain workflow backup — verifikasi
  perubahan sebelum PR dilakukan manual: `node --check` untuk sintaks setiap file JS yang
  diubah, ditambah pengujian end-to-end manual di browser (lokal via server statis
  sederhana, atau langsung di deployment Vercel preview).

## Checklist Setelah Mengubah Skema Data

Karena tidak ada migrasi otomatis, setiap kali menambah field/koleksi baru:

1. Field baru pada koleksi yang sudah ada harus **opsional** dengan fallback yang aman
   (`data.field || defaultValue`) — dokumen lama tanpa field tersebut tidak boleh
   menyebabkan error di halaman mana pun yang membacanya (pola yang konsisten dipakai di
   seluruh kode, mis. `aset.unit_usaha || ''`).
2. Koleksi baru perlu ditambahkan aturannya sendiri di `firestore.rules`, lalu
   **di-publish manual** ke Firebase Console (lihat di atas) — jika lupa, koleksi baru
   otomatis tertolak total oleh aturan catch-all deny di akhir file.
3. Pertimbangkan apakah koleksi baru perlu ditambahkan ke `KOLEKSI_DIBACKUP` di
   `scripts/backup-ke-drive.mjs` (lihat celah cakupan di atas).
4. Perbarui dokumentasi ini (`doc/02-struktur-data.md` khususnya) — tidak ada mekanisme
   otomatis yang menyinkronkannya dengan kode.
