# CLAUDE.md

Panduan kerja untuk Claude Code di repositori ini. Baca sebelum mengubah kode.

Dokumentasi teknis lengkap beserta diagramnya ada di [`docs/`](./docs/README.md).
Berkas ini berisi aturan kerja; `docs/` berisi penjelasan cara kerja. Kalau
keduanya bertentangan, `docs/` yang harus diperbarui mengikuti kode.

## Apa ini

**IPANDAI Jugosari**, Sistem Informasi Pengelolaan Dana Desa Jugosari. Kasir,
stok, beban operasional, dan laporan laba rugi untuk unit usaha desa. Satu
pemasangan melayani banyak unit usaha, tapi tiap unit tetap dipakai satu sampai
dua orang di satu gerai, bukan multi cabang.

Nama layanan adalah konstanta di `src/lib/firebase.ts`, bukan environment
variable: itu identitas produk, bukan konfigurasi per deployment. Nama tiap unit
usaha datang dari dokumen tenant-nya.

Di antarmuka admin istilahnya **unit usaha**; di dalam aplikasinya sendiri
pengguna hanya melihat nama tempatnya, jadi istilah generiknya jarang muncul.

Ada dua dunia yang memakai kerangka yang sama tapi tidak pernah saling melihat:

- **Admin platform** mengelola daftar warung dan penggunanya, dan sengaja tidak
  bisa membaca pembukuan warung mana pun.
- **Orang warung** hanya melihat warungnya sendiri, persis seperti aplikasi satu
  toko. Satu akun terikat pada tepat satu warung.

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
    routing/     AuthGuards.tsx
    ui/          kit komponen bersama, diekspor lewat components/ui/index.ts
  contexts/      AuthContext
  features/      komponen khusus satu domain (cashier, products, expenses,
                 sales, dashboard, recipes, admin)
  hooks/         useProducts, usePeriod, useAdmin, useTheme
  lib/           firebase, format, profit, hpp, units, phone, phoneAuth, errors, cn
  pages/         satu berkas per rute, default export
  services/      seluruh akses Firestore, termasuk paths.ts
  types/         model data
```

Aturannya: **halaman tidak memanggil Firestore langsung.** Semua kueri dan
tulisan lewat `src/services`, dibungkus hook di `src/hooks` kalau butuh
langganan real time.

Aturan kedua: **fungsi service data usaha selalu menerima `tenantId` sebagai
argumen pertama.** Jalurnya dirakit di `src/services/paths.ts`, yang menolak
tenantId kosong dengan pesan yang jelas alih alih diam diam membentuk jalur
`tenants//products`.

## Menambah halaman baru

Tiga langkah, tidak ada berkas layout yang perlu disentuh:

1. Tambah entri di `src/components/layout/navigation.ts`, di
   `tenantNavigation` untuk halaman warung atau `adminNavigation` untuk halaman
   platform (path, label, description, icon).
2. Daftarkan `<Route>` dengan path yang sama di `src/App.tsx`, di dalam
   `RequireTenantUser` atau `RequireAdmin` sesuai daftarnya.
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

Ada tiga metode masuk: nomor HP (OTP), email/password, dan Google. Ketiganya
hanya membuktikan **siapa** orangnya, bukan bahwa dia berhak masuk. Siapa pun
pemilik akun Google atau nomor HP bisa lolos tahap autentikasi.

Yang menentukan boleh tidaknya masuk, dan ke warung yang mana, adalah dokumen
`users/{uid}`. `firestore.rules` membacanya di sisi server pada setiap
permintaan, dan `AuthContext` membaca hal yang sama untuk pengalaman pengguna.

**Tidak ada pendaftaran mandiri.** Seluruh pengguna didaftarkan admin platform
lewat halaman Pengguna. Aturan `users` hanya bisa ditulis akun ber-`role: admin`,
jadi orang yang belum terdaftar tidak punya pijakan sama sekali.

**Admin boleh mengangkat admin lain lewat aplikasi**, tapi hanya admin.
`isValidUser()` memeriksa bentuk barisnya sekaligus: orang unit usaha wajib punya
`tenantId`, admin wajib tidak punya. Dan `keepsOwnStanding()` melarang siapa pun
menurunkan peran atau menonaktifkan dirinya sendiri, supaya platform tidak bisa
kehilangan admin terakhirnya tanpa cara memulihkan.

