// js/business-analytics-page.js - Controller untuk analisa-bisnis.html
// Analisis profitabilitas & margin laba antar unit usaha (Tahap 1 Business Intelligence)
import { db } from "./config.js";
import { ambilSemuaJurnalPusat } from "./db.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { escapeHtml } from "./utils.js";

let semuaJurnalCache = [];
let unitUsahaMasterCache = [];
let chartMarginInstance = null;

function formatRupiah(angka) {
    return "Rp " + Math.round(angka).toLocaleString('id-ID');
}

// Ambang margin bersifat indikatif umum, bukan standar baku industri tertentu -
// pengguna disarankan menyesuaikan sendiri sesuai karakteristik bisnisnya.
function hitungStatusMargin(margin, laba) {
    if (margin === null) {
        if (laba < 0) return { label: "RUGI", kelas: "bg-red-100 text-red-700" };
        return { label: "TIDAK ADA AKTIVITAS", kelas: "bg-gray-100 text-gray-500" };
    }
    if (margin >= 15) return { label: "SEHAT", kelas: "bg-green-100 text-green-700" };
    if (margin >= 5) return { label: "WASPADA", kelas: "bg-amber-100 text-amber-800" };
    return { label: "PERLU PERHATIAN", kelas: "bg-red-100 text-red-700" };
}

function hitungDataPerUnit(tahunFilter) {
    const dataPerUnit = {};
    unitUsahaMasterCache.forEach(u => {
        dataPerUnit[u.kode] = { nama: u.nama, pendapatan: 0, beban: 0 };
    });

    semuaJurnalCache.forEach(jurnal => {
        const tahunJurnal = jurnal.tanggal ? jurnal.tanggal.split("-")[0] : null;
        if (tahunFilter !== "SEMUA" && tahunJurnal !== tahunFilter) return;

        let kodeUnit = "SHARED";
        if (jurnal.unit_usaha) {
            kodeUnit = jurnal.unit_usaha.split(" - ")[0].trim();
        }
        if (!dataPerUnit[kodeUnit]) {
            dataPerUnit[kodeUnit] = { nama: kodeUnit, pendapatan: 0, beban: 0 };
        }

        (jurnal.rows || []).forEach(baris => {
            const kodeAkun = baris.kode_akun || "";
            const debit = parseFloat(baris.debit) || 0;
            const kredit = parseFloat(baris.kredit) || 0;

            if (kodeAkun.startsWith("4")) {
                dataPerUnit[kodeUnit].pendapatan += (kredit - debit);
            } else if (kodeAkun.startsWith("5") || kodeAkun.startsWith("6")) {
                dataPerUnit[kodeUnit].beban += (debit - kredit);
            }
        });
    });

    return Object.keys(dataPerUnit)
        .map(kode => {
            const d = dataPerUnit[kode];
            const laba = d.pendapatan - d.beban;
            const margin = d.pendapatan > 0 ? (laba / d.pendapatan) * 100 : null;
            return { kode, nama: d.nama, pendapatan: d.pendapatan, beban: d.beban, laba, margin };
        })
        // Sembunyikan unit usaha yang sama sekali tidak ada transaksi di periode ini
        .filter(u => u.pendapatan !== 0 || u.beban !== 0);
}

