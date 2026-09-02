// js/management-page.js - Controller untuk manajemen.html dengan Pagination
import { db } from "./config.js";
import { ambilSemuaJurnalPusat, hapusJurnalPusat } from "./db.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { escapeHtml, amankanSelCsv, unduhCsv } from "./utils.js";

window.dataJurnalGlobal = {};
let listJurnalCache = [];
let halamanAktif = 1;
const dataPerHalaman = 10;

async function muatManajemenJurnal() {
    const tbody = document.getElementById('tabelManajemenJurnal');
    const kartuContainer = document.getElementById('kartuManajemenJurnal');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-stone-400 dark:text-stone-500">Memuat data teroptimasi dari pusat...</td></tr>`;

    try {
        const snapUnit = await getDocs(collection(db, "master_unit_usaha"));
        const selectFilter = document.getElementById('filterUnit');
        if (selectFilter) {
            // Fungsi ini dipanggil ulang setelah hapus transaksi (bukan cuma
            // saat halaman pertama kali dibuka) - simpan & kembalikan pilihan
            // filter yang sedang aktif, supaya membangun ulang isi <select>
            // di bawah ini tidak diam-diam mengembalikannya ke "Semua Unit
            // Usaha".
            const nilaiTerpilihSebelumnya = selectFilter.value || 'ALL';

            let unitOptions = '<option value="ALL">Semua Unit Usaha</option>';
            const daftarUnit = [];
            snapUnit.forEach(d => daftarUnit.push(d.data()));
            daftarUnit.sort((a, b) => (a.kode || '').localeCompare(b.kode || '', 'id'));
            daftarUnit.forEach(u => {
                const kode = escapeHtml(u.kode);
                const label = kode + " - " + escapeHtml(u.nama);
                // value = kode saja, karena jurnal.unit_usaha tersimpan bersih
                // sebagai kode tanpa nama (lihat journal-page.js) - sebelumnya
                // value di sini ikut memuat " - Nama" sehingga perbandingan
                // di dapatkanDataTersaring() tidak pernah cocok dan filter
                // diam-diam tidak berfungsi (kecuali opsi "Semua Unit Usaha").
                unitOptions += `<option value="${kode}">${label}</option>`;
            });
            selectFilter.innerHTML = unitOptions;
            selectFilter.value = nilaiTerpilihSebelumnya;
        }

        const listJurnal = await ambilSemuaJurnalPusat();

        if (listJurnal.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-stone-400 dark:text-stone-500">Belum ada transaksi jurnal tercatat.</td></tr>`;
            if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-stone-400 dark:text-stone-500 text-sm">Belum ada transaksi jurnal tercatat.</p>`;
            return;
        }

        window.dataJurnalGlobal = {};
        listJurnal.forEach(j => {
            window.dataJurnalGlobal[j.id_jurnal] = j;
        });
        listJurnalCache = listJurnal;

        // Sengaja TIDAK mereset halamanAktif ke 1 di sini - fungsi ini juga
        // dipanggil ulang setelah hapus transaksi (hapusJurnalGrup), dan
        // pengguna yang menghapus baris dari halaman 3 mengharapkan tetap
        // berada di halaman 3, bukan terlempar balik ke halaman 1.
        // renderTabelDenganPagination() sendiri sudah menangani kasus
        // halaman aktif jadi tidak valid lagi (mis. halaman terakhir jadi
        // kosong setelah baris terakhirnya dihapus) dengan menurunkannya ke
        // halaman terakhir yang masih ada.
        //
        // Dipakai bersama dapatkanDataTersaring() (bukan listJurnalCache
        // mentah) supaya filter pencarian/unit/tanggal yang sedang aktif
        // tetap diterapkan setelah reload, bukan diam-diam terlewati.
        renderTabelDenganPagination(dapatkanDataTersaring());
    } catch (err) {
        console.error("Gagal memuat manajemen jurnal:", err);
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500 dark:text-red-400">Gagal memuat data dari pusat database.</td></tr>`;
        if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-red-500 dark:text-red-400 text-sm">Gagal memuat data dari pusat database.</p>`;
    }
}

