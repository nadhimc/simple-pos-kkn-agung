# Warungku POS

Aplikasi kasir dan pembukuan sederhana untuk UMKM produsen. Kasir, stok bahan
baku dan barang jadi, perhitungan HPP produk olahan, beban operasional, dan
laporan laba rugi.

React + Vite + TypeScript + Tailwind v4, dengan Firebase sebagai satu satunya
backend. Tanpa server sendiri, jadi bisa berjalan di paket gratis Vercel dan
Firebase Spark.

## Menjalankan di komputer sendiri

```bash
npm install
cp .env.example .env
npm run dev
```

## Menyiapkan Firebase

Konfigurasi di `.env.example` sudah mengarah ke proyek `simple-pos-kkn-agung`
(nomor proyek `668925770046`). Yang masih perlu dilakukan di
[Firebase Console](https://console.firebase.google.com):

1. **Authentication → Sign-in method**: aktifkan **Email/Password** dan
   **Google**. Provider Google hanya perlu satu email dukungan; tidak ada client
   ID yang perlu ditempel ke kode.
2. **Firestore Database**: pastikan database sudah dibuat, lalu terapkan aturan
   keamanannya. Isi aturannya sudah lengkap di `firestore.rules`, tinggal
   dikirim ke Firebase.

   ```bash
   npx -y firebase-tools login
   npx -y firebase-tools use simple-pos-kkn-agung
   npx -y firebase-tools deploy --only firestore:rules
   ```

   Kalau tidak mau memakai CLI, buka Firebase Console → Firestore Database →
   Rules, hapus seluruh isinya, tempel isi `firestore.rules`, lalu **Publish**.

   Aturan bawaan Firestore yang baru dibuat menolak semua akses (mode terkunci)
   atau membuka semuanya selama 30 hari (mode uji). Keduanya tidak bisa dipakai
   aplikasi ini, jadi langkah ini tidak boleh dilewati.

3. **Daftarkan diri Anda sebagai staf pertama.**

   Koleksi `staff` sengaja tidak bisa ditulis dari aplikasi, supaya tidak ada
   orang yang bisa mendaftarkan dirinya sendiri. Jadi staf pertama harus dibuat
   dari luar. Ada dua cara.

   **Cara cepat, pakai skrip.** Unduh kunci di Firebase Console → Project
   settings → Service accounts → Generate new private key, simpan sebagai
   `serviceAccountKey.json` di akar proyek (sudah masuk `.gitignore`), lalu:

   ```bash
   npm run seed -- --email pemilik@toko.id --password rahasia123 --name "Bu Sri"
   ```

   Tambahkan `--with-products` kalau ingin sekalian diisi contoh isi: sembilan
   bahan baku (gula merah, tepung tapioka, kelapa parut, dan lainnya) dan
   sembilan barang jadi, termasuk Cenil dan Klepon yang harga modalnya nol
   sampai produksi pertama dijalankan. Semuanya boleh dihapus kapan saja dari
   halaman Produk & Stok.

   Kalau akunnya mau pakai Google, masuk sekali dulu ke aplikasi (akan ditolak,
   tapi akunnya sudah tercipta di Authentication), lalu jalankan skrip tanpa
   `--password`.

   **Cara manual, tanpa skrip.** Masuk sekali ke aplikasi. Aplikasi menolak dan
   menampilkan UID Anda. Salin UID itu, lalu di Firestore buat dokumen:

   - Koleksi: `staff`
   - ID dokumen: **UID tadi**, bukan ID otomatis
   - Field: `name` (string), `email` (string), `role` (string, isi `pemilik`)

   Masuk lagi, dan Anda diterima.

> Nilai `VITE_FIREBASE_*` memang ikut ter-bundle ke JavaScript browser, dan itu
> normal untuk aplikasi Firebase. Yang menjaga data adalah Security Rules.
>
> **Sekadar "sudah login" tidak cukup**, karena dengan Google Sign-In aktif siapa
> pun pemilik akun Google bisa lolos tahap autentikasi. Yang menentukan boleh
> tidaknya membaca data toko adalah dokumen `staff/{uid}`. Karena itu langkah 2
> dan 3 tidak boleh dilewati.

### Koleksi yang dipakai

Firestore membuat koleksi otomatis saat dokumen pertamanya ditulis, jadi tidak
ada yang perlu dibuat manual selain `staff`.

| Koleksi | Dibuat oleh | Kapan |
| --- | --- | --- |
| `staff` | skrip seed atau Console | wajib, sebelum bisa masuk |
| `products` | halaman Produk & Stok | saat produk pertama ditambahkan |
| `recipes` | halaman Resep & HPP | saat resep pertama disimpan |
| `productions` | halaman Resep & HPP | saat produksi pertama dicatat |
| `sales` | layar Kasir | saat transaksi pertama diselesaikan |
| `expenses` | halaman Beban Operasional | saat beban pertama dicatat |

Skrip seed tidak pernah menulis ke `sales`. Data penjualan palsu akan merusak
laporan laba rugi yang sebenarnya.

### Memastikan aturannya benar

Setelah Publish, buka Firebase Console → Firestore → Rules → **Rules Playground**
dan jalankan empat kasus ini. Kalau hasilnya sesuai kolom terakhir, aturannya
sudah terpasang dengan benar.

| Simulation type | Location | Authenticated | Hasil yang benar |
| --- | --- | --- | --- |
| get | `/products/apa_saja` | tidak | Denied |
| get | `/products/apa_saja` | ya, UID acak | Denied |
| get | `/products/apa_saja` | ya, UID staf Anda | Allowed |
| get | `/staff/UID_ORANG_LAIN` | ya, UID staf Anda | Denied |

Baris kedua adalah yang paling penting: itu membuktikan sekadar punya akun
Google tidak cukup untuk membaca data toko Anda.

## Menambah kasir baru

Pakai skrip yang sama:

```bash
npm run seed -- --email kasir@toko.id --role kasir --name "Andi"
```

Atau tanpa skrip: kasir mencoba masuk, aplikasi menolak dan menampilkan UID-nya,
kasir mengirimkan UID itu ke Anda, lalu Anda buat dokumen `staff/{uid}` dengan
`role` berisi `kasir`.

Mencabut akses cukup dengan menghapus dokumen `staff` miliknya. Riwayat transaksi
yang sudah tercatat tidak terpengaruh, karena setiap struk menyimpan nama
kasirnya sendiri.

## Deploy ke Vercel

Import repositori ini di Vercel, lalu isi Environment Variables `VITE_FIREBASE_*`
dan `VITE_STORE_NAME` sesuai `.env.example`. Sisanya sudah diatur `vercel.json`.

Tambahkan domain Vercel ke **Firebase Console → Authentication → Settings →
Authorized domains**, kalau tidak, login akan ditolak dari domain produksi.

## Cara pakai singkat

1. **Produk & Stok** — masukkan barang beserta harga modal dan harga jual. Harga
   modal wajib benar, karena dari sanalah laba dihitung. Pilih jenisnya: **bahan
   baku** untuk yang dipakai produksi, **barang jadi** untuk yang dijual.
2. **Resep & HPP** — untuk produk olahan seperti cenil atau klepon, susun
   resepnya dari bahan baku beserta takarannya. Sistem mengambil harga dari stok
   dan menghitung HPP per pcs sendiri. Tekan Produksi untuk mencatat hasil
   masak: stok bahan berkurang, stok produk jadi bertambah.
3. **Kasir** — pilih barang, tekan Bayar, cetak struk. Stok berkurang otomatis.
4. **Beban Operasional** — catat sewa, listrik, gaji, dan pengeluaran rutin lain.
   Pembelian stok maupun produksi tidak dicatat di sini.
5. **Laba Rugi** — lihat omzet, HPP, laba kotor, beban, dan laba bersih per
   periode. Bisa diunduh sebagai CSV.

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Server pengembangan |
| `npm run build` | Type check dan build produksi |
| `npm run preview` | Meninjau hasil build |
| `npm run lint` | Menjalankan oxlint |
| `npm run seed -- --help` | Pilihan skrip pengisi data awal |

## Dokumentasi

| Berkas | Isi |
| --- | --- |
| [docs/](./docs/README.md) | Dokumentasi teknis lengkap: arsitektur, model data, alur, diagram |
| [CLAUDE.md](./CLAUDE.md) | Aturan kerja saat mengubah kode |
| [firestore.rules](./firestore.rules) | Sumber kebenaran keamanan |
