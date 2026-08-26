// js/login-page.js - Controller untuk login.html
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { CONFIG } from "./config.js";

const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const auth = getAuth(app);

document.addEventListener("DOMContentLoaded", function() {
    // Logika Toggle Tampil/Sembunyikan Password
    const togglePassword = document.getElementById("togglePassword");
    const passwordInput = document.getElementById("password");

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener("click", function() {
            const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
            passwordInput.setAttribute("type", type);
            
            // Ubah warna ikon saat aktif (opsional agar terlihat interaktif)
            this.classList.toggle("text-indigo-600");
        });
    }

    // Logika Proses Login
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
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                sessionStorage.setItem("erapee_user_session", JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    loginAt: new Date().toISOString()
                }));

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
