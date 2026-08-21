# CLAUDE.md

Panduan kerja untuk Claude Code di repositori ini. Baca sebelum mengubah kode.

Dokumentasi teknis lengkap beserta diagramnya ada di [`docs/`](./docs/README.md).
Berkas ini berisi aturan kerja; `docs/` berisi penjelasan cara kerja. Kalau
keduanya bertentangan, `docs/` yang harus diperbarui mengikuti kode.

## Apa ini

Aplikasi POS sederhana untuk UMKM: kasir, stok, beban operasional, dan laporan
laba rugi. Dipakai satu sampai dua orang di satu gerai, bukan multi cabang.

Cakupannya sengaja kecil. Sebelum menambah fitur, tanyakan apakah pemilik warung
benar benar memakainya setiap hari. Kalau tidak, jangan ditambahkan.

## Tumpukan teknologi

React 19 + Vite + TypeScript + Tailwind v4, dengan Firebase (Auth + Firestore)
sebagai satu satunya backend. Di-deploy sebagai situs statis ke Vercel.

**Tidak ada backend sendiri, dan itu keputusan sadar.** Proyek ini menghindari
Next.js dan Vercel Functions supaya tetap berada di paket gratis. Semua logika
berjalan di browser, dan Firestore Security Rules yang menjaga data. Jangan
memperkenalkan API route, server action, atau SSR.

| Kebutuhan | Yang dipakai |
| --- | --- |
| Routing | `react-router-dom` |
| State global | `zustand` (keranjang, tema, toast) |
| Ikon | `@phosphor-icons/react` saja, satu keluarga untuk seluruh proyek |
| Grafik | `recharts` |
| Font | `@fontsource-variable/geist` dan `geist-mono`, di-bundle sendiri |

Perintah: `npm run dev`, `npm run build` (ikut `tsc -b`), `npm run lint`.
Selalu jalankan `npm run build` sebelum commit.

## Struktur

```
src/
  components/
    layout/      AppShell, Sidebar, Header, BrandMark, navigation.ts
    ui/          kit komponen bersama, diekspor lewat components/ui/index.ts
    RequireAuth.tsx
  contexts/      AuthContext
  features/      komponen khusus satu domain (cashier, products, expenses, sales, dashboard)
  hooks/         useProducts, usePeriod, useTheme
  lib/           firebase, format, profit, errors, cn
  pages/         satu berkas per rute, default export
  services/      seluruh akses Firestore
  types/         model data
```

Aturannya: **halaman tidak memanggil Firestore langsung.** Semua kueri dan
tulisan lewat `src/services`, dibungkus hook di `src/hooks` kalau butuh
langganan real time.

## Menambah halaman baru

Tiga langkah, tidak ada berkas layout yang perlu disentuh:

1. Tambah entri di `src/components/layout/navigation.ts` (path, label,
   description, icon).
2. Daftarkan `<Route>` dengan path yang sama di `src/App.tsx`.
3. Buat komponennya di `src/pages` dengan default export.

Sidebar, judul header, dan judul tab browser semuanya membaca `navigation.ts`.
Jangan pernah menulis daftar menu di tempat lain.

Halaman biasa otomatis dapat padding dan pembatas lebar dari `AppShell`. Halaman
yang mengatur tinggi dan scroll-nya sendiri memasang `fullBleed: true` di entri
navigasinya, seperti layar kasir.

## Aturan tampilan

Sumber gaya ada di `src/index.css`. Di sana ada token warna, radius, bayangan,
dan warna grafik untuk mode terang dan gelap.

- **Selalu pakai token, jangan warna Tailwind mentah.** Tulis `bg-surface`,
  `text-ink-muted`, `border-border`, bukan `bg-white` atau `text-zinc-500`.
  Ini yang membuat mode gelap ikut benar tanpa kerja tambahan.
- Satu aksen saja: emerald. Aksen bergeser dari emerald-700 di mode terang ke
  emerald-500 di mode gelap supaya kontras tetap lolos WCAG AA di keduanya.
- Skala radius dikunci: kontrol `rounded-control` (10px), panel
  `rounded-panel` (14px), badge penuh. Jangan mencampur di luar aturan ini.
- Sidebar tetap gelap di kedua mode dan punya token sendiri (`bg-sidebar`,
  `text-sidebar-ink`).
- Angka uang selalu pakai class `tabular` supaya kolomnya rata.
- Label form selalu di atas input, error di bawahnya. Placeholder tidak pernah
  jadi pengganti label.
