# Alur Kasir

[← Kembali ke indeks](./README.md)

Layar yang paling sering dipakai dan paling tidak boleh gagal. Kodenya tersebar
di [`src/pages/CashierPage.tsx`](../src/pages/CashierPage.tsx),
[`src/features/cashier/`](../src/features/cashier/), dan
[`src/services/sales.ts`](../src/services/sales.ts).

## Tata letak layar

Layar kasir memakai `fullBleed: true` di `navigation.ts`, artinya ia mengatur
tinggi dan scroll sendiri tanpa padding dari kerangka aplikasi.

```mermaid
flowchart LR
  subgraph desktop["Desktop, lebar >= 1024px"]
    direction LR
    A["Pemilih produk<br/>pencarian, chip kategori,<br/>grid kartu"] --- B["Keranjang<br/>lebar tetap 24rem,<br/>menempel penuh"]
  end

  subgraph mobile["Ponsel, lebar < 1024px"]
    direction TB
    C["Pemilih produk<br/>satu kolom penuh"] --> D["Bilah total melayang<br/>di dasar layar"]
    D -->|"ditekan"| E["Lembar keranjang<br/>modal"]
  end
```

**Kenapa begitu.** Di ponsel, keranjang yang selalu tampil akan memakan setengah
layar dan menyisakan ruang terlalu sempit untuk memilih barang. Bilah total
melayang menjaga informasi harga tetap terlihat tanpa mengorbankan grid produk.

## Alur satu transaksi

```mermaid
flowchart TD
  START(["Kasir membuka /kasir"]) --> LOAD["useProducts berlangganan<br/>onSnapshot products"]
  LOAD --> PICK{"Cara memilih barang"}

  PICK -->|"ketuk kartu"| ADD["handleAdd(product)"]
  PICK -->|"ketik lalu Enter,<br/>atau pindai barcode"| SEARCH["handleSearchSubmit"]

  SEARCH --> MATCH{"Cocok dengan apa?"}
  MATCH -->|"sku persis sama"| ADD
  MATCH -->|"tepat satu hasil tersisa"| ADD
  MATCH -->|"nol atau banyak hasil"| NOOP["tidak melakukan apa apa,<br/>daftar tetap tersaring"]
  NOOP --> PICK

  ADD --> STOCKCHK{"qty di keranjang<br/>sudah menyentuh stok?"}
  STOCKCHK -->|"ya"| TOAST["toast merah:<br/>Stok tinggal sekian"]
  TOAST --> PICK
  STOCKCHK -->|"belum"| CART["useCart.addItem<br/>salin harga jual dan harga modal"]

  CART --> MORE{"Tambah barang lagi?"}
  MORE -->|"ya"| PICK
  MORE -->|"tidak"| DISC["Isi diskon, opsional"]

  DISC --> PAY["Tekan Bayar"]
  PAY --> MODAL["PaymentModal terbuka"]
  MODAL --> METHOD{"Metode bayar"}

  METHOD -->|"tunai"| CASH["Isi uang diterima,<br/>tombol saran nominal,<br/>kembalian dihitung langsung"]
  METHOD -->|"QRIS atau transfer"| EXACT["Nominal dicatat pas<br/>sebesar total tagihan"]

  CASH --> SHORT{"uang cukup?"}
  SHORT -->|"belum"| BLOCK["Tombol selesai nonaktif,<br/>tampilkan kekurangannya"]
  BLOCK --> CASH
  SHORT -->|"cukup"| CONFIRM
  EXACT --> CONFIRM["Tekan Selesaikan transaksi"]

  CONFIRM --> RECHECK{"Periksa ulang stok<br/>terhadap snapshot terbaru"}
  RECHECK -->|"ada yang kurang"| OVER["toast merah,<br/>batal simpan"]
  OVER --> MODAL
  RECHECK -->|"cukup"| WRITE["createSale, writeBatch"]

  WRITE --> RESULT{"Hasil"}
  RESULT -->|"berhasil"| DONE["Keranjang dikosongkan,<br/>ReceiptModal terbuka"]
  RESULT -->|"gagal"| ERR["saleErrorMessage,<br/>keranjang TIDAK dikosongkan"]

  DONE --> PRINT{"Cetak struk?"}
  PRINT -->|"ya"| WINPRINT["window.print()"]
  PRINT -->|"tidak"| NEXT
  WINPRINT --> NEXT["Transaksi berikutnya,<br/>fokus kembali ke kolom cari"]
  NEXT --> PICK

  classDef danger fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  classDef ok fill:#047857,stroke:#047857,color:#ffffff
  class TOAST,BLOCK,OVER,ERR danger
  class DONE ok
```

