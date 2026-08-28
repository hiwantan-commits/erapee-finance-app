// js/tema-tailwind-config.js
// Konfigurasi Tailwind CDN terpusat untuk halaman bertema "elegant", supaya
// perubahan konfigurasi (mis. menambah warna kustom di masa depan) cukup
// dilakukan di SATU file, tidak perlu disalin ke tiap halaman.
//
// PENTING: file ini HARUS dimuat lewat <script src="..."> SETELAH tag
// <script src="https://cdn.tailwindcss.com">, karena bergantung pada objek
// global `tailwind` yang baru tersedia setelah CDN tersebut selesai
// dieksekusi.
tailwind.config = { darkMode: 'class' };