- Setiap layar yang mengambil data wajib punya empat keadaan: memuat (skeleton
  berbentuk kontennya, bukan spinner), kosong, error, dan berisi.
- Ikon selalu dari Phosphor. Jangan menggambar path SVG sendiri.
- Uji setiap perubahan di mode terang dan gelap sebelum menyatakan selesai.

### Grafik

Warna deret ada di token `--chart-1` (omzet) dan `--chart-2` (laba), dengan
langkah terpisah untuk mode gelap. Pasangan itu sudah lolos validator untuk
lightness, chroma, keterpisahan buta warna, dan kontras terhadap permukaannya.
**Jangan mengganti nilainya tanpa menjalankan validator ulang.**

Aturan yang berlaku: satu sumbu saja (dua ukuran dengan skala berbeda dipisah
jadi dua grafik), warna mengikuti entitas bukan peringkat, legenda selalu ada
untuk dua deret atau lebih, dan identitas deret tidak boleh hanya lewat warna.
Grafik laba rugi tetap berbentuk tabel karena laporan keuangan dibaca baris demi
baris.

## Kontrol akses

Ada dua metode masuk: email/password dan Google. Keduanya hanya membuktikan
**siapa** orangnya, bukan bahwa dia orang toko. Sejak Google aktif, siapa pun
pemilik akun Google bisa lolos tahap autentikasi.

Yang memisahkan staf dari orang asing adalah keberadaan dokumen `staff/{uid}`.
`firestore.rules` memeriksanya lewat `isStaff()` pada setiap koleksi, dan
`AuthContext` memeriksa hal yang sama untuk pengalaman pengguna.

**Aplikasi tidak pernah menulis ke koleksi `staff`** (`allow write: if false`).
Dokumen staf hanya dibuat dari luar aplikasi, supaya tidak ada jalan bagi siapa
pun untuk mendaftarkan dirinya sendiri. Jangan menambahkan halaman manajemen staf
tanpa memikirkan ulang aturan ini.

Jalurnya ada dua: Firebase Console, atau `scripts/seed.mjs` yang memakai Admin
SDK. Admin SDK melewati Security Rules by design, jadi kunci service account-nya
setara akses penuh ke seluruh proyek. Kunci itu masuk `.gitignore` dan tidak
boleh dipakai di kode aplikasi, hanya di skrip yang dijalankan manual.

Skrip seed tidak pernah menulis ke koleksi `sales`. Penjualan palsu akan merusak
laporan laba rugi yang sebenarnya.

Pemeriksaan staf di klien sengaja **gagal terbuka** saat jaringan bermasalah:
kasir tidak boleh terlempar keluar di tengah jualan. Itu aman karena
`firestore.rules` tetap memeriksa keanggotaan yang sama di sisi server, jadi
lolos di klien tidak memberi akses data apa pun.

Akun yang berhasil login tetapi tidak terdaftar langsung di-signout, dan halaman
masuk menampilkan UID-nya supaya bisa dikirim ke pemilik toko.

### Penjagaan rute

Dijaga di tingkat rute, di `src/components/routing/AuthGuards.tsx`. **Halaman
tidak pernah memeriksa sesi sendiri**, jadi tidak ada halaman yang bisa lupa
dijaga.

| Gerbang | Menjaga |
| --- | --- |
| `RequireAuth` | seluruh aplikasi, memantulkan yang belum masuk ke `/masuk` |
| `RedirectIfAuthenticated` | `/masuk`, memantulkan yang sudah masuk ke aplikasi |

Selama sesi masih dipulihkan, keduanya menampilkan layar tunggu yang sama. Tanpa
itu, menyegarkan halaman akan memperlihatkan kedipan form login walaupun sudah
masuk.

Alamat tujuan disimpan lengkap dengan query dan hash lewat `state.from`, jadi
tautan dalam seperti `/laporan?periode=bulan-ini` tetap sampai setelah masuk.
`safeRedirectTarget` menolak nilai yang bukan jalur relatif, supaya state
navigasi tidak bisa dipakai melempar pengguna ke domain luar.

Tujuan bawaan setelah masuk adalah `AUTH_LANDING`, yaitu layar kasir, bukan
dashboard: itu pekerjaan yang dibuka puluhan kali sehari.

## Produksi dan HPP

Usaha ini mengolah bahan jadi produk sendiri, jadi stok punya dua jenis:

- **`type: 'bahan'`** tidak pernah muncul di kasir dan tidak punya harga jual.
- **`type: 'jadi'`** dijual di kasir, mencakup barang kulakan maupun hasil olahan.

