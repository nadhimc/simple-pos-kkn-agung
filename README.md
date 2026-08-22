# Warungku POS

Layanan kasir dan pembukuan sederhana untuk UMKM produsen. Kasir, stok bahan
baku dan barang jadi, perhitungan HPP produk olahan, beban operasional, dan
laporan laba rugi.

Satu pemasangan melayani banyak warung. Ada dua dunia yang memakai kerangka yang
sama tapi tidak pernah saling melihat: **admin platform** yang mengelola daftar
warung dan penggunanya, dan **orang warung** yang hanya melihat warungnya
sendiri. Satu akun terikat pada tepat satu warung.

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

1. **Authentication → Sign-in method**: aktifkan **Phone**, **Email/Password**,
   dan **Google**. Provider Google hanya perlu satu email dukungan; tidak ada
   client ID yang perlu ditempel ke kode.

   Untuk mencoba login nomor HP tanpa mengirim SMS sungguhan, isi juga **Phone
   numbers for testing** di halaman yang sama. Nomor uji tidak memakai kuota.

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

3. **Buat admin platform pertama.**

   Peran `admin` sengaja ditolak Security Rules, jadi admin tidak mungkin lahir
   dari dalam aplikasi. Kalau bisa, siapa pun yang berhasil login bisa
   mengangkat dirinya sendiri jadi admin seluruh layanan.

   Unduh kunci di Firebase Console → Project settings → Service accounts →
   Generate new private key, simpan sebagai `serviceAccountKey.json` di akar
   proyek (sudah masuk `.gitignore`), lalu:

   ```bash
   npm run seed -- admin --email admin@toko.id --password rahasia123 --name "Admin"
   ```

   Kalau akunnya mau pakai Google, masuk sekali dulu ke aplikasi (akan ditolak,
   tapi akunnya sudah tercipta di Authentication), lalu jalankan perintah itu
   tanpa `--password`.

4. **Masuk sebagai admin, lalu tambahkan warung pertama** dari menu Warung.
   Setelah warungnya jadi, aplikasi langsung menawarkan mendaftarkan orang yang
   mengelolanya.

   Kalau mau langsung dari terminal:

   ```bash
   npm run seed -- warung --tenant "Warung Gendis" --email agung@toko.id --password rahasia123 --with-products
   npm run seed -- warung --tenant "Warung Gendis" --phone 085156657853 --role kasir --name "Andi"
   ```

   `--with-products` mengisi contoh isi ke warung itu: sembilan bahan baku (gula
   merah, tepung tapioka, kelapa parut, dan lainnya) dan sembilan barang jadi,
   termasuk Cenil dan Klepon yang harga modalnya nol sampai produksi pertama
   dijalankan. Semuanya boleh dihapus kapan saja dari halaman Produk & Stok.

> Nilai `VITE_FIREBASE_*` memang ikut ter-bundle ke JavaScript browser, dan itu
> normal untuk aplikasi Firebase. Yang menjaga data adalah Security Rules.
>
> **Sekadar "sudah login" tidak cukup**, karena siapa pun pemilik akun Google
> atau nomor HP bisa lolos tahap autentikasi. Yang menentukan boleh tidaknya
> membaca data warung adalah dokumen `users/{uid}` beserta `tenantId` di
> dalamnya. Karena itu langkah 2 dan 3 tidak boleh dilewati.

### Koleksi yang dipakai

Seluruh data usaha hidup di bawah warungnya masing masing. Tenant adalah bagian
dari jalur dokumen, bukan sekadar field, sehingga tidak ada kueri yang bisa lupa
memfilter warung dan membaca data tetangga.

```
users/{uid}                                siapa boleh masuk, ke warung mana
tenants/{tenantId}                         identitas warung
tenants/{tenantId}/products/{id}
tenants/{tenantId}/recipes/{id}
tenants/{tenantId}/productions/{id}
tenants/{tenantId}/sales/{id}
tenants/{tenantId}/expenses/{id}
```

Firestore membuat koleksi otomatis saat dokumen pertamanya ditulis, jadi tidak
ada yang perlu dibuat manual selain admin pertama.

| Koleksi | Dibuat oleh | Kapan |
| --- | --- | --- |
| `users` | skrip seed, lalu halaman Pengguna | wajib, sebelum bisa masuk |
| `tenants` | halaman Warung atau skrip seed | saat warung pertama ditambahkan |
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

Ganti `WARUNG_A` dengan id warung Anda, dan `WARUNG_B` dengan id warung lain.

| Simulation type | Location | Authenticated | Hasil yang benar |
| --- | --- | --- | --- |
| get | `/tenants/WARUNG_A/products/apa_saja` | tidak | Denied |
| get | `/tenants/WARUNG_A/products/apa_saja` | ya, UID acak | Denied |
| get | `/tenants/WARUNG_A/products/apa_saja` | ya, UID orang warung A | Allowed |
| get | `/tenants/WARUNG_B/products/apa_saja` | ya, UID orang warung A | Denied |
| get | `/tenants/WARUNG_A/products/apa_saja` | ya, UID admin | Denied |
| get | `/users/UID_ORANG_LAIN` | ya, UID orang warung A | Denied |

