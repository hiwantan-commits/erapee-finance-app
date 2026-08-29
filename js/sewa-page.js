// js/sewa-page.js - Controller untuk sewa.html (Master Sewa Dibayar Dimuka & Skedul Amortisasi)
import { db } from "./config.js";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { hitungAmortisasiSewa } from "./accounting.js";
import { escapeHtml } from "./utils.js";

const KOLEKSI_SEWA = "sewa_dibayar_dimuka";
let coaArray = []; // Array COA (dipakai untuk mengisi pilihan akun Sewa)

function formatRupiah(angka) {
    return "Rp " + Math.round(angka).toLocaleString('id-ID');
}

// Kedua field akun di form ini SENGAJA berupa <select> berisi HANYA akun
// yang sudah ditandai kategori_sewa=true di Master COA (bukan pencarian
// bebas ke seluruh COA) - supaya user memilih dari daftar akun yang memang
// sudah disiapkan untuk sewa, bukan mengetik kode sembarangan. Dipisah
// berdasarkan digit pertama kode (1=Aset untuk Prabayar, 6=Beban untuk
// Beban Sewa), mengikuti aturan klasifikasi yang sama dengan
// klasifikasikanAkun() di accounting.js.
function populateAkunSewaSelects() {
    const selectPrabayar = document.getElementById('akunPrabayarSewa');
    const selectBeban = document.getElementById('akunBebanSewa');
    if (!selectPrabayar || !selectBeban) return;

    const akunSewa = coaArray.filter(c => c.kategori_sewa);
    const akunPrabayarList = akunSewa.filter(c => String(c.kode).startsWith('1'));
    const akunBebanList = akunSewa.filter(c => String(c.kode).startsWith('6'));

    const buatOpsi = (list, teksKosong) => {
        if (list.length === 0) return `<option value="">${teksKosong}</option>`;
        return '<option value="">Pilih akun...</option>' + list.map(c =>
            `<option value="${escapeHtml(c.kode)}">${escapeHtml(c.kode)} - ${escapeHtml(c.nama)}</option>`
        ).join('');
    };

    const nilaiSebelumnyaPrabayar = selectPrabayar.value;
    const nilaiSebelumnyaBeban = selectBeban.value;
    selectPrabayar.innerHTML = buatOpsi(akunPrabayarList, 'Belum ada akun Sewa (Aset) ditandai di Master COA');
    selectBeban.innerHTML = buatOpsi(akunBebanList, 'Belum ada akun Sewa (Beban) ditandai di Master COA');
    if (nilaiSebelumnyaPrabayar) selectPrabayar.value = nilaiSebelumnyaPrabayar;
    if (nilaiSebelumnyaBeban) selectBeban.value = nilaiSebelumnyaBeban;
}