Dokumen lama tanpa field `type` dibaca sebagai `jadi`, jadi tidak ada migrasi.

**Resep tidak menyimpan harga sama sekali.** HPP dihitung ulang dari harga bahan
terkini setiap kali ditampilkan, lewat `computeHpp` di `src/lib/hpp.ts`. Itulah
gunanya: harga kulakan naik, seluruh HPP ikut menyesuaikan tanpa ada yang perlu
diperbarui manual. Riwayat produksi sebaliknya **menyimpan** salinan harga,
karena HPP historis tidak boleh berubah.

Resep memakai satuan pemakaian (gram) sementara stok dibeli per satuan pembelian
(kg). Konversinya ada di `src/lib/units.ts`, hanya boleh di dalam dimensi yang
sama. `convert` mengembalikan `null` untuk dimensi berbeda, dan pemanggilnya
wajib menangani itu, jangan sampai menghasilkan angka salah diam diam.

**Produksi bukan beban.** Ia memindahkan nilai dari persediaan bahan ke
persediaan barang jadi. Modal baru diakui sebagai HPP saat produknya terjual.
Mencatatnya sebagai beban menghitung modal dua kali.

Harga modal produk jadi setelah produksi memakai **rata rata tertimbang**
(`blendedCostPrice`), bukan ditimpa, supaya sisa stok lama tidak ikut dinilai
ulang dengan harga baru.

HPP saat ini hanya mencakup **biaya bahan baku**. Tenaga kerja dan overhead
masuk Beban Operasional, bukan diserap ke dalam HPP.

Penjelasan lengkap beserta diagramnya di [`docs/produksi.md`](./docs/produksi.md).

## Model data Firestore

Enam koleksi, tanpa subcollection.

**`staff`** — id dokumen adalah `uid` dari Firebase Auth. Isinya `name, email,
role` (`pemilik` atau `kasir`). Dibuat manual lewat Console.

**`products`** — `type, name, sku, category, costPrice, sellPrice, stock, unit,
minStock, createdAt, updatedAt`

**`recipes`** — `productId, productName, items[], yieldQty, yieldUnit, note,
createdAt, updatedAt`. `items[]` berisi `materialId, materialName, qty, unit`
tanpa harga.

**`productions`** — `productionNo, productId, productName, recipeId, items[],
materialCost, yieldQty, yieldUnit, costPerUnit, operatorId, operatorName, note,
createdAt`. `items[]` menyimpan salinan harga saat produksi.

**`sales`** — `invoiceNo, items[], subtotal, discount, total, totalCost,
grossProfit, paymentMethod, cashReceived, change, note, cashierId, cashierName,
createdAt`

**`expenses`** — `date, category, description, amount, createdBy, createdAt`

Setiap baris di `sales.items` menyimpan salinan `name`, `sellPrice`, dan
`costPrice` saat transaksi terjadi. Karena itu mengubah harga produk atau
menghapus produk tidak pernah mengubah laba historis.

Seluruh kueri memfilter dan mengurutkan pada field yang sama, jadi tidak ada
indeks komposit yang perlu dibuat. Kalau menambah kueri yang memfilter dan
mengurutkan pada field berbeda, daftarkan indeksnya di `firestore.indexes.json`.

## Aturan akuntansi (jangan dilanggar)

```
Omzet        = jumlah total seluruh struk, sudah dipotong diskon
HPP          = jumlah harga modal barang yang terjual
Laba kotor   = Omzet - HPP
Laba bersih  = Laba kotor - Beban operasional
```

Rumusnya ada satu tempat saja: `src/lib/profit.ts`. Jangan menghitung ulang di
komponen.

**Pembelian stok bukan beban.** Modal barang diakui sebagai HPP saat barang
terjual. Kalau pembelian stok juga dicatat sebagai beban, modalnya terhitung dua
kali dan laporan jadi salah. Menambah stok hanya mengubah `products.stock`, tidak
pernah membuat dokumen `expenses`.

## Keputusan teknis yang punya alasan

Jangan membalik yang berikut tanpa alasan baru.

**Penjualan memakai `writeBatch` + `increment`, bukan `runTransaction`.**
Transaksi Firestore wajib bolak balik ke server dan langsung gagal saat koneksi
putus, sementara warung harus tetap bisa melayani pembeli waktu internet mati.
Batch masuk antrean cache lokal dan terkirim saat koneksi kembali, dan karena
`increment` dihitung di server, dua perangkat yang menjual bersamaan tetap
menghasilkan sisa stok yang benar. Konsekuensinya stok tidak bisa dikunci, jadi
layar kasir memeriksa kecukupan stok terhadap snapshot terbaru sebelum menyimpan.

