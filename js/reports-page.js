// js/reports-page.js - Controller untuk laporan.html
import { ambilSemuaJurnalPusat } from "./db.js";
import { kalkulasiLaporanKeuangan, kalkulasiNeraca, susunStrukturNeraca, susunStrukturLabaRugi, susunStrukturPerubahanModal } from "./accounting.js";
import { escapeHtml, amankanSelCsv, unduhCsv } from "./utils.js";

let SEMUA_JURNAL = [];

function formatRupiah(angka) {
    return "Rp " + Math.round(angka).toLocaleString('id-ID');
}

function renderBarisNeraca(tbody, daftarAkun, warnaKode) {
    if (daftarAkun.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" class="p-3 text-center text-stone-400 dark:text-stone-500 text-xs">Belum ada data.</td></tr>`;
        return;
    }
    tbody.innerHTML = daftarAkun.map(acc => `
        <tr>
            <td class="p-2 text-xs text-stone-800 dark:text-stone-200"><span class="font-mono font-bold ${warnaKode}">${escapeHtml(acc.kode)}</span> ${escapeHtml(acc.nama)}</td>
            <td class="p-2 text-xs text-right font-medium text-stone-800 dark:text-stone-200">${acc.saldo === 0 ? '-' : acc.saldo.toLocaleString('id-ID')}</td>
        </tr>
    `).join('');
}

// Versi kartu untuk layar sempit (Sprint 2) - data sama dengan renderBarisNeraca()
// di atas, hanya gaya tampilan yang mengikuti komponen "-mobile" (css/style.css).
function renderKartuAkunMobile(container, daftarAkun) {
    if (!container) return;
    if (daftarAkun.length === 0) {
        container.innerHTML = `<p class="text-xs text-stone-400 dark:text-stone-500 px-1">Belum ada data.</p>`;
        return;
    }
    container.innerHTML = daftarAkun.map(acc => `
        <div class="list-row-mobile is-card">
            <div class="row-main-mobile">
                <p class="row-title-mobile">${escapeHtml(acc.nama)}</p>
                <span class="badge-tag-mobile">${escapeHtml(acc.kode)}</span>
            </div>
            <span class="row-amt-mobile">${acc.saldo === 0 ? '-' : acc.saldo.toLocaleString('id-ID')}</span>
        </div>
    `).join('');
}

// ==================== Cetakan Berjenjang (Neraca & Laba Rugi) ====================
// Versi cetak bergaya laporan akuntansi konvensional (Kelas > Sub-Kelas >
// Akun dengan subtotal per level), terpisah dari kartu ringkasan di layar -
// lihat susunStrukturNeraca()/susunStrukturLabaRugi() di accounting.js untuk
// penjelasan keterbatasan kedalaman berjenjangnya.
function renderKelasBerjenjangHtml(kelas, labelTotal, formatAngka) {
    let html = `<tr><td colspan="2" class="pt-4 pb-1 font-bold">${kelas.nomor} - ${escapeHtml(kelas.label)}</td></tr>`;
    kelas.subKelas.forEach(sub => {
        html += `<tr><td class="pl-4 py-1 font-bold">${sub.nomor} - ${escapeHtml(sub.label)}</td><td class="text-right py-1 font-bold">${formatAngka(sub.subtotal)}</td></tr>`;
        sub.akun.forEach(akun => {
            html += `<tr><td class="pl-8 py-0.5">${akun.nomorTampil} - ${escapeHtml(akun.nama)}</td><td class="text-right py-0.5">${formatAngka(akun.saldo)}</td></tr>`;
        });
    });
    html += `
        <tr class="border-t border-gray-400">
            <td class="text-right font-bold pt-2 pb-4">${labelTotal}</td>
            <td class="text-right font-bold pt-2 pb-4">${formatAngka(kelas.total)}</td>
        </tr>
    `;
    return html;
}

// Neraca SELALU dihitung dari seluruh transaksi (kumulatif), tidak ikut
// terpengaruh filter periode - karena Neraca adalah laporan posisi per
// tanggal, bukan laporan per periode seperti Laba Rugi.
let NERACA_TERKINI = null;