// Menu aksi per-baris memakai pola dropdown/3-titik, konsisten dengan
// Aset Tetap & Manajemen Jurnal.
function tombolAksiSewaHtml(encId) {
    const idAman = String(encId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const panelId = `menuAksiSewa-${idAman}`;
    return `
        <div class="relative inline-block">
            <button type="button" onclick="window.toggleDropdownElegant(event, '${panelId}')" class="btn-elegant-icon" title="Aksi">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="12" cy="19" r="1.75"/></svg>
            </button>
            <div id="${panelId}" class="hidden absolute right-0 mt-1 z-50" data-dropdown-elegant>
                <div class="dropdown-elegant-panel">
                    <button type="button" onclick="window.editSewa('${encId}')" class="dropdown-elegant-item">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        Edit
                    </button>
                    <div class="dropdown-elegant-divider"></div>
                    <button type="button" onclick="window.hapusSewa('${encId}')" class="dropdown-elegant-item dropdown-elegant-item-danger">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>
                        Hapus
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function muatDaftarSewa() {
    const tbody = document.getElementById('tabelDaftarSewa');
    const kartuContainer = document.getElementById('kartuDaftarSewa');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-stone-400 dark:text-stone-500">Memuat daftar sewa...</td></tr>`;

    try {
        const snap = await getDocs(collection(db, KOLEKSI_SEWA));
        let daftarSewa = [];
        snap.forEach(docSnap => daftarSewa.push({ id: docSnap.id, ...docSnap.data() }));
        daftarSewa.sort((a, b) => (a.tanggal_mulai || '').localeCompare(b.tanggal_mulai || ''));

        let totalNilai = 0, totalAmortisasi = 0, totalSisa = 0;

        if (daftarSewa.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-stone-400 dark:text-stone-500">Belum ada perjanjian sewa terdaftar. Tambahkan lewat form di atas.</td></tr>`;
            if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-stone-400 dark:text-stone-500 text-sm">Belum ada perjanjian sewa terdaftar. Tambahkan lewat form di atas.</p>`;
        } else {
            const barisTabel = [];
            const kartuMobile = [];

            daftarSewa.forEach(sewa => {
                const hasil = hitungAmortisasiSewa(sewa);
                totalNilai += hasil.nilaiTotal;
                totalAmortisasi += hasil.akumulasiAmortisasi;
                totalSisa += hasil.nilaiBuku;

                const encId = encodeURIComponent(sewa.id);
                const periode = `${escapeHtml(sewa.tanggal_mulai)} s/d ${escapeHtml(sewa.tanggal_selesai)}`;

                barisTabel.push(`
                    <tr id="row-sewa-${sewa.id}" class="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors">
                        <td class="p-3 text-xs font-medium text-stone-800 dark:text-stone-200">${escapeHtml(sewa.nama_sewa)}</td>
                        <td class="p-3 text-xs text-stone-500 dark:text-stone-400">${periode}</td>
                        <td class="p-3 text-xs"><span class="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded font-semibold">${escapeHtml(sewa.unit_usaha || '-')}</span></td>
                        <td class="p-3 text-xs text-right font-medium text-stone-800 dark:text-stone-200">${hasil.nilaiTotal.toLocaleString('id-ID')}</td>
                        <td class="p-3 text-xs text-right text-amber-600 dark:text-amber-400">${Math.round(hasil.akumulasiAmortisasi).toLocaleString('id-ID')}</td>
                        <td class="p-3 text-xs text-right font-bold text-emerald-600 dark:text-emerald-400">${Math.round(hasil.nilaiBuku).toLocaleString('id-ID')}</td>
                        <td class="p-3 text-center">${tombolAksiSewaHtml(encId)}</td>
                    </tr>
                `);

                kartuMobile.push(`
                    <div id="kartu-sewa-${sewa.id}" class="border border-stone-100 dark:border-stone-800 rounded-xl p-4">
                        <div class="flex justify-between items-start gap-2 mb-2">
                            <div>
                                <div class="font-bold text-stone-900 dark:text-stone-100 text-sm">${escapeHtml(sewa.nama_sewa)}</div>
                                <div class="text-xs text-stone-400 dark:text-stone-500">${periode}</div>
                            </div>
                            <span class="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded font-semibold text-[11px]">${escapeHtml(sewa.unit_usaha || '-')}</span>
                        </div>
                        <div class="grid grid-cols-3 gap-2 text-xs border-t border-stone-100 dark:border-stone-800 pt-2 mb-3">
                            <div><p class="text-stone-400 dark:text-stone-500">Total</p><p class="font-semibold text-stone-700 dark:text-stone-300">${hasil.nilaiTotal.toLocaleString('id-ID')}</p></div>
                            <div><p class="text-stone-400 dark:text-stone-500">Teramortisasi</p><p class="font-semibold text-amber-600 dark:text-amber-400">${Math.round(hasil.akumulasiAmortisasi).toLocaleString('id-ID')}</p></div>
                            <div><p class="text-stone-400 dark:text-stone-500">Sisa</p><p class="font-bold text-emerald-600 dark:text-emerald-400">${Math.round(hasil.nilaiBuku).toLocaleString('id-ID')}</p></div>
                        </div>
                        <div class="flex justify-end">
                            ${tombolAksiSewaHtml(encId)}
                        </div>
                    </div>
                `);
            });

            tbody.innerHTML = barisTabel.join('');
            if (kartuContainer) kartuContainer.innerHTML = kartuMobile.join('');
        }

        const elTotal = document.getElementById('totalNilaiSewa');
        const elAmortisasi = document.getElementById('totalAmortisasiSewa');
        const elSisa = document.getElementById('sisaNilaiSewa');
        if (elTotal) elTotal.innerText = formatRupiah(totalNilai);
        if (elAmortisasi) elAmortisasi.innerText = formatRupiah(totalAmortisasi);
        if (elSisa) elSisa.innerText = formatRupiah(totalSisa);

        window.dataSewaGlobal = {};
        daftarSewa.forEach(s => { window.dataSewaGlobal[s.id] = s; });

    } catch (error) {
        console.error("Gagal memuat daftar sewa:", error);
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500 dark:text-red-400">Gagal memuat data sewa.</td></tr>`;
        if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-red-500 dark:text-red-400 text-sm">Gagal memuat data sewa.</p>`;
    }
}

window.editSewa = function(encId) {
    const id = decodeURIComponent(encId);
    const sewa = window.dataSewaGlobal[id];
    if (!sewa) return;

    document.querySelectorAll('#tabelDaftarSewa tr, #kartuDaftarSewa > div').forEach(el => el.classList.remove('bg-amber-50', 'dark:bg-amber-900/20'));
    const activeRow = document.getElementById(`row-sewa-${id}`);
    if (activeRow) activeRow.classList.add('bg-amber-50', 'dark:bg-amber-900/20');
    const activeCard = document.getElementById(`kartu-sewa-${id}`);
    if (activeCard) activeCard.classList.add('bg-amber-50', 'dark:bg-amber-900/20');

    document.getElementById('editIdSewa').value = id;
    document.getElementById('namaSewa').value = sewa.nama_sewa || '';
    document.getElementById('tanggalMulaiSewa').value = sewa.tanggal_mulai || '';
    document.getElementById('tanggalSelesaiSewa').value = sewa.tanggal_selesai || '';
    document.getElementById('nilaiTotalSewa').value = sewa.nilai_total || 0;
    document.getElementById('keteranganSewa').value = sewa.keterangan || '';
    document.getElementById('akunPrabayarSewa').value = sewa.kode_akun_prabayar || '';
    document.getElementById('akunBebanSewa').value = sewa.kode_akun_beban_sewa || '';

    const selectUnitEl = document.getElementById('unitUsahaSewa');
    if (selectUnitEl) {
        const unitVal = sewa.unit_usaha || '';
        for (let opt of selectUnitEl.options) {
            if (opt.value.startsWith(unitVal)) {
                selectUnitEl.value = opt.value;
                break;
            }
        }
    }

    const btn = document.getElementById('btnSimpanSewa');
    btn.innerText = 'Update Sewa';
    document.getElementById('btnBatalSewa').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.batalEditSewa = function() {
    document.querySelectorAll('#tabelDaftarSewa tr, #kartuDaftarSewa > div').forEach(el => el.classList.remove('bg-amber-50', 'dark:bg-amber-900/20'));
    document.getElementById('formSewa').reset();
    document.getElementById('editIdSewa').value = '';

    const btn = document.getElementById('btnSimpanSewa');
    btn.innerText = 'Simpan Perjanjian Sewa';
    document.getElementById('btnBatalSewa').classList.add('hidden');
};

window.hapusSewa = async function(encId) {
    const id = decodeURIComponent(encId);
    if (confirm('Yakin hapus perjanjian sewa ini dari daftar? Riwayat transaksi pembayaran di jurnal tidak akan ikut terhapus.')) {
        try {
            await deleteDoc(doc(db, KOLEKSI_SEWA, id));
            muatDaftarSewa();
        } catch (error) {
            alert('Gagal menghapus sewa: ' + error.message);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    muatDaftarSewa();

    (async () => {
        try {
            const snapUnit = await getDocs(collection(db, "master_unit_usaha"));
            const selectUnit = document.getElementById('unitUsahaSewa');
            if (selectUnit) {
                let units = [];
                snapUnit.forEach(d => units.push(d.data()));
                selectUnit.innerHTML = '<option value="">Pilih Unit...</option>';
                units.forEach(u => {
                    const label = escapeHtml(u.kode) + " - " + escapeHtml(u.nama);
                    selectUnit.innerHTML += `<option value="${label}">${label}</option>`;
                });
            }
        } catch (err) {}

        try {
            const snapCOA = await getDocs(collection(db, "master_coa"));
            let coaList = [];
            snapCOA.forEach(d => coaList.push(d.data()));
            coaList.sort((a, b) => a.kode.localeCompare(b.kode));
            coaArray = coaList;
            populateAkunSewaSelects();
        } catch (err) {}
    })();

    const formSewa = document.getElementById('formSewa');
    if (formSewa) {
        formSewa.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnSimpanSewa');
            const editId = document.getElementById('editIdSewa').value;

            const tanggalMulai = document.getElementById('tanggalMulaiSewa').value;
            const tanggalSelesai = document.getElementById('tanggalSelesaiSewa').value;
            if (tanggalSelesai <= tanggalMulai) {
                alert('❌ Tanggal Selesai harus setelah Tanggal Mulai.');
                return;
            }

            const rawUnitValue = document.getElementById('unitUsahaSewa').value;
            const cleanUnitCode = rawUnitValue ? rawUnitValue.split(' - ')[0].trim() : '';

            btn.disabled = true;
            btn.innerText = 'Menyimpan...';

            const payload = {
                nama_sewa: document.getElementById('namaSewa').value.trim(),
                unit_usaha: cleanUnitCode,
                tanggal_mulai: tanggalMulai,
                tanggal_selesai: tanggalSelesai,
                nilai_total: parseFloat(document.getElementById('nilaiTotalSewa').value) || 0,
                keterangan: document.getElementById('keteranganSewa').value.trim(),
                kode_akun_prabayar: document.getElementById('akunPrabayarSewa').value,
                kode_akun_beban_sewa: document.getElementById('akunBebanSewa').value
            };

            try {
                if (editId) {
                    await updateDoc(doc(db, KOLEKSI_SEWA, editId), payload);
                    window.batalEditSewa();
                } else {
                    await addDoc(collection(db, KOLEKSI_SEWA), payload);
                    formSewa.reset();
                    btn.disabled = false;
                    btn.innerText = 'Simpan Perjanjian Sewa';
                }
                muatDaftarSewa();
            } catch (error) {
                alert('Gagal menyimpan sewa: ' + error.message);
                btn.disabled = false;
                btn.innerText = editId ? 'Update Sewa' : 'Simpan Perjanjian Sewa';
            }
        });
    }
});
