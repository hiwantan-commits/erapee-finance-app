// js/login-page.js - Controller Halaman Login & Pencegah Infinite Loop
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { CONFIG } from "./config.js";

const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", function() {
    // 1. Muat Branding Terlebih Dahulu
    muatBrandingLogin();

    // 2. SINKRONISASI SESI (PENCEGAH INFINITE LOOP)
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Jika Firebase mengenali user, TAPI session memori kosong (karena tab baru dibuka)
            if (!sessionStorage.getItem("erapee_user_session")) {
                try {
                    // Tarik ulang role/jabatan dari database
                    const userDoc = await getDoc(doc(db, "users", user.email));
                    let role = "Akuntan"; // Fallback default
                    if (userDoc.exists()) {
                        role = userDoc.data().role || "Akuntan";
                    } else if (user.email === "hi.wantan@gmail.com") {
                        role = "Super Admin"; // Keamanan darurat akun utama
                    }

                    // Buat dan simpan ulang Session Storage!
                    const sessionData = {
                        uid: user.uid,
                        email: user.email,
                        role: role,
                        loginTime: new Date().getTime()
                    };
                    sessionStorage.setItem("erapee_user_session", JSON.stringify(sessionData));
                    
                    // Selesai sinkronisasi, aman untuk dilempar ke index
                    window.location.href = '/index';
                } catch (err) {
                    console.error("Gagal memulihkan sesi memori:", err);
                    await signOut(auth); // Reset total jika terjadi error fatal
                }
            } else {
                // Sesi memori sudah ada dan cocok, langsung arahkan ke index
                window.location.href = '/index';
            }
        }
    });

    // 3. Tangani Proses Form Login Manual
    const formLogin = document.getElementById("formLogin") || document.querySelector("form");
    if (formLogin) {
        formLogin.addEventListener("submit", async function(e) {
            e.preventDefault();
            
            const emailInput = document.querySelector('input[type="email"]');
            const passwordInput = document.querySelector('input[type="password"]');
            const btnSubmit = formLogin.querySelector('button[type="submit"]') || formLogin.querySelector('button');
            
            if (!emailInput || !passwordInput) return;

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            // Visual feedback loading
            const originalBtnText = btnSubmit.innerText;
            btnSubmit.disabled = true;
            btnSubmit.innerText = "Memverifikasi...";
            btnSubmit.classList.add("opacity-75", "cursor-not-allowed");

            try {
                // Kita hanya menjalankan login Firebase di sini.
                // Jika berhasil, onAuthStateChanged di blok atas akan langsung bereaksi, 
                // menyusun sessionStorage, dan mengarahkan halaman dengan aman.
                await signInWithEmailAndPassword(auth, email, password);
            } catch (error) {
                console.error("Error login:", error);
                alert("Gagal masuk: Email atau Kata Sandi salah.");
                
                // Kembalikan tombol jika gagal
                btnSubmit.disabled = false;
                btnSubmit.innerText = originalBtnText;
                btnSubmit.classList.remove("opacity-75", "cursor-not-allowed");
            }
        });
    }
});

// Fungsi memuat Branding Dinamis
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
                if (titleText) titleText.style.display = "none";
            }
        }
    } catch (err) {
        console.error("Gagal memuat branding halaman login:", err);
    }
}