Konsekuensi yang diterima: satu akun admin yang bocor bisa membuat admin lain,
jadi mengusirnya butuh mencabut semua yang dibuatnya. Sebelum ini, admin hanya
bisa lahir dari skrip. Ditukar dengan kemudahan yang memang diminta.

**Admin pertama tetap hanya lahir dari `scripts/seed.mjs`** yang memakai Admin SDK.
Admin SDK melewati Security Rules by design, jadi kunci service account-nya
setara akses penuh ke seluruh proyek. Kunci itu masuk `.gitignore` dan tidak
boleh dipakai di kode aplikasi, hanya di skrip yang dijalankan manual.

**Admin platform tidak bisa membaca pembukuan warung mana pun.** Perhatikan
bahwa `isAdmin()` tidak muncul sama sekali di aturan subkoleksi tenant, dan
ketiadaan itulah jaminannya: satu akun admin yang bocor tidak berarti seluruh
pembukuan semua warung ikut terbuka. Jangan menambahkannya ke sana tanpa alasan
baru yang kuat.

Skrip seed tidak pernah menulis ke koleksi `sales`. Penjualan palsu akan merusak
laporan laba rugi yang sebenarnya.

Akun yang berhasil login tetapi belum terdaftar langsung di-signout, dan halaman
masuk menampilkan UID-nya supaya bisa dikirim ke admin. Admin bisa mendaftarkan
UID itu langsung lewat mode UID di form pengguna, yang juga satu satunya cara
mendaftarkan orang yang hanya punya akun Google.

### Nomor HP: undangan, bukan OTP di sisi admin

Nomor HP tidak bisa didaftarkan sepihak oleh siapa pun: OTP-nya dikirim ke HP
orangnya, dengan atau tanpa backend. Karena itu admin tidak mendaftarkan
nomornya, melainkan **mengundang**: `invites/{nomor E.164}` berisi nama, peran,
dan `tenantId`. Orangnya lalu masuk sendiri kapan saja, dan barisnya di `users`
dibuat pada saat itu juga oleh `claimInvite`.

**Ini satu satunya tempat seseorang menulis barisnya sendiri di `users`.** Yang
menahannya bukan kode klien melainkan `firestore.rules`: undangannya harus ada
untuk nomor yang tercantum di `request.auth.token.phone_number`, dan `tenantId`
serta perannya dibaca dari undangan itu di sisi server. Undangan tidak pernah
bisa menghasilkan peran `admin`.

Undangan hilang sendiri begitu dipakai. Yang belum terpakai muncul di halaman
Pengguna sebagai "Menunggu masuk pertama", supaya admin tahu ada orang yang
belum juga menyentuh aplikasinya.

**Form pengguna tidak memilihkan unit usaha otomatis** saat ada lebih dari satu.
Bawaan berdasarkan urutan abjad membuat admin yang tidak memperhatikan dropdown
memasukkan orang ke unit yang salah tanpa satu pun tanda, dan salah tempat
seperti itu baru ketahuan setelah orangnya membuka pembukuan yang bukan miliknya.

### Membuat akun tanpa kehilangan sesi sendiri

`createUserWithEmailAndPassword` dan `confirmationResult.confirm` sama sama ikut
me-login akun yang baru dibuat. Kalau dijalankan di instance Firebase utama,
admin yang sedang mendaftarkan pemilik warung akan langsung terlempar keluar dan
berganti jadi orang itu.

Karena itu pendaftaran berjalan di **instance Firebase kedua** dengan
`inMemoryPersistence` (`registrarAuth` di `src/services/users.ts`). Sesi di
instance utama tidak tersentuh, dan tidak ada sesi menggantung milik orang lain
di perangkat admin.

Nomor HP tidak bisa didaftarkan sepihak: OTP-nya dikirim ke HP orangnya, dengan
atau tanpa backend. Jadi alurnya memang dibuat berdua, admin mengetik nomornya
lalu pemilik warung membacakan kodenya.

### Penjagaan rute

Dijaga di tingkat rute, di `src/components/routing/AuthGuards.tsx`. **Halaman
tidak pernah memeriksa sesi sendiri**, jadi tidak ada halaman yang bisa lupa
dijaga.

| Gerbang | Menjaga |
| --- | --- |
| `RequireAuth` | seluruh aplikasi, memantulkan yang belum masuk ke `/masuk` |
| `RedirectIfAuthenticated` | `/masuk`, memantulkan yang sudah masuk ke aplikasi |
| `RequireTenantUser` | halaman warung, memantulkan admin ke `/admin` |
| `RequireAdmin` | halaman platform, memantulkan orang warung ke `/kasir` |