**Firestore memakai cache persisten multi tab.** Kasir sering membuka kasir di
satu tab dan laporan di tab lain.

**Form produk tidak pernah mengirim `stock`.** Modal bisa terbuka beberapa menit
sementara penjualan terus jalan; mengirim nilai stok dari form akan menghapus
penjualan yang terjadi di sela itu. Stok hanya berubah lewat `addStock`,
`setStock`, penjualan, atau pembatalan penjualan.

**Dokumen `productions` tidak boleh diedit**, sama seperti `sales`. Koreksi
dilakukan dengan membatalkan produksi, yang mengembalikan stok bahan sekaligus
menarik produk jadi. Harga modal tidak ikut dikembalikan, karena rata rata
tertimbang tidak bisa dibalik tanpa menyimpan riwayat nilainya.

**Dokumen `sales` tidak boleh diedit** (dikunci di `firestore.rules`). Koreksi
dilakukan dengan membatalkan struk lalu input ulang, supaya laba historis tidak
bisa diubah diam diam. Pembatalan menghapus struk sekaligus mengembalikan stok
dalam satu batch, dan melewati produk yang sudah dihapus karena `batch.update` ke
dokumen yang tidak ada akan menggagalkan seluruh batch.

**Produk boleh dihapus permanen**, karena riwayat penjualan menyimpan salinannya
sendiri.

## Hal yang perlu diketahui

- Dokumen yang baru dibuat sempat punya `createdAt` bernilai null di cache lokal
  sebelum server mengisinya, jadi transaksi yang baru disimpan bisa telat muncul
  sesaat di daftar yang difilter tanggal.
- `firestore.rules` menolak stok negatif. Kalau barang terakhir habis terjual
  lebih dulu dari perangkat lain, batch penjualan ditolak dengan
  `permission-denied`. Itu memang mencegah oversell; pesannya diterjemahkan di
  `saleErrorMessage` pada `src/lib/errors.ts`.
- Tulisan yang dibuat saat offline baru diperiksa Security Rules ketika sinkron.
  Kalau ditolak, perubahannya di-rollback diam diam.
- Login Google memakai `signInWithPopup` dengan `prompt: 'select_account'`. Satu
  perangkat kasir sering dipakai bergantian, dan memakai sesi Google terakhir
  secara diam diam membuat struk tercatat atas nama orang yang salah.
- Menutup jendela popup Google memunculkan kode `auth/popup-closed-by-user`. Itu
  bukan kesalahan, jadi `authErrorMessage` sengaja mengembalikan string kosong
  dan pemanggilnya tidak menampilkan apa apa.
- Domain produksi harus didaftarkan di Firebase Console, menu Authentication,
  Settings, Authorized domains. Kalau tidak, login Google gagal dengan
  `auth/unauthorized-domain` walaupun di localhost berhasil.
- Cetak struk mengisolasi `#receipt-print-area` lewat `@media print` di
  `index.css`, bukan membuka jendela baru, supaya jalan di printer termal murah.
- Enter di kolom pencarian kasir menambahkan satu satunya hasil yang cocok. Itu
  yang membuat pemindai barcode USB bekerja.

## Bahasa

Seluruh teks yang dilihat pengguna berbahasa Indonesia. Nama variabel, komentar
kode, dan pesan commit berbahasa Inggris kecuali komentar yang menjelaskan aturan
bisnis lokal.

Format angka lewat helper di `src/lib/format.ts`, jangan `toLocaleString`
langsung di komponen.

## Git

Pesan commit memakai Conventional Commits (`feat`, `fix`, `docs`, `refactor`,
`chore`, `build`). Satu perubahan logis per commit. Badan commit menjelaskan
**kenapa**, bukan mengulang diff.

Rahasia tidak pernah di-commit. `.env` sudah masuk `.gitignore`; nilai konfigurasi
Firebase Web memang publik dan ada di `.env.example`.

## Deploy

Vercel membaca `vercel.json` (rewrite SPA ke `index.html`). Environment variables
`VITE_FIREBASE_*` harus diisi di Vercel, karena `.env` tidak ikut ter-commit.

Perubahan pada `firestore.rules` tidak ikut terpasang lewat Vercel. Terapkan
terpisah dengan `firebase deploy --only firestore:rules`, atau tempel isinya di
Firebase Console.
