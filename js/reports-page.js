// js/reports-page.js - Controller untuk laporan.html
import { ambilSemuaJurnalPusat } from "./db.js";
import { kalkulasiLaporanKeuangan, kalkulasiNeraca } from "./accounting.js";
import { db } from "./config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { escapeHtml, amankanSelCsv, unduhCsv } from "./utils.js";

let SEMUA_JURNAL = [];

function formatRupiah(angka) {
    return "Rp " + Math.round(angka).toLocaleString('id-ID');
}

function renderBarisNeraca(tbody, daftarAkun, warnaKode) {
    if (daftarAkun.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" class="p-3 text-center text-gray-400 text-xs">Belum ada data.</td></tr>`;
        return;
    }
    tbody.innerHTML = daftarAkun.map(acc => `
        <tr>
            <td class="p-2 text-xs"><span class="font-mono font-bold ${warnaKode}">${escapeHtml(acc.kode)}</span> ${escapeHtml(acc.nama)}</td>
            <td class="p-2 text-xs text-right font-medium">${acc.saldo === 0 ? '-' : acc.saldo.toLocaleString('id-ID')}</td>
        </tr>
    `).join('');
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

    if (elStatus) {
        if (neraca.seimbang) {
            elStatus.className = "px-2 py-0.5 bg-green-100 text-green-700 font-semibold rounded text-xs";
            elStatus.innerText = "✓ SEIMBANG";
        } else {
            elStatus.className = "px-2 py-0.5 bg-red-100 text-red-700 font-semibold rounded text-xs";
            elStatus.innerText = "⚠️ TIDAK SEIMBANG";
        }
    }

    const tbodyAset = document.getElementById('tabelNeracaAset');
    const tbodyLiabilitasEkuitas = document.getElementById('tabelNeracaLiabilitasEkuitas');

    if (tbodyAset) renderBarisNeraca(tbodyAset, neraca.petaAset, 'text-indigo-700');

    if (tbodyLiabilitasEkuitas) {
        let html = '';
        html += `<tr class="bg-gray-50"><td colspan="2" class="p-2 text-[11px] font-bold text-gray-500 uppercase">Liabilitas</td></tr>`;
        html += neraca.petaLiabilitas.length === 0
            ? `<tr><td colspan="2" class="p-3 text-center text-gray-400 text-xs">Belum ada data.</td></tr>`
            : neraca.petaLiabilitas.map(acc => `
                <tr>
                    <td class="p-2 text-xs"><span class="font-mono font-bold text-red-700">${escapeHtml(acc.kode)}</span> ${escapeHtml(acc.nama)}</td>
                    <td class="p-2 text-xs text-right font-medium">${acc.saldo === 0 ? '-' : acc.saldo.toLocaleString('id-ID')}</td>
                </tr>
            `).join('');
        html += `<tr class="bg-gray-50"><td colspan="2" class="p-2 text-[11px] font-bold text-gray-500 uppercase">Ekuitas</td></tr>`;
        html += neraca.petaEkuitas.map(acc => `
            <tr>
                <td class="p-2 text-xs"><span class="font-mono font-bold text-amber-700">${escapeHtml(acc.kode)}</span> ${escapeHtml(acc.nama)}</td>
                <td class="p-2 text-xs text-right font-medium">${acc.saldo === 0 ? '-' : acc.saldo.toLocaleString('id-ID')}</td>
            </tr>
        `).join('');
        html += `
            <tr class="border-t border-gray-200">
                <td class="p-2 text-xs font-semibold text-gray-600">Laba (Rugi) Ditahan / Berjalan *</td>
                <td class="p-2 text-xs text-right font-semibold">${neraca.labaKumulatif.toLocaleString('id-ID')}</td>
            </tr>
        `;
        tbodyLiabilitasEkuitas.innerHTML = html;
    }
}

function isiFilterMasaLaporan() {
    const select = document.getElementById('filterMasaLaporan');
    if (!select) return;

    const masaSet = new Set(SEMUA_JURNAL.map(j => (j.tanggal || '').slice(0, 7)).filter(Boolean));
    const daftarMasa = Array.from(masaSet).sort().reverse();

    select.innerHTML = `<option value="SEMUA">Semua Periode</option>`;
    daftarMasa.forEach(masa => {
        const opt = document.createElement('option');
        opt.value = masa;
        opt.innerText = masa;
        select.appendChild(opt);
    });
}

let HASIL_LABA_RUGI_TERKINI = null;

