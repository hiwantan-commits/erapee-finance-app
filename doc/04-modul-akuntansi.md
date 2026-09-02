# Modul Akuntansi & Logika Bisnis

Seluruh logika akuntansi murni (tanpa akses Firestore) terpusat di satu file:
`js/accounting.js`. File ini diimpor oleh hampir semua halaman laporan
(`reports-page.js`, `fiscal-page.js`, `tax-page.js`, `business-analytics-page.js`,
`dashboard-page.js`) dan oleh mesin Jurnal Berulang (`recurring-db.js`).

## Klasifikasi Akun

```js
klasifikasikanAkun(kodeAkun)
```

Klasifikasi akun murni berdasarkan **digit pertama kode akun** — konvensi yang harus
dipatuhi setiap kali mengisi Master COA:

| Awalan kode | Kategori |
|---|---|
| `1` | ASET |
| `2` | LIABILITAS |
| `3` | EKUITAS |
| `4` | PENDAPATAN |
| `5` | HPP (Harga Pokok Penjualan) |
| `6` | BEBAN |
| lainnya | LAINNYA (diabaikan sepenuhnya oleh Neraca & Laba Rugi) |

Sub-klasifikasi tambahan dipakai khusus struktur laporan cetak berjenjang:

- Aset: dua digit `15`–`19` → **ASET TIDAK-LANCAR**, selain itu → **ASET LANCAR**.
- Liabilitas: dua digit `25`–`29` → **KEWAJIBAN JANGKA PANJANG**, selain itu →
  **KEWAJIBAN LANCAR**.

`isKodeAkunValid(kodeAkun)` menolak kode yang tidak berawalan digit 1–6 saat disimpan di
Master Data COA.

## Tidak Ada Jurnal Penutup Periode

Aplikasi ini **tidak memiliki mekanisme jurnal penutup (closing entry)** akhir
tahun/periode. Konsekuensinya:

- Saldo Pendapatan dan Beban **diakumulasikan sejak transaksi pertama** aplikasi
  dipakai, bukan direset ke nol setiap awal tahun buku.
- Pada Neraca, akumulasi ini muncul sebagai satu baris **"Laba (Rugi) Ditahan/Berjalan"**
  di sisi Ekuitas (`labaKumulatif` di `kalkulasiNeraca()`).
- Field `status` (`"POSTED"`) pada setiap baris jurnal **bersifat kosmetik** — baris
  dengan status apa pun tetap dihitung penuh oleh `kalkulasiNeraca()` maupun
  `kalkulasiLaporanKeuangan()`. Ini dicatat secara eksplisit di komentar
  `js/recurring-db.js` sebagai alasan mengapa draft Jurnal Berulang **tidak** disimpan
  langsung ke `jurnal_transaksi` dengan status "DRAFT" — kalau begitu draft akan ikut
  langsung terhitung di laporan sebelum sungguh-sungguh disetujui.

## Neraca (Laporan Posisi Keuangan)

```js
kalkulasiNeraca(semuaJurnal)
```

Menjumlahkan saldo tiap akun dari **seluruh** baris jurnal (tanpa filter periode — Neraca
memang harus kumulatif sejak awal):

- Saldo **Aset** = debit − kredit.
- Saldo **Liabilitas** dan **Ekuitas** = kredit − debit.
- **Laba Kumulatif** = total Pendapatan (kredit − debit) − total Beban+HPP (debit −
  kredit).
- **Total Ekuitas** = Ekuitas dasar (dari akun kode `3`) + Laba Kumulatif.
- **Cek keseimbangan**: `Aset ≈ Liabilitas + Ekuitas` (dibulatkan, untuk menghindari
  selisih floating-point).

Hasilnya juga memuat peta saldo per akun (`petaAset`, `petaLiabilitas`, `petaEkuitas`,
masing-masing diurutkan berdasarkan kode) untuk ditampilkan di tabel.

## Laba Rugi

```js
kalkulasiLaporanKeuangan(semuaJurnal)
```

Berbeda dari Neraca, fungsi ini menerima jurnal yang **sudah difilter** ke periode
tertentu (filter dilakukan di controller pemanggil, bukan di fungsi ini) — karena Laba
Rugi memang laporan per-periode, bukan kumulatif. Menghasilkan `totalPendapatan`,
`totalBeban`, `labaBersih`, dan peta saldo per akun (`petaAkun`).

## Arus Kas (Metode Langsung, Disederhanakan)

```js
kalkulasiArusKas(semuaJurnal)
```

Setiap jurnal yang menyentuh akun kas/bank (kode berawalan `"11"`) diklasifikasikan
berdasarkan akun **lawannya** dalam jurnal yang sama:

