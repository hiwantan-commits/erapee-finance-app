// js/component.js
// Mengatur Sidebar, Header, dan Responsif Mobile secara Dinamis

document.addEventListener("DOMContentLoaded", function() {
    // 1. Daftar Menu Navigasi
    const menuItems = [
        { name: "Input Transaksi", url: "index.html", icon: "📝" },
        { name: "Manajemen Data", url: "manajemen.html", icon: "⚙️" },
        { name: "Laporan Laba Rugi", url: "laporan.html", icon: "📊" },
        { name: "Rekap Pajak", url: "pajak.html", icon: "💼" }
    ];

    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    // 2. Render Sidebar (Desktop & Mobile Drawer)
    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
        sidebarContainer.innerHTML = `
            <!-- Sidebar Desktop -->
            <aside id="sidebarDesktop" class="w-64 bg-white border-r border-gray-200 flex-shrink-0 hidden md:block h-screen fixed top-0 left-0 z-30">
                <div class="h-16 flex items-center px-6 border-b border-gray-200">
                    <span class="text-lg font-bold text-indigo-600">ERAPEE Finance</span>
                </div>
                <nav class="p-4 space-y-2">
                    ${menuItems.map(item => `
                        <a href="${item.url}" class="flex items-center px-4 py-2.5 rounded-lg font-medium ${currentPage === item.url ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}">
                            <span class="mr-3">${item.icon}</span> ${item.name}
                        </a>
                    `).join('')}
                </nav>
            </aside>

            <!-- Sidebar Mobile Overlay -->
            <div id="mobileMenu" class="fixed inset-0 bg-black bg-opacity-50 z-40 hidden md:hidden">
                <div class="w-64 bg-white h-full shadow-xl p-4 space-y-2">
                    <div class="flex justify-between items-center pb-4 border-b">
                        <span class="font-bold text-indigo-600">ERAPEE Finance</span>
                        <button onclick="toggleMobileMenu()" class="text-gray-500 font-bold text-lg">&times;</button>
                    </div>
                    ${menuItems.map(item => `
                        <a href="${item.url}" class="flex items-center px-4 py-2.5 rounded-lg font-medium ${currentPage === item.url ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}">
                            <span class="mr-3">${item.icon}</span> ${item.name}
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 3. Render Header Dinamis di Setiap Halaman (jika ada elemen #header-container)
    const headerContainer = document.getElementById('header-container');
    if (headerContainer) {
        const pageTitle = document.title.split('|')[0].trim();
        headerContainer.innerHTML = `
            <header class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-20">
                <div class="flex items-center space-x-3">
                    <button onclick="toggleMobileMenu()" class="md:hidden text-gray-600 focus:outline-none">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                        </svg>
                    </button>
                    <h1 class="text-lg md:text-xl font-semibold text-gray-800">${pageTitle}</h1>
                </div>
                <div class="flex items-center space-x-3">
                    <span class="text-sm text-gray-500 hidden sm:inline">Admin PT Erapee</span>
                    <div class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">A</div>
                </div>
            </header>
        `;
    }
});

// Fungsi untuk membuka/menutup menu di HP
function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}
