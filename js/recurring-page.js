// js/recurring-page.js - Controller untuk jurnal-berulang.html (generate
// draft otomatis penyusutan/amortisasi + antrean persetujuan per item).
import { generateDanUpsertDraf, ambilSemuaDraf, setujuiDraf, tolakDraf } from "./recurring-db.js";
import { escapeHtml } from "./utils.js";

let semuaDraf = [];
let tabAktif = 'PENDING';
const terpilih = new Set();

function formatRupiah(angka) {
    return "Rp " + Math.round(angka).toLocaleString('id-ID');
}

const LABEL_SUMBER = {
    PENYUSUTAN_ASET: { label: 'Penyusutan Aset', kelas: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' },
    AMORTISASI_SEWA: { label: 'Amortisasi Sewa', kelas: 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400' }
};

const LABEL_STATUS = {
    PENDING: { label: 'Menunggu', kelas: 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300' },
    APPROVED: { label: 'Disetujui', kelas: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
    REJECTED: { label: 'Ditolak', kelas: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' }
};

function badgeSumberHtml(draf) {
    const info = LABEL_SUMBER[draf.sumber_modul] || { label: draf.sumber_modul, kelas: 'bg-stone-100 dark:bg-stone-800 text-stone-600' };
    return `
        <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${info.kelas}">${escapeHtml(info.label)}</span>
        <div class="font-medium text-stone-800 dark:text-stone-200 mt-1">${escapeHtml(draf.sumber_nama || '-')}</div>
    `;
}

function badgeStatusHtml(status) {
    const info = LABEL_STATUS[status] || { label: status, kelas: 'bg-stone-100 dark:bg-stone-800 text-stone-600' };
    return `<span class="px-2 py-0.5 rounded text-[10px] font-semibold ${info.kelas}">${escapeHtml(info.label)}</span>`;
}

function akunRingkasHtml(draf) {
    const baris = draf.rows || [];
    const debit = baris.find(r => (parseFloat(r.debit) || 0) > 0);
    const kredit = baris.find(r => (parseFloat(r.kredit) || 0) > 0);
    const kodeDebit = debit ? debit.kode_akun : '-';
    const kodeKredit = kredit ? kredit.kode_akun : '-';
    return `<span class="font-mono text-stone-600 dark:text-stone-300">${escapeHtml(kodeDebit)}</span> → <span class="font-mono text-stone-600 dark:text-stone-300">${escapeHtml(kodeKredit)}</span>`;
}

// Menu aksi per-baris 3-titik (Setujui/Tolak) - hanya ditampilkan untuk
// draft berstatus PENDING, mengikuti pola dropdown yang sudah ada di
// halaman lain (assets-page.js, sewa-page.js).
function tombolAksiDrafHtml(encId, status) {
    if (status !== 'PENDING') {
        return `<span class="text-stone-300 dark:text-stone-700 text-xs">-</span>`;
    }
    const idAman = String(encId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const panelId = `menuAksiDraf-${idAman}`;
    return `
        <div class="relative inline-block">
            <button type="button" onclick="window.toggleDropdownElegant(event, '${panelId}')" class="btn-elegant-icon" title="Aksi">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="12" cy="19" r="1.75"/></svg>
            </button>
            <div id="${panelId}" class="hidden absolute right-0 mt-1 z-50" data-dropdown-elegant>
                <div class="dropdown-elegant-panel">
                    <button type="button" onclick="window.setujuiSatu('${encId}')" class="dropdown-elegant-item">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                        Setujui
                    </button>
                    <div class="dropdown-elegant-divider"></div>
                    <button type="button" onclick="window.tolakSatu('${encId}')" class="dropdown-elegant-item dropdown-elegant-item-danger">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        Tolak
                    </button>
                </div>
            </div>
        </div>
    `;
}

function perbaruiRingkasan() {
    const draftMenunggu = semuaDraf.filter(d => d.status === 'PENDING');
    const totalNominal = draftMenunggu.reduce((sum, d) => sum + (parseFloat(d.nominal) || 0), 0);
    document.getElementById('jumlahMenunggu').innerText = draftMenunggu.length;
    document.getElementById('totalNominalMenunggu').innerText = formatRupiah(totalNominal);
}

function perbaruiBarAksiMassal() {
    const bar = document.getElementById('barAksiMassal');
    const jumlahEl = document.getElementById('jumlahTerpilih');
    if (!bar) return;
    if (terpilih.size > 0 && tabAktif === 'PENDING') {
        bar.classList.remove('hidden');
        bar.classList.add('flex');
        if (jumlahEl) jumlahEl.innerText = terpilih.size;
    } else {
        bar.classList.add('hidden');
        bar.classList.remove('flex');
    }
}

function renderDraf() {
    const tbody = document.getElementById('tabelDraf');
    const kartuContainer = document.getElementById('kartuDraf');
    if (!tbody) return;

    const daftarTampil = semuaDraf.filter(d => d.status === tabAktif);

    if (daftarTampil.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-stone-400 dark:text-stone-500">Tidak ada draft dengan status ini.</td></tr>`;
        if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-stone-400 dark:text-stone-500 text-sm">Tidak ada draft dengan status ini.</p>`;
        perbaruiBarAksiMassal();
        return;
    }

    const barisTabel = [];
    const kartuMobile = [];

    daftarTampil.forEach(draf => {
        const encId = encodeURIComponent(draf.id);
        const dicentang = terpilih.has(draf.id);
        const checkboxHtml = draf.status === 'PENDING'
            ? `<input type="checkbox" data-id-draf="${encId}" onchange="window.toggleCheckboxDraf('${encId}', this.checked)" ${dicentang ? 'checked' : ''}>`
            : '';

        barisTabel.push(`
            <tr id="row-draf-${draf.id}" class="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors">
                <td class="p-3">${checkboxHtml}</td>
                <td class="p-3 text-xs">${badgeSumberHtml(draf)}</td>
                <td class="p-3 text-xs text-stone-500 dark:text-stone-400">${escapeHtml(draf.periode)}<div class="text-[10px] text-stone-400 dark:text-stone-500">${escapeHtml(draf.tanggal || '')}</div></td>
                <td class="p-3 text-xs">${akunRingkasHtml(draf)}</td>
                <td class="p-3 text-xs text-right font-semibold text-stone-800 dark:text-stone-200">${Math.round(draf.nominal || 0).toLocaleString('id-ID')}</td>
                <td class="p-3 text-xs">${badgeStatusHtml(draf.status)}</td>
                <td class="p-3 text-center">${tombolAksiDrafHtml(encId, draf.status)}</td>
            </tr>
        `);

        kartuMobile.push(`
            <div id="kartu-draf-${draf.id}" class="border border-stone-100 dark:border-stone-800 rounded-xl p-4">
                <div class="flex justify-between items-start gap-2 mb-2">
                    <div class="flex items-start gap-2">
                        ${checkboxHtml ? `<div class="pt-1">${checkboxHtml}</div>` : ''}
                        <div>${badgeSumberHtml(draf)}</div>
                    </div>
                    ${badgeStatusHtml(draf.status)}
                </div>
                <div class="grid grid-cols-2 gap-2 text-xs border-t border-stone-100 dark:border-stone-800 pt-2 mb-3">
                    <div><p class="text-stone-400 dark:text-stone-500">Periode</p><p class="font-semibold text-stone-700 dark:text-stone-300">${escapeHtml(draf.periode)}</p></div>
                    <div><p class="text-stone-400 dark:text-stone-500">Nominal</p><p class="font-bold text-stone-800 dark:text-stone-200">${Math.round(draf.nominal || 0).toLocaleString('id-ID')}</p></div>
                    <div class="col-span-2"><p class="text-stone-400 dark:text-stone-500">Akun</p><p>${akunRingkasHtml(draf)}</p></div>
                </div>
                <div class="flex justify-end">
                    ${tombolAksiDrafHtml(encId, draf.status)}
                </div>
            </div>
        `);
    });

    tbody.innerHTML = barisTabel.join('');
    if (kartuContainer) kartuContainer.innerHTML = kartuMobile.join('');

    window.dataDrafGlobal = {};
    semuaDraf.forEach(d => { window.dataDrafGlobal[d.id] = d; });

    perbaruiBarAksiMassal();
}

window.gantiTabDraf = function(status) {
    tabAktif = status;
    terpilih.clear();
    document.querySelectorAll('[data-tab-status]').forEach(el => {
        el.classList.toggle('is-active', el.dataset.tabStatus === status);
    });
    const checkboxSemua = document.getElementById('checkboxSemua');
    if (checkboxSemua) checkboxSemua.checked = false;
    renderDraf();
};

window.toggleCheckboxDraf = function(encId, dicentang) {
    const id = decodeURIComponent(encId);
    if (dicentang) terpilih.add(id); else terpilih.delete(id);
    perbaruiBarAksiMassal();
};

window.toggleSemuaCheckbox = function(checkboxSemua) {
    const daftarTampil = semuaDraf.filter(d => d.status === tabAktif && d.status === 'PENDING');
    if (checkboxSemua.checked) {
        daftarTampil.forEach(d => terpilih.add(d.id));
    } else {
        daftarTampil.forEach(d => terpilih.delete(d.id));
    }
    renderDraf();
};

async function prosesSatuPersatu(daftarId, aksi) {
    let berhasil = 0, gagal = 0;
    for (const id of daftarId) {
        const draf = window.dataDrafGlobal[id];
        if (!draf) { gagal++; continue; }
        const hasil = aksi === 'setuju' ? await setujuiDraf(id, draf) : await tolakDraf(id);
        if (hasil.success) berhasil++; else gagal++;
    }
    return { berhasil, gagal };
}

window.setujuiSatu = async function(encId) {
    const id = decodeURIComponent(encId);
    if (!confirm('Setujui draft ini dan posting sebagai jurnal ke Buku Besar?')) return;
    const { gagal } = await prosesSatuPersatu([id], 'setuju');
    if (gagal > 0) alert('Gagal menyetujui draft. Silakan cek kembali data akun terkait.');
    terpilih.delete(id);
    await muatDraf();
};

window.tolakSatu = async function(encId) {
    const id = decodeURIComponent(encId);
    if (!confirm('Tolak draft ini? Draft yang ditolak tidak akan digenerate ulang secara otomatis.')) return;
    await prosesSatuPersatu([id], 'tolak');
    terpilih.delete(id);
    await muatDraf();
};

window.setujuiTerpilih = async function() {
    if (terpilih.size === 0) return;
    if (!confirm(`Setujui ${terpilih.size} draft terpilih dan posting sebagai jurnal ke Buku Besar?`)) return;
    const { berhasil, gagal } = await prosesSatuPersatu(Array.from(terpilih), 'setuju');
    terpilih.clear();
    alert(`Selesai: ${berhasil} draft berhasil disetujui${gagal > 0 ? `, ${gagal} gagal (cek data akun terkait)` : ''}.`);
    await muatDraf();
};

window.tolakTerpilih = async function() {
    if (terpilih.size === 0) return;
    if (!confirm(`Tolak ${terpilih.size} draft terpilih?`)) return;
    const { berhasil, gagal } = await prosesSatuPersatu(Array.from(terpilih), 'tolak');
    terpilih.clear();
    alert(`Selesai: ${berhasil} draft berhasil ditolak${gagal > 0 ? `, ${gagal} gagal` : ''}.`);
    await muatDraf();
};

function tampilkanPeringatan(warnings) {
    const area = document.getElementById('areaPeringatan');
    const daftar = document.getElementById('daftarPeringatan');
    if (!area || !daftar) return;
    if (!warnings || warnings.length === 0) {
        area.classList.add('hidden');
        daftar.innerHTML = '';
        return;
    }
    daftar.innerHTML = warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('');
    area.classList.remove('hidden');
}

async function muatDraf(generateDulu = false) {
    const tbody = document.getElementById('tabelDraf');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-stone-400 dark:text-stone-500">Memuat draft jurnal berulang...</td></tr>`;

    try {
        if (generateDulu) {
            const hasilGenerate = await generateDanUpsertDraf();
            tampilkanPeringatan(hasilGenerate.warnings);
        }
        semuaDraf = await ambilSemuaDraf();
        perbaruiRingkasan();
        renderDraf();
    } catch (error) {
        console.error("Gagal memuat draft jurnal berulang:", error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500 dark:text-red-400">Gagal memuat data draft jurnal berulang.</td></tr>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    muatDraf(true);

    const btnGenerate = document.getElementById('btnGenerateUlang');
    if (btnGenerate) {
        btnGenerate.addEventListener('click', async () => {
            btnGenerate.disabled = true;
            btnGenerate.innerText = 'Memindai...';
            await muatDraf(true);
            btnGenerate.disabled = false;
            btnGenerate.innerHTML = `
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2.1l4 4-4 4"/><path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8"/><path d="M7 21.9l-4-4 4-4"/><path d="M21 11.8v2a4 4 0 0 1-4 4H4.2"/></svg>
                Generate Ulang
            `;
        });
    }
});
