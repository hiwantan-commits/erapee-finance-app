// js/dashboard-page.js - Controller untuk index.html
import { ambilSemuaJurnalPusat } from "./db.js";

const unitUsahaMaster = [
    { kode: "CORP", nama: "Corporate / Head Office", klasifikasi: "Kantor Pusat & Administrasi", color: "blue" },
    { kode: "MARC", nama: "Marcframe", klasifikasi: "Digital Services (KBLI 62199)", color: "indigo" },
    { kode: "SIP", nama: "SiPacul", klasifikasi: "Software Publishing (KBLI 58290)", color: "indigo" },
    { kode: "WT-NANAS", nama: "Wani Tani - Nanas", klasifikasi: "Pertanian (KBLI 01220)", color: "green" },
    { kode: "WT-TEBU", nama: "Wani Tani - Tebu", klasifikasi: "Pertanian (KBLI 01140)", color: "green" },
    { kode: "WT-CABAI", nama: "Wani Tani - Cabai", klasifikasi: "Pertanian (KBLI 01138)", color: "green" },
    { kode: "SHARED", nama: "Biaya Bersama", klasifikasi: "Alokasi Bersama (Shared Cost)", color: "gray" }
];

async function muاتDashboard() {
    try {
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

        semuaJurnal.forEach(jurnal => {
            if (jurnal.total_debit !== jurnal.total_kredit) isSemuaBalance = false;

            const bulanIndex = jurnal.tanggal ? parseInt(jurnal.tanggal.split("-")[1]) - 1 : 0;
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
                } else if (kodeAkun.startsWith("6")) {
                    const nilai = debit - kredit;
                    totalBebanGlobal += nilai;
                    dataPerUnit[kodeUnit].beban += nilai;
                    if (bulanIndex >= 0 && bulanIndex <= 11) dataBulanan[bulanIndex].beban += nilai;
                } else if (kodeAkun.startsWith("2")) {
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

        // Update Kartu Statistik Dashboard
        const elPendapatan = document.getElementById('valPendapatanTotal');
        const elLaba = document.getElementById('valLabaBersih');
        const elUtang = document.getElementById('valTotalUtang');
        const elPajak = document.getElementById('valAkumulasiPajak');

        if (elPendapatan) elPendapatan.innerText = "Rp " + totalPendapatanGlobal.toLocaleString('id-ID');
        if (elLaba) elLaba.innerText = "Rp " + labaBersihGlobal.toLocaleString('id-ID');
        if (elUtang) elUtang.innerText = "Rp " + totalUtangGlobal.toLocaleString('id-ID');
        if (elPajak) elPajak.innerText = "Rp " + totalPajakGlobal.toLocaleString('id-ID');

        // Status Keseimbangan
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

        // Render Tabel Unit Usaha
        const tbodyUnit = document.getElementById('tabelUnitUsaha');
        if (tbodyUnit) {
            tbodyUnit.innerHTML = "";
            unitUsahaMaster.forEach(u => {
                const dataU = dataPerUnit[u.kode] || { pendapatan: 0, beban: 0, utang: 0 };
                const labaU = dataU.pendapatan - dataU.beban;
                let tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="p-3 font-semibold text-gray-800"><span class="px-2 py-0.5 bg-${u.color}-100 text-${u.color}-700 rounded mr-1 font-mono">${u.kode}</span> ${u.nama}</td>
                    <td class="p-3 text-gray-500">${u.klasifikasi}</td>
                    <td class="p-3 text-right">${dataU.pendapatan === 0 ? '-' : dataU.pendapatan.toLocaleString('id-ID')}</td>
                    <td class="p-3 text-right">${dataU.beban === 0 ? '-' : dataU.beban.toLocaleString('id-ID')}</td>
                    <td class="p-3 text-right ${labaU > 0 ? 'text-green-600 font-semibold' : (labaU < 0 ? 'text-red-600 font-semibold' : '')}">${labaU === 0 ? '-' : labaU.toLocaleString('id-ID')}</td>
                    <td class="p-3 text-right ${dataU.utang > 0 ? 'text-red-600' : ''}">${dataU.utang === 0 ? '-' : dataU.utang.toLocaleString('id-ID')}</td>
                `;
                tbodyUnit.appendChild(tr);
            });
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

        // Render Tren Bulanan & Grafik
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

        const canvasElement = document.getElementById('grafikKinerja');
        if (canvasElement && window.Chart) {
            const ctx = canvasElement.getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
                    datasets: [
                        { label: 'Pendapatan (Rp)', data: arrayPendapatanChart, backgroundColor: 'rgba(99, 102, 241, 0.8)', borderRadius: 6 },
                        { label: 'Keuntungan / Laba (Rp)', data: arrayLabaChart, backgroundColor: 'rgba(34, 197, 94, 0.8)', borderRadius: 6 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
                    scales: { y: { beginAtZero: true, grid: { color: '#f3f4f6' } }, x: { grid: { display: false } } }
                }
            });
        }

    } catch (error) {
        console.error("Gagal memuat dashboard:", error);
    }
}

muatDashboard();
