// ==========================================
// PUSAT PENGATURAN DATABASE (SINGLE SOURCE OF TRUTH)
// ==========================================
import { CONFIG, db } from "./config.js";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Nama koleksi pusat yang digunakan bersama oleh seluruh halaman
const KOLEKSI_UTAMA = CONFIG.COLLECTION_NAME || "jurnal_transaksi";

/**
 * 1. Simpan atau Perbarui Jurnal ke Pusat Database
 */
export async function simpanJurnalPusat(headerData, rowsData, editIdJurnal = null) {
    try {
        // Jika sedang dalam mode edit, hapus data lama berdasarkan ID Jurnal terlebih dahulu
        if (editIdJurnal) {
            await hapusJurnalPusat(editIdJurnal);
        }

        const batchPromises = [];
        rowsData.forEach(row => {
            const debitVal = parseFloat(row.debit) || 0;
            const kreditVal = parseFloat(row.kredit) || 0;

            if (debitVal > 0 || kreditVal > 0) {
                const rowData = {
                    ...headerData,
                    kode_akun: row.kode_akun,
                    nama_akun: row.nama_akun,
                    memo_baris: row.memo_baris || '',
                    debit: debitVal,
                    kredit: kreditVal,
                    timestamp: new Date()
                };
                batchPromises.push(addDoc(collection(db, KOLEKSI_UTAMA), rowData));
            }
        });

        await Promise.all(batchPromises);
        return { success: true, message: "Transaksi berhasil disimpan ke pusat database!" };
    } catch (error) {
        console.error("Gagal menyimpan ke pusat database:", error);
        return { success: false, error: error.message };
    }
}

/**
 * 2. Ambil Seluruh Data Jurnal (Digunakan di Manajemen, Laporan, Dashboard, Rekap PPN)
 */
export async function ambilSemuaJurnalPusat() {
    try {
        const querySnapshot = await getDocs(collection(db, KOLEKSI_UTAMA));
        let groupedJurnal = {};

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const docId = docSnap.id;
            const id_jurnal = data.id_jurnal || 'NO-ID';

            if (!groupedJurnal[id_jurnal]) {
                groupedJurnal[id_jurnal] = {
                    id_jurnal: id_jurnal,
                    tanggal: data.tanggal,
                    no_bukti: data.no_bukti,
                    keterangan: data.keterangan,
                    status: data.status,
                    unit_usaha: data.unit_usaha || '',
                    lawan_transaksi: data.lawan_transaksi || '',
                    sifat_transaksi: data.sifat_transaksi || 'Tunai',
                    jatuh_tempo: data.jatuh_tempo || '',
                    link_bukti: data.link_bukti || '',
                    kode_pajak: data.kode_pajak || 'NON',
                    dpp_penjualan: parseFloat(data.dpp_penjualan) || 0,
                    total_debit: 0,
                    total_kredit: 0,
                    rows: [],
                    docIds: []
                };
            }

            groupedJurnal[id_jurnal].rows.push(data);
            groupedJurnal[id_jurnal].docIds.push(docId);
            groupedJurnal[id_jurnal].total_debit += parseFloat(data.debit) || 0;
            groupedJurnal[id_jurnal].total_kredit += parseFloat(data.kredit) || 0;
        });

        // Kembalikan dalam bentuk array yang diurutkan dari yang terbaru
        return Object.values(groupedJurnal).sort((a, b) => b.id_jurnal.localeCompare(a.id_jurnal));
    } catch (error) {
        console.error("Gagal mengambil data dari pusat:", error);
        return [];
    }
}

/**
 * 3. Hapus Jurnal Berdasarkan ID Jurnal
 */
export async function hapusJurnalPusat(id_jurnal) {
    try {
        const q = query(collection(db, KOLEKSI_UTAMA), where("id_jurnal", "==", id_jurnal));
        const querySnapshot = await getDocs(q);
        const deletePromises = [];
        
        querySnapshot.forEach(docSnap => {
            deletePromises.push(deleteDoc(doc(db, KOLEKSI_UTAMA, docSnap.id)));
        });
        
        await Promise.all(deletePromises);
        return { success: true };
    } catch (error) {
        console.error("Gagal menghapus data pusat:", error);
        return { success: false, error: error.message };
    }
}
