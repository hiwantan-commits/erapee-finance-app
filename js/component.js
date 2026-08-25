// js/component.js
// Komponen Terpusat: Sidebar, Header, Proteksi Sesi, & Logout untuk PT ERAPEE

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { CONFIG } from "./config.js";

const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const auth = getAuth(app);

document.addEventListener("DOMContentLoaded", function() {
    // Cek apakah pengguna sudah login (kecuali di halaman login.html)
    const path = window.location.pathname;
    const currentFile = path.substring(path.lastIndexOf('/') + 1) || 'index.html';

    if (currentFile !== 'login.html') {
        onAuthStateChanged(auth, (user) => {
            if (!user) {
                // Jika belum login, lempar ke halaman login
                window.location.href = 'login.html';
            } else {
                // Jika sudah login, muat komponen
                muatSidebar(user.email);
                muatHeader();
            }
        });
    }
});

function muatSidebar(userEmail) {
    const sidebarContainer = document.getElementById('sidebar-container');
    if (!sidebarContainer) return;

    const path = window.location.pathname;
    const currentFile = path.substring(path.lastIndexOf('/') + 1) || 'index.html';

    const menuItems = [
        { name: 'Input Jurnal', href: 'index.html', icon: '📝' },
        { name: 'Manajemen Jurnal', href: 'manajemen.html', icon: '📊' },
        { name: 'Laporan Laba Rugi', href: 'laporan.html', icon: '📈' },
        { name: 'Rekap Pajak', href: 'pajak.html', icon: '🏛️' },
        { name: 'Histori Audit', href: 'histori.html', icon: '📜' }
    ];

    let menuHtml = '';
    menuItems.forEach(item => {
        const isActive = currentFile === item.href;
        const activeClass = isActive 
            ? 'bg-indigo-600 text-white font-medium shadow-sm' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';

        menuHtml += `
            <a href="${item.href}" class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${activeClass}">
                <span class="text-base">${item.icon}</span>
                <span>${item.name}</span>
            </a>
        `;
    });

    sidebarContainer.innerHTML = `
        <!-- Overlay untuk Mobile -->
        <div id="sidebar-overlay" onclick="toggleSidebar()" class="fixed inset-0 bg-black bg-opacity-50 z-40 hidden md:hidden"></div>

        <!-- Sidebar Utama -->
        <aside id="app-sidebar" class="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transform -translate-x-full md:translate-x-0 transition-transform duration-300 ease-in-out">
            <!-- Brand / Logo -->
            <div class="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                    <h1 class="font-bold text-gray-900 text-base tracking-tight">PT ERAPEE</h1>
                    <p class="text-xs text-gray-400 mt-0.5">Anugrah Sejahtera</p>
                </div>
                <button onclick="toggleSidebar()" class="md:hidden text-gray-500 hover:text-gray-700">
                    ✕
                </button>
            </div>

            <!-- Menu Navigasi -->
            <nav class="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
                ${menuHtml}
            </nav>

            <!-- User Info & Tombol Logout -->
            <div class="p-4 border-t border-gray-100 bg-gray-50">
                <div class="mb-3 px-2">
                    <p class="text-xs text-gray-400">Masuk sebagai:</p>
                    <p class="text-xs font-semibold text-gray-700 truncate">${userEmail || 'Admin'}</p>
                </div>
                <button onclick="prosesLogout()" class="w-full bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold py-2 px-3 rounded-lg transition flex items-center justify-center gap-2">
                    🚪 Keluar Sistem
                </button>
            </div>
        </aside>
    `;
}

function muatHeader() {
    const headerContainer = document.getElementById('header-container');
    if (!headerContainer) return;

    let pageTitle = document.title.split('|')[0].trim();

    headerContainer.innerHTML = `
        <header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
            <div class="flex items-center gap-4">
                <button onclick="toggleSidebar()" class="md:hidden text-gray-600 hover:text-gray-900 focus:outline-none">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                    </svg>
                </button>
                <h2 class="text-lg font-bold text-gray-800">${pageTitle}</h2>
            </div>
            <div class="flex items-center gap-3">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                    ● Aman & Terproteksi
                </span>
            </div>
        </header>
    `;
}

window.toggleSidebar = function() {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('-translate-x-full');
        overlay.classList.toggle('hidden');
    }
};

window.prosesLogout = function() {
    if (confirm('Apakah Anda yakin ingin keluar dari sistem?')) {
        signOut(auth).then(() => {
            window.location.href = 'login.html';
        }).catch((error) => {
            console.error('Logout error:', error);
        });
    }
};
