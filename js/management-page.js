// js/management-page.js - Controller untuk manajemen.html dengan Pagination
import { db } from "./config.js";
import { ambilSemuaJurnalPusat, hapusJurnalPusat } from "./db.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { escapeHtml } from "./utils.js";

// Mencegah CSV/Formula Injection: jika nilai teks diawali =, +, -, atau @,
// Excel/Sheets bisa menafsirkannya sebagai formula saat file CSV dibuka.
function amankanSelCsv(nilai) {
    const teks = String(nilai ?? '');
    return /^[=+\-@]/.test(teks) ? "'" + teks : teks;
}

window.dataJurnalGlobal = {};
let listJurnalCache = [];
let halamanAktif = 1;
const dataPerHalaman = 10;

async function muatManajemenJurnal() {
    const tbody = document.getElementById('tabelManajemenJurnal');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-400">Memuat data teroptimasi dari pusat...</td></tr>`;

    try {
        const snapUnit = await getDocs(collection(db, "master_unit_usaha"));
        const selectFilter = document.getElementById('filterUnit');
        if (selectFilter) {
            let unitOptions = '<option value="ALL">Semua Unit Usaha</option>';
            snapUnit.forEach(d => {
                const u = d.data();
                const label = escapeHtml(u.kode) + " - " + escapeHtml(u.nama);
                unitOptions += `<option value="${label}">${label}</option>`;
            });
            selectFilter.innerHTML = unitOptions;
        }

        const listJurnal = await ambilSemuaJurnalPusat();
        
        if (listJurnal.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-400">Belum ada transaksi jurnal tercatat.</td></tr>`;
            return;
        }

        window.dataJurnalGlobal = {};
        listJurnal.forEach(j => {
            window.dataJurnalGlobal[j.id_jurnal] = j;
        });
        listJurnalCache = listJurnal;

        halamanAktif = 1;
        renderTabelDenganPagination(listJurnalCache);
    } catch (err) {
        console.error("Gagal memuat manajemen jurnal:", err);
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-500">Gagal memuat data dari pusat database.</td></tr>`;
    }
}