function renderKpi(daftarUnit) {
    const totalPendapatan = daftarUnit.reduce((s, u) => s + u.pendapatan, 0);
    const totalLaba = daftarUnit.reduce((s, u) => s + u.laba, 0);
    const marginKonsolidasi = totalPendapatan > 0 ? (totalLaba / totalPendapatan) * 100 : 0;

    const elMarginKonsolidasi = document.getElementById('kpiMarginKonsolidasi');
    if (elMarginKonsolidasi) elMarginKonsolidasi.innerText = marginKonsolidasi.toFixed(1) + "%";

    const unitDenganPendapatan = daftarUnit.filter(u => u.pendapatan > 0);
    const unitTerbaik = unitDenganPendapatan.length > 0
        ? unitDenganPendapatan.reduce((a, b) => (a.margin > b.margin ? a : b))
        : null;
    const unitPerhatian = daftarUnit.length > 0
        ? daftarUnit.reduce((a, b) => ((a.margin ?? -Infinity) < (b.margin ?? -Infinity) ? a : b))
        : null;

    const elUnitTerbaik = document.getElementById('kpiUnitTerbaik');
    const elUnitTerbaikMargin = document.getElementById('kpiUnitTerbaikMargin');
    if (elUnitTerbaik) elUnitTerbaik.innerText = unitTerbaik ? unitTerbaik.nama : "Belum ada data";
    if (elUnitTerbaikMargin) elUnitTerbaikMargin.innerText = unitTerbaik ? `Margin ${unitTerbaik.margin.toFixed(1)}%` : "-";

    const elUnitPerhatian = document.getElementById('kpiUnitPerhatian');
    const elUnitPerhatianMargin = document.getElementById('kpiUnitPerhatianMargin');
    if (elUnitPerhatian) elUnitPerhatian.innerText = unitPerhatian ? unitPerhatian.nama : "Belum ada data";
    if (elUnitPerhatianMargin) {
        elUnitPerhatianMargin.innerText = unitPerhatian
            ? (unitPerhatian.margin !== null ? `Margin ${unitPerhatian.margin.toFixed(1)}%` : "Rugi / tidak ada pendapatan")
            : "-";
    }
}

