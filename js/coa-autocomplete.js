// js/coa-autocomplete.js - Dropdown pencarian akun (COA) yang dipakai bersama
// oleh beberapa form (Input Jurnal, Aset Tetap, Sewa Dibayar Dimuka, dst).
// Diekstrak murni dari js/journal-page.js tanpa mengubah perilakunya sama
// sekali, supaya form lain yang butuh input akun tidak perlu menduplikasi
// logika dropdown/keyboard-navigation ini.
import { escapeHtml } from "./utils.js";

// `ambilCoaArray` adalah fungsi () => array COA saat ini (bukan array
// langsung), supaya pemanggil tetap bisa memperbarui daftar COA-nya
// belakangan (mis. setelah fetch async selesai) tanpa perlu memasang ulang
// autocomplete di setiap input yang sudah ada.
export function pasangAutocompleteAkun(inputEl, ambilCoaArray) {
    let dropdownEl = null;
    let indexAktif = -1;

    function tutupDropdown() {
        if (dropdownEl) {
            dropdownEl.remove();
            dropdownEl = null;
        }
        indexAktif = -1;
        window.removeEventListener('scroll', saatScrollLuar, true);
    }

    // Tutup dropdown hanya kalau yang di-scroll itu DI LUAR dropdown
    // (misalnya tabel/halaman) - scroll di dalam daftar hasil sendiri
    // (saat mencari akun ke bawah) tidak boleh menutup dropdown-nya.
    function saatScrollLuar(e) {
        if (dropdownEl && e.target instanceof Node && dropdownEl.contains(e.target)) return;
        tutupDropdown();
    }

    function pilihOpsi(coa) {
        inputEl.value = `${coa.kode} - ${coa.nama}`;
        tutupDropdown();
        inputEl.dispatchEvent(new Event('change'));
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
        const coaArray = ambilCoaArray();
        const hasil = coaArray.filter(c =>
            !kataKunci || c.kode.toLowerCase().includes(kataKunci) || c.nama.toLowerCase().includes(kataKunci)
        ).slice(0, 50);

        tutupDropdown();
        if (hasil.length === 0) return;

        dropdownEl = document.createElement('div');
        dropdownEl.className = 'fixed z-50 max-h-56 overflow-y-auto bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg text-xs';
        const rect = inputEl.getBoundingClientRect();
        dropdownEl.style.left = rect.left + 'px';
        dropdownEl.style.top = (rect.bottom + 4) + 'px';
        dropdownEl.style.width = rect.width + 'px';

        hasil.forEach(coa => {
            const opt = document.createElement('div');
            opt.className = 'px-3 py-2 cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-800 flex justify-between gap-3';
            opt.innerHTML = `<span class="font-mono font-bold text-stone-700 dark:text-stone-300 shrink-0">${escapeHtml(coa.kode)}</span><span class="text-stone-500 dark:text-stone-400 truncate">${escapeHtml(coa.nama)}</span>`;
            opt.addEventListener('mousedown', (e) => { e.preventDefault(); pilihOpsi(coa); });
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
