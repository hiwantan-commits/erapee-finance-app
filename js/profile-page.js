// js/profile-page.js - Controller untuk profile.html
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, updatePassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { CONFIG, db } from "./config.js";
import { ambilUserAktif } from "./auth.js";

const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const auth = getAuth(app);

document.addEventListener("DOMContentLoaded", function() {
    // 1. Tampilkan Data Pengguna Aktif
    const currentUser = ambilUserAktif();
    const emailEl = document.getElementById("userEmail");
    const roleEl = document.getElementById("userRole");
    const inputNama = document.getElementById("inputNamaPengguna");
    const btnSimpanNama = document.getElementById("btnSimpanNama");
    const pesanNamaEl = document.getElementById("pesanNama");

    if (emailEl) emailEl.innerText = currentUser.email || "Tidak diketahui";
    if (roleEl) roleEl.innerText = currentUser.role || "Belum diatur";
    if (inputNama) inputNama.value = currentUser.nama || "";

    // 1b. Logika Simpan Nama Tampilan (menggantikan email di header & sidebar)
    if (btnSimpanNama && inputNama) {
        btnSimpanNama.addEventListener("click", async function() {
            const namaBaru = inputNama.value.trim();

            if (!namaBaru) {
                tampilkanPesan(pesanNamaEl, "❌ Nama tidak boleh kosong.", "red");
                return;
            }
            if (!currentUser.email) {
                tampilkanPesan(pesanNamaEl, "❌ Sesi tidak valid. Silakan login ulang.", "red");
                return;
            }

            const teksAsli = btnSimpanNama.innerText;
            btnSimpanNama.disabled = true;
            btnSimpanNama.innerText = "Menyimpan...";

            try {
                await setDoc(doc(db, "users", currentUser.email), {
                    nama: namaBaru,
                    updatedAt: new Date().toISOString()
                }, { merge: true });

                const sesiTerbaru = { ...currentUser, nama: namaBaru };
                sessionStorage.setItem("erapee_user_session", JSON.stringify(sesiTerbaru));

                tampilkanPesan(pesanNamaEl, "✅ Nama berhasil disimpan. Memuat ulang tampilan...", "green");
                setTimeout(() => window.location.reload(), 900);
            } catch (error) {
                console.error("Gagal menyimpan nama:", error);
                tampilkanPesan(pesanNamaEl, "❌ Gagal menyimpan nama: " + error.message, "red");
                btnSimpanNama.disabled = false;
                btnSimpanNama.innerText = teksAsli;
            }
        });
    }

    // 2. Logika Form Ganti Kata Sandi
    const formPassword = document.getElementById("formGantiPassword");
    if (formPassword) {
        formPassword.addEventListener("submit", async function(e) {
            e.preventDefault();
            
            const newPassword = document.getElementById("newPassword").value;
            const confirmPassword = document.getElementById("confirmPassword").value;
            const pesanEl = document.getElementById("pesanNotifikasi");
            const btnSubmit = document.getElementById("btnSimpanPassword");

            // Validasi Dasar Sisi Klien
            if (newPassword !== confirmPassword) {
                tampilkanPesan(pesanEl, "❌ Kata sandi baru dan konfirmasi tidak cocok!", "red");
                return;
            }

            if (newPassword.length < 6) {
                tampilkanPesan(pesanEl, "❌ Kata sandi minimal harus terdiri dari 6 karakter.", "red");
                return;
            }

            btnSubmit.disabled = true;
            btnSubmit.innerText = "Memproses Perubahan...";

            try {
                // Proses update password ke server Firebase
                const user = auth.currentUser;
                if (user) {
                    await updatePassword(user, newPassword);
                    tampilkanPesan(pesanEl, "✅ Berhasil! Kata sandi Anda telah diperbarui.", "green");
                    formPassword.reset();
                } else {
                    tampilkanPesan(pesanEl, "❌ Sesi tidak valid atau terputus. Silakan login ulang.", "red");
                }
            } catch (error) {
                console.error("Gagal ganti password:", error);
                // Menangani error keamanan bawaan Firebase (wajib re-login)
                if (error.code === 'auth/requires-recent-login') {
                    tampilkanPesan(pesanEl, "⚠️ Keamanan: Anda harus logout dan login kembali sebelum diizinkan mengganti kata sandi.", "red");
                } else {
                    tampilkanPesan(pesanEl, "❌ Gagal memperbarui kata sandi: " + error.message, "red");
                }
            }

            btnSubmit.disabled = false;
            btnSubmit.innerText = "Perbarui Kata Sandi";
        });
    }
});

// Fungsi pembantu untuk notifikasi UI
function tampilkanPesan(element, text, color) {
    element.classList.remove("hidden", "bg-red-50", "text-red-700", "border-red-200", "bg-green-50", "text-green-700", "border-green-200");
    element.innerText = text;
    if (color === "red") {
        element.classList.add("bg-red-50", "text-red-700", "border-red-200");
    } else {
        element.classList.add("bg-green-50", "text-green-700", "border-green-200");
    }
}
