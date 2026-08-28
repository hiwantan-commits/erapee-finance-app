// js/fiscal-page.js - Controller untuk rekonsiliasi.html (Laporan Arus Kas)
import { ambilSemuaJurnalPusat } from "./db.js";
import { kalkulasiArusKas } from "./accounting.js";
import { escapeHtml } from "./utils.js";

function formatRupiah(angka) {
    return "Rp " + Math.round(angka).toLocaleString('id-ID');
}

async function muatDataRekonsiliasi() {
    try {
        const semuaJurnal = await ambilSemuaJurnalPusat();
        const arusKas = kalkulasiArusKas(semuaJurnal);

        const elOperasi = document.getElementById('arusKasOperasi');
        const elInvestasi = document.getElementById('arusKasInvestasi');
        const elPendanaan = document.getElementById('arusKasPendanaan');
        const elBersih = document.getElementById('arusKasBersih');

        if (elOperasi) elOperasi.innerText = formatRupiah(arusKas.operasi);
        if (elInvestasi) elInvestasi.innerText = formatRupiah(arusKas.investasi);
        if (elPendanaan) elPendanaan.innerText = formatRupiah(arusKas.pendanaan);
        if (elBersih) elBersih.innerText = formatRupiah(arusKas.totalBersih);

        const tbody = document.getElementById('tabelRekonsiliasi');
        if (!tbody) return;

        if (arusKas.rincian.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-400">Belum ada mutasi kas/bank tercatat pada akun kepala 11.</td></tr>`;
            return;
        }

        const warnaKategori = {
            "Operasi": "bg-blue-50 text-blue-700",
            "Investasi": "bg-amber-50 text-amber-700",
            "Pendanaan": "bg-purple-50 text-purple-700"
        };

        tbody.innerHTML = arusKas.rincian.map(({ jurnal, kategori, netKas }) => `
            <tr>
                <td class="p-3 font-bold text-indigo-700">${escapeHtml(jurnal.id_jurnal)}<div class="text-[11px] text-gray-400 font-normal">${escapeHtml(jurnal.tanggal)}</div></td>
                <td class="p-3"><div class="font-medium text-gray-800">${escapeHtml(jurnal.no_bukti)}</div><div class="text-[11px] text-gray-500">${escapeHtml(jurnal.lawan_transaksi) || '-'}</div></td>
                <td class="p-3 text-gray-600 truncate max-w-xs">${escapeHtml(jurnal.keterangan) || '-'}</td>
                <td class="p-3"><span class="px-2 py-0.5 rounded font-semibold text-[11px] ${warnaKategori[kategori] || 'bg-gray-100 text-gray-600'}">${kategori}</span></td>
                <td class="p-3 text-right font-bold ${netKas >= 0 ? 'text-green-600' : 'text-red-600'}">${netKas.toLocaleString('id-ID')}</td>
            </tr>
        `).join('');

    } catch (error) {
        console.error("Gagal memuat data arus kas:", error);
    }
}

muatDataRekonsiliasi();
