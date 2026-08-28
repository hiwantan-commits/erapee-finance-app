// js/invoice-form-page.js - Controller untuk invoice-baru.html (Buat/Edit
// Invoice & cetak Invoice+Kwitansi). Modul ini BERDIRI SENDIRI - menyimpan
// ke koleksi Firestore "invoice_penjualan" terpisah dari jurnal_transaksi,
// TIDAK membuat entri jurnal otomatis dan TIDAK memengaruhi Neraca/Laba
// Rugi/laporan lain (keputusan desain yang disepakati sebelum fitur ini
// dibangun).
import { CONFIG } from "./config.js";
import { ambilSemuaInvoice, simpanInvoice, generateNomorInvoiceBaru } from "./invoice-db.js";
import { terbilang } from "./terbilang.js";
import { escapeHtml } from "./utils.js";

const urlParams = new URLSearchParams(window.location.search);
const editIdAwal = urlParams.get('id');
let invoiceTersimpanTerkini = null;

function formatAngka(angka) {
    return Math.round(angka || 0).toLocaleString('id-ID');
}

function formatTanggalIndo(tglYYYYMMDD) {
    if (!tglYYYYMMDD) return '-';
    return new Date(tglYYYYMMDD + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

window.tambahBarisInvoice = function(nama = "", satuan = "", kuantum = 1, hargaSatuan = 0) {
    const tbody = document.getElementById('tbodyInvoice');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.className = 'baris-invoice';
    tr.innerHTML = `
        <td class="p-2"><input type="text" class="form-input-elegant nama_barang text-xs" value="${escapeHtml(nama)}" placeholder="Nama barang/jasa..." required></td>
        <td class="p-2"><input type="text" class="form-input-elegant satuan text-xs" value="${escapeHtml(satuan)}" placeholder="Pcs"></td>
        <td class="p-2"><input type="number" class="form-input-elegant kuantum text-xs text-right" value="${kuantum}" min="0" step="any" oninput="hitungTotalInvoice()" required></td>
        <td class="p-2"><input type="number" class="form-input-elegant harga_satuan text-xs text-right" value="${hargaSatuan}" min="0" step="any" oninput="hitungTotalInvoice()" required></td>
        <td class="p-2 text-right text-xs font-medium text-stone-700 dark:text-stone-300 jumlah_baris">0</td>
        <td class="p-2 text-center">
            <button type="button" onclick="hapusBarisInvoice(this)" class="btn-elegant-icon" title="Hapus Baris">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
    window.hitungTotalInvoice();
};

window.hapusBarisInvoice = function(btn) {
    const jumlahBaris = document.querySelectorAll('.baris-invoice').length;
    if (jumlahBaris > 1) {
        btn.closest('tr').remove();
        window.hitungTotalInvoice();
    } else {
        alert("Minimal harus ada 1 baris barang!");
    }
};

window.hitungTotalInvoice = function() {
    let subTotal = 0;
    document.querySelectorAll('.baris-invoice').forEach(tr => {
        const kuantum = parseFloat(tr.querySelector('.kuantum')?.value) || 0;
        const harga = parseFloat(tr.querySelector('.harga_satuan')?.value) || 0;
        const jumlah = kuantum * harga;
        const elJumlah = tr.querySelector('.jumlah_baris');
        if (elJumlah) elJumlah.innerText = formatAngka(jumlah);
        subTotal += jumlah;
    });

    const discount = parseFloat(document.getElementById('inputDiscount')?.value) || 0;
    const total = Math.max(subTotal - discount, 0);
    const persenPpn = parseFloat(document.getElementById('inputPersenPpn')?.value) || 0;
    const ppn = total * (persenPpn / 100);
    const grandTotal = total + ppn;

    document.getElementById('valSubTotal').innerText = formatAngka(subTotal);
    document.getElementById('valTotal').innerText = formatAngka(total);
    document.getElementById('valPpn').innerText = formatAngka(ppn);
    document.getElementById('valGrandTotal').innerText = formatAngka(grandTotal);

    return { subTotal, discount, total, persenPpn, ppn, grandTotal };
};

function kumpulkanDataForm() {
    const items = [];
    document.querySelectorAll('.baris-invoice').forEach(tr => {
        const nama = tr.querySelector('.nama_barang')?.value.trim() || '';
        const satuan = tr.querySelector('.satuan')?.value.trim() || '';
        const kuantum = parseFloat(tr.querySelector('.kuantum')?.value) || 0;
        const harga_satuan = parseFloat(tr.querySelector('.harga_satuan')?.value) || 0;
        if (!nama) return;
        items.push({ nama_barang: nama, satuan, kuantum, harga_satuan, jumlah: kuantum * harga_satuan });
    });

    const totals = window.hitungTotalInvoice();

    return {
        no_invoice: document.getElementById('noInvoice').value,
        no_kwitansi: document.getElementById('noKwitansi').value,
        tanggal: document.getElementById('tanggalInvoice').value,
        mata_uang: document.getElementById('mataUang').value.trim() || 'IDR',
        no_po: document.getElementById('noPo').value.trim(),
        tgl_po: document.getElementById('tglPo').value,
        tgl_jatuh_tempo: document.getElementById('tglJatuhTempo').value,
        nama_pelanggan: document.getElementById('namaPelanggan').value.trim(),
        alamat_pelanggan: document.getElementById('alamatPelanggan').value.trim(),
        no_surat_jalan: document.getElementById('noSuratJalan').value.trim(),
        items,
        sub_total: totals.subTotal,
        discount: totals.discount,
        total: totals.total,
        persen_ppn: totals.persenPpn,
        ppn: totals.ppn,
        grand_total: totals.grandTotal,
        info_rekening: document.getElementById('infoRekening').value.trim(),
        nama_penandatangan: document.getElementById('namaPenandatangan').value.trim(),
        jabatan_penandatangan: document.getElementById('jabatanPenandatangan').value.trim()
    };
}

function isiFormDariData(data) {
    document.getElementById('noInvoice').value = data.no_invoice || '';
    document.getElementById('noKwitansi').value = data.no_kwitansi || '';
    document.getElementById('tanggalInvoice').value = data.tanggal || '';
    document.getElementById('mataUang').value = data.mata_uang || 'IDR';
    document.getElementById('noPo').value = data.no_po || '';
    document.getElementById('tglPo').value = data.tgl_po || '';
    document.getElementById('tglJatuhTempo').value = data.tgl_jatuh_tempo || '';
    document.getElementById('namaPelanggan').value = data.nama_pelanggan || '';
    document.getElementById('alamatPelanggan').value = data.alamat_pelanggan || '';
    document.getElementById('noSuratJalan').value = data.no_surat_jalan || '';
    document.getElementById('inputDiscount').value = data.discount || 0;
    document.getElementById('inputPersenPpn').value = data.persen_ppn ?? (CONFIG.TAX_RATES.PPN_EFEKTIF * 100);
    document.getElementById('infoRekening').value = data.info_rekening || '';
    document.getElementById('namaPenandatangan').value = data.nama_penandatangan || '';
    document.getElementById('jabatanPenandatangan').value = data.jabatan_penandatangan || '';

    const tbody = document.getElementById('tbodyInvoice');
    tbody.innerHTML = '';
    (data.items && data.items.length > 0 ? data.items : [{}]).forEach(item => {
        window.tambahBarisInvoice(item.nama_barang, item.satuan, item.kuantum ?? 1, item.harga_satuan ?? 0);
    });
}

function renderAreaCetak(data) {
    const area = document.getElementById('areaCetakInvoice');
    const btnCetak = document.getElementById('btnCetakInvoice');
    if (!area) return;
    area.classList.remove('hidden');
    if (btnCetak) btnCetak.classList.remove('hidden');

    document.getElementById('cetakNamaPelanggan').innerText = data.nama_pelanggan || '-';
    document.getElementById('cetakAlamatPelanggan').innerText = data.alamat_pelanggan || '';
    document.getElementById('cetakNoInvoice').innerText = data.no_invoice || '-';
    document.getElementById('cetakTanggalInvoice').innerText = formatTanggalIndo(data.tanggal);
    document.getElementById('cetakMataUang').innerText = data.mata_uang || 'IDR';
    document.getElementById('cetakNoPo').innerText = data.no_po || '-';
    document.getElementById('cetakTglPo').innerText = data.tgl_po ? formatTanggalIndo(data.tgl_po) : '-';
    document.getElementById('cetakTglJatuhTempo').innerText = data.tgl_jatuh_tempo ? formatTanggalIndo(data.tgl_jatuh_tempo) : '-';

    const tbodyBarang = document.getElementById('cetakTabelBarang');
    tbodyBarang.innerHTML = (data.items || []).map((item, i) => `
        <tr>
            <td class="p-2 border border-gray-800 text-center">${i + 1}</td>
            <td class="p-2 border border-gray-800">${escapeHtml(item.nama_barang)}</td>
            <td class="p-2 border border-gray-800 text-center">${escapeHtml(item.satuan) || '-'}</td>
            <td class="p-2 border border-gray-800 text-right">${formatAngka(item.kuantum)}</td>
            <td class="p-2 border border-gray-800 text-right">${formatAngka(item.harga_satuan)}</td>
            <td class="p-2 border border-gray-800 text-right">${formatAngka(item.jumlah)}</td>
        </tr>
    `).join('');

    const elLabelSj = document.getElementById('cetakNoSuratJalanLabel');
    const elSj = document.getElementById('cetakNoSuratJalan');
    if (data.no_surat_jalan) {
        elLabelSj.classList.remove('hidden');
        elSj.innerText = data.no_surat_jalan;
    } else {
        elLabelSj.classList.add('hidden');
        elSj.innerText = '';
    }

    document.getElementById('cetakSubTotal').innerText = formatAngka(data.sub_total);
    document.getElementById('cetakDiscount').innerText = formatAngka(data.discount);
    document.getElementById('cetakTotal').innerText = formatAngka(data.total);
    document.getElementById('cetakPpn').innerText = formatAngka(data.ppn);
    document.getElementById('cetakGrandTotal').innerText = formatAngka(data.grand_total);

    document.getElementById('cetakInfoRekeningWrap').innerText = data.info_rekening || '';

    const namaTtd = data.nama_penandatangan ? `( ${data.nama_penandatangan} )` : '(   )';
    document.getElementById('cetakTtdInvoice').innerText = namaTtd;
    document.getElementById('cetakJabatanInvoice').innerText = data.jabatan_penandatangan || '';
    document.getElementById('cetakTtdKwitansi').innerText = namaTtd;
    document.getElementById('cetakJabatanKwitansi').innerText = data.jabatan_penandatangan || '';

    document.getElementById('cetakNoKwitansi').innerText = data.no_kwitansi || '-';
    document.getElementById('cetakKwitansiPelanggan').innerText = data.nama_pelanggan || '-';
    document.getElementById('cetakKwitansiTerbilang').innerText = terbilang(data.grand_total);
    document.getElementById('cetakKwitansiUntuk').innerText = `Invoice No. ${data.no_invoice || '-'}`;
    document.getElementById('cetakKwitansiJumlahPagar').innerText = `# ${formatAngka(data.grand_total)} #`;
    document.getElementById('cetakKwitansiTglKota').innerText = formatTanggalIndo(data.tanggal);
}

async function inisialisasiForm() {
    if (editIdAwal) {
        document.getElementById('judulForm').innerText = 'Edit Invoice';
        try {
            const semuaInvoice = await ambilSemuaInvoice();
            const target = semuaInvoice.find(inv => inv.id === editIdAwal);
            if (!target) {
                alert('Data invoice tidak ditemukan.');
                window.location.href = '/invoice';
                return;
            }
            document.getElementById('editIdInvoice').value = editIdAwal;
            isiFormDariData(target);
            invoiceTersimpanTerkini = target;
            renderAreaCetak(target);
        } catch (err) {
            console.error('Gagal memuat data invoice untuk diedit:', err);
        }
    } else {
        const today = new Date().toISOString().slice(0, 10);
        document.getElementById('tanggalInvoice').value = today;
        document.getElementById('inputPersenPpn').value = CONFIG.TAX_RATES.PPN_EFEKTIF * 100;
        window.tambahBarisInvoice();

        try {
            const nomor = await generateNomorInvoiceBaru();
            document.getElementById('noInvoice').value = nomor.no_invoice;
            document.getElementById('noKwitansi').value = nomor.no_kwitansi;
        } catch (err) {
            console.error('Gagal membuat nomor invoice otomatis:', err);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    inisialisasiForm();

    const formInvoice = document.getElementById('formInvoice');
    if (formInvoice) {
        formInvoice.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnSimpanInvoice');
            const editId = document.getElementById('editIdInvoice').value || null;

            btn.disabled = true;
            btn.innerText = 'Menyimpan...';

            const data = kumpulkanDataForm();
            if (data.items.length === 0) {
                alert('Tambahkan minimal satu baris barang/jasa dengan nama terisi.');
                btn.disabled = false;
                btn.innerText = 'Simpan Invoice';
                return;
            }

            try {
                const hasil = await simpanInvoice(data, editId);
                if (hasil.success) {
                    document.getElementById('editIdInvoice').value = hasil.id;
                    invoiceTersimpanTerkini = { ...data, id: hasil.id };
                    document.getElementById('alertSuccessInvoice').classList.remove('hidden');
                    renderAreaCetak(invoiceTersimpanTerkini);
                    document.getElementById('judulForm').innerText = 'Edit Invoice';
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    alert('Gagal menyimpan invoice: ' + hasil.error);
                }
            } catch (error) {
                console.error('Kesalahan sistem saat menyimpan invoice:', error);
                alert('Kesalahan sistem saat menyimpan invoice.');
            }

            btn.disabled = false;
            btn.innerText = 'Simpan Invoice';
        });
    }
});