Pemisahan dua dunia itu bukan sekadar menyembunyikan menu: `firestore.rules`
menegakkan batas yang sama di server, jadi admin yang memaksa membuka `/laporan`
tetap tidak mendapat satu angka pun.

Selama sesi masih dipulihkan, keduanya menampilkan layar tunggu yang sama. Tanpa
itu, menyegarkan halaman akan memperlihatkan kedipan form login walaupun sudah
masuk.

Alamat tujuan disimpan lengkap dengan query dan hash lewat `state.from`, jadi
tautan dalam seperti `/laporan?periode=bulan-ini` tetap sampai setelah masuk.
`safeRedirectTarget` menolak nilai yang bukan jalur relatif, supaya state
navigasi tidak bisa dipakai melempar pengguna ke domain luar.

Tujuan bawaan setelah masuk adalah `AUTH_LANDING`, yaitu layar kasir, bukan
dashboard: itu pekerjaan yang dibuka puluhan kali sehari. Admin platform tidak
punya kasir, jadi mendarat di `ADMIN_LANDING`, daftar warung.

Kalau profil penggunanya gagal dibaca, hampir selalu karena jaringan, sesinya
**tidak** diputus: kasir tidak boleh terlempar keluar di tengah jualan. Tapi
aplikasinya juga tidak bisa digambar tanpa tahu warung mana yang dimaksud, jadi
`RequireAuth` menampilkan layar coba-lagi, bukan layar kosong yang menyamarkan
keadaan.

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

Dua koleksi di akar, dan lima subkoleksi di bawah tiap warung.

```
users/{uid}
invites/{nomorE164}
tenants/{tenantId}
tenantStats/{tenantId}
tenants/{tenantId}/products/{id}
tenants/{tenantId}/recipes/{id}
tenants/{tenantId}/productions/{id}
tenants/{tenantId}/sales/{id}
tenants/{tenantId}/expenses/{id}
```

**Tenant adalah bagian dari jalur dokumen, bukan field di dalamnya.** Kalau
tenant hanya berupa field, keamanan seluruh layanan bergantung pada setiap kueri
di seluruh kode ingat menyertakan filternya; satu yang lupa, dan omzet warung
tetangga ikut terbaca. Dengan bentuk jalur, aturannya
`match /tenants/{id}/{doc=**}` dan tidak ada kueri yang **bisa** lupa: jalur yang
salah ditolak server. Jangan membalik ini.

**`users`** — id dokumen adalah `uid` dari Firebase Auth. Isinya `name, email,
phone, role` (`admin`, `pemilik`, atau `kasir`), `tenantId`, `active`,
`createdAt`. `tenantId` kosong hanya untuk admin platform. Ditulis admin lewat
aplikasi, kecuali baris admin pertama yang datang dari skrip seed.

**`invites`** — id dokumennya adalah nomor HP dalam format E.164. Isinya `name,
role, tenantId, createdAt`. Ditulis admin, dibaca dan dihapus oleh pemilik
nomornya sendiri. Hilang begitu dipakai.

**`tenants`** — `name, ownerName, phone, address, active, createdAt, updatedAt`.
Hanya identitas unit usaha, tanpa angka usaha. `active: false` menutup seluruh
akses ke datanya tanpa menghapus apa pun.

**`tenantStats`** — `salesCount, revenue, grossProfit, expenseTotal,
productionCount, lastSaleAt, months{}`. Ditulis unit usahanya sendiri dengan
`increment`, dibaca admin. Ada karena admin sengaja tidak bisa membaca subkoleksi
unit usaha mana pun, jadi ia tidak bisa menjumlahkan struk sendiri.

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

**Ringkasan admin selalu ikut batch transaksinya.** `addStatsToBatch` di
`src/services/stats.ts` menambahkan `increment` ke batch yang sudah ada, tidak
pernah menulis terpisah. Beban yang tercatat tapi tidak terhitung di ringkasan
lebih buruk daripada keduanya gagal. Itu juga sebabnya `expenses` memakai
`writeBatch` walaupun cuma menyentuh satu dokumen.

Angka ringkasan itu persis sepercaya data yang mendasarinya, tidak lebih. Unit
usaha memang sudah memegang penuh catatan penjualannya sendiri, jadi ini tidak
menuntut kepercayaan baru. Jangan memakainya untuk audit.

