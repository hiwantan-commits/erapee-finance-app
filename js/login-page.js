// js/login-page.js - Controller Halaman Login Lengkap (Branding, Anti-Loop, & Toggle Password)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { CONFIG } from "./config.js";

const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", function() {
    // 1. Muat Branding Dinamis (Logo & Favicon)
    muatBrandingLogin();

    // 2. Fungsionalitas Tombol Lihat/Sembunyikan Password (Ikon Mata)
    const togglePasswordBtn = document.getElementById("togglePasswordBtn");
    const passwordInput = document.getElementById("passwordInput");

    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener("click", function() {
            const currentType = passwordInput.getAttribute("type");
            if (currentType === "password") {
                passwordInput.setAttribute("type", "text");
                this.classList.add("text-indigo-600");
            } else {
                passwordInput.setAttribute("type", "password");
                this.classList.remove("text-indigo-600");
            }
        });
    }

    // 3. Sinkronisasi Sesi (Pencegah Infinite Loop)
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (!sessionStorage.getItem("erapee_user_session")) {
                try {
                    const userDoc = await getDoc(doc(db, "users", user.email));
                    let role = "Akuntan";
                    let nama = "";
                    if (userDoc.exists()) {
                        role = userDoc.data().role || "Akuntan";
                        nama = userDoc.data().nama || "";
                    } else if (user.email === "hi.wantan@gmail.com") {
                        role = "Super Admin";
                    }

                    const sessionData = {
                        uid: user.uid,
                        email: user.email,
                        nama: nama,
                        role: role,
                        loginTime: new Date().getTime()
                    };
                    sessionStorage.setItem("erapee_user_session", JSON.stringify(sessionData));
                    window.location.href = '/index';
                } catch (err) {
                    console.error("Gagal memulihkan sesi:", err);
                    await signOut(auth);
                }
            } else {
                window.location.href = '/index';
            }
        }
    });

    // 4. Tangani Proses Form Login Manual
    const formLogin = document.getElementById("formLogin");
    if (formLogin) {
        formLogin.addEventListener("submit", async function(e) {
            e.preventDefault();
            
            const emailInput = document.querySelector('input[type="email"]');
            const btnSubmit = formLogin.querySelector('button[type="submit"]');
            
            if (!emailInput || !passwordInput) return;

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            const originalBtnText = btnSubmit.innerText;
            btnSubmit.disabled = true;
            btnSubmit.innerText = "Memverifikasi...";
            btnSubmit.classList.add("opacity-75", "cursor-not-allowed");

            try {
                await signInWithEmailAndPassword(auth, email, password);
                // Berhasil login akan ditangani otomatis oleh onAuthStateChanged di atas
            } catch (error) {
                console.error("Error login:", error);
                alert("Gagal masuk: Email atau Kata Sandi salah.");
                
                btnSubmit.disabled = false;
                btnSubmit.innerText = originalBtnText;
                btnSubmit.classList.remove("opacity-75", "cursor-not-allowed");
            }
        });
    }
});

// Fungsi memuat Branding Dinamis dari Firestore
async function muatBrandingLogin() {
    try {
        const docSnap = await getDoc(doc(db, "pengaturan_sistem", "branding"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Terapkan Favicon
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
                logoImg.src = data.logoUrl;
                logoImg.style.display = "block";
                if (titleText) titleText.style.display = "none";
            }
        }
    } catch (err) {
        console.error("Gagal memuat branding halaman login:", err);
    }
}
