// js/tax-page.js - Controller untuk pajak.html
import { ambilSemuaJurnalPusat } from "./db.js";
import { klasifikasikanAkun, formatAngkaLaporan } from "./accounting.js";
import { CONFIG } from "./config.js";
import { escapeHtml } from "./utils.js";

let SEMUA_JURNAL_PAJAK = [];

// Menentukan arah PPN (Keluaran/Masukan) dari klasifikasi akun baris jurnal.
// Heuristik: jika ada baris yang mengkredit akun PENDAPATAN (kode awalan 4),
// transaksi dianggap Penjualan -> PPN Keluaran. Selain itu dianggap PPN Masukan (Pembelian).
// Catatan: ini estimasi berbasis kode akun karena belum ada field arah transaksi eksplisit.
function tentukanArahPPN(jurnal) {
    const adaPendapatan = jurnal.rows.some(baris =>
        klasifikasikanAkun(baris.kode_akun) === "PENDAPATAN" && (parseFloat(baris.kredit) || 0) > 0
    );
    return adaPendapatan ? "Keluaran" : "Masukan";
}

function hitungRekapPajak(daftarJurnal) {
    let rekap = {
        totalPPNKeluaran: 0,
        totalPPNMasukan: 0,
        totalPPh23: 0,
        totalDPPPh21: 0,
        baris: []
    };

    daftarJurnal.forEach(jurnal => {
        const dpp = parseFloat(jurnal.dpp_penjualan) || 0;
        const kode = jurnal.kode_pajak;
        let arah = "-";
        let nilaiPajak = null;

        if (kode.includes("PPN")) {
            arah = tentukanArahPPN(jurnal);
            nilaiPajak = dpp * CONFIG.TAX_RATES.PPN_EFEKTIF;
            if (arah === "Keluaran") {
                rekap.totalPPNKeluaran += nilaiPajak;
            } else {
                rekap.totalPPNMasukan += nilaiPajak;
            }
        } else if (kode.includes("PPH23")) {
            arah = "Pemotongan 2%";
            nilaiPajak = dpp * CONFIG.TAX_RATES.PPH23_JASA;
            rekap.totalPPh23 += nilaiPajak;
        } else if (kode.includes("PPH21")) {
            arah = "Pemotongan (Lihat Payroll)";
            rekap.totalDPPPh21 += dpp;
        }

        rekap.baris.push({ jurnal, dpp, arah, nilaiPajak });
    });

    return rekap;
}

function formatRupiah(angka) {
    return "Rp " + Math.round(angka).toLocaleString('id-ID');
}

function isiFilterMasaPajak(daftarJurnal) {
    const select = document.getElementById('filterMasaPajak');
    if (!select) return;

    const masaSet = new Set(daftarJurnal.map(j => (j.tanggal || '').slice(0, 7)).filter(Boolean));
    const daftarMasa = Array.from(masaSet).sort().reverse();

    const nilaiTerpilih = select.value || "SEMUA";
    select.innerHTML = `<option value="SEMUA">Semua Periode</option>`;
    daftarMasa.forEach(masa => {
        const opt = document.createElement('option');
        opt.value = masa;
        opt.innerText = masa;
        select.appendChild(opt);
    });
    select.value = daftarMasa.includes(nilaiTerpilih) ? nilaiTerpilih : "SEMUA";
}

