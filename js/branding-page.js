// js/branding-page.js - Controller Branding (Anti Gagal & Reset Input Otomatis)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { CONFIG, db } from "./config.js";
import { ambilUserAktif } from "./auth.js";

const app = initializeApp(CONFIG.FIREBASE_CONFIG);

// Jalankan skrip saat halaman siap
document.addEventListener("DOMContentLoaded", async function() {
    const user = ambilUserAktif();
    if (user.role !== "Super Admin") {
        alert("⚠️ Akses Dibatasi: Halaman ini khusus untuk Super Admin.");
        window.location.href = "/index";
        return;
    }

    await muatPengaturanBrandingSaatIni();
    inisialisasiForm();
});

function inisialisasiForm() {
    const form = document.getElementById("formBranding");
    const logoInput = document.getElementById("inputFileLogo");
    const faviconInput = document.getElementById("inputFileFavicon");
    const previewLogo = document.getElementById("previewLogo");
    const previewFavicon = document.getElementById("previewFavicon");
    const notif = document.getElementById("notifikasiBranding");
    const btn = document.getElementById("btnSimpanBranding");

    // TRIK PERAMBAN: Reset nilai input saat diklik agar memilih file yang sama tetap memicu pratinjau
    if (logoInput) {
        logoInput.addEventListener("click", function() { this.value = null; });
        logoInput.addEventListener("change", function(e) {
            const file = e.target.files[0];
            if (file) {
                bacaFileKeBase64(file).then(base64 => {
                    previewLogo.src = base64;
                    previewLogo.style.display = "block";
                }).catch(err => alert("Gagal membaca file gambar."));
            }
        });
    }

    if (faviconInput) {
        faviconInput.addEventListener("click", function() { this.value = null; });
        faviconInput.addEventListener("change", function(e) {
            const file = e.target.files[0];
            if (file) {
                bacaFileKeBase64(file).then(base64 => {
                    previewFavicon.src = base64;
                    previewFavicon.style.display = "block";
                }).catch(err => alert("Gagal membaca file gambar."));
            }
        });
    }

    if (form) {
        form.addEventListener("submit", async function(e) {
            e.preventDefault();

            const fileLogo = logoInput.files[0];
            const fileFavicon = faviconInput.files[0];

            if (!fileLogo && !fileFavicon) {
                tampilkanNotif(notif, "⚠️ Harap pilih file logo atau favicon dari komputer Anda.", "red");
                return;
            }

            btn.disabled = true;
            btn.innerText = "Memproses & Menyimpan...";

            try {
                const payload = { updatedAt: new Date().toISOString() };

                if (fileLogo) payload.logoUrl = await bacaFileKeBase64(fileLogo);
                if (fileFavicon) payload.faviconUrl = await bacaFileKeBase64(fileFavicon);

                const brandingRef = doc(db, "pengaturan_sistem", "branding");
                await setDoc(brandingRef, payload, { merge: true });

                tampilkanNotif(notif, "✅ Berhasil disimpan! Memuat ulang sistem...", "green");
                setTimeout(() => window.location.reload(), 1500);

            } catch (err) {
                console.error("Gagal menyimpan:", err);
                tampilkanNotif(notif, "❌ Gagal menyimpan: " + err.message, "red");
                btn.disabled = false;
                btn.innerText = "💾 Simpan & Terapkan Perubahan";
            }
        });
    }
}

function bacaFileKeBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

async function muatPengaturanBrandingSaatIni() {
    try {
        const docSnap = await getDoc(doc(db, "pengaturan_sistem", "branding"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            const previewLogo = document.getElementById("previewLogo");
            const previewFavicon = document.getElementById("previewFavicon");

            // Pastikan data yang ditarik adalah format gambar yang sah
            if (data.logoUrl && data.logoUrl.startsWith("data:image")) {
                previewLogo.src = data.logoUrl;
                previewLogo.style.display = "block";
            }
            if (data.faviconUrl && data.faviconUrl.startsWith("data:image")) {
                previewFavicon.src = data.faviconUrl;
                previewFavicon.style.display = "block";
            }
        }
    } catch (err) {
        console.error("Gagal memuat branding:", err);
    }
}

function tampilkanNotif(el, text, color) {
    if (!el) return;
    el.classList.remove("hidden", "bg-red-50", "text-red-700", "border-red-200", "bg-green-50", "text-green-700", "border-green-200");
    el.innerText = text;
    if (color === "red") {
        el.classList.add("bg-red-50", "text-red-700", "border-red-200");
    } else {
        el.classList.add("bg-green-50", "text-green-700", "border-green-200");
    }
}
