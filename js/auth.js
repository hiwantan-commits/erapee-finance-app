// js/auth.js - Modul Manajemen Sesi, Autentikasi, & Hierarki Peran (RBAC)
export async function cekSesiLogin() {
    const pathAktif = window.location.pathname;
    
    // Jangan periksa sesi jika sedang berada di halaman login
    if (pathAktif.includes("login")) {
        return;
    }

    const sesiUser = sessionStorage.getItem("erapee_user_session");
    if (!sesiUser) {
        window.location.href = "/login";
        return;
    }

    try {
        const userObj = JSON.parse(sesiUser);
        // Validasi hak akses halaman berdasarkan role yang lebih ketat
        terapkanBatasanAksesRole(userObj.role || "Akuntan");
    } catch (e) {
        console.error("Gagal memparsing sesi:", e);
    }
}

function terapkanBatasanAksesRole(role) {
    const path = window.location.pathname;
    
    // 1. Aturan untuk AUDITOR (Hanya Read-Only)
    if (role === "Auditor" && (
        path.includes("input-jurnal") ||
        path.includes("master-data") ||
        path.includes("closing") ||
        path.includes("users") ||
        path.includes("profil-pajak") ||
        path.includes("jurnal-berulang")
    )) {
        alert("⚠️ Akses Dibatasi: Peran Anda sebagai Auditor bersifat Read-Only.");
        window.location.href = "/index";
    }

    // 2. Aturan untuk AKUNTAN (Operasional)
    if (role === "Akuntan" && (
        path.includes("closing") || 
        path.includes("users")
    )) {
        alert("⚠️ Akses Dibatasi: Halaman Tutup Buku & Manajemen Pengguna hanya dapat diakses oleh Admin.");
        window.location.href = "/index";
    }

    // 3. Aturan untuk ADMIN (Manajemen Keuangan)
    if (role === "Admin" && path.includes("users")) {
        alert("⚠️ Akses Dibatasi: Hanya 'Super Admin' yang memiliki wewenang untuk mengelola akun pengguna.");
        window.location.href = "/index";
    }

    // 4. SUPER ADMIN bebas mengakses apa saja, tidak ada batasan.
}

export function ambilUserAktif() {
    const sesiUser = sessionStorage.getItem("erapee_user_session");
    if (sesiUser) {
        try {
            return JSON.parse(sesiUser);
        } catch (e) {
            return { email: sesiUser, role: "Akuntan" };
        }
    }
    return { email: "guest@erapee.com", role: "Guest" };
}

export function logoutSistem() {
    sessionStorage.removeItem("erapee_user_session");
    window.location.href = "/login";
}

// Jalankan pemeriksaan saat file ini dimuat
cekSesiLogin();
