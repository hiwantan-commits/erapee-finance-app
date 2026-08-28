// js/dashboard-page.js - Controller untuk index.html (Support HPP Akun 5 & Beban Akun 6)
import { db } from "./config.js";
import { ambilSemuaJurnalPusat } from "./db.js";
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { escapeHtml } from "./utils.js";

function setBadge(el, className, teks) {
    if (!el) return;
    el.className = "px-2 py-0.5 font-semibold rounded " + className;
    el.innerText = teks;
}

// Sebelumnya badge "Akta Pendirian", "NPWP Perseroan", dan "Status PKP" di
// dashboard selalu menampilkan WARNING secara statis (hardcode), tidak
// pernah benar-benar mengecek data asli - jadi tetap WARNING meski data
// sudah lengkap. Sekarang dicek langsung ke profil perusahaan tersimpan.
async function muatStatusLegal() {
    const elAkta = document.getElementById('statusAktaLegal');
    const elNpwp = document.getElementById('statusNpwpLegal');
    const elPkp = document.getElementById('statusPkpLegal');

    try {
        const snap = await getDoc(doc(db, "pengaturan", "profil_perusahaan"));
        const data = snap.exists() ? snap.data() : {};

        if (data.nomor_akta) {
            setBadge(elAkta, "bg-green-100 text-green-700", "LENGKAP");
        } else {
            setBadge(elAkta, "bg-amber-100 text-amber-800", "WARNING");
        }

        if (data.npwp_perseroan) {
            setBadge(elNpwp, "bg-green-100 text-green-700", "LENGKAP");
        } else {
            setBadge(elNpwp, "bg-amber-100 text-amber-800", "WARNING");
        }

        if (data.status_pkp === "PKP Terdaftar") {
            setBadge(elPkp, "bg-blue-100 text-blue-700", "PKP TERDAFTAR");
        } else if (data.status_pkp === "Belum PKP") {
            setBadge(elPkp, "bg-gray-200 text-gray-600", "BELUM PKP");
        } else {
            setBadge(elPkp, "bg-amber-100 text-amber-800", "WARNING");
        }
    } catch (error) {
        console.error("Gagal memuat status legal perusahaan:", error);
        setBadge(elAkta, "bg-gray-200 text-gray-500", "TIDAK DIKETAHUI");
        setBadge(elNpwp, "bg-gray-200 text-gray-500", "TIDAK DIKETAHUI");
        setBadge(elPkp, "bg-gray-200 text-gray-500", "TIDAK DIKETAHUI");
    }
}

