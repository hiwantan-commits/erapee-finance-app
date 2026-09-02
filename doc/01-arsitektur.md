# Arsitektur & Teknologi

## Stack Teknologi

| Lapisan | Teknologi |
|---|---|
| Markup & styling | HTML statis + [Tailwind CSS](https://tailwindcss.com) via CDN (`cdn.tailwindcss.com`), ditambah `css/style.css` untuk gaya kustom (mis. animasi, dropdown, cetak) |
| Logika halaman | JavaScript modul native (`<script type="module">`), tanpa bundler/transpiler, tanpa framework (tidak ada React/Vue/dsb) |
| Grafik | [Chart.js](https://www.chartjs.org) via CDN, dipakai di Dashboard & Analisa Bisnis |
| Database | Firebase Firestore (NoSQL, koleksi/dokumen) |
| Autentikasi | Firebase Authentication (email/password) |
| Hosting | Vercel (situs statis) |
| PWA (installable) | `manifest.json` + `sw.js` — lihat [Dukungan PWA](#dukungan-pwa-installable) di bawah |
| Backup terjadwal | GitHub Actions + Google Drive API (lihat [06-deployment-operasional.md](06-deployment-operasional.md)) |

Tidak ada `package.json` di root repo secara sengaja — lihat komentar di
`scripts/backup-ke-drive.mjs`: kehadiran `package.json` berisiko membuat Vercel mengubah
cara proyek di-deploy dari "situs statis murni" menjadi "proyek Node.js".

## Struktur Folder

```
/                     - Setiap file .html adalah satu halaman aplikasi (lihat 03-halaman.md)
├── manifest.json     - Manifest PWA (nama, ikon, warna, mode tampilan "standalone")
├── sw.js             - Service worker minimal, hanya untuk syarat instalasi (lihat di bawah)
├── icons/            - Ikon PWA (icon-192.png, icon-512.png, apple-touch-icon.png)
├── css/
│   └── style.css     - Gaya kustom di luar Tailwind (dropdown, animasi, gaya cetak, dll)
├── js/                - Seluruh logika aplikasi, satu modul ES per file
│   ├── config.js      - Inisialisasi Firebase + konfigurasi terpusat (lihat di bawah)
│   ├── db.js          - Lapisan akses data jurnal_transaksi + audit trail otomatis
│   ├── auth.js        - Sesi login (sessionStorage) & penegakan RBAC per-path
│   ├── component.js   - Sidebar, header, menu, toggle dark mode, branding dinamis
│   ├── accounting.js  - Seluruh logika akuntansi (lihat 04-modul-akuntansi.md)
│   ├── utils.js        - escapeHtml, amankanSelCsv, unduhCsv
│   ├── coa-autocomplete.js   - Widget dropdown pencarian akun (dipakai bersama)
│   ├── transaksi-picker.js  - Widget "Isi Otomatis dari Transaksi" (dipakai bersama)
│   ├── terbilang.js    - Angka Rupiah -> teks (untuk kwitansi)
│   ├── closing-period.js    - Cek/tetapkan status tutup buku bulanan
│   ├── invoice-db.js   - Lapisan akses data invoice_penjualan (modul berdiri sendiri)
│   ├── recurring-db.js - Lapisan data & orkestrasi Jurnal Berulang
│   ├── tema-fouc-init.js       - Terapkan dark mode sebelum render pertama (anti-flash)
│   ├── tema-tailwind-config.js - Konfigurasi Tailwind CDN (darkMode: 'class')
│   ├── pwa-register.js - Mendaftarkan sw.js di setiap halaman
│   ├── pwa-icon.js     - Menyelaraskan ikon PWA dengan favicon dinamis Branding
│   └── *-page.js       - Satu controller per halaman (lihat 03-halaman.md)
├── scripts/
│   └── backup-ke-drive.mjs  - Skrip backup Firestore -> Google Drive (dijalankan GitHub Actions)
├── .github/workflows/
│   └── backup-drive.yml     - Jadwal cron harian untuk skrip backup
├── firestore.rules   - Aturan keamanan Firestore (harus di-paste manual ke Firebase Console)
└── vercel.json        - Konfigurasi hosting Vercel (cleanUrls, trailingSlash)
```

## Alur Pemuatan Setiap Halaman

Semua halaman (kecuali `login.html`) mengikuti pola HTML yang sama:

```html
<script src="js/tema-fouc-init.js"></script>           <!-- sebelum <body>, cegah flash tema -->
<script src="https://cdn.tailwindcss.com"></script>
<script src="js/tema-tailwind-config.js"></script>
...
<body class="auth-pending" data-tema="elegant">          <!-- data-tema opsional, lihat di bawah -->
  <div id="sidebar-container"></div>
  <div id="header-container"></div>
  <!-- konten halaman -->
  <script type="module" src="js/<nama-halaman>-page.js"></script>  <!-- logika khusus halaman -->
  <script type="module" src="js/component.js"></script>            <!-- WAJIB, render sidebar/header + cek sesi -->
</body>
```

Urutan penting:

1. `js/tema-fouc-init.js` (script biasa, bukan modul) membaca `localStorage.erapee_tema` dan
   langsung menambah class `dark` ke `<html>` **sebelum** apa pun dirender, mencegah kedipan
   dari tema terang ke gelap saat halaman pertama kali dimuat.
2. `js/component.js` berjalan di setiap halaman: memanggil `cekSesiLogin()` (dari
   `auth.js`) untuk validasi sesi & RBAC, lalu — via `onAuthStateChanged` Firebase Auth —
   merender sidebar (`muatSidebarAndBranding()`) dan header (`muatHeader()`), sekaligus
   menghapus class `auth-pending` dari `<body>` (dipakai CSS untuk menyembunyikan konten
   sampai sesi terverifikasi, mencegah "kedipan" halaman terlarang sebelum redirect terjadi).
3. Controller khusus halaman (mis. `js/journal-page.js`) berjalan secara independen,
   biasanya di dalam listener `DOMContentLoaded`, dan bertanggung jawab penuh atas logika
   & data halaman tersebut.

## Dua Mode Tema: "Klasik" vs "Elegant"

`js/component.js` mendukung dua gaya visual sidebar/header sekaligus, dipilih per halaman
lewat atribut `<body data-tema="elegant">`:

- **Klasik** (tanpa atribut): sidebar putih dengan aksen warna indigo, ikon emoji di menu,
  tidak mendukung dark mode.
- **Elegant** (`data-tema="elegant"`): gaya minimalis netral terinspirasi Claude.ai/Vercel,
  mendukung dark mode penuh, ikon berupa SVG garis (`PETA_IKON_ELEGANT` di `component.js`)
  bukan emoji.

Rollout dilakukan bertahap per halaman tanpa mengubah tampilan halaman yang belum
"disetujui" — jadi pada satu titik waktu, sebagian halaman bisa memakai gaya klasik dan
sebagian lain gaya elegant. Toggle dark mode (`window.toggleDarkMode()`) menyimpan
preferensi ke `localStorage.erapee_tema` dan memancarkan event `erapee-tema-berubah` yang
didengarkan oleh halaman yang perlu merender ulang chart/warna (mis. Dashboard, Analisa
Bisnis) saat tema berganti.

## Menu & Navigasi

Struktur menu sidebar (grup dan urutan item) didefinisikan satu tempat: array
`menuGroups` di `js/component.js` (fungsi `muatSidebarAndBranding()`). Lima grup menu:

1. **Utama** — Dashboard & Audit
2. **Akuntansi & Transaksi** — COA & Master Data, Input Jurnal, Buku Besar & Jurnal,
   Invoice & Kwitansi, Jurnal Berulang (Draft)
3. **Pajak & Aset** — Profil & Param Pajak, Aset Tetap, Sewa Dibayar Dimuka, Rekapitulasi
   PPN & PPh, Laporan Arus Kas (`href: 'rekonsiliasi'` — lihat catatan penamaan di
   [03-halaman.md](03-halaman.md))
4. **Laporan & Analisis** — Laporan Keuangan, Analisis Bisnis, Histori Audit
5. **Administrasi Sistem** — Pengaturan Branding, Manajemen Pengguna, Tutup Buku Bulanan

Setiap item menu punya daftar `roles` sendiri yang menentukan visibilitasnya — lihat
[05-rbac-keamanan.md](05-rbac-keamanan.md) untuk tabel akses lengkap per peran.

Halaman `profile.html` (profil akun milik pengguna sendiri) sengaja **tidak** masuk
`menuGroups` — diakses lewat baris profil di bagian bawah sidebar / tautan nama pengguna di
header, bukan lewat navigasi menu utama.

## Dukungan PWA (Installable)

Aplikasi bisa di-"Instal" lewat browser (Chrome/Edge: ikon instal di address bar atau
menu "Instal Aplikasi"; Android: "Add to Home Screen"; iOS Safari: "Add to Home Screen"
lewat menu Share) sehingga terbuka tanpa chrome browser, dengan ikon sendiri di
homescreen/desktop — persis seperti aplikasi native. Tiga berkas pendukungnya:

- **`manifest.json`** (di root) — nama aplikasi, ikon (`icons/icon-192.png`,
  `icons/icon-512.png`), warna tema (`#D97757`, aksen terracotta yang sama dipakai
  avatar sidebar), dan `display: "standalone"`. Ditautkan di `<head>` setiap halaman
  lewat `<link rel="manifest" href="/manifest.json">`.
- **`sw.js`** (di root) — service worker, didaftarkan oleh `js/pwa-register.js` di
  setiap halaman.
- **`icons/apple-touch-icon.png`** — ikon khusus iOS Safari (tidak dibaca dari
  `manifest.json`, harus `<link rel="apple-touch-icon">` terpisah).

Ketiga berkas ikon statis di atas (`icon-192.png`, `icon-512.png`,
`apple-touch-icon.png`) hanyalah **fallback default** (monogram "E" di atas warna aksen
aplikasi). Jika Super Admin sudah mengunggah favicon kustom lewat halaman Branding
(`pengaturan_sistem/branding.faviconUrl`, lihat [03-halaman.md](03-halaman.md)), ikon
PWA otomatis ikut mengikuti favicon tersebut — bukan tetap memakai file statis yang
sudah usang. Ini ditangani `js/pwa-icon.js`
(`terapkanIkonPwaDariBranding(faviconDataUri)`), dipanggil dari `js/component.js` dan
`js/login-page.js` tepat setelah keduanya membaca `faviconUrl` untuk mengganti
`<link rel="icon">` tab browser:

1. Mengganti `href` pada `<link rel="apple-touch-icon">` yang sudah ada di halaman
   dengan favicon (data URI base64) yang sama.
2. Mengambil `manifest.json` statis sebagai kerangka, mengganti hanya array `icons`-nya
   dengan favicon yang sama (`sizes: "any"` — resolusi asli favicon unggahan tidak
   diketahui di sisi klien, jadi tidak mengklaim ukuran piksel tertentu), lalu
   membungkusnya jadi `Blob` dan menukar `href` pada `<link rel="manifest">` ke Blob URL
   tersebut.

Jika belum ada favicon kustom (`faviconUrl` kosong), `terapkanIkonPwaDariBranding()`
langsung kembali tanpa melakukan apa pun — ketiga berkas statis di atas tetap berlaku
sebagai default.

> ⚠️ **Jebakan yang sudah pernah terjadi**: kode lama yang mencari tag favicon
> (`document.querySelector("link[rel*='icon']")`, di `js/component.js` &
> `js/login-page.js`) awalnya memakai pencocokan **substring** pada atribut `rel` —
> ini secara tidak sengaja ikut mencocokkan `<link rel="apple-touch-icon">` (karena
> mengandung kata "icon" juga), sehingga tag apple-touch-icon diam-diam berubah rel-nya
> jadi `"icon"` dan href-nya tertimpa. Sudah diperbaiki menjadi pencocokan **persis**
> (`link[rel='icon']`). Jika suatu saat menambah tag `<link rel="...">` baru yang
> mengandung kata "icon" di `<head>`, pastikan tidak mengulang jebakan yang sama.

> **Keputusan desain penting — TIDAK ada mode offline.** `sw.js` sengaja
> **tidak melakukan caching apa pun** — setiap `fetch` diteruskan langsung ke jaringan
> persis seperti tanpa service worker. Ini disengaja: aplikasi bergantung penuh pada
> data live Firestore dan validasi real-time saat menyimpan transaksi (duplikat No.
> Bukti, kunci periode tutup buku — lihat [04-modul-akuntansi.md](04-modul-akuntansi.md)).
> Meng-cache HTML/JS/data akan berisiko menyajikan versi aplikasi yang sudah usang ke
> pengguna yang sudah meng-install PWA-nya, atau memutus konsistensi antara yang
> terlihat di layar dengan yang sungguh-sungguh tersimpan di server. Kehadiran service
> worker ini semata memenuhi syarat teknis browser untuk menampilkan prompt instalasi —
> bukan untuk kemampuan bekerja tanpa koneksi internet. Menambahkan caching di kemudian
> hari (mis. app-shell caching untuk aset statis yang jarang berubah) memerlukan strategi
> invalidasi cache yang hati-hati agar tidak mengulang masalah "versi usang" ini.

### Polesan Tampilan "App-Native" (tanpa mengubah arsitektur)

Beberapa detail ditambahkan lewat meta tag & CSS murni (tanpa mengubah struktur
halaman) agar aplikasi yang sudah ter-instal terasa lebih seperti aplikasi native saat
dijalankan di perangkat sentuh, terutama iPhone dengan notch/Dynamic
Island/home-indicator:

- `viewport-fit=cover` pada `<meta name="viewport">` + `apple-mobile-web-app-status-bar-style: "black-translucent"` — membuat konten menggambar penuh sampai ke tepi layar (di belakang status bar), alih-alih menyisakan bilah hitam polos di atas seperti halaman web biasa.
- `#header-container { padding-top: env(safe-area-inset-top) }` dan `#app-sidebar { padding-bottom: env(safe-area-inset-bottom) }` (di `css/style.css`) — mengimbangi `viewport-fit=cover` di atas supaya header tidak tertutup notch dan baris profil paling bawah sidebar tidak tertutup home-indicator. `env(safe-area-inset-*)` bernilai `0` di perangkat tanpa notch (termasuk semua browser desktop), jadi berlaku aman secara global tanpa efek samping di perangkat lain.
- `mobile-web-app-capable` & `apple-mobile-web-app-capable` — sinyal eksplisit ke Android/iOS bahwa halaman ini dirancang untuk mode `standalone` (sebagian browser lama mengandalkan tag ini, bukan hanya `manifest.json`).
- `apple-mobile-web-app-title` — nama pendek ("ERAPEE Finance") yang tampil di bawah ikon home screen iOS, terpisah dari `<title>` halaman yang lebih panjang.
- `overscroll-behavior-y: contain` pada `body` — mematikan efek "rubber-band"/pull-to-refresh bawaan browser saat men-scroll sampai ujung halaman (kontainer scroll internal seperti tabel/dropdown tidak terpengaruh, karena masing-masing sudah punya `overflow-y` sendiri).
- `-webkit-tap-highlight-color: transparent` pada `html` — menghilangkan highlight abu-abu bawaan saat elemen disentuh di layar sentuh.

**Yang sengaja TIDAK termasuk** dalam polesan ini (dianggap perubahan arsitektur, bukan
polesan): splash screen kustom per-perangkat (`apple-touch-startup-image`, perlu banyak
ukuran gambar per model iPhone/iPad — Android sudah otomatis membuatnya sendiri dari
`manifest.json`), dan transisi mulus antar halaman ala Single Page App — aplikasi ini
tetap multi-halaman (`.html` terpisah dengan reload penuh browser tiap pindah menu),
sehingga akan selalu ada jeda/kedip singkat saat navigasi; menghilangkannya memerlukan
migrasi arsitektur ke SPA yang jauh lebih besar cakupannya.
