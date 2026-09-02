// js/recurring-db.js - Lapisan data & orkestrasi untuk Jurnal Berulang
// (auto-draft penyusutan aset & amortisasi sewa, menunggu persetujuan user
// sebelum benar-benar diposting ke jurnal_transaksi lewat simpanJurnalPusat).
//
// Draft TIDAK disimpan di jurnal_transaksi supaya tidak ikut terhitung di
// Neraca/Laba Rugi sebelum di-approve (field `status` DRAFT/POSTED yang
// sudah ada di jurnal_transaksi ternyata kosmetik saja - semua baris tetap
// dihitung penuh oleh kalkulasiNeraca()/kalkulasiLaporanKeuangan() apapun
// status-nya). Draft hidup di koleksi terpisah (draf_jurnal_berulang) dan
// baru menjadi jurnal sungguhan saat status-nya APPROVED.
import { db } from "./config.js";
import { collection, getDocs, doc, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { simpanJurnalPusat, hapusJurnalPusat } from "./db.js";
import {
    hitungPenyusutanBulanan,
    hitungAmortisasiSewaBulanan,
    enumerasiPeriodeBelumDiproses,
    KELOMPOK_PENYUSUTAN
} from "./accounting.js";

const KOLEKSI_DRAF = "draf_jurnal_berulang";
const KOLEKSI_ASET = "aset_tetap";
const KOLEKSI_SEWA = "sewa_dibayar_dimuka";

function idAmanFirestore(teks) {
    return String(teks).replace(/[^a-zA-Z0-9_-]/g, '_');
}

// Tanggal terakhir suatu bulan (periode "YYYY-MM") dalam format YYYY-MM-DD -
// dipakai sebagai tanggal jurnal hasil approval (akrual di akhir bulan).
function akhirBulan(periode) {
    const [tahun, bulan] = periode.split('-').map(Number);
    const tglAkhir = new Date(tahun, bulan, 0); // hari ke-0 bulan berikutnya = hari terakhir bulan ini
    const mm = String(tglAkhir.getMonth() + 1).padStart(2, '0');
    const dd = String(tglAkhir.getDate()).padStart(2, '0');
    return `${tglAkhir.getFullYear()}-${mm}-${dd}`;
}

function periodeSaatIni(tanggalReferensi) {
    return `${tanggalReferensi.getFullYear()}-${String(tanggalReferensi.getMonth() + 1).padStart(2, '0')}`;
}

// Bulan ke berapa (1-based) suatu periode "YYYY-MM" dihitung dari bulan
// tanggal_mulai - dipakai untuk 3 digit akhir No. Bukti amortisasi sewa
// ("{No. Bukti transaksi sumber}/NNN").
function hitungBulanKeberapa(tanggalMulaiStr, periode) {
    const tglMulai = new Date(tanggalMulaiStr);
    const [tahun, bulan] = periode.split('-').map(Number);
    const indeks = (tahun - tglMulai.getFullYear()) * 12 + (bulan - 1 - tglMulai.getMonth());
    return indeks + 1;
}

function ambilEmailPengguna() {
    try {
        const sesi = sessionStorage.getItem("erapee_user_session");
        if (sesi) {
            const parsed = JSON.parse(sesi);
            return parsed.email || sesi;
        }
    } catch (e) {}
    return "System User";
}

export async function ambilSemuaDraf() {
    const snap = await getDocs(collection(db, KOLEKSI_DRAF));
    const daftar = [];
    snap.forEach(d => daftar.push({ id: d.id, ...d.data() }));
    daftar.sort((a, b) => (b.periode || '').localeCompare(a.periode || '') || (a.sumber_nama || '').localeCompare(b.sumber_nama || ''));
    return daftar;
}

// Memindai aset_tetap & sewa_dibayar_dimuka yang akunnya sudah lengkap,
// lalu upsert (setDoc/batch.set - bukan addDoc) draft PENDING untuk setiap
// bulan yang belum diproses. Dokumen draft ber-ID deterministik
// (${sumber_modul}_${sumber_id}_${periode}) sehingga memanggil fungsi ini
// berkali-kali aman - draft PENDING lama ditimpa ulang (angka bisa berubah
// kalau data aset/sewa diedit), sedangkan draft yang sudah APPROVED/REJECTED
// tidak pernah disentuh lagi.
export async function generateDanUpsertDraf() {
    const tanggalReferensi = new Date();
    const periodeIni = periodeSaatIni(tanggalReferensi);
    const warnings = [];
    let dibuat = 0, diperbarui = 0;

    const [snapAset, snapSewa, snapDraf, snapCOA] = await Promise.all([
        getDocs(collection(db, KOLEKSI_ASET)),
        getDocs(collection(db, KOLEKSI_SEWA)),
        getDocs(collection(db, KOLEKSI_DRAF)),
        getDocs(collection(db, "master_coa"))
    ]);

    const petaNamaAkun = {};
    snapCOA.forEach(d => { const c = d.data(); petaNamaAkun[c.kode] = c.nama; });
    const namaAkun = (kode) => petaNamaAkun[kode] || kode;

    const draftExisting = {};
    snapDraf.forEach(d => { draftExisting[d.id] = d.data(); });

    const batch = writeBatch(db);
    let adaPerubahan = false;

    function periodeSelesaiUntukSumber(sumberModul, sumberId) {
        const hasil = new Set();
        Object.values(draftExisting).forEach(d => {
            if (d.sumber_modul === sumberModul && d.sumber_id === sumberId && (d.status === 'APPROVED' || d.status === 'REJECTED')) {
                hasil.add(d.periode);
            }
        });
        return hasil;
    }

    function upsertDraf(idDraf, dataDraf) {
        const dataLama = draftExisting[idDraf];
        if (dataLama && dataLama.status !== 'PENDING') return; // jangan timpa yang sudah diputuskan
        batch.set(doc(db, KOLEKSI_DRAF, idDraf), dataDraf);
        adaPerubahan = true;
        if (dataLama) diperbarui++; else dibuat++;
    }

    snapAset.forEach(docSnap => {
        const aset = { id: docSnap.id, ...docSnap.data() };
        if (!aset.kode_akun_beban_penyusutan || !aset.kode_akun_akumulasi_penyusutan) {
            warnings.push(`Aset "${aset.nama_aset}" belum diatur akun beban/akumulasi penyusutan - dilewati.`);
            return;
        }
        const kelompok = KELOMPOK_PENYUSUTAN[aset.kelompok];
        if (!kelompok || !aset.tanggal_perolehan) return;

        const tglPerolehan = new Date(aset.tanggal_perolehan);
        const tglAkhirUmur = new Date(tglPerolehan.getFullYear(), tglPerolehan.getMonth() + kelompok.tahun * 12, tglPerolehan.getDate());
        const tglAkhirStr = `${tglAkhirUmur.getFullYear()}-${String(tglAkhirUmur.getMonth() + 1).padStart(2, '0')}-${String(tglAkhirUmur.getDate()).padStart(2, '0')}`;

        const periodeBaru = enumerasiPeriodeBelumDiproses(
            aset.tanggal_perolehan, tglAkhirStr, tanggalReferensi, periodeSelesaiUntukSumber('PENYUSUTAN_ASET', aset.id)
        );

        periodeBaru.forEach(periode => {
            const [tahun, bulan] = periode.split('-').map(Number);
            const nominal = hitungPenyusutanBulanan(aset, tahun, bulan);
            if (nominal <= 0) return;

            const idDraf = `PENYUSUTAN_ASET_${idAmanFirestore(aset.id)}_${periode}`;
            const memo = `Penyusutan ${aset.nama_aset} - ${periode}`;
            upsertDraf(idDraf, {
                sumber_modul: 'PENYUSUTAN_ASET',
                sumber_id: aset.id,
                sumber_nama: aset.nama_aset,
                periode,
                tanggal: akhirBulan(periode),
                unit_usaha: aset.unit_usaha || '',
                no_bukti_sumber: aset.no_bukti_sumber || '',
                bulan_ke: hitungBulanKeberapa(aset.tanggal_perolehan, periode),
                nominal,
                rows: [
                    { kode_akun: aset.kode_akun_beban_penyusutan, nama_akun: namaAkun(aset.kode_akun_beban_penyusutan), memo_baris: memo, debit: nominal, kredit: 0 },
                    { kode_akun: aset.kode_akun_akumulasi_penyusutan, nama_akun: namaAkun(aset.kode_akun_akumulasi_penyusutan), memo_baris: memo, debit: 0, kredit: nominal }
                ],
                keterangan: `Penyusutan bulanan aset "${aset.nama_aset}" periode ${periode}`,
                status: 'PENDING',
                is_backfill: periode < periodeIni,
                id_jurnal_hasil: null,
                dibuat_pada: new Date().toISOString()
            });
        });
    });

    snapSewa.forEach(docSnap => {
        const sewa = { id: docSnap.id, ...docSnap.data() };
        if (!sewa.kode_akun_prabayar || !sewa.kode_akun_beban_sewa) {
            warnings.push(`Sewa "${sewa.nama_sewa}" belum diatur akun prabayar/beban - dilewati.`);
            return;
        }
        if (!sewa.tanggal_mulai || !sewa.tanggal_selesai) return;

        const periodeBaru = enumerasiPeriodeBelumDiproses(
            sewa.tanggal_mulai, sewa.tanggal_selesai, tanggalReferensi, periodeSelesaiUntukSumber('AMORTISASI_SEWA', sewa.id)
        );

        periodeBaru.forEach(periode => {
            const [tahun, bulan] = periode.split('-').map(Number);
            const nominal = hitungAmortisasiSewaBulanan(sewa, tahun, bulan);
            if (nominal <= 0) return;

            const idDraf = `AMORTISASI_SEWA_${idAmanFirestore(sewa.id)}_${periode}`;
            const memo = `Amortisasi sewa ${sewa.nama_sewa} - ${periode}`;
            upsertDraf(idDraf, {
                sumber_modul: 'AMORTISASI_SEWA',
                sumber_id: sewa.id,
                sumber_nama: sewa.nama_sewa,
                periode,
                tanggal: akhirBulan(periode),
                unit_usaha: sewa.unit_usaha || '',
                no_bukti_sumber: sewa.no_bukti_sumber || '',
                bulan_ke: hitungBulanKeberapa(sewa.tanggal_mulai, periode),
                nominal,
                rows: [
                    { kode_akun: sewa.kode_akun_beban_sewa, nama_akun: namaAkun(sewa.kode_akun_beban_sewa), memo_baris: memo, debit: nominal, kredit: 0 },
                    { kode_akun: sewa.kode_akun_prabayar, nama_akun: namaAkun(sewa.kode_akun_prabayar), memo_baris: memo, debit: 0, kredit: nominal }
                ],
                keterangan: `Amortisasi bulanan sewa "${sewa.nama_sewa}" periode ${periode}`,
                status: 'PENDING',
                is_backfill: periode < periodeIni,
                id_jurnal_hasil: null,
                dibuat_pada: new Date().toISOString()
            });
        });
    });

    // Catatan: writeBatch Firestore dibatasi 500 operasi. Untuk skala
    // penggunaan aplikasi ini (segelintir aset/sewa per perusahaan) batas ini
    // tidak realistis tercapai bahkan dengan backfill bertahun-tahun; belum
    // ditangani secara eksplisit supaya kode tetap sederhana.
    if (adaPerubahan) await batch.commit();

    return { dibuat, diperbarui, warnings };
}

// Menyetujui satu draft: posting jurnal sungguhan lewat simpanJurnalPusat
// (dengan opsi lewatiKuncPeriode supaya backfill ke bulan yang sudah ditutup
// buku tetap bisa diposting - keputusan disengaja user demi akurasi
// historis), lalu tandai draft-nya APPROVED. id_jurnal & no_bukti dibuat
// deterministik dari idDraf supaya idempoten terhadap draft yang sama.
export async function setujuiDraf(idDraf, draf) {
    try {
        const idJurnal = `JRB-${idDraf}`;

        // Amortisasi sewa/penyusutan aset yang berasal dari transaksi
        // terdaftar (lihat fitur "Isi Otomatis dari Transaksi Jurnal" di
        // sewa.html & aset-tetap.html) memakai No. Bukti transaksi sumbernya
        // sendiri + 3 digit bulan berjalan, supaya rangkaian jurnal
        // bulanannya gampang ditelusuri balik ke transaksi awal. Sewa/aset
        // yang tidak berasal dari transaksi terdaftar (input manual) tetap
        // memakai format lama.
        const noBukti = draf.no_bukti_sumber
            ? `${draf.no_bukti_sumber}/${String(draf.bulan_ke || 1).padStart(3, '0')}`
            : `AUTO/${draf.sumber_modul === 'PENYUSUTAN_ASET' ? 'PNY' : 'SWA'}/${draf.periode}/${idAmanFirestore(draf.sumber_id).slice(0, 8)}`;

        const headerData = {
            id_jurnal: idJurnal,
            tanggal: draf.tanggal,
            no_bukti: noBukti,
            sifat_transaksi: 'Non-Tunai',
            unit_usaha: draf.unit_usaha || '',
            lawan_transaksi: draf.sumber_nama || '',
            jatuh_tempo: '',
            punya_bukti: false,
            kode_pajak: 'NON',
            dpp_penjualan: 0,
            keterangan: draf.keterangan || '',
            status: 'POSTED',
            sumber_modul: draf.sumber_modul,
            sumber_id: draf.sumber_id,
            sumber_periode: draf.periode
        };

        const hasil = await simpanJurnalPusat(headerData, draf.rows, null, null, { lewatiKuncPeriode: true });
        if (!hasil.success) return hasil;

        await updateDoc(doc(db, KOLEKSI_DRAF, idDraf), {
            status: 'APPROVED',
            id_jurnal_hasil: idJurnal,
            approved_by: ambilEmailPengguna(),
            approved_at: new Date().toISOString()
        });

        return { success: true };
    } catch (error) {
        console.error("Gagal menyetujui draft jurnal berulang:", error);
        return { success: false, error: error.message };
    }
}

export async function tolakDraf(idDraf) {
    try {
        await updateDoc(doc(db, KOLEKSI_DRAF, idDraf), {
            status: 'REJECTED',
            approved_by: ambilEmailPengguna(),
            approved_at: new Date().toISOString()
        });
        return { success: true };
    } catch (error) {
        console.error("Gagal menolak draft jurnal berulang:", error);
        return { success: false, error: error.message };
    }
}

// Membatalkan persetujuan satu draft APPROVED: hapus jurnal yang sudah
// terposting lewat hapusJurnalPusat() - tunduk pada kunci periode NORMAL
// (TIDAK menembus periode yang sudah ditutup buku, berbeda dengan
// setujuiDraf() yang sengaja bisa menembus untuk backfill; di sini
// tujuannya justru melindungi periode yang sudah difinalisasi, bukan
// mengisi bolongnya). Draft dikembalikan ke status PENDING (bukan
// dihapus) supaya ikut terhitung ulang & bisa disetujui lagi saat
// generateDanUpsertDraf() berikutnya berjalan - upsertDraf() di sana
// hanya melewati draft yang BUKAN berstatus PENDING.
export async function batalkanPersetujuanDraf(idDraf, draf) {
    if (!draf.id_jurnal_hasil) {
        return { success: false, error: "Draft ini tidak memiliki jurnal terposting untuk dihapus." };
    }
    try {
        const hasilHapus = await hapusJurnalPusat(draf.id_jurnal_hasil);
        if (!hasilHapus.success) return hasilHapus;

        await updateDoc(doc(db, KOLEKSI_DRAF, idDraf), {
            status: 'PENDING',
            id_jurnal_hasil: null,
            approved_by: null,
            approved_at: null
        });

        return { success: true };
    } catch (error) {
        console.error("Gagal membatalkan persetujuan draft jurnal berulang:", error);
        return { success: false, error: error.message };
    }
}
