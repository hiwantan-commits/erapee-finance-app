// js/history-page.js - Controller untuk histori.html
import { db } from "./config.js";
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { escapeHtml } from "./utils.js";

async function muatHistoriAktivitas() {
    const tbody = document.getElementById('tabelHistori');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-gray-400">Memuat jejak audit aktivitas...</td></tr>`;

    try {
        // Ambil data log aktivitas dari koleksi activity_logs
        const q = query(collection(db, "activity_logs"), limit(100));
        const querySnapshot = await getDocs(q);
        
        let logsList = [];
        querySnapshot.forEach(docSnap => {
            logsList.push(docSnap.data());
        });

        // Urutkan dari yang terbaru berdasarkan properti timestamp
        logsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        tbody.innerHTML = '';
        if (logsList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-gray-400">Belum ada riwayat aktivitas tercatat.</td></tr>`;
            return;
        }

        logsList.forEach(log => {
            let warnaBadge = "bg-blue-100 text-blue-700";
            if (log.aksi && log.aksi.includes("DELETE")) warnaBadge = "bg-red-100 text-red-700";
            if (log.aksi && log.aksi.includes("UPDATE")) warnaBadge = "bg-amber-100 text-amber-800";
            if (log.aksi && log.aksi.includes("CREATE")) warnaBadge = "bg-green-100 text-green-700";

            let formatWaktu = log.timestamp ? new Date(log.timestamp).toLocaleString('id-ID') : '-';

            let tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-3 font-mono text-xs text-gray-500">${formatWaktu}</td>
                <td class="p-3"><span class="px-2 py-0.5 rounded font-bold text-[11px] ${warnaBadge}">${escapeHtml(log.aksi) || 'AKTIVITAS'}</span></td>
                <td class="p-3 font-semibold text-indigo-700">${escapeHtml(log.id_jurnal) || '-'}</td>
                <td class="p-3 text-gray-700">
                    <div>${escapeHtml(log.keterangan) || '-'}</div>
                    <div class="text-[11px] text-gray-400 mt-0.5">Oleh: ${escapeHtml(log.user) || 'System'}</div>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Gagal memuat histori:", err);
        tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-red-500">Gagal memuat histori audit dari database.</td></tr>`;
    }
}

muatHistoriAktivitas();