| Kondisi akun lawan | Kategori |
|---|---|
| Kode berawalan `"15"` atau `"16"` (Aset Tetap) | **Investasi** |
| Kategori Ekuitas, atau nama akun mengandung "pinjaman" / "kredit bank" / "obligasi" | **Pendanaan** |
| Selain itu (Pendapatan, Beban, HPP, Liabilitas operasional) | **Operasi** |

Ini adalah **estimasi berbasis kode akun**, bukan pencatatan arus kas langsung per
kategori — akurasinya bergantung penuh pada konsistensi penomoran Master COA.

`susunStrukturArusKas()` membungkus hasil di atas menjadi format berjenjang untuk cetak,
menambahkan **Kas Awal Periode** (dihitung dari total mutasi kas sebelum tanggal mulai
periode terpilih) dan **Kas Akhir Periode**.

## Perubahan Modal

```js
susunStrukturPerubahanModal(semuaJurnal, jurnalDalamPeriode, masaTerpilih, labelPeriode)
```

Dihitung murni dari data jurnal yang sudah ada — tidak ada koleksi/akun baru. Struktur:
Modal Awal + Modal Tambahan (transaksi Ekuitas dalam periode) = Modal Akhir Disetor;
Laba Ditahan Awal + Laba Tahun Berjalan − Dividen = Laba Ditahan Akhir.

> **Keterbatasan yang disengaja**: aplikasi belum punya mekanisme mencatat pembagian
> Dividen secara terpisah dari transaksi ekuitas biasa — baris "Dividen" pada laporan ini
> **selalu bernilai 0** (bukan tebakan/estimasi), sampai fitur pencatatan dividen khusus
> ditambahkan.

## Struktur Laporan Berjenjang (Khusus Cetak)

`susunStrukturNeraca()`, `susunStrukturLabaRugi()`, `susunStrukturPerubahanModal()`, dan
`susunStrukturArusKas()` membungkus hasil kalkulasi mentah di atas menjadi format
berjenjang bergaya software akuntansi konvensional (**Kelas > Sub-Kelas > Akun**), dengan
penomoran sintetis (mis. `1.1.00`) — murni tampilan cetak, tidak mengklaim sama dengan
kode akun asli. Fungsi-fungsi ini **murni aditif**: tidak mengubah `kalkulasiNeraca()`
atau `kalkulasiLaporanKeuangan()` yang sudah dipakai di tempat lain.

> **Keterbatasan**: satu baris Master COA di aplikasi ini adalah akun rincian (leaf)
> tanpa sub-akun — kedalaman berjenjang otomatis maksimal 3 tingkat, tidak seperti
> software yang kode akunnya sendiri sudah berjenjang (mis. `1.1.01.01`).

---

## Penyusutan Aset Tetap & Amortisasi Sewa

### Kelompok Penyusutan Fiskal

```js
export const KELOMPOK_PENYUSUTAN = {
  "Kelompok 1": { tahun: 4, garisLurus: 0.25, saldoMenurun: 0.50 },
  "Kelompok 2": { tahun: 8, garisLurus: 0.125, saldoMenurun: 0.25 },
  "Kelompok 3": { tahun: 16, garisLurus: 0.0625, saldoMenurun: 0.125 },
  "Kelompok 4": { tahun: 20, garisLurus: 0.05, saldoMenurun: 0.10 },
  "Bangunan Permanen": { tahun: 20, garisLurus: 0.05, saldoMenurun: null },
  "Bangunan Tidak Permanen": { tahun: 10, garisLurus: 0.10, saldoMenurun: null }
};
```

Sesuai tarif penyusutan fiskal UU PPh Pasal 11/PMK Indonesia. `saldoMenurun: null` untuk
kedua kelompok Bangunan karena UU PPh hanya mengizinkan metode garis lurus untuk
bangunan.

### Angka Kumulatif vs. Angka Bulanan

Ada dua pasang fungsi dengan tujuan berbeda:

| Fungsi | Dipakai untuk | Hasil |
|---|---|---|
| `hitungPenyusutanAset(aset, tanggalReferensi)` | Tampilan skedul di halaman Aset Tetap | Nilai **kumulatif** (akumulasi & nilai buku) sejak tanggal perolehan s/d tanggal referensi |
| `hitungAmortisasiSewa(sewa, tanggalReferensi)` | Tampilan skedul di halaman Sewa | Sama, tapi berbasis fraksi hari (bukan tahun), karena sewa tidak punya tarif tahunan tetap |
| `hitungPenyusutanBulanan(aset, tahun, bulan)` | Generator draft Jurnal Berulang | Nominal **satu bulan tertentu** saja |
| `hitungAmortisasiSewaBulanan(sewa, tahun, bulan)` | Generator draft Jurnal Berulang | Sama, untuk sewa |

