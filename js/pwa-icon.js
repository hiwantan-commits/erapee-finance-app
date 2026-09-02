// js/pwa-icon.js - Menyelaraskan ikon PWA (ikon hasil "Instal Aplikasi" &
// ikon Add-to-Home-Screen iOS) dengan favicon dinamis yang sudah bisa
// diunggah Super Admin lewat halaman Branding (pengaturan_sistem/branding,
// dikelola js/branding-page.js). Tanpa ini, ikon PWA akan selalu memakai
// placeholder statis di folder icons/ walau favicon di tab browser sudah
// diganti - membingungkan karena tampak seperti dua identitas berbeda.
//
// Dipanggil dari js/component.js & js/login-page.js, tepat setelah kedua
// file itu selesai membaca faviconUrl dari Firestore untuk keperluannya
// sendiri (mengganti <link rel="icon">) - supaya tidak menambah query
// Firestore baru, cukup dikirimi favicon yang sudah terlanjur diambil.
export async function terapkanIkonPwaDariBranding(faviconDataUri) {
    if (!faviconDataUri) return; // kosong -> biarkan manifest.json & apple-touch-icon.png statis yang berlaku

    try {
        const jenisMime = faviconDataUri.match(/^data:([^;]+);/)?.[1] || 'image/png';

        // iOS Safari tidak membaca ikon dari manifest.json sama sekali -
        // harus lewat <link rel="apple-touch-icon"> tersendiri.
        const appleIconTag = document.querySelector('link[rel="apple-touch-icon"]');
        if (appleIconTag) appleIconTag.href = faviconDataUri;

        // manifest.json adalah berkas statis - untuk membuatnya "mengikuti"
        // favicon yang diunggah Super Admin, ambil isi manifest statis
        // sebagai kerangka (nama, warna tema, dsb tetap sama), lalu ganti
        // hanya daftar `icons`-nya dengan favicon ini sebagai Blob URL baru,
        // dan tukar href <link rel="manifest"> ke Blob URL tersebut.
        // `sizes: "any"` dipakai apa adanya (bukan mengaku "192x192"/"512x512")
        // karena resolusi asli favicon yang diunggah tidak diketahui di sini.
        const manifestDasar = await (await fetch('/manifest.json')).json();
        const manifestDinamis = {
            ...manifestDasar,
            icons: [
                { src: faviconDataUri, sizes: 'any', type: jenisMime, purpose: 'any' },
                { src: faviconDataUri, sizes: 'any', type: jenisMime, purpose: 'maskable' }
            ]
        };
        const blobManifest = new Blob([JSON.stringify(manifestDinamis)], { type: 'application/manifest+json' });
        const manifestTag = document.querySelector('link[rel="manifest"]');
        if (manifestTag) manifestTag.href = URL.createObjectURL(blobManifest);
    } catch (err) {
        console.error('Gagal menerapkan ikon PWA dari branding:', err);
        // Diamkan - manifest.json & apple-touch-icon.png statis tetap berlaku sebagai fallback
    }
}
