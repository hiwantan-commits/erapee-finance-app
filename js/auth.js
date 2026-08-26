// js/auth.js - Modul Manajemen Sesi & Autentikasi Pengguna

export function cekSesiLogin() {
    // Mengecualikan halaman login agar tidak terjadi infinite loop redirect
    const pathAktif = window.location.pathname;
    if (pathAktif.includes("login.html")) {
        return;
    }

    const sesiUser = sessionStorage.getItem("erapee_user_session");
    if (!sesiUser) {
        // Jika belum login, paksa arahkan kembali ke halaman login
        window.location.href = "login.html";
    }
}

export function ambilUserAktif() {
    const sesiUser = sessionStorage.getItem("erapee_user_session");
    if (sesiUser) {
        try {
            return JSON.parse(sesiUser);
        } catch (e) {
            return { email: sesiUser, role: "Admin" };
        }
    }
    return { email: "guest@erapee.com", role: "Guest" };
}

export function logoutSistem() {
    sessionStorage.removeItem("erapee_user_session");
    window.location.href = "login.html";
}

// Jalankan pemeriksaan sesi secara otomatis saat modul dimuat di halaman internal
cekSesiLogin();