function muatNeraca() {
    const neraca = kalkulasiNeraca(SEMUA_JURNAL);
    NERACA_TERKINI = neraca;

    const elAset = document.getElementById('neracaTotalAset');
    const elLiabilitas = document.getElementById('neracaTotalLiabilitas');
    const elEkuitas = document.getElementById('neracaTotalEkuitas');
    const elLaba = document.getElementById('neracaLabaKumulatif');
    const elStatus = document.getElementById('neracaStatusBalance');

    if (elAset) elAset.innerText = formatRupiah(neraca.totalAset);
    if (elLiabilitas) elLiabilitas.innerText = formatRupiah(neraca.totalLiabilitas);
    if (elEkuitas) elEkuitas.innerText = formatRupiah(neraca.totalEkuitas);
    if (elLaba) elLaba.innerText = formatRupiah(neraca.labaKumulatif);

    // Kartu ringkas Beranda-style untuk layar sempit (Sprint 2) - data sama,
    // hanya ditampilkan ulang lewat elemen mobile terpisah (lihat laporan.html).
    const elAsetMobile = document.getElementById('neracaTotalAsetMobile');
    const elLiabilitasMobile = document.getElementById('neracaTotalLiabilitasMobile');
    const elEkuitasMobile = document.getElementById('neracaTotalEkuitasMobile');
    const elLabaMobile = document.getElementById('neracaLabaKumulatifMobile');

    if (elAsetMobile) elAsetMobile.innerText = formatRupiah(neraca.totalAset);
    if (elLiabilitasMobile) elLiabilitasMobile.innerText = formatRupiah(neraca.totalLiabilitas);
    if (elEkuitasMobile) elEkuitasMobile.innerText = formatRupiah(neraca.totalEkuitas);
    if (elLabaMobile) elLabaMobile.innerText = formatRupiah(neraca.labaKumulatif);

    if (elStatus) {
        if (neraca.seimbang) {
            elStatus.className = "px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-semibold rounded text-xs";
            elStatus.innerText = "✓ SEIMBANG";
        } else {
            elStatus.className = "px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-semibold rounded text-xs";
            elStatus.innerText = "⚠️ TIDAK SEIMBANG";
        }
    }

    const tbodyAset = document.getElementById('tabelNeracaAset');
    const tbodyLiabilitasEkuitas = document.getElementById('tabelNeracaLiabilitasEkuitas');

    if (tbodyAset) renderBarisNeraca(tbodyAset, neraca.petaAset, 'text-stone-700 dark:text-stone-300');

    renderKartuAkunMobile(document.getElementById('kartuNeracaAset'), neraca.petaAset);
    renderKartuAkunMobile(document.getElementById('kartuNeracaLiabilitas'), neraca.petaLiabilitas);
    renderKartuAkunMobile(document.getElementById('kartuNeracaEkuitas'), neraca.petaEkuitas);

    if (tbodyLiabilitasEkuitas) {
        let html = '';
        html += `<tr class="bg-stone-50 dark:bg-stone-800/60"><td colspan="2" class="p-2 text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase">Liabilitas</td></tr>`;
        html += neraca.petaLiabilitas.length === 0
            ? `<tr><td colspan="2" class="p-3 text-center text-stone-400 dark:text-stone-500 text-xs">Belum ada data.</td></tr>`
            : neraca.petaLiabilitas.map(acc => `
                <tr>
                    <td class="p-2 text-xs text-stone-800 dark:text-stone-200"><span class="font-mono font-bold text-red-600 dark:text-red-400">${escapeHtml(acc.kode)}</span> ${escapeHtml(acc.nama)}</td>
                    <td class="p-2 text-xs text-right font-medium text-stone-800 dark:text-stone-200">${acc.saldo === 0 ? '-' : acc.saldo.toLocaleString('id-ID')}</td>
                </tr>
            `).join('');
        html += `<tr class="bg-stone-50 dark:bg-stone-800/60"><td colspan="2" class="p-2 text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase">Ekuitas</td></tr>`;
        html += neraca.petaEkuitas.map(acc => `
            <tr>
                <td class="p-2 text-xs text-stone-800 dark:text-stone-200"><span class="font-mono font-bold text-amber-600 dark:text-amber-400">${escapeHtml(acc.kode)}</span> ${escapeHtml(acc.nama)}</td>
                <td class="p-2 text-xs text-right font-medium text-stone-800 dark:text-stone-200">${acc.saldo === 0 ? '-' : acc.saldo.toLocaleString('id-ID')}</td>
            </tr>
        `).join('');
        html += `
            <tr class="border-t border-stone-200 dark:border-stone-700">
                <td class="p-2 text-xs font-semibold text-stone-600 dark:text-stone-300">Laba (Rugi) Ditahan / Berjalan *</td>
                <td class="p-2 text-xs text-right font-semibold text-stone-800 dark:text-stone-200">${neraca.labaKumulatif.toLocaleString('id-ID')}</td>
            </tr>
        `;
        tbodyLiabilitasEkuitas.innerHTML = html;
    }

    // Versi cetak berjenjang (lihat blok "Cetakan Berjenjang" di atas)
    const tbodyCetak = document.getElementById('tabelCetakNeracaBerjenjang');
    if (tbodyCetak) {
        const struktur = susunStrukturNeraca(neraca);
        const tglCetak = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

        const elTglHeader = document.getElementById('cetakTanggalNeracaBerjenjang');
        if (elTglHeader) elTglHeader.innerText = tglCetak;
        const elPeriode = document.getElementById('cetakPeriodeNeracaBerjenjang');
        if (elPeriode) elPeriode.innerText = `Per tanggal ${tglCetak}`;

        let htmlCetak = '';
        htmlCetak += renderKelasBerjenjangHtml(struktur.aset, 'TOTAL ASET', struktur.formatAngkaLaporan);
        htmlCetak += renderKelasBerjenjangHtml(struktur.liabilitas, 'TOTAL KEWAJIBAN', struktur.formatAngkaLaporan);
        htmlCetak += renderKelasBerjenjangHtml(struktur.ekuitas, 'TOTAL EKUITAS', struktur.formatAngkaLaporan);
        htmlCetak += `
            <tr class="border-t-2 border-gray-800">
                <td class="text-right font-bold pt-3">TOTAL KEWAJIBAN DAN MODAL</td>
                <td class="text-right font-bold pt-3">${struktur.formatAngkaLaporan(neraca.totalLiabilitas + neraca.totalEkuitas)}</td>
            </tr>
        `;
        tbodyCetak.innerHTML = htmlCetak;
    }
}

