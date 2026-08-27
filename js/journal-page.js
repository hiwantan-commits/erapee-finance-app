// js/journal-page.js - Controller Input Jurnal (Desain Asli dengan Fitur Searchable)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { CONFIG } from "./config.js";

const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const db = getFirestore(app);

let daftarCOA = []; 
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
        daftarCOA = []; 
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if(data.kodeAkun && data.namaAkun) {
                daftarCOA.push({
                    kode: data.kodeAkun,
                    nama: data.namaAkun,
                    labelTampil: `${data.kodeAkun} - ${data.namaAkun}`
                });
            }
        });
        daftarCOA.sort((a, b) => a.kode.localeCompare(b.kode));
    } catch (error) {
        console.error("Gagal memuat Master COA: ", error);
    }
}

function tambahBarisJurnal() {
    counterBaris++;
    const rowId = `row-${counterBaris}`;
    const tbody = document.getElementById("tbodyJurnal");
    if(!tbody) return;
    
    let opsiHtml = `<option value="">Pilih Akun...</option>`;
    daftarCOA.forEach(coa => {
        opsiHtml += `<option value="${coa.kode}">${coa.labelTampil}</option>`;
    });

    const tr = document.createElement("tr");
    tr.id = rowId;
    
    // Menggunakan gaya asli tabel yang lebih ringkas dan sesuai dengan tema Anda
    tr.innerHTML = `
        <td class="p-2 align-top">
            <select class="coa-dropdown w-full" required>
                ${opsiHtml}
            </select>
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

    // Inisialisasi fitur ketik pencarian tanpa mengubah gaya berlebihan
    const elemenSelectBaru = tr.querySelector('.coa-dropdown');
    new TomSelect(elemenSelectBaru, {
        create: false,
        sortField: { field: "text", direction: "asc" },
        maxOptions: 50,
        placeholder: "Pilih Akun...",
        controlInput: '<input>',
    });

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
        btnSimpan.disabled = true;
    } else if (totalDebit === totalKredit) {
        statusEl.innerText = "JURNAL SEIMBANG";
        btnSimpan.disabled = false;
    } else {
        statusEl.innerText = "TIDAK SEIMBANG";
        btnSimpan.disabled = true;
    }
}

async function simpanDataJurnal(e) {
    e.preventDefault();
    const btnSimpan = document.getElementById("btnSimpanJurnal");
    btnSimpan.disabled = true;

    try {
        const tgl = document.getElementById("tglJurnal").value;
        const ref = document.getElementById("refJurnal") ? document.getElementById("refJurnal").value : "";
        const ket = document.getElementById("ketJurnal").value;
        
        let barisData = [];
        let total = 0;

        document.querySelectorAll("#tbodyJurnal tr").forEach(tr => {
            const akunEl = tr.querySelector('.coa-dropdown');
            const debitEl = tr.querySelector('.input-debit');
            const kreditEl = tr.querySelector('.input-kredit');

            const kodeAkun = akunEl.value; 
            const namaAkun = akunEl.options[akunEl.selectedIndex].text; 
            const nominalDebit = parseFloat(debitEl.value) || 0;
            const nominalKredit = parseFloat(kreditEl.value) || 0;

            if (kodeAkun && (nominalDebit > 0 || nominalKredit > 0)) {
                barisData.push({
                    kodeAkun: kodeAkun,
                    namaAkun: namaAkun,
                    debit: nominalDebit,
                    kredit: nominalKredit
                });
                total += nominalDebit; 
            }
        });

        const payload = {
            tanggal: tgl,
            referensi: ref,
            keterangan: ket,
            detail: barisData,
            totalNilai: total,
            dibuatPada: new Date().toISOString()
        };

        await addDoc(collection(db, "jurnal_transaksi"), payload);
        alert("Jurnal berhasil disimpan!");
        window.location.reload(); 

    } catch (err) {
        console.error("Error menyimpan jurnal: ", err);
        alert("Gagal menyimpan jurnal.");
        btnSimpan.disabled = false;
    }
}