// Versi cetak (gaya laporan akuntansi konvensional, selalu terang di atas
// kertas) - dipisah dari kartu ringkasan & tabel di layar yang tetap
// memakai gaya elegant/stone seperti sebelumnya.
function renderCetakPajakBerjenjang(rekap, kurangLebihBayar) {
    const elKeluaran = document.getElementById('cetakPpnKeluaranBerjenjang');
    const elMasukan = document.getElementById('cetakPpnMasukanBerjenjang');
    const elKurangLebih = document.getElementById('cetakPpnKurangLebihBerjenjang');
    const elKurangLebihLabel = document.getElementById('cetakPpnKurangLebihLabel');
    const elPPh23 = document.getElementById('cetakPph23Berjenjang');
    const elDPPPh21 = document.getElementById('cetakDppPph21Berjenjang');
    const tbody = document.getElementById('tabelCetakPajakBerjenjang');
    if (!tbody) return; // Elemen cetak tidak ada di halaman ini

    if (elKeluaran) elKeluaran.innerText = formatAngkaLaporan(rekap.totalPPNKeluaran);
    if (elMasukan) elMasukan.innerText = formatAngkaLaporan(rekap.totalPPNMasukan);
    if (elPPh23) elPPh23.innerText = formatAngkaLaporan(rekap.totalPPh23);
    if (elDPPPh21) elDPPPh21.innerText = formatAngkaLaporan(rekap.totalDPPPh21);
    if (elKurangLebih) elKurangLebih.innerText = formatAngkaLaporan(Math.abs(kurangLebihBayar));
    if (elKurangLebihLabel) {
        elKurangLebihLabel.innerText = kurangLebihBayar >= 0 ? "PPN Kurang Bayar" : "PPN Lebih Bayar";
    }

    if (rekap.baris.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-gray-500">Belum ada transaksi berparameter pajak tercatat pada periode ini.</td></tr>`;
        return;
    }

    const kelompok = {};
    rekap.baris.forEach(item => {
        const masa = (item.jurnal.tanggal || '').slice(0, 7) || 'TANPA-TANGGAL';
        if (!kelompok[masa]) kelompok[masa] = [];
        kelompok[masa].push(item);
    });

    let html = '';
    Object.keys(kelompok).sort().reverse().forEach(masa => {
        html += `<tr><td colspan="6" class="pt-3 pb-1 font-bold">Masa Pajak ${escapeHtml(masa)}</td></tr>`;
        kelompok[masa].forEach(({ jurnal, dpp, arah, nilaiPajak }) => {
            html += `
                <tr class="border-b border-gray-200">
                    <td class="py-1 pr-2">${escapeHtml(jurnal.id_jurnal)}<div class="text-xs text-gray-500">${escapeHtml(jurnal.tanggal)}</div></td>
                    <td class="py-1 pr-2">${escapeHtml(jurnal.no_bukti)}<div class="text-xs text-gray-500">${escapeHtml(jurnal.keterangan) || '-'}</div></td>
                    <td class="py-1 pr-2">${escapeHtml(jurnal.kode_pajak)}</td>
                    <td class="py-1 pr-2">${arah}</td>
                    <td class="py-1 pr-2 text-right">${dpp === 0 ? '-' : formatAngkaLaporan(dpp)}</td>
                    <td class="py-1 text-right">${nilaiPajak === null ? '-' : formatAngkaLaporan(nilaiPajak)}</td>
                </tr>
            `;
        });
    });
    tbody.innerHTML = html;
}

