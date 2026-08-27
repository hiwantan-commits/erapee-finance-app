// js/journal-page.js - Controller Input Jurnal dengan Searchable COA
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { CONFIG } from "./config.js";

const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const db = getFirestore(app);

let daftarCOA = []; // Variabel global untuk menyimpan data COA sementara
let counterBaris = 0; // Penghitung baris unik

document.addEventListener("DOMContentLoaded", async function() {
    // 1. Muat data COA dari database terlebih dahulu
    await muatDaftarCOADariDatabase();

    // 2. Siapkan form dengan minimal 2 baris awal
    tambahBarisJurnal();
    tambahBarisJurnal();

    // 3. Tombol aksi tambah baris
    document.getElementById("btnTambahBaris").addEventListener("click", tambahBarisJurnal);

    // 4. Tangani Submit Form
    document.getElementById("formInputJurnal").addEventListener("submit", simpanDataJurnal);
});

// Mengambil master data COA dari koleksi 'master_coa'
async function muatDaftarCOADariDatabase() {
    try {
        const querySnapshot = await getDocs(collection(db, "master_coa"));
        daftarCOA = []; // Kosongkan sebelum diisi
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Simpan objek yang diperlukan untuk opsi dropdown
            if(data.kodeAkun && data.namaAkun) {
                daftarCOA.push({
                    kode: data.kodeAkun,
                    nama: data.namaAkun,
                    labelTampil: `${data.kodeAkun} - ${data.namaAkun}`
                });
            }
        });
        
        // Urutkan berdasarkan kode akun
        daftarCOA.sort((a, b) => a.kode.localeCompare(b.kode));
        
    } catch (error) {
        console.error("Gagal memuat Master COA: ", error);
        alert("Gagal memuat data akun COA. Silakan periksa koneksi Anda.");
    }
}

// Fungsi membuat baris jurnal baru beserta Searchable Dropdown
function tambahBarisJurnal() {
    counterBaris++;
    const rowId = `row-${counterBaris}`;
    const tbody = document.getElementById("tbodyJurnal");
    
    // Susun opsi <option> HTML dari array daftarCOA
    let opsiHtml = `<option value="">Ketik kode atau nama akun...</option>`;
    daftarCOA.forEach(coa => {
        opsiHtml += `<option value="${coa.kode}">${coa.labelTampil}</option>`;
    });

    // Buat elemen baris <tr>
    const tr = document.createElement("tr");
    tr.id = rowId;
    tr.innerHTML = `
        <td class="px-4 py-2">
            <!-- Beri class khusus untuk kita panggil di TomSelect -->
            <select class="coa-dropdown w-full" required>
                ${opsiHtml}
            </select>
        </td>
        <td class="px-4 py-2">
            <input type="number" min="0" class="input-debit w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 outline-none" placeholder="0">
        </td>
        <td class="px-4 py-2">
            <input type="number" min="0" class="input-kredit w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 outline-none" placeholder="0">
        </td>
        <td class="px-4 py-2 text-center">
            <button type="button" onclick="hapusBarisJurnal('${rowId}')" class="text-red-500 hover:text-red-700 font-bold p-1">
                ✕
            </button>
        </td>
    `;
    
    tbody.appendChild(tr);

    // INISIALISASI TOM SELECT PADA ELEMEN YANG BARU DIBUAT
    const elemenSelectBaru = tr.querySelector('.coa-dropdown');
    new TomSelect(elemenSelectBaru, {
        create: false,         // Tidak bisa menambah teks bebas, harus dari list
        sortField: {
            field: "text",
            direction: "asc"
        },
        maxOptions: 50,        // Agar rendering tidak lemot
        placeholder: "Cari Akun COA..."
    });

    // Pasang pendeteksi perubahan (listener) untuk menghitung ulang total saat diketik
    tr.querySelector('.input-debit').addEventListener("input", hitungTotalJurnal);
    tr.querySelector('.input-kredit').addEventListener("input", hitungTotalJurnal);
}

// Fungsi Hapus Baris (Terhubung dengan tombol ✕ di HTML)
window.hapusBarisJurnal = function(rowId) {
    const tbody = document.getElementById("tbodyJurnal");
    if (tbody.children.length <= 2) {
        alert("Minimal harus ada 2 baris jurnal (Debit & Kredit).");
        return;
    }
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
        hitungTotalJurnal(); // Hitung ulang setelah baris dihapus
    }
}