async function muatDashboard() {
    muatStatusLegal();
    try {
        // 1. AMBIL MASTER UNIT USAHA DARI DATABASE (DINAMIS)
        const snapUnit = await getDocs(collection(db, "master_unit_usaha"));
        const unitUsahaMaster = [];
        
        snapUnit.forEach(docSnap => {
            const u = docSnap.data();
            unitUsahaMaster.push({
                kode: u.kode,
                nama: u.nama,
                klasifikasi: u.klasifikasi || "Tidak ada klasifikasi",
                color: "indigo" // Warna default badge
            });
        });

        // Penampung cadangan untuk transaksi yang unitnya sudah dihapus / alokasi bersama
        if (!unitUsahaMaster.find(u => u.kode === "SHARED")) {
            unitUsahaMaster.push({ 
                kode: "SHARED", 
                nama: "Biaya Bersama / Lainnya", 
                klasifikasi: "Alokasi Bersama (Shared Cost)", 
                color: "gray" 
            });
        }

        // 2. AMBIL DATA JURNAL
        const semuaJurnal = await ambilSemuaJurnalPusat();

        let totalPendapatanGlobal = 0;
        let totalBebanGlobal = 0;
        let totalUtangGlobal = 0;
        let totalPajakGlobal = 0;
        let isSemuaBalance = true;

        const dataPerUnit = {};
        unitUsahaMaster.forEach(u => {
            dataPerUnit[u.kode] = { pendapatan: 0, beban: 0, utang: 0 };
        });

        const dataBulanan = Array.from({length: 12}, () => ({ pendapatan: 0, beban: 0 }));

        // Kalkulasi Data
        semuaJurnal.forEach(jurnal => {
            if (jurnal.total_debit !== jurnal.total_kredit) isSemuaBalance = false;

            const bulanIndex = jurnal.tanggal ? parseInt(jurnal.tanggal.split("-")[1]) - 1 : 0;
            
            // Ambil kode unit dari string "KODE - NAMA" atau string bersih
            let kodeUnit = "SHARED";
            if (jurnal.unit_usaha) {
                kodeUnit = jurnal.unit_usaha.split(" - ")[0].trim();
            }
            if (!dataPerUnit[kodeUnit]) {
                dataPerUnit[kodeUnit] = { pendapatan: 0, beban: 0, utang: 0 };
            }

            jurnal.rows.forEach(baris => {
                const kodeAkun = baris.kode_akun || "";
                const debit = parseFloat(baris.debit) || 0;
                const kredit = parseFloat(baris.kredit) || 0;

                if (kodeAkun.startsWith("4")) {
                    const nilai = kredit - debit;
                    totalPendapatanGlobal += nilai;
                    dataPerUnit[kodeUnit].pendapatan += nilai;
                    if (bulanIndex >= 0 && bulanIndex <= 11) dataBulanan[bulanIndex].pendapatan += nilai;
                } 
                // PERBAIKAN: Akun HPP (Awalan 5) dan Beban (Awalan 6) dihitung sebagai beban/HPP
                else if (kodeAkun.startsWith("5") || kodeAkun.startsWith("6")) {
                    const nilai = debit - kredit;
                    totalBebanGlobal += nilai;
                    dataPerUnit[kodeUnit].beban += nilai;
                    if (bulanIndex >= 0 && bulanIndex <= 11) dataBulanan[bulanIndex].beban += nilai;
                } 
                else if (kodeAkun.startsWith("2")) {
                    const nilai = kredit - debit;
                    totalUtangGlobal += nilai;
                    dataPerUnit[kodeUnit].utang += nilai;
                    if (kodeAkun === "2105" || kodeAkun === "2106" || (baris.nama_akun && baris.nama_akun.toLowerCase().includes("pajak"))) {
                        totalPajakGlobal += nilai;
                    }
                }
            });
        });

        const labaBersihGlobal = totalPendapatanGlobal - totalBebanGlobal;

        // 3. Render Angka Kartu Statistik (Atas)
        const elPendapatan = document.getElementById('valPendapatanTotal');
        const elLaba = document.getElementById('valLabaBersih');
        const elUtang = document.getElementById('valTotalUtang');
        const elPajak = document.getElementById('valAkumulasiPajak');

        if (elPendapatan) elPendapatan.innerText = "Rp " + totalPendapatanGlobal.toLocaleString('id-ID');
        if (elLaba) elLaba.innerText = "Rp " + labaBersihGlobal.toLocaleString('id-ID');
        if (elUtang) elUtang.innerText = "Rp " + totalUtangGlobal.toLocaleString('id-ID');
        if (elPajak) elPajak.innerText = "Rp " + totalPajakGlobal.toLocaleString('id-ID');

        // 4. Render Status Keseimbangan
        const elStatusBalance = document.getElementById('statusBalanceGlobal');
        if (elStatusBalance) {
            if (semuaJurnal.length > 0 && isSemuaBalance) {
                elStatusBalance.className = "px-2 py-0.5 bg-green-100 text-green-700 font-semibold rounded";
                elStatusBalance.innerText = "PASS";
            } else if (semuaJurnal.length === 0) {
                elStatusBalance.className = "px-2 py-0.5 bg-gray-200 text-gray-700 font-semibold rounded";
                elStatusBalance.innerText = "KOSONG";
            } else {
                elStatusBalance.className = "px-2 py-0.5 bg-red-100 text-red-700 font-semibold rounded";
                elStatusBalance.innerText = "ERROR (SELISIH)";
            }
        }

        // 5. Render Tabel Unit Usaha (Dinamis dari Firestore)
        const tbodyUnit = document.getElementById('tabelUnitUsaha');
        if (tbodyUnit) {
            tbodyUnit.innerHTML = ""; 
            
            if (unitUsahaMaster.length === 1 && unitUsahaMaster[0].kode === "SHARED") {
                 tbodyUnit.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">Belum ada master data unit usaha.</td></tr>`;
            } else {
                unitUsahaMaster.forEach(u => {
                    const dataU = dataPerUnit[u.kode] || { pendapatan: 0, beban: 0, utang: 0 };
                    const labaU = dataU.pendapatan - dataU.beban;
                    let tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="p-3 font-semibold text-gray-800"><span class="px-2 py-0.5 bg-${u.color}-100 text-${u.color}-700 rounded mr-1 font-mono">${escapeHtml(u.kode)}</span> ${escapeHtml(u.nama)}</td>
                        <td class="p-3 text-gray-500">${escapeHtml(u.klasifikasi)}</td>
                        <td class="p-3 text-right">${dataU.pendapatan === 0 ? '-' : dataU.pendapatan.toLocaleString('id-ID')}</td>
                        <td class="p-3 text-right">${dataU.beban === 0 ? '-' : dataU.beban.toLocaleString('id-ID')}</td>
                        <td class="p-3 text-right ${labaU > 0 ? 'text-green-600 font-semibold' : (labaU < 0 ? 'text-red-600 font-semibold' : '')}">${labaU === 0 ? '-' : labaU.toLocaleString('id-ID')}</td>
                        <td class="p-3 text-right ${dataU.utang > 0 ? 'text-red-600' : ''}">${dataU.utang === 0 ? '-' : dataU.utang.toLocaleString('id-ID')}</td>
                    `;
                    tbodyUnit.appendChild(tr);
                });
            }

            // Baris Total Bawah
            tbodyUnit.innerHTML += `
                <tr class="bg-indigo-50 font-bold text-indigo-900 border-t-2 border-indigo-200 text-sm">
                    <td colspan="2" class="p-3">TOTAL KESELURUHAN (KONSOLIDASI)</td>
                    <td class="p-3 text-right">Rp ${totalPendapatanGlobal.toLocaleString('id-ID')}</td>
                    <td class="p-3 text-right">Rp ${totalBebanGlobal.toLocaleString('id-ID')}</td>
                    <td class="p-3 text-right ${labaBersihGlobal >= 0 ? 'text-green-700' : 'text-red-700'}">Rp ${labaBersihGlobal.toLocaleString('id-ID')}</td>
                    <td class="p-3 text-right text-red-700">Rp ${totalUtangGlobal.toLocaleString('id-ID')}</td>
                </tr>
            `;
        }

        // 6. Render Tabel Tren Bulanan
        const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const tbodyTren = document.getElementById('tabelTrenBulanan');
        const arrayPendapatanChart = [];
        const arrayLabaChart = [];

        if (tbodyTren) {
            tbodyTren.innerHTML = "";
            dataBulanan.forEach((data, index) => {
                const labaBulan = data.pendapatan - data.beban;
                arrayPendapatanChart.push(data.pendapatan);
                arrayLabaChart.push(labaBulan);

                let tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="py-3 px-4 font-medium">${namaBulan[index]}</td>
                    <td class="py-3 px-4 text-right">${data.pendapatan === 0 ? '-' : data.pendapatan.toLocaleString('id-ID')}</td>
                    <td class="py-3 px-4 text-right ${labaBulan > 0 ? 'text-green-600 font-semibold' : (labaBulan < 0 ? 'text-red-600 font-semibold' : '')}">${labaBulan === 0 ? '-' : labaBulan.toLocaleString('id-ID')}</td>
                `;
                tbodyTren.appendChild(tr);
            });
        }

        // 7. Render Grafik Chart.js
        DATA_CHART_TERKINI = { arrayPendapatanChart, arrayLabaChart };
        renderGrafikKinerja();

    } catch (error) {
        console.error("Gagal memuat dashboard:", error);
    }
}

// Data grafik disimpan agar bisa di-render ulang dengan warna yang sesuai
// saat pengguna mengganti tema gelap/terang (lihat listener di bawah),
// tanpa perlu mengambil ulang data dari Firestore.
let CHART_KINERJA_INSTANCE = null;
let DATA_CHART_TERKINI = null;

function renderGrafikKinerja() {
    const canvasElement = document.getElementById('grafikKinerja');
    if (!canvasElement || !window.Chart || !DATA_CHART_TERKINI) return;

    const modeGelap = document.documentElement.classList.contains('dark');
    const warnaGrid = modeGelap ? 'rgba(255, 255, 255, 0.08)' : '#f3f4f6';
    const warnaLabel = modeGelap ? '#a1a1aa' : '#6b7280';

    if (CHART_KINERJA_INSTANCE) {
        CHART_KINERJA_INSTANCE.destroy();
        CHART_KINERJA_INSTANCE = null;
    }

    const ctx = canvasElement.getContext('2d');
    CHART_KINERJA_INSTANCE = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
            datasets: [
                { label: 'Pendapatan (Rp)', data: DATA_CHART_TERKINI.arrayPendapatanChart, backgroundColor: 'rgba(99, 102, 241, 0.8)', borderRadius: 6 },
                { label: 'Keuntungan / Laba (Rp)', data: DATA_CHART_TERKINI.arrayLabaChart, backgroundColor: 'rgba(34, 197, 94, 0.8)', borderRadius: 6 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, color: warnaLabel } } },
            scales: {
                y: { beginAtZero: true, grid: { color: warnaGrid }, ticks: { color: warnaLabel } },
                x: { grid: { display: false }, ticks: { color: warnaLabel } }
            }
        }
    });
}

// Render ulang grafik dengan warna yang sesuai saat tema gelap/terang diganti
// lewat tombol di header (lihat component.js -> window.toggleDarkMode).
window.addEventListener('erapee-tema-berubah', renderGrafikKinerja);

muatDashboard();