**Metode Garis Lurus** (aset maupun sewa): nominal bulanan dibuat **flat** — nilai
dibagi rata jumlah bulan umur ekonomis/masa sewa — bukan diturunkan dari pecahan hari.
Ini disengaja: bulan Februari yang lebih pendek tidak boleh menghasilkan beban lebih
kecil. Bulan **terakhir** dibulatkan ke sisa yang pas agar total presisi sama dengan
nilai perolehan/nilai total (menghindari selisih pembulatan floating-point).

**Metode Saldo Menurun** (khusus aset, tidak berlaku untuk sewa): nominal bulanan =
selisih akumulasi penyusutan di awal bulan vs awal bulan berikutnya (dua titik waktu
tepat di batas bulan, dihitung ulang lewat `hitungPenyusutanAset`) — sehingga total semua
bulan otomatis rekonsiliasi dengan angka yang sudah tampil di halaman Aset Tetap tanpa
rumus terpisah yang bisa saling menyimpang.

### Enumerasi Periode Belum Diproses

```js
enumerasiPeriodeBelumDiproses(tanggalMulaiStr, tanggalAkhirStr, tanggalReferensi, periodeSudahAda)
```

Fungsi murni (tanpa akses Firestore) yang mengembalikan daftar string `"YYYY-MM"` dari
bulan mulai sampai `min(tanggalAkhir, tanggalReferensi)`, mengecualikan periode yang
sudah ada di `periodeSudahAda` (sebuah `Set`). `tanggalAkhirStr` boleh `null` untuk aset
tetap yang belum ada tanggal jatuh temponya sendiri (dibatasi oleh umur kelompok
penyusutan di sisi pemanggil).

---

## Mesin Jurnal Berulang (End-to-End)

Diimplementasikan di `js/recurring-db.js`, dipakai oleh `jurnal-berulang.html` /
`js/recurring-page.js`. Tujuan: memposting beban penyusutan aset & amortisasi sewa
sebagai jurnal sungguhan setiap bulan **secara otomatis**, tapi tetap lewat proses
persetujuan manusia (bukan langsung terposting tanpa pengawasan).

### 1. Generate (`generateDanUpsertDraf()`)

1. Baca `master_coa`, seluruh `aset_tetap`, seluruh `sewa_dibayar_dimuka`, dan seluruh
   `draf_jurnal_berulang` yang sudah ada.
2. Untuk setiap aset/sewa yang **akunnya sudah lengkap** (kode akun beban & akun
   lawannya terisi) — yang belum lengkap dilewati dengan pesan peringatan.
3. Hitung rentang bulan dari tanggal mulai s/d hari ini (dibatasi umur kelompok
   penyusutan untuk aset, atau `tanggal_selesai` untuk sewa) via
   `enumerasiPeriodeBelumDiproses()`.
4. Lewati bulan yang draftnya sudah berstatus `APPROVED`/`REJECTED` (hanya draft
   `PENDING` yang boleh ditimpa ulang).
5. `setDoc` (upsert, via `writeBatch` untuk atomisitas) draft `PENDING` baru untuk setiap
   bulan yang tersisa. ID dokumen deterministik (`${sumber_modul}_${sumber_id}_${periode}`)
   membuat pemanggilan fungsi ini berkali-kali **aman** — draft `PENDING` lama ditimpa
   ulang (nominalnya bisa berubah kalau data aset/sewa diedit), sedangkan draft yang
   sudah diputuskan (`APPROVED`/`REJECTED`) tidak pernah disentuh lagi.
6. Kembalikan ringkasan `{ dibuat, diperbarui, warnings }`.

### 2. Approval (`setujuiDraf(idDraf, draf)`)

1. Susun `headerData` jurnal: `id_jurnal = "JRB-" + idDraf` (deterministik & idempoten
   terhadap draft yang sama); `no_bukti` mengikuti dua format:
   - Jika draft berasal dari transaksi terdaftar (fitur "Isi Otomatis dari Transaksi"):
     `{No. Bukti transaksi sumber}/{bulan_ke, 3 digit}` — memudahkan penelusuran balik
     ke transaksi asal.
   - Jika tidak (input manual): `AUTO/{PNY|SWA}/{periode}/{8 karakter awal sumber_id}`.
   - `sifat_transaksi: "Non-Tunai"`, plus tag `sumber_modul`/`sumber_id`/`sumber_periode`
     yang otomatis tersebar ke setiap baris jurnal (sama seperti `unit_usaha`) — lapisan
     anti-duplikat kedua yang independen dari koleksi draft.
