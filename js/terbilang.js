// js/terbilang.js - Konversi angka ke teks bahasa Indonesia (untuk Kwitansi)

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];

function terbilangBagian(n) {
    if (n < 12) return SATUAN[n];
    if (n < 20) return terbilangBagian(n - 10) + ' belas';
    if (n < 100) return terbilangBagian(Math.floor(n / 10)) + ' puluh' + (n % 10 !== 0 ? ' ' + terbilangBagian(n % 10) : '');
    if (n < 200) return 'seratus' + (n % 100 !== 0 ? ' ' + terbilangBagian(n % 100) : '');
    if (n < 1000) return terbilangBagian(Math.floor(n / 100)) + ' ratus' + (n % 100 !== 0 ? ' ' + terbilangBagian(n % 100) : '');
    if (n < 2000) return 'seribu' + (n % 1000 !== 0 ? ' ' + terbilangBagian(n % 1000) : '');
    if (n < 1000000) return terbilangBagian(Math.floor(n / 1000)) + ' ribu' + (n % 1000 !== 0 ? ' ' + terbilangBagian(n % 1000) : '');
    if (n < 1000000000) return terbilangBagian(Math.floor(n / 1000000)) + ' juta' + (n % 1000000 !== 0 ? ' ' + terbilangBagian(n % 1000000) : '');
    if (n < 1000000000000) return terbilangBagian(Math.floor(n / 1000000000)) + ' miliar' + (n % 1000000000 !== 0 ? ' ' + terbilangBagian(n % 1000000000) : '');
    return terbilangBagian(Math.floor(n / 1000000000000)) + ' triliun' + (n % 1000000000000 !== 0 ? ' ' + terbilangBagian(n % 1000000000000) : '');
}

// Mengubah nominal Rupiah menjadi teks terbilang berkapital, mis. 1397000 ->
// "Satu Juta Tiga Ratus Sembilan Puluh Tujuh Ribu Rupiah". Dipakai khusus
// untuk baris "Banyaknya Uang" pada cetakan Kwitansi.
export function terbilang(angka) {
    const n = Math.round(Math.abs(angka || 0));
    if (n === 0) return 'Nol Rupiah';
    const kata = terbilangBagian(n).trim().replace(/\s+/g, ' ');
    const kapital = kata.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return kapital + ' Rupiah';
}