Perhatikan cabang gagal: **keranjang tidak dikosongkan**. Kalau penulisan gagal
lalu keranjang ikut hilang, kasir harus memindai ulang seluruh belanjaan di depan
antrean pembeli.

## Dukungan pemindai barcode

Pemindai barcode USB bekerja sebagai papan ketik: ia mengetik kode lalu menekan
Enter. Tidak ada pustaka khusus yang dibutuhkan.

```mermaid
sequenceDiagram
  autonumber
  participant Alat as Pemindai USB
  participant Input as Kolom cari
  participant Page as CashierPage
  participant Cart as useCart

  Alat->>Input: mengetik "SB-001"
  Alat->>Input: menekan Enter
  Input->>Page: onSubmit form
  Page->>Page: cari sku yang sama persis
  alt ditemukan dan stok ada
    Page->>Cart: addItem(product)
    Page->>Input: kosongkan lalu fokus lagi
    Note over Input: siap untuk pindaian berikutnya
  else stok habis
    Page-->>Input: toast "Stok habis"
  end
```

Kolom pencarian mendapat `autoFocus` dan dikembalikan fokusnya setiap selesai
menambah barang, supaya pemindaian beruntun tidak perlu klik sama sekali.

## Penulisan penjualan

```mermaid
sequenceDiagram
  autonumber
  participant PM as PaymentModal
  participant SV as services/sales
  participant Cache as Cache lokal Firestore
  participant SRV as Firestore server
  participant RL as Security Rules

  PM->>SV: createSale(input)
  SV->>SV: hitung subtotal, discount,<br/>total, totalCost, grossProfit
  SV->>SV: generateInvoiceNo()<br/>INV-YYMMDD-HHMMSS
  SV->>SV: buat writeBatch

  Note over SV: batch.set dokumen sales
  Note over SV: batch.update tiap produk<br/>stock: increment(-qty)

  SV->>Cache: batch.commit()
  Cache-->>SV: resolve secara optimistis
  SV-->>PM: objek Sale untuk struk
  PM->>PM: clear() keranjang, buka ReceiptModal

  Cache->>SRV: kirim batch
  SRV->>RL: evaluasi aturan

  alt semua aturan lolos
    RL-->>SRV: izinkan
    SRV-->>Cache: konfirmasi
  else stok jadi negatif atau bukan staf
    RL-->>SRV: tolak
    SRV-->>Cache: permission-denied
    Note over Cache: perubahan di-rollback,<br/>listener menyiarkan nilai lama
  end
```

### Kenapa `writeBatch`, bukan `runTransaction`

Ini keputusan paling penting di seluruh berkas ini.

```mermaid
flowchart TD
  Q["Menulis penjualan sambil<br/>mengurangi stok"] --> OPT{"Pilihan"}

  OPT -->|"runTransaction"| T1["Wajib bolak balik ke server"]
  T1 --> T2["Gagal total saat internet putus"]
  T2 --> T3["Warung tidak bisa berjualan<br/>saat sinyal hilang"]

  OPT -->|"writeBatch + increment"| B1["Masuk antrean cache lokal"]
  B1 --> B2["Terkirim otomatis saat<br/>koneksi kembali"]
  B1 --> B3["increment dihitung di server,<br/>dua perangkat tetap benar"]
  B2 --> B4["Stok tidak bisa dikunci"]
  B3 --> B4
  B4 --> B5["Kompensasi: layar kasir<br/>memeriksa stok terhadap<br/>snapshot terbaru sebelum simpan"]
  B5 --> B6["Jaring terakhir: Security Rules<br/>menolak stok negatif"]

  classDef bad fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  classDef good fill:#047857,stroke:#047857,color:#ffffff
  class T3 bad
  class B6 good
```

Ringkasnya: **kemampuan berjualan saat offline lebih berharga daripada penguncian
stok yang sempurna**, untuk warung yang biasanya hanya punya satu terminal kasir.

Tiga lapis perlindungan menggantikan penguncian:

1. Tombol tambah nonaktif ketika qty menyentuh stok.
2. Pemeriksaan ulang menyeluruh tepat sebelum `createSale`.
3. Security Rules menolak `stock` yang jadi negatif.

## Perilaku offline

```mermaid
sequenceDiagram
  autonumber
  actor K as Kasir
  participant App as Aplikasi
  participant Cache as Cache persisten
  participant SRV as Firestore server

  Note over SRV: Internet warung putus

  K->>App: buka layar kasir
  App->>Cache: onSnapshot products
  Cache-->>App: data terakhir yang tersimpan
  Note over App: daftar produk tetap tampil

  K->>App: selesaikan penjualan
  App->>Cache: writeBatch commit
  Cache-->>App: resolve, struk tercetak
  Note over Cache: batch mengantre

  K->>App: selesaikan penjualan kedua
  App->>Cache: writeBatch commit
  Note over Cache: dua batch mengantre

  Note over SRV: Internet kembali
  Cache->>SRV: kirim antrean berurutan
  SRV-->>Cache: konfirmasi
  Note over App: stok dan laporan menyusul sendiri
```

