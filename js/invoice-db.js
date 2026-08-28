// js/invoice-db.js - Lapisan Akses Data untuk Invoice & Kwitansi (modul
// penjualan berdiri sendiri, tidak menyentuh jurnal_transaksi/Neraca/Laba
// Rugi - lihat catatan di invoice-baru.html)
import { db } from "./config.js";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const KOLEKSI_INVOICE = "invoice_penjualan";

export async function ambilSemuaInvoice() {
    try {
        const q = query(collection(db, KOLEKSI_INVOICE), orderBy("tanggal", "desc"));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error("Gagal mengambil data invoice:", error);
        return [];
    }
}

// Nomor invoice & kwitansi berbagi urutan yang sama per bulan berjalan, mis.
// FT/003/01/2026 dan KT/003/01/2026 untuk invoice ke-3 di bulan Januari 2026
// (meniru konvensi No. Bukti otomatis pada Input Jurnal).
export async function generateNomorInvoiceBaru() {
    const now = new Date();
    const bulan = String(now.getMonth() + 1).padStart(2, '0');
    const tahun = now.getFullYear();

    const semuaInvoice = await ambilSemuaInvoice();
    const jumlahBulanIni = semuaInvoice.filter(inv => {
        if (!inv.tanggal) return false;
        const [ty, tm] = inv.tanggal.split('-');
        return Number(tm) === now.getMonth() + 1 && Number(ty) === tahun;
    }).length;

    const urut = String(jumlahBulanIni + 1).padStart(3, '0');
    return {
        no_invoice: `FT/${urut}/${bulan}/${tahun}`,
        no_kwitansi: `KT/${urut}/${bulan}/${tahun}`
    };
}

export async function simpanInvoice(data, editId = null) {
    try {
        if (editId) {
            await updateDoc(doc(db, KOLEKSI_INVOICE, editId), data);
            return { success: true, id: editId };
        }
        const ref = await addDoc(collection(db, KOLEKSI_INVOICE), data);
        return { success: true, id: ref.id };
    } catch (error) {
        console.error("Gagal menyimpan invoice:", error);
        return { success: false, error: error.message };
    }
}

export async function hapusInvoice(id) {
    try {
        await deleteDoc(doc(db, KOLEKSI_INVOICE, id));
        return { success: true };
    } catch (error) {
        console.error("Gagal menghapus invoice:", error);
        return { success: false, error: error.message };
    }
}
