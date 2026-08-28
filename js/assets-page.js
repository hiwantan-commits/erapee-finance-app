// js/assets-page.js - Controller untuk aset-tetap.html
import { ambilSemuaJurnalPusat } from "./db.js";
import { escapeHtml } from "./utils.js";

async function muatDataAset() {
    try {
        const semuaJurnal = await ambilSemuaJurnalPusat();
        let totalPerolehan = 0;
        let rowsAsetHTML = "";

        semuaJurnal.forEach(jurnal => {
            jurnal.rows.forEach(baris => {
                const kodeAkun = baris.kode_akun || "";
                if (kodeAkun.startsWith("15") || kodeAkun.startsWith("16") || (baris.nama_akun && baris.nama_akun.toLowerCase().includes("aset"))) {
                    const nilaiDebit = parseFloat(baris.debit) || 0;
                    if (nilaiDebit > 0) {
                        totalPerolehan += nilaiDebit;
                        rowsAsetHTML += `
                            <tr>
                                <td class="p-3 font-bold text-indigo-700">${escapeHtml(jurnal.id_jurnal)}<div class="text-[11px] text-gray-400 font-normal">${escapeHtml(jurnal.tanggal)}</div></td>
                                <td class="p-3"><div class="font-medium text-gray-800">${escapeHtml(jurnal.no_bukti)}</div><div class="text-[11px] text-gray-500">${escapeHtml(jurnal.keterangan) || '-'}</div></td>
                                <td class="p-3"><span class="px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold rounded">${escapeHtml(baris.kode_akun)} - ${escapeHtml(baris.nama_akun)}</span></td>
                                <td class="p-3 text-right font-bold text-gray-800">${nilaiDebit.toLocaleString('id-ID')}</td>
                            </tr>
                        `;
                    }
                }
            });
        });

        const estimasiPenyusutan = totalPerolehan * 0.10;
        const nilaiBukuBersih = totalPerolehan - estimasiPenyusutan;

        const elPerolehan = document.getElementById('totalPerolehanAset');
        const elPenyusutan = document.getElementById('totalPenyusutan');
        const elNilaiBuku = document.getElementById('totalNilaiBuku');

        if (elPerolehan) elPerolehan.innerText = "Rp " + totalPerolehan.toLocaleString('id-ID');
        if (elPenyusutan) elPenyusutan.innerText = "Rp " + estimasiPenyusutan.toLocaleString('id-ID');
        if (elNilaiBuku) elNilaiBuku.innerText = "Rp " + nilaiBukuBersih.toLocaleString('id-ID');

        const tbody = document.getElementById('tabelAsetTetap');
        if (tbody) {
            tbody.innerHTML = rowsAsetHTML === "" ? `<tr><td colspan="4" class="p-8 text-center text-gray-400">Belum ada transaksi aset tetap tercatat.</td></tr>` : rowsAsetHTML;
        }

    } catch (error) {
        console.error("Gagal memuat data aset:", error);
    }
}

muatDataAset();
