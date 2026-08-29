// js/db.js - Lapisan Akses Data dengan Otomatisasi Audit Trail
import { CONFIG, db } from "./config.js";
import { collection, addDoc, getDoc, getDocs, query, where, deleteDoc, doc, limit, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { cekApakahPeriodeTerkunci } from "./closing-period.js";

const KOLEKSI_UTAMA = CONFIG.COLLECTION_NAME || "jurnal_transaksi";
const KOLEKSI_LOG = "activity_logs";
// Berkas bukti transaksi disimpan sebagai satu dokumen tersendiri per id_jurnal
// (bukan disebar ke setiap baris jurnal) agar tidak terduplikasi N kali dan
// tidak mudah melebihi batas ukuran dokumen Firestore (1 MiB). Firebase Storage
// tidak dipakai karena membutuhkan paket berbayar (Blaze).
const KOLEKSI_BUKTI = "bukti_transaksi";

// Fungsi internal untuk mencatat jejak audit
async function catatLogAktivitas(aksi, idJurnal, detailKeterangan) {
    try {
        let userEmail = "System User";
        const sesiUser = sessionStorage.getItem("erapee_user_session");
        if (sesiUser) {
            try {
                const parsed = JSON.parse(sesiUser);
                userEmail = parsed.email || "System User";
            } catch (e) {
                userEmail = sesiUser;
            }
        }

        await addDoc(collection(db, KOLEKSI_LOG), {
            aksi: aksi, // "CREATE / POST", "UPDATE / EDIT", atau "DELETE"
            id_jurnal: idJurnal,
            keterangan: detailKeterangan,
            user: userEmail,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error("Gagal mencatat log aktivitas:", err);
    }
}

// `opsi.lewatiKuncPeriode` (default false) HANYA dipakai oleh alur approval
// draft Jurnal Berulang (js/recurring-db.js) untuk backfill ke bulan yang
// sudah ditutup buku - keputusan disengaja user demi akurasi historis, lihat
// catatan di js/recurring-db.js. Satu-satunya pemanggil lain di aplikasi ini
// (js/journal-page.js) tidak pernah mengirim argumen ke-5, jadi perilakunya
// untuk input jurnal manual biasa sama sekali tidak berubah.
export async function simpanJurnalPusat(headerData, rowsData, editIdJurnal = null, buktiBaru = null, opsi = {}) {
    try {
        const isEdit = Boolean(editIdJurnal);

        // Tolak jika tanggal transaksi (baru) berada pada periode yang sudah ditutup buku
        if (!opsi.lewatiKuncPeriode) {
            const periodeBaruTerkunci = await cekApakahPeriodeTerkunci(headerData.tanggal);
            if (periodeBaruTerkunci) {
                return { success: false, error: "Periode akuntansi untuk tanggal transaksi ini telah ditutup buku (Closed Period)." };
            }
        }

        // Cegah duplikasi No. Bukti antar transaksi berbeda
        if (headerData.no_bukti) {
            const qDup = query(collection(db, KOLEKSI_UTAMA), where("no_bukti", "==", headerData.no_bukti));
            const dupSnap = await getDocs(qDup);
            const adaDuplikat = dupSnap.docs.some(d => d.data().id_jurnal !== headerData.id_jurnal);
            if (adaDuplikat) {
                return { success: false, error: `No. Bukti "${headerData.no_bukti}" sudah digunakan oleh transaksi lain. Gunakan nomor lain.` };
            }
        }

        // Gunakan satu batch atomik untuk hapus baris lama (jika edit) & simpan baris baru,
        // agar tidak ada kondisi "setengah tersimpan" jika koneksi terputus di tengah proses.
        const batch = writeBatch(db);

        if (isEdit) {
            const qOld = query(collection(db, KOLEKSI_UTAMA), where("id_jurnal", "==", editIdJurnal));
            const oldSnap = await getDocs(qOld);
            if (!oldSnap.empty) {
                const tanggalLama = oldSnap.docs[0].data().tanggal;
                const periodeLamaTerkunci = await cekApakahPeriodeTerkunci(tanggalLama);
                if (periodeLamaTerkunci) {
                    return { success: false, error: "Transaksi asli berada pada periode yang telah ditutup buku, tidak dapat diubah." };
                }
                oldSnap.forEach(docSnap => batch.delete(doc(db, KOLEKSI_UTAMA, docSnap.id)));
            }
        }

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
                batch.set(doc(collection(db, KOLEKSI_UTAMA)), rowData);
            }
        });

        // Simpan berkas bukti transaksi (jika ada unggahan baru) sebagai satu
        // dokumen tersendiri, atomik bersama baris-baris jurnal di atas.
        if (buktiBaru) {
            batch.set(doc(db, KOLEKSI_BUKTI, headerData.id_jurnal), {
                data: buktiBaru.data,
                mimeType: buktiBaru.mimeType,
                namaFile: buktiBaru.namaFile,
                uploadedAt: new Date().toISOString()
            });
        }

        await batch.commit();

        // Catat jejak audit ke database
        await catatLogAktivitas(
            isEdit ? "UPDATE / EDIT JURNAL" : "CREATE / POST JURNAL",
            headerData.id_jurnal,
            `No. Bukti: ${headerData.no_bukti} | Unit: ${headerData.unit_usaha} | Ket: ${headerData.keterangan}`
        );

        return { success: true };
    } catch (error) {
        console.error("Gagal menyimpan ke database:", error);
        return { success: false, error: error.message };
    }
}

