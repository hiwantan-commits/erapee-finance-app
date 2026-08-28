// js/assets-page.js - Controller untuk aset-tetap.html (Master Aset & Skedul Penyusutan)
import { db } from "./config.js";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ambilSemuaJurnalPusat } from "./db.js";
import { hitungPenyusutanAset, KELOMPOK_PENYUSUTAN } from "./accounting.js";
import { escapeHtml } from "./utils.js";

const KOLEKSI_ASET = "aset_tetap";

function formatRupiah(angka) {
    return "Rp " + Math.round(angka).toLocaleString('id-ID');
}

async function muatDaftarAset() {
    const tbody = document.getElementById('tabelDaftarAset');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-gray-400">Memuat daftar aset tetap...</td></tr>`;

    try {
        const snap = await getDocs(collection(db, KOLEKSI_ASET));
        let daftarAset = [];
        snap.forEach(docSnap => daftarAset.push({ id: docSnap.id, ...docSnap.data() }));
        daftarAset.sort((a, b) => (a.tanggal_perolehan || '').localeCompare(b.tanggal_perolehan || ''));

        let totalPerolehan = 0, totalAkumulasi = 0, totalNilaiBuku = 0;

        tbody.innerHTML = '';
        if (daftarAset.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-gray-400">Belum ada aset tetap terdaftar. Tambahkan lewat form di atas.</td></tr>`;
        } else {
            daftarAset.forEach(aset => {
                const hasil = hitungPenyusutanAset(aset);
                totalPerolehan += hasil.nilaiPerolehan;
                totalAkumulasi += hasil.akumulasiPenyusutan;
                totalNilaiBuku += hasil.nilaiBuku;

                const encId = encodeURIComponent(aset.id);
                let tr = document.createElement('tr');
                tr.id = `row-aset-${aset.id}`;
                tr.className = "border-b border-gray-100 hover:bg-gray-50 transition-colors";
                tr.innerHTML = `
                    <td class="p-3 text-xs font-medium text-gray-800">${escapeHtml(aset.nama_aset)}</td>
                    <td class="p-3 text-xs text-gray-500">${escapeHtml(aset.tanggal_perolehan)}</td>
                    <td class="p-3 text-xs"><span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold">${escapeHtml(aset.kelompok)}</span><div class="text-[10px] text-gray-400 mt-0.5">${escapeHtml(aset.metode)}</div></td>
                    <td class="p-3 text-xs text-right font-medium">${hasil.nilaiPerolehan.toLocaleString('id-ID')}</td>
                    <td class="p-3 text-xs text-right text-amber-700">${Math.round(hasil.akumulasiPenyusutan).toLocaleString('id-ID')}</td>
                    <td class="p-3 text-xs text-right font-bold text-green-700">${Math.round(hasil.nilaiBuku).toLocaleString('id-ID')}</td>
                    <td class="p-3 text-center">
                        <div class="flex justify-center items-center gap-1">
                            <button onclick="window.editAset('${encId}')" class="text-amber-600 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded text-[11px] font-bold transition">Edit</button>
                            <button onclick="window.hapusAset('${encId}')" class="text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded text-[11px] font-bold transition">Hapus</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        const elPerolehan = document.getElementById('totalPerolehanAset');
        const elPenyusutan = document.getElementById('totalPenyusutan');
        const elNilaiBuku = document.getElementById('totalNilaiBuku');
        if (elPerolehan) elPerolehan.innerText = formatRupiah(totalPerolehan);
        if (elPenyusutan) elPenyusutan.innerText = formatRupiah(totalAkumulasi);
        if (elNilaiBuku) elNilaiBuku.innerText = formatRupiah(totalNilaiBuku);

        window.dataAsetGlobal = {};
        daftarAset.forEach(a => { window.dataAsetGlobal[a.id] = a; });

    } catch (error) {
        console.error("Gagal memuat daftar aset:", error);
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500">Gagal memuat data aset tetap.</td></tr>`;
    }
}

window.editAset = function(encId) {
    const id = decodeURIComponent(encId);
    const aset = window.dataAsetGlobal[id];
    if (!aset) return;

    document.querySelectorAll('#tabelDaftarAset tr').forEach(tr => tr.classList.remove('bg-amber-50'));
    const activeRow = document.getElementById(`row-aset-${id}`);
    if (activeRow) activeRow.classList.add('bg-amber-50');

    document.getElementById('editIdAset').value = id;
    document.getElementById('namaAset').value = aset.nama_aset || '';
    document.getElementById('tanggalPerolehanAset').value = aset.tanggal_perolehan || '';
    document.getElementById('nilaiPerolehanAset').value = aset.nilai_perolehan || 0;
    document.getElementById('kelompokAset').value = aset.kelompok || 'Kelompok 1';
    document.getElementById('metodeAset').value = aset.metode || 'Garis Lurus';

    const btn = document.getElementById('btnSimpanAset');
    btn.innerText = 'Update Aset';
    btn.classList.replace('bg-indigo-600', 'bg-amber-500');
    btn.classList.replace('hover:bg-indigo-700', 'hover:bg-amber-600');
    document.getElementById('btnBatalAset').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.batalEditAset = function() {
    document.querySelectorAll('#tabelDaftarAset tr').forEach(tr => tr.classList.remove('bg-amber-50'));
    document.getElementById('formAset').reset();
    document.getElementById('editIdAset').value = '';

    const btn = document.getElementById('btnSimpanAset');
    btn.innerText = 'Simpan Aset Tetap';
    btn.classList.replace('bg-amber-500', 'bg-indigo-600');
    btn.classList.replace('hover:bg-amber-600', 'hover:bg-indigo-700');
    document.getElementById('btnBatalAset').classList.add('hidden');
};

window.hapusAset = async function(encId) {
    const id = decodeURIComponent(encId);
    if (confirm('Yakin hapus aset tetap ini dari daftar? Riwayat transaksi pembelian di jurnal tidak akan ikut terhapus.')) {
        try {
            await deleteDoc(doc(db, KOLEKSI_ASET, id));
            muatDaftarAset();
        } catch (error) {
            alert('Gagal menghapus aset: ' + error.message);
        }
    }
};

async function muatRiwayatJurnalAset() {
    const tbody = document.getElementById('tabelAsetTetap');
    if (!tbody) return;

    try {
        const semuaJurnal = await ambilSemuaJurnalPusat();
        let rowsHTML = "";

        semuaJurnal.forEach(jurnal => {
            jurnal.rows.forEach(baris => {
                const kodeAkun = baris.kode_akun || "";
                if (kodeAkun.startsWith("15") || kodeAkun.startsWith("16") || (baris.nama_akun && baris.nama_akun.toLowerCase().includes("aset"))) {
                    const nilaiDebit = parseFloat(baris.debit) || 0;
                    if (nilaiDebit > 0) {
                        rowsHTML += `
                            <tr>
                                <td class="p-3 font-bold text-indigo-700">${escapeHtml(jurnal.id_jurnal)}<div class="text-[11px] text-gray-400 font-normal">${escapeHtml(jurnal.tanggal)}</div></td>
                                <td class="p-3"><div class="font-medium text-gray-800">${escapeHtml(jurnal.no_bukti)}</div><div class="text-[11px] text-gray-500">${escapeHtml(jurnal.keterangan) || '-'}</div></td>
                                <td class="p-3"><span class="px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold rounded">${escapeHtml(baris.kode_akun)} - ${escapeHtml(baris.nama_akun)}</span></td>
                                <td class="p-3 text-right font-bold text-gray-800">${nilaiDebit.toLocaleString('id-ID')}</td>
                            </tr>
                        `;
                    }
                }
            });
        });

        tbody.innerHTML = rowsHTML === "" ? `<tr><td colspan="4" class="p-8 text-center text-gray-400">Belum ada transaksi pembelian aset tetap tercatat di jurnal.</td></tr>` : rowsHTML;
    } catch (error) {
        console.error("Gagal memuat riwayat jurnal aset:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    muatDaftarAset();
    muatRiwayatJurnalAset();

    const selectKelompok = document.getElementById('kelompokAset');
    if (selectKelompok) {
        selectKelompok.innerHTML = Object.keys(KELOMPOK_PENYUSUTAN).map(k =>
            `<option value="${k}">${k} (umur ${KELOMPOK_PENYUSUTAN[k].tahun} tahun)</option>`
        ).join('');
    }

    const formAset = document.getElementById('formAset');
    if (formAset) {
        formAset.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnSimpanAset');
            const editId = document.getElementById('editIdAset').value;

            btn.disabled = true;
            btn.innerText = 'Menyimpan...';

            const payload = {
                nama_aset: document.getElementById('namaAset').value.trim(),
                tanggal_perolehan: document.getElementById('tanggalPerolehanAset').value,
                nilai_perolehan: parseFloat(document.getElementById('nilaiPerolehanAset').value) || 0,
                kelompok: document.getElementById('kelompokAset').value,
                metode: document.getElementById('metodeAset').value
            };

            if (payload.metode === "Saldo Menurun" && !KELOMPOK_PENYUSUTAN[payload.kelompok].saldoMenurun) {
                alert('❌ Metode Saldo Menurun tidak berlaku untuk kelompok Bangunan (UU PPh hanya mengizinkan Garis Lurus untuk bangunan). Silakan pilih Garis Lurus.');
                btn.disabled = false;
                btn.innerText = editId ? 'Update Aset' : 'Simpan Aset Tetap';
                return;
            }

            try {
                if (editId) {
                    await updateDoc(doc(db, KOLEKSI_ASET, editId), payload);
                    window.batalEditAset();
                } else {
                    await addDoc(collection(db, KOLEKSI_ASET), payload);
                    formAset.reset();
                    btn.disabled = false;
                    btn.innerText = 'Simpan Aset Tetap';
                }
                muatDaftarAset();
            } catch (error) {
                alert('Gagal menyimpan aset: ' + error.message);
                btn.disabled = false;
                btn.innerText = editId ? 'Update Aset' : 'Simpan Aset Tetap';
            }
        });
    }
});
