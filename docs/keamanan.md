# Keamanan

[← Kembali ke indeks](./README.md)

Tanpa backend, [`firestore.rules`](../firestore.rules) adalah satu satunya hal
yang benar benar menjaga data. Semua yang ada di kode frontend bisa dibaca dan
dimodifikasi siapa saja lewat DevTools.

## Apa yang publik dan apa yang rahasia

```mermaid
flowchart LR
  subgraph pub["Publik, memang begitu rancangannya"]
    P1["VITE_FIREBASE_API_KEY"]
    P2["projectId, appId,<br/>authDomain, senderId"]
    P3["Seluruh kode frontend"]
    P4["Rumus laba, aturan diskon"]
  end

  subgraph sec["Rahasia, tidak boleh bocor"]
    S1["serviceAccountKey.json"]
    S2["Kata sandi akun pengguna"]
  end

  subgraph guard["Yang menjaga"]
    G1["firestore.rules"]
    G2["Dokumen users/uid<br/>beserta tenantId"]
  end

  pub -.->|"tidak melindungi apa pun"| guard
  S1 -->|"MELEWATI rules sepenuhnya"| X["Akses penuh seluruh proyek"]

  classDef danger fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  class X,S1 danger
```

`VITE_FIREBASE_API_KEY` **bukan kata sandi**. Ia pengenal proyek yang memang ikut
ter-bundle ke browser pada setiap aplikasi Firebase. Menyembunyikannya tidak
menambah keamanan sedikit pun.

`serviceAccountKey.json` sebaliknya adalah kunci sesungguhnya. Ia melewati
Security Rules sepenuhnya. Berkas itu ada di `.gitignore` dengan tiga pola
(`serviceAccountKey.json`, `*serviceAccount*.json`, `*-firebase-adminsdk-*.json`)
dan hanya dipakai `scripts/seed.mjs` yang dijalankan manual.

## Model ancaman

| Ancaman | Kemungkinan | Yang menahan | Sisa risiko |
| --- | --- | --- | --- |
| Orang asing menebak URL aplikasi | Tinggi | Guard rute lalu Security Rules | Tidak ada, data tidak terbaca |
| Pemilik akun Google atau nomor HP acak berhasil autentikasi | **Tinggi** | Dokumen `users/{uid}` wajib ada | Tidak ada, semua koleksi menolak |
| Orang tak diundang mendaftarkan dirinya lewat nomor HP | Sedang | Undangan wajib ada untuk nomor di tokennya | Tidak ada |
| Orang diundang jadi kasir mendaftarkan diri jadi pemilik | Rendah | Peran dibaca dari undangan di sisi server | Tidak ada |
| Orang warung membaca pembukuan warung tetangga | **Tinggi** | Tenant ada di jalur dokumen, `isMemberOf(tenantId)` | Tidak ada, jalur lain ditolak server |
| Akun admin platform bocor | Sedang | Admin tidak diberi akses ke subkoleksi tenant mana pun | Daftar warung dan pengguna terbuka, pembukuan tidak |
| Penyerang memanggil Firestore REST langsung, melewati aplikasi | Sedang | Security Rules, tidak bergantung pada klien | Tidak ada |
| Kasir mengubah laba transaksi lama | Sedang | `allow update: if false` pada `sales` | Bisa menghapus lalu input ulang, dan itu tercatat sebagai hilangnya struk |
| Orang warung mendaftarkan dirinya atau orang lain | Rendah | `users` hanya bisa ditulis `isAdmin()` | Tidak ada dari aplikasi |
| Siapa pun mengangkat dirinya jadi admin platform | Rendah | Seluruh tulisan ke `users` menuntut `isAdmin()` | Tidak ada bagi yang belum terdaftar |
| Admin yang bocor mencetak admin lain | Rendah | Tidak ditahan | **Ada.** Mengusirnya berarti mencabut juga semua yang dibuatnya |
| Admin salah klik menghapus aksesnya sendiri | Rendah | `keepsOwnStanding()` dan larangan hapus diri sendiri | Tidak ada |
| Unit usaha memalsukan angka ringkasannya | Rendah | Tidak ditahan, dan disengaja | Ringkasan sepercaya catatan yang mendasarinya, tidak lebih |
| Oversell stok dari dua perangkat | Rendah | Rules menolak stok negatif | Batch ditolak, transaksi gagal dan harus diulang |
| `serviceAccountKey.json` ter-commit | Rendah | Tiga pola `.gitignore` | Total kalau sampai lolos, harus dicabut di Console |
| Penulisan offline oleh akun yang aksesnya dicabut | Rendah | Rules memeriksa saat sinkron | Data di-rollback diam diam, kasir tidak diberi tahu |