// Mengelompokkan snapshot baris-baris jurnal (satu dokumen Firestore = satu
// baris) menjadi satu objek per id_jurnal - diekstrak dari
// ambilSemuaJurnalPusat() supaya bisa dipakai ulang oleh query bertarget
// (per tanggal/per id) tanpa duplikasi logika pengelompokan.
function kelompokkanBarisJurnal(querySnapshot) {
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
                punya_bukti: Boolean(data.punya_bukti),
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

    return Object.values(groupedJurnal).sort((a, b) => b.id_jurnal.localeCompare(a.id_jurnal));
}

export async function ambilSemuaJurnalPusat(batasiJumlah = null) {
    try {
        // Catatan: sebelumnya ada limit(500) default yang membuat data terpotong
        // secara arbitrer (tanpa orderBy) begitu transaksi melebihi 500 dokumen,
        // sehingga laporan bisa diam-diam menampilkan data tidak lengkap.
        // Sekarang seluruh data diambil kecuali caller memang meminta batas eksplisit.
        //
        // Fungsi ini sengaja masih mengambil SELURUH koleksi - dipakai oleh
        // laporan (Neraca, Laba Rugi, dashboard, dst) yang butuh riwayat
        // lengkap untuk kalkulasi saldo kumulatif/laba ditahan. Caller yang
        // hanya butuh satu tanggal/id/kelompok akun tertentu (No. Bukti
        // otomatis, Edit Jurnal, pencarian transaksi sumber Aset/Sewa)
        // sebaiknya memakai ambilJurnalPerTanggal/ambilJurnalById/
        // ambilBarisJurnalPerKodeAkun di bawah supaya tidak membaca seluruh
        // koleksi hanya untuk mengambil sebagian kecil data.
        const baseQuery = collection(db, KOLEKSI_UTAMA);
        const q = batasiJumlah ? query(baseQuery, limit(batasiJumlah)) : query(baseQuery);
        const querySnapshot = await getDocs(q);
        return kelompokkanBarisJurnal(querySnapshot);
    } catch (error) {
        console.error("Gagal mengambil data:", error);
        return [];
    }
}

// Versi bertarget dari ambilSemuaJurnalPusat() - hanya membaca baris jurnal
// pada satu tanggal tertentu (dipakai untuk menghitung nomor urut No. Bukti
// otomatis harian, yang sebelumnya membaca SELURUH koleksi hanya untuk
// menghitung transaksi hari ini).
export async function ambilJurnalPerTanggal(tanggal) {
    try {
        const q = query(collection(db, KOLEKSI_UTAMA), where("tanggal", "==", tanggal));
        const querySnapshot = await getDocs(q);
        return kelompokkanBarisJurnal(querySnapshot);
    } catch (error) {
        console.error("Gagal mengambil data jurnal per tanggal:", error);
        return [];
    }
}

