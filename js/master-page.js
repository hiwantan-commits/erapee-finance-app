// js/master-page.js - Controller untuk master-data.html
import { db } from "./config.js";
import { collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
            tbody.innerHTML += `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="p-3"><span class="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded font-mono font-bold text-xs">${data.kode}</span></td>
                    <td class="p-3 font-medium text-gray-800 text-sm">${data.nama}</td>
                    <td class="p-3 text-gray-500 text-sm">${data.klasifikasi || '-'}</td>
                    <td class="p-3 text-center">
                        <button onclick="window.hapusUnitUsaha('${docSnap.id}')" class="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg text-xs font-bold transition">Hapus</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error muat unit usaha:", error);
        tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Gagal memuat data unit usaha.</td></tr>';
    }
}

window.hapusUnitUsaha = async function(id) {
    if (confirm('Apakah Anda yakin ingin menghapus Unit Usaha ini? Data jurnal yang sudah menggunakan kode ini akan tetap ada, namun filter mungkin terpengaruh.')) {
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
        
        // Urutkan berdasarkan kode akun terkecil ke terbesar
        coaList.sort((a, b) => a.kode.localeCompare(b.kode));

        if (coaList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-400">Belum ada master data COA (Chart of Accounts).</td></tr>';
            return;
        }

        coaList.forEach(data => {
            tbody.innerHTML += `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="p-3"><span class="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-mono font-bold text-xs">${data.kode}</span></td>
                    <td class="p-3 font-medium text-gray-800 text-sm">${data.nama}</td>
                    <td class="p-3 text-center">
                        <button onclick="window.hapusCOA('${data.id}')" class="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg text-xs font-bold transition">Hapus</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error muat COA:", error);
        tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-red-500">Gagal memuat data COA.</td></tr>';
    }
}

window.hapusCOA = async function(id) {
    if (confirm('Apakah Anda yakin ingin menghapus Kode Akun (COA) ini?')) {
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

    // Event Listener Tambah Unit Usaha
    const formUnit = document.getElementById('formUnitUsaha');
    if (formUnit) {
        formUnit.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnSimpanUnit');
            btn.disabled = true;
            btn.innerText = 'Menyimpan...';
            
            try {
                await addDoc(collection(db, "master_unit_usaha"), {
                    kode: document.getElementById('kodeUnit').value.toUpperCase().trim(),
                    nama: document.getElementById('namaUnit').value.trim(),
                    klasifikasi: document.getElementById('klasifikasiUnit').value.trim()
                });
                formUnit.reset();
                muatUnitUsaha();
            } catch (error) {
                alert('Gagal menyimpan Unit Usaha: ' + error.message);
            }
            
            btn.disabled = false;
            btn.innerText = 'Simpan Unit Usaha';
        });
    }

    // Event Listener Tambah COA
    const formCOA = document.getElementById('formCOA');
    if (formCOA) {
        formCOA.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnSimpanCOA');
            btn.disabled = true;
            btn.innerText = 'Menyimpan...';
            
            try {
                await addDoc(collection(db, "master_coa"), {
                    kode: document.getElementById('kodeCOA').value.trim(),
                    nama: document.getElementById('namaCOA').value.trim()
                });
                formCOA.reset();
                muatCOA();
            } catch (error) {
                alert('Gagal menyimpan COA: ' + error.message);
            }
            
            btn.disabled = false;
            btn.innerText = 'Simpan COA';
        });
    }
});
