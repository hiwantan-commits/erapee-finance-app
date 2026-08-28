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

// Ikon garis (line icon) bergaya Claude.ai - dipetakan berdasarkan href menu,
// menggantikan emoji khusus untuk mode elegant. menuGroups (data emoji untuk
// mode klasik) sengaja tidak diubah sama sekali.
const PETA_IKON_ELEGANT = {
    'index': '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>',
    'master-data': '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    'input-jurnal': '<path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5"/><path d="M12 12v6M9 15h6"/>',
    'manajemen': '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    'invoice': '<path d="M6 3h12a1 1 0 0 1 1 1v17l-3-2-2 2-2-2-2 2-2-2-3 2V4a1 1 0 0 1 1-1Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    'profil-pajak': '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16"/><path d="M14 9h5a1 1 0 0 1 1 1v11"/><path d="M8 8h1M8 12h1M8 16h1M11 8h1M11 12h1M11 16h1"/>',
    'aset-tetap': '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
    'pajak': '<path d="M3 21h18M4 21V10M20 21V10M2 10l10-6 10 6M6 10v6M10 10v6M14 10v6M18 10v6"/>',
    'rekonsiliasi': '<path d="M12 3v18M5 7l-3 6a3 3 0 0 0 6 0Zm14 0-3 6a3 3 0 0 0 6 0ZM5 7h14M9 3h6"/>',
    'laporan': '<path d="M4 20V10M10 20V4M16 20v-7M4 20h16"/>',
    'analisa-bisnis': '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.5.4.9 1 1 1.7L9.6 17h4.8l.2-1.5c.1-.7.5-1.3 1-1.7A6 6 0 0 0 12 3Z"/>',
    'histori': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    'branding': '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.5-1.9-.1-.4-.4-.8-.4-1.2 0-.8.7-1.4 1.5-1.4H16a4 4 0 0 0 4-4c0-5-3.6-9.5-8-9.5Z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="10.5" cy="7" r="1"/><circle cx="15" cy="8" r="1"/>',
    'users': '<circle cx="9" cy="8" r="3"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 12.5c2.2 0 4 1.9 4 4.3"/>',
    'closing': '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
};

