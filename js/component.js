// Data Komponen Sidebar
const sidebarHTML = `
    <!-- Sidebar Mobile Toggle -->
    <div class="md:hidden flex justify-between items-center bg-indigo-900 text-white p-4 z-50 fixed top-0 w-full shadow-md">
        <div class="font-bold text-lg tracking-wider">ERAPEE <span class="font-light">FINANCE</span></div>
        <button id="mobile-menu-btn" class="focus:outline-none p-1 bg-indigo-800 rounded-lg">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
        </button>
    </div>

    <!-- Sidebar Core -->
    <aside id="sidebar" class="bg-indigo-900 text-indigo-100 w-64 h-screen fixed inset-y-0 left-0 transform -translate-x-full md:translate-x-0 transition-transform duration-300 ease-in-out z-40 overflow-y-auto flex flex-col pt-16 md:pt-0">
        <!-- Logo Area -->
        <div class="p-6 border-b border-indigo-800 hidden md:block mt-2">
            <h1 class="text-2xl font-bold tracking-wider text-white">ERAPEE <span class="font-light text-indigo-300">FIN</span></h1>
            <p class="text-xs text-indigo-400 mt-1">Sistem Keuangan & Pajak</p>
        </div>
        
        <!-- Navigation -->
        <nav class="p-4 space-y-1.5 flex-1 mt-4">
            <p class="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-3 px-3">Dashboard Utama</p>
            <a href="index" class="nav-item flex items-center px-4 py-3 rounded-xl hover:bg-indigo-800 hover:text-white transition duration-200">
                <span class="mr-3 text-lg opacity-80">📊</span>
                <span class="text-sm font-medium">Dashboard Eksekutif</span>
            </a>
            
            <p class="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-3 px-3 mt-6">Siklus Akuntansi</p>
            <a href="input-jurnal" class="nav-item flex items-center px-4 py-3 rounded-xl hover:bg-indigo-800 hover:text-white transition duration-200">
                <span class="mr-3 text-lg opacity-80">📝</span>
                <span class="text-sm font-medium">Input Jurnal (Double-Entry)</span>
            </a>
            <a href="manajemen" class="nav-item flex items-center px-4 py-3 rounded-xl hover:bg-indigo-800 hover:text-white transition duration-200">
                <span class="mr-3 text-lg opacity-80">📚</span>
                <span class="text-sm font-medium">Manajemen & Buku Besar</span>
            </a>

            <p class="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-3 px-3 mt-6">Pelaporan & Perpajakan</p>
            <a href="laporan" class="nav-item flex items-center px-4 py-3 rounded-xl hover:bg-indigo-800 hover:text-white transition duration-200">
                <span class="mr-3 text-lg opacity-80">📈</span>
                <span class="text-sm font-medium">Laporan Keuangan</span>
            </a>
            <a href="rekonsiliasi" class="nav-item flex items-center px-4 py-3 rounded-xl hover:bg-indigo-800 hover:text-white transition duration-200">
                <span class="mr-3 text-lg opacity-80">⚖️</span>
                <span class="text-sm font-medium">Rekonsiliasi Fiskal & SPT</span>
            </a>

            <p class="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-3 px-3 mt-6">Data Induk (Master)</p>
            <a href="master-data" class="nav-item flex items-center px-4 py-3 rounded-xl hover:bg-indigo-800 hover:text-white transition duration-200">
                <span class="mr-3 text-lg opacity-80">🗂️</span>
                <span class="text-sm font-medium">COA & Unit Usaha</span>
            </a>
            <a href="profil-pajak" class="nav-item flex items-center px-4 py-3 rounded-xl hover:bg-indigo-800 hover:text-white transition duration-200">
                <span class="mr-3 text-lg opacity-80">🏢</span>
                <span class="text-sm font-medium">Profil PT & Legalitas</span>
            </a>
        </nav>

        <!-- User Profile Area -->
        <div class="p-4 border-t border-indigo-800 mt-auto bg-indigo-950/30 m-4 rounded-2xl mb-8">
            <div class="flex items-center">
                <div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-inner">
                    PT
                </div>
                <div class="ml-3">
                    <p class="text-xs font-bold text-white leading-tight">Admin Keuangan</p>
                    <p class="text-[10px] text-indigo-400">Tahun Buku 2026</p>
                </div>
            </div>
        </div>
    </aside>

    <!-- Overlay untuk mobile -->
    <div id="sidebar-overlay" class="fixed inset-0 bg-gray-900 bg-opacity-50 z-30 hidden md:hidden transition-opacity"></div>
`;

// Fungsi inisialisasi Sidebar
function initSidebar() {
    const container = document.getElementById('sidebar-container');
    if (container) {
        container.innerHTML = sidebarHTML;

        // Logic Active Menu
        const path = window.location.pathname;
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            const href = item.getAttribute('href');
            // Cek jika path berakhiran nama href (menghindari masalah .html atau clean URL)
            if (path.endsWith(href) || path.endsWith(href + '.html') || (path === '/' && href === 'index')) {
                item.classList.add('bg-indigo-700', 'text-white', 'shadow-inner', 'font-bold');
                item.classList.remove('hover:bg-indigo-800');
            }
        });

        // Mobile Menu Logic
        const btn = document.getElementById('mobile-menu-btn');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        if(btn && sidebar && overlay) {
            btn.addEventListener('click', () => {
                sidebar.classList.toggle('-translate-x-full');
                overlay.classList.toggle('hidden');
            });

            overlay.addEventListener('click', () => {
                sidebar.classList.add('-translate-x-full');
                overlay.classList.add('hidden');
            });
        }
    }
}

// Inisialisasi komponen saat halaman selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
});
