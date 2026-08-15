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
    S2["Kata sandi akun staf"]
  end

  subgraph guard["Yang menjaga"]
    G1["firestore.rules"]
    G2["Dokumen staff/uid"]
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
| Pemilik akun Google acak menekan "Masuk dengan Google" | **Tinggi** | Dokumen `staff/{uid}` wajib ada | Tidak ada, semua koleksi menolak |
| Penyerang memanggil Firestore REST langsung, melewati aplikasi | Sedang | Security Rules, tidak bergantung pada klien | Tidak ada |
| Kasir mengubah laba transaksi lama | Sedang | `allow update: if false` pada `sales` | Bisa menghapus lalu input ulang, dan itu tercatat sebagai hilangnya struk |
| Kasir mendaftarkan dirinya jadi pemilik | Rendah | `staff` `allow write: if false` | Tidak ada dari aplikasi |
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
    A1["RequireAuth,<br/>RedirectIfAuthenticated"]
  end

  subgraph L2["Lapis 2: pemeriksaan staf, di klien"]
    A2["AuthContext getStaffProfile"]
  end

  subgraph L3["Lapis 3: Security Rules, di server"]
    A3["isStaff() + validasi bentuk data"]
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

### Gerbang `isStaff()`

```javascript
function isStaff() {
  return request.auth != null
    && exists(/databases/$(database)/documents/staff/$(request.auth.uid));
}
```

```mermaid
flowchart TD
  R(["Permintaan masuk"]) --> A{"request.auth != null?"}
  A -->|"tidak"| D1["DITOLAK<br/>belum autentikasi"]
  A -->|"ya"| B{"dokumen staff/uid ada?"}
  B -->|"tidak"| D2["DITOLAK<br/>terautentikasi tapi bukan staf"]
  B -->|"ya"| C["LOLOS ke validasi bentuk data"]

  classDef no fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  classDef ok fill:#047857,stroke:#047857,color:#ffffff
  class D1,D2 no
  class C ok
```

Cabang `D2` adalah alasan seluruh mekanisme ini ada. Sebelum Google Sign-In,
pemilik toko sendiri yang membuat setiap akun sehingga "sudah login" berarti
"orang toko". Setelah Google aktif, asumsi itu runtuh.

> `exists()` menambah satu operasi baca per evaluasi aturan. Untuk warung satu
> gerai jumlahnya tidak berarti, tapi perlu diingat kalau kelak ada kueri yang
> membaca ribuan dokumen sekaligus.

### Matriks izin

| Koleksi | read | create | update | delete |
| --- | --- | --- | --- | --- |
| `staff` | pemilik uid itu sendiri | tidak pernah | tidak pernah | tidak pernah |
| `products` | staf | staf + validasi | staf + validasi | staf |
| `sales` | staf | staf + validasi + `cashierId == uid` | **tidak pernah** | staf |
| `expenses` | staf | staf + validasi | staf + validasi | staf |

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
  A["Console > Firestore > Rules<br/>> Rules Playground"] --> B["Jalankan 4 kasus"]
  B --> C1["get /products/x, tanpa auth<br/>harus Denied"]
  B --> C2["get /products/x, uid acak<br/>harus Denied"]
  B --> C3["get /products/x, uid staf<br/>harus Allowed"]
  B --> C4["get /staff/uid_lain, uid staf<br/>harus Denied"]

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
| Semua kueri kena `permission-denied` walau sudah masuk | Dokumen `staff/{uid}` belum dibuat, atau id dokumennya id otomatis, bukan uid | Buat ulang dengan id dokumen = uid Auth |
| Aturan sudah diubah di repo tapi Firestore masih menolak | Rules tidak ikut ter-deploy lewat Vercel | `firebase deploy --only firestore:rules` |
| Login Google gagal di produksi tapi berhasil di localhost | Domain Vercel belum terdaftar | Console > Authentication > Settings > Authorized domains |
| Aplikasi bisa dibuka siapa saja | Firestore masih memakai aturan mode uji bawaan | Terapkan `firestore.rules` |

## Kalau kunci service account bocor

1. Firebase Console > Project settings > Service accounts, **hapus kunci itu**.
2. Buat kunci baru untuk pemakaian yang sah.
3. Periksa Firestore untuk dokumen yang tidak dikenal, terutama koleksi `staff`.
4. Kalau kuncinya pernah ter-commit, menghapusnya dari commit terbaru tidak cukup
   karena ia masih ada di history. Kunci harus dicabut di Console.

Kunci di repositori ini sudah diperiksa: tidak pernah masuk history git.
