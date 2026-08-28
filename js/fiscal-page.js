// js/fiscal-page.js - Controller untuk rekonsiliasi.html (Laporan Arus Kas)
import { ambilSemuaJurnalPusat } from "./db.js";
import { kalkulasiArusKas, susunStrukturArusKas } from "./accounting.js";
import { escapeHtml, amankanSelCsv, unduhCsv } from "./utils.js";

let SEMUA_JURNAL = [];

function formatRupiah(angka) {
    return "Rp " + Math.round(angka).toLocaleString('id-ID');
}

const WARNA_KATEGORI = {
    "Operasi": "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300",
    "Investasi": "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    "Pendanaan": "bg-[#D97757]/10 text-[#D97757]"
};

function isiFilterMasaArusKas() {
    const select = document.getElementById('filterMasaArusKas');
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

function renderKartu(item) {
    const { jurnal, kategori, netKas } = item;
    return `
        <div class="border border-stone-100 dark:border-stone-800 rounded-xl p-4">
            <div class="flex justify-between items-start gap-2 mb-2">
                <div>
                    <div class="font-bold text-stone-900 dark:text-stone-100 text-sm">${escapeHtml(jurnal.id_jurnal)}</div>
                    <div class="text-xs text-stone-400 dark:text-stone-500">${escapeHtml(jurnal.tanggal)}</div>
                </div>
                <span class="px-2 py-0.5 rounded font-semibold text-[11px] ${WARNA_KATEGORI[kategori] || 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'}">${kategori}</span>
            </div>
            <div class="text-xs text-stone-500 dark:text-stone-400 mb-1">${escapeHtml(jurnal.no_bukti)} &middot; ${escapeHtml(jurnal.lawan_transaksi) || '-'}</div>
            <div class="text-sm text-stone-700 dark:text-stone-300 mb-2">${escapeHtml(jurnal.keterangan) || '-'}</div>
            <div class="text-right font-bold ${netKas >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'} border-t border-stone-100 dark:border-stone-800 pt-2">
                ${netKas.toLocaleString('id-ID')}
            </div>
        </div>
    `;
}

function renderLaporanArusKas() {
    const select = document.getElementById('filterMasaArusKas');
    const masaTerpilih = select ? select.value : "SEMUA";

    const elCetakPeriode = document.getElementById('cetakPeriodeArusKas');
    if (elCetakPeriode) elCetakPeriode.innerText = masaTerpilih === "SEMUA" ? "Semua Periode" : masaTerpilih;

    const jurnalTersaring = masaTerpilih === "SEMUA"
        ? SEMUA_JURNAL
        : SEMUA_JURNAL.filter(j => (j.tanggal || '').slice(0, 7) === masaTerpilih);

    const arusKas = kalkulasiArusKas(jurnalTersaring);

    const elOperasi = document.getElementById('arusKasOperasi');
    const elInvestasi = document.getElementById('arusKasInvestasi');
    const elPendanaan = document.getElementById('arusKasPendanaan');
    const elBersih = document.getElementById('arusKasBersih');

    if (elOperasi) elOperasi.innerText = formatRupiah(arusKas.operasi);
    if (elInvestasi) elInvestasi.innerText = formatRupiah(arusKas.investasi);
    if (elPendanaan) elPendanaan.innerText = formatRupiah(arusKas.pendanaan);
    if (elBersih) elBersih.innerText = formatRupiah(arusKas.totalBersih);

    const tbody = document.getElementById('tabelRekonsiliasi');
    const kartuContainer = document.getElementById('kartuRekonsiliasi');

    if (arusKas.rincian.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-stone-400 dark:text-stone-500">Belum ada mutasi kas/bank tercatat pada periode ini.</td></tr>`;
        if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-stone-400 dark:text-stone-500 text-sm">Belum ada mutasi kas/bank tercatat pada periode ini.</p>`;
        return;
    }

    if (tbody) {
        tbody.innerHTML = arusKas.rincian.map(({ jurnal, kategori, netKas }) => `
            <tr>
                <td class="p-3 font-bold text-stone-900 dark:text-stone-100">${escapeHtml(jurnal.id_jurnal)}<div class="text-[11px] text-stone-400 dark:text-stone-500 font-normal">${escapeHtml(jurnal.tanggal)}</div></td>
                <td class="p-3"><div class="font-medium text-stone-800 dark:text-stone-200">${escapeHtml(jurnal.no_bukti)}</div><div class="text-[11px] text-stone-500 dark:text-stone-400">${escapeHtml(jurnal.lawan_transaksi) || '-'}</div></td>
                <td class="p-3 text-stone-600 dark:text-stone-300 truncate max-w-xs">${escapeHtml(jurnal.keterangan) || '-'}</td>
                <td class="p-3"><span class="px-2 py-0.5 rounded font-semibold text-[11px] ${WARNA_KATEGORI[kategori] || 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'}">${kategori}</span></td>
                <td class="p-3 text-right font-bold ${netKas >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}">${netKas.toLocaleString('id-ID')}</td>
            </tr>
        `).join('');
    }

    if (kartuContainer) {
        kartuContainer.innerHTML = arusKas.rincian.map(renderKartu).join('');
    }

    renderCetakArusKasBerjenjang(arusKas, masaTerpilih);
}

// Versi cetak berjenjang (lihat susunStrukturArusKas() di accounting.js untuk
// penjelasan keterbatasan dibanding software akuntansi yang punya sub-kelompok
// rinci per akun lawan transaksi).
function renderCetakArusKasBerjenjang(arusKas, masaTerpilih) {
    const tbody = document.getElementById('tabelCetakArusKasBerjenjang');
    if (!tbody) return;

    const struktur = susunStrukturArusKas(SEMUA_JURNAL, arusKas, masaTerpilih);
    const formatAngka = struktur.formatAngkaLaporan;

    const renderBarisRincian = (r) => `
        <tr>
            <td class="pl-4 py-0.5">${escapeHtml(r.jurnal.id_jurnal)} - ${escapeHtml(r.jurnal.keterangan) || escapeHtml(r.jurnal.lawan_transaksi) || '-'}</td>
            <td class="text-right py-0.5">${formatAngka(r.netKas)}</td>
        </tr>
    `;

    const renderKelompokAktivitas = (kelompok, labelJudul, labelTotal) => {
        let html = `<tr><td colspan="2" class="pt-4 pb-1 font-bold">${kelompok.nomor}. ${labelJudul}</td></tr>`;
        if (kelompok.rincian.length === 0) {
            html += `<tr><td class="pl-4 py-0.5 text-gray-500">Tidak ada mutasi pada kategori ini.</td><td></td></tr>`;
        } else {
            html += kelompok.rincian.map(renderBarisRincian).join('');
        }
        html += `
            <tr class="border-t border-gray-400">
                <td class="text-right font-bold pt-2 pb-4">${labelTotal}</td>
                <td class="text-right font-bold pt-2 pb-4">${formatAngka(kelompok.total)}</td>
            </tr>
        `;
        return html;
    };

    let html = '';
    html += renderKelompokAktivitas(struktur.operasi, 'ARUS KAS DARI OPERASIONAL', 'TOTAL ARUS KAS DARI OPERASIONAL');
    html += renderKelompokAktivitas(struktur.investasi, 'ARUS KAS DARI INVESTASI', 'TOTAL ARUS KAS DARI INVESTASI');
    html += renderKelompokAktivitas(struktur.pendanaan, 'ARUS KAS DARI PENDANAAN', 'TOTAL ARUS KAS DARI PENDANAAN');
    html += `
        <tr class="border-t-2 border-gray-800">
            <td class="text-right font-bold pt-4">KAS PADA SAAT AWAL PERIODE</td>
            <td class="text-right font-bold pt-4">${formatAngka(struktur.kasAwal)}</td>
        </tr>
        <tr>
            <td class="text-right font-bold py-1">TOTAL KAS YANG DITERIMA</td>
            <td class="text-right font-bold py-1">${formatAngka(struktur.totalDiterima)}</td>
        </tr>
        <tr class="bg-gray-200 border-t border-gray-800">
            <td class="text-right font-bold py-2">KAS PADA SAAT AKHIR PERIODE</td>
            <td class="text-right font-bold py-2">${formatAngka(struktur.kasAkhir)}</td>
        </tr>
    `;
    tbody.innerHTML = html;
}

window.eksporArusKasKeCsv = function() {
    const select = document.getElementById('filterMasaArusKas');
    const masaTerpilih = select ? select.value : "SEMUA";
    const jurnalTersaring = masaTerpilih === "SEMUA"
        ? SEMUA_JURNAL
        : SEMUA_JURNAL.filter(j => (j.tanggal || '').slice(0, 7) === masaTerpilih);

    const arusKas = kalkulasiArusKas(jurnalTersaring);
    if (arusKas.rincian.length === 0) return alert("Tidak ada data untuk diekspor!");

    const rows = arusKas.rincian.map(({ jurnal, kategori, netKas }) => [
        `"${amankanSelCsv(jurnal.id_jurnal)}"`, `"${amankanSelCsv(jurnal.tanggal)}"`, `"${amankanSelCsv(jurnal.no_bukti)}"`,
        `"${amankanSelCsv(jurnal.lawan_transaksi || '')}"`, `"${amankanSelCsv((jurnal.keterangan || '').replace(/"/g, '""'))}"`,
        `"${amankanSelCsv(kategori)}"`, netKas
    ]);

    unduhCsv(
        `Laporan_Arus_Kas_${new Date().toISOString().slice(0,10)}.csv`,
        ["ID Jurnal", "Tanggal", "No Bukti", "Lawan Transaksi", "Keterangan", "Kategori", "Net Kas"],
        rows
    );
};

async function muatDataRekonsiliasi() {
    try {
        SEMUA_JURNAL = await ambilSemuaJurnalPusat();

        isiFilterMasaArusKas();
        const select = document.getElementById('filterMasaArusKas');
        if (select) select.addEventListener('change', renderLaporanArusKas);

        renderLaporanArusKas();
    } catch (error) {
        console.error("Gagal memuat data arus kas:", error);
    }
}

muatDataRekonsiliasi();
