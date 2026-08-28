// js/accounting.js - Lapisan Logika Bisnis & Akuntansi

export function hitungKeseimbangan(rows) {
    let totalDebit = 0;
    let totalKredit = 0;

    rows.forEach(row => {
        totalDebit += parseFloat(row.debit) || 0;
        totalKredit += parseFloat(row.kredit) || 0;
    });

    return {
        totalDebit,
        totalKredit,
        isBalance: totalDebit === totalKredit && totalDebit > 0
    };
}

export function klasifikasikanAkun(kodeAkun) {
    const kode = String(kodeAkun || "").trim();
    if (kode.startsWith("1")) return "ASET";
    if (kode.startsWith("2")) return "LIABILITAS";
    if (kode.startsWith("3")) return "EKUITAS";
    if (kode.startsWith("4")) return "PENDAPATAN";
    if (kode.startsWith("5")) return "HPP";
    if (kode.startsWith("6")) return "BEBAN";
    return "LAINNYA";
}

// Validasi kode akun COA: harus berawalan digit 1-6 sesuai konvensi klasifikasi
// (1 Aset, 2 Liabilitas, 3 Ekuitas, 4 Pendapatan, 5 HPP, 6 Beban). Kode yang
// tidak mengikuti konvensi ini akan jatuh ke kategori "LAINNYA" dan tidak
// pernah ikut terhitung di Neraca maupun Laporan Laba Rugi.
export function isKodeAkunValid(kodeAkun) {
    return /^[1-6]/.test(String(kodeAkun || "").trim());
}

// Menghitung Neraca (Laporan Posisi Keuangan): Aset = Liabilitas + Ekuitas.
// Catatan: karena aplikasi ini tidak memiliki mekanisme jurnal penutup periode,
// saldo Pendapatan & Beban diakumulasikan sejak awal sebagai "Laba Ditahan/
// Berjalan" di sisi Ekuitas, bukan direset per tahun buku.
export function kalkulasiNeraca(semuaJurnal) {
    let totalAset = 0, totalLiabilitas = 0, totalEkuitasDasar = 0;
    let totalPendapatan = 0, totalBeban = 0;
    const petaAset = {}, petaLiabilitas = {}, petaEkuitas = {};

    semuaJurnal.forEach(jurnal => {
        jurnal.rows.forEach(baris => {
            const kode = baris.kode_akun || "UMUM";
            const nama = baris.nama_akun || "Akun Umum";
            const debit = parseFloat(baris.debit) || 0;
            const kredit = parseFloat(baris.kredit) || 0;
            const kategori = klasifikasikanAkun(kode);

            if (kategori === "ASET") {
                const saldo = debit - kredit;
                totalAset += saldo;
                if (!petaAset[kode]) petaAset[kode] = { kode, nama, saldo: 0 };
                petaAset[kode].saldo += saldo;
            } else if (kategori === "LIABILITAS") {
                const saldo = kredit - debit;
                totalLiabilitas += saldo;
                if (!petaLiabilitas[kode]) petaLiabilitas[kode] = { kode, nama, saldo: 0 };
                petaLiabilitas[kode].saldo += saldo;
            } else if (kategori === "EKUITAS") {
                const saldo = kredit - debit;
                totalEkuitasDasar += saldo;
                if (!petaEkuitas[kode]) petaEkuitas[kode] = { kode, nama, saldo: 0 };
                petaEkuitas[kode].saldo += saldo;
            } else if (kategori === "PENDAPATAN") {
                totalPendapatan += (kredit - debit);
            } else if (kategori === "HPP" || kategori === "BEBAN") {
                totalBeban += (debit - kredit);
            }
        });
    });

    const labaKumulatif = totalPendapatan - totalBeban;
    const totalEkuitas = totalEkuitasDasar + labaKumulatif;

    return {
        totalAset,
        totalLiabilitas,
        totalEkuitasDasar,
        labaKumulatif,
        totalEkuitas,
        seimbang: Math.round(totalAset) === Math.round(totalLiabilitas + totalEkuitas),
        petaAset: Object.values(petaAset).sort((a, b) => a.kode.localeCompare(b.kode)),
        petaLiabilitas: Object.values(petaLiabilitas).sort((a, b) => a.kode.localeCompare(b.kode)),
        petaEkuitas: Object.values(petaEkuitas).sort((a, b) => a.kode.localeCompare(b.kode))
    };
}

