// js/management-page.js - Controller untuk manajemen.html
import { db } from "./config.js";
import { ambilSemuaJurnalPusat, hapusJurnalPusat } from "./db.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// State Global untuk pencarian dan ekspor
window.dataJurnalGlobal = {};
let listJurnalCache = [];

async function muatManajemenJurnal() {
    const tbody = document.getElementById('tabelManajemenJurnal');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-400">Memuat data dari pusat...</td></tr>`;

    try {
        // Ambil Master Unit Usaha untuk Filter
        const snapUnit = await getDocs(collection(db, "master_unit_usaha"));
        const selectFilter = document.getElementById('filterUnit');
        if (selectFilter) {
            let unitOptions = '<option value="ALL">Semua Unit Usaha</option>';
            snapUnit.forEach(d => {
                const u = d.data();
                unitOptions += `<option value="${u.kode} - ${u.nama}">${u.kode} - ${u.nama}</option>`;
            });
            selectFilter.innerHTML = unitOptions;
        }

        // Ambil Data Jurnal Terpusat
        const listJurnal = await ambilSemuaJurnalPusat();
        
        if (listJurnal.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-400">Belum ada transaksi jurnal tercatat. Silakan buat melalui menu <b>Input Jurnal</b>.</td></tr>`;
            return;
        }

        window.dataJurnalGlobal = {};
        listJurnal.forEach(j => {
            window.dataJurnalGlobal[j.id_jurnal] = j;
        });
        listJurnalCache = listJurnal;

        renderTabel(listJurnalCache);
    } catch (err) {
        console.error("Gagal memuat manajemen jurnal:", err);
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-500">Gagal memuat data dari pusat database.</td></tr>`;
    }
}

