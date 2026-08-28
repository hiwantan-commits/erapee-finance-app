// js/invoice-list-page.js - Controller untuk invoice.html (daftar Invoice & Kwitansi)
import { ambilSemuaInvoice, hapusInvoice } from "./invoice-db.js";
import { escapeHtml } from "./utils.js";

let daftarInvoiceCache = [];
let halamanAktif = 1;
const dataPerHalaman = 10;

// Menu aksi per-baris memakai pola dropdown/3-titik, konsisten dengan
// Manajemen Jurnal & halaman lain.
function tombolAksiHtml(id) {
    const idAman = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const panelId = `menuAksiInvoice-${idAman}`;
    return `
        <div class="relative inline-block">
            <button type="button" onclick="window.toggleDropdownElegant(event, '${panelId}')" class="btn-elegant-icon" title="Aksi">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="12" cy="19" r="1.75"/></svg>
            </button>
            <div id="${panelId}" class="hidden absolute right-0 mt-1 z-50" data-dropdown-elegant>
                <div class="dropdown-elegant-panel">
                    <button type="button" onclick="window.location.href='/invoice-baru?id=${id}'" class="dropdown-elegant-item">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        Edit / Cetak
                    </button>
                    <div class="dropdown-elegant-divider"></div>
                    <button type="button" onclick="window.hapusInvoiceTerpilih('${id}')" class="dropdown-elegant-item dropdown-elegant-item-danger">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>
                        Hapus
                    </button>
                </div>
            </div>
        </div>
    `;
}

function hitungGrandTotal(inv) {
    return typeof inv.grand_total === 'number' ? inv.grand_total : 0;
}

function renderTabelDenganPagination(dataList) {
    const tbody = document.getElementById('tabelInvoice');
    const kartuContainer = document.getElementById('kartuMobileInvoice');
    if (!tbody) return;

    if (dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-stone-400 dark:text-stone-500">Tidak ada invoice yang cocok.</td></tr>`;
        if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-stone-400 dark:text-stone-500 text-sm">Tidak ada invoice yang cocok.</p>`;
        hapusKontrolPagination();
        return;
    }

    const totalHalaman = Math.ceil(dataList.length / dataPerHalaman);
    if (halamanAktif > totalHalaman) halamanAktif = totalHalaman;
    if (halamanAktif < 1) halamanAktif = 1;

    const indeksAwal = (halamanAktif - 1) * dataPerHalaman;
    const dataHalamanIni = dataList.slice(indeksAwal, indeksAwal + dataPerHalaman);

    tbody.innerHTML = dataHalamanIni.map(inv => `
        <tr class="hover:bg-stone-50 dark:hover:bg-stone-800/40">
            <td class="p-3 font-bold text-stone-900 dark:text-stone-100">${escapeHtml(inv.no_invoice)}</td>
            <td class="p-3 text-stone-500 dark:text-stone-400">${escapeHtml(inv.tanggal)}</td>
            <td class="p-3">
                <div class="font-medium text-stone-800 dark:text-stone-200">${escapeHtml(inv.nama_pelanggan)}</div>
                <div class="text-[11px] text-stone-400 dark:text-stone-500 truncate max-w-xs">${escapeHtml(inv.alamat_pelanggan) || '-'}</div>
            </td>
            <td class="p-3 text-right font-bold text-stone-900 dark:text-stone-100">${hitungGrandTotal(inv).toLocaleString('id-ID')}</td>
            <td class="p-3 text-center">${tombolAksiHtml(inv.id)}</td>
        </tr>
    `).join('');

    if (kartuContainer) {
        kartuContainer.innerHTML = dataHalamanIni.map(inv => `
            <div class="border border-stone-100 dark:border-stone-800 rounded-xl p-4">
                <div class="flex justify-between items-start gap-2 mb-2">
                    <div>
                        <div class="font-bold text-stone-900 dark:text-stone-100 text-sm">${escapeHtml(inv.no_invoice)}</div>
                        <div class="text-xs text-stone-400 dark:text-stone-500">${escapeHtml(inv.tanggal)}</div>
                    </div>
                    ${tombolAksiHtml(inv.id)}
                </div>
                <div class="text-sm font-medium text-stone-800 dark:text-stone-200">${escapeHtml(inv.nama_pelanggan)}</div>
                <div class="flex justify-between items-end border-t border-stone-100 dark:border-stone-800 pt-2 mt-3">
                    <span class="text-xs text-stone-400 dark:text-stone-500">Grand Total</span>
                    <div class="font-bold text-stone-900 dark:text-stone-100 text-sm">Rp ${hitungGrandTotal(inv).toLocaleString('id-ID')}</div>
                </div>
            </div>
        `).join('');
    }

    renderKontrolPagination(totalHalaman);
}