function renderRekapPajak() {
    const select = document.getElementById('filterMasaPajak');
    const masaTerpilih = select ? select.value : "SEMUA";
    const labelPeriode = masaTerpilih === "SEMUA" ? "Semua Periode" : masaTerpilih;

    const elCetakPeriodeBerjenjang = document.getElementById('cetakPeriodePajakBerjenjang');
    if (elCetakPeriodeBerjenjang) elCetakPeriodeBerjenjang.innerText = labelPeriode;

    const jurnalTersaring = masaTerpilih === "SEMUA"
        ? SEMUA_JURNAL_PAJAK
        : SEMUA_JURNAL_PAJAK.filter(j => (j.tanggal || '').slice(0, 7) === masaTerpilih);

    const rekap = hitungRekapPajak(jurnalTersaring);
    const kurangLebihBayar = rekap.totalPPNKeluaran - rekap.totalPPNMasukan;

    const elKeluaran = document.getElementById('rekapPPNKeluaran');
    const elMasukan = document.getElementById('rekapPPNMasukan');
    const elKurangLebih = document.getElementById('rekapPPNKurangLebih');
    const elPPh23 = document.getElementById('rekapPPh23');
    const elDPPPh21 = document.getElementById('rekapDPPPh21');

    if (elKeluaran) elKeluaran.innerText = formatRupiah(rekap.totalPPNKeluaran);
    if (elMasukan) elMasukan.innerText = formatRupiah(rekap.totalPPNMasukan);
    if (elPPh23) elPPh23.innerText = formatRupiah(rekap.totalPPh23);
    if (elDPPPh21) elDPPPh21.innerText = formatRupiah(rekap.totalDPPPh21);

    if (elKurangLebih) {
        const label = kurangLebihBayar >= 0 ? "Kurang Bayar" : "Lebih Bayar";
        elKurangLebih.innerText = formatRupiah(Math.abs(kurangLebihBayar)) + " (" + label + ")";
        elKurangLebih.className = elKurangLebih.className
            .replace(/text-(red|green|emerald)-600|dark:text-(red|emerald)-400/g, "").trim()
            + " " + (kurangLebihBayar >= 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400");
    }

    renderCetakPajakBerjenjang(rekap, kurangLebihBayar);

    const tbody = document.getElementById('tabelRekapPajak');
    if (!tbody) return;
    tbody.innerHTML = "";

    if (rekap.baris.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-stone-400 dark:text-stone-500">Belum ada transaksi berparameter pajak tercatat pada periode ini.</td></tr>`;
        return;
    }

    // Kelompokkan baris per Masa Pajak (bulan) agar sesuai unit pelaporan SPT Masa
    const kelompok = {};
    rekap.baris.forEach(item => {
        const masa = (item.jurnal.tanggal || '').slice(0, 7) || 'TANPA-TANGGAL';
        if (!kelompok[masa]) kelompok[masa] = [];
        kelompok[masa].push(item);
    });

    Object.keys(kelompok).sort().reverse().forEach(masa => {
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `<td colspan="6" class="p-2 bg-stone-100 dark:bg-stone-800 font-bold text-stone-600 dark:text-stone-300 text-[11px] uppercase tracking-wide">Masa Pajak ${escapeHtml(masa)}</td>`;
        tbody.appendChild(headerRow);

        kelompok[masa].forEach(({ jurnal, dpp, arah, nilaiPajak }) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-3 font-bold text-stone-900 dark:text-stone-100">${escapeHtml(jurnal.id_jurnal)}<div class="text-[11px] text-stone-400 dark:text-stone-500 font-normal">${escapeHtml(jurnal.tanggal)}</div></td>
                <td class="p-3"><div class="font-medium text-stone-800 dark:text-stone-200">${escapeHtml(jurnal.no_bukti)}</div><div class="text-[11px] text-stone-500 dark:text-stone-400 truncate max-w-xs">${escapeHtml(jurnal.keterangan) || '-'}</div></td>
                <td class="p-3"><span class="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold rounded">${escapeHtml(jurnal.kode_pajak)}</span></td>
                <td class="p-3 text-xs text-stone-600 dark:text-stone-300">${arah}</td>
                <td class="p-3 text-right font-medium text-stone-800 dark:text-stone-200">${dpp === 0 ? '-' : dpp.toLocaleString('id-ID')}</td>
                <td class="p-3 text-right font-bold text-stone-800 dark:text-stone-200">${nilaiPajak === null ? '-' : Math.round(nilaiPajak).toLocaleString('id-ID')}</td>
            `;
            tbody.appendChild(tr);
        });
    });
}

async function muatRekapPajak() {
    try {
        const semuaJurnal = await ambilSemuaJurnalPusat();
        SEMUA_JURNAL_PAJAK = semuaJurnal.filter(j => j.kode_pajak && j.kode_pajak !== "NON");

        isiFilterMasaPajak(SEMUA_JURNAL_PAJAK);

        const select = document.getElementById('filterMasaPajak');
        if (select) select.addEventListener('change', renderRekapPajak);

        renderRekapPajak();
    } catch (error) {
        console.error("Gagal memuat rekapitulasi pajak:", error);
    }
}

muatRekapPajak();