Baris terakhir adalah kelemahan yang diketahui dan diterima. Lihat
[Alur Kasir](./alur-kasir.md#batasannya-jujur).

## Lapisan pertahanan

```mermaid
flowchart TD
  REQ(["Permintaan ke Firestore"]) --> L1

  subgraph L1["Lapis 1: guard rute, di klien"]
    A1["RequireAuth, RedirectIfAuthenticated,<br/>RequireAdmin, RequireTenantUser"]
  end

  subgraph L2["Lapis 2: pemeriksaan pendaftaran, di klien"]
    A2["AuthContext getAppUser"]
  end

  subgraph L3["Lapis 3: Security Rules, di server"]
    A3["isMemberOf() atau isAdmin()<br/>+ validasi bentuk data"]
  end

  L1 --> L2 --> L3 --> DB[("Firestore")]

  BYPASS(["Penyerang dengan curl<br/>atau DevTools"]) -.->|"melewati lapis 1 dan 2"| L3

  note["Hanya lapis 3 yang tidak bisa dilewati.<br/>Lapis 1 dan 2 murni untuk<br/>pengalaman pengguna."]
  L3 -.- note

  classDef server fill:#047857,stroke:#047857,color:#ffffff
  class L3 server
```

Jangan pernah memindahkan aturan yang penting dari lapis 3 ke lapis 1 atau 2
dengan alasan "supaya lebih cepat". Keduanya bukan keamanan.

## Pembedahan Security Rules

### Tiga gerbang

```javascript
function isActive() {
  return isRegistered() && me().active == true;
}

function isAdmin() {
  return isActive() && me().role == 'admin';
}

function belongsTo(tenantId) {
  return isActive() && me().tenantId == tenantId;
}

function tenantActive(tenantId) {
  return get(/databases/$(database)/documents/tenants/$(tenantId)).data.active != false;
}

function isMemberOf(tenantId) {
  return belongsTo(tenantId) && tenantActive(tenantId);
}
```

`belongsTo()` dan `isMemberOf()` sengaja dipisah. Membaca dokumen unit usahanya
sendiri cukup `belongsTo()`, tanpa memeriksa status aktif, supaya orang dari unit
yang baru dinonaktifkan mendapat penjelasan alih alih `permission-denied` yang
dibaca aplikasi sebagai gangguan jaringan. Yang dijaga status aktif adalah
datanya, bukan identitasnya.

`me()` adalah `get()` ke `users/{request.auth.uid}`, dibaca **di server**. Itu
sebabnya `tenantId` tidak bisa dipalsukan: browser tidak pernah menyebutkannya,
aturan yang mengambilnya sendiri.

```mermaid
flowchart TD
  R(["Permintaan masuk"]) --> A{"request.auth != null?"}
  A -->|"tidak"| D1["DITOLAK<br/>belum autentikasi"]
  A -->|"ya"| B{"users/uid ada?"}
  B -->|"tidak"| D2["DITOLAK<br/>terautentikasi tapi belum terdaftar"]
  B -->|"ya"| C{"active == true?"}
  C -->|"tidak"| D3["DITOLAK<br/>aksesnya dicabut sementara"]
  C -->|"ya"| E{"jalur yang diminta"}

  E -->|"tenants/{id}/..."| F{"users.tenantId == id?"}
  F -->|"tidak"| D4["DITOLAK<br/>warung orang lain"]
  F -->|"ya"| OK1["LOLOS ke validasi bentuk data"]

  E -->|"users atau tenants"| G{"role == 'admin'?"}
  G -->|"tidak"| D5["DITOLAK<br/>bukan admin platform"]
  G -->|"ya"| OK2["LOLOS"]

  classDef no fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  classDef ok fill:#047857,stroke:#047857,color:#ffffff
  class D1,D2,D3,D4,D5 no
  class OK1,OK2 ok
```

Cabang `D2` adalah alasan seluruh mekanisme ini ada. Kalau setiap akun dibuat
pemilik toko sendiri, "sudah login" berarti "orang toko". Dengan Google dan nomor
HP terbuka untuk siapa saja, asumsi itu runtuh.

Cabang `D4` adalah sekat antar warung, dan ia bekerja karena tenant ada di jalur
dokumen. Lihat [Multi Warung](./multi-warung.md#tenant-sebagai-jalur-bukan-field).

### Satu satunya pendaftaran mandiri

`users` punya satu jalan masuk yang tidak melewati admin secara langsung: orang
yang baru masuk lewat nomor HP menulis barisnya sendiri, kalau ada undangan
untuk nomornya.

```mermaid
flowchart TD
  A["Menulis users/{uid} untuk dirinya sendiri"] --> B{"request.auth.uid == uid?"}
  B -->|"tidak"| D1["DITOLAK"]
  B -->|"ya"| C{"phone di dokumen<br/>== phone_number di token?"}
  C -->|"tidak"| D2["DITOLAK<br/>memakai nomor orang lain"]
  C -->|"ya"| E{"invites/{phone} ada?"}
  E -->|"tidak"| D3["DITOLAK<br/>tidak diundang"]
  E -->|"ya"| F{"peran dan tenantId<br/>sama dengan undangannya?"}
  F -->|"tidak"| D4["DITOLAK<br/>mengarang kedudukan"]
  F -->|"ya"| G{"peran bukan admin?"}
  G -->|"admin"| D5["DITOLAK"]
  G -->|"bukan"| OK["LOLOS"]

  classDef no fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  classDef ok fill:#047857,stroke:#047857,color:#ffffff
  class D1,D2,D3,D4,D5 no
  class OK ok
```

`phone_number` datang dari token yang ditandatangani Firebase setelah OTP-nya
berhasil, jadi tidak ada cara mengaku ngaku memiliki nomor orang lain. Peran dan
`tenantId` dibaca ulang dari dokumen undangan **di sisi server**, sehingga apa
pun yang dikirim browser tidak menentukan apa apa.

> `exists()` dan `get()` menambah operasi baca per evaluasi aturan. Untuk warung
> satu gerai jumlahnya tidak berarti, tapi perlu diingat kalau kelak ada kueri
> yang membaca ribuan dokumen sekaligus.

### Matriks izin

Untuk ringkasnya, "warga" berarti `isMemberOf(tenantId)`, yaitu orang warung itu
sendiri, dan "admin" berarti `isAdmin()`.

| Jalur | read | create | update | delete |
| --- | --- | --- | --- | --- |
| `users/{uid}` | uid itu sendiri, atau admin | admin + validasi, **atau** pemilik nomor yang punya undangan cocok | admin + validasi + tidak mengubah kedudukan sendiri | admin, kecuali barisnya sendiri |
| `invites/{nomor}` | admin, atau pemilik nomornya | admin + validasi | admin + validasi | admin, atau pemilik nomornya |
| `tenants/{id}` | warga (tanpa cek aktif), atau admin | admin | admin | admin |
| `tenantStats/{id}` | warga, atau admin | warga | warga | warga |
| `tenants/{id}/products` | warga | warga + validasi | warga + validasi | warga |
| `tenants/{id}/recipes` | warga | warga + validasi | warga + validasi | warga |
| `tenants/{id}/productions` | warga | warga + validasi + `operatorId == uid` | **tidak pernah** | warga |
| `tenants/{id}/sales` | warga | warga + validasi + `cashierId == uid` | **tidak pernah** | warga |
| `tenants/{id}/expenses` | warga | warga + validasi | warga + validasi | warga |

`tenantStats` adalah satu satunya tempat admin bisa melihat angka usaha, dan ia
hanya membaca. Isinya tidak divalidasi bentuknya, dan itu keputusan sadar: unit
usaha sudah memegang penuh catatan penjualannya sendiri, jadi membiarkannya
menulis ringkasannya sendiri tidak menambah kepercayaan baru yang harus
diberikan. Yang dijaga adalah tidak ada unit usaha yang bisa menulis ringkasan
milik unit usaha lain.

**Perhatikan bahwa `admin` tidak muncul sama sekali di lima baris subkoleksi.**
Ketiadaan itulah jaminannya: satu akun admin yang bocor tidak berarti seluruh
pembukuan semua warung ikut terbuka. Jangan menambahkannya tanpa alasan baru yang
kuat.

Dua pengecualian kecil punya alasannya masing masing. Admin tidak boleh menghapus
barisnya sendiri, karena platform bisa kehilangan admin terakhirnya dan tidak ada
cara memulihkannya dari dalam aplikasi. Dan membaca `users/{uid}` sendiri
sengaja terbuka bagi siapa pun yang sudah login, karena orang yang belum
terdaftar perlu mendapat jawaban "tidak ada" supaya bisa ditolak dengan pesan
yang benar; kalau permintaannya ditolak aturan, klien membacanya sebagai
gangguan jaringan.

### Kenapa `sales` tidak bisa diedit

```mermaid
flowchart LR
  A["Struk salah"] --> B{"Cara koreksi"}
  B -->|"kalau update diizinkan"| C["Ubah angka diam diam"]
  C --> D["Laba historis berubah<br/>tanpa jejak"]
  B -->|"aturan sekarang"| E["Batalkan struk"]
  E --> F["Stok dikembalikan,<br/>dokumen hilang dari riwayat"]
  F --> G["Input ulang jadi struk baru<br/>dengan nomor baru"]

  classDef bad fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  classDef ok fill:#047857,stroke:#047857,color:#ffffff
  class D bad
  class G ok
```

Pembatalan tetap menghapus jejak, jadi ini bukan audit trail sungguhan. Tapi ia
mencegah skenario yang lebih berbahaya: mengubah satu angka pada struk lama tanpa
ada yang menyadarinya.

### Validasi bentuk data

Rules tidak hanya memeriksa siapa, tapi juga apa yang ditulis.

| Koleksi | Yang diperiksa |
| --- | --- |
| `products` | `name` string tidak kosong; `costPrice`, `sellPrice`, `stock` angka >= 0 |
| `sales` | `cashierId` sama dengan uid pemanggil; `items` list tidak kosong; `total`, `totalCost` angka >= 0 |
| `expenses` | `description` string; `amount` angka >= 0 |

Pemeriksaan `stock >= 0` pada `products` berfungsi ganda sebagai **pencegah
oversell di sisi server**. `request.resource.data` berisi dokumen setelah
transform `increment` diterapkan, sehingga penjualan yang membuat stok jadi
negatif ditolak seluruh batch-nya.

Efek sampingnya perlu diketahui: transaksi itu **gagal total**, bukan tersimpan
sebagian. Kodenya ditangkap `saleErrorMessage` dan diterjemahkan jadi
"Kemungkinan stok salah satu barang sudah habis terjual dari perangkat lain."
daripada "permission denied" yang tidak berarti apa apa bagi kasir.

## Memverifikasi aturan sudah terpasang

Emulator Firestore butuh Java. Kalau tidak tersedia, pakai **Rules Playground**
di Firebase Console yang tidak butuh perkakas lokal sama sekali.

```mermaid
flowchart TD
  A["Console > Firestore > Rules<br/>> Rules Playground"] --> B["Jalankan 6 kasus"]
  B --> C1["tenants/A/products/x, tanpa auth<br/>harus Denied"]
  B --> C2["tenants/A/products/x, uid acak<br/>harus Denied"]
  B --> C3["tenants/A/products/x, uid warga A<br/>harus Allowed"]
  B --> C4["tenants/B/products/x, uid warga A<br/>harus Denied"]
  B --> C5["tenants/A/products/x, uid admin<br/>harus Denied"]
  B --> C6["users/uid_lain, uid warga A<br/>harus Denied"]
  B --> C7["tenants/A/products/x, warga A,<br/>saat A nonaktif, harus Denied"]

  C2 --> D{"Hasilnya Allowed?"}
  D -->|"ya"| E["Aturan BELUM terpasang.<br/>Ulangi Publish."]
  D -->|"tidak"| F["Aturan aktif"]

  classDef bad fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  classDef ok fill:#047857,stroke:#047857,color:#ffffff
  class E bad
  class F ok
```

Kasus kedua yang paling penting. Ia membuktikan sekadar punya akun Google tidak
cukup untuk membaca data toko.

## Kesalahan yang sering terjadi

| Gejala | Penyebab | Perbaikan |
| --- | --- | --- |
| Semua kueri kena `permission-denied` walau sudah masuk | Dokumen `users/{uid}` belum dibuat, id dokumennya id otomatis dan bukan uid, `active` bernilai false, atau `tenantId`-nya menunjuk warung yang sudah tidak ada | Periksa barisnya di halaman Pengguna |
| Aturan sudah diubah di repo tapi Firestore masih menolak | Rules tidak ikut ter-deploy lewat Vercel | `firebase deploy --only firestore:rules` |
| Login Google gagal di produksi tapi berhasil di localhost | Domain Vercel belum terdaftar | Console > Authentication > Settings > Authorized domains |
| Aplikasi bisa dibuka siapa saja | Firestore masih memakai aturan mode uji bawaan | Terapkan `firestore.rules` |

## Kalau kunci service account bocor

1. Firebase Console > Project settings > Service accounts, **hapus kunci itu**.
2. Buat kunci baru untuk pemakaian yang sah.
3. Periksa Firestore untuk dokumen yang tidak dikenal, terutama koleksi `users`:
   baris asing di sana berarti akses ke salah satu warung.
4. Kalau kuncinya pernah ter-commit, menghapusnya dari commit terbaru tidak cukup
   karena ia masih ada di history. Kunci harus dicabut di Console.

Kunci di repositori ini sudah diperiksa: tidak pernah masuk history git.
