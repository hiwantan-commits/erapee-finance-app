// js/fiscal-page.js - Controller untuk rekonsiliasi.html
import { ambilSemuaJurnalPusat } from "./db.js";
import { escapeHtml } from "./utils.js";

async function muatDataRekonsiliasi() {
    try {
        const semuaJurnal = await ambilSemuaJurnalPusat();
        let totalMasuk = 0;
        let totalKeluar = 0;
        let rowsHTML = "";

        semuaJurnal.forEach(jurnal => {
            jurnal.rows.forEach(baris => {
                const kodeAkun = baris.kode_akun || "";
                if (kodeAkun.startsWith("11")) {
                    const debit = parseFloat(baris.debit) || 0;
                    const kredit = parseFloat(baris.kredit) || 0;

                    totalMasuk += debit;
                    totalKeluar += kredit;

                    rowsHTML += `
                        <tr>
                            <td class="p-3 font-bold text-indigo-700">${escapeHtml(jurnal.id_jurnal)}<div class="text-[11px] text-gray-400 font-normal">${escapeHtml(jurnal.tanggal)}</div></td>
                            <td class="p-3"><div class="font-medium text-gray-800">${escapeHtml(jurnal.no_bukti)}</div><div class="text-[11px] text-gray-500">${escapeHtml(jurnal.lawan_transaksi) || '-'}</div></td>
                            <td class="p-3 text-gray-600 truncate max-w-xs">${escapeHtml(baris.memo_baris) || escapeHtml(jurnal.keterangan) || '-'}</td>
                            <td class="p-3 text-right font-bold text-green-600">${debit === 0 ? '-' : debit.toLocaleString('id-ID')}</td>
                            <td class="p-3 text-right font-bold text-red-600">${kredit === 0 ? '-' : kredit.toLocaleString('id-ID')}</td>
                        </tr>
                    `;
                }
            });
        });

        const saldoBersih = totalMasuk - totalKeluar;

        const elMasuk = document.getElementById('rekonsiliasiKasMasuk');
        const elKeluar = document.getElementById('rekonsiliasiKasKeluar');
        const elBersih = document.getElementById('rekonsiliasiSaldoBersih');

        if (elMasuk) elMasuk.innerText = "Rp " + totalMasuk.toLocaleString('id-ID');
        if (elKeluar) elKeluar.innerText = "Rp " + totalKeluar.toLocaleString('id-ID');
        if (elBersih) elBersih.innerText = "Rp " + saldoBersih.toLocaleString('id-ID');

        const tbody = document.getElementById('tabelRekonsiliasi');
        if (tbody) {
            tbody.innerHTML = rowsHTML === "" ? `<tr><td colspan="5" class="p-8 text-center text-gray-400">Belum ada mutasi kas/bank tercatat pada akun kepala 11.</td></tr>` : rowsHTML;
        }

    } catch (error) {
        console.error("Gagal memuat data rekonsiliasi:", error);
    }
}

muatDataRekonsiliasi();
