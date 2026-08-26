// js/auth.js - Modul Manajemen Sesi, Autentikasi, & Peran Pengguna (RBAC)
import { db } from "./config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export async function cekSesiLogin() {
    const pathAktif = window.location.pathname;
    if (pathAktif.includes("login.html")) {
        return;
    }

    const sesiUser = sessionStorage.getItem("erapee_user_session");
    if (!sesiUser) {
        window.location.href = "login.html";
        return;
    }

    try {
        const userObj = JSON.parse(sesiUser);
        // Validasi hak akses halaman berdasarkan role
        terapkanBatasanAksesRole(userObj.role || "Akuntan");
    } catch (e) {
        console.error("Gagal memparsing sesi:", e);
    }
}

export async function ambilDataRoleUser(uid, email) {
    try {
        // Cek koleksi 'users' di Firestore untuk mengambil role kustom
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().role) {
            return docSnap.data().role; // Cth: "Admin", "Akuntan", "Auditor"
        }
    } catch (err) {
        console.error("Gagal mengambil role dari database:", err);
    }

    // Default fallback jika email tertentu atau belum diatur di database
    if (email && email.includes("admin")) return "Admin";
    if (email && email.includes("auditor")) return "Auditor";
    return "Akuntan"; // Default role standar
}

function terapkanBatasanAksesRole(role) {
    const path = window.location.pathname;
    const isRestrictedForAuditor = path.includes("input-jurnal") || path.includes("master-data") || path.includes("closing");

    if (role === "Auditor" && isRestrictedForAuditor) {
        alert("⚠️ Akses Dibatasi: Peran Anda sebagai Auditor bersifat Read-Only dan tidak diizinkan mengakses halaman input atau pengaturan.");
        window.location.href = "index.html";
    }
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
    window.location.href = "login.html";
}

cekSesiLogin();
