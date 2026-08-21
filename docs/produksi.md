# Produksi dan HPP

[← Kembali ke indeks](./README.md)

Bagian ini untuk usaha yang **membuat** barangnya sendiri, bukan sekadar
menjualnya kembali. Gula merah, tepung, dan air bukan barang dagangan: ia bahan
yang berubah wujud jadi cenil atau klepon, dan harga pokok satu pcs-nya baru
bisa diketahui dengan menelusuri resepnya.

## Dua jenis produk

```mermaid
flowchart LR
  subgraph bahan["type: bahan"]
    B1["Gula merah, kg"]
    B2["Tepung tapioka, kg"]
    B3["Air galon, liter"]
  end

  subgraph jadi["type: jadi"]
    J1["Cenil, pcs<br/>hasil produksi sendiri"]
    J2["Air mineral, botol<br/>dibeli lalu dijual lagi"]
  end

  bahan -->|"lewat resep dan produksi"| J1
  J1 --> KASIR["Layar kasir"]
  J2 --> KASIR

  bahan -.->|"tidak pernah"| KASIR

  classDef no stroke-dasharray: 5 5
  class bahan no
```

| | `bahan` | `jadi` |
| --- | --- | --- |
| Muncul di kasir | tidak | ya |
| Punya harga jual | tidak | ya |
| Harga modal | dari harga beli | dari harga beli, atau dari HPP produksi |
| Dipakai resep | ya | tidak |

**Dokumen lama tidak perlu dimigrasi.** Produk yang dibuat sebelum fitur ini ada
tidak punya field `type`, dan `mapProduct` membacanya sebagai `jadi`, karena
dulu memang hanya jenis itu yang ada.

## Alur lengkap

```mermaid
flowchart TD
  A["Beli bahan baku"] --> B["Tambah stok bahan<br/>halaman Produk & Stok"]
  B --> C["Buat resep<br/>halaman Resep & HPP"]
  C --> D["Pilih bahan dan takarannya"]
  D --> E["Sistem ambil harga dari stok"]
  E --> F["Hitung biaya tiap bahan"]
  F --> G["Total HPP satu kali produksi"]
  G --> H["Tentukan jumlah hasil"]
  H --> I["HPP per pcs"]

  I --> J{"Jalankan produksi?"}
  J -->|"belum, hanya menghitung"| K["Resep tersimpan.<br/>Stok tidak berubah."]
  J -->|"ya"| L["Catat produksi"]

  L --> M["Stok bahan berkurang"]
  L --> N["Stok produk jadi bertambah"]
  L --> O["Harga modal produk jadi<br/>jadi rata rata tertimbang"]

  N --> P["Siap dijual di kasir"]
  O --> P
  P --> Q["Terjual: harga modal<br/>jadi HPP di laporan laba rugi"]

  classDef ok fill:#047857,stroke:#047857,color:#ffffff
  class I,Q ok
```

Cabang `K` penting: **menyimpan resep tidak menyentuh stok sama sekali.** Resep
adalah alat hitung. Stok baru bergerak ketika produksi benar benar dicatat.

## Kenapa resep tidak menyimpan harga

Resep hanya menyimpan **bahan apa** dan **berapa banyak**. Harganya tidak ikut
disimpan sedikit pun.

```mermaid
flowchart LR
  R["Resep Cenil<br/>gula 100 g<br/>tepung 200 g"] --> C{"computeHpp"}
  P[("products<br/>harga modal terkini")] --> C
  C --> H["HPP per pcs, dihitung<br/>ulang setiap ditampilkan"]

  N["Harga gula naik<br/>18.000 jadi 21.000 per kg"] --> P
  P --> H2["HPP seluruh resep yang<br/>memakai gula ikut naik sendiri"]

  classDef ok fill:#047857,stroke:#047857,color:#ffffff
  class H2 ok
```

