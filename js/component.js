// js/component.js - Komponen Global dengan Render Logo Dinamis & Sidebar Terstruktur (UI Diperbarui)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { CONFIG } from "./config.js";
import { cekSesiLogin, ambilUserAktif } from "./auth.js";
import { escapeHtml } from "./utils.js";

const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", function() {
    cekSesiLogin();

    const path = window.location.pathname;
    let currentFile = path.substring(path.lastIndexOf('/') + 1) || 'index';
    if (currentFile.endsWith('.html')) {
        currentFile = currentFile.replace('.html', '');
    }
    if (currentFile === '') currentFile = 'index';

    if (currentFile !== 'login') {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                sessionStorage.removeItem("erapee_user_session");
                window.location.href = '/login';
            } else {
                await muatSidebarAndBranding();
                muatHeader();
                document.body.classList.remove('auth-pending');
            }
        });
    } else {
        document.body.classList.remove('auth-pending');
    }
});

function ambilInisial(teks) {
    if (!teks) return "?";
    const bagianDepan = teks.split("@")[0].trim();
    const kata = bagianDepan.split(/[\s._-]+/).filter(Boolean);
    if (kata.length === 0) return "?";
    if (kata.length === 1) return kata[0].substring(0, 2).toUpperCase();
    return (kata[0][0] + kata[1][0]).toUpperCase();
}

// ==================== Mode Tema "Elegant" (pilot, per-halaman) ====================
// Halaman yang ingin memakai tampilan baru (minimalis, netral, mendukung dark
// mode - terinspirasi Vercel/Claude.ai) cukup menandai <body data-tema="elegant">.
// Halaman TANPA atribut ini akan tetap memakai tampilan sidebar/header lama
// persis seperti sebelumnya - supaya rollout bisa bertahap per halaman tanpa
// risiko mengubah tampilan halaman yang belum disetujui.

function modeTemaElegantAktif() {
    return document.body.dataset.tema === 'elegant';
}

window.toggleDarkMode = function() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        try { localStorage.setItem('erapee_tema', 'light'); } catch (e) {}
    } else {
        html.classList.add('dark');
        try { localStorage.setItem('erapee_tema', 'dark'); } catch (e) {}
    }
    perbaruiIkonDarkMode();
    window.dispatchEvent(new CustomEvent('erapee-tema-berubah'));
};

function perbaruiIkonDarkMode() {
    const ikon = document.getElementById('ikonDarkMode');
    if (!ikon) return;
    ikon.innerText = document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
}

function bangunGroupsHtmlKlasik(menuGroups, userRole, currentFile) {
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
    return groupsHtml;
}