// Menghitung Laporan Arus Kas (metode langsung, disederhanakan). Setiap
// jurnal yang menyentuh akun kas/bank (awalan kode "11") diklasifikasikan
// berdasarkan akun lawan transaksinya:
// - Aset Tetap (awalan "15"/"16") -> Aktivitas Investasi
// - Ekuitas, atau nama akun mengandung "pinjaman"/"kredit bank"/"obligasi" -> Aktivitas Pendanaan
// - Selain itu (Pendapatan, Beban, HPP, Liabilitas operasional) -> Aktivitas Operasi
// Ini estimasi berbasis kode akun, bukan pencatatan arus kas langsung per kategori.
export function kalkulasiArusKas(semuaJurnal) {
    let operasi = 0, investasi = 0, pendanaan = 0;
    const rincian = [];

    semuaJurnal.forEach(jurnal => {
        const barisKas = jurnal.rows.filter(b => String(b.kode_akun || '').startsWith("11"));
        if (barisKas.length === 0) return;

        const barisLain = jurnal.rows.filter(b => !String(b.kode_akun || '').startsWith("11"));

        const adaAsetTetap = barisLain.some(b => {
            const k = String(b.kode_akun || '');
            return k.startsWith("15") || k.startsWith("16");
        });
        const adaPendanaan = barisLain.some(b => {
            const k = String(b.kode_akun || '');
            const nama = (b.nama_akun || '').toLowerCase();
            return klasifikasikanAkun(k) === "EKUITAS" ||
                nama.includes("pinjaman") || nama.includes("kredit bank") || nama.includes("obligasi");
        });

        const kategori = adaAsetTetap ? "Investasi" : (adaPendanaan ? "Pendanaan" : "Operasi");

        let netKasJurnal = 0;
        barisKas.forEach(b => {
            netKasJurnal += (parseFloat(b.debit) || 0) - (parseFloat(b.kredit) || 0);
        });

        if (kategori === "Investasi") investasi += netKasJurnal;
        else if (kategori === "Pendanaan") pendanaan += netKasJurnal;
        else operasi += netKasJurnal;

        rincian.push({ jurnal, kategori, netKas: netKasJurnal });
    });

    return {
        operasi,
        investasi,
        pendanaan,
        totalBersih: operasi + investasi + pendanaan,
        rincian: rincian.sort((a, b) => (b.jurnal.id_jurnal || '').localeCompare(a.jurnal.id_jurnal || ''))
    };
}

// Tarif penyusutan fiskal sesuai kelompok harta berwujud (UU PPh Pasal 11 / PMK).
// saldoMenurun bernilai null untuk bangunan karena UU PPh hanya mengizinkan
// metode garis lurus untuk kelompok bangunan.
export const KELOMPOK_PENYUSUTAN = {
    "Kelompok 1": { tahun: 4, garisLurus: 0.25, saldoMenurun: 0.50 },
    "Kelompok 2": { tahun: 8, garisLurus: 0.125, saldoMenurun: 0.25 },
    "Kelompok 3": { tahun: 16, garisLurus: 0.0625, saldoMenurun: 0.125 },
    "Kelompok 4": { tahun: 20, garisLurus: 0.05, saldoMenurun: 0.10 },
    "Bangunan Permanen": { tahun: 20, garisLurus: 0.05, saldoMenurun: null },
    "Bangunan Tidak Permanen": { tahun: 10, garisLurus: 0.10, saldoMenurun: null }
};

// Menghitung akumulasi penyusutan & nilai buku satu aset pada tanggal referensi
// (default: hari ini), berdasarkan kelompok dan metode penyusutannya.
export function hitungPenyusutanAset(aset, tanggalReferensi = new Date()) {
    const nilaiPerolehan = parseFloat(aset.nilai_perolehan) || 0;
    const kelompok = KELOMPOK_PENYUSUTAN[aset.kelompok];

    if (!kelompok || nilaiPerolehan <= 0 || !aset.tanggal_perolehan) {
        return { nilaiPerolehan, akumulasiPenyusutan: 0, nilaiBuku: nilaiPerolehan, tahunBerjalan: 0 };
    }

    const tglPerolehan = new Date(aset.tanggal_perolehan);
    const MS_PER_TAHUN = 365.25 * 24 * 60 * 60 * 1000;
    let tahunBerjalan = (tanggalReferensi.getTime() - tglPerolehan.getTime()) / MS_PER_TAHUN;
    if (tahunBerjalan < 0) tahunBerjalan = 0;
    if (tahunBerjalan > kelompok.tahun) tahunBerjalan = kelompok.tahun;

    let akumulasiPenyusutan, nilaiBuku;
    if (aset.metode === "Saldo Menurun" && kelompok.saldoMenurun) {
        nilaiBuku = nilaiPerolehan * Math.pow(1 - kelompok.saldoMenurun, tahunBerjalan);
        akumulasiPenyusutan = nilaiPerolehan - nilaiBuku;
    } else {
        akumulasiPenyusutan = nilaiPerolehan * kelompok.garisLurus * tahunBerjalan;
        if (akumulasiPenyusutan > nilaiPerolehan) akumulasiPenyusutan = nilaiPerolehan;
        nilaiBuku = nilaiPerolehan - akumulasiPenyusutan;
    }

    return { nilaiPerolehan, akumulasiPenyusutan, nilaiBuku, tahunBerjalan };
}

export function kalkulasiLaporanKeuangan(semuaJurnal) {
    let totalPendapatan = 0;
    let totalBeban = 0;
    const petaAkun = {};

    semuaJurnal.forEach(jurnal => {
        jurnal.rows.forEach(baris => {
            const kode = baris.kode_akun || "UMUM";
            const nama = baris.nama_akun || "Akun Umum";
            const debit = parseFloat(baris.debit) || 0;
            const kredit = parseFloat(baris.kredit) || 0;

            if (!petaAkun[kode]) {
                petaAkun[kode] = { kode, nama, totalDebit: 0, totalKredit: 0 };
            }
            petaAkun[kode].totalDebit += debit;
            petaAkun[kode].totalKredit += kredit;

            const kategori = klasifikasikanAkun(kode);
            if (kategori === "PENDAPATAN") {
                totalPendapatan += (kredit - debit);
            } else if (kategori === "BEBAN" || kategori === "HPP") {
                totalBeban += (debit - kredit);
            }
        });
    });

    return {
        totalPendapatan,
        totalBeban,
        labaBersih: totalPendapatan - totalBeban,
        petaAkun: Object.values(petaAkun).sort((a, b) => a.kode.localeCompare(b.kode))
    };
}