Itulah gunanya. Kalau harga disalin ke dalam resep, setiap kenaikan harga
kulakan menuntut pemilik membuka satu per satu resepnya dan memperbarui angka
secara manual, dan HPP akan pelan pelan jadi salah tanpa ada yang sadar.

**Riwayat produksi sebaliknya menyimpan harga**, karena HPP yang sudah terjadi
tidak boleh berubah. Ini pola yang sama persis dengan baris penjualan yang
menyimpan salinan harganya sendiri.

## Konversi satuan

Resep menulis gram, stok dibeli per kilo. Tanpa konversi, biaya bahan meleset
seribu kali lipat.

```mermaid
flowchart TD
  A["Resep: gula 100 gram"] --> B{"convert(100, gram, kg)"}
  B --> C["0,1 kg"]
  D["Stok: gula 18.000 per kg"] --> E
  C --> E["0,1 x 18.000"]
  E --> F["Biaya bahan Rp 1.800"]

  G["Resep: gula 100 ml"] --> H{"convert(100, gram, ml)"}
  H --> I["null, beda dimensi"]
  I --> J["Baris ditandai bermasalah,<br/>tombol Produksi dinonaktifkan"]

  classDef ok fill:#047857,stroke:#047857,color:#ffffff
  classDef bad fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  class F ok
  class J bad
```

Tiga dimensi, konversi hanya boleh di dalam dimensi yang sama:

| Dimensi | Satuan dasar | Satuan lain |
| --- | --- | --- |
| berat | gram | ons (100), kg (1000) |
| volume | ml | liter (1000) |
| jumlah | pcs | bungkus, botol, sachet, kotak, karung, porsi, lusin (12) |

**Gram tidak bisa jadi mililiter.** 100 ml air dan 100 ml minyak beratnya
berbeda, dan aplikasi ini tidak menyimpan massa jenis. `convert` mengembalikan
`null` alih alih menebak, dan pemanggilnya wajib menangani kasus itu.

Untuk bahan bersatuan jumlah, hanya satuannya sendiri yang ditawarkan: mengubah
botol jadi sachet tidak punya arti apa apa.

## Contoh perhitungan

Resep Cenil, menghasilkan 20 pcs.

| Bahan | Pemakaian | Satuan stok | Harga modal | Konversi | Biaya |
| --- | --- | --- | --- | --- | --- |
| Gula merah | 100 gram | kg | 18.000 / kg | 0,1 kg | 1.800 |
| Tepung tapioka | 200 gram | kg | 12.000 / kg | 0,2 kg | 2.400 |
| Air galon | 100 ml | liter | 1.200 / liter | 0,1 liter | 120 |
| | | | | **HPP produksi** | **4.320** |
| | | | | **HPP per pcs** | **216** |

Kalau harga jual Cenil 1.500 per pcs, labanya 1.284 per pcs dengan margin 86%.
Angka itu tampil langsung di daftar resep, jadi keputusan harga tidak perlu
menunggu akhir bulan.

**Pembulatan dilakukan per baris**, bukan sekali di akhir. Dengan begitu total
yang tampil sama persis dengan hasil menjumlahkan angka tiap barisnya secara
manual, dan tidak ada selisih satu dua rupiah yang bikin bingung.

## Menjalankan produksi

```mermaid
sequenceDiagram
  autonumber
  actor U as Pemilik
  participant PM as ProductionModal
  participant HPP as lib/hpp
  participant SV as services/productions
  participant SRV as Firestore

  U->>PM: tekan Produksi pada sebuah resep
  PM->>PM: jumlah batch, default 1
  PM->>HPP: computeHpp(bahan x batch, hasil)
  HPP-->>PM: rincian biaya dan HPP per pcs
  PM->>HPP: checkMaterialStock
  HPP-->>PM: daftar bahan yang kurang

  alt ada bahan kurang
    PM-->>U: peringatan merah, tombol simpan nonaktif
  else stok cukup
    U->>PM: koreksi hasil nyata bila perlu
    U->>PM: tekan Catat produksi
    PM->>SV: createProduction

    Note over SV: satu writeBatch
    SV->>SV: set dokumen productions
    SV->>SV: tiap bahan, stock increment(-pakai)
    SV->>SV: produk jadi, stock increment(+hasil)
    SV->>SV: produk jadi, costPrice rata rata tertimbang

    SV->>SRV: commit
    SRV-->>PM: berhasil
    PM-->>U: toast, HPP per pcs disebutkan
  end
```

