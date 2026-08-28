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

// Mencegah CSV/Formula Injection: jika nilai teks diawali =, +, -, atau @,
// Excel/Sheets bisa menafsirkannya sebagai formula saat file CSV dibuka.
export function amankanSelCsv(nilai) {
    const teks = String(nilai ?? '');
    return /^[=+\-@]/.test(teks) ? "'" + teks : teks;
}

// Memicu unduhan file CSV dari daftar baris (array of array) di browser.
export function unduhCsv(namaFile, headerKolom, rows) {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headerKolom.join(",") + "\r\n";
    rows.forEach(row => {
        csvContent += row.join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", namaFile);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
