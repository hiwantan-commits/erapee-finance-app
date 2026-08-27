// js/branding-page.js - Controller Pengaturan Branding dengan Konversi Base64 (Bebas CORS)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { CONFIG, db } from "./config.js";
import { ambilUserAktif } from "./auth.js";

const app = initializeApp(CONFIG.FIREBASE_CONFIG);

document.addEventListener("DOMContentLoaded", async function() {
    const user = ambilUserAktif();
    if (user.role !== "Super Admin") {
        alert("⚠️ Akses Dibatasi: Halaman ini khusus untuk Super Admin.");
        window.location.href = "/index";
        return;
    }

    await muatPengaturanBrandingSaatIni();

    // Handler Preview Logo Utama
    const inputLogo = document.getElementById("inputFileLogo");
    if (inputLogo) {
        inputLogo.addEventListener("change", function(e) {
            const file = e.target.files[0];
            if (file) {
                conversiKeBase64(file, function(base64String) {
                    document.getElementById("previewLogo").src = base64String;
                });
            }
        });
    }

    // Handler Preview Favicon
    const inputFavicon = document.getElementById("inputFileFavicon");
    if (inputFavicon) {
        inputFavicon.addEventListener("change", function(e) {
            const file = e.target.files[0];
            if (file) {
                conversiKeBase64(file, function(base64String) {
                    document.getElementById("previewFavicon").src = base64String;
                });
            }
        });
    }

    const form = document.getElementById("formBranding");
    if (form) {
        form.addEventListener("submit", async function(e) {
            e.preventDefault();
            const btn = document.getElementById("btnSimpanBranding");
            const notif = document.getElementById("notifikasiBranding");

            btn.disabled = true;
            btn.innerText = "Menyimpan ke Database...";

            try {
                // Ambil string Base64 dari elemen preview gambar
                let logoData = document.getElementById("previewLogo").src;
                let faviconData = document.getElementById("previewFavicon").src;

                // Validasi agar data tidak kosong
                if (!logoData || logoData.startsWith("http") && logoData.includes("404")) {
                    throw new Error("Pilih file logo utama yang valid.");
                }

                // Simpan langsung ke Firestore (koleksi pengaturan_sistem -> dokumen branding)
                const brandingRef = doc(db, "pengaturan_sistem", "branding");
                await setDoc(brandingRef, {
                    logoUrl: logoData,
                    faviconUrl: faviconData,
                    updatedAt: new Date().toISOString()
                }, { merge: true });

                tampilkanNotif(notif, "✅ Pengaturan branding berhasil disimpan! Perubahan diterapkan secara global.", "green");
            } catch (err) {
                console.error("Gagal menyimpan branding:", err);
                tampilkanNotif(notif, "❌ Gagal menyimpan: " + err.message, "red");
            }

            btn.disabled = false;
            btn.innerText = "💾 Simpan & Terapkan Perubahan";
        });
    }
});

// Fungsi pembantu untuk membaca file gambar menjadi string Base64
function konversiKeBase64(file, callback) {
    const reader = new FileReader();
    reader.onload = function(uploadEvent) {
        callback(uploadEvent.target.result);
    };
    reader.onerror = function(error) {
        console.error("Gagal membaca file:", error);
        alert("Gagal membaca file gambar.");
    };
    reader.readAsDataURL(file);
}

async function muatPengaturanBrandingSaatIni() {
    try {
        const docSnap = await getDoc(doc(db, "pengaturan_sistem", "branding"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.logoUrl) document.getElementById("previewLogo").src = data.logoUrl;
            if (data.faviconUrl) document.getElementById("previewFavicon").src = data.faviconUrl;
        }
    } catch (err) {
        console.error("Gagal memuat branding:", err);
    }
}

function tampilkanNotif(el, text, color) {
    el.classList.remove("hidden", "bg-red-50", "text-red-700", "border-red-200", "bg-green-50", "text-green-700", "border-green-200");
    el.innerText = text;
    if (color === "red") {
        el.classList.add("bg-red-50", "text-red-700", "border-red-200");
    } else {
        el.classList.add("bg-green-50", "text-green-700", "border-green-200");
    }
}