**Unit usaha dinonaktifkan, tidak pernah dihapus.** Firestore tidak menghapus
subkoleksi secara berjenjang, jadi menghapus dokumen tenant hanya meninggalkan
produk dan struknya sebagai data yatim yang tidak bisa dibaca siapa pun. Aturan
memeriksanya lewat `tenantActive()`, dan pemeriksaan itu sengaja **tidak** ikut
pada pembacaan dokumen tenant sendiri, supaya aplikasi bisa menjelaskan kenapa
tidak bisa dibuka alih alih gagal tanpa sebab.

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

**Sesi sengaja dibuat awet, dan tidak ada PIN.** Persistensi auth dipasang
IndexedDB dengan localStorage sebagai cadangan. Refresh token Firebase tidak
punya masa berlaku, jadi selama tidak logout orangnya tidak akan pernah diminta
OTP lagi di perangkat yang sama. Itu memang tujuannya: masuk lewat OTP setiap
buka aplikasi terlalu merepotkan untuk warung.

Kalau nanti ingin menambah kunci layar berupa PIN, sadari batasnya sejak awal:
tanpa backend, PIN tidak mungkin ditukar jadi sesi Firebase, jadi ia hanya
gembok di atas sesi yang sudah hidup, bukan faktor autentikasi.

**`initializeAuth` dipakai, bukan `getAuth`.** Konsekuensinya
`popupRedirectResolver` harus disebut sendiri; tanpa itu login Google gagal
diam diam.

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
- Masuk lewat nomor HP wajib melewati reCAPTCHA, termasuk untuk nomor uji.
  `RecaptchaVerifier.clear()` melempar `auth/internal-error` kalau dipanggil dua
  kali, dan dua pemanggil yang sama sama benar memang memanggilnya dua kali, jadi
  `cleanup` di `src/lib/phoneAuth.ts` dibuat tahan dipanggil berkali kali. Tanpa
  itu seluruh aplikasi kosong tepat setelah kode yang benar dimasukkan.
- Nomor HP **disimpan** selalu dalam E.164 (`+6285…`) dan **ditampilkan** selalu
  sebagai `0851…`. Yang **diketik** boleh bentuk apa pun: `0851…`, `851…`,
  `62851…`, atau `+62851…`, dengan spasi atau tanda hubung sesukanya. Seluruh
  konversinya cuma di `src/lib/phone.ts`; jangan menebak nebak di layar mana pun.
- Nomor uji didaftarkan di Firebase Console, menu Authentication, Sign-in method,
  Phone, Phone numbers for testing. Nomor uji tidak mengirim SMS dan tidak
  memakai kuota.
- Browser headless membuat reCAPTCHA menaikkan tantangan gambar, jadi login HP
  tidak bisa diotomasi apa adanya. Saklar resminya
  `auth.settings.appVerificationDisabledForTesting`, dan itu diset dari luar
  lewat modul yang sama, bukan ditanam di kode aplikasi.

## Aplikasi terpasang

`public/manifest.webmanifest` dan `public/sw.js` membuat aplikasi ini bisa
dipasang ke layar utama. Keduanya berkas statis di `public/`, bukan hasil plugin,
supaya tidak ada langkah build tersembunyi.

**Service worker sengaja tidak menyajikan `index.html` dari cache.** Halaman
selalu diambil dari jaringan lebih dulu, karena `index.html`-lah yang menunjuk
berkas bundel mana yang dipakai. Kalau ia dilayani dari cache, kasir bisa
menjalankan versi lama berhari hari setelah perbaikan dikirim, dan kesalahan
seperti itu nyaris mustahil disadari dari luar. Yang boleh cache-first hanya
`/assets/`, karena nama berkasnya mengandung hash isi sehingga satu nama
selamanya berarti satu isi.

Service worker hanya didaftarkan pada build produksi. Di server pengembangan ia
bersaing dengan hot reload Vite dan menyajikan berkas basi.

Tombol Pasang tidak pernah tergambar kecuali browser benar benar menawarkan
pemasangan, jadi ia hilang sendiri kalau sudah terpasang atau browsernya tidak
mendukung. Safari di iOS tidak pernah mengirim `beforeinstallprompt`, jadi di
sana pemasangan hanya lewat menu Bagikan dan tombolnya memang tidak muncul.
Ikon dirasterisasi dari `public/favicon.svg` yang sama, jadi bentuknya tidak
pernah berbeda antar ukuran.

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
