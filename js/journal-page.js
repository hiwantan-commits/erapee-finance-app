// js/journal-page.js - Controller untuk input-jurnal.html dengan Proteksi Tutup Buku
import { db } from "./config.js";
import { simpanJurnalPusat, ambilSemuaJurnalPusat } from "./db.js";
import { cekApakahPeriodeTerkunci } from "./closing-period.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let coaOptionsHTML = '<option value="">Pilih Akun...</option>';
const urlParams = new URLSearchParams(window.location.search);
const editIdJurnal = urlParams.get('edit');

window.toggleDueDate = function() {
    const sifat = document.getElementById('sifat_transaksi').value;
    const tglJatuhTempo = document.getElementById('jatuh_tempo');
    if (sifat === 'Non-Tunai') {
        tglJatuhTempo.disabled = false;
        tglJatuhTempo.classList.remove('bg-gray-100', 'cursor-not-allowed');
        tglJatuhTempo.required = true;
    } else {
        tglJatuhTempo.disabled = true;
        tglJatuhTempo.classList.add('bg-gray-100', 'cursor-not-allowed');
        tglJatuhTempo.value = "";
        tglJatuhTempo.required = false;
    }
};

function generateIdJurnal() {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const time = date.getTime().toString().slice(-5);
    document.getElementById('id_jurnal').value = `JRN-${yyyy}${mm}${dd}-${time}`;
    document.getElementById('tanggal').value = `${yyyy}-${mm}-${dd}`;
}

window.hitungTotal = function() {
    let totDebit = 0;
    let totKredit = 0;
    document.querySelectorAll('.debit').forEach(el => totDebit += (parseFloat(el.value) || 0));
    document.querySelectorAll('.kredit').forEach(el => totKredit += (parseFloat(el.value) || 0));

    document.getElementById('totalDebit').innerText = totDebit.toLocaleString('id-ID');
    document.getElementById('totalKredit').innerText = totKredit.toLocaleString('id-ID');

    const statusEl = document.getElementById('statusBalance');
    if (totDebit === totKredit && totDebit > 0) {
        statusEl.className = "px-4 py-1.5 bg-green-100 text-green-700 text-sm font-bold rounded-xl border border-green-300 shadow-sm";
        statusEl.innerText = "✓ SEIMBANG (BALANCE)";
    } else {
        statusEl.className = "px-4 py-1.5 bg-amber-50 text-amber-700 text-sm font-bold rounded-xl border border-amber-200 shadow-sm";
        statusEl.innerText = "⚠️ BELUM BALANCE";
    }
};

window.tambahBaris = function(akunVal = "", memoVal = "", debitVal = 0, kreditVal = 0) {
    const tbody = document.getElementById('tbodyJurnal');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.className = 'jurnal-row hover:bg-gray-50';
    tr.innerHTML = `
        <td class="p-2"><select class="form-input-custom kode_akun text-xs font-medium" required>${coaOptionsHTML}</select></td>
        <td class="p-2"><input type="text" class="form-input-custom memo_baris text-xs" value="${memoVal}" placeholder="Memo..."></td>
        <td class="p-2"><input type="number" class="form-input-custom debit font-bold text-green-700 text-right" value="${debitVal}" min="0" step="any" oninput="hitungTotal()" required></td>
        <td class="p-2"><input type="number" class="form-input-custom kredit font-bold text-red-700 text-right" value="${kreditVal}" min="0" step="any" oninput="hitungTotal()" required></td>
        <td class="p-2 text-center"><button type="button" onclick="hapusBaris(this)" class="bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-200 transition">X</button></td>
    `;
    tbody.appendChild(tr);
    if (akunVal) tr.querySelector('.kode_akun').value = akunVal;
    hitungTotal();
};

window.hapusBaris = function(btn) {
    const rowCount = document.querySelectorAll('.jurnal-row').length;
    if(rowCount > 2) {
        btn.closest('tr').remove();
        hitungTotal();
    } else {
        alert("Minimal harus ada 2 baris!");
    }
};

