// js/reports-page.js - Controller untuk laporan.html
import { ambilSemuaJurnalPusat } from "./db.js";
import { kalkulasiLaporanKeuangan, kalkulasiNeraca } from "./accounting.js";
import { escapeHtml } from "./utils.js";

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

function muatNeraca(semuaJurnal) {
    const neraca = kalkulasiNeraca(semuaJurnal);

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

async function muatHalamanLaporan() {
    try {
        const semuaJurnal = await ambilSemuaJurnalPusat();
        muatNeraca(semuaJurnal);
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
                    <td class="p-3 font-mono font-bold text-indigo-700">${escapeHtml(acc.kode)}</td>
                    <td class="p-3 font-medium text-gray-800">${escapeHtml(acc.nama)}</td>
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
