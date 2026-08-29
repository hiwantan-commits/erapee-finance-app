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

// ==================== Struktur Laporan Berjenjang: Arus Kas (khusus cetak) ====================
// Menyajikan hasil kalkulasiArusKas() yang sudah ada (tidak diubah) dalam
// format berjenjang bergaya konvensional: 3 kelompok Aktivitas (Operasi/
// Investasi/Pendanaan) + ringkasan Kas Awal/Akhir Periode. TIDAK memecah
// lebih jauh ke sub-kelompok rinci (Pelanggan/Vendor/Pajak/Biaya Operasional)
// seperti sebagian software akuntansi lain, karena itu perlu aturan
// klasifikasi baru per kode akun yang berisiko salah kategorisasi jika kode
// akun di lapangan tidak mengikuti pola yang diasumsikan - dipertahankan
// tetap pada 3 kategori yang sudah teruji dari kalkulasiArusKas().

// Total saldo kas (akun berawalan "11") secara kumulatif dari seluruh
// transaksi yang tanggalnya SEBELUM sebuah batas tanggal (eksklusif).
function totalKasSebelumTanggal(semuaJurnal, batasTanggalYYYYMMDD) {
    let total = 0;
    semuaJurnal.forEach(jurnal => {
        if (!jurnal.tanggal || jurnal.tanggal >= batasTanggalYYYYMMDD) return;
        (jurnal.rows || []).forEach(baris => {
            const kode = String(baris.kode_akun || "");
            if (!kode.startsWith("11")) return;
            total += (parseFloat(baris.debit) || 0) - (parseFloat(baris.kredit) || 0);
        });
    });
    return total;
}

