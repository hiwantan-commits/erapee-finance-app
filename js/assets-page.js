// js/assets-page.js - Controller untuk aset-tetap.html (Master Aset & Skedul Penyusutan)
import { db } from "./config.js";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ambilSemuaJurnalPusat, ambilBarisJurnalPerKodeAkun } from "./db.js";
import { hitungPenyusutanAset, KELOMPOK_PENYUSUTAN } from "./accounting.js";
import { pasangAutocompleteAkun } from "./coa-autocomplete.js";
import { pasangPilihTransaksi } from "./transaksi-picker.js";
import { escapeHtml } from "./utils.js";
import { ambilUserAktif } from "./auth.js";

const KOLEKSI_ASET = "aset_tetap";
let coaArray = []; // Array COA untuk mapping otomatis di input akun (sama pola dengan journal-page.js/sewa-page.js)

// Auditor bersifat read-only di seluruh aplikasi (lihat js/auth.js) - boleh
// tetap melihat daftar & skedul penyusutan, tapi tidak boleh mengubah/menghapus.
const adalahAuditor = ambilUserAktif().role === 'Auditor';

// Mengubah daftar KODE akun bertag kategori_aset_tetap di Master COA jadi
// "kandidat transaksi pembelian aset" siap pakai untuk fitur "Isi Otomatis
// dari Transaksi Jurnal". `barisJurnal` sudah difilter kode_akun-nya di sisi
// Firestore lewat ambilBarisJurnalPerKodeAkun() (query where(...,"in",...))
// - sebelumnya fungsi ini yang menyaring dari SELURUH koleksi jurnal_transaksi
// di klien, dan cara lama itu makin lambat/mahal seiring jumlah transaksi
// bertambah. Pola identik bangunKandidatTransaksiSewa() di js/sewa-page.js,
// hanya beda sumber tanda kategorinya.
function bangunKandidatTransaksiAset(barisJurnal) {
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

// Ambil kode akun bersih dari value input yang berformat "KODE - Nama Akun"
// (sama pola dengan pembersihan unit_usaha di journal-page.js).
function ambilKodeDariInputAkun(inputEl) {
    const raw = inputEl.value || '';
    return raw.split(' - ')[0].trim();
}

function isiInputAkun(inputEl, kode) {
    if (!inputEl) return;
    const found = coaArray.find(c => c.kode === kode);
    inputEl.value = found ? `${found.kode} - ${found.nama}` : (kode || '');
}

function formatRupiah(angka) {
    return "Rp " + Math.round(angka).toLocaleString('id-ID');
}

// Menu aksi per-baris memakai pola dropdown/3-titik, konsisten dengan
// Manajemen Jurnal & Master Data. `encId` sudah di-encodeURIComponent oleh
// pemanggil, tapi tetap disaring lagi untuk id panel HTML yang valid.
// Tidak ditampilkan sama sekali untuk Auditor - baik Edit maupun Hapus
// bukan aksi yang berguna untuk role read-only (Edit hanya membuka form
// pendaftaran yang sudah disembunyikan, Hapus akan ditolak Firestore rules).
function tombolAksiAsetHtml(encId) {
    if (adalahAuditor) return `<span class="text-stone-300 dark:text-stone-700 text-xs">-</span>`;
    const idAman = String(encId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const panelId = `menuAksiAset-${idAman}`;
    return `
        <div class="relative inline-block">
            <button type="button" onclick="window.toggleDropdownElegant(event, '${panelId}')" class="btn-elegant-icon" title="Aksi">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="12" cy="19" r="1.75"/></svg>
            </button>
            <div id="${panelId}" class="hidden absolute right-0 mt-1 z-50" data-dropdown-elegant>
                <div class="dropdown-elegant-panel">
                    <button type="button" onclick="window.editAset('${encId}')" class="dropdown-elegant-item">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        Edit
                    </button>
                    <div class="dropdown-elegant-divider"></div>
                    <button type="button" onclick="window.hapusAset('${encId}')" class="dropdown-elegant-item dropdown-elegant-item-danger">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>
                        Hapus
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function muatDaftarAset() {
    const tbody = document.getElementById('tabelDaftarAset');
    const kartuContainer = document.getElementById('kartuDaftarAset');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-stone-400 dark:text-stone-500">Memuat daftar aset tetap...</td></tr>`;

    try {
        const snap = await getDocs(collection(db, KOLEKSI_ASET));
        let daftarAset = [];
        snap.forEach(docSnap => daftarAset.push({ id: docSnap.id, ...docSnap.data() }));
        daftarAset.sort((a, b) => (a.tanggal_perolehan || '').localeCompare(b.tanggal_perolehan || ''));

        let totalPerolehan = 0, totalAkumulasi = 0, totalNilaiBuku = 0;

        if (daftarAset.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-stone-400 dark:text-stone-500">Belum ada aset tetap terdaftar. Tambahkan lewat form di atas.</td></tr>`;
            if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-stone-400 dark:text-stone-500 text-sm">Belum ada aset tetap terdaftar. Tambahkan lewat form di atas.</p>`;
        } else {
            const barisTabel = [];
            const kartuMobile = [];

            daftarAset.forEach(aset => {
                const hasil = hitungPenyusutanAset(aset);
                totalPerolehan += hasil.nilaiPerolehan;
                totalAkumulasi += hasil.akumulasiPenyusutan;
                totalNilaiBuku += hasil.nilaiBuku;

                const encId = encodeURIComponent(aset.id);
                const akunBelumLengkap = !aset.kode_akun_beban_penyusutan || !aset.kode_akun_akumulasi_penyusutan;
                const badgeAkunKurang = akunBelumLengkap
                    ? `<span class="ml-1.5 inline-block px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded text-[10px] font-semibold align-middle" title="Akun beban/akumulasi penyusutan belum diisi - aset ini tidak akan diikutkan program Jurnal Berulang">Akun belum diatur</span>`
                    : '';

                barisTabel.push(`
                    <tr id="row-aset-${aset.id}" class="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors">
                        <td class="p-3 text-xs font-medium text-stone-800 dark:text-stone-200">${escapeHtml(aset.nama_aset)}${badgeAkunKurang}</td>
                        <td class="p-3 text-xs text-stone-500 dark:text-stone-400">${escapeHtml(aset.tanggal_perolehan)}</td>
                        <td class="p-3 text-xs"><span class="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded font-semibold">${escapeHtml(aset.kelompok)}</span><div class="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">${escapeHtml(aset.metode)}</div></td>
                        <td class="p-3 text-xs text-right font-medium text-stone-800 dark:text-stone-200">${hasil.nilaiPerolehan.toLocaleString('id-ID')}</td>
                        <td class="p-3 text-xs text-right text-amber-600 dark:text-amber-400">${Math.round(hasil.akumulasiPenyusutan).toLocaleString('id-ID')}</td>
                        <td class="p-3 text-xs text-right font-bold text-emerald-600 dark:text-emerald-400">${Math.round(hasil.nilaiBuku).toLocaleString('id-ID')}</td>
                        <td class="p-3 text-center">${tombolAksiAsetHtml(encId)}</td>
                    </tr>
                `);

                kartuMobile.push(`
                    <div id="kartu-aset-${aset.id}" class="border border-stone-100 dark:border-stone-800 rounded-xl p-4">
                        <div class="flex justify-between items-start gap-2 mb-2">
                            <div>
                                <div class="font-bold text-stone-900 dark:text-stone-100 text-sm">${escapeHtml(aset.nama_aset)}${badgeAkunKurang}</div>
                                <div class="text-xs text-stone-400 dark:text-stone-500">${escapeHtml(aset.tanggal_perolehan)}</div>
                            </div>
                            <div class="text-right">
                                <span class="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded font-semibold text-[11px]">${escapeHtml(aset.kelompok)}</span>
                                <div class="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">${escapeHtml(aset.metode)}</div>
                            </div>
                        </div>
                        <div class="grid grid-cols-3 gap-2 text-xs border-t border-stone-100 dark:border-stone-800 pt-2 mb-3">
                            <div><p class="text-stone-400 dark:text-stone-500">Perolehan</p><p class="font-semibold text-stone-700 dark:text-stone-300">${hasil.nilaiPerolehan.toLocaleString('id-ID')}</p></div>
                            <div><p class="text-stone-400 dark:text-stone-500">Penyusutan</p><p class="font-semibold text-amber-600 dark:text-amber-400">${Math.round(hasil.akumulasiPenyusutan).toLocaleString('id-ID')}</p></div>
                            <div><p class="text-stone-400 dark:text-stone-500">Nilai Buku</p><p class="font-bold text-emerald-600 dark:text-emerald-400">${Math.round(hasil.nilaiBuku).toLocaleString('id-ID')}</p></div>
                        </div>
                        <div class="flex justify-end">
                            ${tombolAksiAsetHtml(encId)}
                        </div>
                    </div>
                `);
            });

            tbody.innerHTML = barisTabel.join('');
            if (kartuContainer) kartuContainer.innerHTML = kartuMobile.join('');
        }

        const elPerolehan = document.getElementById('totalPerolehanAset');
        const elPenyusutan = document.getElementById('totalPenyusutan');
        const elNilaiBuku = document.getElementById('totalNilaiBuku');
        if (elPerolehan) elPerolehan.innerText = formatRupiah(totalPerolehan);
        if (elPenyusutan) elPenyusutan.innerText = formatRupiah(totalAkumulasi);
        if (elNilaiBuku) elNilaiBuku.innerText = formatRupiah(totalNilaiBuku);

        window.dataAsetGlobal = {};
        daftarAset.forEach(a => { window.dataAsetGlobal[a.id] = a; });

    } catch (error) {
        console.error("Gagal memuat daftar aset:", error);
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500 dark:text-red-400">Gagal memuat data aset tetap.</td></tr>`;
        if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-red-500 dark:text-red-400 text-sm">Gagal memuat data aset tetap.</p>`;
    }
}

window.editAset = function(encId) {
    const id = decodeURIComponent(encId);
    const aset = window.dataAsetGlobal[id];
    if (!aset) return;

    document.querySelectorAll('#tabelDaftarAset tr, #kartuDaftarAset > div').forEach(el => el.classList.remove('bg-amber-50', 'dark:bg-amber-900/20'));
    const activeRow = document.getElementById(`row-aset-${id}`);
    if (activeRow) activeRow.classList.add('bg-amber-50', 'dark:bg-amber-900/20');
    const activeCard = document.getElementById(`kartu-aset-${id}`);
    if (activeCard) activeCard.classList.add('bg-amber-50', 'dark:bg-amber-900/20');

    document.getElementById('editIdAset').value = id;
    document.getElementById('noBuktiSumberAset').value = aset.no_bukti_sumber || '';
    document.getElementById('namaAset').value = aset.nama_aset || '';
    document.getElementById('tanggalPerolehanAset').value = aset.tanggal_perolehan || '';
    document.getElementById('nilaiPerolehanAset').value = aset.nilai_perolehan || 0;
    document.getElementById('kelompokAset').value = aset.kelompok || 'Kelompok 1';
    document.getElementById('metodeAset').value = aset.metode || 'Garis Lurus';
    isiInputAkun(document.getElementById('akunBebanPenyusutanAset'), aset.kode_akun_beban_penyusutan);
    isiInputAkun(document.getElementById('akunAkumulasiPenyusutanAset'), aset.kode_akun_akumulasi_penyusutan);

    const selectUnitEl = document.getElementById('unitUsahaAset');
    if (selectUnitEl) {
        const unitVal = aset.unit_usaha || '';
        selectUnitEl.value = '';
        for (let opt of selectUnitEl.options) {
            if (opt.value.startsWith(unitVal) && unitVal) {
                selectUnitEl.value = opt.value;
                break;
            }
        }
    }

    const btn = document.getElementById('btnSimpanAset');
    btn.innerText = 'Update Aset';
    document.getElementById('btnBatalAset').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.batalEditAset = function() {
    document.querySelectorAll('#tabelDaftarAset tr, #kartuDaftarAset > div').forEach(el => el.classList.remove('bg-amber-50', 'dark:bg-amber-900/20'));
    document.getElementById('formAset').reset();
    document.getElementById('editIdAset').value = '';

    const btn = document.getElementById('btnSimpanAset');
    btn.innerText = 'Simpan Aset Tetap';
    document.getElementById('btnBatalAset').classList.add('hidden');
};

window.hapusAset = async function(encId) {
    const id = decodeURIComponent(encId);
    if (confirm('Yakin hapus aset tetap ini dari daftar? Riwayat transaksi pembelian di jurnal tidak akan ikut terhapus.')) {
        try {
            await deleteDoc(doc(db, KOLEKSI_ASET, id));
            muatDaftarAset();
        } catch (error) {
            alert('Gagal menghapus aset: ' + error.message);
        }
    }
};

async function muatRiwayatJurnalAset() {
    const tbody = document.getElementById('tabelAsetTetap');
    if (!tbody) return;

    try {
        const semuaJurnal = await ambilSemuaJurnalPusat();
        let rowsHTML = "";

        semuaJurnal.forEach(jurnal => {
            jurnal.rows.forEach(baris => {
                const kodeAkun = baris.kode_akun || "";
                if (kodeAkun.startsWith("15") || kodeAkun.startsWith("16") || (baris.nama_akun && baris.nama_akun.toLowerCase().includes("aset"))) {
                    const nilaiDebit = parseFloat(baris.debit) || 0;
                    if (nilaiDebit > 0) {
                        rowsHTML += `
                            <tr>
                                <td class="p-3 font-bold text-stone-900 dark:text-stone-100">${escapeHtml(jurnal.id_jurnal)}<div class="text-[11px] text-stone-400 dark:text-stone-500 font-normal">${escapeHtml(jurnal.tanggal)}</div></td>
                                <td class="p-3"><div class="font-medium text-stone-800 dark:text-stone-200">${escapeHtml(jurnal.no_bukti)}</div><div class="text-[11px] text-stone-500 dark:text-stone-400">${escapeHtml(jurnal.keterangan) || '-'}</div></td>
                                <td class="p-3"><span class="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold rounded">${escapeHtml(baris.kode_akun)} - ${escapeHtml(baris.nama_akun)}</span></td>
                                <td class="p-3 text-right font-bold text-stone-800 dark:text-stone-200">${nilaiDebit.toLocaleString('id-ID')}</td>
                            </tr>
                        `;
                    }
                }
            });
        });

        tbody.innerHTML = rowsHTML === "" ? `<tr><td colspan="4" class="p-8 text-center text-stone-400 dark:text-stone-500">Belum ada transaksi pembelian aset tetap tercatat di jurnal.</td></tr>` : rowsHTML;
    } catch (error) {
        console.error("Gagal memuat riwayat jurnal aset:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    muatDaftarAset();
    muatRiwayatJurnalAset();

    // Auditor bersifat read-only di seluruh aplikasi (lihat js/auth.js) -
    // halaman ini tetap bisa diakses Auditor untuk melihat skedul penyusutan,
    // tapi form pendaftaran/edit-nya disembunyikan supaya tidak mencoba
    // menyimpan lalu terbentur error izin dari Firestore rules.
    if (adalahAuditor) {
        const formEl = document.getElementById('formAset');
        if (formEl) {
            const notice = document.createElement('p');
            notice.className = 'text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3';
            notice.textContent = '⚠️ Peran Anda sebagai Auditor bersifat Read-Only - form pendaftaran/edit Aset Tetap tidak ditampilkan.';
            formEl.parentNode.insertBefore(notice, formEl);
            formEl.style.display = 'none';
        }
    }

    const selectKelompok = document.getElementById('kelompokAset');
    if (selectKelompok) {
        selectKelompok.innerHTML = Object.keys(KELOMPOK_PENYUSUTAN).map(k =>
            `<option value="${k}">${k} (umur ${KELOMPOK_PENYUSUTAN[k].tahun} tahun)</option>`
        ).join('');
    }

    const inputAkunBeban = document.getElementById('akunBebanPenyusutanAset');
    const inputAkunAkumulasi = document.getElementById('akunAkumulasiPenyusutanAset');
    if (inputAkunBeban) pasangAutocompleteAkun(inputAkunBeban, () => coaArray);
    if (inputAkunAkumulasi) pasangAutocompleteAkun(inputAkunAkumulasi, () => coaArray);

    let kandidatTransaksiAset = [];
    const inputPilihTransaksi = document.getElementById('pilihTransaksiAset');
    if (inputPilihTransaksi) {
        pasangPilihTransaksi(inputPilihTransaksi, () => kandidatTransaksiAset, (t) => {
            document.getElementById('namaAset').value = t.lawan_transaksi || t.keterangan || '';
            document.getElementById('tanggalPerolehanAset').value = t.tanggal || '';
            document.getElementById('nilaiPerolehanAset').value = t.nominal;
            // Disimpan untuk dasar penomoran No. Bukti jurnal penyusutan
            // bulanan nanti di Jurnal Berulang: "{No. Bukti transaksi ini}/NNN".
            document.getElementById('noBuktiSumberAset').value = t.no_bukti || '';
        });
    }

    (async () => {
        try {
            const snapUnit = await getDocs(collection(db, "master_unit_usaha"));
            const selectUnit = document.getElementById('unitUsahaAset');
            if (selectUnit) {
                let units = [];
                snapUnit.forEach(d => units.push(d.data()));
                units.sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));
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
            const kodeAsetTetap = coaArray.filter(c => c.kategori_aset_tetap && String(c.kode).startsWith('1')).map(c => c.kode);
            const barisJurnal = await ambilBarisJurnalPerKodeAkun(kodeAsetTetap);
            kandidatTransaksiAset = bangunKandidatTransaksiAset(barisJurnal);
        } catch (err) {}
    })();

    const formAset = document.getElementById('formAset');
    if (formAset) {
        formAset.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnSimpanAset');
            const editId = document.getElementById('editIdAset').value;

            btn.disabled = true;
            btn.innerText = 'Menyimpan...';

            const rawUnitValue = document.getElementById('unitUsahaAset').value;
            const cleanUnitCode = rawUnitValue ? rawUnitValue.split(' - ')[0].trim() : '';

            const payload = {
                nama_aset: document.getElementById('namaAset').value.trim(),
                tanggal_perolehan: document.getElementById('tanggalPerolehanAset').value,
                nilai_perolehan: parseFloat(document.getElementById('nilaiPerolehanAset').value) || 0,
                kelompok: document.getElementById('kelompokAset').value,
                metode: document.getElementById('metodeAset').value,
                unit_usaha: cleanUnitCode,
                kode_akun_beban_penyusutan: ambilKodeDariInputAkun(document.getElementById('akunBebanPenyusutanAset')),
                kode_akun_akumulasi_penyusutan: ambilKodeDariInputAkun(document.getElementById('akunAkumulasiPenyusutanAset')),
                no_bukti_sumber: document.getElementById('noBuktiSumberAset').value.trim()
            };

            if (payload.metode === "Saldo Menurun" && !KELOMPOK_PENYUSUTAN[payload.kelompok].saldoMenurun) {
                alert('❌ Metode Saldo Menurun tidak berlaku untuk kelompok Bangunan (UU PPh hanya mengizinkan Garis Lurus untuk bangunan). Silakan pilih Garis Lurus.');
                btn.disabled = false;
                btn.innerText = editId ? 'Update Aset' : 'Simpan Aset Tetap';
                return;
            }

            try {
                if (editId) {
                    await updateDoc(doc(db, KOLEKSI_ASET, editId), payload);
                    window.batalEditAset();
                } else {
                    await addDoc(collection(db, KOLEKSI_ASET), payload);
                    formAset.reset();
                    btn.disabled = false;
                    btn.innerText = 'Simpan Aset Tetap';
                }
                muatDaftarAset();
            } catch (error) {
                alert('Gagal menyimpan aset: ' + error.message);
                btn.disabled = false;
                btn.innerText = editId ? 'Update Aset' : 'Simpan Aset Tetap';
            }
        });
    }
});
