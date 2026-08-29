// js/journal-page.js - Controller untuk input-jurnal.html dengan Bukti Transaksi & Auto No. Bukti
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "./config.js";
import { simpanJurnalPusat, ambilSemuaJurnalPusat, ambilBuktiTransaksi } from "./db.js";
import { cekApakahPeriodeTerkunci } from "./closing-period.js";
import { escapeHtml } from "./utils.js";
import { pasangAutocompleteAkun } from "./coa-autocomplete.js";

// Bukti transaksi disimpan langsung di Firestore (base64), bukan Firebase Storage,
// karena Storage membutuhkan paket berbayar (Blaze) dan project ini tetap di paket gratis.
const MAKS_UKURAN_BUKTI_BYTE = 700 * 1024; // ~700KB, aman di bawah batas dokumen Firestore 1 MiB
let buktiTersimpanSebelumnya = false; // Ditandai true saat mode edit & jurnal sudah punya bukti

function perkiraanUkuranBase64(dataUrl) {
    const base64 = dataUrl.split(',')[1] || '';
    return Math.floor(base64.length * 0.75);
}

function kompresGambarKeBase64(file, maksDimensi = 1400, kualitas = 0.72) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = () => { img.src = reader.result; };
        reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
        img.onload = () => {
            let { width, height } = img;
            if (width > maksDimensi || height > maksDimensi) {
                const rasio = Math.min(maksDimensi / width, maksDimensi / height);
                width = Math.round(width * rasio);
                height = Math.round(height * rasio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', kualitas));
        };
        img.onerror = () => reject(new Error("Gagal memuat gambar untuk diproses."));
        reader.readAsDataURL(file);
    });
}

function bacaFileKeBase64Mentah(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Gagal membaca file."));
        reader.readAsDataURL(file);
    });
}

async function prosesBuktiTransaksiKeBase64(file) {
    const isGambar = file.type.startsWith('image/');
    const dataUrl = isGambar ? await kompresGambarKeBase64(file) : await bacaFileKeBase64Mentah(file);

    if (perkiraanUkuranBase64(dataUrl) > MAKS_UKURAN_BUKTI_BYTE) {
        throw new Error(
            isGambar
                ? "Ukuran gambar masih terlalu besar setelah dikompres. Coba gunakan foto dengan resolusi lebih kecil."
                : "Ukuran berkas PDF terlalu besar (maks. sekitar 500KB). Coba kompres PDF terlebih dahulu atau scan dengan resolusi lebih rendah."
        );
    }

    return { data: dataUrl, mimeType: file.type, namaFile: file.name };
}

async function bukaBuktiTersimpan(dataUrl) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
}

let coaArray = []; // Array global untuk menyimpan data COA (untuk mapping otomatis)
const urlParams = new URLSearchParams(window.location.search);
const editIdJurnal = urlParams.get('edit');

window.toggleDueDate = function() {
    const sifat = document.getElementById('sifat_transaksi').value;
    const tglJatuhTempo = document.getElementById('jatuh_tempo');
    if (sifat === 'Non-Tunai') {
        tglJatuhTempo.disabled = false;
        tglJatuhTempo.required = true;
    } else {
        tglJatuhTempo.disabled = true;
        tglJatuhTempo.value = "";
        tglJatuhTempo.required = false;
    }
};

