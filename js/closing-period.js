// js/closing-period.js - Modul Kontrol Periode Akuntansi (Tutup Buku)
import { db } from "./config.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const DOC_ID_CLOSING = "pengaturan_tutup_buku";

export async function ambilStatusClosing() {
    try {
        const docRef = doc(db, "pengaturan_sistem", DOC_ID_CLOSING);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data().bulanTerkunci || ""; // Format: "YYYY-MM"
        }
        return "";
    } catch (error) {
        console.error("Gagal mengambil status tutup buku:", error);
        return "";
    }
}

export async function cekApakahPeriodeTerkunci(tanggalTransaksi) {
    if (!tanggalTransaksi) return false;
    const bulanTransaksi = tanggalTransaksi.slice(0, 7); // Ambil "YYYY-MM"
    const bulanTerkunci = await ambilStatusClosing();

    if (!bulanTerkunci) return false;

    // Jika bulan transaksi lebih kecil atau sama dengan bulan yang ditutup, maka terkunci
    return bulanTransaksi <= bulanTerkunci;
}

export async function simpanStatusClosing(bulanTahun) {
    try {
        const docRef = doc(db, "pengaturan_sistem", DOC_ID_CLOSING);
        await setDoc(docRef, {
            bulanTerkunci: bulanTahun, // Cth: "2026-05"
            updatedAt: new Date().toISOString()
        }, { merge: true });
        return { success: true };
    } catch (error) {
        console.error("Gagal menyimpan status tutup buku:", error);
        return { success: false, error: error.message };
    }
}
