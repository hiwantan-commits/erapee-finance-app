// js/sewa-page.js - Controller untuk sewa.html (Master Sewa Dibayar Dimuka & Skedul Amortisasi)
import { db } from "./config.js";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ambilBarisJurnalPerKodeAkun } from "./db.js";
import { hitungAmortisasiSewa } from "./accounting.js";
import { pasangAutocompleteAkun } from "./coa-autocomplete.js";
import { pasangPilihTransaksi } from "./transaksi-picker.js";
import { escapeHtml } from "./utils.js";
import { ambilUserAktif } from "./auth.js";

const KOLEKSI_SEWA = "sewa_dibayar_dimuka";
let coaArray = []; // Array COA untuk mapping otomatis di input akun (sama pola dengan journal-page.js)

// Auditor bersifat read-only di seluruh aplikasi (lihat js/auth.js) - boleh
// tetap melihat daftar & skedul amortisasi, tapi tidak boleh mengubah/menghapus.
const adalahAuditor = ambilUserAktif().role === 'Auditor';

// Mengubah daftar KODE akun bertag kategori_sewa (sisi Aset, mewakili momen
// pembayaran sewa dimuka) di Master COA jadi "kandidat transaksi sewa" siap
// pakai untuk fitur "Isi Otomatis dari Transaksi Jurnal". `barisJurnal` sudah
// difilter kode_akun-nya di sisi Firestore lewat ambilBarisJurnalPerKodeAkun()
// (query where(...,"in",...)) - sebelumnya fungsi ini yang menyaring dari
// SELURUH koleksi jurnal_transaksi di klien, dan cara lama itu makin
// lambat/mahal seiring jumlah transaksi bertambah.
function bangunKandidatTransaksiSewa(barisJurnal) {
    const kandidat = [];
    barisJurnal.forEach(row => {
        const debit = parseFloat(row.debit) || 0;
        if (debit > 0) {
            kandidat.push({
                id_jurnal: row.id_jurnal,
                tanggal: row.tanggal,
                no_bukti: row.no_bukti,
                keterangan: row.keterangan || '',
                lawan_transaksi: row.lawan_transaksi || '',
                kode_akun: row.kode_akun,
                nominal: debit
            });
        }
    });
    kandidat.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
    return kandidat;
}

function formatRupiah(angka) {
    return "Rp " + Math.round(angka).toLocaleString('id-ID');
}

// Ambil kode akun bersih dari value input yang berformat "KODE - Nama Akun"
// (sama pola dengan pembersihan unit_usaha di journal-page.js).
function ambilKodeDariInputAkun(inputEl) {
    const raw = inputEl.value || '';
    return raw.split(' - ')[0].trim();
}

// Menu aksi per-baris memakai pola dropdown/3-titik, konsisten dengan
// Aset Tetap & Manajemen Jurnal. Tidak ditampilkan sama sekali untuk
// Auditor - baik Edit maupun Hapus bukan aksi yang berguna untuk role
// read-only (Edit hanya membuka form pendaftaran yang sudah disembunyikan,
// Hapus akan ditolak Firestore rules).
function tombolAksiSewaHtml(encId) {
    if (adalahAuditor) return `<span class="text-stone-300 dark:text-stone-700 text-xs">-</span>`;
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

function isiInputAkun(inputEl, kode) {
    if (!inputEl) return;
    const found = coaArray.find(c => c.kode === kode);
    inputEl.value = found ? `${found.kode} - ${found.nama}` : (kode || '');
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
    document.getElementById('noBuktiSumberSewa').value = sewa.no_bukti_sumber || '';
    document.getElementById('namaSewa').value = sewa.nama_sewa || '';
    document.getElementById('tanggalMulaiSewa').value = sewa.tanggal_mulai || '';
    document.getElementById('tanggalSelesaiSewa').value = sewa.tanggal_selesai || '';
    document.getElementById('nilaiTotalSewa').value = sewa.nilai_total || 0;
    document.getElementById('keteranganSewa').value = sewa.keterangan || '';
    isiInputAkun(document.getElementById('akunPrabayarSewa'), sewa.kode_akun_prabayar);
    isiInputAkun(document.getElementById('akunBebanSewa'), sewa.kode_akun_beban_sewa);

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

    // Auditor bersifat read-only di seluruh aplikasi (lihat js/auth.js) -
    // halaman ini tetap bisa diakses Auditor untuk melihat skedul amortisasi,
    // tapi form pendaftaran/edit-nya disembunyikan supaya tidak mencoba
    // menyimpan lalu terbentur error izin dari Firestore rules.
    if (adalahAuditor) {
        const formEl = document.getElementById('formSewa');
        if (formEl) {
            const notice = document.createElement('p');
            notice.className = 'text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3';
            notice.textContent = '⚠️ Peran Anda sebagai Auditor bersifat Read-Only - form pendaftaran/edit Sewa Dibayar Dimuka tidak ditampilkan.';
            formEl.parentNode.insertBefore(notice, formEl);
            formEl.style.display = 'none';
        }
    }

    const inputAkunPrabayar = document.getElementById('akunPrabayarSewa');
    const inputAkunBeban = document.getElementById('akunBebanSewa');
    if (inputAkunPrabayar) pasangAutocompleteAkun(inputAkunPrabayar, () => coaArray);
    if (inputAkunBeban) pasangAutocompleteAkun(inputAkunBeban, () => coaArray);

    let kandidatTransaksiSewa = [];
    const inputPilihTransaksi = document.getElementById('pilihTransaksiSewa');
    if (inputPilihTransaksi) {
        pasangPilihTransaksi(inputPilihTransaksi, () => kandidatTransaksiSewa, (t) => {
            document.getElementById('namaSewa').value = t.lawan_transaksi || t.keterangan || '';
            document.getElementById('keteranganSewa').value = t.keterangan || '';
            document.getElementById('nilaiTotalSewa').value = t.nominal;
            isiInputAkun(document.getElementById('akunPrabayarSewa'), t.kode_akun);
            // Disimpan untuk dasar penomoran No. Bukti jurnal amortisasi bulanan
            // nanti di Jurnal Berulang: "{No. Bukti transaksi ini}/NNN".
            document.getElementById('noBuktiSumberSewa').value = t.no_bukti || '';
        });
    }

    (async () => {
        try {
            const snapUnit = await getDocs(collection(db, "master_unit_usaha"));
            const selectUnit = document.getElementById('unitUsahaSewa');
            if (selectUnit) {
                let units = [];
                snapUnit.forEach(d => units.push(d.data()));
                units.sort((a, b) => (a.kode || '').localeCompare(b.kode || '', 'id'));
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
        } catch (err) {}

        try {
            const kodeSewaAset = coaArray.filter(c => c.kategori_sewa && String(c.kode).startsWith('1')).map(c => c.kode);
            const barisJurnal = await ambilBarisJurnalPerKodeAkun(kodeSewaAset);
            kandidatTransaksiSewa = bangunKandidatTransaksiSewa(barisJurnal);
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
                kode_akun_prabayar: ambilKodeDariInputAkun(document.getElementById('akunPrabayarSewa')),
                kode_akun_beban_sewa: ambilKodeDariInputAkun(document.getElementById('akunBebanSewa')),
                no_bukti_sumber: document.getElementById('noBuktiSumberSewa').value.trim()
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
