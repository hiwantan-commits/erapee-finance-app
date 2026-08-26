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