Dua baris yang paling penting: baris kedua membuktikan sekadar punya akun Google
tidak cukup, dan baris keempat membuktikan warung tetangga benar benar tersekat.
Baris kelima membuktikan admin platform memang tidak bisa mengintip pembukuan.

## Menambah pengguna warung

Dari aplikasi, sebagai admin: menu **Pengguna** → **Daftarkan pengguna**. Ada
tiga cara, dan ketiganya membuat akunnya tanpa mengganggu sesi Anda.

| Cara | Kapan dipakai |
| --- | --- |
| **Nomor HP** | Paling mudah untuk pemilik warung. Anda mengetik nomornya, kode enam angka masuk ke HP-nya, dia membacakannya ke Anda. |
| **Email** | Akun dan kata sandinya Anda buat di sini, lalu diberikan ke orangnya. |
| **UID** | Untuk akun yang sudah pernah masuk, misalnya lewat Google. UID-nya ditampilkan halaman masuk saat menolaknya. |

Nomor HP tidak bisa didaftarkan sepihak, dengan atau tanpa backend: OTP-nya
dikirim ke HP pemilik nomornya. Karena itu alurnya memang dirancang berdua.

Mencabut akses ada dua tingkat. **Nonaktifkan** lewat tombol Ubah kalau hanya
sementara, atau **cabut akses** untuk menghapus barisnya sekaligus. Riwayat
transaksi yang sudah tercatat tidak terpengaruh keduanya, karena setiap struk
menyimpan nama kasirnya sendiri.

Akun loginnya sendiri tetap ada di Firebase Authentication, tetapi tanpa baris di
`users` ia tidak bisa membaca data apa pun.

## Sesi dan PIN

Tidak ada PIN, dan itu disengaja. Sesi Firebase disimpan di IndexedDB, dan
refresh token Firebase tidak punya masa berlaku: selama tidak menekan Keluar,
orangnya tidak akan pernah diminta OTP lagi di HP yang sama.

Kalau nanti ingin menambah kunci PIN, sadari batasnya: tanpa backend, PIN tidak
mungkin ditukar menjadi sesi Firebase, jadi ia hanya gembok layar di atas sesi
yang sudah hidup, bukan faktor autentikasi kedua.

## Deploy ke Vercel

Import repositori ini di Vercel, lalu isi Environment Variables `VITE_FIREBASE_*`
dan `VITE_STORE_NAME` sesuai `.env.example`. Sisanya sudah diatur `vercel.json`.

`VITE_STORE_NAME` sekarang adalah nama **layanan**, yang muncul di halaman masuk
dan layar tunggu. Nama warung yang tercetak di struk dan tampil di sidebar datang
dari dokumen tenant, bukan dari sini.

Tambahkan domain Vercel ke **Firebase Console → Authentication → Settings →
Authorized domains**, kalau tidak, login akan ditolak dari domain produksi.

## Cara pakai singkat

1. **Masuk** — pemilik warung cukup mengetik nomor HP-nya, lalu memasukkan kode
   yang datang lewat SMS. Setelah itu dia tidak akan diminta masuk lagi di HP
   yang sama.
2. **Produk & Stok** — masukkan barang beserta harga modal dan harga jual. Harga
   modal wajib benar, karena dari sanalah laba dihitung. Pilih jenisnya: **bahan
   baku** untuk yang dipakai produksi, **barang jadi** untuk yang dijual.
3. **Resep & HPP** — untuk produk olahan seperti cenil atau klepon, susun
   resepnya dari bahan baku beserta takarannya. Sistem mengambil harga dari stok
   dan menghitung HPP per pcs sendiri. Tekan Produksi untuk mencatat hasil
   masak: stok bahan berkurang, stok produk jadi bertambah.
4. **Kasir** — pilih barang, tekan Bayar, cetak struk. Stok berkurang otomatis.
5. **Beban Operasional** — catat sewa, listrik, gaji, dan pengeluaran rutin lain.
   Pembelian stok maupun produksi tidak dicatat di sini.
6. **Laba Rugi** — lihat omzet, HPP, laba kotor, beban, dan laba bersih per
   periode. Bisa diunduh sebagai CSV.

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Server pengembangan |
| `npm run build` | Type check dan build produksi |
| `npm run preview` | Meninjau hasil build |
| `npm run lint` | Menjalankan oxlint |
| `npm run seed -- --help` | Pilihan skrip pengisi data awal |
| `npm run seed -- reset --yes` | Menghapus koleksi lama peninggalan model satu warung |

## Dokumentasi

| Berkas | Isi |
| --- | --- |
| [docs/](./docs/README.md) | Dokumentasi teknis lengkap: arsitektur, model data, alur, diagram |
| [CLAUDE.md](./CLAUDE.md) | Aturan kerja saat mengubah kode |
| [firestore.rules](./firestore.rules) | Sumber kebenaran keamanan |
