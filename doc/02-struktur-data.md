# Struktur Data Firestore

Seluruh data aplikasi tersimpan di satu proyek Firebase Firestore (`pt-erapee-finance`,
lihat `js/config.js`). Tidak ada skema/migrasi formal — struktur dokumen ditentukan
sepenuhnya oleh kode yang menulisnya. Bagian ini mendaftar setiap koleksi yang dipakai,
field-fieldnya, dan file mana yang membaca/menulisnya.

## Ringkasan Koleksi

| Koleksi | Bentuk dokumen | Ditulis oleh | Dibaca oleh |
|---|---|---|---|
| `jurnal_transaksi` | 1 dokumen = 1 **baris** jurnal (bukan 1 header) | `js/db.js` | `js/db.js` (dipakai hampir semua halaman via `ambilSemuaJurnalPusat`, dst) |
| `bukti_transaksi` | 1 dokumen = 1 file bukti per `id_jurnal` | `js/db.js` | `js/db.js` |
| `activity_logs` | 1 dokumen = 1 baris audit trail | `js/db.js` (otomatis) | `js/history-page.js` |
| `master_unit_usaha` | 1 dokumen = 1 unit usaha | `js/master-page.js` | Hampir semua halaman transaksi (lihat [03-halaman.md](03-halaman.md)) |
| `master_coa` | 1 dokumen = 1 akun (Chart of Accounts) | `js/master-page.js` | Halaman transaksi & Jurnal Berulang |
| `aset_tetap` | 1 dokumen = 1 aset tetap | `js/assets-page.js` | `js/assets-page.js`, `js/recurring-db.js` |
| `sewa_dibayar_dimuka` | 1 dokumen = 1 kontrak sewa | `js/sewa-page.js` | `js/sewa-page.js`, `js/recurring-db.js` |
| `draf_jurnal_berulang` | 1 dokumen = 1 draft (per sumber x periode) | `js/recurring-db.js` | `js/recurring-page.js` |
| `invoice_penjualan` | 1 dokumen = 1 invoice/kwitansi | `js/invoice-db.js` | `js/invoice-list-page.js`, `js/invoice-form-page.js` |
| `users` | 1 dokumen = 1 pengguna, **ID dokumen = email mentah** | `js/users-page.js`, `js/profile-page.js` | `js/login-page.js`, `js/component.js`, `firestore.rules` |
| `pengaturan` | 1 dokumen (`profil_perusahaan`) | inline script `profil-pajak.html` | `js/dashboard-page.js`, `js/tax-page.js` |
| `pengaturan_sistem` | 2 dokumen: `branding`, `pengaturan_tutup_buku` | `js/branding-page.js`, `js/closing-page.js` | `js/component.js`, `js/closing-period.js`, `js/login-page.js` |

## `jurnal_transaksi`

Koleksi inti aplikasi. **Setiap baris debit/kredit adalah satu dokumen Firestore
tersendiri** — bukan array di dalam satu dokumen header. Beberapa dokumen dengan
`id_jurnal` yang sama membentuk satu transaksi jurnal (minimal 2 baris: 1 debit + 1
kredit). Pengelompokan kembali menjadi objek per-jurnal dilakukan di klien oleh
`kelompokkanBarisJurnal()` (`js/db.js`), dipakai oleh semua fungsi `ambilJurnal*`.

Field per dokumen (baris):

