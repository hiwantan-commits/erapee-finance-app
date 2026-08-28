// js/fiscal-page.js - Controller untuk rekonsiliasi.html (Laporan Arus Kas)
import { ambilSemuaJurnalPusat } from "./db.js";
import { kalkulasiArusKas } from "./accounting.js";
import { db } from "./config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { escapeHtml, amankanSelCsv, unduhCsv } from "./utils.js";

let SEMUA_JURNAL = [];

function formatRupiah(angka) {
    return "Rp " + Math.round(angka).toLocaleString('id-ID');
}

const WARNA_KATEGORI = {
    "Operasi": "bg-blue-50 text-blue-700",
    "Investasi": "bg-amber-50 text-amber-700",
    "Pendanaan": "bg-purple-50 text-purple-700"
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
        <div class="border border-gray-100 rounded-xl p-4">
            <div class="flex justify-between items-start gap-2 mb-2">
                <div>
                    <div class="font-bold text-indigo-700 text-sm">${escapeHtml(jurnal.id_jurnal)}</div>
                    <div class="text-xs text-gray-500">${escapeHtml(jurnal.tanggal)}</div>
                </div>
                <span class="px-2 py-0.5 rounded font-semibold text-[11px] ${WARNA_KATEGORI[kategori] || 'bg-gray-100 text-gray-600'}">${kategori}</span>
            </div>
            <div class="text-xs text-gray-500 mb-1">${escapeHtml(jurnal.no_bukti)} &middot; ${escapeHtml(jurnal.lawan_transaksi) || '-'}</div>
            <div class="text-sm text-gray-700 mb-2">${escapeHtml(jurnal.keterangan) || '-'}</div>
            <div class="text-right font-bold ${netKas >= 0 ? 'text-green-600' : 'text-red-600'} border-t border-gray-100 pt-2">
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
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-400">Belum ada mutasi kas/bank tercatat pada periode ini.</td></tr>`;
        if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-gray-400 text-sm">Belum ada mutasi kas/bank tercatat pada periode ini.</p>`;
        return;
    }

    if (tbody) {
        tbody.innerHTML = arusKas.rincian.map(({ jurnal, kategori, netKas }) => `
            <tr>
                <td class="p-3 font-bold text-indigo-700">${escapeHtml(jurnal.id_jurnal)}<div class="text-[11px] text-gray-400 font-normal">${escapeHtml(jurnal.tanggal)}</div></td>
                <td class="p-3"><div class="font-medium text-gray-800">${escapeHtml(jurnal.no_bukti)}</div><div class="text-[11px] text-gray-500">${escapeHtml(jurnal.lawan_transaksi) || '-'}</div></td>
                <td class="p-3 text-gray-600 truncate max-w-xs">${escapeHtml(jurnal.keterangan) || '-'}</td>
                <td class="p-3"><span class="px-2 py-0.5 rounded font-semibold text-[11px] ${WARNA_KATEGORI[kategori] || 'bg-gray-100 text-gray-600'}">${kategori}</span></td>
                <td class="p-3 text-right font-bold ${netKas >= 0 ? 'text-green-600' : 'text-red-600'}">${netKas.toLocaleString('id-ID')}</td>
            </tr>
        `).join('');
    }

    if (kartuContainer) {
        kartuContainer.innerHTML = arusKas.rincian.map(renderKartu).join('');
    }
}

async function muatDataKopCetak() {
    const elTanggal = document.getElementById('cetakTanggalDibuatArusKas');
    if (elTanggal) {
        elTanggal.innerText = "Dicetak: " + new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
    }

    try {
        const snap = await getDoc(doc(db, "pengaturan", "profil_perusahaan"));
        const elNpwp = document.getElementById('cetakNpwpArusKas');
        if (elNpwp && snap.exists() && snap.data().npwp_perseroan) {
            elNpwp.innerText = "NPWP: " + snap.data().npwp_perseroan;
        }
    } catch (error) {
        console.error("Gagal memuat profil perusahaan untuk kop cetak:", error);
    }
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
        muatDataKopCetak();
    } catch (error) {
        console.error("Gagal memuat data arus kas:", error);
    }
}

muatDataRekonsiliasi();
