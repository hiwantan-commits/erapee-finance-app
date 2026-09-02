// js/master-page.js - Controller untuk master-data.html
import { db } from "./config.js";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { escapeHtml } from "./utils.js";
import { isKodeAkunValid } from "./accounting.js";

// Menu aksi per-baris memakai pola dropdown/3-titik (bukan 2 tombol
// terpisah) - konsisten dengan halaman Manajemen Jurnal. `prefix` membedakan
// panel Unit Usaha dan COA supaya id HTML-nya tidak pernah bentrok satu sama
// lain di halaman yang sama.
function tombolAksiHtml(prefix, id, onEdit, onHapus) {
    const idAman = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const panelId = `menuAksi${prefix}-${idAman}`;
    return `
        <div class="relative inline-block">
            <button type="button" onclick="window.toggleDropdownElegant(event, '${panelId}')" class="btn-elegant-icon" title="Aksi">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="12" cy="19" r="1.75"/></svg>
            </button>
            <div id="${panelId}" class="hidden absolute right-0 mt-1 z-50" data-dropdown-elegant>
                <div class="dropdown-elegant-panel">
                    <button type="button" onclick="${onEdit}" class="dropdown-elegant-item">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        Edit
                    </button>
                    <div class="dropdown-elegant-divider"></div>
                    <button type="button" onclick="${onHapus}" class="dropdown-elegant-item dropdown-elegant-item-danger">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>
                        Hapus
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// 1. MODUL MASTER DATA UNIT USAHA
// ==========================================
async function muatUnitUsaha() {
    const tbody = document.getElementById('tabelUnitUsaha');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-stone-400 dark:text-stone-500 font-medium">Memuat data unit usaha dari pusat...</td></tr>';

    try {
        const snap = await getDocs(collection(db, "master_unit_usaha"));
        tbody.innerHTML = '';

        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-stone-400 dark:text-stone-500">Belum ada master data unit usaha.</td></tr>';
            return;
        }

        // Urutkan berdasarkan abjad kode unit usaha - Firestore mengembalikan
        // dokumen dalam urutan yang tidak bisa diandalkan (biasanya urutan
        // insert), jadi disortir di klien sebelum dirender.
        const daftarUnit = [];
        snap.forEach(docSnap => daftarUnit.push({ id: docSnap.id, ...docSnap.data() }));
        daftarUnit.sort((a, b) => (a.kode || '').localeCompare(b.kode || '', 'id'));

        daftarUnit.forEach(data => {
            const klasifikasiTeks = data.klasifikasi || '-';
            const status = data.status || 'Aktif';

            const encKode = encodeURIComponent(data.kode || '');
            const encNama = encodeURIComponent(data.nama || '');
            const encKlas = encodeURIComponent(klasifikasiTeks);
            const encStatus = encodeURIComponent(status);

            const badgeStatus = status === 'Ditutup'
                ? `<span class="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 rounded text-[10px] font-semibold">Ditutup</span>`
                : `<span class="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded text-[10px] font-semibold">Aktif</span>`;

            // Tambahkan atribut id baris agar mudah diberi efek highlight
            tbody.innerHTML += `
                <tr id="row-unit-${data.id}" class="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors">
                    <td class="p-3"><span class="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded font-mono font-bold text-xs">${escapeHtml(data.kode)}</span></td>
                    <td class="p-3 font-medium text-stone-800 dark:text-stone-200 text-sm">${escapeHtml(data.nama)}</td>
                    <td class="p-3 text-stone-500 dark:text-stone-400 text-sm">${escapeHtml(klasifikasiTeks)}</td>
                    <td class="p-3">${badgeStatus}</td>
                    <td class="p-3 text-center">${tombolAksiHtml('Unit', data.id, `window.editUnitUsaha('${data.id}', '${encKode}', '${encNama}', '${encKlas}', '${encStatus}')`, `window.hapusUnitUsaha('${data.id}')`)}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error muat unit usaha:", error);
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500 dark:text-red-400">Gagal memuat data unit usaha.</td></tr>';
    }
}

