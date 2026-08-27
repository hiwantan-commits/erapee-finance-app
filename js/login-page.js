// js/login-page.js - Controller Halaman Login & Pemuat Branding Dinamis
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { CONFIG } from "./config.js";

const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", function() {
    // 1. Muat Logo dan Favicon Dinamis ke Halaman Login
    muatBrandingLogin();

    // 2. Cegah akses form jika pengguna sudah login (Langsung lempar ke Dashboard)
    onAuthStateChanged(auth, (user) => {
        if (user) {
            window.location.href = '/index';
        }
    });

    // 3. Tangani Proses Form Login
    const formLogin = document.querySelector("form"); 
    if (formLogin) {
        formLogin.addEventListener("submit", async function(e) {
            e.preventDefault();
            
            // Ambil elemen input berdasarkan tipenya agar lebih kebal error (anti-salah ID)
            const emailInput = document.querySelector('input[type="email"]');
            const passwordInput = document.querySelector('input[type="password"]');
            const btnSubmit = formLogin.querySelector('button[type="submit"]') || formLogin.querySelector('button');
            
            if (!emailInput || !passwordInput) return;

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            // Ubah tombol menjadi mode Loading
            const originalBtnText = btnSubmit.innerText;
            btnSubmit.disabled = true;
            btnSubmit.innerText = "Memverifikasi Data...";
            btnSubmit.classList.add("opacity-75", "cursor-not-allowed");

            try {
                // Autentikasi dengan Firebase Auth
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Ambil Role pengguna dari Firestore
                const userDoc = await getDoc(doc(db, "users", email));
                let role = "Akuntan"; // Role default sistem
                
                if (userDoc.exists()) {
                    role = userDoc.data().role || "Akuntan";
                } else if (email === "hi.wantan@gmail.com") {
                    // Fallback keamanan jika akun Super Admin utama belum masuk database
                    role = "Super Admin";
                }

                // Simpan Sesi (SessionStorage) agar bisa dibaca oleh component.js
                const sessionData = {
                    uid: user.uid,
                    email: user.email,
                    role: role,
                    loginTime: new Date().getTime()
                };
                sessionStorage.setItem("erapee_user_session", JSON.stringify(sessionData));

                // Berhasil login, arahkan ke halaman utama
                window.location.href = '/index';

            } catch (error) {
                console.error("Error login:", error);
                alert("Gagal masuk: Email atau Kata Sandi salah. Silakan periksa kembali.");
                
                // Kembalikan tombol ke kondisi semula
                btnSubmit.disabled = false;
                btnSubmit.innerText = originalBtnText;
                btnSubmit.classList.remove("opacity-75", "cursor-not-allowed");
            }
        });
    }
});

// Fungsi untuk menarik dan menerapkan Logo & Favicon dari Firestore secara dinamis
async function muatBrandingLogin() {
    try {
        const docSnap = await getDoc(doc(db, "pengaturan_sistem", "branding"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Terapkan Favicon ke Tab Browser
            if (data.faviconUrl && !data.faviconUrl.endsWith('/branding')) {
                let faviconTag = document.querySelector("link[rel*='icon']") || document.createElement('link');
                faviconTag.type = 'image/png';
                faviconTag.rel = 'icon';
                faviconTag.href = data.faviconUrl;
                document.getElementsByTagName('head')[0].appendChild(faviconTag);
            }

            // Terapkan Logo ke Halaman Login
            const logoImg = document.getElementById("loginLogoImg");
            const titleText = document.getElementById("loginTitleText");
            
            if (logoImg && data.logoUrl && !data.logoUrl.endsWith('/branding')) {
                // Tampilkan gambar logo
                logoImg.src = data.logoUrl;
                logoImg.style.display = "block";
                
                // Sembunyikan teks polos "PT ERAPEE" agar tidak ada tulisan ganda
                if (titleText) {
                    titleText.style.display = "none";
                }
            }
        }
    } catch (err) {
        console.error("Gagal memuat branding halaman login:", err);
    }
}
