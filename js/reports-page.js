// js/reports-page.js - Controller untuk laporan.html
import { ambilSemuaJurnalPusat } from "./db.js";
import { kalkulasiLaporanKeuangan } from "./accounting.js";

async function muatHalamanLaporan() {
    try {
        const semuaJurnal = await ambilSemuaJurnalPusat();
        const hasil = kalkulasiLaporanKeuangan(semuaJurnal);

        // Update Kartu Ringkasan
        const elPendapatan = document.getElementById('laporanTotalPendapatan');
        const elBeban = document.getElementById('laporanTotalBeban');
        const elLaba = document.getElementById('laporanLabaBersih');

        if (elPendapatan) elPendapatan.innerText = "Rp " + hasil.totalPendapatan.toLocaleString('id-ID');
        if (elBeban) elBeban.innerText = "Rp " + hasil.totalBeban.toLocaleString('id-ID');
        if (elLaba) elLaba.innerText = "Rp " + hasil.labaBersih.toLocaleString('id-ID');

        // Render Tabel Rekapitulasi Akun (Trial Balance)
        const tbody = document.getElementById('tabelLaporanAkun');
        if (tbody) {
            tbody.innerHTML = "";
            if (hasil.petaAkun.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-400">Belum ada data transaksi untuk dilaporkan.</td></tr>`;
                return;
            }

            hasil.petaAkun.forEach(acc => {
                const selisihSaldo = acc.totalDebit - acc.totalKredit;
                let tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="p-3 font-mono font-bold text-indigo-700">${acc.kode}</td>
                    <td class="p-3 font-medium text-gray-800">${acc.nama}</td>
                    <td class="p-3 text-right">${acc.totalDebit === 0 ? '-' : acc.totalDebit.toLocaleString('id-ID')}</td>
                    <td class="p-3 text-right">${acc.totalKredit === 0 ? '-' : acc.totalKredit.toLocaleString('id-ID')}</td>
                    <td class="p-3 text-right font-bold text-gray-900">${selisihSaldo.toLocaleString('id-ID')}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (error) {
        console.error("Gagal memuat laporan keuangan:", error);
    }
}

muatHalamanLaporan();
