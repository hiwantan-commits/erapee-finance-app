// js/branding-page.js - Controller untuk pengaturan branding perusahaan
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { CONFIG, db } from "./config.js";
import { ambilUserAktif } from "./auth.js";

const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const storage = getStorage(app);

document.addEventListener("DOMContentLoaded", async function() {
    // Validasi Akses: Hanya Super Admin yang boleh akses halaman ini
    const user = ambilUserAktif();
    if (user.role !== "Super Admin") {
        alert("⚠️ Akses Dibatasi: Halaman ini khusus untuk Super Admin.");
        window.location.href = "/index";
        return;
    }

    await muatPengaturanBrandingSaatIni();

    const form = document.getElementById("formBranding");
    if (form) {
        form.addEventListener("submit", async function(e) {
            e.preventDefault();
            const btn = document.getElementById("btnSimpanBranding");
            const notif = document.getElementById("notifikasiBranding");

            btn.disabled = true;
            btn.innerText = "Mengunggah & Menyimpan...";

            try {
                const fileLogo = document.getElementById("inputFileLogo").files[0];
                const fileFavicon = document.getElementById("inputFileFavicon").files[0];

                let logoUrl = document.getElementById("previewLogo").src;
                let faviconUrl = document.getElementById("previewFavicon").src;

                // Jika ada file logo baru yang dipilih
                if (fileLogo) {
                    const logoRef = ref(storage, `branding/logo_utama_${Date.now()}`);
                    await uploadBytes(logoRef, fileLogo);
                    logoUrl = await getDownloadURL(logoRef);
                }

                // Jika ada file favicon baru yang dipilih
                if (fileFavicon) {
                    const faviconRef = ref(storage, `branding/favicon_${Date.now()}`);
                    await uploadBytes(faviconRef, fileFavicon);
                    faviconUrl = await getDownloadURL(faviconRef);
                }

                // Simpan tautan URL ke Firestore
                const brandingRef = doc(db, "pengaturan_sistem", "branding");
                await setDoc(brandingRef, {
                    logoUrl: logoUrl,
                    faviconUrl: faviconUrl,
                    updatedAt: new Date().toISOString()
                }, { merge: true });

                tampilkanNotif(notif, "✅ Pengaturan branding berhasil diperbarui! Perubahan akan diterapkan secara global.", "green");
                await muatPengaturanBrandingSaatIni(); // DIPERBAIKI dari muatPengaturanBrandingSidang

            } catch (err) {
                console.error("Gagal menyimpan branding:", err);
                tampilkanNotif(notif, "❌ Gagal menyimpan: " + err.message, "red");
            }

            btn.disabled = false;
            btn.innerText = "💾 Simpan & Terapkan Perubahan";
        });
    }
});

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
