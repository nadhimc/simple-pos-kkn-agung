# Warungku POS

Aplikasi kasir dan pembukuan sederhana untuk UMKM. Empat hal saja: kasir, stok,
beban operasional, dan laporan laba rugi.

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
2. **Firestore Database**: buat database, lalu terapkan aturan keamanannya.

   ```bash
   npx firebase-tools deploy --only firestore:rules
   ```

   Atau salin isi `firestore.rules` ke Firebase Console → Firestore → Rules.

3. **Daftarkan diri Anda sebagai staf pertama.** Ini wajib, dan harus manual.

   Login sekali ke aplikasi dengan akun Google Anda. Aplikasi akan menolak masuk
   dan menampilkan UID Anda. Salin UID itu, lalu di Firestore buat dokumen:

   - Koleksi: `staff`
   - ID dokumen: **UID tadi** (bukan ID otomatis)
   - Field: `name` (string), `email` (string), `role` (string, isi `pemilik`)

   Login lagi, dan Anda masuk.

> Nilai `VITE_FIREBASE_*` memang ikut ter-bundle ke JavaScript browser, dan itu
> normal untuk aplikasi Firebase. Yang menjaga data adalah Security Rules.
>
> **Sekadar "sudah login" tidak cukup**, karena dengan Google Sign-In aktif siapa
> pun pemilik akun Google bisa lolos tahap autentikasi. Yang menentukan boleh
> tidaknya membaca data toko adalah dokumen `staff/{uid}`. Karena itu langkah 2
> dan 3 tidak boleh dilewati.

## Menambah kasir baru

1. Kasir mencoba masuk dengan akun Google atau email/password-nya. Aplikasi
   menolak dan menampilkan UID akun itu.
2. Kasir mengirimkan UID tersebut ke Anda.
3. Anda buat dokumen `staff/{uid}` dengan `role` berisi `kasir`.

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
   modal wajib benar, karena dari sanalah laba dihitung.
2. **Kasir** — pilih barang, tekan Bayar, cetak struk. Stok berkurang otomatis.
3. **Beban Operasional** — catat sewa, listrik, gaji, dan pengeluaran rutin lain.
   Pembelian stok tidak dicatat di sini.
4. **Laba Rugi** — lihat omzet, HPP, laba kotor, beban, dan laba bersih per
   periode. Bisa diunduh sebagai CSV.

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Server pengembangan |
| `npm run build` | Type check dan build produksi |
| `npm run preview` | Meninjau hasil build |
| `npm run lint` | Menjalankan oxlint |

Catatan pengembangan lebih lengkap ada di [CLAUDE.md](./CLAUDE.md).
