// js/component.js

document.addEventListener("DOMContentLoaded", function() {
    // 1. Definisikan daftar menu aplikasi Anda di sini
    // Tambah atau kurangi menu cukup di dalam array ini saja!
    const menuItems = [
        { name: "Input Transaksi", url: "index.html", icon: "📝" },
        { name: "Manajemen Data", url: "manajemen.html", icon: "⚙️" },
        { name: "Laporan Laba Rugi", url: "laporan.html", icon: "📊" },
        { name: "Rekap Pajak", url: "pajak.html", icon: "💼" }
    ];

    // 2. Deteksi halaman yang sedang dibuka saat ini
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    // 3. Render Sidebar secara dinamis
    const sidebarHTML = `
        <aside class="w-64 bg-white border-r border-gray-200 flex-shrink-0 hidden md:block h-screen fixed">
            <div class="h-16 flex items-center px-6 border-b border-gray-200">
                <span class="text-lg font-bold text-indigo-600">ERAPEE Finance</span>
            </div>
            <nav class="p-4 space-y-2">
                ${menuItems.map(item => {
                    const isActive = currentPage === item.url;
                    return `
                        <a href="${item.url}" class="flex items-center px-4 py-2.5 rounded-lg font-medium transition ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}">
                            <span class="mr-3">${item.icon}</span>
                            ${item.name}
                        </a>
                    `;
                }).join('')}
            </nav>
        </aside>
    `;

    // 4. Sisipkan sidebar ke elemen penampung di setiap halaman
    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
        sidebarContainer.innerHTML = sidebarHTML;
    }
});