| Field | Tipe | Keterangan |
|---|---|---|
| `id_jurnal` | string | ID transaksi (grup baris), format `JRN-YYYYMMDD-XXXXX` untuk input manual atau `JRB-<idDraf>` untuk hasil approval Jurnal Berulang |
| `tanggal` | string `YYYY-MM-DD` | Tanggal transaksi |
| `no_bukti` | string | Nomor bukti, harus unik lintas transaksi (dicegah duplikat di `simpanJurnalPusat`) |
| `keterangan` | string | Deskripsi transaksi (level header, sama untuk semua baris) |
| `status` | string | `"POSTED"` — field kosmetik, **tidak memengaruhi** apakah baris ikut dihitung di laporan (lihat catatan di [04-modul-akuntansi.md](04-modul-akuntansi.md)) |
| `unit_usaha` | string | Kode unit usaha (mis. `"CORP"`), kosong jika transaksi bersama/tidak terikat unit |
| `lawan_transaksi` | string | Nama pihak lawan transaksi (vendor/pelanggan/karyawan) |
| `sifat_transaksi` | string | `"Tunai"` atau `"Non-Tunai"` |
| `jatuh_tempo` | string `YYYY-MM-DD` atau `''` | Tanggal jatuh tempo (opsional) |
| `punya_bukti` | boolean | Menandakan ada dokumen terkait di `bukti_transaksi` |
| `kode_pajak` | string | `"NON"` jika bukan transaksi kena pajak, atau kode masa pajak lain (dipakai `js/tax-page.js`) |
| `dpp_penjualan` | number | Dasar Pengenaan Pajak untuk transaksi penjualan kena pajak |
| `kode_akun` | string | Kode akun COA baris ini |
| `nama_akun` | string | Nama akun (disalin saat input, bukan referensi live ke `master_coa`) |
| `memo_baris` | string | Catatan khusus baris ini |
| `debit` | number | Nilai debit (0 jika baris ini kredit) |
| `kredit` | number | Nilai kredit (0 jika baris ini debit) |
| `timestamp` | Firestore Timestamp | Waktu baris dibuat |
| `sumber_modul` | string (opsional) | `"PENYUSUTAN_ASET"` / `"AMORTISASI_SEWA"` — hanya ada pada jurnal hasil approval Jurnal Berulang |
| `sumber_id` | string (opsional) | ID dokumen `aset_tetap`/`sewa_dibayar_dimuka` sumber |
| `sumber_periode` | string (opsional) | Periode `"YYYY-MM"` yang diwakili jurnal ini |

> **Catatan penting**: `nama_akun` disalin ke setiap baris jurnal saat disimpan — bukan
> `JOIN` langsung ke `master_coa`. Mengubah nama akun di Master Data **tidak**
> memperbarui nama akun pada jurnal yang sudah terlanjur diposting.

Field header (`id_jurnal`, `tanggal`, `no_bukti`, dst) diulang identik di setiap baris
milik jurnal yang sama — pendekatan **denormalisasi penuh**, konsekuensi dari model
"1 dokumen = 1 baris".

## `bukti_transaksi`

ID dokumen = `id_jurnal` transaksi terkait (bukan auto-ID) — memastikan hanya satu berkas
bukti tersimpan per transaksi.

| Field | Tipe | Keterangan |
|---|---|---|
| `data` | string (base64) | Isi berkas (gambar dikompresi ke JPEG ≤700KB sebelum diunggah, atau PDF apa adanya) |
| `mimeType` | string | Mis. `"image/jpeg"`, `"application/pdf"` |
| `namaFile` | string | Nama berkas asli |
| `uploadedAt` | string ISO 8601 | Waktu unggah |

Disimpan sebagai koleksi Firestore tersendiri (bukan Firebase Storage) karena Storage
memerlukan paket berbayar (Blaze) — konsekuensinya berkas dibatasi ukuran dokumen
Firestore (1 MiB).

## `activity_logs` (Audit Trail)

Ditulis otomatis oleh `catatLogAktivitas()` di `js/db.js` setiap kali jurnal dibuat, diedit,
atau dihapus — **append-only**, `firestore.rules` menolak `update`/`delete` pada koleksi
ini secara eksplisit.

| Field | Tipe | Keterangan |
|---|---|---|
| `aksi` | string | `"CREATE / POST JURNAL"`, `"UPDATE / EDIT JURNAL"`, atau `"DELETE JURNAL"` |
| `id_jurnal` | string | ID jurnal yang terpengaruh |
| `keterangan` | string | Ringkasan (No. Bukti, Unit, Keterangan) |
| `user` | string | Email pengguna yang melakukan aksi (dari `sessionStorage`), `"System User"` jika sesi tidak ditemukan |
| `timestamp` | string ISO 8601 | Waktu kejadian |

