# Arsitektur

[← Kembali ke indeks](./README.md)

## Diagram konteks

Siapa memakai apa, dan sistem luar apa saja yang terlibat.

```mermaid
flowchart TB
  owner(["Pemilik warung<br/>peran: pemilik"])
  cashier(["Kasir<br/>peran: kasir"])
  stranger(["Pemilik akun Google<br/>di luar toko"])

  app["Warungku POS<br/>SPA di browser"]

  auth["Firebase Authentication"]
  store[("Cloud Firestore")]
  printer["Printer termal<br/>lewat dialog cetak browser"]

  owner -->|"kelola produk, lihat laba rugi"| app
  cashier -->|"catat penjualan"| app
  stranger -.->|"bisa lolos login,<br/>ditolak Security Rules"| app

  app -->|"masuk, keluar"| auth
  app -->|"baca tulis data toko"| store
  app -->|"window.print()"| printer

  classDef denied stroke-dasharray: 5 5
  class stranger denied
```

Garis putus-putus dari orang asing bukan kekeliruan gambar. Sejak Google Sign-In
aktif, siapa pun bisa lolos tahap autentikasi. Yang menahannya adalah lapisan
otorisasi, bukan lapisan login. Detailnya di [Keamanan](./keamanan.md).

## Kenapa tanpa backend

Ini keputusan sadar, bukan penyederhanaan yang tertunda.

| Pertimbangan | Akibatnya |
| --- | --- |
| Proyek kecil untuk satu gerai | Tidak ada beban trafik yang butuh server sendiri |
| Menghindari biaya | Tanpa Vercel Functions, hosting tetap di paket gratis |
| Menghindari Next.js | Tidak ada SSR, tidak ada server action, tidak ada cold start |
| Firestore sudah punya otorisasi | Security Rules menggantikan lapisan API |

**Kenapa begitu.** Menambahkan API route berarti menambah permukaan yang harus
di-deploy, dimonitor, dan dibayar, sementara Firestore Rules sudah memberi
kontrol per dokumen. Konsekuensinya yang harus diterima: seluruh logika bisnis
ada di klien dan bisa dibaca siapa saja, sehingga **tidak boleh ada rahasia di
dalam kode**, dan setiap aturan yang penting harus ikut ditegakkan di Rules.

Yang hilang karena tidak ada backend:

- Tidak bisa menjalankan pekerjaan terjadwal, misalnya tutup buku otomatis.
- Tidak bisa menyembunyikan perhitungan apa pun dari pengguna.
- Validasi hanya sekuat yang bisa ditulis di Security Rules.

## Lapisan kode

```mermaid
flowchart TD
  subgraph pages["pages/ — satu berkas per rute"]
    P1["CashierPage"]
    P2["ProductsPage"]
    P3["DashboardPage"]
    P4["ReportsPage, ExpensesPage,<br/>TransactionsPage"]
  end

  subgraph features["features/ — komponen khusus domain"]
    F1["cashier/<br/>CartPanel, PaymentModal, useCart"]
    F2["products/<br/>ProductFormModal, StockModal"]
    F3["sales/ReceiptModal"]
    F4["dashboard/, expenses/"]
  end

  subgraph shared["components/ — dipakai lintas domain"]
    UI["ui/ — Button, Card, Modal,<br/>Field, Toast, States"]
    LAY["layout/ — AppShell, Sidebar,<br/>Header, navigation.ts"]
    RT["routing/ — AuthGuards"]
  end

  subgraph logic["hooks/ dan lib/ — logika tanpa tampilan"]
    H["useProducts, usePeriod, useTheme"]
    L["profit.ts, format.ts,<br/>errors.ts, cn.ts"]
  end

  subgraph data["services/ — satu satunya pintu ke Firestore"]
    S["products.ts, sales.ts,<br/>expenses.ts, staff.ts"]
  end

  FB[("Firebase SDK<br/>lib/firebase.ts")]

  pages --> features
  pages --> shared
  pages --> logic
  features --> logic
  features --> shared
  logic --> data
  pages --> data
  data --> FB

  classDef gate fill:#047857,stroke:#047857,color:#ffffff
  class S gate
```

### Aturan ketergantungan

1. **Halaman tidak memanggil Firestore langsung.** Semua kueri dan tulisan lewat
   `services/`. Ini yang membuat perubahan skema terlokalisasi di satu folder.
2. **`lib/` tidak mengimpor komponen.** Isinya fungsi murni yang bisa diuji
   tanpa React.
3. **`components/ui/` tidak tahu apa pun soal domain.** Tidak ada kata "produk"
   atau "penjualan" di dalamnya.
4. **`features/` boleh tahu domain**, tapi tidak boleh diimpor oleh `components/ui/`.