window.editUnitUsaha = function(id, encKode, encNama, encKlas, encStatus) {
    const klasifikasi = decodeURIComponent(encKlas);

    // Hapus highlight dari semua baris unit usaha lain, lalu beri highlight ke baris yang dipilih
    document.querySelectorAll('#tabelUnitUsaha tr').forEach(tr => tr.classList.remove('bg-amber-50', 'dark:bg-amber-900/20'));
    const activeRow = document.getElementById(`row-unit-${id}`);
    if (activeRow) activeRow.classList.add('bg-amber-50', 'dark:bg-amber-900/20');

    document.getElementById('editIdUnit').value = id;
    document.getElementById('kodeUnit').value = decodeURIComponent(encKode);
    document.getElementById('namaUnit').value = decodeURIComponent(encNama);
    document.getElementById('klasifikasiUnit').value = klasifikasi === '-' ? '' : klasifikasi;
    document.getElementById('statusUnit').value = encStatus ? decodeURIComponent(encStatus) : 'Aktif';

    const btn = document.getElementById('btnSimpanUnit');
    btn.innerText = 'Update Data';
    btn.disabled = false;
    document.getElementById('btnBatalUnit').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.batalEditUnit = function() {
    // Bersihkan semua highlight baris aktif
    document.querySelectorAll('#tabelUnitUsaha tr').forEach(tr => tr.classList.remove('bg-amber-50', 'dark:bg-amber-900/20'));

    document.getElementById('formUnitUsaha').reset();
    document.getElementById('editIdUnit').value = '';

    const btn = document.getElementById('btnSimpanUnit');
    btn.innerText = 'Simpan Unit Usaha';
    btn.disabled = false;
    document.getElementById('btnBatalUnit').classList.add('hidden');
}

window.hapusUnitUsaha = async function(id) {
    if (confirm('Yakin hapus Unit Usaha ini? Data jurnal dengan kode ini tidak akan ikut terhapus.')) {
        try {
            await deleteDoc(doc(db, "master_unit_usaha", id));
            muatUnitUsaha();
        } catch (error) {
            alert("Gagal menghapus data: " + error.message);
        }
    }
}

// ==========================================
// 2. MODUL MASTER DATA COA (CHART OF ACCOUNTS)
// ==========================================
async function muatCOA() {
    const tbody = document.getElementById('tabelCOA');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-stone-400 dark:text-stone-500 font-medium">Memuat data COA dari pusat...</td></tr>';

    try {
        const snap = await getDocs(collection(db, "master_coa"));
        tbody.innerHTML = '';

        let coaList = [];
        snap.forEach(docSnap => {
            coaList.push({ id: docSnap.id, ...docSnap.data() });
        });

        coaList.sort((a, b) => String(a.kode).localeCompare(String(b.kode)));

        if (coaList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-stone-400 dark:text-stone-500">Belum ada master data COA (Chart of Accounts).</td></tr>';
            return;
        }

        coaList.forEach(data => {
            const encKode = encodeURIComponent(data.kode || '');
            const encNama = encodeURIComponent(data.nama || '');
            const badgeSewa = data.kategori_sewa
                ? `<span class="px-2 py-0.5 bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 rounded text-[10px] font-semibold">Sewa</span>`
                : '';
            const badgeAsetTetap = data.kategori_aset_tetap
                ? `<span class="px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded text-[10px] font-semibold">Aset Tetap</span>`
                : '';
            const badgeKategori = (badgeSewa + badgeAsetTetap) || `<span class="text-stone-300 dark:text-stone-700 text-xs">-</span>`;

            // Tambahkan atribut id baris COA
            tbody.innerHTML += `
                <tr id="row-coa-${data.id}" class="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors">
                    <td class="p-3"><span class="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded font-mono font-bold text-xs">${escapeHtml(data.kode)}</span></td>
                    <td class="p-3 font-medium text-stone-800 dark:text-stone-200 text-sm">${escapeHtml(data.nama)}</td>
                    <td class="p-3 space-x-1">${badgeKategori}</td>
                    <td class="p-3 text-center">${tombolAksiHtml('Coa', data.id, `window.editCOA('${data.id}', '${encKode}', '${encNama}', ${Boolean(data.kategori_sewa)}, ${Boolean(data.kategori_aset_tetap)})`, `window.hapusCOA('${data.id}')`)}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error muat COA:", error);
        tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500 dark:text-red-400">Gagal memuat data COA.</td></tr>';
    }
}

window.editCOA = function(id, encKode, encNama, kategoriSewa, kategoriAsetTetap) {
    // Hapus highlight dari baris COA lain, lalu beri highlight ke baris yang dipilih
    document.querySelectorAll('#tabelCOA tr').forEach(tr => tr.classList.remove('bg-amber-50', 'dark:bg-amber-900/20'));
    const activeRow = document.getElementById(`row-coa-${id}`);
    if (activeRow) activeRow.classList.add('bg-amber-50', 'dark:bg-amber-900/20');

    document.getElementById('editIdCOA').value = id;
    document.getElementById('kodeCOA').value = decodeURIComponent(encKode);
    document.getElementById('namaCOA').value = decodeURIComponent(encNama);
    document.getElementById('kategoriSewaCOA').checked = Boolean(kategoriSewa);
    document.getElementById('kategoriAsetTetapCOA').checked = Boolean(kategoriAsetTetap);

    const btn = document.getElementById('btnSimpanCOA');
    btn.innerText = 'Update COA';
    btn.disabled = false;
    document.getElementById('btnBatalCOA').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.batalEditCOA = function() {
    // Bersihkan semua highlight baris aktif COA
    document.querySelectorAll('#tabelCOA tr').forEach(tr => tr.classList.remove('bg-amber-50', 'dark:bg-amber-900/20'));

    document.getElementById('formCOA').reset();
    document.getElementById('editIdCOA').value = '';

    const btn = document.getElementById('btnSimpanCOA');
    btn.innerText = 'Simpan COA';
    btn.disabled = false;
    document.getElementById('btnBatalCOA').classList.add('hidden');
}

window.hapusCOA = async function(id) {
    if (confirm('Yakin hapus Kode Akun (COA) ini?')) {
        try {
            await deleteDoc(doc(db, "master_coa", id));
            muatCOA();
        } catch (error) {
            alert("Gagal menghapus data COA: " + error.message);
        }
    }
}

// ==========================================
// 3. INISIALISASI & EVENT LISTENER FORM
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    muatUnitUsaha();
    muatCOA();

    const formUnit = document.getElementById('formUnitUsaha');
    if (formUnit) {
        formUnit.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnSimpanUnit');
            const editId = document.getElementById('editIdUnit').value;
            
            btn.disabled = true;
            btn.innerText = 'Menyimpan...';
            
            const payload = {
                kode: document.getElementById('kodeUnit').value.toUpperCase().trim(),
                nama: document.getElementById('namaUnit').value.trim(),
                klasifikasi: document.getElementById('klasifikasiUnit').value.trim(),
                status: document.getElementById('statusUnit').value
            };

            try {
                if (editId) {
                    await updateDoc(doc(db, "master_unit_usaha", editId), payload);
                    window.batalEditUnit(); 
                } else {
                    await addDoc(collection(db, "master_unit_usaha"), payload);
                    formUnit.reset();
                    btn.disabled = false; 
                    btn.innerText = 'Simpan Unit Usaha';
                }
                muatUnitUsaha();
            } catch (error) {
                alert('Gagal menyimpan Unit Usaha: ' + error.message);
                btn.disabled = false;
                btn.innerText = editId ? 'Update Data' : 'Simpan Unit Usaha';
            }
        });
    }

    const formCOA = document.getElementById('formCOA');
    if (formCOA) {
        formCOA.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnSimpanCOA');
            const editId = document.getElementById('editIdCOA').value;
            
            btn.disabled = true;
            btn.innerText = 'Menyimpan...';
            
            const payload = {
                kode: document.getElementById('kodeCOA').value.trim(),
                nama: document.getElementById('namaCOA').value.trim(),
                kategori_sewa: document.getElementById('kategoriSewaCOA').checked,
                kategori_aset_tetap: document.getElementById('kategoriAsetTetapCOA').checked
            };

            if (!isKodeAkunValid(payload.kode)) {
                alert('❌ Kode akun harus berawalan angka 1-6 (1=Aset, 2=Liabilitas, 3=Ekuitas, 4=Pendapatan, 5=HPP, 6=Beban).\n\nKode di luar aturan ini tidak akan pernah muncul di Neraca maupun Laporan Laba Rugi.');
                btn.disabled = false;
                btn.innerText = editId ? 'Update COA' : 'Simpan COA';
                return;
            }

            try {
                if (editId) {
                    await updateDoc(doc(db, "master_coa", editId), payload);
                    window.batalEditCOA(); 
                } else {
                    await addDoc(collection(db, "master_coa"), payload);
                    formCOA.reset();
                    btn.disabled = false; 
                    btn.innerText = 'Simpan COA';
                }
                muatCOA();
            } catch (error) {
                alert('Gagal menyimpan COA: ' + error.message);
                btn.disabled = false;
                btn.innerText = editId ? 'Update COA' : 'Simpan COA';
            }
        });
    }
});
