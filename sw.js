// sw.js - Service worker minimal, khusus syarat teknis agar aplikasi bisa
// di-"Instal" (Add to Home Screen / instal ke desktop) lewat browser.
//
// SENGAJA TIDAK melakukan caching apa pun. Aplikasi ini bergantung penuh
// pada data live Firestore (saldo, jurnal, status tutup buku, dsb) dan
// validasi real-time saat menyimpan transaksi (duplikat No. Bukti, kunci
// periode akuntansi - lihat js/db.js). Meng-cache halaman/skrip lama
// berisiko menyajikan versi aplikasi yang sudah usang, atau memutus
// konsistensi antara apa yang dilihat pengguna dan apa yang sungguh-sungguh
// tersimpan di server. Setiap fetch tetap diteruskan langsung ke jaringan
// seperti biasa - tidak ada mode offline.
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});
