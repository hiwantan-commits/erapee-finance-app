// js/branding-page.js - Controller Pengaturan Branding yang Diperbarui & Disederhanakan
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

    const form = document.getElementById("formBranding");
    if (form) {
        form.addEventListener("submit", async function(e) {
            e.preventDefault();
            const btn = document.getElementById("btnSimpanBranding");
            const notif = document.getElementById("notifikasiBranding");

            const fileLogoInput = document.getElementById("inputFileLogo").files[0];
            const fileFaviconInput = document.getElementById("inputFileFavicon").files[0];

            if (!fileLogoInput && !fileFaviconInput) {
                tampilkanNotif(notif, "⚠️ Harap pilih file logo atau favicon baru terlebih dahulu.", "red");
                return;
            }

            btn.disabled = true;
            btn.innerText = "Memproses & Menyimpan...";

            try {
                const payload = {
                    updatedAt: new Date().toISOString()
                };

                // Konversi logo utama ke Base64 jika ada file baru
                if (fileLogoInput) {
                    payload.logoUrl = await bacaFileKeBase64(fileLogoInput);
                }

                // Konversi favicon ke Base64 jika ada file baru
                if (fileFaviconInput) {
                    payload.faviconUrl = await bacaFileKeBase64(fileFaviconInput);
                }

                const brandingRef = doc(db, "pengaturan_sistem", "branding");
                await setDoc(brandingRef, payload, { merge: true });

                tampilkanNotif(notif, "✅ Berhasil disimpan! Memuat ulang sistem...", "green");
                
                setTimeout(() => {
                    window.location.reload();
                }, 1500);

            } catch (err) {
                console.error("Gagal menyimpan branding:", err);
                tampilkanNotif(notif, "❌ Gagal menyimpan: " + err.message, "red");
                btn.disabled = false;
                btn.innerText = "💾 Simpan & Terapkan Perubahan";
            }
        });
    }

    // Live Preview saat file dipilih
    document.getElementById("inputFileLogo").addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (file) {
            bacaFileKeBase64(file).then(base64 => {
                document.getElementById("previewLogo").src = base64;
            });
        }
    });

    document.getElementById("inputFileFavicon").addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (file) {
            bacaFileKeBase64(file).then(base64 => {
                document.getElementById("previewFavicon").src = base64;
            });
        }
    });
});

// Fungsi pembantu Promise untuk FileReader
function bacaFileKeBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.error = error => reject(error);
        reader.readAsDataURL(file);
    });
}

async function muatPengaturanBrandingSaatIni() {
    try {
        const docSnap = await getDoc(doc(db, "pengaturan_sistem", "branding"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.logoUrl && data.logoUrl.startsWith("data:image")) {
                document.getElementById("previewLogo").src = data.logoUrl;
            }
            if (data.faviconUrl && data.faviconUrl.startsWith("data:image")) {
                document.getElementById("previewFavicon").src = data.faviconUrl;
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
