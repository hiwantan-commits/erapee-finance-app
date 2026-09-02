# RBAC & Keamanan

## Empat Peran Pengguna

| Peran | Deskripsi singkat |
|---|---|
| **Super Admin** | Akses penuh tanpa batasan — satu-satunya peran yang bisa mengelola pengguna (`users.html`) dan branding (`branding.html`). |
| **Admin** | Manajemen keuangan penuh, termasuk Tutup Buku, tapi **tidak** bisa mengelola pengguna atau branding. |
| **Akuntan** | Operasional harian penuh (input jurnal, master data, aset, sewa, invoice, jurnal berulang), **tidak** bisa Tutup Buku atau mengelola pengguna. |
| **Auditor** | **Read-only** di seluruh aplikasi — hanya bisa melihat, mencetak, dan mengekspor; tidak pernah punya akses tulis di halaman mana pun. |

Peran disimpan di dokumen `users/{email}` (field `role`), dan disalin ke sesi
`sessionStorage` saat login (`erapee_user_session`) supaya tidak perlu query Firestore
berulang kali untuk cek peran di setiap render UI.

## Dua Lapis Penegakan RBAC di Sisi Klien

Karena ini situs statis tanpa server aplikasi, RBAC di sisi klien murni bersifat **UX**
(mencegah pengguna sah tersasar ke halaman yang bukan haknya) — **bukan** lapisan
keamanan sungguhan. Keamanan data yang sebenarnya sepenuhnya bergantung pada
`firestore.rules` (lihat di bawah). Ada dua mekanisme klien yang saling melengkapi:

### 1. Visibilitas Menu (`js/component.js` — `menuGroups`)

Setiap item menu punya daftar `roles` sendiri; item yang perannya tidak cocok dengan
peran pengguna aktif tidak dirender sama sekali di sidebar.

### 2. Blokir Path (`js/auth.js` — `terapkanBatasanAksesRole()`)

Dipanggil di **setiap** pemuatan halaman (lewat `cekSesiLogin()`, dijalankan otomatis
saat modul `auth.js` di-`import`). Memeriksa `window.location.pathname` secara eksplisit
dan me-redirect + menampilkan `alert()` jika peran tidak berhak — proteksi ini tetap
berlaku **meski pengguna mengetik URL secara langsung**, tidak hanya mengandalkan menu
yang disembunyikan:

| Peran | Path yang diblokir |
|---|---|
| Auditor | `input-jurnal`, `master-data`, `closing`, `users`, `profil-pajak`, `jurnal-berulang` |
| Akuntan | `closing`, `users` |
| Admin | `users` |
| Super Admin | *(tidak ada pembatasan)* |

### Tabel Akses Lengkap per Halaman

| Halaman (href) | Super Admin | Admin | Akuntan | Auditor |
|---|:-:|:-:|:-:|:-:|
| `index` (Dashboard) | ✓ | ✓ | ✓ | ✓ |
| `master-data` | ✓ | ✓ | ✓ | ✗ |
| `input-jurnal` | ✓ | ✓ | ✓ | ✗ (blokir path) |
| `manajemen` (Buku Besar) | ✓ | ✓ | ✓ | ✓ |
| `invoice` / `invoice-baru` | ✓ | ✓ | ✓ | ✓ (lihat/cetak saja, disembunyikan di halaman) |
| `jurnal-berulang` | ✓ | ✓ | ✓ | ✗ (blokir path) |
| `profil-pajak` | ✓ | ✓ | ✓ | ✗ (blokir path) |
| `aset-tetap` / `sewa` | ✓ | ✓ | ✓ | ✓ (lihat saja, form & menu aksi disembunyikan) |
| `pajak` | ✓ | ✓ | ✓ | ✓ |
| `rekonsiliasi` (Arus Kas) | ✓ | ✓ | ✓ | ✓ |
| `laporan` | ✓ | ✓ | ✓ | ✓ |
| `analisa-bisnis` | ✓ | ✓ | ✓ | ✓ |
| `histori` | ✓ | ✓ | ✓ | ✓ |
| `branding` | ✓ | ✗ | ✗ | ✗ (blokir path via JS di halaman itu sendiri) |
| `users` | ✓ | ✗ (blokir path) | ✗ | ✗ |
| `closing` | ✓ | ✓ | ✗ (blokir path) | ✗ (blokir path) |
| `profile` | semua pengguna terautentikasi (di luar menu utama) |

