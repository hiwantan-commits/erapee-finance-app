// js/business-analytics-page.js - Controller untuk analisa-bisnis.html
// Analisis profitabilitas & margin laba antar unit usaha + perbandingan
// tahun-ke-tahun (Tahap 1 & 2 Business Intelligence)
import { db } from "./config.js";
import { ambilSemuaJurnalPusat } from "./db.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { escapeHtml } from "./utils.js";
import { kalkulasiNeraca } from "./accounting.js";

let semuaJurnalCache = [];
let unitUsahaMasterCache = [];
let chartMarginInstance = null;
let chartYoYInstance = null;

function formatRupiah(angka) {
    return "Rp " + Math.round(angka).toLocaleString('id-ID');
}

function setTeksAman(id, teks) {
    const el = document.getElementById(id);
    if (el) el.innerText = teks;
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
    renderStrukturBeban(tahunFilter);
}

// ==================== Analisis Struktur Beban ====================

let chartBebanInstance = null;

function hitungStrukturBeban(tahunFilter) {
    const dataPerAkun = {};

    semuaJurnalCache.forEach(jurnal => {
        const tahunJurnal = jurnal.tanggal ? jurnal.tanggal.split("-")[0] : null;
        if (tahunFilter !== "SEMUA" && tahunJurnal !== tahunFilter) return;

        (jurnal.rows || []).forEach(baris => {
            const kodeAkun = baris.kode_akun || "";
            if (!(kodeAkun.startsWith("5") || kodeAkun.startsWith("6"))) return;

            const debit = parseFloat(baris.debit) || 0;
            const kredit = parseFloat(baris.kredit) || 0;
            const nilai = debit - kredit;

            if (!dataPerAkun[kodeAkun]) {
                dataPerAkun[kodeAkun] = { nama: baris.nama_akun || kodeAkun, total: 0 };
            }
            dataPerAkun[kodeAkun].total += nilai;
        });
    });

    return Object.keys(dataPerAkun)
        .map(kode => ({ kode, nama: dataPerAkun[kode].nama, total: dataPerAkun[kode].total }))
        .filter(a => a.total !== 0)
        .sort((a, b) => b.total - a.total);
}

