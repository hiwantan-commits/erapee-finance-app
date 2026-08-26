// js/config.js - Konfigurasi Utama Firebase PT ERAPEE Anugrah Sejahtera
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"; // Diperlukan untuk inisialisasi
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

export const CONFIG = {
    firebaseConfig: {
        apiKey: "AIzaSyBAspi9107FKi1zu-2T_K0thXw7RMS40Ps",
        authDomain: "pt-erapee-finance.firebaseapp.com",
        projectId: "pt-erapee-finance",
        storageBucket: "pt-erapee-finance.firebasestorage.app",
        messagingSenderId: "839880121530",
        appId: "1:839880121530:web:4e271ca82d8a7936a43683",
        measurementId: "G-JYMREYJ1JF"
    },
    COLLECTION_NAME: "jurnal_transaksi"
};

// Inisialisasi Firebase SDK
import { initializeApp as initApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

const app = initApp(CONFIG.firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