Ketergantungan mengalir satu arah, dari atas ke bawah. Kalau ada impor yang
melawan arah, itu tanda logikanya salah tempat.

## Topologi deployment

```mermaid
flowchart LR
  dev["Mesin pengembang"]
  repo["Repositori Git"]

  subgraph vc["Vercel"]
    build["Build<br/>tsc -b lalu vite build"]
    cdn["CDN statis<br/>dist/"]
  end

  subgraph fb["Firebase, proyek simple-pos-kkn-agung"]
    authp["Authentication"]
    fs[("Firestore")]
    rules["Security Rules"]
  end

  dev -->|"git push"| repo
  repo -->|"otomatis"| build
  build --> cdn
  dev -->|"firebase deploy<br/>--only firestore:rules"| rules
  dev -->|"npm run seed<br/>Admin SDK"| fs

  cdn -->|"bundel JS"| browser["Browser"]
  browser --> authp
  browser --> fs
  rules -.->|"menjaga"| fs
```

**Dua jalur deploy yang terpisah.** Vercel hanya mengirim frontend. Perubahan
`firestore.rules` **tidak ikut** ter-deploy lewat Vercel dan harus dikirim
sendiri. Ini sumber kebingungan yang paling sering: aturan diubah di repositori,
di-commit, di-push, tapi Firestore masih memakai aturan lama.

## Alur data real time

Aplikasi tidak memakai pola ambil-lalu-simpan. Semua daftar berlangganan
`onSnapshot`, jadi perubahan di satu layar langsung terlihat di layar lain.

```mermaid
sequenceDiagram
  autonumber
  participant Kasir as CashierPage
  participant Produk as ProductsPage
  participant Hook as useProducts
  participant Svc as services/products
  participant Cache as Cache lokal Firestore
  participant Server as Firestore server

  Note over Kasir,Produk: Dua tab terbuka bersamaan

  Kasir->>Hook: mount
  Hook->>Svc: subscribeProducts()
  Svc->>Cache: onSnapshot(query)
  Cache-->>Svc: data cache (langsung)
  Svc-->>Hook: products[]
  Cache->>Server: buka listener
  Server-->>Cache: data terkini
  Cache-->>Svc: products[] diperbarui
  Svc-->>Hook: render ulang

  Note over Kasir: Kasir menyelesaikan penjualan
  Kasir->>Server: writeBatch, stock increment(-2)
  Server-->>Cache: perubahan disiarkan
  Cache-->>Produk: stok baru muncul<br/>tanpa muat ulang
```

**Kenapa begitu.** Kasir sering membuka layar kasir di satu tab dan laporan di
tab lain. Tanpa langganan real time, angka di dua tab akan berbeda dan pemilik
warung kehilangan kepercayaan pada laporannya.

Cache lokal persisten diaktifkan dengan `persistentMultipleTabManager` agar
beberapa tab berbagi satu cache. Lihat `src/lib/firebase.ts`.

## Pemuatan bundel

Setiap halaman dimuat terpisah lewat `React.lazy`. Recharts hanya ikut terunduh
saat dashboard atau laporan dibuka.

```mermaid
flowchart LR
  entry["Bundel awal<br/>React, Router, Firebase"]
  login["LoginPage"]
  shell["AppShell"]
  dash["DashboardPage<br/>+ Recharts"]
  kasir["CashierPage"]
  lain["Halaman lain"]

  entry --> login
  entry --> shell
  shell -.->|"saat dibuka"| dash
  shell -.->|"saat dibuka"| kasir
  shell -.->|"saat dibuka"| lain

  classDef heavy fill:#b45309,stroke:#b45309,color:#ffffff
  class dash heavy
```

Layar kasir adalah yang paling sering dibuka dan paling butuh cepat, jadi ia
tidak boleh ikut menanggung berat pustaka grafik.

## Rangkuman pilihan teknologi

| Kebutuhan | Pilihan | Alasan singkat |
| --- | --- | --- |
| Kerangka UI | React 19 | Ekosistem matang, tim sudah paham |
| Bundler | Vite 8 | Build cepat, keluaran statis murni |
| Bahasa | TypeScript | Model uang dan stok tidak boleh salah tipe |
| Gaya | Tailwind v4 | Token desain di CSS, tanpa berkas konfigurasi JS |
| Rute | react-router-dom 7 | Rute bersarang cocok dengan kerangka layout |
| State global | zustand | Keranjang dan tema saja, tidak perlu Redux |
| Ikon | Phosphor | Satu keluarga, tidak ada SVG buatan tangan |
| Grafik | Recharts | Cukup untuk dua deret, dimuat terpisah |
| Font | Geist via Fontsource | Di-bundle sendiri, tidak memanggil Google Fonts |