function renderTabelDanKartu(daftarUnit) {
    const tbody = document.getElementById('tabelRankingUnit');
    const kartuContainer = document.getElementById('kartuRankingUnit');

    if (daftarUnit.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-400">Belum ada transaksi pada periode ini.</td></tr>`;
        if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-gray-400 text-sm">Belum ada transaksi pada periode ini.</p>`;
        return;
    }

    if (tbody) {
        tbody.innerHTML = daftarUnit.map(u => {
            const status = hitungStatusMargin(u.margin, u.laba);
            return `
                <tr class="hover:bg-gray-50">
                    <td class="p-3 font-semibold text-gray-800">${escapeHtml(u.nama)}</td>
                    <td class="p-3 text-right">${formatRupiah(u.pendapatan)}</td>
                    <td class="p-3 text-right">${formatRupiah(u.beban)}</td>
                    <td class="p-3 text-right font-bold ${u.laba >= 0 ? 'text-green-700' : 'text-red-700'}">${formatRupiah(u.laba)}</td>
                    <td class="p-3 text-right">${u.margin !== null ? u.margin.toFixed(1) + '%' : '-'}</td>
                    <td class="p-3 text-center"><span class="px-2 py-0.5 rounded font-semibold ${status.kelas}">${status.label}</span></td>
                </tr>
            `;
        }).join('');
    }

    if (kartuContainer) {
        kartuContainer.innerHTML = daftarUnit.map(u => {
            const status = hitungStatusMargin(u.margin, u.laba);
            return `
                <div class="border border-gray-100 rounded-xl p-4">
                    <div class="flex justify-between items-start gap-2 mb-2">
                        <div class="font-bold text-gray-800 text-sm">${escapeHtml(u.nama)}</div>
                        <span class="px-2 py-0.5 rounded font-semibold text-[11px] ${status.kelas} shrink-0">${status.label}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-xs border-t border-gray-100 pt-2">
                        <div><p class="text-gray-400">Pendapatan</p><p class="font-semibold">${formatRupiah(u.pendapatan)}</p></div>
                        <div><p class="text-gray-400">Beban</p><p class="font-semibold">${formatRupiah(u.beban)}</p></div>
                        <div><p class="text-gray-400">Laba</p><p class="font-bold ${u.laba >= 0 ? 'text-green-700' : 'text-red-700'}">${formatRupiah(u.laba)}</p></div>
                        <div><p class="text-gray-400">Margin</p><p class="font-bold">${u.margin !== null ? u.margin.toFixed(1) + '%' : '-'}</p></div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function renderGrafik(daftarUnit) {
    const canvasEl = document.getElementById('grafikMarginUnit');
    if (!canvasEl || !window.Chart) return;

    const unitUntukGrafik = daftarUnit.filter(u => u.margin !== null);

    if (chartMarginInstance) {
        chartMarginInstance.destroy();
        chartMarginInstance = null;
    }

    if (unitUntukGrafik.length === 0) return;

    chartMarginInstance = new Chart(canvasEl.getContext('2d'), {
        type: 'bar',
        data: {
            labels: unitUntukGrafik.map(u => u.nama),
            datasets: [{
                label: 'Margin Laba (%)',
                data: unitUntukGrafik.map(u => Number(u.margin.toFixed(1))),
                backgroundColor: unitUntukGrafik.map(u => {
                    if (u.margin >= 15) return 'rgba(34, 197, 94, 0.8)';
                    if (u.margin >= 5) return 'rgba(245, 158, 11, 0.8)';
                    return 'rgba(239, 68, 68, 0.8)';
                }),
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: '#f3f4f6' } },
                y: { grid: { display: false } }
            }
        }
    });
}

function renderSemuaTampilan(tahunFilter) {
    const daftarUnit = hitungDataPerUnit(tahunFilter).sort((a, b) => b.laba - a.laba);
    renderKpi(daftarUnit);
    renderTabelDanKartu(daftarUnit);
    renderGrafik(daftarUnit);
}

async function muatAnalisisBisnis() {
    try {
        const snapUnit = await getDocs(collection(db, "master_unit_usaha"));
        unitUsahaMasterCache = [];
        snapUnit.forEach(docSnap => {
            const u = docSnap.data();
            unitUsahaMasterCache.push({ kode: u.kode, nama: u.nama });
        });
        if (!unitUsahaMasterCache.find(u => u.kode === "SHARED")) {
            unitUsahaMasterCache.push({ kode: "SHARED", nama: "Biaya Bersama / Lainnya" });
        }

        semuaJurnalCache = await ambilSemuaJurnalPusat();

        // Bangun daftar tahun yang tersedia dari data transaksi (dasar untuk fitur
        // perbandingan tahun-ke-tahun di tahap berikutnya)
        const tahunSet = new Set();
        semuaJurnalCache.forEach(j => {
            if (j.tanggal) tahunSet.add(j.tanggal.split("-")[0]);
        });
        const daftarTahun = Array.from(tahunSet).sort((a, b) => b.localeCompare(a));

        const selectTahun = document.getElementById('filterTahunBisnis');
        let tahunTerpilih = "SEMUA";
        if (selectTahun) {
            let optionsHtml = '<option value="SEMUA">Semua Tahun</option>';
            daftarTahun.forEach(t => {
                optionsHtml += `<option value="${t}">Tahun ${t}</option>`;
            });
            selectTahun.innerHTML = optionsHtml;
            if (daftarTahun.length > 0) {
                tahunTerpilih = daftarTahun[0];
                selectTahun.value = tahunTerpilih;
            }
            selectTahun.addEventListener('change', () => renderSemuaTampilan(selectTahun.value));
        }

        renderSemuaTampilan(tahunTerpilih);
    } catch (error) {
        console.error("Gagal memuat analisis bisnis:", error);
        const tbody = document.getElementById('tabelRankingUnit');
        const kartuContainer = document.getElementById('kartuRankingUnit');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-500">Gagal memuat data dari pusat database.</td></tr>`;
        if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-red-500 text-sm">Gagal memuat data dari pusat database.</p>`;
    }
}

document.addEventListener("DOMContentLoaded", muatAnalisisBisnis);
