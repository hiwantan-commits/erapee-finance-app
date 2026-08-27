// js/component.js - Komponen Global dengan Sidebar Berkelompok & Posisi Profil Baru
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { CONFIG } from "./config.js";
import { cekSesiLogin, ambilUserAktif } from "./auth.js";

const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const auth = getAuth(app);

document.addEventListener("DOMContentLoaded", function() {
    cekSesiLogin();

    const path = window.location.pathname;
    let currentFile = path.substring(path.lastIndexOf('/') + 1) || 'index';
    if (currentFile.endsWith('.html')) {
        currentFile = currentFile.replace('.html', '');
    }
    if (currentFile === '') currentFile = 'index';

    if (currentFile !== 'login') {
        onAuthStateChanged(auth, (user) => {
            if (!user) {
                sessionStorage.removeItem("erapee_user_session");
                window.location.href = '/login';
            } else {
                muatSidebar();
                muatHeader();
            }
        });
    }
});

function muatSidebar() {
    const sidebarContainer = document.getElementById('sidebar-container');
    if (!sidebarContainer) return;

    const path = window.location.pathname;
    let currentFile = path.substring(path.lastIndexOf('/') + 1) || 'index';
    if (currentFile.endsWith('.html')) {
        currentFile = currentFile.replace('.html', '');
    }
    if (currentFile === '') currentFile = 'index';

    const currentUser = ambilUserAktif();
    const userRole = currentUser.role || "Akuntan"; 

    // Struktur Menu Berkelompok
    const menuGroups = [
        {
            groupName: "Utama",
            items: [
                { name: 'Dashboard & Audit', href: 'index', icon: '🏠', roles: ['Super Admin', 'Admin', 'Akuntan', 'Auditor'] }
            ]
        },
        {
            groupName: "Akuntansi & Transaksi",
            items: [
                { name: 'COA & Master Data', href: 'master-data', icon: '🗂️', roles: ['Super Admin', 'Admin', 'Akuntan'] },
                { name: 'Input Jurnal', href: 'input-jurnal', icon: '📝', roles: ['Super Admin', 'Admin', 'Akuntan'] },
                { name: 'Buku Besar & Jurnal', href: 'manajemen', icon: '📊', roles: ['Super Admin', 'Admin', 'Akuntan', 'Auditor'] }
            ]
        },
        {
            groupName: "Pajak & Aset",
            items: [
                { name: 'Profil & Param Pajak', href: 'profil-pajak', icon: '🏢', roles: ['Super Admin', 'Admin', 'Akuntan'] },
                { name: 'Aset Tetap', href: 'aset-tetap', icon: '🏭', roles: ['Super Admin', 'Admin', 'Akuntan', 'Auditor'] },
                { name: 'Rekapitulasi PPN & PPh', href: 'pajak', icon: '🏛️', roles: ['Super Admin', 'Admin', 'Akuntan', 'Auditor'] },
                { name: 'Rekonsiliasi Fiskal', href: 'rekonsiliasi', icon: '⚖️', roles: ['Super Admin', 'Admin', 'Akuntan', 'Auditor'] }
            ]
        },
        {
            groupName: "Laporan & Analisis",
            items: [
                { name: 'Laporan Keuangan', href: 'laporan', icon: '📈', roles: ['Super Admin', 'Admin', 'Akuntan', 'Auditor'] },
                { name: 'Histori Audit', href: 'histori', icon: '📜', roles: ['Super Admin', 'Admin', 'Akuntan', 'Auditor'] }
            ]
        },
        {
            groupName: "Administrasi Sistem",
            items: [
                { name: 'Profil Akun Saya', href: 'profile', icon: '👤', roles: ['Super Admin', 'Admin', 'Akuntan', 'Auditor'] },
                { name: 'Manajemen Pengguna', href: 'users', icon: '👥', roles: ['Super Admin'] },
                { name: 'Tutup Buku Bulanan', href: 'closing', icon: '🔒', roles: ['Super Admin', 'Admin'] }
            ]
        }
    ];

    let groupsHtml = '';
    menuGroups.forEach((group) => {
        let itemsHtml = '';
        let hasVisibleItem = false;

        group.items.forEach(item => {
            if (!item.roles.includes(userRole)) return;
            hasVisibleItem = true;

            const isActive = currentFile === item.href || currentFile === item.href + '.html';
            const activeClass = isActive 
                ? 'bg-indigo-600 text-white font-medium shadow-sm' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';

            itemsHtml += `
                <a href="/${item.href}" class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${activeClass} my-0.5">
                    <span class="text-sm">${item.icon}</span>
                    <span>${item.name}</span>
                </a>
            `;
        });

        if (!hasVisibleItem) return;

        groupsHtml += `
            <div class="mb-3">
                <p class="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">${group.groupName}</p>
                <div class="space-y-0.5">
                    ${itemsHtml}
                </div>
            </div>
        `;
    });

    let roleBadgeClass = "text-indigo-600";
    if (userRole === "Super Admin") roleBadgeClass = "text-amber-500 font-bold";

    sidebarContainer.innerHTML = `
        <div id="sidebar-overlay" onclick="toggleSidebar()" class="fixed inset-0 bg-black bg-opacity-50 z-40 hidden md:hidden"></div>
        <aside id="app-sidebar" class="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transform -translate-x-full md:translate-x-0 transition-transform duration-300 ease-in-out">
            <div class="p-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                    <h1 class="font-bold text-gray-900 text-sm tracking-tight">PT ERAPEE</h1>
                    <p class="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">Role: <span class="${roleBadgeClass} ml-1">${userRole}</span></p>
                </div>
                <button onclick="toggleSidebar()" class="md:hidden text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <nav class="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
                ${groupsHtml}
            </nav>
            <div class="p-3 border-t border-gray-100 bg-gray-50">
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
    const currentUser = ambilUserAktif();

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
                <a href="/profile" class="hidden sm:inline text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-colors cursor-pointer">
                    ${currentUser.email || ''}
                </a>
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                    ● Terhubung ke Firebase
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
        sessionStorage.removeItem("erapee_user_session");
        signOut(auth).then(() => {
            window.location.href = '/login';
        }).catch((error) => {
            console.error('Logout error:', error);
            window.location.href = '/login';
        });
    }
};
