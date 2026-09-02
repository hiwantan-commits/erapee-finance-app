// js/pwa-register.js - Mendaftarkan service worker (sw.js) di setiap
// halaman, murni supaya browser memenuhi syarat menawarkan "Instal
// Aplikasi". Lihat komentar di sw.js untuk alasan kenapa service worker
// ini sengaja tidak melakukan caching apa pun (bukan mode offline).
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
            console.error('Gagal mendaftarkan service worker:', err);
        });
    });
}
