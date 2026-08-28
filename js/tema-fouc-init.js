// js/tema-fouc-init.js
// Inisialisasi tema gelap/terang SEBELUM body dirender, dipakai bersama oleh
// semua halaman bertema "elegant" (lihat <body data-tema="elegant">) supaya
// perubahan logika ini cukup dilakukan di SATU file, tidak perlu disalin ke
// tiap halaman.
//
// PENTING: file ini sengaja skrip klasik (bukan type="module", tanpa async/
// defer) dan harus dimuat lewat <script src="..."> di paling awal <head>,
// SEBELUM tag Tailwind CDN - supaya benar-benar mencegah flash dari tampilan
// terang ke gelap saat halaman dimuat/reload.
(function() {
    try {
        if (localStorage.getItem('erapee_tema') === 'dark') {
            document.documentElement.classList.add('dark');
        }
    } catch (e) {}
})();