// Fungsi generate ID yang sudah diperbarui menjadi Asynchronous untuk menarik nomor urut
async function generateIdJurnal() {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const time = date.getTime().toString().slice(-5);
    
    // ID Internal Firebase
    document.getElementById('id_jurnal').value = `JRN-${yyyy}${mm}${dd}-${time}`;
    document.getElementById('tanggal').value = `${yyyy}-${mm}-${dd}`;

    // GENERATE OTOMATIS NO. BUKTI (INV-YYYY/MM/DD/NoUrut)
    try {
        const semuaData = await ambilSemuaJurnalPusat();
        const tglHariIni = `${yyyy}-${mm}-${dd}`;
        
        let countHariIni = 0;
        if (semuaData && semuaData.length > 0) {
            countHariIni = semuaData.filter(j => j.tanggal === tglHariIni).length;
        }
        
        const noUrut = String(countHariIni + 1).padStart(3, '0');
        
        const inputNoBukti = document.getElementById('no_bukti');
        if (inputNoBukti) {
            inputNoBukti.value = `INV-${yyyy}/${mm}/${dd}/${noUrut}`;
        }
    } catch (error) {
        console.error("Gagal generate No. Bukti Otomatis:", error);
        const inputNoBukti = document.getElementById('no_bukti');
        if (inputNoBukti) {
            inputNoBukti.value = `INV-${yyyy}/${mm}/${dd}/${time.slice(-3)}`;
        }
    }
}

window.hitungTotal = function() {
    let totDebit = 0;
    let totKredit = 0;
    document.querySelectorAll('.debit').forEach(el => totDebit += (parseFloat(el.value) || 0));
    document.querySelectorAll('.kredit').forEach(el => totKredit += (parseFloat(el.value) || 0));

    document.getElementById('totalDebit').innerText = totDebit.toLocaleString('id-ID');
    document.getElementById('totalKredit').innerText = totKredit.toLocaleString('id-ID');

    const statusEl = document.getElementById('statusBalance');
    if (totDebit === totKredit && totDebit > 0) {
        statusEl.className = "px-4 py-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-sm font-bold rounded-xl border border-emerald-300 dark:border-emerald-800 shadow-sm inline-block";
        statusEl.innerText = "✓ SEIMBANG (BALANCE)";
    } else {
        statusEl.className = "px-4 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm font-bold rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm inline-block";
        statusEl.innerText = "⚠️ BELUM BALANCE";
    }
};