function renderKontrolPagination(totalHalaman) {
    let containerPagination = document.getElementById('pagination-container-invoice');
    if (!containerPagination) {
        containerPagination = document.createElement('div');
        containerPagination.id = 'pagination-container-invoice';
        containerPagination.className = 'flex justify-between items-center mt-4 px-2 py-3 border-t border-stone-100 dark:border-stone-800 text-xs text-stone-500 dark:text-stone-400';
        const cardTabel = document.getElementById('kartuTabelInvoice');
        if (cardTabel) cardTabel.appendChild(containerPagination);
    }

    if (totalHalaman <= 1) {
        containerPagination.innerHTML = `<span>Menampilkan seluruh invoice</span>`;
        return;
    }

    containerPagination.innerHTML = `
        <span>Halaman <b>${halamanAktif}</b> dari <b>${totalHalaman}</b></span>
        <div class="space-x-1">
            <button onclick="window.ubahHalamanInvoice(${halamanAktif - 1})" ${halamanAktif === 1 ? 'disabled class="px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-600 rounded cursor-not-allowed"' : 'class="px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 font-semibold rounded hover:bg-stone-200 dark:hover:bg-stone-700 transition"'}>Sebelumnya</button>
            <button onclick="window.ubahHalamanInvoice(${halamanAktif + 1})" ${halamanAktif === totalHalaman ? 'disabled class="px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-600 rounded cursor-not-allowed"' : 'class="px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 font-semibold rounded hover:bg-stone-200 dark:hover:bg-stone-700 transition"'}>Berikutnya</button>
        </div>
    `;
}

function hapusKontrolPagination() {
    const containerPagination = document.getElementById('pagination-container-invoice');
    if (containerPagination) containerPagination.remove();
}

function dapatkanDataTersaring() {
    const keyword = (document.getElementById('inputPencarianInvoice')?.value || '').toLowerCase();
    return daftarInvoiceCache.filter(inv =>
        !keyword ||
        (inv.no_invoice || '').toLowerCase().includes(keyword) ||
        (inv.nama_pelanggan || '').toLowerCase().includes(keyword)
    );
}

window.ubahHalamanInvoice = function(targetHalaman) {
    halamanAktif = targetHalaman;
    renderTabelDenganPagination(dapatkanDataTersaring());
};

window.filterTabelInvoice = function() {
    halamanAktif = 1;
    renderTabelDenganPagination(dapatkanDataTersaring());
};

window.hapusInvoiceTerpilih = async function(id) {
    const invoice = daftarInvoiceCache.find(inv => inv.id === id);
    const label = invoice ? invoice.no_invoice : id;
    if (confirm(`Apakah Anda yakin ingin menghapus Invoice ${label}? Tindakan ini tidak dapat dibatalkan.`)) {
        const hasil = await hapusInvoice(id);
        if (hasil.success) {
            await muatDaftarInvoice();
        } else {
            alert("Gagal menghapus invoice: " + hasil.error);
        }
    }
};

async function muatDaftarInvoice() {
    const tbody = document.getElementById('tabelInvoice');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-stone-400 dark:text-stone-500">Memuat daftar invoice...</td></tr>`;

    try {
        daftarInvoiceCache = await ambilSemuaInvoice();
        halamanAktif = 1;
        renderTabelDenganPagination(dapatkanDataTersaring());
    } catch (error) {
        console.error("Gagal memuat daftar invoice:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500 dark:text-red-400">Gagal memuat data invoice.</td></tr>`;
    }
}

muatDaftarInvoice();