function isiFilterMasaLaporan() {
    const select = document.getElementById('filterMasaLaporan');
    if (!select) return;

    const masaTahunSet = new Set(SEMUA_JURNAL.map(j => (j.tanggal || '').slice(0, 4)).filter(Boolean));
    const masaBulanSet = new Set(SEMUA_JURNAL.map(j => (j.tanggal || '').slice(0, 7)).filter(Boolean));

    const daftarTahun = Array.from(masaTahunSet).sort().reverse();
    const daftarBulan = Array.from(masaBulanSet).sort().reverse();

    let optionsHtml = `<option value="SEMUA">Semua Periode</option>`;

    if (daftarTahun.length > 0) {
        optionsHtml += `<optgroup label="Per Tahun (Laba Rugi Tahunan)">`;
        daftarTahun.forEach(tahun => {
            optionsHtml += `<option value="${tahun}">Tahun ${tahun}</option>`;
        });
        optionsHtml += `</optgroup>`;
    }

    if (daftarBulan.length > 0) {
        optionsHtml += `<optgroup label="Per Bulan">`;
        daftarBulan.forEach(masa => {
            optionsHtml += `<option value="${masa}">${masa}</option>`;
        });
        optionsHtml += `</optgroup>`;
    }

    select.innerHTML = optionsHtml;
}

let HASIL_LABA_RUGI_TERKINI = null;