function ikonElegantHtml(href) {
    const isiSvg = PETA_IKON_ELEGANT[href] || '<circle cx="12" cy="12" r="9"/>';
    return `<svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${isiSvg}</svg>`;
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

            // Referensi screenshot Claude.ai asli: item aktif memakai highlight
            // abu-abu netral (bukan warna aksen) dengan teks tetap gelap/terang
            // biasa - aksen terracotta hanya dipakai sebagai sentuhan kecil.
            const isActive = currentFile === item.href || currentFile === item.href + '.html';
            const activeClass = isActive
                ? 'bg-stone-200/70 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium'
                : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-stone-100';

            itemsHtml += `
                <a href="/${item.href}" class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${activeClass} my-0.5">
                    ${ikonElegantHtml(item.href)}
                    <span>${item.name}</span>
                </a>
            `;
        });

        if (!hasVisibleItem) return;

        groupsHtml += `
            <div class="mb-3">
                <p class="px-3 text-[10px] font-medium text-stone-400 dark:text-stone-500 mb-1">${group.groupName}</p>
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
                { name: 'Buku Besar & Jurnal', href: 'manajemen', icon: '📊', roles: ['Super Admin', 'Admin', 'Akuntan', 'Auditor'] },
                { name: 'Invoice & Kwitansi', href: 'invoice', icon: '🧾', roles: ['Super Admin', 'Admin', 'Akuntan', 'Auditor'] }
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

        const roleBadgeClass = userRole === "Super Admin" ? "text-amber-600 dark:text-amber-400" : "text-stone-500 dark:text-stone-400";
        // Referensi screenshot Claude.ai: baris profil di bawah sidebar polos
        // (tanpa kartu berbingkai), hanya di-highlight lembut saat hover/aktif.
        const profileRowActiveClass = isProfileActive
            ? 'bg-stone-100 dark:bg-stone-800/60'
            : 'hover:bg-stone-100 dark:hover:bg-stone-800/60';
        const logoHtml = logoSrc
            ? `<img src="${logoSrc}" alt="PT ERAPEE" class="h-9 w-auto max-w-[150px] object-contain object-left">`
            : `<h1 class="font-serif-elegant text-stone-900 dark:text-stone-100 text-xl tracking-tight">PT ERAPEE</h1>`;

        sidebarContainer.innerHTML = `
            <div id="sidebar-overlay" onclick="toggleSidebar()" class="fixed inset-0 bg-black/40 z-40 hidden md:hidden"></div>
            <aside id="app-sidebar" class="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-stone-950 border-r border-stone-200 dark:border-stone-800 flex flex-col transform -translate-x-full md:translate-x-0 transition-transform duration-300 ease-in-out">

                <div class="p-5 flex items-start justify-between">
                    <div class="flex flex-col gap-1.5 overflow-hidden w-full">
                        ${logoHtml}
                        <span class="text-[11px] ${roleBadgeClass}">${userRole}</span>
                    </div>
                    <button onclick="toggleSidebar()" class="md:hidden text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 -mt-1 -mr-1">✕</button>
                </div>

                <nav class="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
                    ${groupsHtml}
                </nav>

                <div class="p-3 border-t border-stone-100 dark:border-stone-800 relative">
                    <button onclick="window.toggleDropdownElegant(event, 'menuAkunSidebar')" class="w-full flex items-center gap-2.5 pl-2 pr-3 py-2 rounded-lg text-xs transition-all ${profileRowActiveClass}">
                        <div class="w-7 h-7 rounded-full bg-[#D97757] text-white flex items-center justify-center text-[10px] font-medium shrink-0">
                            ${inisialUser}
                        </div>
                        <p class="font-medium truncate text-stone-900 dark:text-stone-100 text-xs flex-1 text-left">${escapeHtml(namaTampilan)}</p>
                        <svg class="w-3.5 h-3.5 text-stone-400 dark:text-stone-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                    <div id="menuAkunSidebar" class="hidden absolute bottom-full left-3 right-3 mb-2 z-50" data-dropdown-elegant>
                        <div class="dropdown-elegant-panel">
                            <a href="/profile" class="dropdown-elegant-item">
                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                                Lihat Profil
                            </a>
                            <div class="dropdown-elegant-divider"></div>
                            <button type="button" onclick="prosesLogout()" class="dropdown-elegant-item dropdown-elegant-item-danger">
                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>
                                Keluar Sistem
                            </button>
                        </div>
                    </div>
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
            <div class="sticky top-0 z-30">
                <div class="absolute inset-x-0 top-0 -bottom-6 bg-stone-50/85 dark:bg-stone-950/85 header-elegant-blur pointer-events-none"></div>
                <header class="relative px-6 py-4 flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <button onclick="toggleSidebar()" class="md:hidden text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 focus:outline-none">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                            </svg>
                        </button>
                        <h2 class="text-sm font-semibold text-stone-800 dark:text-stone-100">${pageTitle}</h2>
                    </div>
                    <div class="flex items-center gap-4">
                        <button onclick="window.toggleDarkMode()" id="btnToggleDarkMode" class="w-8 h-8 flex items-center justify-center rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800/60 transition" title="Ganti tema gelap/terang">
                            <span id="ikonDarkMode">🌙</span>
                        </button>
                        <div class="hidden sm:flex items-center gap-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Online
                        </div>
                        <a href="/profile" class="text-xs text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-stone-100 font-semibold transition-colors cursor-pointer">
                            ${escapeHtml(namaTampilan)}
                        </a>
                    </div>
                </header>
            </div>
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

// ==================== Util Dropdown / Menu 3-Titik (reusable) ====================
// Dipakai oleh halaman manapun yang menyertakan markup:
//   <button onclick="window.toggleDropdownElegant(event, 'idPanel')">...</button>
//   <div id="idPanel" class="hidden absolute ..." data-dropdown-elegant>
//       <div class="dropdown-elegant-panel">...</div>
//   </div>
// Tidak spesifik ke satu halaman - aman didefinisikan secara global karena
// hanya aktif jika markup di atas benar-benar dipakai.
window.toggleDropdownElegant = function(event, panelId) {
    event.stopPropagation();
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const sedangTerbuka = !panel.classList.contains('hidden');
    document.querySelectorAll('[data-dropdown-elegant]').forEach(p => p.classList.add('hidden'));
    if (!sedangTerbuka) panel.classList.remove('hidden');
};

document.addEventListener('click', function() {
    document.querySelectorAll('[data-dropdown-elegant]').forEach(p => p.classList.add('hidden'));
});