window.terapkanTemplate = function() {
    const jenis = document.getElementById('pilihTemplate').value;
    const tbody = document.getElementById('tbodyJurnal');
    if (!jenis || !tbody) return;

    tbody.innerHTML = "";
    if (jenis === "GAJI") {
        document.getElementById('keterangan').value = "Pembayaran gaji karyawan periode berjalan";
        tambahBaris("6101", "Beban Gaji & Tunjangan", 0, 0);
        tambahBaris("1101", "Kas / Bank Operasional", 0, 0);
    } else if (jenis === "OPERASIONAL") {
        document.getElementById('keterangan').value = "Pembayaran beban operasional kantor";
        tambahBaris("6102", "Beban Operasional Lainnya", 0, 0);
        tambahBaris("1101", "Kas / Bank Operasional", 0, 0);
    } else if (jenis === "PENDAPATAN") {
        document.getElementById('keterangan').value = "Penerimaan pendapatan penjualan tunai";
        tambahBaris("1101", "Kas / Bank Operasional", 0, 0);
        tambahBaris("4101", "Pendapatan Usaha", 0, 0);
    } else if (jenis === "PEMBELIAN_ASET") {
        document.getElementById('keterangan').value = "Pembelian aset tetap secara tunai";
        tambahBaris("1501", "Aset Tetap", 0, 0);
        tambahBaris("1101", "Kas / Bank Operasional", 0, 0);
    }
};

