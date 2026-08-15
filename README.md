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

Konfigurasi di `.env.example` sudah mengarah ke proyek `simple-pos-kkn-agung`.
Yang masih perlu dilakukan di [Firebase Console](https://console.firebase.google.com):

1. **Authentication → Sign-in method**: aktifkan **Email/Password**.
2. **Authentication → Users**: tambahkan akun untuk pemilik dan kasir. Aplikasi
   ini tidak menyediakan pendaftaran mandiri, karena hanya orang toko yang boleh
   masuk.
3. **Firestore Database**: buat database, lalu terapkan aturan keamanannya.

```bash
npx firebase-tools deploy --only firestore:rules
```

Atau salin isi `firestore.rules` ke Firebase Console → Firestore → Rules.

> Nilai `VITE_FIREBASE_*` memang ikut ter-bundle ke JavaScript browser, dan itu
> normal untuk aplikasi Firebase. Yang menjaga data adalah Auth dan Security
> Rules, bukan kerahasiaan nilai tersebut. Karena itu langkah 3 wajib.

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
