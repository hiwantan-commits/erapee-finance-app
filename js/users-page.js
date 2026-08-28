// js/users-page.js - Controller untuk users.html (Manajemen Pengguna oleh Super Admin)
import { CONFIG, db } from "./config.js";
import { collection, getDocs, setDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { escapeHtml } from "./utils.js";

// Membuat akun login Firebase Authentication untuk user baru TANPA mengganggu
// sesi Super Admin yang sedang login. Trik: pakai instance Firebase App kedua
// yang terpisah (createUserWithEmailAndPassword otomatis login sebagai user
// baru pada instance Auth yang dipakai - kalau pakai instance utama, sesi
// Super Admin akan tergantikan oleh sesi user baru tersebut).
async function buatAkunLoginBaru(email) {
    const namaAppSementara = "AppSementaraBuatUser_" + Date.now();
    const appSementara = initializeApp(CONFIG.FIREBASE_CONFIG, namaAppSementara);
    const authSementara = getAuth(appSementara);

    try {
        const passwordAcak = crypto.randomUUID() + "Aa1!";
        await createUserWithEmailAndPassword(authSementara, email, passwordAcak);
        await sendPasswordResetEmail(authSementara, email);
        await signOut(authSementara);
        return { statusAkun: "dibuat" };
    } catch (error) {
        if (error.code === "auth/email-already-in-use") {
            // Akun sudah ada sebelumnya - cukup kirim link atur ulang kata sandi
            // agar pengguna tetap bisa mengakses/mengatur kata sandinya.
            await sendPasswordResetEmail(authSementara, email);
            return { statusAkun: "sudah-ada" };
        }
        throw error;
    } finally {
        await deleteApp(appSementara);
    }
}

async function muatDaftarPengguna() {
    const tbody = document.getElementById('tabelPengguna');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-stone-400 dark:text-stone-500">Memuat data pengguna dari server...</td></tr>`;

    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        let usersList = [];

        querySnapshot.forEach(docSnap => {
            usersList.push({ id: docSnap.id, ...docSnap.data() });
        });

        tbody.innerHTML = '';
        if (usersList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-stone-400 dark:text-stone-500">Belum ada pemetaan hak akses pengguna yang ditambahkan.</td></tr>`;
            return;
        }

        usersList.forEach((user, index) => {
            let warnaBadge = "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-700";
            if (user.role === "Super Admin") warnaBadge = "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800";
            if (user.role === "Admin") warnaBadge = "bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-100 border border-stone-300 dark:border-stone-600";
            if (user.role === "Akuntan") warnaBadge = "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700";
            if (user.role === "Auditor") warnaBadge = "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800";

            let tr = document.createElement('tr');
            tr.className = "hover:bg-stone-50 dark:hover:bg-stone-800/40 border-b border-stone-100 dark:border-stone-800";
            const encId = encodeURIComponent(user.id || '');
            const encEmail = encodeURIComponent(user.email || '');
            tr.innerHTML = `
                <td class="p-4 text-center font-medium text-stone-500 dark:text-stone-400">${index + 1}</td>
                <td class="p-4 font-bold text-stone-900 dark:text-stone-100">${escapeHtml(user.email)}</td>
                <td class="p-4"><span class="px-3 py-1 rounded-lg text-xs font-bold ${warnaBadge}">${escapeHtml(user.role)}</span></td>
                <td class="p-4 text-center">
                    <button onclick="hapusPengguna('${encId}', '${encEmail}')" class="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 font-bold text-xs transition">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>
                        Cabut Akses
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Gagal memuat daftar pengguna:", err);
        tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-red-500 dark:text-red-400">Gagal memuat data. Pastikan Anda memiliki hak Super Admin.</td></tr>`;
    }
}

document.addEventListener("DOMContentLoaded", function() {
    muatDaftarPengguna();

    const formUser = document.getElementById("formTambahUser");
    if (formUser) {
        formUser.addEventListener("submit", async function(e) {
            e.preventDefault();
            
            const emailInput = document.getElementById("userEmailInput").value.trim().toLowerCase();
            const roleInput = document.getElementById("userRoleSelect").value;
            const btnSubmit = document.getElementById("btnSimpanUser");

            if (!emailInput || !roleInput) {
                alert("Harap lengkapi email dan pilih role.");
                return;
            }

            btnSubmit.disabled = true;
            btnSubmit.innerText = "Membuat akun & menyimpan...";

            try {
                // Menggunakan email MENTAH (bukan versi sanitasi) sebagai Document ID,
                // agar cocok dengan pencarian role saat login (lihat login-page.js) dan
                // agar Firestore Security Rules bisa memverifikasi role lewat
                // request.auth.token.email tanpa perlu memanipulasi string.
                const userRef = doc(db, "users", emailInput);

                await setDoc(userRef, {
                    email: emailInput,
                    role: roleInput,
                    updatedAt: new Date().toISOString()
                });

                const hasilAkun = await buatAkunLoginBaru(emailInput);

                if (hasilAkun.statusAkun === "dibuat") {
                    alert(`✅ Akses ${roleInput} untuk ${emailInput} berhasil ditetapkan!\n\nAkun login baru telah dibuat. Email berisi tautan untuk mengatur kata sandi telah dikirim ke ${emailInput}.`);
                } else {
                    alert(`✅ Akses ${roleInput} untuk ${emailInput} berhasil ditetapkan!\n\nAkun ini sudah pernah terdaftar sebelumnya - email untuk mengatur ulang kata sandi telah dikirim ulang ke ${emailInput}.`);
                }

                formUser.reset();
                muatDaftarPengguna();
            } catch (error) {
                console.error("Gagal menyimpan pengguna:", error);
                if (error.code === "auth/invalid-email") {
                    alert("❌ Gagal membuat akun: format email tidak valid.");
                } else {
                    alert("❌ Gagal menyimpan data: " + error.message);
                }
            }

            btnSubmit.disabled = false;
            btnSubmit.innerText = "Tambahkan Hak Akses";
        });
    }
});

// Fungsi global untuk tombol hapus
window.hapusPengguna = async function(encDocId, encEmail) {
    const docId = decodeURIComponent(encDocId);
    const email = decodeURIComponent(encEmail);
    if (confirm(`Apakah Anda yakin ingin mencabut seluruh hak akses untuk email: ${email}? \n(Pengguna ini akan menjadi 'Guest' dan tidak bisa mengakses menu internal)`)) {
        try {
            await deleteDoc(doc(db, "users", docId));
            alert(`✅ Hak akses untuk ${email} berhasil dicabut.`);
            muatDaftarPengguna();
        } catch (error) {
            console.error("Gagal menghapus:", error);
            alert("❌ Gagal mencabut akses: " + error.message);
        }
    }
};