### Jumlah batch dan hasil nyata dipisah

Dapur tidak selalu menghasilkan persis seperti resep. Karena itu ada dua kolom:

- **Jumlah batch** menskalakan pemakaian bahan.
- **Hasil nyata** diisi apa adanya, sesuai hitungan fisik.

HPP per pcs dibagi dengan hasil nyata, bukan hasil teoretis. Kalau satu batch
seharusnya jadi 20 pcs tapi nyatanya cuma 18 karena ada yang gagal, HPP per
pcs-nya memang naik, dan laporan harus jujur soal itu.

## Rata rata tertimbang harga modal

```mermaid
flowchart TD
  A["Sisa stok lama<br/>10 pcs, modal 300"] --> C{"blendedCostPrice"}
  B["Produksi baru<br/>10 pcs, HPP 200"] --> C
  C --> D["(10x300 + 10x200) / 20<br/>= 250 per pcs"]

  E["Kalau ditimpa begitu saja<br/>jadi 200"] --> F["Sisa stok lama ikut dinilai 200,<br/>laba 10 pcs pertama salah hitung"]

  classDef ok fill:#047857,stroke:#047857,color:#ffffff
  classDef bad fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  class D ok
  class F bad
```

Kalau stok produk jadi sedang nol, rata ratanya sama saja dengan HPP produksi
terbaru, dan inilah keadaan yang paling sering terjadi.

## Produksi bukan beban

