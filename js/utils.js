// js/utils.js - Fungsi bantu bersama lintas halaman

// Meng-escape karakter HTML berbahaya agar data dari Firestore aman
// dirender sebagai teks di dalam innerHTML (mencegah stored XSS).
export function escapeHtml(nilai) {
    if (nilai === null || nilai === undefined) return '';
    return String(nilai)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
