// js/business-analytics-page.js - Controller untuk analisa-bisnis.html
// Analisis profitabilitas & margin laba antar unit usaha + perbandingan
// tahun-ke-tahun (Tahap 1 & 2 Business Intelligence)
import { db } from "./config.js";
import { ambilSemuaJurnalPusat } from "./db.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { escapeHtml } from "./utils.js";
import { kalkulasiNeraca, kalkulasiArusKas } from "./accounting.js";

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
        if (laba < 0) return { label: "RUGI", kelas: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400" };
        return { label: "TIDAK ADA AKTIVITAS", kelas: "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400" };
    }
    if (margin >= 15) return { label: "SEHAT", kelas: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400" };
    if (margin >= 5) return { label: "WASPADA", kelas: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400" };
    return { label: "PERLU PERHATIAN", kelas: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400" };
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
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-stone-400 dark:text-stone-500">Belum ada transaksi pada periode ini.</td></tr>`;
        if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-stone-400 dark:text-stone-500 text-sm">Belum ada transaksi pada periode ini.</p>`;
        return;
    }

    if (tbody) {
        tbody.innerHTML = daftarUnit.map(u => {
            const status = hitungStatusMargin(u.margin, u.laba);
            return `
                <tr class="hover:bg-stone-50 dark:hover:bg-stone-800/40">
                    <td class="p-3 font-semibold text-stone-800 dark:text-stone-200">${escapeHtml(u.nama)}</td>
                    <td class="p-3 text-right text-stone-700 dark:text-stone-300">${formatRupiah(u.pendapatan)}</td>
                    <td class="p-3 text-right text-stone-700 dark:text-stone-300">${formatRupiah(u.beban)}</td>
                    <td class="p-3 text-right font-bold ${u.laba >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}">${formatRupiah(u.laba)}</td>
                    <td class="p-3 text-right text-stone-700 dark:text-stone-300">${u.margin !== null ? u.margin.toFixed(1) + '%' : '-'}</td>
                    <td class="p-3 text-center"><span class="px-2 py-0.5 rounded font-semibold ${status.kelas}">${status.label}</span></td>
                </tr>
            `;
        }).join('');
    }

    if (kartuContainer) {
        kartuContainer.innerHTML = daftarUnit.map(u => {
            const status = hitungStatusMargin(u.margin, u.laba);
            return `
                <div class="border border-stone-100 dark:border-stone-800 rounded-xl p-4">
                    <div class="flex justify-between items-start gap-2 mb-2">
                        <div class="font-bold text-stone-900 dark:text-stone-100 text-sm">${escapeHtml(u.nama)}</div>
                        <span class="px-2 py-0.5 rounded font-semibold text-[11px] ${status.kelas} shrink-0">${status.label}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-xs border-t border-stone-100 dark:border-stone-800 pt-2">
                        <div><p class="text-stone-400 dark:text-stone-500">Pendapatan</p><p class="font-semibold text-stone-700 dark:text-stone-300">${formatRupiah(u.pendapatan)}</p></div>
                        <div><p class="text-stone-400 dark:text-stone-500">Beban</p><p class="font-semibold text-stone-700 dark:text-stone-300">${formatRupiah(u.beban)}</p></div>
                        <div><p class="text-stone-400 dark:text-stone-500">Laba</p><p class="font-bold ${u.laba >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}">${formatRupiah(u.laba)}</p></div>
                        <div><p class="text-stone-400 dark:text-stone-500">Margin</p><p class="font-bold text-stone-800 dark:text-stone-200">${u.margin !== null ? u.margin.toFixed(1) + '%' : '-'}</p></div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

let dataUnitTerkini = [];

function renderGrafik(daftarUnit) {
    dataUnitTerkini = daftarUnit;
    const canvasEl = document.getElementById('grafikMarginUnit');
    if (!canvasEl || !window.Chart) return;

    const unitUntukGrafik = daftarUnit.filter(u => u.margin !== null);

    if (chartMarginInstance) {
        chartMarginInstance.destroy();
        chartMarginInstance = null;
    }

    if (unitUntukGrafik.length === 0) return;

    const modeGelap = document.documentElement.classList.contains('dark');
    const warnaGrid = modeGelap ? 'rgba(255, 255, 255, 0.08)' : '#f3f4f6';
    const warnaLabel = modeGelap ? '#a1a1aa' : '#6b7280';

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
                x: { grid: { color: warnaGrid }, ticks: { color: warnaLabel } },
                y: { grid: { display: false }, ticks: { color: warnaLabel } }
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
    renderVendorPelanggan(tahunFilter);
}

// ==================== Vendor & Pelanggan Teratas ====================
// Ranking dibangun dari field "Lawan Transaksi" pada header jurnal. Setiap
// jurnal diklasifikasikan sebagai transaksi Pelanggan (jika ada baris yang
// mengkredit akun Pendapatan, kode awalan 4 - heuristik yang sama dengan
// tentukanArahPPN() di tax-page.js) atau transaksi Vendor (selain itu).

function hitungNilaiTransaksiPelanggan(jurnal) {
    let total = 0;
    (jurnal.rows || []).forEach(baris => {
        const kode = String(baris.kode_akun || "");
        if (!kode.startsWith("4")) return;
        total += parseFloat(baris.kredit) || 0;
    });
    return total;
}

function hitungNilaiTransaksiVendor(jurnal) {
    // Nilai barang/jasa yang diterima dari vendor = total debit pada baris
    // non-kas (beban, HPP, aset tetap, perlengkapan, dll) - bukan sisi kas
    // keluarnya sendiri, supaya nilainya mencerminkan objek pembelian.
    let total = 0;
    (jurnal.rows || []).forEach(baris => {
        const kode = String(baris.kode_akun || "");
        if (kode.startsWith("11")) return;
        total += parseFloat(baris.debit) || 0;
    });
    return total;
}

function hitungVendorPelanggan(tahunFilter) {
    const petaVendor = {};
    const petaPelanggan = {};

    semuaJurnalCache.forEach(jurnal => {
        const tahunJurnal = jurnal.tanggal ? jurnal.tanggal.split("-")[0] : null;
        if (tahunFilter !== "SEMUA" && tahunJurnal !== tahunFilter) return;

        const nama = (jurnal.lawan_transaksi || "").trim();
        if (!nama) return;

        const adaPendapatan = (jurnal.rows || []).some(baris =>
            String(baris.kode_akun || "").startsWith("4") && (parseFloat(baris.kredit) || 0) > 0
        );

        if (adaPendapatan) {
            const nilai = hitungNilaiTransaksiPelanggan(jurnal);
            if (!petaPelanggan[nama]) petaPelanggan[nama] = { nama, total: 0, jumlahTransaksi: 0 };
            petaPelanggan[nama].total += nilai;
            petaPelanggan[nama].jumlahTransaksi += 1;
        } else {
            const nilai = hitungNilaiTransaksiVendor(jurnal);
            if (!petaVendor[nama]) petaVendor[nama] = { nama, total: 0, jumlahTransaksi: 0 };
            petaVendor[nama].total += nilai;
            petaVendor[nama].jumlahTransaksi += 1;
        }
    });

    return {
        daftarVendor: Object.values(petaVendor).sort((a, b) => b.total - a.total),
        daftarPelanggan: Object.values(petaPelanggan).sort((a, b) => b.total - a.total)
    };
}

function persenKonsentrasiTopN(daftar, n) {
    const total = daftar.reduce((s, d) => s + d.total, 0);
    if (total <= 0) return null;
    const topN = daftar.slice(0, n).reduce((s, d) => s + d.total, 0);
    return (topN / total) * 100;
}

function renderDaftarPeringkat(containerId, daftar, warnaBar, warnaTeks) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (daftar.length === 0) {
        container.innerHTML = `<p class="p-6 text-center text-stone-400 dark:text-stone-500 text-sm">Belum ada data pada periode ini.</p>`;
        return;
    }

    const BATAS_TAMPIL = 10;
    const tampil = daftar.slice(0, BATAS_TAMPIL);
    const total = daftar.reduce((s, d) => s + d.total, 0);
    const nilaiMaks = tampil[0].total;

    container.innerHTML = tampil.map((d, idx) => {
        const persenDariTotal = total > 0 ? (d.total / total) * 100 : 0;
        const lebarBar = nilaiMaks > 0 ? Math.max((d.total / nilaiMaks) * 100, 3) : 0;
        return `
            <div class="p-3 rounded-xl border border-stone-100 dark:border-stone-800">
                <div class="flex justify-between items-center gap-2 mb-1.5">
                    <span class="font-semibold text-stone-800 dark:text-stone-200 text-sm truncate">${idx + 1}. ${escapeHtml(d.nama)}</span>
                    <span class="font-bold ${warnaTeks} text-sm shrink-0">${formatRupiah(d.total)}</span>
                </div>
                <div class="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-1.5 mb-1">
                    <div class="${warnaBar} h-1.5 rounded-full" style="width: ${lebarBar.toFixed(0)}%"></div>
                </div>
                <p class="text-[10px] text-stone-400 dark:text-stone-500">${d.jumlahTransaksi} transaksi &middot; ${persenDariTotal.toFixed(1)}% dari total</p>
            </div>
        `;
    }).join('');
}

function renderVendorPelanggan(tahunFilter) {
    const { daftarVendor, daftarPelanggan } = hitungVendorPelanggan(tahunFilter);

    renderDaftarPeringkat('daftarPelangganTeratas', daftarPelanggan, 'bg-emerald-500', 'text-emerald-600 dark:text-emerald-400');
    renderDaftarPeringkat('daftarVendorTeratas', daftarVendor, 'bg-red-500', 'text-red-600 dark:text-red-400');

    const elInsightPelanggan = document.getElementById('insightKonsentrasiPelanggan');
    if (elInsightPelanggan) {
        const persenTop5 = persenKonsentrasiTopN(daftarPelanggan, 5);
        elInsightPelanggan.innerText = persenTop5 !== null
            ? `5 pelanggan teratas menyumbang ${persenTop5.toFixed(1)}% dari total pendapatan bernama lawan transaksi.`
            : 'Belum ada transaksi pendapatan dengan nama lawan transaksi pada periode ini.';
    }

    const elInsightVendor = document.getElementById('insightKonsentrasiVendor');
    if (elInsightVendor) {
        const persenTop5 = persenKonsentrasiTopN(daftarVendor, 5);
        elInsightVendor.innerText = persenTop5 !== null
            ? `5 vendor teratas menyumbang ${persenTop5.toFixed(1)}% dari total pengeluaran bernama lawan transaksi.`
            : 'Belum ada transaksi pengeluaran dengan nama lawan transaksi pada periode ini.';
    }
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
        if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-stone-400 dark:text-stone-500">Belum ada data beban pada periode ini.</td></tr>`;
        if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-stone-400 dark:text-stone-500 text-sm">Belum ada data beban pada periode ini.</p>`;
    } else {
        if (tbody) {
            tbody.innerHTML = baris.map(a => {
                const persen = totalBeban > 0 ? (a.total / totalBeban) * 100 : 0;
                return `
                    <tr class="hover:bg-stone-50 dark:hover:bg-stone-800/40">
                        <td class="p-3 font-semibold text-stone-800 dark:text-stone-200">${escapeHtml(a.nama)}</td>
                        <td class="p-3 text-right text-stone-700 dark:text-stone-300">${formatRupiah(a.total)}</td>
                        <td class="p-3 text-right text-stone-700 dark:text-stone-300">${persen.toFixed(1)}%</td>
                    </tr>
                `;
            }).join('');
        }
        if (kartuContainer) {
            kartuContainer.innerHTML = baris.map(a => {
                const persen = totalBeban > 0 ? (a.total / totalBeban) * 100 : 0;
                return `
                    <div class="border border-stone-100 dark:border-stone-800 rounded-xl p-4 flex justify-between items-center gap-2">
                        <div class="overflow-hidden">
                            <div class="font-semibold text-stone-800 dark:text-stone-200 text-sm truncate">${escapeHtml(a.nama)}</div>
                            <div class="text-xs text-stone-400 dark:text-stone-500 mt-0.5">${persen.toFixed(1)}% dari total beban</div>
                        </div>
                        <div class="font-bold text-red-600 dark:text-red-400 text-sm shrink-0">${formatRupiah(a.total)}</div>
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
            const modeGelap = document.documentElement.classList.contains('dark');
            const warnaGrid = modeGelap ? 'rgba(255, 255, 255, 0.08)' : '#f3f4f6';
            const warnaLabel = modeGelap ? '#a1a1aa' : '#6b7280';

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
                        x: { grid: { color: warnaGrid }, ticks: { color: warnaLabel } },
                        y: { grid: { display: false }, ticks: { color: warnaLabel } }
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
        el.innerHTML = `<span class="text-stone-400 dark:text-stone-500">Tanpa data pembanding</span>`;
        return;
    }

    const naik = pertumbuhan >= 0;
    const kabarBaik = naik === naikBaik;
    const warna = kabarBaik ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
    const panah = naik ? '▲' : '▼';
    el.innerHTML = `<span class="${warna} font-semibold">${panah} ${Math.abs(pertumbuhan).toFixed(1)}%</span> <span class="text-stone-400 dark:text-stone-500">vs ${escapeHtml(tahunLalu)}</span>`;
}

let yoyTerkini = { tahunIni: null, tahunLalu: null };

function renderYoY(tahunIni, tahunLalu) {
    yoyTerkini = { tahunIni, tahunLalu };
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
            if (el) el.innerHTML = '<span class="text-stone-400 dark:text-stone-500">Tanpa data pembanding</span>';
        });
    }

    const canvasEl = document.getElementById('grafikYoY');
    if (canvasEl && window.Chart) {
        if (chartYoYInstance) {
            chartYoYInstance.destroy();
            chartYoYInstance = null;
        }

        const modeGelap = document.documentElement.classList.contains('dark');
        const warnaGrid = modeGelap ? 'rgba(255, 255, 255, 0.08)' : '#f3f4f6';
        const warnaLabel = modeGelap ? '#a1a1aa' : '#6b7280';

        const namaBulanPendek = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const datasets = [{
            label: `Laba Bersih ${tahunIni}`,
            data: dataIni.bulanan.map(b => b.pendapatan - b.beban),
            borderColor: 'rgba(217, 119, 87, 1)',
            backgroundColor: 'rgba(217, 119, 87, 0.12)',
            tension: 0.3,
            fill: true
        }];

        if (dataLalu) {
            datasets.push({
                label: `Laba Bersih ${tahunLalu}`,
                data: dataLalu.bulanan.map(b => b.pendapatan - b.beban),
                borderColor: 'rgba(168, 162, 158, 1)',
                backgroundColor: 'rgba(168, 162, 158, 0.08)',
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
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, color: warnaLabel } } },
                scales: {
                    y: { grid: { color: warnaGrid }, ticks: { color: warnaLabel } },
                    x: { grid: { display: false }, ticks: { color: warnaLabel } }
                }
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
    if (nilai === null) return { label: "N/A", kelas: "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400" };
    if (nilai >= ambangSehat) return { label: "SEHAT", kelas: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400" };
    if (nilai >= ambangWaspada) return { label: "WASPADA", kelas: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400" };
    return { label: "PERLU PERHATIAN", kelas: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400" };
}

function statusRasioRendahBaik(nilai, ambangSehat, ambangWaspada) {
    if (nilai === null) return { label: "N/A", kelas: "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400" };
    if (nilai <= ambangSehat) return { label: "SEHAT", kelas: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400" };
    if (nilai <= ambangWaspada) return { label: "WASPADA", kelas: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400" };
    return { label: "PERLU PERHATIAN", kelas: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400" };
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

// ==================== Proyeksi Arus Kas & Cash Runway ====================
// Estimasi sederhana berbasis rata-rata bergerak dari beberapa bulan
// transaksi terakhir yang benar-benar ada (bukan model prediksi kompleks).
// Tidak mengikuti filter Tahun - selalu memakai bulan-bulan paling baru.

const NAMA_BULAN_LENGKAP = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
let chartProyeksiInstance = null;

function hitungTotalKasSaatIni() {
    let total = 0;
    semuaJurnalCache.forEach(jurnal => {
        (jurnal.rows || []).forEach(baris => {
            const kode = String(baris.kode_akun || "");
            if (!kode.startsWith("11")) return;
            total += (parseFloat(baris.debit) || 0) - (parseFloat(baris.kredit) || 0);
        });
    });
    return total;
}

function formatBulanTahun(kunciYYYYMM) {
    const [tahun, bulan] = kunciYYYYMM.split("-");
    const idx = parseInt(bulan) - 1;
    return `${NAMA_BULAN_LENGKAP[idx] || bulan} ${tahun}`;
}

function namaBulanBerikutnya(kunciYYYYMMTerakhir) {
    const [tahun, bulan] = kunciYYYYMMTerakhir.split("-").map(Number);
    let bulanBerikut = bulan + 1;
    let tahunBerikut = tahun;
    if (bulanBerikut > 12) {
        bulanBerikut = 1;
        tahunBerikut += 1;
    }
    return `${NAMA_BULAN_LENGKAP[bulanBerikut - 1]} ${tahunBerikut}`;
}

function hitungTrenBulananTerakhir(jumlahBulan) {
    const kunciSet = new Set();
    semuaJurnalCache.forEach(j => {
        if (j.tanggal) kunciSet.add(j.tanggal.substring(0, 7));
    });
    const daftarKunci = Array.from(kunciSet).sort();
    const kunciTerakhir = daftarKunci.slice(-jumlahBulan);
    if (kunciTerakhir.length === 0) return [];

    const arusKas = kalkulasiArusKas(semuaJurnalCache);

    return kunciTerakhir.map(kunci => {
        let pendapatan = 0, beban = 0, netKasOperasi = 0;

        semuaJurnalCache.forEach(jurnal => {
            if (!jurnal.tanggal || jurnal.tanggal.substring(0, 7) !== kunci) return;
            (jurnal.rows || []).forEach(baris => {
                const kode = String(baris.kode_akun || "");
                const debit = parseFloat(baris.debit) || 0;
                const kredit = parseFloat(baris.kredit) || 0;
                if (kode.startsWith("4")) pendapatan += (kredit - debit);
                else if (kode.startsWith("5") || kode.startsWith("6")) beban += (debit - kredit);
            });
        });

        arusKas.rincian.forEach(r => {
            if (r.kategori === "Operasi" && r.jurnal.tanggal && r.jurnal.tanggal.substring(0, 7) === kunci) {
                netKasOperasi += r.netKas;
            }
        });

        return { kunci, pendapatan, beban, netKasOperasi };
    });
}

function renderProyeksiArusKas() {
    const JUMLAH_BULAN_TREN = 6;
    const tren = hitungTrenBulananTerakhir(JUMLAH_BULAN_TREN);

    const elCatatan = document.getElementById('proyeksiCatatanKurang');
    const elKonten = document.getElementById('proyeksiKontenUtama');

    if (tren.length < 2) {
        if (elCatatan) elCatatan.classList.remove('hidden');
        if (elKonten) elKonten.classList.add('hidden');
        return;
    }
    if (elCatatan) elCatatan.classList.add('hidden');
    if (elKonten) elKonten.classList.remove('hidden');

    const totalKas = hitungTotalKasSaatIni();
    setTeksAman('proyeksiTotalKas', formatRupiah(totalKas));

    const rataRataNetKasOperasi = tren.reduce((s, t) => s + t.netKasOperasi, 0) / tren.length;
    const elBurnRate = document.getElementById('proyeksiBurnRate');
    if (elBurnRate) {
        const positif = rataRataNetKasOperasi >= 0;
        elBurnRate.innerHTML = `<span class="${positif ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}">${positif ? '+' : ''}${formatRupiah(rataRataNetKasOperasi)}</span>`;
    }

    const elRunway = document.getElementById('proyeksiRunway');
    const elRunwayKeterangan = document.getElementById('proyeksiRunwayKeterangan');
    if (rataRataNetKasOperasi < 0 && totalKas > 0) {
        const bulanRunway = totalKas / Math.abs(rataRataNetKasOperasi);
        if (elRunway) {
            elRunway.innerText = bulanRunway.toFixed(1) + " bulan";
            elRunway.className = "text-2xl font-semibold mt-2 " + (bulanRunway < 3 ? "text-red-600 dark:text-red-400" : (bulanRunway < 6 ? "text-amber-600 dark:text-amber-400" : "text-stone-900 dark:text-stone-50"));
        }
        if (elRunwayKeterangan) elRunwayKeterangan.innerText = `Estimasi jika tren pengeluaran ${JUMLAH_BULAN_TREN} bulan terakhir berlanjut tanpa pemasukan baru`;
    } else if (totalKas <= 0) {
        if (elRunway) {
            elRunway.innerText = "0 bulan";
            elRunway.className = "text-2xl font-semibold mt-2 text-red-600 dark:text-red-400";
        }
        if (elRunwayKeterangan) elRunwayKeterangan.innerText = "Saldo kas tercatat sudah habis/negatif";
    } else {
        if (elRunway) {
            elRunway.innerText = "Aman";
            elRunway.className = "text-2xl font-semibold mt-2 text-emerald-600 dark:text-emerald-400";
        }
        if (elRunwayKeterangan) elRunwayKeterangan.innerText = `Arus kas operasional rata-rata ${JUMLAH_BULAN_TREN} bulan terakhir positif - tidak ada risiko kehabisan kas dalam waktu dekat`;
    }

    const rataRataPendapatan = tren.reduce((s, t) => s + t.pendapatan, 0) / tren.length;
    const kunciTerakhir = tren[tren.length - 1].kunci;
    setTeksAman('proyeksiPendapatan', formatRupiah(rataRataPendapatan));
    setTeksAman('proyeksiPendapatanLabel', `Estimasi untuk ${namaBulanBerikutnya(kunciTerakhir)} (rata-rata ${tren.length} bulan terakhir)`);

    const canvasEl = document.getElementById('grafikProyeksiKas');
    if (canvasEl && window.Chart) {
        if (chartProyeksiInstance) {
            chartProyeksiInstance.destroy();
            chartProyeksiInstance = null;
        }

        const modeGelap = document.documentElement.classList.contains('dark');
        const warnaGrid = modeGelap ? 'rgba(255, 255, 255, 0.08)' : '#f3f4f6';
        const warnaLabel = modeGelap ? '#a1a1aa' : '#6b7280';

        chartProyeksiInstance = new Chart(canvasEl.getContext('2d'), {
            type: 'bar',
            data: {
                labels: tren.map(t => formatBulanTahun(t.kunci)),
                datasets: [{
                    label: 'Arus Kas Operasional Bersih (Rp)',
                    data: tren.map(t => Math.round(t.netKasOperasi)),
                    backgroundColor: tren.map(t => t.netKasOperasi >= 0 ? 'rgba(34, 197, 94, 0.75)' : 'rgba(239, 68, 68, 0.75)'),
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: warnaGrid }, ticks: { color: warnaLabel } },
                    x: { grid: { display: false }, ticks: { color: warnaLabel } }
                }
            }
        });
    }
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
        renderProyeksiArusKas();

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
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-500 dark:text-red-400">Gagal memuat data dari pusat database.</td></tr>`;
        if (kartuContainer) kartuContainer.innerHTML = `<p class="p-8 text-center text-red-500 dark:text-red-400 text-sm">Gagal memuat data dari pusat database.</p>`;
    }
}

document.addEventListener("DOMContentLoaded", muatAnalisisBisnis);

// Render ulang keempat grafik Chart.js dengan warna grid/label yang sesuai
// saat tema gelap/terang diganti lewat tombol di header (lihat component.js
// -> window.toggleDarkMode). Data tidak diambil ulang dari Firestore, cukup
// dipakai lagi dari cache terakhir masing-masing grafik.
window.addEventListener('erapee-tema-berubah', () => {
    renderGrafik(dataUnitTerkini);
    renderStrukturBeban(document.getElementById('filterTahunBisnis')?.value || 'SEMUA');
    if (yoyTerkini.tahunIni) renderYoY(yoyTerkini.tahunIni, yoyTerkini.tahunLalu);
    renderProyeksiArusKas();
});