Ini kelanjutan langsung dari aturan yang sudah berlaku di
[Akuntansi](./akuntansi.md#kapan-modal-barang-diakui).

```mermaid
flowchart LR
  A["Beli gula 180.000"] --> B["Persediaan bahan<br/>+180.000"]
  B -.->|"BUKAN beban"| X1["expenses"]

  C["Produksi cenil"] --> D["Persediaan bahan -4.320<br/>Persediaan produk jadi +4.320"]
  D -.->|"BUKAN beban"| X2["expenses"]

  E["Cenil terjual"] --> F["HPP 4.320 masuk<br/>laporan laba rugi"]

  G["Bayar gas dan listrik"] --> H["expenses<br/>beban operasional"]

  classDef no fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  classDef ok fill:#047857,stroke:#047857,color:#ffffff
  class X1,X2 no
  class F,H ok
```

Produksi hanya **memindahkan nilai** dari satu persediaan ke persediaan lain.
Total nilai persediaan tidak berubah sedikit pun. Modal baru diakui sebagai HPP
ketika produknya terjual.

Mencatat produksi sebagai beban akan menghitung modal dua kali, persis kesalahan
yang sama seperti mencatat pembelian stok sebagai beban.

> **Yang belum termasuk.** HPP di sini adalah **biaya bahan baku saja**. Tenaga
> kerja, gas, dan listrik tidak ikut dibebankan ke produk, melainkan dicatat di
> Beban Operasional sehingga memotong laba bersih satu kali. Untuk perhitungan
> harga pokok penuh, biaya biaya itu perlu ikut diserap ke dalam HPP, dan itu
> belum tersedia.

## Membatalkan produksi

Dokumen produksi tidak bisa diedit, sama seperti dokumen penjualan. Koreksi
dilakukan dengan membatalkan.

```mermaid
flowchart TD
  A["Tekan Batalkan"] --> B["writeBatch"]
  B --> C["hapus dokumen productions"]
  B --> D["stok bahan increment(+pakai)"]
  B --> E["stok produk jadi increment(-hasil)"]

  E --> F{"Produk sudah terjual?"}
  F -->|"ya, stok jadi minus"| G["Security Rules menolak<br/>seluruh batch. Pembatalan gagal."]
  F -->|"belum"| H["Berhasil"]

  I["Harga modal TIDAK dikembalikan"] -.- H

  classDef bad fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  classDef ok fill:#047857,stroke:#047857,color:#ffffff
  class G bad
  class H ok
```

Dua batasan yang perlu diketahui:

1. **Harga modal tidak dikembalikan ke nilai sebelumnya.** Rata rata tertimbang
   tidak bisa dibalik tanpa menyimpan riwayat nilainya. Kalau ini penting,
   perbaiki harga modalnya lewat form produk.
2. **Pembatalan gagal kalau produknya sudah terjual**, karena stok jadi negatif
   dan aturan menolaknya. Itu memang pencegahan yang benar: barang yang sudah
   berpindah ke pembeli tidak bisa dianggap tidak pernah diproduksi.

## Model data

```mermaid
erDiagram
  PRODUCTS_BAHAN ||..o{ RECIPE_ITEMS : "dirujuk"
  RECIPES ||--|{ RECIPE_ITEMS : "memuat"
  RECIPES ||--o| PRODUCTS_JADI : "menghasilkan"
  PRODUCTIONS ||--|{ PRODUCTION_ITEMS : "memuat"
  RECIPES ||..o{ PRODUCTIONS : "dipakai"

  RECIPES {
    string id PK
    string productId FK "produk jadi"
    string productName "salinan"
    number yieldQty "hasil satu kali produksi"
    string yieldUnit
    string note
  }

  RECIPE_ITEMS {
    string materialId FK "referensi lemah"
    string materialName "salinan"
    number qty
    string unit "satuan PEMAKAIAN"
  }

  PRODUCTIONS {
    string id PK
    string productionNo "PRD-YYMMDD-HHMMSS"
    string productId FK
    string recipeId FK "boleh menggantung"
    number materialCost "HPP satu produksi"
    number yieldQty "hasil nyata"
    number costPerUnit "HPP per pcs"
    string operatorId FK
    string operatorName
    timestamp createdAt
  }

  PRODUCTION_ITEMS {
    string materialId
    number qty
    string unit
    number qtyInStockUnit "hasil konversi"
    string stockUnit
    number costPerStockUnit "SALINAN harga saat produksi"
    number cost
  }
```

Perhatikan bedanya: `RECIPE_ITEMS` tidak punya field harga sama sekali,
sementara `PRODUCTION_ITEMS` menyimpan `costPerStockUnit`. Itu bukan
ketidakkonsistenan, itu justru inti rancangannya.

## Aturan keamanan

| Koleksi | read | create | update | delete |
| --- | --- | --- | --- | --- |
| `recipes` | staf | staf + validasi | staf + validasi | staf |
| `productions` | staf | staf + validasi + `operatorId == uid` | **tidak pernah** | staf |

`productions` tidak bisa diedit dengan alasan yang sama seperti `sales`: HPP
historis tidak boleh diubah diam diam.

## Kalau bahan dihapus

`materialId` adalah referensi lemah, sama seperti `productId` pada baris
penjualan. Ia boleh menunjuk dokumen yang sudah tidak ada.

| Tempat | Perilaku |
| --- | --- |
| Daftar resep | Baris ditandai "perlu diperbaiki", tombol Produksi dinonaktifkan |
| Form resep | Baris memberi pesan "Bahan sudah dihapus dari daftar produk" |
| Riwayat produksi | Tetap utuh, karena menyimpan salinan nama dan harganya |
| Membatalkan produksi | Bahan yang hilang dilewati, sisanya tetap dikembalikan |

Total HPP resep yang punya baris bermasalah **tidak boleh dipercaya**, dan
karena itu produksinya dicegah, bukan sekadar diberi peringatan.
