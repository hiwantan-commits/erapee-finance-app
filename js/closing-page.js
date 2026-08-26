// js/closing-page.js - Controller untuk closing.html
import { ambilStatusClosing, simpanStatusClosing } from "./closing-period.js";

document.addEventListener("DOMContentLoaded", async function() {
    const statusText = document.getElementById("statusBulanTerkunci");
    const inputBulan = document.getElementById("inputBulanTerkunci");
    const formClosing = document.getElementById("formClosing");

    // Muat status saat ini
    const bulanTerkunci = await ambilStatusClosing();
    if (statusText) {
        statusText.innerText = bulanTerkunci ? `Periode aktif terkunci hingga: ${bulanTerkunci}` : "Belum ada periode yang dikunci.";
    }
    if (inputBulan && bulanTerkunci) {
        inputBulan.value = bulanTerkunci;
    }

    if (formClosing) {
        formClosing.addEventListener("submit", async function(e) {
            e.preventDefault();
            const nilaiBulan = inputBulan.value;
            if (!nilaiBulan) {
                alert("Silakan pilih bulan dan tahun penutupan buku.");
                return;
            }

            const btn = document.getElementById("btnSimpanClosing");
            btn.disabled = true;
            btn.innerText = "Menyimpan Pengaturan...";

            const hasil = await simpanStatusClosing(nilaiBulan);
            if (hasil.success) {
                alert(`Berhasil! Periode akuntansi hingga bulan ${nilaiBulan} kini telah dikunci.`);
                statusText.innerText = `Periode aktif terkunci hingga: ${nilaiBulan}`;
            } else {
                alert("Gagal menyimpan pengaturan: " + hasil.error);
            }

            btn.disabled = false;
            btn.innerText = "Kunci Periode Akuntansi";
        });
    }
});