window.tambahBaris = function(akunVal = "", memoVal = "", debitVal = 0, kreditVal = 0) {
    const tbody = document.getElementById('tbodyJurnal');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.className = 'jurnal-row hover:bg-stone-50 dark:hover:bg-stone-800/40';

    tr.innerHTML = `
        <td class="p-2"><input type="text" placeholder="Pilih atau Ketik Akun..." class="form-input-elegant kode_akun text-xs font-medium" required autocomplete="off"></td>
        <td class="p-2"><input type="text" class="form-input-elegant memo_baris text-xs" value="${memoVal}" placeholder="Memo..."></td>
        <td class="p-2"><input type="number" class="form-input-elegant debit font-bold text-emerald-600 dark:text-emerald-400 text-right" value="${debitVal}" min="0" step="any" oninput="hitungTotal()" required></td>
        <td class="p-2"><input type="number" class="form-input-elegant kredit font-bold text-red-600 dark:text-red-400 text-right" value="${kreditVal}" min="0" step="any" oninput="hitungTotal()" required></td>
        <td class="p-2 text-center">
            <button type="button" onclick="hapusBaris(this)" class="btn-elegant-icon" title="Hapus Baris">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
    pasangAutocompleteAkun(tr.querySelector('.kode_akun'), () => coaArray);

    if (akunVal) {
        const found = coaArray.find(c => c.kode === akunVal);
        tr.querySelector('.kode_akun').value = found ? `${found.kode} - ${found.nama}` : akunVal;
    }
    hitungTotal();
};

window.hapusBaris = function(btn) {
    const rowCount = document.querySelectorAll('.jurnal-row').length;
    if(rowCount > 2) {
        btn.closest('tr').remove();
        hitungTotal();
    } else {
        alert("Minimal harus ada 2 baris!");
    }
};

window.terapkanTemplate = function() {
    const jenis = document.getElementById('pilihTemplate').value;
    const tbody = document.getElementById('tbodyJurnal');
    if (!jenis || !tbody) return;

    tbody.innerHTML = "";
    if (jenis === "GAJI") {
        document.getElementById('keterangan').value = "Pembayaran gaji karyawan periode berjalan";
        tambahBaris("6101", "Beban Gaji & Tunjangan", 0, 0);
        tambahBaris("1101", "Kas / Bank Operasional", 0, 0);
    } else if (jenis === "OPERASIONAL") {
        document.getElementById('keterangan').value = "Pembayaran beban operasional kantor";
        tambahBaris("6102", "Beban Operasional Lainnya", 0, 0);
        tambahBaris("1101", "Kas / Bank Operasional", 0, 0);
    } else if (jenis === "PENDAPATAN") {
        document.getElementById('keterangan').value = "Penerimaan pendapatan penjualan tunai";
        tambahBaris("1101", "Kas / Bank Operasional", 0, 0);
        tambahBaris("4101", "Pendapatan Usaha", 0, 0);
    } else if (jenis === "PEMBELIAN_ASET") {
        document.getElementById('keterangan').value = "Pembelian aset tetap secara tunai";
        tambahBaris("1501", "Aset Tetap", 0, 0);
        tambahBaris("1101", "Kas / Bank Operasional", 0, 0);
    } else if (jenis === "JASA_WEBSITE") {
        document.getElementById('keterangan').value = "Penerimaan pembayaran jasa pembuatan website";
        tambahBaris("1101", "Kas / Bank Operasional", 0, 0);
        tambahBaris("4102", "Pendapatan Jasa Pembuatan Website", 0, 0);
    } else if (jenis === "LANGGANAN_SAAS") {
        document.getElementById('keterangan').value = "Penerimaan pendapatan langganan aplikasi SaaS";
        tambahBaris("1101", "Kas / Bank Operasional", 0, 0);
        tambahBaris("4103", "Pendapatan Langganan Aplikasi SaaS", 0, 0);
    } else if (jenis === "DP_PROYEK") {
        document.getElementById('keterangan').value = "Penerimaan uang muka (DP) proyek dari klien";
        tambahBaris("1101", "Kas / Bank Operasional", 0, 0);
        tambahBaris("2102", "Pendapatan Diterima Dimuka", 0, 0);
    } else if (jenis === "HOSTING_CLOUD") {
        document.getElementById('keterangan').value = "Pembayaran biaya hosting, domain & infrastruktur cloud";
        tambahBaris("6103", "Beban Hosting & Infrastruktur Cloud", 0, 0);
        tambahBaris("1101", "Kas / Bank Operasional", 0, 0);
    } else if (jenis === "PANEN_TUNAI") {
        document.getElementById('keterangan').value = "Penerimaan penjualan hasil pertanian secara tunai";
        tambahBaris("1101", "Kas / Bank Operasional", 0, 0);
        tambahBaris("4104", "Pendapatan Penjualan Hasil Pertanian", 0, 0);
    } else if (jenis === "SARANA_PERTANIAN") {
        document.getElementById('keterangan').value = "Pembelian sarana produksi pertanian (bibit/pupuk/pestisida)";
        tambahBaris("5101", "HPP - Sarana Produksi Pertanian", 0, 0);
        tambahBaris("1101", "Kas / Bank Operasional", 0, 0);
    }
};

async function inisialisasiData() {
    try {
        const snapUnit = await getDocs(collection(db, "master_unit_usaha"));
        const selectUnit = document.getElementById('unit_usaha');
        if (selectUnit) {
            let units = [];
            snapUnit.forEach(d => units.push(d.data()));
            selectUnit.innerHTML = '<option value="">Pilih Unit...</option>';
            units.forEach(u => {
                const label = escapeHtml(u.kode) + " - " + escapeHtml(u.nama);
                selectUnit.innerHTML += `<option value="${label}">${label}</option>`;
            });
        }
    } catch (err) {}

    try {
        const snapCOA = await getDocs(collection(db, "master_coa"));
        let coaList = [];
        snapCOA.forEach(d => coaList.push(d.data()));
        coaList.sort((a, b) => a.kode.localeCompare(b.kode));
        coaArray = coaList;
    } catch (err) {}

    if (editIdJurnal) {
        document.getElementById('judulForm').innerText = "Edit Jurnal Akuntansi (" + editIdJurnal + ")";
        document.getElementById('btnSubmit').innerHTML = "Simpan Perubahan Jurnal";
        
        try {
            const semuaData = await ambilSemuaJurnalPusat();
            const jurnalTarget = semuaData.find(j => j.id_jurnal === editIdJurnal);

            if (jurnalTarget) {
                document.getElementById('id_jurnal').value = jurnalTarget.id_jurnal;
                document.getElementById('tanggal').value = jurnalTarget.tanggal || '';
                document.getElementById('no_bukti').value = jurnalTarget.no_bukti || '';
                document.getElementById('sifat_transaksi').value = jurnalTarget.sifat_transaksi || 'Tunai';
                
                // Pencocokan saat Edit data unit usaha
                const unitVal = jurnalTarget.unit_usaha || '';
                const selectUnitEl = document.getElementById('unit_usaha');
                if(selectUnitEl) {
                    for(let opt of selectUnitEl.options) {
                        if(opt.value.startsWith(unitVal)) {
                            selectUnitEl.value = opt.value;
                            break;
                        }
                    }
                }

                document.getElementById('lawan_transaksi').value = jurnalTarget.lawan_transaksi || '';
                document.getElementById('jatuh_tempo').value = jurnalTarget.jatuh_tempo || '';
                document.getElementById('kode_pajak').value = jurnalTarget.kode_pajak || 'NON';
                document.getElementById('dpp_penjualan').value = jurnalTarget.dpp_penjualan || 0;
                document.getElementById('keterangan').value = jurnalTarget.keterangan || '';
                document.getElementById('status_jurnal').value = jurnalTarget.status || 'POSTED';
                
                if (jurnalTarget.punya_bukti) {
                    const buktiTersimpan = await ambilBuktiTransaksi(jurnalTarget.id_jurnal);
                    if (buktiTersimpan && buktiTersimpan.data) {
                        buktiTersimpanSebelumnya = true;
                        const statusUpload = document.getElementById('statusUpload');
                        statusUpload.innerHTML = `✅ <a href="#" id="linkLihatBukti" class="text-[#D97757] underline">Lihat File Tersimpan (${escapeHtml(buktiTersimpan.namaFile) || 'berkas'})</a> (Pilih berkas baru untuk mengganti)`;
                        statusUpload.classList.remove('hidden');
                        document.getElementById('linkLihatBukti').addEventListener('click', (e) => {
                            e.preventDefault();
                            bukaBuktiTersimpan(buktiTersimpan.data);
                        });
                    }
                }

                toggleDueDate();

                const tbody = document.getElementById('tbodyJurnal');
                tbody.innerHTML = "";
                jurnalTarget.rows.forEach(d => {
                    tambahBaris(d.kode_akun, d.memo_baris, d.debit, d.kredit);
                });
            } else {
                alert("Data jurnal tidak ditemukan.");
                window.location.href = '/manajemen';
            }
        } catch (err) {
            console.error("Gagal memuat data edit:", err);
        }
    } else {
        await generateIdJurnal(); 
        tambahBaris();
        tambahBaris();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    inisialisasiData();

    const formJurnal = document.getElementById('formJurnal');
    if (formJurnal) {
        formJurnal.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const tanggalInput = document.getElementById('tanggal').value;
            
            const isTerkunci = await cekApakahPeriodeTerkunci(tanggalInput);
            if (isTerkunci) {
                alert("❌ Transaksi ditolak! Periode bulan untuk tanggal ini telah ditutup (Closed Period). Anda tidak dapat menambah atau mengubah jurnal pada periode tersebut.");
                return;
            }

            let totDebit = 0, totKredit = 0;
            const rows = document.querySelectorAll('.jurnal-row');
            rows.forEach(row => {
                totDebit += parseFloat(row.querySelector('.debit').value) || 0;
                totKredit += parseFloat(row.querySelector('.kredit').value) || 0;
            });

            if (totDebit !== totKredit || totDebit === 0) {
                alert("❌ Transaksi ditolak! Total Debit dan Kredit harus SEIMBANG dan tidak boleh 0.");
                return;
            }

            const btn = document.getElementById('btnSubmit');
            btn.innerText = "Memproses Penyimpanan...";
            btn.disabled = true;

            try {
                const targetIdJurnal = document.getElementById('id_jurnal').value;

                const fileInput = document.getElementById('file_bukti');
                const statusUpload = document.getElementById('statusUpload');

                let buktiBaru = null;
                if (fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    btn.innerText = "Memproses Bukti Transaksi...";
                    statusUpload.innerText = "Memproses berkas: " + file.name;
                    statusUpload.classList.remove('hidden');

                    try {
                        buktiBaru = await prosesBuktiTransaksiKeBase64(file);
                        statusUpload.innerText = "✅ Berkas siap disimpan bersama jurnal.";
                    } catch (prosesErr) {
                        console.error("Gagal memproses berkas bukti:", prosesErr);
                        alert("❌ " + prosesErr.message);
                        btn.innerText = "Simpan Jurnal Akuntansi";
                        btn.disabled = false;
                        return;
                    }
                }

                // ==========================================
                // MEMBERSIHKAN FORMAT UNIT USAHA (AMBIL KODENYA SAJA)
                // ==========================================
                const rawUnitValue = document.getElementById('unit_usaha').value;
                const cleanUnitCode = rawUnitValue ? rawUnitValue.split(' - ')[0].trim() : '';

                const headerData = {
                    id_jurnal: targetIdJurnal,
                    tanggal: tanggalInput,
                    no_bukti: document.getElementById('no_bukti').value,
                    sifat_transaksi: document.getElementById('sifat_transaksi').value,
                    unit_usaha: cleanUnitCode, // Tersimpan bersih sebagai "WT-NANAS", "CORP", dll.
                    lawan_transaksi: document.getElementById('lawan_transaksi').value,
                    jatuh_tempo: document.getElementById('jatuh_tempo').value,
                    punya_bukti: Boolean(buktiBaru) || (Boolean(editIdJurnal) && buktiTersimpanSebelumnya),
                    kode_pajak: document.getElementById('kode_pajak').value,
                    dpp_penjualan: parseFloat(document.getElementById('dpp_penjualan').value) || 0,
                    keterangan: document.getElementById('keterangan').value,
                    status: document.getElementById('status_jurnal').value
                };

                let rowsData = [];
                rows.forEach(row => {
                    const inputCOA = row.querySelector('.kode_akun');
                    const rawVal = inputCOA.value || '';
                    
                    const parts = rawVal.split(' - ');
                    const kodeAkunDb = parts[0] ? parts[0].trim() : '';
                    const namaAkunDb = parts[1] ? parts.slice(1).join(' - ').trim() : rawVal;

                    rowsData.push({
                        kode_akun: kodeAkunDb,
                        nama_akun: namaAkunDb,
                        memo_baris: row.querySelector('.memo_baris').value || '',
                        debit: parseFloat(row.querySelector('.debit').value) || 0,
                        kredit: parseFloat(row.querySelector('.kredit').value) || 0
                    });
                });

                btn.innerText = "Menyimpan Transaksi ke Pusat...";
                const hasil = await simpanJurnalPusat(headerData, rowsData, editIdJurnal ? targetIdJurnal : null, buktiBaru);

                if (hasil.success) {
                    document.getElementById('alertSuccess').classList.remove('hidden');
                    setTimeout(() => {
                        window.location.href = '/manajemen';
                    }, 1500);
                } else {
                    alert("Gagal menyimpan data transaksi: " + hasil.error);
                    btn.innerText = "Simpan Jurnal Akuntansi";
                    btn.disabled = false;
                }

            } catch (error) {
                console.error("Kesalahan sistem saat menyimpan:", error);
                alert("Kesalahan sistem saat menyimpan data.");
                btn.innerText = "Simpan Jurnal Akuntansi";
                btn.disabled = false;
            }
        });
    }
});