function renderLabaRugiDanTrialBalance() {
    const select = document.getElementById('filterMasaLaporan');
    const masaTerpilih = select ? select.value : "SEMUA";

    const labelPeriode = masaTerpilih === "SEMUA" ? "Semua Periode" : masaTerpilih;
    const elCetakPeriode = document.getElementById('cetakPeriodeLaporan');
    if (elCetakPeriode) elCetakPeriode.innerText = labelPeriode;
    const elLabelAktif = document.getElementById('labelPeriodeAktif');
    if (elLabelAktif) elLabelAktif.innerText = labelPeriode;

    const jurnalTersaring = masaTerpilih === "SEMUA"
        ? SEMUA_JURNAL
        : SEMUA_JURNAL.filter(j => (j.tanggal || '').slice(0, 7) === masaTerpilih);

    const hasil = kalkulasiLaporanKeuangan(jurnalTersaring);
    HASIL_LABA_RUGI_TERKINI = hasil;

    const elPendapatan = document.getElementById('laporanTotalPendapatan');
    const elBeban = document.getElementById('laporanTotalBeban');
    const elLaba = document.getElementById('laporanLabaBersih');

    if (elPendapatan) elPendapatan.innerText = formatRupiah(hasil.totalPendapatan);
    if (elBeban) elBeban.innerText = formatRupiah(hasil.totalBeban);
    if (elLaba) elLaba.innerText = formatRupiah(hasil.labaBersih);

    const tbody = document.getElementById('tabelLaporanAkun');
    const kartuContainer = document.getElementById('kartuLaporanAkun');
    if (!tbody) return;

    if (hasil.petaAkun.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-400">Belum ada data transaksi untuk dilaporkan pada periode ini.</td></tr>`;
        if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-gray-400 text-sm">Belum ada data transaksi untuk dilaporkan pada periode ini.</p>`;
        return;
    }

    tbody.innerHTML = hasil.petaAkun.map(acc => {
        const selisihSaldo = acc.totalDebit - acc.totalKredit;
        return `
            <tr>
                <td class="p-3 font-mono font-bold text-indigo-700">${escapeHtml(acc.kode)}</td>
                <td class="p-3 font-medium text-gray-800">${escapeHtml(acc.nama)}</td>
                <td class="p-3 text-right">${acc.totalDebit === 0 ? '-' : acc.totalDebit.toLocaleString('id-ID')}</td>
                <td class="p-3 text-right">${acc.totalKredit === 0 ? '-' : acc.totalKredit.toLocaleString('id-ID')}</td>
                <td class="p-3 text-right font-bold text-gray-900">${selisihSaldo.toLocaleString('id-ID')}</td>
            </tr>
        `;
    }).join('');

    if (kartuContainer) {
        kartuContainer.innerHTML = hasil.petaAkun.map(acc => {
            const selisihSaldo = acc.totalDebit - acc.totalKredit;
            return `
                <div class="border border-gray-100 rounded-xl p-4">
                    <div class="font-mono font-bold text-indigo-700 text-sm">${escapeHtml(acc.kode)}</div>
                    <div class="font-medium text-gray-800 mb-2">${escapeHtml(acc.nama)}</div>
                    <div class="grid grid-cols-3 gap-2 text-xs border-t border-gray-100 pt-2">
                        <div><p class="text-gray-400">Debit</p><p class="font-semibold">${acc.totalDebit === 0 ? '-' : acc.totalDebit.toLocaleString('id-ID')}</p></div>
                        <div><p class="text-gray-400">Kredit</p><p class="font-semibold">${acc.totalKredit === 0 ? '-' : acc.totalKredit.toLocaleString('id-ID')}</p></div>
                        <div><p class="text-gray-400">Saldo</p><p class="font-bold text-gray-900">${selisihSaldo.toLocaleString('id-ID')}</p></div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

async function muatDataKopCetak() {
    const elTanggal = document.getElementById('cetakTanggalDibuatLaporan');
    if (elTanggal) {
        elTanggal.innerText = "Dicetak: " + new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
    }

    try {
        const snap = await getDoc(doc(db, "pengaturan", "profil_perusahaan"));
        const elNpwp = document.getElementById('cetakNpwpLaporan');
        if (elNpwp && snap.exists() && snap.data().npwp_perseroan) {
            elNpwp.innerText = "NPWP: " + snap.data().npwp_perseroan;
        }
    } catch (error) {
        console.error("Gagal memuat profil perusahaan untuk kop cetak:", error);
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
        muatDataKopCetak();
    } catch (error) {
        console.error("Gagal memuat laporan keuangan:", error);
    }
}

muatHalamanLaporan();