function renderTabel(dataList) {
    const tbody = document.getElementById('tabelManajemenJurnal');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-400">Tidak ada transaksi yang cocok.</td></tr>`;
        return;
    }

    dataList.forEach((jurnal) => {
        let tr = document.createElement('tr');
        let badgeStatus = jurnal.status === 'POSTED' 
            ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 rounded font-semibold">POSTED</span>' 
            : '<span class="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold">DRAFT</span>';
        
        let balanceStatus = (jurnal.total_debit === jurnal.total_kredit && jurnal.total_debit > 0)
            ? '<span class="text-xs text-green-600 font-semibold mt-0.5 block">✓ Seimbang</span>'
            : '<span class="text-xs text-red-500 font-semibold mt-0.5 block">⚠️ Selisih</span>';

        tr.innerHTML = `
            <td class="p-3">
                <div class="font-bold text-indigo-700">${jurnal.id_jurnal}</div>
                <div class="text-xs text-gray-500 mt-0.5">${jurnal.tanggal}</div>
            </td>
            <td class="p-3">
                <div class="font-semibold text-gray-800">${jurnal.unit_usaha || '-'}</div>
                <div class="text-xs text-gray-500 font-mono mt-0.5">${jurnal.no_bukti}</div>
            </td>
            <td class="p-3">
                <div class="font-medium text-gray-800">${jurnal.lawan_transaksi || '-'}</div>
                <div class="text-xs text-gray-500 truncate max-w-xs mt-0.5">${jurnal.keterangan || '-'}</div>
            </td>
            <td class="p-3 text-right">
                <div class="font-bold text-gray-800">${jurnal.total_debit.toLocaleString('id-ID')}</div>
                ${balanceStatus}
            </td>
            <td class="p-3 text-center">${badgeStatus}</td>
            <td class="p-3 text-center space-x-1">
                <button onclick="editJurnal('${jurnal.id_jurnal}')" class="text-amber-600 bg-amber-50 px-2 py-1 rounded hover:bg-amber-100 font-semibold text-xs transition">✏️ Edit</button>
                <button onclick="cetakVoucher('${jurnal.id_jurnal}')" class="text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 font-semibold text-xs transition">🖨️ Cetak</button>
                <button onclick="hapusJurnalGrup('${jurnal.id_jurnal}')" class="text-red-600 bg-red-50 px-2 py-1 rounded hover:bg-red-100 font-semibold text-xs transition">🗑️ Hapus</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Global scope binding agar bisa dipanggil oleh `onclick` di HTML
window.filterTabelJurnal = function() {
    const keyword = document.getElementById('inputPencarian').value.toLowerCase();
    const selectedUnit = document.getElementById('filterUnit').value;

    const filtered = listJurnalCache.filter(j => {
        const matchUnit = (selectedUnit === 'ALL' || j.unit_usaha === selectedUnit);
        const matchKeyword = (
            j.id_jurnal.toLowerCase().includes(keyword) ||
            j.no_bukti.toLowerCase().includes(keyword) ||
            j.lawan_transaksi.toLowerCase().includes(keyword) ||
            (j.keterangan && j.keterangan.toLowerCase().includes(keyword))
        );
        return matchUnit && matchKeyword;
    });

    renderTabel(filtered);
};

window.editJurnal = function(id_jurnal) {
    window.location.href = `input-jurnal.html?edit=${id_jurnal}`;
};

window.hapusJurnalGrup = async function(id_jurnal) {
    if (confirm(`Apakah Anda yakin ingin menghapus SELURUH transaksi dengan ID ${id_jurnal}?`)) {
        try {
            const hasil = await hapusJurnalPusat(id_jurnal);
            if (hasil.success) {
                alert("Transaksi jurnal berhasil dihapus sepenuhnya!");
                muatManajemenJurnal();
            } else {
                alert("Gagal menghapus: " + hasil.error);
            }
        } catch (error) {
            alert("Gagal menghapus jurnal: " + error.message);
        }
    }
};

window.eksporKeExcel = function() {
    const listJurnal = Object.values(window.dataJurnalGlobal);
    if (listJurnal.length === 0) return alert("Tidak ada data untuk diekspor!");

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID Jurnal,Tanggal,No Bukti,Unit Usaha,Lawan Transaksi,Keterangan,Status,Total Debit,Total Kredit\r\n";

    listJurnal.forEach(j => {
        let row = [
            `"${j.id_jurnal}"`, `"${j.tanggal}"`, `"${j.no_bukti}"`, 
            `"${j.unit_usaha || ''}"`, `"${j.lawan_transaksi || ''}"`, 
            `"${(j.keterangan || '').replace(/"/g, '""')}"`, `"${j.status}"`, 
            j.total_debit, j.total_kredit
        ];
        csvContent += row.join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Jurnal_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.cetakVoucher = function(id_jurnal) {
    const jurnal = window.dataJurnalGlobal[id_jurnal];
    if (!jurnal) return alert("Data jurnal tidak ditemukan!");

    let rowsHTML = "";
    jurnal.rows.forEach((row, index) => {
        rowsHTML += "<tr>";
        rowsHTML += "<td style='padding: 8px; border: 1px solid #ddd; text-align: center;'>" + (index + 1) + "</td>";
        rowsHTML += "<td style='padding: 8px; border: 1px solid #ddd;'>" + row.kode_akun + " - " + row.nama_akun + "</td>";
        rowsHTML += "<td style='padding: 8px; border: 1px solid #ddd;'>" + (row.memo_baris || '-') + "</td>";
        rowsHTML += "<td style='padding: 8px; border: 1px solid #ddd; text-align: right;'>" + (parseFloat(row.debit)||0).toLocaleString('id-ID') + "</td>";
        rowsHTML += "<td style='padding: 8px; border: 1px solid #ddd; text-align: right;'>" + (parseFloat(row.kredit)||0).toLocaleString('id-ID') + "</td>";
        rowsHTML += "</tr>";
    });

    let templateCetak = "<html><head><title>Bukti Jurnal - " + jurnal.id_jurnal + "</title>";
    templateCetak += "<style>body{font-family:Arial,sans-serif;font-size:12px;color:#333;margin:40px;}h2{text-align:center;margin-bottom:5px;} .data-table{width:100%;border-collapse:collapse;margin-bottom:30px;} .data-table th{background-color:#f3f4f6;padding:10px;border:1px solid #ddd;} .data-table td{padding:8px;border:1px solid #ddd;}</style>";
    templateCetak += "</head><body>";
    templateCetak += "<h2>PT ERAPEE Anugrah Sejahtera</h2>";
    templateCetak += "<div style='text-align:center;font-weight:bold;margin-bottom:30px;'>BUKTI JURNAL (VOUCHER)</div>";
    templateCetak += "<table style='width:100%;margin-bottom:20px;'>";
    templateCetak += "<tr><td style='width:15%;font-weight:bold;'>ID Jurnal</td><td style='width:35%;'>: " + jurnal.id_jurnal + "</td><td style='width:15%;font-weight:bold;'>Tanggal</td><td style='width:35%;'>: " + jurnal.tanggal + "</td></tr>";
    templateCetak += "<tr><td style='font-weight:bold;'>No. Bukti</td><td>: " + jurnal.no_bukti + "</td><td style='font-weight:bold;'>Status</td><td>: " + jurnal.status + "</td></tr>";
    templateCetak += "<tr><td style='font-weight:bold;'>Unit Usaha</td><td colspan='3'>: " + (jurnal.unit_usaha || '-') + "</td></tr>";
    templateCetak += "</table>";
    templateCetak += "<table class='data-table'><thead><tr><th>No</th><th>Kode & Nama Akun</th><th>Memo</th><th>Debit (Rp)</th><th>Kredit (Rp)</th></tr></thead><tbody>";
    templateCetak += rowsHTML;
    templateCetak += "<tr style='font-weight:bold;background-color:#f9fafb;'><td colspan='3' style='text-align:right;padding:10px;border:1px solid #ddd;'>TOTAL</td><td style='text-align:right;padding:10px;border:1px solid #ddd;'>" + jurnal.total_debit.toLocaleString('id-ID') + "</td><td style='text-align:right;padding:10px;border:1px solid #ddd;'>" + jurnal.total_kredit.toLocaleString('id-ID') + "</td></tr>";
    templateCetak += "</tbody></table>";
    templateCetak += "<table style='width:100%;margin-top:50px;text-align:center;'><tr><td>Dibuat Oleh,<br><br><br><br>(_________________)</td><td>Disetujui Oleh,<br><br><br><br>(_________________)</td></tr></table>";
    templateCetak += "<script>window.onload = function() { window.print(); window.close(); };<\/script>";
    templateCetak += "</body></html>";

    const printWindow = window.open('', '_blank');
    printWindow.document.write(templateCetak);
    printWindow.document.close();
};

muatManajemenJurnal();