## `master_unit_usaha`

| Field | Tipe | Keterangan |
|---|---|---|
| `kode` | string | Kode unik unit usaha (mis. `"CORP"`, `"WT-NANAS"`) — dipakai sebagai nilai tersimpan di `jurnal_transaksi.unit_usaha`, `aset_tetap.unit_usaha`, dsb |
| `nama` | string | Nama tampilan unit usaha |
| `klasifikasi` | string | Kategori bebas (mis. "Jasa", "Pertanian") |
| `status` | string (opsional) | `"Ditutup"` menyembunyikan unit dari tabel per-unit di Dashboard, meski transaksinya tetap dihitung penuh di total konsolidasi |

Seluruh dropdown/tabel unit usaha di aplikasi (7 lokasi — lihat riwayat commit "Urutkan
daftar unit usaha") diurutkan di klien berdasarkan `kode` sebelum dirender, karena urutan
dokumen Firestore tidak bisa diandalkan.

## `master_coa` (Chart of Accounts)

| Field | Tipe | Keterangan |
|---|---|---|
| `kode` | string | Kode akun, **harus berawalan digit 1–6** agar valid (`isKodeAkunValid()` di `accounting.js`): 1 Aset, 2 Liabilitas, 3 Ekuitas, 4 Pendapatan, 5 HPP, 6 Beban |
| `nama` | string | Nama akun |
| `kategori_aset_tetap` | boolean | Menandai akun ini relevan untuk transaksi pembelian aset tetap — memfilter daftar akun yang muncul di picker "Isi Otomatis" pada `aset-tetap.html` |
| `kategori_sewa` | boolean | Sama seperti di atas, tapi untuk transaksi sewa dibayar dimuka pada `sewa.html` |

## `aset_tetap`

| Field | Tipe | Keterangan |
|---|---|---|
| `nama_aset` | string | Nama/deskripsi aset |
| `tanggal_perolehan` | string `YYYY-MM-DD` | Tanggal perolehan |
| `nilai_perolehan` | number | Harga perolehan |
| `kelompok` | string | Salah satu key `KELOMPOK_PENYUSUTAN` di `accounting.js`: `"Kelompok 1"`–`"Kelompok 4"`, `"Bangunan Permanen"`, `"Bangunan Tidak Permanen"` |
| `metode` | string | `"Garis Lurus"` atau `"Saldo Menurun"` (saldo menurun tidak berlaku untuk kelompok Bangunan) |
| `unit_usaha` | string (opsional) | Kode unit usaha pemilik aset |
| `kode_akun_beban_penyusutan` | string (opsional) | Akun debit untuk jurnal penyusutan bulanan |
| `kode_akun_akumulasi_penyusutan` | string (opsional) | Akun kredit (kontra-aset) untuk jurnal penyusutan bulanan |
| `no_bukti_sumber` | string (opsional) | No. Bukti transaksi jurnal asal (jika diisi lewat fitur "Isi Otomatis dari Transaksi") |

Field akun (`kode_akun_beban_penyusutan`/`kode_akun_akumulasi_penyusutan`) bersifat
**opsional** — aset tanpa keduanya tetap tampil dengan skedul penyusutan di halaman Aset
Tetap, tapi dilewati oleh generator Jurnal Berulang (dengan pesan peringatan) karena tidak
bisa menentukan ke akun mana jurnalnya diposting.

## `sewa_dibayar_dimuka`

| Field | Tipe | Keterangan |
|---|---|---|
| `nama_sewa` | string | Nama/deskripsi kontrak sewa |
| `tanggal_mulai` | string `YYYY-MM-DD` | Awal masa sewa |
| `tanggal_selesai` | string `YYYY-MM-DD` | Akhir masa sewa |
| `nilai_total` | number | Total nilai kontrak sewa |
| `unit_usaha` | string (opsional) | Kode unit usaha penyewa |
| `kode_akun_prabayar` | string (opsional) | Akun kredit (aset prabayar) untuk jurnal amortisasi bulanan |
| `kode_akun_beban_sewa` | string (opsional) | Akun debit (beban) untuk jurnal amortisasi bulanan |
| `no_bukti_sumber` | string (opsional) | No. Bukti transaksi jurnal asal (fitur "Isi Otomatis") |
| `keterangan` | string (opsional) | Catatan bebas |

Sewa tidak mengenal metode "Saldo Menurun" — amortisasi selalu garis lurus (dibagi rata
sepanjang `tanggal_mulai` s/d `tanggal_selesai`).

## `draf_jurnal_berulang`

Satu dokumen per kombinasi (sumber × periode bulanan). **ID dokumen deterministik**:
`${sumber_modul}_${sumber_id}_${periode}`, mis. `PENYUSUTAN_ASET_ab12cd34_2026-03` — kunci
mekanisme anti-duplikat: generate ulang berarti `setDoc` (upsert), bukan `addDoc` baru.

| Field | Tipe | Keterangan |
|---|---|---|
| `sumber_modul` | string | `"PENYUSUTAN_ASET"` atau `"AMORTISASI_SEWA"` |
| `sumber_id` | string | ID dokumen `aset_tetap`/`sewa_dibayar_dimuka` asal |
| `sumber_nama` | string | Nama aset/sewa (disalin untuk tampilan) |
| `periode` | string `YYYY-MM` | Bulan yang diwakili draft ini |
| `tanggal` | string `YYYY-MM-DD` | Tanggal akhir bulan `periode` — jadi tanggal jurnal saat di-approve |
| `unit_usaha` | string | Disalin dari aset/sewa sumber |
| `no_bukti_sumber` | string | Disalin dari aset/sewa sumber (memengaruhi format No. Bukti hasil approval) |
| `bulan_ke` | number | Bulan ke-berapa sejak `tanggal_perolehan`/`tanggal_mulai` (dipakai 3 digit akhir No. Bukti) |
| `nominal` | number | Nominal debit=kredit untuk bulan ini |
| `rows` | array | 2 baris jurnal siap pakai `{kode_akun, nama_akun, memo_baris, debit, kredit}` |
| `keterangan` | string | Deskripsi jurnal yang akan diposting |
| `status` | string | `"PENDING"` \| `"APPROVED"` \| `"REJECTED"` |
| `is_backfill` | boolean | `true` jika `periode` lebih lama dari bulan berjalan saat draft dibuat |
| `id_jurnal_hasil` | string atau `null` | `id_jurnal` di `jurnal_transaksi` setelah di-approve |
| `approved_by` | string atau `null` | Email pengguna yang menyetujui/menolak |
| `approved_at` | string ISO 8601 atau `null` | Waktu keputusan |
| `dibuat_pada` | string ISO 8601 | Waktu draft pertama kali dibuat/diperbarui |

Regenerasi (`generateDanUpsertDraf()`) hanya menimpa dokumen berstatus `PENDING` —
dokumen `APPROVED`/`REJECTED` tidak pernah disentuh ulang, kecuali dikembalikan ke
`PENDING` secara eksplisit lewat pembatalan persetujuan (`batalkanPersetujuanDraf()`).

Lihat [04-modul-akuntansi.md](04-modul-akuntansi.md) untuk alur lengkap generate →
approve/reject → posting.

## `invoice_penjualan`

Modul penjualan **berdiri sendiri** — tidak pernah membuat/mengubah dokumen di
`jurnal_transaksi`. Invoice adalah dokumen administratif (cetak Invoice + Kwitansi),
bukan pencatatan akuntansi.

| Field | Tipe | Keterangan |
|---|---|---|
| `no_invoice` | string | Format `FT/NNN/MM/YYYY` |
| `no_kwitansi` | string | Format `KT/NNN/MM/YYYY` — berbagi urutan `NNN` yang sama dengan `no_invoice` per bulan |
| `tanggal` | string `YYYY-MM-DD` | Tanggal invoice |
| `nama_pelanggan` | string | Nama pelanggan |
| `alamat_pelanggan` | string | Alamat pelanggan |
| `items` | array | Baris item `{nama_barang, satuan, kuantum, harga_satuan, jumlah}` |
| `sub_total` | number | Jumlah sebelum diskon/pajak |
| `discount` | number | Nilai diskon |
| `persen_ppn` | number | Persentase PPN yang dipakai |
| `ppn` | number | Nilai PPN |
| `grand_total` | number | Total akhir |

## `users`

**ID dokumen = alamat email pengguna mentah** (mis. `nama@contoh.com`), bukan UID Firebase
Auth — pola ini dipakai `login-page.js` untuk mencari role berdasarkan email yang baru
login.

| Field | Tipe | Keterangan |
|---|---|---|
| `email` | string | Sama dengan ID dokumen |
| `role` | string | `"Super Admin"` \| `"Admin"` \| `"Akuntan"` \| `"Auditor"` |
| `nama` | string (opsional) | Nama tampilan |

Bootstrap Super Admin pertama: email `hi.wantan@gmail.com` dikenali sebagai Super Admin
secara hardcode di `firestore.rules` (`rolePenggunaSaatIni()`) dan `login-page.js`,
bahkan tanpa dokumen `users` — supaya founder bisa login pertama kali sebelum ada dokumen
pengguna apa pun. Disarankan tetap membuat dokumen `users/hi.wantan@gmail.com` secara
manual agar tidak bergantung pada pengecualian ini.

## `pengaturan` (dokumen `profil_perusahaan`)

| Field | Tipe | Keterangan |
|---|---|---|
| `nomor_akta` | string | Nomor akta pendirian |
| `tanggal_akta` | string `YYYY-MM-DD` | Tanggal akta |
| `npwp_perseroan` | string | NPWP perusahaan |
| `status_pkp` | string | `"PKP Terdaftar"` atau `"Belum PKP"` |

Dikelola lewat `<script type="module">` inline di `profil-pajak.html` (tidak ada file
controller terpisah untuk halaman ini). Dibaca ulang oleh `dashboard-page.js` (badge
status legal) dan berpengaruh tidak langsung pada `js/tax-page.js`.

## `pengaturan_sistem`

Koleksi dengan dua dokumen tetap:

**Dokumen `branding`** (dikelola `js/branding-page.js`):

| Field | Tipe | Keterangan |
|---|---|---|
| `logoUrl` | string (data URI base64) | Logo aplikasi, dipakai `component.js` & `login-page.js` |
| `faviconUrl` | string (data URI base64) | Favicon, dipasang dinamis ke `<head>` |

**Dokumen `pengaturan_tutup_buku`** (dikelola `js/closing-page.js` lewat
`js/closing-period.js`):

| Field | Tipe | Keterangan |
|---|---|---|
| `bulanTerkunci` | string `YYYY-MM` | Bulan terakhir yang tutup buku; semua transaksi bertanggal ≤ bulan ini terkunci dari edit/hapus/input baru |
| `updatedAt` | string ISO 8601 | Waktu terakhir diubah |

## Diagram Relasi (Konseptual)

Firestore tidak punya foreign key sungguhan — relasi berikut murni konvensi kode (nilai
string yang dicocokkan manual di klien):

```
master_unit_usaha.kode  <──┬── jurnal_transaksi.unit_usaha
                            ├── aset_tetap.unit_usaha
                            └── sewa_dibayar_dimuka.unit_usaha

master_coa.kode  <──┬── jurnal_transaksi.kode_akun
                     ├── aset_tetap.kode_akun_beban_penyusutan / kode_akun_akumulasi_penyusutan
                     └── sewa_dibayar_dimuka.kode_akun_prabayar / kode_akun_beban_sewa

aset_tetap.id / sewa_dibayar_dimuka.id  <── draf_jurnal_berulang.sumber_id
draf_jurnal_berulang (saat APPROVED)  ──> jurnal_transaksi (via id_jurnal_hasil / sumber_modul+sumber_id+sumber_periode)

jurnal_transaksi.id_jurnal  <── bukti_transaksi (ID dokumen)
                             <── activity_logs.id_jurnal
```