// `semuaJurnal`: seluruh jurnal (tidak difilter periode) - dipakai untuk
// menghitung Kas Awal Periode. `arusKasPeriode`: hasil kalkulasiArusKas()
// yang SUDAH difilter ke periode terpilih. `masaTerpilih`: "SEMUA" atau
// string "YYYY-MM" sesuai pilihan filter di layar.
export function susunStrukturArusKas(semuaJurnal, arusKasPeriode, masaTerpilih) {
    const kasAwal = (masaTerpilih && masaTerpilih !== 'SEMUA')
        ? totalKasSebelumTanggal(semuaJurnal, `${masaTerpilih}-01`)
        : 0;
    const totalDiterima = arusKasPeriode.totalBersih;
    const kasAkhir = kasAwal + totalDiterima;

    const kelompokKategori = (kategori, nomorUrut) => {
        const rincian = arusKasPeriode.rincian.filter(r => r.kategori === kategori);
        const total = rincian.reduce((s, r) => s + r.netKas, 0);
        return { nomor: nomorUrut, label: kategori, rincian, total };
    };

    return {
        operasi: kelompokKategori('Operasi', 'A'),
        investasi: kelompokKategori('Investasi', 'B'),
        pendanaan: kelompokKategori('Pendanaan', 'C'),
        kasAwal,
        totalDiterima,
        kasAkhir,
        formatAngkaLaporan
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

// Menghitung akumulasi amortisasi & sisa nilai buku Sewa Dibayar Dimuka pada
// tanggal referensi (default: hari ini). Berbeda dari aset tetap, sewa tidak
// punya tarif tahunan tetap (Kelompok 1-4/Bangunan) - jangka waktunya murni
// dari tanggal_mulai s/d tanggal_selesai yang diisi manual, dan metodenya
// selalu garis lurus (tidak ada konsep "saldo menurun" untuk beban sewa).
// Memakai pecahan hari berjalan (bukan pembulatan ke bulan kalender) supaya
// konsisten dengan cara hitungPenyusutanAset() menghitung `tahunBerjalan` -
// akrual bergerak halus, bukan melompat di tanggal ulang-tahun kontraknya.
export function hitungAmortisasiSewa(sewa, tanggalReferensi = new Date()) {
    const nilaiTotal = parseFloat(sewa.nilai_total) || 0;

    if (nilaiTotal <= 0 || !sewa.tanggal_mulai || !sewa.tanggal_selesai) {
        return { nilaiTotal, akumulasiAmortisasi: 0, nilaiBuku: nilaiTotal, bulanBerjalan: 0, totalBulan: 0 };
    }

    const tglMulai = new Date(sewa.tanggal_mulai);
    const tglSelesai = new Date(sewa.tanggal_selesai);
    const MS_PER_HARI = 24 * 60 * 60 * 1000;
    const totalHari = Math.max(1, (tglSelesai.getTime() - tglMulai.getTime()) / MS_PER_HARI);
    const totalBulan = Math.max(1, Math.round(totalHari / 30.4375));

    let hariBerjalan = (tanggalReferensi.getTime() - tglMulai.getTime()) / MS_PER_HARI;
    if (hariBerjalan < 0) hariBerjalan = 0;
    if (hariBerjalan > totalHari) hariBerjalan = totalHari;
    const fraksiBerjalan = hariBerjalan / totalHari;

    let akumulasiAmortisasi = nilaiTotal * fraksiBerjalan;
    if (akumulasiAmortisasi > nilaiTotal) akumulasiAmortisasi = nilaiTotal;
    const nilaiBuku = nilaiTotal - akumulasiAmortisasi;
    const bulanBerjalan = fraksiBerjalan * totalBulan;

    return { nilaiTotal, akumulasiAmortisasi, nilaiBuku, bulanBerjalan, totalBulan };
}

// ==================== Struktur Laporan Berjenjang (khusus cetak) ====================
// Mengelompokkan akun Neraca & Laba Rugi ke struktur berjenjang ala software
// akuntansi konvensional (Kelas > Sub-Kelas > Akun), murni diturunkan dari
// awalan kode akun yang SUDAH ADA - tidak menambah/mengubah field apa pun di
// Master Data COA. Fungsi ini murni aditif dan tidak mengubah kalkulasiNeraca()
// / kalkulasiLaporanKeuangan() yang sudah dipakai di tempat lain.
//
// Catatan keterbatasan: satu baris COA di aplikasi ini adalah akun rincian
// (leaf) tanpa sub-akun di bawahnya, sehingga kedalaman berjenjang yang bisa
// direkonstruksi otomatis maksimal 3 tingkat (Kelas > Sub-Kelas > Akun),
// bukan 4 tingkat seperti software yang kode akunnya sendiri sudah berjenjang
// (mis. 1.1.01.01).

export function formatAngkaLaporan(angka) {
    const absFormatted = Math.abs(angka).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return angka < 0 ? `(${absFormatted})` : absFormatted;
}

function subKelasAset(kode) {
    const duaDigit = String(kode).slice(0, 2);
    const PREFIX_TIDAK_LANCAR = ['15', '16', '17', '18', '19'];
    return PREFIX_TIDAK_LANCAR.includes(duaDigit) ? 'ASET TIDAK-LANCAR' : 'ASET LANCAR';
}

function subKelasLiabilitas(kode) {
    const duaDigit = String(kode).slice(0, 2);
    const PREFIX_JANGKA_PANJANG = ['25', '26', '27', '28', '29'];
    return PREFIX_JANGKA_PANJANG.includes(duaDigit) ? 'KEWAJIBAN JANGKA PANJANG' : 'KEWAJIBAN LANCAR';
}

// Mengelompokkan daftar {kode, nama, saldo} menjadi Sub-Kelas > Akun, dengan
// subtotal per Sub-Kelas dan per Kelas. `nomorKelas` dipakai untuk membuat
// penomoran tampilan bergaya "1.1.00" - penomoran ini sintetis untuk cetak
// saja, tidak diklaim sama dengan kode akun aslinya.
function kelompokkanBerjenjang(daftarAkun, nomorKelas, labelKelas, fnSubKelas) {
    const petaSub = {};
    daftarAkun.forEach(akun => {
        const sub = fnSubKelas(akun.kode);
        if (!petaSub[sub]) petaSub[sub] = { label: sub, akun: [], subtotal: 0 };
        petaSub[sub].akun.push(akun);
        petaSub[sub].subtotal += akun.saldo;
    });

    // Lancar/Usaha tampil lebih dulu daripada Tidak-Lancar/Jangka Panjang.
    const daftarSub = Object.values(petaSub).sort((a, b) => {
        const prioritas = s => (s.includes('TIDAK-LANCAR') || s.includes('JANGKA PANJANG')) ? 1 : 0;
        return prioritas(a.label) - prioritas(b.label);
    });

    daftarSub.forEach((sub, iSub) => {
        sub.nomor = `${nomorKelas}.${iSub + 1}.00`;
        sub.akun.forEach((akun, iAkun) => {
            akun.nomorTampil = `${nomorKelas}.${iSub + 1}.${String(iAkun + 1).padStart(2, '0')}`;
        });
    });

    const total = daftarAkun.reduce((s, a) => s + a.saldo, 0);
    return { nomor: `${nomorKelas}.0.00`, label: labelKelas, subKelas: daftarSub, total };
}

export function susunStrukturNeraca(neraca) {
    // Sertakan "Laba (Rugi) Ditahan/Berjalan" sebagai baris akun tersendiri
    // di kelompok Ekuitas (sama seperti yang sudah ditampilkan terpisah di
    // kartu Neraca on-screen) - tanpa ini total Ekuitas berjenjang tidak akan
    // sama dengan neraca.totalEkuitas, dan Neraca tidak akan balance saat cetak.
    const petaEkuitasDenganLaba = [
        ...neraca.petaEkuitas,
        { kode: 'LABA', nama: 'Laba (Rugi) Ditahan / Berjalan', saldo: neraca.labaKumulatif }
    ];

    return {
        aset: kelompokkanBerjenjang(neraca.petaAset, 1, 'ASET', subKelasAset),
        liabilitas: kelompokkanBerjenjang(neraca.petaLiabilitas, 2, 'KEWAJIBAN', subKelasLiabilitas),
        ekuitas: kelompokkanBerjenjang(petaEkuitasDenganLaba, 3, 'EKUITAS', () => 'EKUITAS'),
        formatAngkaLaporan
    };
}

export function susunStrukturLabaRugi(hasilLabaRugi) {
    const kelompok = { PENDAPATAN: [], HPP: [], BEBAN: [] };
    hasilLabaRugi.petaAkun.forEach(akun => {
        const kategori = klasifikasikanAkun(akun.kode);
        if (!kelompok[kategori]) return; // abaikan kode di luar 4/5/6 (kategori "LAINNYA")
        const saldo = kategori === 'PENDAPATAN'
            ? (akun.totalKredit - akun.totalDebit)
            : (akun.totalDebit - akun.totalKredit);
        kelompok[kategori].push({ kode: akun.kode, nama: akun.nama, saldo });
    });

    const pendapatan = kelompokkanBerjenjang(kelompok.PENDAPATAN, 4, 'PENDAPATAN', () => 'PENDAPATAN USAHA');
    const hpp = kelompokkanBerjenjang(kelompok.HPP, 5, 'HARGA POKOK PENJUALAN', () => 'HARGA POKOK PENJUALAN');
    const beban = kelompokkanBerjenjang(kelompok.BEBAN, 6, 'BEBAN', () => 'BEBAN USAHA');
    const labaKotor = pendapatan.total - hpp.total;
    const labaBersih = labaKotor - beban.total;

    return { pendapatan, hpp, beban, labaKotor, labaBersih, formatAngkaLaporan };
}

// ==================== Struktur Laporan Berjenjang: Perubahan Modal (khusus cetak) ====================
// Laporan Perubahan Modal murni hasil hitungan dari data jurnal yang sudah
// ada (sama seperti Neraca/Laba Rugi/Arus Kas) - tidak perlu koleksi
// Firestore baru maupun akun baru.
//
// Catatan keterbatasan: aplikasi ini belum punya akun/mekanisme khusus untuk
// mencatat pembagian Dividen secara terpisah dari transaksi ekuitas biasa,
// sehingga baris "Dividen" pada laporan ini selalu 0 (bukan estimasi/tebakan).

function batasAwalPeriode(masaTerpilih) {
    if (!masaTerpilih || masaTerpilih === 'SEMUA') return null;
    if (masaTerpilih.length === 4) return `${masaTerpilih}-01-01`; // Filter per Tahun (YYYY)
    return `${masaTerpilih}-01`; // Filter per Bulan (YYYY-MM)
}

function labaSebelumTanggal(semuaJurnal, batasTanggal) {
    if (!batasTanggal) return 0;
    let pendapatan = 0, beban = 0;
    semuaJurnal.forEach(jurnal => {
        if (!jurnal.tanggal || jurnal.tanggal >= batasTanggal) return;
        (jurnal.rows || []).forEach(baris => {
            const kategori = klasifikasikanAkun(baris.kode_akun);
            const debit = parseFloat(baris.debit) || 0;
            const kredit = parseFloat(baris.kredit) || 0;
            if (kategori === 'PENDAPATAN') pendapatan += (kredit - debit);
            else if (kategori === 'HPP' || kategori === 'BEBAN') beban += (debit - kredit);
        });
    });
    return pendapatan - beban;
}

function modalDisetorSebelumTanggal(semuaJurnal, batasTanggal) {
    if (!batasTanggal) return 0;
    let total = 0;
    semuaJurnal.forEach(jurnal => {
        if (!jurnal.tanggal || jurnal.tanggal >= batasTanggal) return;
        (jurnal.rows || []).forEach(baris => {
            if (klasifikasikanAkun(baris.kode_akun) !== 'EKUITAS') return;
            total += (parseFloat(baris.kredit) || 0) - (parseFloat(baris.debit) || 0);
        });
    });
    return total;
}

// `semuaJurnal`: seluruh jurnal (tidak difilter periode) - dipakai untuk
// menghitung saldo SEBELUM periode terpilih. `jurnalDalamPeriode`: jurnal
// yang SUDAH difilter ke periode terpilih (jurnalTersaring yang sama dengan
// yang dipakai kalkulasiLaporanKeuangan() di layar). `masaTerpilih`: "SEMUA",
// "YYYY", atau "YYYY-MM" sesuai filter yang sama dengan Laba Rugi.
export function susunStrukturPerubahanModal(semuaJurnal, jurnalDalamPeriode, masaTerpilih, labelPeriode) {
    const batasAwal = batasAwalPeriode(masaTerpilih);

    const modalAwal = modalDisetorSebelumTanggal(semuaJurnal, batasAwal);
    const labaDitahanAwal = labaSebelumTanggal(semuaJurnal, batasAwal);

    let modalTambahan = 0;
    jurnalDalamPeriode.forEach(jurnal => {
        (jurnal.rows || []).forEach(baris => {
            if (klasifikasikanAkun(baris.kode_akun) !== 'EKUITAS') return;
            modalTambahan += (parseFloat(baris.kredit) || 0) - (parseFloat(baris.debit) || 0);
        });
    });

    const labaTahunBerjalan = kalkulasiLaporanKeuangan(jurnalDalamPeriode).labaBersih;
    const dividen = 0; // lihat catatan keterbatasan di atas

    const labaDitahanAkhir = labaDitahanAwal + labaTahunBerjalan - dividen;
    const modalAkhirDisetor = modalAwal + modalTambahan;
    const modalAkhir = modalAkhirDisetor + labaDitahanAkhir;

    return {
        labelPeriode,
        modalAwal,
        modalTambahan,
        labaDitahanAwal,
        labaTahunBerjalan,
        dividen,
        labaDitahanAkhir,
        modalAkhir,
        formatAngkaLaporan
    };
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
