// js/master-page.js - Controller untuk master-data.html
import { db } from "./config.js";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { escapeHtml } from "./utils.js";
import { isKodeAkunValid } from "./accounting.js";

// ==========================================
// 1. MODUL MASTER DATA UNIT USAHA
// ==========================================
async function muatUnitUsaha() {
    const tbody = document.getElementById('tabelUnitUsaha');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-500 font-medium">Memuat data unit usaha dari pusat...</td></tr>';
    
    try {
        const snap = await getDocs(collection(db, "master_unit_usaha"));
        tbody.innerHTML = '';
        
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-400">Belum ada master data unit usaha.</td></tr>';
            return;
        }

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const klasifikasiTeks = data.klasifikasi || '-';
            
            const encKode = encodeURIComponent(data.kode || '');
            const encNama = encodeURIComponent(data.nama || '');
            const encKlas = encodeURIComponent(klasifikasiTeks);

            // Tambahkan atribut id baris agar mudah diberi efek highlight
            tbody.innerHTML += `
                <tr id="row-unit-${docSnap.id}" class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td class="p-3"><span class="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded font-mono font-bold text-xs">${escapeHtml(data.kode)}</span></td>
                    <td class="p-3 font-medium text-gray-800 text-sm">${escapeHtml(data.nama)}</td>
                    <td class="p-3 text-gray-500 text-sm">${escapeHtml(klasifikasiTeks)}</td>
                    <td class="p-3 text-center">
                        <div class="flex justify-center items-center gap-2">
                            <button onclick="window.editUnitUsaha('${docSnap.id}', '${encKode}', '${encNama}', '${encKlas}')" class="text-amber-600 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg text-xs font-bold transition">Edit</button>
                            <button onclick="window.hapusUnitUsaha('${docSnap.id}')" class="text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg text-xs font-bold transition">Hapus</button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error muat unit usaha:", error);
        tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Gagal memuat data unit usaha.</td></tr>';
    }
}

window.editUnitUsaha = function(id, encKode, encNama, encKlas) {
    const klasifikasi = decodeURIComponent(encKlas);
    
    // Hapus highlight dari semua baris unit usaha lain, lalu beri highlight ke baris yang dipilih
    document.querySelectorAll('#tabelUnitUsaha tr').forEach(tr => tr.classList.remove('bg-amber-50', 'border-amber-200'));
    const activeRow = document.getElementById(`row-unit-${id}`);
    if (activeRow) activeRow.classList.add('bg-amber-50', 'border-amber-200');

    document.getElementById('editIdUnit').value = id;
    document.getElementById('kodeUnit').value = decodeURIComponent(encKode);
    document.getElementById('namaUnit').value = decodeURIComponent(encNama);
    document.getElementById('klasifikasiUnit').value = klasifikasi === '-' ? '' : klasifikasi;
    
    const btn = document.getElementById('btnSimpanUnit');
    btn.innerText = 'Update Data';
    btn.disabled = false;
    btn.classList.replace('bg-indigo-600', 'bg-amber-500');
    btn.classList.replace('hover:bg-indigo-700', 'hover:bg-amber-600');
    document.getElementById('btnBatalUnit').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.batalEditUnit = function() {
    // Bersihkan semua highlight baris aktif
    document.querySelectorAll('#tabelUnitUsaha tr').forEach(tr => tr.classList.remove('bg-amber-50', 'border-amber-200'));
    
    document.getElementById('formUnitUsaha').reset();
    document.getElementById('editIdUnit').value = '';
    
    const btn = document.getElementById('btnSimpanUnit');
    btn.innerText = 'Simpan Unit Usaha';
    btn.disabled = false;
    btn.classList.replace('bg-amber-500', 'bg-indigo-600');
    btn.classList.replace('hover:bg-amber-600', 'hover:bg-indigo-700');
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
    tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-500 font-medium">Memuat data COA dari pusat...</td></tr>';
    
    try {
        const snap = await getDocs(collection(db, "master_coa"));
        tbody.innerHTML = '';
        
        let coaList = [];
        snap.forEach(docSnap => {
            coaList.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        coaList.sort((a, b) => String(a.kode).localeCompare(String(b.kode)));

        if (coaList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-400">Belum ada master data COA (Chart of Accounts).</td></tr>';
            return;
        }

        coaList.forEach(data => {
            const encKode = encodeURIComponent(data.kode || '');
            const encNama = encodeURIComponent(data.nama || '');

            // Tambahkan atribut id baris COA
            tbody.innerHTML += `
                <tr id="row-coa-${data.id}" class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td class="p-3"><span class="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-mono font-bold text-xs">${escapeHtml(data.kode)}</span></td>
                    <td class="p-3 font-medium text-gray-800 text-sm">${escapeHtml(data.nama)}</td>
                    <td class="p-3 text-center">
                        <div class="flex justify-center items-center gap-2">
                            <button onclick="window.editCOA('${data.id}', '${encKode}', '${encNama}')" class="text-amber-600 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg text-xs font-bold transition">Edit</button>
                            <button onclick="window.hapusCOA('${data.id}')" class="text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg text-xs font-bold transition">Hapus</button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error muat COA:", error);
        tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-red-500">Gagal memuat data COA.</td></tr>';
    }
}

window.editCOA = function(id, encKode, encNama) {
    // Hapus highlight dari baris COA lain, lalu beri highlight ke baris yang dipilih
    document.querySelectorAll('#tabelCOA tr').forEach(tr => tr.classList.remove('bg-amber-50', 'border-amber-200'));
    const activeRow = document.getElementById(`row-coa-${id}`);
    if (activeRow) activeRow.classList.add('bg-amber-50', 'border-amber-200');

    document.getElementById('editIdCOA').value = id;
    document.getElementById('kodeCOA').value = decodeURIComponent(encKode);
    document.getElementById('namaCOA').value = decodeURIComponent(encNama);
    
    const btn = document.getElementById('btnSimpanCOA');
    btn.innerText = 'Update COA';
    btn.disabled = false;
    btn.classList.replace('bg-blue-600', 'bg-amber-500');
    btn.classList.replace('hover:bg-blue-700', 'hover:bg-amber-600');
    document.getElementById('btnBatalCOA').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.batalEditCOA = function() {
    // Bersihkan semua highlight baris aktif COA
    document.querySelectorAll('#tabelCOA tr').forEach(tr => tr.classList.remove('bg-amber-50', 'border-amber-200'));
    
    document.getElementById('formCOA').reset();
    document.getElementById('editIdCOA').value = '';
    
    const btn = document.getElementById('btnSimpanCOA');
    btn.innerText = 'Simpan COA';
    btn.disabled = false;
    btn.classList.replace('bg-amber-500', 'bg-blue-600');
    btn.classList.replace('hover:bg-amber-600', 'hover:bg-blue-700');
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
                klasifikasi: document.getElementById('klasifikasiUnit').value.trim()
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
                nama: document.getElementById('namaCOA').value.trim()
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