Untuk halaman yang tetap bisa diakses Auditor tapi memuat form input (Aset Tetap, Sewa,
Invoice), pendekatannya bukan blokir seluruh halaman, tapi **menyembunyikan form &
tombol aksi tulis di dalam halaman itu sendiri** — Auditor tetap perlu melihat data
(mis. skedul penyusutan, daftar invoice) sebagai bagian dari tugas audit mereka.

> **Pengecualian yang diketahui**: halaman `manajemen` (Buku Besar & Jurnal) **belum**
> menerapkan pola sembunyikan-tombol ini — tombol Edit/Hapus tetap tampil untuk Auditor.
> Ini bukan celah keamanan (`firestore.rules` tetap menolak tulisannya di server), hanya
> inkonsistensi UX dibanding halaman lain. Lihat catatan di
> [03-halaman.md](03-halaman.md#manajemenhtml--buku-besar--jurnal).

## `firestore.rules` — Satu-Satunya Penegakan Keamanan Sungguhan

Karena aplikasi ini murni klien (tidak ada server backend), **`firestore.rules` adalah
satu-satunya tempat yang benar-benar mencegah pengguna tidak berwenang membaca/menulis
data**, terlepas dari apa pun yang dilakukan JavaScript di browser.

> ⚠️ **Penting untuk operasional**: mem-push perubahan `firestore.rules` ke GitHub/Vercel
> **tidak** mengubah rules yang aktif di Firestore — Vercel hanya meng-host file statis.
> Perubahan pada file ini harus di-**paste manual ke Firebase Console** (Firestore
> Database → Rules → Publish) atau di-deploy lewat Firebase CLI
> (`firebase deploy --only firestore:rules`).

### Helper RBAC di dalam Rules

```
function rolePenggunaSaatIni() {
  return sudahLogin() && emailSaatIni() == "hi.wantan@gmail.com"
    ? "Super Admin"
    : (sudahLogin() && exists(/databases/$(database)/documents/users/$(emailSaatIni()))
        ? get(/databases/$(database)/documents/users/$(emailSaatIni())).data.role
        : null);
}
```

Role pengguna dibaca **langsung dari dokumen `users/{email}`** oleh rules itu sendiri
(bukan dipercaya begitu saja dari klien) — skema ID dokumen koleksi `users` memang harus
berupa email mentah pengguna, karena itulah cara rules ini mencarinya. Ada pengecualian
bootstrap: email `hi.wantan@gmail.com` selalu dianggap Super Admin walau belum punya
dokumen `users` (lihat catatan di [02-struktur-data.md](02-struktur-data.md)).

Empat fungsi turunan: `adalahSuperAdmin()`, `adalahAdminKeAtas()` (SA+Admin),
`adalahOperator()` (SA+Admin+Akuntan — boleh input/ubah transaksi & master data), dan
`adalahPenggunaInternal()` (keempat role — termasuk Auditor, dasar untuk hak baca).

### Aturan per Koleksi

| Koleksi | Baca | Tulis |
|---|---|---|
| `jurnal_transaksi` | Pengguna internal (4 role) | `create`/`delete`: Operator (SA/Admin/Akuntan). `update` **selalu ditolak** — aplikasi selalu hapus lalu buat baris baru saat edit, tidak pernah `update` baris jurnal langsung |
| `activity_logs` | Pengguna internal | `create`: Operator. `update`/`delete`: **selalu ditolak** — audit trail permanen, append-only |
| `bukti_transaksi` | Pengguna internal | Operator |
| `master_unit_usaha`, `master_coa`, `aset_tetap`, `sewa_dibayar_dimuka`, `draf_jurnal_berulang`, `invoice_penjualan` | Pengguna internal | Operator |
| `users` | `get` (dokumen sendiri, atau siapa pun oleh Super Admin); `list` (daftar lengkap) hanya Super Admin | `write` (ubah role/hapus) hanya Super Admin. `update` sendiri diperbolehkan **kecuali** mengubah `role` atau `email` milik sendiri — mencegah eskalasi hak akses oleh diri sendiri |
| `pengaturan_sistem` | Pengguna internal | Dokumen `branding`: Super Admin saja. Dokumen lain (Tutup Buku): Admin ke atas |
| `pengaturan` | Operator (baca **dan** tulis) | — |
| *(koleksi lain di luar daftar)* | **ditolak total** | **ditolak total** — catch-all deny di akhir file |

Baris terakhir (`match /{document=**} { allow read, write: if false; }`) memastikan
koleksi mana pun yang tidak terdaftar eksplisit **selalu ditolak**, bukan diizinkan
secara default — prinsip *default-deny*.

### Batasan yang Diketahui: Kunci Periode Tidak Ditegakkan di Rules

Sebagaimana dijelaskan di [04-modul-akuntansi.md](04-modul-akuntansi.md), pengecekan
"periode sudah tutup buku" murni logika JavaScript (`cekApakahPeriodeTerkunci()` di
`js/db.js`), **tidak** ada aturan setara di `firestore.rules`. Pengguna dengan akses
Operator yang memahami DevTools browser secara teknis bisa menembus kunci ini dengan
memanggil Firestore SDK langsung dari console. Ini adalah batasan desain yang disadari
(dicatat langsung di kode), bukan celah yang belum ditemukan — mengunci ini di level
rules memerlukan menyalin logika perbandingan tanggal ke dalam bahasa aturan Firestore,
yang belum dilakukan.

## Praktik Keamanan Lain di Kode

- **Pencegahan XSS (stored)**: `escapeHtml()` (`js/utils.js`) wajib dipakai setiap kali
  data dari Firestore dirender lewat `innerHTML` — riwayat commit mencatat perbaikan
  celah XSS tersimpan di form Edit Jurnal (`memo_baris` sebelumnya tidak di-escape).
- **Pencegahan CSV/Formula Injection**: `amankanSelCsv()` (`js/utils.js`) membubuhkan
  awalan kutip pada nilai yang dimulai `=`, `+`, `-`, atau `@` sebelum diekspor ke CSV,
  supaya Excel/Sheets tidak menafsirkannya sebagai rumus berbahaya saat file dibuka.
- **Pencegahan duplikasi No. Bukti**: `simpanJurnalPusat()` (`js/db.js`) menolak
  penyimpanan jika No. Bukti yang sama sudah dipakai transaksi lain.
- **Atomisitas tulis**: `simpanJurnalPusat()` dan `hapusJurnalPusat()` memakai
  `writeBatch()` Firestore — hapus baris lama (saat edit) dan tulis baris baru terjadi
  dalam satu operasi atomik, mencegah kondisi "setengah tersimpan" jika koneksi terputus
  di tengah proses.
- **Mencegah eskalasi hak akses oleh diri sendiri**: aturan `users/{emailId}` di
  `firestore.rules` mengizinkan pengguna memperbarui profilnya sendiri (mis. nama
  tampilan) tapi secara eksplisit menolak jika `request.resource.data.role` atau
  `.email` berubah dari nilai semula.
- **Provisioning akun terpisah dari sesi aktif**: `js/users-page.js` membuat akun
  Firebase Auth baru lewat **instance Firebase kedua/sementara**, bukan instance utama
  yang sedang dipakai Super Admin login — mencegah pembuatan akun baru secara tidak
  sengaja "membajak" sesi login Super Admin yang sedang aktif.
- **Session pakai `sessionStorage`, bukan `localStorage`**: sesi (`erapee_user_session`)
  otomatis hilang saat tab/browser ditutup, bukan bertahan lintas sesi browser.
