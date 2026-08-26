// js/tax-page.js - Controller untuk pajak.html
import { ambilSemuaJurnalPusat } from "./db.js";

async function muatRekapPajak() {
    try {
        const semuaJurnal = await ambilSemuaJurnalPusat();
        
        let akumulasiDPP = 0;
        let akumulasiPPN = 0;
        let akumulasiPPh = 0;

        // Saring jurnal yang memiliki kode pajak selain 'NON'
        const jurnalPajak = semuaJurnal.filter(j => j.kode_pajak && j.kode_pajak !== "NON");

        const tbody = document.getElementById('tabelRekapPajak');
        if (!tbody) return;
        tbody.innerHTML = "";

        if (jurnalPajak.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-400">Belum ada transaksi berparameter pajak tercatat.</td></tr>`;
            document.getElementById('rekapTotalDPP').innerText = "Rp 0";
            document.getElementById('rekapTotalPPN').innerText = "Rp 0";
            document.getElementById('rekapTotalPPh').innerText = "Rp 0";
            return;
        }

        jurnalPajak.forEach(jurnal => {
            const dpp = parseFloat(jurnal.dpp_penjualan) || 0;
            akumulasiDPP += dpp;

            if (jurnal.kode_pajak.includes("PPN")) {
                akumulasiPPN += dpp * 0.11; // Estimasi PPN standar
            } else if (jurnal.kode_pajak.includes("PPH")) {
                akumulasiPPh += dpp * 0.02; // Estimasi rata-rata PPh pemotongan
            }

            let tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-3 font-bold text-indigo-700">${jurnal.id_jurnal}<div class="text-[11px] text-gray-400 font-normal">${jurnal.tanggal}</div></td>
                <td class="p-3"><div class="font-medium text-gray-800">${jurnal.no_bukti}</div><div class="text-[11px] text-gray-500 truncate max-w-xs">${jurnal.keterangan || '-'}</div></td>
                <td class="p-3"><span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded">${jurnal.kode_pajak}</span></td>
                <td class="p-3 text-right font-medium">${dpp === 0 ? '-' : dpp.toLocaleString('id-ID')}</td>
                <td class="p-3 text-right font-bold text-gray-800">${jurnal.total_debit.toLocaleString('id-ID')}</td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('rekapTotalDPP').innerText = "Rp " + akumulasiDPP.toLocaleString('id-ID');
        document.getElementById('rekapTotalPPN').innerText = "Rp " + akumulasiPPN.toLocaleString('id-ID');
        document.getElementById('rekapTotalPPh').innerText = "Rp " + akumulasiPPh.toLocaleString('id-ID');

    } catch (error) {
        console.error("Gagal memuat rekapitulasi pajak:", error);
    }
}

muatRekapPajak();
