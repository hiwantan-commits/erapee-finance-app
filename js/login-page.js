// js/login-page.js - Controller Halaman Login & Pemuat Branding Dinamis (Bebas Bug Race Condition)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { CONFIG } from "./config.js";

const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", function() {
    // 1. Muat Logo dan Favicon Dinamis
    muatBrandingLogin();

    // 2. Pengecekan sesi statis (Bukan pendeteksi live, agar tidak memotong proses masuk)
    // Jika user memang sudah punya sesi, baru arahkan ke Dashboard
    if (sessionStorage.getItem("erapee_user_session")) {
        window.location.href = '/index';
        return;
    }

    // 3. Tangani Proses Form Login
    const formLogin = document.getElementById("formLogin");
    if (formLogin) {
        formLogin.addEventListener("submit", async function(e) {
            e.preventDefault();
            
            const emailInput = document.querySelector('input[type="email"]');
            const passwordInput = document.querySelector('input[type="password"]');
            const btnSubmit = formLogin.querySelector('button[type="submit"]') || formLogin.querySelector('button');
            
            if (!emailInput || !passwordInput) return;

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            // Ubah tampilan tombol saat memproses
            const originalBtnText = btnSubmit.innerText;
            btnSubmit.disabled = true;
            btnSubmit.innerText = "Memverifikasi Data...";
            btnSubmit.classList.add("opacity-75", "cursor-not-allowed");

            try {
                // Autentikasi utama dengan Firebase Auth
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Ambil Role (Hak Akses) pengguna dari Firestore SEBELUM pindah halaman
                const userDoc = await getDoc(doc(db, "users", email));
                let role = "Akuntan"; // Fallback ke Akuntan jika data tidak ada
                
                if (userDoc.exists()) {
                    role = userDoc.data().role || "Akuntan";
                } else if (email === "hi.wantan@gmail.com") {
                    role = "Super Admin"; // Keamanan darurat akun utama
                }

                // Susun dan simpan data ke Session Storage secara utuh
                const sessionData = {
                    uid: user.uid,
                    email: user.email,
                    role: role,
                    loginTime: new Date().getTime()
                };
                sessionStorage.setItem("erapee_user_session", JSON.stringify(sessionData));

                // Setelah data sesi 100% tersimpan aman, baru kita pindahkan halamannya!
                window.location.href = '/index';

            } catch (error) {
                console.error("Error login:", error);
                alert("Gagal masuk: Email atau Kata Sandi salah. Silakan periksa kembali.");
                
                // Kembalikan tombol ke kondisi semula jika gagal
                btnSubmit.disabled = false;
                btnSubmit.innerText = originalBtnText;
                btnSubmit.classList.remove("opacity-75", "cursor-not-allowed");
            }
        });
    }
});

// Fungsi pemuat Branding (Tidak diubah, tetap sama)
async function muatBrandingLogin() {
    try {
        const docSnap = await getDoc(doc(db, "pengaturan_sistem", "branding"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            if (data.faviconUrl && !data.faviconUrl.endsWith('/branding')) {
                let faviconTag = document.querySelector("link[rel*='icon']") || document.createElement('link');
                faviconTag.type = 'image/png';
                faviconTag.rel = 'icon';
                faviconTag.href = data.faviconUrl;
                document.getElementsByTagName('head')[0].appendChild(faviconTag);
            }

            const logoImg = document.getElementById("loginLogoImg");
            const titleText = document.getElementById("loginTitleText");
            
            if (logoImg && data.logoUrl && !data.logoUrl.endsWith('/branding')) {
                logoImg.src = data.logoUrl;
                logoImg.style.display = "block";
                
                if (titleText) {
                    titleText.style.display = "none";
                }
            }
        }
    } catch (err) {
        console.error("Gagal memuat branding halaman login:", err);
    }
}
