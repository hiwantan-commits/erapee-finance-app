// js/transaksi-picker.js - Dropdown pencarian transaksi jurnal, dipakai
// bersama oleh form Sewa Dibayar Dimuka & Aset Tetap untuk fitur "Isi
// Otomatis dari Transaksi Jurnal". Diekstrak murni dari js/sewa-page.js
// (sebelumnya bernama pasangPilihTransaksiSewa) tanpa mengubah perilakunya
// sama sekali, supaya Aset Tetap tidak perlu menduplikasi logika dropdown/
// keyboard-navigation ini.
import { escapeHtml } from "./utils.js";

// `ambilKandidat` adalah fungsi () => array kandidat transaksi saat ini
// (bukan array langsung), supaya pemanggil bisa memperbarui daftarnya
// belakangan (mis. setelah fetch async selesai). Tiap kandidat berbentuk
// { id_jurnal, tanggal, no_bukti, keterangan, lawan_transaksi, kode_akun,
// nominal, ... field tambahan lain sesuai kebutuhan pemanggil }.
// `onPilih(kandidat)` dipanggil saat user memilih salah satu opsi.
export function pasangPilihTransaksi(inputEl, ambilKandidat, onPilih) {
    let dropdownEl = null;
    let indexAktif = -1;

    function tutupDropdown() {
        if (dropdownEl) { dropdownEl.remove(); dropdownEl = null; }
        indexAktif = -1;
        window.removeEventListener('scroll', saatScrollLuar, true);
    }
    function saatScrollLuar(e) {
        if (dropdownEl && e.target instanceof Node && dropdownEl.contains(e.target)) return;
        tutupDropdown();
    }
    function pilihOpsi(t) {
        inputEl.value = `${t.no_bukti} - ${t.lawan_transaksi || t.keterangan || ''}`;
        tutupDropdown();
        onPilih(t);
    }
    function perbaruiSorotan(opsiEl) {
        opsiEl.forEach((el, i) => {
            el.classList.toggle('bg-stone-100', i === indexAktif);
            el.classList.toggle('dark:bg-stone-800', i === indexAktif);
        });
        if (indexAktif >= 0) opsiEl[indexAktif].scrollIntoView({ block: 'nearest' });
    }
    function tampilkanDropdown() {
        const kataKunci = inputEl.value.toLowerCase().trim();
        const daftar = ambilKandidat();
        const hasil = daftar.filter(t =>
            !kataKunci ||
            (t.no_bukti || '').toLowerCase().includes(kataKunci) ||
            (t.keterangan || '').toLowerCase().includes(kataKunci) ||
            (t.lawan_transaksi || '').toLowerCase().includes(kataKunci)
        ).slice(0, 50);

        tutupDropdown();
        if (hasil.length === 0) return;

        dropdownEl = document.createElement('div');
        dropdownEl.className = 'fixed z-50 max-h-64 overflow-y-auto bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg text-xs';
        const rect = inputEl.getBoundingClientRect();
        dropdownEl.style.left = rect.left + 'px';
        dropdownEl.style.top = (rect.bottom + 4) + 'px';
        dropdownEl.style.width = rect.width + 'px';

        hasil.forEach(t => {
            const opt = document.createElement('div');
            opt.className = 'px-3 py-2 cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-800';
            opt.innerHTML = `
                <div class="flex justify-between gap-3">
                    <span class="font-mono font-bold text-stone-700 dark:text-stone-300">${escapeHtml(t.no_bukti || t.id_jurnal)}</span>
                    <span class="text-stone-400 dark:text-stone-500">${escapeHtml(t.tanggal || '')}</span>
                </div>
                <div class="flex justify-between gap-3 mt-0.5">
                    <span class="text-stone-600 dark:text-stone-300 truncate">${escapeHtml(t.lawan_transaksi || t.keterangan || '-')}</span>
                    <span class="font-semibold text-stone-700 dark:text-stone-300 shrink-0">${Math.round(t.nominal).toLocaleString('id-ID')}</span>
                </div>
            `;
            opt.addEventListener('mousedown', (e) => { e.preventDefault(); pilihOpsi(t); });
            dropdownEl.appendChild(opt);
        });

        document.body.appendChild(dropdownEl);
        window.addEventListener('scroll', saatScrollLuar, true);
    }

    inputEl.addEventListener('focus', tampilkanDropdown);
    inputEl.addEventListener('input', tampilkanDropdown);
    inputEl.addEventListener('blur', () => setTimeout(tutupDropdown, 150));
    inputEl.addEventListener('keydown', (e) => {
        if (!dropdownEl) return;
        const opsiEl = Array.from(dropdownEl.children);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            indexAktif = Math.min(indexAktif + 1, opsiEl.length - 1);
            perbaruiSorotan(opsiEl);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            indexAktif = Math.max(indexAktif - 1, 0);
            perbaruiSorotan(opsiEl);
        } else if (e.key === 'Escape') {
            tutupDropdown();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const target = indexAktif >= 0 ? opsiEl[indexAktif] : opsiEl[0];
            if (target) target.dispatchEvent(new MouseEvent('mousedown'));
        }
    });
}