// Versi bertarget dari ambilSemuaJurnalPusat() - hanya membaca baris-baris
// milik satu id_jurnal (dipakai form Edit Jurnal, yang sebelumnya membaca
// SELURUH koleksi hanya untuk mencari satu jurnal yang sedang diedit).
export async function ambilJurnalById(id_jurnal) {
    try {
        const q = query(collection(db, KOLEKSI_UTAMA), where("id_jurnal", "==", id_jurnal));
        const querySnapshot = await getDocs(q);
        const hasil = kelompokkanBarisJurnal(querySnapshot);
        return hasil.length > 0 ? hasil[0] : null;
    } catch (error) {
        console.error("Gagal mengambil jurnal by id:", error);
        return null;
    }
}

// Mengambil baris-baris jurnal (bukan dikelompokkan per jurnal - dipakai
// pemanggil yang memang cuma butuh baris per-akun mentah, mis. pencarian
// transaksi sumber untuk fitur "Isi Otomatis" di Aset Tetap/Sewa) yang
// kode_akun-nya termasuk dalam daftar tertentu, dengan query Firestore
// where(...,"in",...) alih-alih membaca SELURUH koleksi lalu menyaring di
// klien. where("in") Firestore dibatasi maksimal 30 nilai per query, jadi
// daftar kode akun dipecah per 30 kalau lebih dari itu (dalam praktiknya
// jumlah akun yang ditandai kategori tertentu di Master COA jauh di bawah
// batas ini).
export async function ambilBarisJurnalPerKodeAkun(daftarKodeAkun) {
    if (!daftarKodeAkun || daftarKodeAkun.length === 0) return [];
    try {
        const potongan = [];
        for (let i = 0; i < daftarKodeAkun.length; i += 30) {
            potongan.push(daftarKodeAkun.slice(i, i + 30));
        }

        const hasilPerPotongan = await Promise.all(potongan.map(async (kodeList) => {
            const q = query(collection(db, KOLEKSI_UTAMA), where("kode_akun", "in", kodeList));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(d => d.data());
        }));

        return hasilPerPotongan.flat();
    } catch (error) {
        console.error("Gagal mengambil baris jurnal per kode akun:", error);
        return [];
    }
}

export async function ambilBuktiTransaksi(id_jurnal) {
    try {
        const snap = await getDoc(doc(db, KOLEKSI_BUKTI, id_jurnal));
        return snap.exists() ? snap.data() : null;
    } catch (error) {
        console.error("Gagal mengambil bukti transaksi:", error);
        return null;
    }
}

export async function hapusJurnalPusat(id_jurnal, catatLog = true) {
    try {
        const q = query(collection(db, KOLEKSI_UTAMA), where("id_jurnal", "==", id_jurnal));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return { success: false, error: "Data jurnal tidak ditemukan." };
        }

        // Tolak penghapusan jika transaksi berada pada periode yang sudah ditutup buku
        const tanggalTransaksi = querySnapshot.docs[0].data().tanggal;
        const periodeTerkunci = await cekApakahPeriodeTerkunci(tanggalTransaksi);
        if (periodeTerkunci) {
            return { success: false, error: "Transaksi berada pada periode yang telah ditutup buku (Closed Period), tidak dapat dihapus." };
        }

        const batch = writeBatch(db);
        querySnapshot.forEach(docSnap => batch.delete(doc(db, KOLEKSI_UTAMA, docSnap.id)));
        // Ikut hapus berkas bukti terkait jika ada (aman meski dokumennya tidak ada)
        batch.delete(doc(db, KOLEKSI_BUKTI, id_jurnal));
        await batch.commit();

        if (catatLog) {
            await catatLogAktivitas("DELETE JURNAL", id_jurnal, `Penghapusan seluruh baris transaksi untuk ID ${id_jurnal}`);
        }

        return { success: true };
    } catch (error) {
        console.error("Gagal menghapus:", error);
        return { success: false, error: error.message };
    }
}