// Menu aksi per-baris memakai pola dropdown/3-titik (bukan 3 tombol
// terpisah) - konsisten dengan menu akun di sidebar. Setiap baris butuh ID
// panel unik, jadi karakter di luar alfanumerik pada id_jurnal diamankan
// dulu supaya selalu jadi id HTML yang valid.
function tombolAksiHtml(id_jurnal) {
    const idAman = String(id_jurnal).replace(/[^a-zA-Z0-9_-]/g, '_');
    const panelId = `menuAksiJurnal-${idAman}`;
    return `
        <div class="relative inline-block">
            <button type="button" onclick="window.toggleDropdownElegant(event, '${panelId}')" class="btn-elegant-icon" title="Aksi">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="12" cy="19" r="1.75"/></svg>
            </button>
            <div id="${panelId}" class="hidden absolute right-0 mt-1 z-50" data-dropdown-elegant>
                <div class="dropdown-elegant-panel">
                    <button type="button" onclick="editJurnal('${id_jurnal}')" class="dropdown-elegant-item">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        Edit
                    </button>
                    <button type="button" onclick="cetakVoucher('${id_jurnal}')" class="dropdown-elegant-item">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6"/><rect x="6" y="13" width="12" height="8"/><path d="M6 17H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2"/></svg>
                        Cetak
                    </button>
                    <div class="dropdown-elegant-divider"></div>
                    <button type="button" onclick="hapusJurnalGrup('${id_jurnal}')" class="dropdown-elegant-item dropdown-elegant-item-danger">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>
                        Hapus
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderTabelDenganPagination(dataList) {
    const tbody = document.getElementById('tabelManajemenJurnal');
    const kartuContainer = document.getElementById('kartuManajemenJurnal');
    if (!tbody) return;

    if (dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-stone-400 dark:text-stone-500">Tidak ada transaksi yang cocok.</td></tr>`;
        if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-stone-400 dark:text-stone-500 text-sm">Tidak ada transaksi yang cocok.</p>`;
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

    const barisTabel = [];
    const kartuMobile = [];

    dataHalamanIni.forEach((jurnal) => {
        const tidakSeimbang = !(jurnal.total_debit === jurnal.total_kredit && jurnal.total_debit > 0);

        const badgeStatus = jurnal.status === 'POSTED'
            ? '<span class="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded font-semibold">POSTED</span>'
            : '<span class="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 rounded font-semibold">DRAFT</span>';

        const balanceStatus = tidakSeimbang
            ? '<span class="text-xs text-red-500 dark:text-red-400 font-semibold mt-0.5 block">⚠️ Selisih</span>'
            : '<span class="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 block">✓ Seimbang</span>';

        // Baris tidak seimbang diberi latar merah muda agar langsung terlihat -
        // ini seharusnya jarang terjadi dan perlu segera diperiksa.
        barisTabel.push(`
            <tr class="${tidakSeimbang ? 'bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50' : 'hover:bg-stone-50 dark:hover:bg-stone-800/40'}">
                <td class="p-3">
                    <div class="font-bold text-stone-900 dark:text-stone-100">${escapeHtml(jurnal.id_jurnal)}</div>
                </td>
                <td class="p-3 text-stone-500 dark:text-stone-400">${escapeHtml(jurnal.tanggal)}</td>
                <td class="p-3">
                    <div class="font-semibold text-stone-800 dark:text-stone-200">${escapeHtml(jurnal.unit_usaha) || '-'}</div>
                    <div class="text-xs text-stone-400 dark:text-stone-500 font-mono mt-0.5">${escapeHtml(jurnal.no_bukti)}</div>
                </td>
                <td class="p-3">
                    <div class="font-medium text-stone-800 dark:text-stone-200">${escapeHtml(jurnal.lawan_transaksi) || '-'}</div>
                    <div class="text-xs text-stone-400 dark:text-stone-500 truncate max-w-xs mt-0.5">${escapeHtml(jurnal.keterangan) || '-'}</div>
                </td>
                <td class="p-3 text-right">
                    <div class="font-bold text-stone-800 dark:text-stone-200">${jurnal.total_debit.toLocaleString('id-ID')}</div>
                    ${balanceStatus}
                </td>
                <td class="p-3 text-center">${badgeStatus}</td>
                <td class="p-3 text-center">${tombolAksiHtml(jurnal.id_jurnal)}</td>
            </tr>
        `);

        // Tampilan kartu untuk layar sempit (pengganti tabel horizontal yang
        // sulit dibaca di HP karena banyak kolom).
        kartuMobile.push(`
            <div class="border ${tidakSeimbang ? 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30' : 'border-stone-200/70 dark:border-stone-800'} rounded-[0.625rem] p-4">
                <div class="flex justify-between items-start gap-2 mb-2">
                    <div>
                        <div class="font-bold text-stone-900 dark:text-stone-100 text-sm">${escapeHtml(jurnal.id_jurnal)}</div>
                        <div class="text-xs text-stone-400 dark:text-stone-500">${escapeHtml(jurnal.tanggal)}</div>
                    </div>
                    ${badgeStatus}
                </div>
                <div class="text-xs text-stone-400 dark:text-stone-500 font-mono mb-1">${escapeHtml(jurnal.unit_usaha) || '-'} &middot; ${escapeHtml(jurnal.no_bukti)}</div>
                <div class="text-sm font-medium text-stone-800 dark:text-stone-200">${escapeHtml(jurnal.lawan_transaksi) || '-'}</div>
                <div class="text-xs text-stone-400 dark:text-stone-500">${escapeHtml(jurnal.keterangan) || '-'}</div>
                <div class="flex justify-between items-end border-t border-stone-100 dark:border-stone-800 pt-2 mt-3">
                    <div>
                        <div class="font-bold text-stone-800 dark:text-stone-200 text-sm">Rp ${jurnal.total_debit.toLocaleString('id-ID')}</div>
                        ${balanceStatus}
                    </div>
                    ${tombolAksiHtml(jurnal.id_jurnal)}
                </div>
            </div>
        `);
    });

    tbody.innerHTML = barisTabel.join('');
    if (kartuContainer) kartuContainer.innerHTML = kartuMobile.join('');

    renderKontrolPagination(totalHalaman);
}