### Batasannya, jujur

| Hal | Perilaku saat offline |
| --- | --- |
| Membaca produk dan riwayat | Berfungsi, dari cache |
| Mencatat penjualan | Berfungsi, mengantre |
| Cetak struk | Berfungsi, tidak butuh jaringan |
| Masuk pertama kali di perangkat baru | **Tidak berfungsi**, butuh jaringan |
| Penolakan Security Rules | Baru diketahui saat sinkron, perubahan **di-rollback diam diam** |
| `createdAt` dari `serverTimestamp` | Sementara bernilai null di cache, transaksi bisa telat muncul di daftar bertanggal |

Baris kedua dari bawah adalah risiko yang sesungguhnya: penjualan yang dibuat
offline oleh akun yang aksesnya dicabut akan hilang tanpa pemberitahuan saat
sinkron. Untuk satu gerai dengan staf tetap, ini dianggap dapat diterima.

## Pembatalan transaksi

Dokumen `sales` **tidak boleh diedit** (`allow update: if false`). Koreksi
dilakukan dengan membatalkan lalu memasukkan ulang.

```mermaid
sequenceDiagram
  autonumber
  actor U as Pemilik
  participant TP as TransactionsPage
  participant CD as ConfirmDialog
  participant SV as services/sales
  participant SRV as Firestore

  U->>TP: tekan Batalkan pada satu struk
  TP->>CD: buka konfirmasi
  CD-->>U: "Stok dikembalikan.<br/>Tidak bisa dibatalkan."
  U->>CD: setuju
  TP->>SV: voidSale(sale, existingProductIds)

  SV->>SV: batch.delete(sales/id)
  loop tiap item di struk
    alt produk masih ada
      SV->>SV: batch.update stock: increment(+qty)
    else produk sudah dihapus
      SV->>SV: lewati
    end
  end

  SV->>SRV: commit
  SRV-->>TP: berhasil
  TP-->>U: toast hijau, laporan menyesuaikan
```

**Kenapa perlu `existingProductIds`.** `batch.update` ke dokumen yang tidak ada
akan menggagalkan **seluruh** batch. Tanpa penyaringan ini, struk yang memuat
produk yang sudah dihapus akan mustahil dibatalkan. Daftar id diambil dari
snapshot produk yang sedang aktif di halaman.

## Struk dan pencetakan

```mermaid
flowchart LR
  A["ReceiptModal terbuka"] --> B["ReceiptBody dirender<br/>id = receipt-print-area"]
  B --> C["Kasir menekan Cetak struk"]
  C --> D["window.print()"]
  D --> E["@media print di index.css"]
  E --> F["body * visibility hidden"]
  E --> G["#receipt-print-area visible,<br/>dipindah ke pojok kiri atas,<br/>warna dipaksa hitam"]
  F --> H["Hanya struk yang keluar"]
  G --> H
```

**Kenapa begitu.** Membuka jendela cetak terpisah sering diblokir sebagai popup
dan merepotkan di printer termal murah yang biasa dipakai warung. Mengisolasi
satu elemen lewat CSS cetak jauh lebih andal dan tidak butuh izin apa pun.

Lebar struk dibuat sempit dengan tipografi monospace supaya mendekati keluaran
printer termal 58 mm.

## State keranjang

Disimpan di zustand, di luar pohon React, agar bilah total di ponsel dan panel
keranjang di desktop membaca sumber yang sama.

```mermaid
flowchart TD
  subgraph store["useCart"]
    ITEMS["items: SaleItem[]"]
    DISC["discount: number"]
    NOTE["note: string"]
  end

  A1["addItem(product)"] -->|"sudah ada? qty + 1<br/>belum? baris baru qty 1"| ITEMS
  A2["setQty(id, qty)"] -->|"qty <= 0 berarti hapus baris"| ITEMS
  A3["removeItem(id)"] --> ITEMS
  A4["setDiscount(n)"] -->|"tidak boleh negatif"| DISC
  A5["clear()"] --> ITEMS
  A5 --> DISC
  A5 --> NOTE

  ITEMS --> C1["cartSubtotal()"]
  ITEMS --> C2["cartCost()"]

  note1["Harga jual dan harga modal<br/>disalin saat masuk keranjang.<br/>Mengubah harga produk tidak<br/>mengubah struk yang sedang dikerjakan."]
  ITEMS -.- note1
```
