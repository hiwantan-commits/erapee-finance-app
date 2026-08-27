// js/branding-page.js - Controller Pengaturan Branding Final
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { CONFIG, db } from "./config.js";
import { ambilUserAktif } from "./auth.js";

const app = initializeApp(CONFIG.FIREBASE_CONFIG);

let currentLogoBase64 = "";
let currentFaviconBase64 = "";

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
                    currentLogoBase64 = base64String;
                    const preview = document.getElementById("previewLogo");
                    preview.src = base64String;
                    preview.style.display = "block";
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
                    currentFaviconBase64 = base64String;
                    const preview = document.getElementById("previewFavicon");
                    preview.src = base64String;
                    preview.style.display = "block";
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

            if (!currentLogoBase64 && !currentFaviconBase64) {
                tampilkanNotif(notif, "⚠️ Harap pilih file logo atau favicon baru terlebih dahulu.", "red");
                return;
            }

            btn.disabled = true;
            btn.innerText = "Menyimpan ke Database...";

            try {
                const payload = {
                    updatedAt: new Date().toISOString()
                };
                if (currentLogoBase64) payload.logoUrl = currentLogoBase64;
                if (currentFaviconBase64) payload.faviconUrl = currentFaviconBase64;

                const brandingRef = doc(db, "pengaturan_sistem", "branding");
                await setDoc(brandingRef, payload, { merge: true });

                tampilkanNotif(notif, "✅ Berhasil! Memuat ulang sistem...", "green");
                
                setTimeout(() => {
                    window.location.reload();
                }, 1200);

            } catch (err) {
                console.error("Gagal menyimpan branding:", err);
                tampilkanNotif(notif, "❌ Gagal menyimpan: " + err.message, "red");
                btn.disabled = false;
                btn.innerText = "💾 Simpan & Terapkan Perubahan";
            }
        });
    }
});

function konversiKeBase64(file, callback) {
    const reader = new FileReader();
    reader.onload = function(uploadEvent) {
        callback(uploadEvent.target.result);
    };
    reader.readAsDataURL(file);
}

async function muatPengaturanBrandingSaatIni() {
    try {
        const docSnap = await getDoc(doc(db, "pengaturan_sistem", "branding"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.logoUrl) {
                currentLogoBase64 = data.logoUrl;
                const pLogo = document.getElementById("previewLogo");
                if(pLogo) pLogo.src = data.logoUrl;
            }
            if (data.faviconUrl) {
                currentFaviconBase64 = data.faviconUrl;
                const pFav = document.getElementById("previewFavicon");
                if(pFav) pFav.src = data.faviconUrl;
            }
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