2. Panggil `simpanJurnalPusat(headerData, draf.rows, null, null, { lewatiKuncPeriode:
   true })` — **satu-satunya tempat di aplikasi** yang mengirim `opsi.lewatiKuncPeriode`,
   dengan sengaja menembus kunci Tutup Buku demi akurasi historis (backfill).
3. Jika sukses, `updateDoc` draft menjadi `status: APPROVED`, catat `id_jurnal_hasil`,
   `approved_by` (dari `sessionStorage`), `approved_at`.

### 3. Penolakan (`tolakDraf(idDraf)`)

Menandai draft `REJECTED` + `approved_by`/`approved_at` — tidak ada jurnal yang dibuat.

### 4. Pembatalan Persetujuan (`batalkanPersetujuanDraf(idDraf, draf)`)

Kebalikan dari approval, dengan **arah bypass yang sengaja dibalik**:

- Menghapus jurnal yang sudah terposting via `hapusJurnalPusat()` biasa — **TANPA**
  `lewatiKuncPeriode`, sehingga **tunduk** pada kunci periode normal (pembatalan pada
  periode yang sudah tutup buku akan ditolak). Ini disengaja: approval boleh menembus
  kunci untuk mengisi bolong data historis, tapi pembatalan justru harus melindungi
  periode yang sudah difinalisasi, bukan membukanya kembali.
- Draft dikembalikan ke status `PENDING` (bukan dihapus) — supaya ikut terhitung ulang
  dan bisa disetujui lagi saat `generateDanUpsertDraf()` berikutnya berjalan (fungsi
  `upsertDraf()` di dalamnya hanya melewati draft yang **bukan** `PENDING`).

### Penguncian Periode (`js/closing-period.js`)

```js
cekApakahPeriodeTerkunci(tanggalTransaksi)
```

Membandingkan bulan (`YYYY-MM`) transaksi dengan `bulanTerkunci` yang tersimpan di
`pengaturan_sistem/pengaturan_tutup_buku`: transaksi **≤** bulan terkunci dianggap
terkunci. Dipanggil dari dua tempat di `js/db.js`:

- `simpanJurnalPusat()` — menolak simpan baru **dan** menolak edit jika tanggal *lama*
  transaksi sudah terkunci (dicek terpisah dari tanggal baru).
- `hapusJurnalPusat()` — menolak hapus jika tanggal transaksi terkunci.

Parameter opsional `opsi.lewatiKuncPeriode` pada `simpanJurnalPusat()` (default `false`)
dipakai satu-satunya oleh `setujuiDraf()` di atas. Pemanggil lain (`js/journal-page.js`,
input jurnal manual biasa) tidak pernah mengirim argumen ini — perilakunya sama sekali
tidak berubah oleh keberadaan opsi ini.

> **Catatan transparansi keamanan**: kunci periode **sama sekali tidak ditegakkan** di
> level `firestore.rules` — murni pengecekan JavaScript di `js/db.js`. Menambah opsi
> bypass ini tidak membuka celah keamanan baru: operator yang paham DevTools browser
> sebenarnya sudah bisa menembus kunci ini hari ini juga (dengan memanggil fungsi
> Firestore langsung dari console). Fitur ini sekadar meresmikan satu alasan sah untuk
> melakukannya lewat UI, bukan menambah kerentanan baru.

---

## Perhitungan Pajak (`js/tax-page.js` + `CONFIG.TAX_RATES`)

Konstanta tarif terpusat di `js/config.js`:

```js
TAX_RATES: {
  PPN_EFEKTIF: 0.11,   // DPP Nilai Lain (11/12) x Tarif UU PPN (12%)
  PPH23_JASA: 0.02     // PPh Pasal 23 atas jasa/sewa/dividen dll — tarif tetap
}
```

PPh Pasal 21 **sengaja tidak** diberi tarif tetap di sini — Pasal 21 memakai skema
TER/progresif per lapisan penghasilan pegawai, sehingga tidak bisa direpresentasikan
dengan satu persentase flat. Halaman Pajak hanya menampilkan DPP-nya, bukan menghitung
nilai pajaknya.

Arah PPN (Keluaran vs Masukan) ditentukan heuristik: jika salah satu baris jurnal
transaksi mengkredit akun berkategori PENDAPATAN → PPN Keluaran, selain itu → PPN
Masukan.