function renderTabelDenganPagination(dataList) {
    const tbody = document.getElementById('tabelManajemenJurnal');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-400">Tidak ada transaksi yang cocok.</td></tr>`;
        hapusKontrolPagination();
        return;
    }

    // Hitung Pagination
    const totalHalaman = Math.ceil(dataList.length / dataPerHalaman);
    if (halamanAktif > totalHalaman) halamanAktif = totalHalaman;
    if (halamanAktif < 1) halamanAktif = 1;

    const indeksAwal = (halamanAktif - 1) * dataPerHalaman;
    const indeksAkhir = indeksAwal + dataPerHalaman;
    const dataHalamanIni = dataList.slice(indeksAwal, indeksAkhir);

    dataHalamanIni.forEach((jurnal) => {
        let tr = document.createElement('tr');
        let badgeStatus = jurnal.status === 'POSTED' 
            ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 rounded font-semibold">POSTED</span>' 
            : '<span class="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold">DRAFT</span>';
        
        let balanceStatus = (jurnal.total_debit === jurnal.total_kredit && jurnal.total_debit > 0)
            ? '<span class="text-xs text-green-600 font-semibold mt-0.5 block">✓ Seimbang</span>'
            : '<span class="text-xs text-red-500 font-semibold mt-0.5 block">⚠️ Selisih</span>';

        tr.innerHTML = `
            <td class="p-3">
                <div class="font-bold text-indigo-700">${escapeHtml(jurnal.id_jurnal)}</div>
                <div class="text-xs text-gray-500 mt-0.5">${escapeHtml(jurnal.tanggal)}</div>
            </td>
            <td class="p-3">
                <div class="font-semibold text-gray-800">${escapeHtml(jurnal.unit_usaha) || '-'}</div>
                <div class="text-xs text-gray-500 font-mono mt-0.5">${escapeHtml(jurnal.no_bukti)}</div>
            </td>
            <td class="p-3">
                <div class="font-medium text-gray-800">${escapeHtml(jurnal.lawan_transaksi) || '-'}</div>
                <div class="text-xs text-gray-500 truncate max-w-xs mt-0.5">${escapeHtml(jurnal.keterangan) || '-'}</div>
            </td>
            <td class="p-3 text-right">
                <div class="font-bold text-gray-800">${jurnal.total_debit.toLocaleString('id-ID')}</div>
                ${balanceStatus}
            </td>
            <td class="p-3 text-center">${badgeStatus}</td>
            <td class="p-3">
                <div class="flex items-center justify-center flex-wrap gap-1.5">
                    <button onclick="editJurnal('${jurnal.id_jurnal}')" title="Edit" class="text-amber-600 bg-amber-50 hover:bg-amber-100 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg font-semibold text-xs transition flex items-center gap-1">
                        <span>✏️</span><span class="hidden sm:inline">Edit</span>
                    </button>
                    <button onclick="cetakVoucher('${jurnal.id_jurnal}')" title="Cetak" class="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg font-semibold text-xs transition flex items-center gap-1">
                        <span>🖨️</span><span class="hidden sm:inline">Cetak</span>
                    </button>
                    <button onclick="hapusJurnalGrup('${jurnal.id_jurnal}')" title="Hapus" class="text-red-600 bg-red-50 hover:bg-red-100 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg font-semibold text-xs transition flex items-center gap-1">
                        <span>🗑️</span><span class="hidden sm:inline">Hapus</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderKontrolPagination(totalHalaman);
}

function renderKontrolPagination(totalHalaman) {
    let containerPagination = document.getElementById('pagination-container');
    if (!containerPagination) {
        containerPagination = document.createElement('div');
        containerPagination.id = 'pagination-container';
        containerPagination.className = 'flex justify-between items-center mt-4 px-2 py-3 border-t border-gray-100 text-xs text-gray-600';
        const cardTabel = document.querySelector('#tabelManajemenJurnal').closest('.dashboard-card');
        if (cardTabel) cardTabel.appendChild(containerPagination);
    }

    if (totalHalaman <= 1) {
        containerPagination.innerHTML = `<span>Menampilkan seluruh data transaksi</span>`;
        return;
    }

    containerPagination.innerHTML = `
        <span>Halaman <b>${halamanAktif}</b> dari <b>${totalHalaman}</b></span>
        <div class="space-x-1">
            <button onclick="window.ubahHalaman(${halamanAktif - 1})" ${halamanAktif === 1 ? 'disabled class="px-3 py-1 bg-gray-100 text-gray-400 rounded cursor-not-allowed"' : 'class="px-3 py-1 bg-indigo-50 text-indigo-700 font-semibold rounded hover:bg-indigo-100 transition"'}>Sebelumnya</button>
            <button onclick="window.ubahHalaman(${halamanAktif + 1})" ${halamanAktif === totalHalaman ? 'disabled class="px-3 py-1 bg-gray-100 text-gray-400 rounded cursor-not-allowed"' : 'class="px-3 py-1 bg-indigo-50 text-indigo-700 font-semibold rounded hover:bg-indigo-100 transition"'}>Berikutnya</button>
        </div>
    `;
}

function hapusKontrolPagination() {
    const containerPagination = document.getElementById('pagination-container');
    if (containerPagination) containerPagination.remove();
}

window.ubahHalaman = function(targetHalaman) {
    halamanAktif = targetHalaman;
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

    renderTabelDenganPagination(filtered);
};

window.filterTabelJurnal = function() {
    halamanAktif = 1; // Reset ke halaman pertama saat memfilter
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

    renderTabelDenganPagination(filtered);
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
            `"${amankanSelCsv(j.id_jurnal)}"`, `"${amankanSelCsv(j.tanggal)}"`, `"${amankanSelCsv(j.no_bukti)}"`,
            `"${amankanSelCsv(j.unit_usaha || '')}"`, `"${amankanSelCsv(j.lawan_transaksi || '')}"`,
            `"${amankanSelCsv((j.keterangan || '').replace(/"/g, '""'))}"`, `"${amankanSelCsv(j.status)}"`,
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
        rowsHTML += "<td style='padding: 8px; border: 1px solid #ddd;'>" + escapeHtml(row.kode_akun) + " - " + escapeHtml(row.nama_akun) + "</td>";
        rowsHTML += "<td style='padding: 8px; border: 1px solid #ddd;'>" + (escapeHtml(row.memo_baris) || '-') + "</td>";
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
    templateCetak += "<tr><td style='width:15%;font-weight:bold;'>ID Jurnal</td><td style='width:35%;'>: " + escapeHtml(jurnal.id_jurnal) + "</td><td style='width:15%;font-weight:bold;'>Tanggal</td><td style='width:35%;'>: " + escapeHtml(jurnal.tanggal) + "</td></tr>";
    templateCetak += "<tr><td style='font-weight:bold;'>No. Bukti</td><td>: " + escapeHtml(jurnal.no_bukti) + "</td><td style='font-weight:bold;'>Status</td><td>: " + escapeHtml(jurnal.status) + "</td></tr>";
    templateCetak += "<tr><td style='font-weight:bold;'>Unit Usaha</td><td colspan='3'>: " + (escapeHtml(jurnal.unit_usaha) || '-') + "</td></tr>";
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
