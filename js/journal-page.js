// js/journal-page.js - Controller Input Jurnal (Desain Asli + Native Dropdown Search)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { CONFIG } from "./config.js";

const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const db = getFirestore(app);

let counterBaris = 0; 

document.addEventListener("DOMContentLoaded", async function() {
    await muatDaftarCOADariDatabase();
    tambahBarisJurnal();
    tambahBarisJurnal();

    const btnTambah = document.getElementById("btnTambahBaris");
    if(btnTambah) btnTambah.addEventListener("click", tambahBarisJurnal);

    const form = document.getElementById("formInputJurnal");
    if(form) form.addEventListener("submit", simpanDataJurnal);
});

async function muatDaftarCOADariDatabase() {
    try {
        const querySnapshot = await getDocs(collection(db, "master_coa"));
        
        // Buat elemen penampung daftar (datalist) global di HTML
        let datalist = document.getElementById("list-coa");
        if (!datalist) {
            datalist = document.createElement("datalist");
            datalist.id = "list-coa";
            document.body.appendChild(datalist);
        }
        datalist.innerHTML = ""; // Bersihkan list jika ada sisa

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if(data.kodeAkun && data.namaAkun) {
                const option = document.createElement("option");
                // Tampilan yang akan muncul di dropdown: "1101 - Kas"
                option.value = `${data.kodeAkun} - ${data.namaAkun}`;
                datalist.appendChild(option);
            }
        });
    } catch (error) {
        console.error("Gagal memuat Master COA: ", error);
    }
}

function tambahBarisJurnal() {
    counterBaris++;
    const rowId = `row-${counterBaris}`;
    const tbody = document.getElementById("tbodyJurnal");
    if(!tbody) return;
    
    const tr = document.createElement("tr");
    tr.id = rowId;
    
    // Perhatikan: Kita mengubah <select> menjadi <input list="list-coa">
    // Desain CSS tetap menggunakan style bawaan Anda 100%
    tr.innerHTML = `
        <td class="p-2 align-top">
            <input type="text" list="list-coa" class="coa-input w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm bg-white" placeholder="Pilih atau Ketik Akun..." required autocomplete="off">
        </td>
        <td class="p-2 align-top">
            <input type="number" min="0" class="input-debit w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm" placeholder="0">
        </td>
        <td class="p-2 align-top">
            <input type="number" min="0" class="input-kredit w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm" placeholder="0">
        </td>
        <td class="p-2 align-top text-center">
            <button type="button" onclick="hapusBarisJurnal('${rowId}')" class="text-gray-400 hover:text-red-500 font-bold p-1 transition-colors">
                ✕
            </button>
        </td>
    `;
    
    tbody.appendChild(tr);

    // Event listener untuk kalkulasi total otomatis
    tr.querySelector('.input-debit').addEventListener("input", hitungTotalJurnal);
    tr.querySelector('.input-kredit').addEventListener("input", hitungTotalJurnal);
}

window.hapusBarisJurnal = function(rowId) {
    const tbody = document.getElementById("tbodyJurnal");
    if (tbody.children.length <= 2) {
        alert("Minimal harus ada 2 baris jurnal.");
        return;
    }
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
        hitungTotalJurnal(); 
    }
}

function hitungTotalJurnal() {
    let totalDebit = 0;
    let totalKredit = 0;

    document.querySelectorAll('.input-debit').forEach(input => {
        totalDebit += parseFloat(input.value) || 0;
    });

    document.querySelectorAll('.input-kredit').forEach(input => {
        totalKredit += parseFloat(input.value) || 0;
    });

    const debitView = document.getElementById("totalDebitView");
    const kreditView = document.getElementById("totalKreditView");
    if(debitView) debitView.innerText = "Rp " + totalDebit.toLocaleString('id-ID');
    if(kreditView) kreditView.innerText = "Rp " + totalKredit.toLocaleString('id-ID');

    const statusEl = document.getElementById("statusBalance");
    const btnSimpan = document.getElementById("btnSimpanJurnal");
    if(!statusEl || !btnSimpan) return;

    if (totalDebit === 0 && totalKredit === 0) {
        statusEl.innerText = "Menunggu Input...";
        statusEl.className = "text-xs font-bold text-center py-2 rounded bg-gray-200 text-gray-600";
        btnSimpan.disabled = true;
    } else if (totalDebit === totalKredit) {
        statusEl.innerText = "✓ JURNAL SEIMBANG";
        statusEl.className = "text-xs font-bold text-center py-2 rounded bg-green-100 text-green-700 border border-green-200";
        btnSimpan.disabled = false;
    } else {
        const selisih = Math.abs(totalDebit - totalKredit);
        statusEl.innerText = `✕ TIDAK SEIMBANG (Selisih: Rp ${selisih.toLocaleString('id-ID')})`;
        statusEl.className = "text-xs font-bold text-center py-2 rounded bg-red-100 text-red-700 border border-red-200";
        btnSimpan.disabled = true;
    }
}

async function simpanDataJurnal(e) {
    e.preventDefault();
    const btnSimpan = document.getElementById("btnSimpanJurnal");
    btnSimpan.disabled = true;
    btnSimpan.innerText = "Menyimpan...";

    try {
        const tgl = document.getElementById("tglJurnal").value;
        const ref = document.getElementById("refJurnal") ? document.getElementById("refJurnal").value : "";
        const ket = document.getElementById("ketJurnal").value;
        
        let barisData = [];
        let total = 0;

        document.querySelectorAll("#tbodyJurnal tr").forEach(tr => {
            const akunEl = tr.querySelector('.coa-input');
            const debitEl = tr.querySelector('.input-debit');
            const kreditEl = tr.querySelector('.input-kredit');

            const fullText = akunEl.value; // Contoh: "1101 - Kas Utama"
            const nominalDebit = parseFloat(debitEl.value) || 0;
            const nominalKredit = parseFloat(kreditEl.value) || 0;

            if (fullText && (nominalDebit > 0 || nominalKredit > 0)) {
                // Ekstrak Kode dan Nama dari format input
                const parts = fullText.split(" - ");
                const kodeAkun = parts[0] ? parts[0].trim() : "";
                const namaAkun = parts[1] ? parts.slice(1).join(" - ").trim() : fullText;

                barisData.push({
                    kodeAkun: kodeAkun,
                    namaAkun: namaAkun,
                    debit: nominalDebit,
                    kredit: nominalKredit
                });
                total += nominalDebit; 
            }
        });

        if (barisData.length < 2) {
            throw new Error("Jurnal harus memiliki baris debit dan kredit yang sah.");
        }

        const payload = {
            tanggal: tgl,
            referensi: ref,
            keterangan: ket,
            detail: barisData,
            totalNilai: total,
            dibuatPada: new Date().toISOString()
        };

        await addDoc(collection(db, "jurnal_transaksi"), payload);
        alert("✅ Jurnal berhasil disimpan!");
        window.location.reload(); 

    } catch (err) {
        console.error("Error menyimpan jurnal: ", err);
        alert("Gagal menyimpan jurnal: " + err.message);
        btnSimpan.disabled = false;
        btnSimpan.innerText = "Simpan Jurnal";
    }
}