async function inisialisasiData() {
    try {
        const snapUnit = await getDocs(collection(db, "master_unit_usaha"));
        const selectUnit = document.getElementById('unit_usaha');
        if (selectUnit) {
            let units = [];
            snapUnit.forEach(d => units.push(d.data()));
            selectUnit.innerHTML = '<option value="">Pilih Unit...</option>';
            units.forEach(u => {
                selectUnit.innerHTML += `<option value="${u.kode} - ${u.nama}">${u.kode} - ${u.nama}</option>`;
            });
        }
    } catch (err) {}

    try {
        const snapCOA = await getDocs(collection(db, "master_coa"));
        let coaList = [];
        snapCOA.forEach(d => coaList.push(d.data()));
        coaList.sort((a, b) => a.kode.localeCompare(b.kode));
        
        coaOptionsHTML = '<option value="">Pilih Akun...</option>';
        coaList.forEach(coa => {
            coaOptionsHTML += `<option value="${coa.kode}">${coa.kode} - ${coa.nama}</option>`;
        });
    } catch (err) {}

    if (editIdJurnal) {
        document.getElementById('judulForm').innerText = "Edit Jurnal Akuntansi (" + editIdJurnal + ")";
        document.getElementById('btnSubmit').innerText = "Simpan Perubahan";
        
        try {
            const semuaData = await ambilSemuaJurnalPusat();
            const jurnalTarget = semuaData.find(j => j.id_jurnal === editIdJurnal);

            if (jurnalTarget) {
                document.getElementById('id_jurnal').value = jurnalTarget.id_jurnal;
                document.getElementById('tanggal').value = jurnalTarget.tanggal || '';
                document.getElementById('no_bukti').value = jurnalTarget.no_bukti || '';
                document.getElementById('sifat_transaksi').value = jurnalTarget.sifat_transaksi || 'Tunai';
                document.getElementById('unit_usaha').value = jurnalTarget.unit_usaha || '';
                document.getElementById('lawan_transaksi').value = jurnalTarget.lawan_transaksi || '';
                document.getElementById('jatuh_tempo').value = jurnalTarget.jatuh_tempo || '';
                document.getElementById('link_bukti').value = jurnalTarget.link_bukti || '';
                document.getElementById('kode_pajak').value = jurnalTarget.kode_pajak || 'NON';
                document.getElementById('dpp_penjualan').value = jurnalTarget.dpp_penjualan || 0;
                document.getElementById('keterangan').value = jurnalTarget.keterangan || '';
                document.getElementById('status_jurnal').value = jurnalTarget.status || 'POSTED';
                toggleDueDate();

                const tbody = document.getElementById('tbodyJurnal');
                tbody.innerHTML = "";
                jurnalTarget.rows.forEach(d => {
                    tambahBaris(d.kode_akun, d.memo_baris, d.debit, d.kredit);
                });
            } else {
                alert("Data jurnal tidak ditemukan.");
                window.location.href = 'manajemen.html';
            }
        } catch (err) {
            console.error("Gagal memuat data edit:", err);
        }
    } else {
        generateIdJurnal();
        tambahBaris();
        tambahBaris();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    inisialisasiData();

    const formJurnal = document.getElementById('formJurnal');
    if (formJurnal) {
        formJurnal.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const tanggalInput = document.getElementById('tanggal').value;
            
            // Pengecekan Periode Tutup Buku
            const isTerkunci = await cekApakahPeriodeTerkunci(tanggalInput);
            if (isTerkunci) {
                alert("❌ Transaksi ditolak! Periode bulan untuk tanggal ini telah ditutup (Closed Period). Anda tidak dapat menambah atau mengubah jurnal pada periode tersebut.");
                return;
            }

            let totDebit = 0, totKredit = 0;
            const rows = document.querySelectorAll('.jurnal-row');
            rows.forEach(row => {
                totDebit += parseFloat(row.querySelector('.debit').value) || 0;
                totKredit += parseFloat(row.querySelector('.kredit').value) || 0;
            });

            if (totDebit !== totKredit || totDebit === 0) {
                alert("❌ Transaksi ditolak! Total Debit dan Kredit harus SEIMBANG dan tidak boleh 0.");
                return;
            }

            const btn = document.getElementById('btnSubmit');
            btn.innerText = "Memproses... Penyimpanan Terpusat";
            btn.disabled = true;

            try {
                const targetIdJurnal = document.getElementById('id_jurnal').value;

                const headerData = {
                    id_jurnal: targetIdJurnal,
                    tanggal: tanggalInput,
                    no_bukti: document.getElementById('no_bukti').value,
                    sifat_transaksi: document.getElementById('sifat_transaksi').value,
                    unit_usaha: document.getElementById('unit_usaha').value,
                    lawan_transaksi: document.getElementById('lawan_transaksi').value,
                    jatuh_tempo: document.getElementById('jatuh_tempo').value,
                    link_bukti: document.getElementById('link_bukti').value,
                    kode_pajak: document.getElementById('kode_pajak').value,
                    dpp_penjualan: parseFloat(document.getElementById('dpp_penjualan').value) || 0,
                    keterangan: document.getElementById('keterangan').value,
                    status: document.getElementById('status_jurnal').value
                };

                let rowsData = [];
                rows.forEach(row => {
                    const selectCOA = row.querySelector('.kode_akun');
                    rowsData.push({
                        kode_akun: selectCOA.value,
                        nama_akun: selectCOA.options[selectCOA.selectedIndex]?.text || '',
                        memo_baris: row.querySelector('.memo_baris').value || '',
                        debit: parseFloat(row.querySelector('.debit').value) || 0,
                        kredit: parseFloat(row.querySelector('.kredit').value) || 0
                    });
                });

                const hasil = await simpanJurnalPusat(headerData, rowsData, editIdJurnal ? targetIdJurnal : null);

                if (hasil.success) {
                    document.getElementById('alertSuccess').classList.remove('hidden');
                    setTimeout(() => {
                        window.location.href = 'manajemen.html';
                    }, 1500);
                } else {
                    alert("Gagal menyimpan: " + hasil.error);
                    btn.innerText = "Simpan Jurnal";
                    btn.disabled = false;
                }

            } catch (error) {
                console.error("Gagal menyimpan:", error);
                alert("Kesalahan sistem saat menyimpan data.");
                btn.innerText = "Simpan Jurnal";
                btn.disabled = false;
            }
        });
    }
});