function renderLabaRugiDanTrialBalance() {
    const select = document.getElementById('filterMasaLaporan');
    const masaTerpilih = select ? select.value : "SEMUA";

    let labelPeriode;
    let jurnalTersaring;

    if (masaTerpilih === "SEMUA") {
        labelPeriode = "Semua Periode";
        jurnalTersaring = SEMUA_JURNAL;
    } else if (masaTerpilih.length === 4) {
        // Filter per Tahun (YYYY) - untuk Laba Rugi tahunan (mis. dasar bonus karyawan)
        labelPeriode = "Tahun " + masaTerpilih;
        jurnalTersaring = SEMUA_JURNAL.filter(j => (j.tanggal || '').slice(0, 4) === masaTerpilih);
    } else {
        // Filter per Bulan (YYYY-MM)
        labelPeriode = masaTerpilih;
        jurnalTersaring = SEMUA_JURNAL.filter(j => (j.tanggal || '').slice(0, 7) === masaTerpilih);
    }

    const elLabelAktif = document.getElementById('labelPeriodeAktif');
    if (elLabelAktif) elLabelAktif.innerText = labelPeriode;

    const hasil = kalkulasiLaporanKeuangan(jurnalTersaring);
    HASIL_LABA_RUGI_TERKINI = hasil;

    const elPendapatan = document.getElementById('laporanTotalPendapatan');
    const elBeban = document.getElementById('laporanTotalBeban');
    const elLaba = document.getElementById('laporanLabaBersih');

    if (elPendapatan) elPendapatan.innerText = formatRupiah(hasil.totalPendapatan);
    if (elBeban) elBeban.innerText = formatRupiah(hasil.totalBeban);
    if (elLaba) elLaba.innerText = formatRupiah(hasil.labaBersih);

    // Kartu ringkas Beranda-style untuk layar sempit (Sprint 2) - data sama.
    const elPendapatanMobile = document.getElementById('laporanTotalPendapatanMobile');
    const elBebanMobile = document.getElementById('laporanTotalBebanMobile');
    const elLabaMobile = document.getElementById('laporanLabaBersihMobile');

    if (elPendapatanMobile) elPendapatanMobile.innerText = formatRupiah(hasil.totalPendapatan);
    if (elBebanMobile) elBebanMobile.innerText = formatRupiah(hasil.totalBeban);
    if (elLabaMobile) elLabaMobile.innerText = formatRupiah(hasil.labaBersih);

    const tbody = document.getElementById('tabelLaporanAkun');
    const kartuContainer = document.getElementById('kartuLaporanAkun');
    if (!tbody) return;

    if (hasil.petaAkun.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-stone-400 dark:text-stone-500">Belum ada data transaksi untuk dilaporkan pada periode ini.</td></tr>`;
        if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-stone-400 dark:text-stone-500 text-sm">Belum ada data transaksi untuk dilaporkan pada periode ini.</p>`;
        return;
    }

    tbody.innerHTML = hasil.petaAkun.map(acc => {
        const selisihSaldo = acc.totalDebit - acc.totalKredit;
        return `
            <tr>
                <td class="p-3 font-mono font-bold text-stone-700 dark:text-stone-300">${escapeHtml(acc.kode)}</td>
                <td class="p-3 font-medium text-stone-800 dark:text-stone-200">${escapeHtml(acc.nama)}</td>
                <td class="p-3 text-right text-stone-700 dark:text-stone-300">${acc.totalDebit === 0 ? '-' : acc.totalDebit.toLocaleString('id-ID')}</td>
                <td class="p-3 text-right text-stone-700 dark:text-stone-300">${acc.totalKredit === 0 ? '-' : acc.totalKredit.toLocaleString('id-ID')}</td>
                <td class="p-3 text-right font-bold text-stone-900 dark:text-stone-100">${selisihSaldo.toLocaleString('id-ID')}</td>
            </tr>
        `;
    }).join('');

    if (kartuContainer) {
        kartuContainer.innerHTML = hasil.petaAkun.map(acc => {
            const selisihSaldo = acc.totalDebit - acc.totalKredit;
            return `
                <div class="border border-stone-200/70 dark:border-stone-800 rounded-[0.625rem] p-4">
                    <div class="font-medium text-stone-800 dark:text-stone-200 mb-1">${escapeHtml(acc.nama)}</div>
                    <span class="badge-tag-mobile">${escapeHtml(acc.kode)}</span>
                    <div class="grid grid-cols-3 gap-2 text-xs border-t border-stone-100 dark:border-stone-800 pt-2 mt-2.5">
                        <div><p class="text-stone-400 dark:text-stone-500">Debit</p><p class="font-semibold text-stone-700 dark:text-stone-300">${acc.totalDebit === 0 ? '-' : acc.totalDebit.toLocaleString('id-ID')}</p></div>
                        <div><p class="text-stone-400 dark:text-stone-500">Kredit</p><p class="font-semibold text-stone-700 dark:text-stone-300">${acc.totalKredit === 0 ? '-' : acc.totalKredit.toLocaleString('id-ID')}</p></div>
                        <div><p class="text-stone-400 dark:text-stone-500">Saldo</p><p class="font-bold text-stone-900 dark:text-stone-100">${selisihSaldo.toLocaleString('id-ID')}</p></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Versi cetak berjenjang (lihat blok "Cetakan Berjenjang" di atas). Ikut
    // filter periode yang sama dengan tampilan layar, karena Laba Rugi
    // (berbeda dengan Neraca) memang laporan per periode.
    const tbodyCetakLR = document.getElementById('tabelCetakLabaRugiBerjenjang');
    if (tbodyCetakLR) {
        const strukturLR = susunStrukturLabaRugi(hasil);

        const elPeriodeLR = document.getElementById('cetakPeriodeLabaRugiBerjenjang');
        if (elPeriodeLR) elPeriodeLR.innerText = labelPeriode;
        const elTglLR = document.getElementById('cetakTanggalLabaRugiBerjenjang');
        if (elTglLR) elTglLR.innerText = labelPeriode;

        let htmlCetakLR = '';
        htmlCetakLR += renderKelasBerjenjangHtml(strukturLR.pendapatan, 'TOTAL PENDAPATAN', strukturLR.formatAngkaLaporan);
        htmlCetakLR += renderKelasBerjenjangHtml(strukturLR.hpp, 'TOTAL HARGA POKOK PENJUALAN', strukturLR.formatAngkaLaporan);
        htmlCetakLR += `
            <tr class="bg-gray-100">
                <td class="text-right font-bold py-2">LABA KOTOR</td>
                <td class="text-right font-bold py-2">${strukturLR.formatAngkaLaporan(strukturLR.labaKotor)}</td>
            </tr>
        `;
        htmlCetakLR += renderKelasBerjenjangHtml(strukturLR.beban, 'TOTAL BEBAN', strukturLR.formatAngkaLaporan);
        htmlCetakLR += `
            <tr class="bg-gray-200 border-t-2 border-gray-800">
                <td class="text-right font-bold py-2">LABA/RUGI BERSIH</td>
                <td class="text-right font-bold py-2">${strukturLR.formatAngkaLaporan(strukturLR.labaBersih)}</td>
            </tr>
        `;
        tbodyCetakLR.innerHTML = htmlCetakLR;
    }

    // Cetakan Laporan Perubahan Modal - ikut filter periode yang sama.
    const tbodyCetakModal = document.getElementById('tabelCetakPerubahanModal');
    if (tbodyCetakModal) {
        const strukturModal = susunStrukturPerubahanModal(SEMUA_JURNAL, jurnalTersaring, masaTerpilih, labelPeriode);
        const fmt = strukturModal.formatAngkaLaporan;

        const elPeriodeModal = document.getElementById('cetakPeriodePerubahanModal');
        if (elPeriodeModal) elPeriodeModal.innerText = labelPeriode;

        tbodyCetakModal.innerHTML = `
            <tr>
                <td class="font-bold py-1">Modal (Awal) sebelum ${escapeHtml(labelPeriode)}</td>
                <td></td>
                <td class="text-right font-bold py-1">${fmt(strukturModal.modalAwal)}</td>
            </tr>
            <tr class="border-b border-gray-800">
                <td class="font-bold py-1">Modal (Tambahan) untuk ${escapeHtml(labelPeriode)}</td>
                <td></td>
                <td class="text-right font-bold py-1">${fmt(strukturModal.modalTambahan)}</td>
            </tr>
            <tr>
                <td class="py-1">Saldo Laba Ditahan sebelum ${escapeHtml(labelPeriode)}</td>
                <td class="text-right py-1">${fmt(strukturModal.labaDitahanAwal)}</td>
                <td></td>
            </tr>
            <tr>
                <td class="py-1">Saldo Laba Tahun Berjalan untuk ${escapeHtml(labelPeriode)}</td>
                <td class="text-right py-1">${fmt(strukturModal.labaTahunBerjalan)}</td>
                <td></td>
            </tr>
            <tr class="border-b border-gray-800">
                <td class="py-1">Dividen untuk ${escapeHtml(labelPeriode)}</td>
                <td class="text-right py-1">${fmt(strukturModal.dividen)}</td>
                <td></td>
            </tr>
            <tr class="border-b border-gray-800">
                <td class="font-bold py-1">Saldo Laba Ditahan per akhir ${escapeHtml(labelPeriode)}</td>
                <td></td>
                <td class="text-right font-bold py-1">${fmt(strukturModal.labaDitahanAkhir)}</td>
            </tr>
            <tr class="border-b-2 border-gray-800">
                <td class="font-bold py-1">Modal Akhir</td>
                <td></td>
                <td class="text-right font-bold py-1">${fmt(strukturModal.modalAkhir)}</td>
            </tr>
        `;
    }
}

window.eksporTrialBalanceKeCsv = function() {
    if (!HASIL_LABA_RUGI_TERKINI || HASIL_LABA_RUGI_TERKINI.petaAkun.length === 0) {
        return alert("Tidak ada data untuk diekspor!");
    }
    const rows = HASIL_LABA_RUGI_TERKINI.petaAkun.map(acc => [
        `"${amankanSelCsv(acc.kode)}"`, `"${amankanSelCsv(acc.nama)}"`,
        acc.totalDebit, acc.totalKredit, acc.totalDebit - acc.totalKredit
    ]);
    unduhCsv(
        `Trial_Balance_${new Date().toISOString().slice(0,10)}.csv`,
        ["Kode Akun", "Nama Akun", "Total Debit", "Total Kredit", "Saldo Akhir"],
        rows
    );
};

window.eksporNeracaKeCsv = function() {
    if (!NERACA_TERKINI) return alert("Tidak ada data untuk diekspor!");
    const rows = [];
    NERACA_TERKINI.petaAset.forEach(acc => rows.push([`"${amankanSelCsv(acc.kode)}"`, `"${amankanSelCsv(acc.nama)}"`, "Aset", acc.saldo]));
    NERACA_TERKINI.petaLiabilitas.forEach(acc => rows.push([`"${amankanSelCsv(acc.kode)}"`, `"${amankanSelCsv(acc.nama)}"`, "Liabilitas", acc.saldo]));
    NERACA_TERKINI.petaEkuitas.forEach(acc => rows.push([`"${amankanSelCsv(acc.kode)}"`, `"${amankanSelCsv(acc.nama)}"`, "Ekuitas", acc.saldo]));
    rows.push([`""`, `"Laba (Rugi) Ditahan / Berjalan"`, "Ekuitas", NERACA_TERKINI.labaKumulatif]);

    if (rows.length === 0) return alert("Tidak ada data untuk diekspor!");
    unduhCsv(
        `Neraca_${new Date().toISOString().slice(0,10)}.csv`,
        ["Kode Akun", "Nama Akun", "Kategori", "Saldo"],
        rows
    );
};

async function muatHalamanLaporan() {
    try {
        SEMUA_JURNAL = await ambilSemuaJurnalPusat();

        muatNeraca();
        isiFilterMasaLaporan();

        const select = document.getElementById('filterMasaLaporan');
        if (select) select.addEventListener('change', renderLabaRugiDanTrialBalance);

        renderLabaRugiDanTrialBalance();
    } catch (error) {
        console.error("Gagal memuat laporan keuangan:", error);
    }
}

muatHalamanLaporan();