function renderKontrolPagination(totalHalaman) {
    let containerPagination = document.getElementById('pagination-container');
    if (!containerPagination) {
        containerPagination = document.createElement('div');
        containerPagination.id = 'pagination-container';
        containerPagination.className = 'flex justify-between items-center mt-4 px-2 py-3 border-t border-stone-100 dark:border-stone-800 text-xs text-stone-500 dark:text-stone-400';
        const cardTabel = document.getElementById('kartuTabelJurnal');
        if (cardTabel) cardTabel.appendChild(containerPagination);
    }

    if (totalHalaman <= 1) {
        containerPagination.innerHTML = `<span>Menampilkan seluruh data transaksi</span>`;
        return;
    }

    containerPagination.innerHTML = `
        <span>Halaman <b>${halamanAktif}</b> dari <b>${totalHalaman}</b></span>
        <div class="space-x-1">
            <button onclick="window.ubahHalaman(${halamanAktif - 1})" ${halamanAktif === 1 ? 'disabled class="px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-600 rounded cursor-not-allowed"' : 'class="px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 font-semibold rounded hover:bg-stone-200 dark:hover:bg-stone-700 transition"'}>Sebelumnya</button>
            <button onclick="window.ubahHalaman(${halamanAktif + 1})" ${halamanAktif === totalHalaman ? 'disabled class="px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-600 rounded cursor-not-allowed"' : 'class="px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 font-semibold rounded hover:bg-stone-200 dark:hover:bg-stone-700 transition"'}>Berikutnya</button>
        </div>
    `;
}

function hapusKontrolPagination() {
    const containerPagination = document.getElementById('pagination-container');
    if (containerPagination) containerPagination.remove();
}

// Menyatukan logika filter pencarian teks + unit usaha + rentang tanggal,
// dipakai bersama oleh ubahHalaman() dan filterTabelJurnal() agar tidak ada
// dua salinan logika yang bisa saling berbeda.
function dapatkanDataTersaring() {
    const keyword = document.getElementById('inputPencarian').value.toLowerCase();
    const selectedUnit = document.getElementById('filterUnit').value;
    const dariTanggal = document.getElementById('filterTanggalDari')?.value || '';
    const sampaiTanggal = document.getElementById('filterTanggalSampai')?.value || '';

    return listJurnalCache.filter(j => {
        const matchUnit = (selectedUnit === 'ALL' || j.unit_usaha === selectedUnit);
        const matchKeyword = (
            j.id_jurnal.toLowerCase().includes(keyword) ||
            j.no_bukti.toLowerCase().includes(keyword) ||
            j.lawan_transaksi.toLowerCase().includes(keyword) ||
            (j.keterangan && j.keterangan.toLowerCase().includes(keyword))
        );
        const matchDari = !dariTanggal || (j.tanggal && j.tanggal >= dariTanggal);
        const matchSampai = !sampaiTanggal || (j.tanggal && j.tanggal <= sampaiTanggal);
        return matchUnit && matchKeyword && matchDari && matchSampai;
    });
}

window.ubahHalaman = function(targetHalaman) {
    halamanAktif = targetHalaman;
    renderTabelDenganPagination(dapatkanDataTersaring());
};

window.filterTabelJurnal = function() {
    halamanAktif = 1; // Reset ke halaman pertama saat memfilter
    renderTabelDenganPagination(dapatkanDataTersaring());
};

window.editJurnal = function(id_jurnal) {
    window.location.href = `/input-jurnal?edit=${id_jurnal}`;
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

    const rows = listJurnal.map(j => [
        `"${amankanSelCsv(j.id_jurnal)}"`, `"${amankanSelCsv(j.tanggal)}"`, `"${amankanSelCsv(j.no_bukti)}"`,
        `"${amankanSelCsv(j.unit_usaha || '')}"`, `"${amankanSelCsv(j.lawan_transaksi || '')}"`,
        `"${amankanSelCsv((j.keterangan || '').replace(/"/g, '""'))}"`, `"${amankanSelCsv(j.status)}"`,
        j.total_debit, j.total_kredit
    ]);

    unduhCsv(
        `Laporan_Jurnal_${new Date().toISOString().slice(0,10)}.csv`,
        ["ID Jurnal", "Tanggal", "No Bukti", "Unit Usaha", "Lawan Transaksi", "Keterangan", "Status", "Total Debit", "Total Kredit"],
        rows
    );
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