// Fungsi menghitung Total dan Mengecek Status Balance
function hitungTotalJurnal() {
    let totalDebit = 0;
    let totalKredit = 0;

    const barisDebit = document.querySelectorAll('.input-debit');
    const barisKredit = document.querySelectorAll('.input-kredit');

    barisDebit.forEach(input => {
        totalDebit += parseFloat(input.value) || 0;
    });

    barisKredit.forEach(input => {
        totalKredit += parseFloat(input.value) || 0;
    });

    // Format dan Tampilkan ke UI
    document.getElementById("totalDebitView").innerText = "Rp " + totalDebit.toLocaleString('id-ID');
    document.getElementById("totalKreditView").innerText = "Rp " + totalKredit.toLocaleString('id-ID');

    const statusEl = document.getElementById("statusBalance");
    const btnSimpan = document.getElementById("btnSimpanJurnal");

    // Logika Keseimbangan (Balance)
    if (totalDebit === 0 && totalKredit === 0) {
        statusEl.innerText = "Menunggu Input...";
        statusEl.className = "text-xs font-bold text-center py-2 rounded bg-gray-200 text-gray-600";
        btnSimpan.disabled = true;
    } else if (totalDebit === totalKredit) {
        statusEl.innerText = "✓ JURNAL SEIMBANG (BALANCE)";
        statusEl.className = "text-xs font-bold text-center py-2 rounded bg-green-100 text-green-700 border border-green-200";
        btnSimpan.disabled = false;
    } else {
        const selisih = Math.abs(totalDebit - totalKredit);
        statusEl.innerText = `✕ TIDAK SEIMBANG (Selisih: Rp ${selisih.toLocaleString('id-ID')})`;
        statusEl.className = "text-xs font-bold text-center py-2 rounded bg-red-100 text-red-700 border border-red-200";
        btnSimpan.disabled = true;
    }
}

// Fungsi Eksekusi Simpan Data ke Firestore
async function simpanDataJurnal(e) {
    e.preventDefault();
    const btnSimpan = document.getElementById("btnSimpanJurnal");
    btnSimpan.disabled = true;
    btnSimpan.innerText = "Menyimpan...";

    try {
        const tgl = document.getElementById("tglJurnal").value;
        const ref = document.getElementById("refJurnal").value;
        const ket = document.getElementById("ketJurnal").value;
        
        let barisData = [];
        let total = 0;

        // Ekstrak data dari setiap baris di tabel
        const barisTabel = document.querySelectorAll("#tbodyJurnal tr");
        barisTabel.forEach(tr => {
            const akunEl = tr.querySelector('.coa-dropdown');
            const debitEl = tr.querySelector('.input-debit');
            const kreditEl = tr.querySelector('.input-kredit');

            const kodeAkun = akunEl.value; // Value dari TomSelect
            const namaAkun = akunEl.options[akunEl.selectedIndex].text; // Teks lengkap
            const nominalDebit = parseFloat(debitEl.value) || 0;
            const nominalKredit = parseFloat(kreditEl.value) || 0;

            if (kodeAkun && (nominalDebit > 0 || nominalKredit > 0)) {
                barisData.push({
                    kodeAkun: kodeAkun,
                    namaAkun: namaAkun,
                    debit: nominalDebit,
                    kredit: nominalKredit
                });
                total += nominalDebit; // Ambil salah satu karena sudah divalidasi balance
            }
        });

        // Struktur payload ke Firestore
        const payload = {
            tanggal: tgl,
            referensi: ref,
            keterangan: ket,
            detail: barisData,
            totalNilai: total,
            dibuatPada: new Date().toISOString()
        };

        // Simpan ke koleksi 'jurnal_transaksi'
        await addDoc(collection(db, "jurnal_transaksi"), payload);

        alert("✅ Jurnal berhasil disimpan!");
        window.location.reload(); // Reset form

    } catch (err) {
        console.error("Error menyimpan jurnal: ", err);
        alert("Gagal menyimpan jurnal. " + err.message);
        btnSimpan.disabled = false;
        btnSimpan.innerText = "Simpan Jurnal";
    }
}