function renderStrukturBeban(tahunFilter) {
    const daftarAkun = hitungStrukturBeban(tahunFilter);
    const totalBeban = daftarAkun.reduce((s, a) => s + a.total, 0);

    setTeksAman('bebanTotalKeseluruhan', formatRupiah(totalBeban));

    const elNama = document.getElementById('bebanTerbesarNama');
    const elPersen = document.getElementById('bebanTerbesarPersen');
    if (daftarAkun.length > 0 && totalBeban > 0) {
        const terbesar = daftarAkun[0];
        const persen = (terbesar.total / totalBeban) * 100;
        if (elNama) elNama.innerText = terbesar.nama;
        if (elPersen) elPersen.innerText = `${persen.toFixed(1)}% dari total beban`;
    } else {
        if (elNama) elNama.innerText = "Belum ada data";
        if (elPersen) elPersen.innerText = "-";
    }

    // Tampilkan Top 10 akun, sisanya digabung jadi baris "Lainnya"
    const BATAS_TAMPIL = 10;
    const tampil = daftarAkun.slice(0, BATAS_TAMPIL);
    const sisa = daftarAkun.slice(BATAS_TAMPIL);
    const totalSisa = sisa.reduce((s, a) => s + a.total, 0);

    const baris = tampil.map(a => ({ nama: `${a.kode} - ${a.nama}`, total: a.total }));
    if (sisa.length > 0) {
        baris.push({ nama: `Lainnya (${sisa.length} akun)`, total: totalSisa });
    }

    const tbody = document.getElementById('tabelStrukturBeban');
    const kartuContainer = document.getElementById('kartuStrukturBeban');

    if (baris.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-gray-400">Belum ada data beban pada periode ini.</td></tr>`;
        if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-gray-400 text-sm">Belum ada data beban pada periode ini.</p>`;
    } else {
        if (tbody) {
            tbody.innerHTML = baris.map(a => {
                const persen = totalBeban > 0 ? (a.total / totalBeban) * 100 : 0;
                return `
                    <tr class="hover:bg-gray-50">
                        <td class="p-3 font-semibold text-gray-800">${escapeHtml(a.nama)}</td>
                        <td class="p-3 text-right">${formatRupiah(a.total)}</td>
                        <td class="p-3 text-right">${persen.toFixed(1)}%</td>
                    </tr>
                `;
            }).join('');
        }
        if (kartuContainer) {
            kartuContainer.innerHTML = baris.map(a => {
                const persen = totalBeban > 0 ? (a.total / totalBeban) * 100 : 0;
                return `
                    <div class="border border-gray-100 rounded-xl p-4 flex justify-between items-center gap-2">
                        <div class="overflow-hidden">
                            <div class="font-semibold text-gray-800 text-sm truncate">${escapeHtml(a.nama)}</div>
                            <div class="text-xs text-gray-400 mt-0.5">${persen.toFixed(1)}% dari total beban</div>
                        </div>
                        <div class="font-bold text-red-700 text-sm shrink-0">${formatRupiah(a.total)}</div>
                    </div>
                `;
            }).join('');
        }
    }

    const canvasEl = document.getElementById('grafikStrukturBeban');
    if (canvasEl && window.Chart) {
        if (chartBebanInstance) {
            chartBebanInstance.destroy();
            chartBebanInstance = null;
        }
        if (tampil.length > 0) {
            chartBebanInstance = new Chart(canvasEl.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: tampil.map(a => a.nama),
                    datasets: [{
                        label: 'Total Beban (Rp)',
                        data: tampil.map(a => Math.round(a.total)),
                        backgroundColor: 'rgba(239, 68, 68, 0.75)',
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
    }
}

// ==================== Perbandingan Tahun ke Tahun (YoY) ====================

function hitungDataBulananGlobal(tahun) {
    const dataBulanan = Array.from({ length: 12 }, () => ({ pendapatan: 0, beban: 0 }));

    semuaJurnalCache.forEach(jurnal => {
        if (!jurnal.tanggal) return;
        const [tahunJurnal, bulanStr] = jurnal.tanggal.split("-");
        if (tahunJurnal !== tahun) return;

        const bulanIndex = parseInt(bulanStr) - 1;
        if (bulanIndex < 0 || bulanIndex > 11) return;

        (jurnal.rows || []).forEach(baris => {
            const kodeAkun = baris.kode_akun || "";
            const debit = parseFloat(baris.debit) || 0;
            const kredit = parseFloat(baris.kredit) || 0;

            if (kodeAkun.startsWith("4")) {
                dataBulanan[bulanIndex].pendapatan += (kredit - debit);
            } else if (kodeAkun.startsWith("5") || kodeAkun.startsWith("6")) {
                dataBulanan[bulanIndex].beban += (debit - kredit);
            }
        });
    });

    return dataBulanan;
}

function hitungTotalTahun(tahun) {
    const bulanan = hitungDataBulananGlobal(tahun);
    const pendapatan = bulanan.reduce((s, b) => s + b.pendapatan, 0);
    const beban = bulanan.reduce((s, b) => s + b.beban, 0);
    return { pendapatan, beban, laba: pendapatan - beban, bulanan };
}

function hitungPertumbuhan(nilaiIni, nilaiLalu) {
    if (nilaiLalu === 0) return null;
    return ((nilaiIni - nilaiLalu) / Math.abs(nilaiLalu)) * 100;
}

// naikBaik: true jika kenaikan nilai adalah kabar baik (Pendapatan/Laba),
// false jika kenaikan adalah kabar buruk (Beban)
function renderIndikatorPertumbuhan(elId, nilaiIni, nilaiLalu, tahunLalu, naikBaik) {
    const el = document.getElementById(elId);
    if (!el) return;

    const pertumbuhan = hitungPertumbuhan(nilaiIni, nilaiLalu);
    if (pertumbuhan === null) {
        el.innerHTML = `<span class="text-gray-400">Tanpa data pembanding</span>`;
        return;
    }

    const naik = pertumbuhan >= 0;
    const kabarBaik = naik === naikBaik;
    const warna = kabarBaik ? 'text-green-600' : 'text-red-600';
    const panah = naik ? '▲' : '▼';
    el.innerHTML = `<span class="${warna} font-semibold">${panah} ${Math.abs(pertumbuhan).toFixed(1)}%</span> <span class="text-gray-400">vs ${escapeHtml(tahunLalu)}</span>`;
}

function renderYoY(tahunIni, tahunLalu) {
    const areaTanpaPembanding = document.getElementById('areaYoYTanpaPembanding');
    if (!tahunIni) {
        if (areaTanpaPembanding) areaTanpaPembanding.classList.add('hidden');
        return;
    }

    const dataIni = hitungTotalTahun(tahunIni);
    const dataLalu = tahunLalu ? hitungTotalTahun(tahunLalu) : null;

    if (areaTanpaPembanding) areaTanpaPembanding.classList.toggle('hidden', !!dataLalu);

    setTeksAman('yoyPendapatanIni', formatRupiah(dataIni.pendapatan));
    setTeksAman('yoyBebanIni', formatRupiah(dataIni.beban));
    setTeksAman('yoyLabaIni', formatRupiah(dataIni.laba));

    if (dataLalu) {
        renderIndikatorPertumbuhan('yoyPendapatanGrowth', dataIni.pendapatan, dataLalu.pendapatan, tahunLalu, true);
        renderIndikatorPertumbuhan('yoyBebanGrowth', dataIni.beban, dataLalu.beban, tahunLalu, false);
        renderIndikatorPertumbuhan('yoyLabaGrowth', dataIni.laba, dataLalu.laba, tahunLalu, true);
    } else {
        ['yoyPendapatanGrowth', 'yoyBebanGrowth', 'yoyLabaGrowth'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<span class="text-gray-400">Tanpa data pembanding</span>';
        });
    }

    const canvasEl = document.getElementById('grafikYoY');
    if (canvasEl && window.Chart) {
        if (chartYoYInstance) {
            chartYoYInstance.destroy();
            chartYoYInstance = null;
        }

        const namaBulanPendek = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const datasets = [{
            label: `Laba Bersih ${tahunIni}`,
            data: dataIni.bulanan.map(b => b.pendapatan - b.beban),
            borderColor: 'rgba(79, 70, 229, 1)',
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            tension: 0.3,
            fill: true
        }];

        if (dataLalu) {
            datasets.push({
                label: `Laba Bersih ${tahunLalu}`,
                data: dataLalu.bulanan.map(b => b.pendapatan - b.beban),
                borderColor: 'rgba(156, 163, 175, 1)',
                backgroundColor: 'rgba(156, 163, 175, 0.08)',
                tension: 0.3,
                fill: true,
                borderDash: [5, 4]
            });
        }

        chartYoYInstance = new Chart(canvasEl.getContext('2d'), {
            type: 'line',
            data: { labels: namaBulanPendek, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
                scales: { y: { grid: { color: '#f3f4f6' } }, x: { grid: { display: false } } }
            }
        });
    }
}

// ==================== Rasio Keuangan Kunci ====================
// Snapshot kumulatif sejak awal hingga transaksi terbaru (bukan per-tahun),
// konsisten dengan sifat Neraca sebagai laporan posisi keuangan point-in-time.

function formatRasioPercent(nilai) {
    return nilai !== null ? nilai.toFixed(1) + "%" : "N/A";
}

function formatRasioKali(nilai) {
    return nilai !== null ? nilai.toFixed(2) + "x" : "N/A";
}

function statusRasioNaikBaik(nilai, ambangSehat, ambangWaspada) {
    if (nilai === null) return { label: "N/A", kelas: "bg-gray-100 text-gray-500" };
    if (nilai >= ambangSehat) return { label: "SEHAT", kelas: "bg-green-100 text-green-700" };
    if (nilai >= ambangWaspada) return { label: "WASPADA", kelas: "bg-amber-100 text-amber-800" };
    return { label: "PERLU PERHATIAN", kelas: "bg-red-100 text-red-700" };
}

function statusRasioRendahBaik(nilai, ambangSehat, ambangWaspada) {
    if (nilai === null) return { label: "N/A", kelas: "bg-gray-100 text-gray-500" };
    if (nilai <= ambangSehat) return { label: "SEHAT", kelas: "bg-green-100 text-green-700" };
    if (nilai <= ambangWaspada) return { label: "WASPADA", kelas: "bg-amber-100 text-amber-800" };
    return { label: "PERLU PERHATIAN", kelas: "bg-red-100 text-red-700" };
}

function setStatusBadge(elId, status) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.className = "inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-semibold " + status.kelas;
    el.innerText = status.label;
}

function hitungLabaRugiSemua() {
    let pendapatan = 0, beban = 0;
    semuaJurnalCache.forEach(jurnal => {
        (jurnal.rows || []).forEach(baris => {
            const kodeAkun = baris.kode_akun || "";
            const debit = parseFloat(baris.debit) || 0;
            const kredit = parseFloat(baris.kredit) || 0;
            if (kodeAkun.startsWith("4")) pendapatan += (kredit - debit);
            else if (kodeAkun.startsWith("5") || kodeAkun.startsWith("6")) beban += (debit - kredit);
        });
    });
    return { pendapatan, beban, laba: pendapatan - beban };
}

function renderRasioKeuangan() {
    const neraca = kalkulasiNeraca(semuaJurnalCache);
    const labaRugi = hitungLabaRugiSemua();

    const marginLaba = labaRugi.pendapatan > 0 ? (labaRugi.laba / labaRugi.pendapatan) * 100 : null;
    const roa = neraca.totalAset > 0 ? (labaRugi.laba / neraca.totalAset) * 100 : null;
    const roe = neraca.totalEkuitas > 0 ? (labaRugi.laba / neraca.totalEkuitas) * 100 : null;
    const der = neraca.totalEkuitas > 0 ? (neraca.totalLiabilitas / neraca.totalEkuitas) : null;
    const dta = neraca.totalAset > 0 ? (neraca.totalLiabilitas / neraca.totalAset) * 100 : null;

    setTeksAman('rasioMarginLaba', formatRasioPercent(marginLaba));
    setStatusBadge('rasioMarginLabaStatus', statusRasioNaikBaik(marginLaba, 10, 0));

    setTeksAman('rasioRoa', formatRasioPercent(roa));
    setStatusBadge('rasioRoaStatus', statusRasioNaikBaik(roa, 5, 0));

    setTeksAman('rasioRoe', formatRasioPercent(roe));
    setStatusBadge('rasioRoeStatus', statusRasioNaikBaik(roe, 15, 0));

    setTeksAman('rasioDer', formatRasioKali(der));
    setStatusBadge('rasioDerStatus', statusRasioRendahBaik(der, 1.0, 2.0));

    setTeksAman('rasioDta', formatRasioPercent(dta));
    setStatusBadge('rasioDtaStatus', statusRasioRendahBaik(dta, 50, 70));
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

        renderRasioKeuangan();

        // Bangun daftar tahun yang tersedia dari data transaksi
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

        // Siapkan dropdown Perbandingan Tahun ke Tahun (YoY)
        const selectTahunIniYoY = document.getElementById('filterTahunIniYoY');
        const selectTahunLaluYoY = document.getElementById('filterTahunLaluYoY');
        if (selectTahunIniYoY && selectTahunLaluYoY) {
            if (daftarTahun.length === 0) {
                selectTahunIniYoY.innerHTML = '<option value="">Belum ada data</option>';
                selectTahunLaluYoY.innerHTML = '<option value="">Belum ada data</option>';
                selectTahunIniYoY.disabled = true;
                selectTahunLaluYoY.disabled = true;
                renderYoY(null, null);
            } else {
                selectTahunIniYoY.innerHTML = daftarTahun.map(t => `<option value="${t}">Tahun ${t}</option>`).join('');
                selectTahunLaluYoY.innerHTML = '<option value="">Tanpa pembanding</option>' +
                    daftarTahun.map(t => `<option value="${t}">Tahun ${t}</option>`).join('');

                const tahunIniYoY = daftarTahun[0];
                const tahunLaluYoY = daftarTahun.length > 1 ? daftarTahun[1] : "";

                selectTahunIniYoY.value = tahunIniYoY;
                selectTahunLaluYoY.value = tahunLaluYoY;

                const perbaruiYoY = () => renderYoY(selectTahunIniYoY.value, selectTahunLaluYoY.value || null);
                selectTahunIniYoY.addEventListener('change', perbaruiYoY);
                selectTahunLaluYoY.addEventListener('change', perbaruiYoY);

                renderYoY(tahunIniYoY, tahunLaluYoY || null);
            }
        }
    } catch (error) {
        console.error("Gagal memuat analisis bisnis:", error);
        const tbody = document.getElementById('tabelRankingUnit');
        const kartuContainer = document.getElementById('kartuRankingUnit');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-500">Gagal memuat data dari pusat database.</td></tr>`;
        if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-red-500 text-sm">Gagal memuat data dari pusat database.</p>`;
    }
}

document.addEventListener("DOMContentLoaded", muatAnalisisBisnis);
