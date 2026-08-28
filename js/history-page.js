// js/history-page.js - Controller untuk histori.html
import { db } from "./config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { escapeHtml } from "./utils.js";

let SEMUA_LOG = [];
let halamanAktif = 1;
const dataPerHalaman = 15;

function dapatkanLogTersaring() {
    const keyword = (document.getElementById('inputPencarianHistori')?.value || '').toLowerCase();
    const aksiTerpilih = document.getElementById('filterAksiHistori')?.value || 'SEMUA';
    const dariTanggal = document.getElementById('filterTanggalDariHistori')?.value || '';
    const sampaiTanggal = document.getElementById('filterTanggalSampaiHistori')?.value || '';

    return SEMUA_LOG.filter(log => {
        const matchAksi = aksiTerpilih === 'SEMUA' || (log.aksi || '').includes(aksiTerpilih);
        const matchKeyword = !keyword ||
            (log.id_jurnal || '').toLowerCase().includes(keyword) ||
            (log.keterangan || '').toLowerCase().includes(keyword) ||
            (log.user || '').toLowerCase().includes(keyword);
        const tanggalLog = (log.timestamp || '').slice(0, 10);
        const matchDari = !dariTanggal || (tanggalLog && tanggalLog >= dariTanggal);
        const matchSampai = !sampaiTanggal || (tanggalLog && tanggalLog <= sampaiTanggal);
        return matchAksi && matchKeyword && matchDari && matchSampai;
    });
}

function renderTabelHistori(daftarLog) {
    const tbody = document.getElementById('tabelHistori');
    if (!tbody) return;

    if (daftarLog.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-stone-400 dark:text-stone-500">Tidak ada aktivitas yang cocok.</td></tr>`;
        hapusKontrolPagination();
        return;
    }

    const totalHalaman = Math.ceil(daftarLog.length / dataPerHalaman);
    if (halamanAktif > totalHalaman) halamanAktif = totalHalaman;
    if (halamanAktif < 1) halamanAktif = 1;

    const indeksAwal = (halamanAktif - 1) * dataPerHalaman;
    const dataHalamanIni = daftarLog.slice(indeksAwal, indeksAwal + dataPerHalaman);

    tbody.innerHTML = dataHalamanIni.map(log => {
        let warnaBadge = "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300";
        if (log.aksi && log.aksi.includes("DELETE")) warnaBadge = "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400";
        if (log.aksi && log.aksi.includes("UPDATE")) warnaBadge = "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400";
        if (log.aksi && log.aksi.includes("CREATE")) warnaBadge = "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400";

        const formatWaktu = log.timestamp ? new Date(log.timestamp).toLocaleString('id-ID') : '-';

        return `
            <tr>
                <td class="p-3 font-mono text-xs text-stone-500 dark:text-stone-400">${formatWaktu}</td>
                <td class="p-3"><span class="px-2 py-0.5 rounded font-bold text-[11px] ${warnaBadge}">${escapeHtml(log.aksi) || 'AKTIVITAS'}</span></td>
                <td class="p-3 font-semibold text-stone-900 dark:text-stone-100">${escapeHtml(log.id_jurnal) || '-'}</td>
                <td class="p-3 text-stone-700 dark:text-stone-300">
                    <div>${escapeHtml(log.keterangan) || '-'}</div>
                    <div class="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">Oleh: ${escapeHtml(log.user) || 'System'}</div>
                </td>
            </tr>
        `;
    }).join('');

    renderKontrolPagination(totalHalaman);
}

function renderKontrolPagination(totalHalaman) {
    let containerPagination = document.getElementById('pagination-container-histori');
    if (!containerPagination) {
        containerPagination = document.createElement('div');
        containerPagination.id = 'pagination-container-histori';
        containerPagination.className = 'flex justify-between items-center mt-4 px-2 py-3 border-t border-stone-100 dark:border-stone-800 text-xs text-stone-500 dark:text-stone-400';
        // Dulu pakai .closest('.dashboard-card'), tapi kelas itu sudah tidak
        // dipakai di desain elegant sehingga akan diam-diam gagal (null) dan
        // kontrol paginasi hilang - sekarang diarahkan lewat id eksplisit.
        const cardTabel = document.getElementById('kartuTabelHistori');
        if (cardTabel) cardTabel.appendChild(containerPagination);
    }

    if (totalHalaman <= 1) {
        containerPagination.innerHTML = `<span>Menampilkan seluruh aktivitas</span>`;
        return;
    }

    containerPagination.innerHTML = `
        <span>Halaman <b>${halamanAktif}</b> dari <b>${totalHalaman}</b></span>
        <div class="space-x-1">
            <button onclick="window.ubahHalamanHistori(${halamanAktif - 1})" ${halamanAktif === 1 ? 'disabled class="px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-600 rounded cursor-not-allowed"' : 'class="px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 font-semibold rounded hover:bg-stone-200 dark:hover:bg-stone-700 transition"'}>Sebelumnya</button>
            <button onclick="window.ubahHalamanHistori(${halamanAktif + 1})" ${halamanAktif === totalHalaman ? 'disabled class="px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-600 rounded cursor-not-allowed"' : 'class="px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 font-semibold rounded hover:bg-stone-200 dark:hover:bg-stone-700 transition"'}>Berikutnya</button>
        </div>
    `;
}

function hapusKontrolPagination() {
    const containerPagination = document.getElementById('pagination-container-histori');
    if (containerPagination) containerPagination.remove();
}

window.ubahHalamanHistori = function(targetHalaman) {
    halamanAktif = targetHalaman;
    renderTabelHistori(dapatkanLogTersaring());
};

window.filterHistori = function() {
    halamanAktif = 1;
    renderTabelHistori(dapatkanLogTersaring());
};

async function muatHistoriAktivitas() {
    const tbody = document.getElementById('tabelHistori');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-stone-400 dark:text-stone-500">Memuat jejak audit aktivitas...</td></tr>`;

    try {
        const querySnapshot = await getDocs(collection(db, "activity_logs"));
        SEMUA_LOG = [];
        querySnapshot.forEach(docSnap => SEMUA_LOG.push(docSnap.data()));

        // Urutkan dari yang terbaru berdasarkan properti timestamp
        SEMUA_LOG.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (SEMUA_LOG.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-stone-400 dark:text-stone-500">Belum ada riwayat aktivitas tercatat.</td></tr>`;
            return;
        }

        renderTabelHistori(SEMUA_LOG);
    } catch (err) {
        console.error("Gagal memuat histori:", err);
        tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-red-500 dark:text-red-400">Gagal memuat data histori audit dari database.</td></tr>`;
    }
}

muatHistoriAktivitas();