function bangunGroupsHtmlElegant(menuGroups, userRole, currentFile) {
    let groupsHtml = '';
    menuGroups.forEach((group) => {
        let itemsHtml = '';
        let hasVisibleItem = false;

        group.items.forEach(item => {
            if (!item.roles.includes(userRole)) return;
            hasVisibleItem = true;

            const isActive = currentFile === item.href || currentFile === item.href + '.html';
            const activeClass = isActive
                ? 'bg-[#D97757]/10 dark:bg-[#D97757]/15 text-[#D97757] font-medium'
                : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-stone-100';

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
                <p class="px-3 text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-1">${group.groupName}</p>
                <div class="space-y-0.5">
                    ${itemsHtml}
                </div>
            </div>
        `;
    });
    return groupsHtml;
}

async function muatSidebarAndBranding() {
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
    const namaTampilan = currentUser.nama || currentUser.email;
    const inisialUser = ambilInisial(namaTampilan);

    // 1. Ambil data branding terlebih dahulu dari Firestore sebelum merender sidebar
    let logoSrc = "";
    let faviconSrc = "";
    try {
        const docSnap = await getDoc(doc(db, "pengaturan_sistem", "branding"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.logoUrl && !data.logoUrl.endsWith('/branding')) {
                logoSrc = data.logoUrl;
            }
            if (data.faviconUrl && !data.faviconUrl.endsWith('/branding')) {
                faviconSrc = data.faviconUrl;
                let faviconTag = document.querySelector("link[rel*='icon']") || document.createElement('link');
                faviconTag.type = 'image/png';
                faviconTag.rel = 'icon';
                faviconTag.href = faviconSrc;
                document.getElementsByTagName('head')[0].appendChild(faviconTag);
            }
        }
    } catch (err) {
        console.error("Gagal memuat branding:", err);
    }

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
                { name: 'Laporan Arus Kas', href: 'rekonsiliasi', icon: '⚖️', roles: ['Super Admin', 'Admin', 'Akuntan', 'Auditor'] }
            ]
        },
        {
            groupName: "Laporan & Analisis",
            items: [
                { name: 'Laporan Keuangan', href: 'laporan', icon: '📈', roles: ['Super Admin', 'Admin', 'Akuntan', 'Auditor'] },
                { name: 'Analisis Bisnis', href: 'analisa-bisnis', icon: '💡', roles: ['Super Admin', 'Admin', 'Akuntan', 'Auditor'] },
                { name: 'Histori Audit', href: 'histori', icon: '📜', roles: ['Super Admin', 'Admin', 'Akuntan', 'Auditor'] }
            ]
        },
        {
            groupName: "Administrasi Sistem",
            items: [
                { name: 'Pengaturan Branding', href: 'branding', icon: '🎨', roles: ['Super Admin'] },
                { name: 'Manajemen Pengguna', href: 'users', icon: '👥', roles: ['Super Admin'] },
                { name: 'Tutup Buku Bulanan', href: 'closing', icon: '🔒', roles: ['Super Admin', 'Admin'] }
            ]
        }
    ];

    const modeElegant = modeTemaElegantAktif();
    const isProfileActive = currentFile === 'profile';

    if (modeElegant) {
        const groupsHtml = bangunGroupsHtmlElegant(menuGroups, userRole, currentFile);

        const roleBadgeClass = userRole === "Super Admin" ? "text-amber-600 dark:text-amber-400 font-medium" : "text-stone-600 dark:text-stone-300";
        // Kartu profil memakai tint aksen lembut saat aktif (bukan latar solid
        // yang dibalik) - avatar & teks selalu memakai warna tetap yang sama,
        // jadi tidak ada lagi risiko warna teks "hilang" karena tertimpa latar.
        const profileActiveClass = isProfileActive
            ? 'bg-[#D97757]/10 dark:bg-[#D97757]/15 border-[#D97757]/30'
            : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/60';
        const logoHtml = logoSrc
            ? `<img src="${logoSrc}" alt="PT ERAPEE" class="h-10 w-auto max-w-[150px] object-contain object-left">`
            : `<h1 class="font-semibold text-stone-900 dark:text-stone-100 text-base tracking-tight">PT ERAPEE</h1>`;

        sidebarContainer.innerHTML = `
            <div id="sidebar-overlay" onclick="toggleSidebar()" class="fixed inset-0 bg-black/40 z-40 hidden md:hidden"></div>
            <aside id="app-sidebar" class="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-stone-950 border-r border-stone-200 dark:border-stone-800 flex flex-col transform -translate-x-full md:translate-x-0 transition-transform duration-300 ease-in-out">

                <div class="p-6 border-b border-stone-100 dark:border-stone-800 flex items-start justify-between">
                    <div class="flex flex-col gap-3 overflow-hidden w-full">
                        ${logoHtml}
                        <div class="inline-flex items-center self-start px-2.5 py-1 rounded-md bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-800">
                            <span class="text-[9px] text-stone-400 dark:text-stone-500 uppercase tracking-widest mr-1.5 font-medium">Role</span>
                            <span class="text-[10px] ${roleBadgeClass} tracking-wide">${userRole}</span>
                        </div>
                    </div>
                    <button onclick="toggleSidebar()" class="md:hidden text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 -mt-1 -mr-1">✕</button>
                </div>

                <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    ${groupsHtml}
                </nav>

                <div class="p-3 border-t border-stone-100 dark:border-stone-800 space-y-2">
                    <a href="/profile" class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all border ${profileActiveClass}">
                        <div class="w-8 h-8 rounded-full bg-[#D97757] text-white flex items-center justify-center text-[11px] font-medium shrink-0">
                            ${inisialUser}
                        </div>
                        <div class="overflow-hidden">
                            <p class="font-medium truncate text-stone-900 dark:text-stone-100">${escapeHtml(namaTampilan)}</p>
                            <p class="text-[10px] text-stone-400 dark:text-stone-500 truncate">Lihat Profil</p>
                        </div>
                    </a>
                    <button onclick="prosesLogout()" class="w-full bg-stone-50 dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 text-xs font-medium py-2 px-3 rounded-lg transition flex items-center justify-center gap-2 border border-stone-100 dark:border-stone-800">
                        Keluar Sistem
                    </button>
                </div>
            </aside>
        `;
        return;
    }

    const groupsHtml = bangunGroupsHtmlKlasik(menuGroups, userRole, currentFile);

    let roleBadgeClass = "text-indigo-600";
    if (userRole === "Super Admin") roleBadgeClass = "text-amber-500 font-bold";

    const profileActiveClass = isProfileActive
        ? 'bg-indigo-600 border-indigo-600 text-white font-medium shadow-sm'
        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900';
    // Saat halaman Profil aktif, latar kartu ini berubah jadi indigo-600 -
    // avatar & sub-teks butuh warna kontras yang berbeda agar tidak "hilang".
    const avatarActiveClass = isProfileActive ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white';
    const profileSubTextClass = isProfileActive ? 'text-indigo-200' : 'text-gray-400';

    // Perbesar ukuran logo dan pastikan posisinya rata kiri
    let logoHtml = logoSrc
        ? `<img src="${logoSrc}" alt="PT ERAPEE" class="h-11 w-auto max-w-[160px] object-contain object-left transition-transform duration-300 hover:scale-105">`
        : `<h1 class="font-bold text-gray-900 text-base tracking-tight">PT ERAPEE</h1>`;

    // Render HTML Sidebar dengan Header Baru
    sidebarContainer.innerHTML = `
        <div id="sidebar-overlay" onclick="toggleSidebar()" class="fixed inset-0 bg-black bg-opacity-50 z-40 hidden md:hidden"></div>
        <aside id="app-sidebar" class="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transform -translate-x-full md:translate-x-0 transition-transform duration-300 ease-in-out">

            <!-- Area Header Sidebar yang Diperbarui -->
            <div class="p-5 border-b border-gray-100 flex items-start justify-between">
                <div class="flex flex-col gap-3 overflow-hidden w-full">
                    ${logoHtml}
                    <div class="inline-flex items-center self-start px-2.5 py-1 rounded-md bg-gray-50 border border-gray-100 shadow-sm">
                        <span class="text-[9px] text-gray-500 uppercase tracking-widest mr-1.5 font-bold">Role:</span>
                        <span class="text-[10px] ${roleBadgeClass} tracking-wide">${userRole}</span>
                    </div>
                </div>
                <button onclick="toggleSidebar()" class="md:hidden text-gray-400 hover:text-gray-600 -mt-1 -mr-1">✕</button>
            </div>

            <nav class="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
                ${groupsHtml}
            </nav>

            <!-- Area Sesi & Profil di Bagian Bawah -->
            <div class="p-3 border-t border-gray-100 bg-gray-50 space-y-2">
                <a href="/profile" class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all border ${profileActiveClass} hover:shadow-md">
                    <div class="w-8 h-8 rounded-full ${avatarActiveClass} flex items-center justify-center text-[11px] font-bold shrink-0">
                        ${inisialUser}
                    </div>
                    <div class="overflow-hidden">
                        <p class="font-bold truncate">${escapeHtml(namaTampilan)}</p>
                        <p class="text-[10px] ${profileSubTextClass} truncate">Lihat Profil & Pengaturan</p>
                    </div>
                </a>
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
    const namaTampilan = currentUser.nama || currentUser.email;

    if (modeTemaElegantAktif()) {
        headerContainer.innerHTML = `
            <header class="bg-white dark:bg-stone-950 border-b border-stone-200 dark:border-stone-800 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
                <div class="flex items-center gap-4">
                    <button onclick="toggleSidebar()" class="md:hidden text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 focus:outline-none">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                        </svg>
                    </button>
                    <h2 class="text-lg font-semibold text-stone-900 dark:text-stone-100">${pageTitle}</h2>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="window.toggleDarkMode()" id="btnToggleDarkMode" class="w-8 h-8 flex items-center justify-center rounded-lg border border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-900 transition" title="Ganti tema gelap/terang">
                        <span id="ikonDarkMode">🌙</span>
                    </button>
                    <a href="/profile" class="hidden sm:inline text-xs text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 font-medium transition-colors cursor-pointer">
                        ${escapeHtml(namaTampilan)}
                    </a>
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-stone-50 dark:bg-stone-900 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-800">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Online
                    </span>
                </div>
            </header>
        `;
        perbaruiIkonDarkMode();
        return;
    }

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
                    ${escapeHtml(namaTampilan)}
                </a>
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                    ● Sistem Online
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
