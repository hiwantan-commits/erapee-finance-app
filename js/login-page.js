// js/login-page.js - Controller untuk login.html
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { CONFIG } from "./config.js";

const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const auth = getAuth(app);

document.addEventListener("DOMContentLoaded", function() {
    const formLogin = document.getElementById("formLogin");
    if (formLogin) {
        formLogin.addEventListener("submit", async function(e) {
            e.preventDefault();
            
            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value;
            const pesanError = document.getElementById("pesanError");
            const btnSubmit = document.getElementById("btnSubmit");

            pesanError.classList.add("hidden");
            pesanError.innerText = "";
            btnSubmit.disabled = true;
            btnSubmit.innerText = "Memproses Masuk...";

            try {
                // Autentikasi menggunakan Firebase Auth
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Simpan sesi lokal untuk auth.js
                sessionStorage.setItem("erapee_user_session", JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    loginAt: new Date().toISOString()
                }));

                // Arahkan ke dashboard utama setelah sukses
                window.location.href = "index.html";

            } catch (error) {
                console.error("Login gagal:", error.code, error.message);
                pesanError.innerText = "Gagal Masuk: " + (error.code === 'auth/invalid-credential' ? 'Email atau kata sandi salah.' : error.message);
                pesanError.classList.remove("hidden");
                btnSubmit.disabled = false;
                btnSubmit.innerText = "Masuk ke Sistem";
            }
        });
    }
});
