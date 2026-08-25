// js/config.js
// Pusat Konfigurasi Firebase Firestore & Aplikasi PT ERAPEE

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const CONFIG = {
    // Konfigurasi Firebase PT Erapee Finance
    FIREBASE_CONFIG: {
        apiKey: "AIzaSyBAspi9107FKi1zu-2T_K0thXw7RMS40Ps",
        authDomain: "pt-erapee-finance.firebaseapp.com",
        projectId: "pt-erapee-finance",
        storageBucket: "pt-erapee-finance.firebasestorage.app",
        messagingSenderId: "839880121530",
        appId: "1:839880121530:web:4e271ca82d8a7936a43683",
        measurementId: "G-JYMREYJ1JF"
    },
    
    // Nama koleksi database di Firestore untuk mencatat jurnal akuntansi
    COLLECTION_NAME: "jurnal_transaksi"
};

// Inisialisasi Firebase & Firestore agar bisa diakses global di seluruh halaman
const app = initializeApp(CONFIG.FIREBASE_CONFIG);
export const db = getFirestore(app);
