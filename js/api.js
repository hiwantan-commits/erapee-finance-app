// js/api.js
// Logika perhitungan form dan pengiriman data ke Google Sheets menggunakan CONFIG pusat

// --- 1. Logika Perhitungan Matematis Form ---
const dppInput = document.getElementById('dpp');
const ppnInput = document.getElementById('ppn');
const pphInput = document.getElementById('pph');
const totalInput = document.getElementById('total');

if (dppInput && ppnInput && pphInput) {
    function hitungTotal() {
        const dpp = parseFloat(dppInput.value) || 0;
        const ppn = parseFloat(ppnInput.value) || 0;
        const pph = parseFloat(pphInput.value) || 0;
        totalInput.value = dpp + ppn - pph;
    }

    dppInput.addEventListener('input', hitungTotal);
    ppnInput.addEventListener('input', hitungTotal);
    pphInput.addEventListener('input', hitungTotal);
}

// --- 2. Logika Pengiriman API ke Google Apps Script ---
const formTransaksi = document.getElementById('formTransaksi');

if (formTransaksi) {
    formTransaksi.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const btnSubmit = document.getElementById('btnSubmit');
        btnSubmit.innerText = "Menyimpan ke Cloud...";
        btnSubmit.disabled = true;

        // Mengambil URL dari CONFIG pusat (Tidak perlu ditulis ulang manual)
        const scriptURL = CONFIG.APPS_SCRIPT_URL;
        
        const data = {
            tanggal: document.getElementById('tanggal').value,
            no_ref: document.getElementById('no_ref').value,
            tipe: document.getElementById('tipe').value,
            kategori: document.getElementById('kategori').value,
            uraian: document.getElementById('uraian').value,
            dpp: document.getElementById('dpp').value,
            ppn: document.getElementById('ppn').value,
            pph: document.getElementById('pph').value,
            total: document.getElementById('total').value
        };

        fetch(scriptURL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        .then(() => {
            document.getElementById('alertSuccess').classList.remove('hidden');
            formTransaksi.reset();
            document.getElementById('total').value = 0; 
            setTimeout(() => document.getElementById('alertSuccess').classList.add('hidden'), 5000);
        })
        .catch(error => {
            alert("Terjadi kesalahan sistem saat mengirim data.");
            console.error('Error!', error.message);
        })
        .finally(() => {
            btnSubmit.innerText = "Simpan Transaksi";
            btnSubmit.disabled = false;
        });
    });
}
