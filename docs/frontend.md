# Frontend

[← Kembali ke indeks](./README.md)

## Struktur folder

```
src/
  App.tsx                 peta rute
  main.tsx                titik masuk
  index.css               token desain, base layer, CSS cetak

  components/
    layout/               kerangka aplikasi
      AppShell.tsx        grid sidebar + header + konten
      Sidebar.tsx         navigasi, rail ciut, drawer ponsel
      Header.tsx          judul halaman, tema, menu pengguna
      BrandMark.tsx       monogram nama toko
      navigation.ts       SATU SUMBER KEBENARAN daftar menu,
                          tenantNavigation dan adminNavigation
    routing/
      AuthGuards.tsx      RequireAuth, RedirectIfAuthenticated,
                          RequireAdmin, RequireTenantUser
    ui/                   kit komponen bebas domain

  features/               komponen yang tahu domain
    cashier/  products/  expenses/  sales/  dashboard/

  hooks/                  useProducts, usePeriod, useTheme
  lib/                    firebase, format, profit, errors, cn
  pages/                  satu berkas per rute, default export
  services/               satu satunya pintu ke Firestore
  types/                  model data
```

## Kerangka aplikasi

```mermaid
flowchart TD
  subgraph shell["AppShell, grid dua kolom"]
    direction TB
    SB["Sidebar<br/>264px, atau 72px saat ciut<br/>tersembunyi di bawah lg"]
    subgraph right["Kolom kanan"]
      direction TB
      HD["Header, tinggi 64px, sticky"]
      MN["main<br/>Outlet halaman"]
    end
  end

  NAV["navigation.ts"] -->|"kelompok dan item menu"| SB
  NAV -->|"judul halaman"| HD
  NAV -->|"document.title"| DOC["Judul tab browser"]
  NAV -->|"fullBleed?"| MN

  TV["ToastViewport"] -.->|"melayang di atas semua"| shell

  classDef src fill:#047857,stroke:#047857,color:#ffffff
  class NAV src
```

`AppShell` juga membungkus `<Outlet />` dengan `Suspense`, sehingga halaman yang
sedang diunduh menampilkan rangka berbentuk kontennya, bukan layar kosong.

### Dua mode area konten

```mermaid
flowchart LR
  A{"navigation.ts<br/>fullBleed?"}
  A -->|"tidak, halaman biasa"| B["main overflow-y-auto<br/>+ pembungkus max-w-1400px<br/>+ padding standar"]
  A -->|"ya, layar kasir"| C["main overflow-hidden<br/>tanpa padding<br/>halaman atur tinggi sendiri"]
```

Panel keranjang di layar kasir harus menempel ke tepi layar dan punya area scroll
sendiri, sehingga ia tidak bisa memakai pembungkus standar.

## Menambah halaman baru

```mermaid
flowchart TD
  S(["Ingin menambah halaman, misal Pelanggan"]) --> A["1. Tambah entri di navigation.ts,<br/>tenantNavigation atau adminNavigation"]
  A --> A1["path, label, description,<br/>icon Phosphor, fullBleed opsional"]
  A1 --> B["2. Daftarkan Route di App.tsx<br/>di dalam AppShell"]
  B --> B1["path harus sama persis<br/>dengan navigation.ts"]
  B1 --> C["3. Buat pages/CustomersPage.tsx<br/>dengan default export"]
  C --> D["Selesai"]

  D --> R1["Sidebar otomatis"]
  D --> R2["Judul header otomatis"]
  D --> R3["Judul tab browser otomatis"]
  D --> R4["Terlindungi RequireAuth otomatis,<br/>plus RequireAdmin atau RequireTenantUser<br/>sesuai daftarnya"]
  D --> R5["Lazy loading + skeleton otomatis"]

  X["Yang TIDAK perlu disentuh:<br/>Sidebar.tsx, Header.tsx,<br/>AppShell.tsx, AuthGuards.tsx"]
  D -.- X

  classDef done fill:#047857,stroke:#047857,color:#ffffff
  class D done
```

Kalau menambah halaman terasa perlu mengubah berkas layout, kemungkinan besar
ada yang salah di rancangannya.

## Token desain

Semua warna didefinisikan sebagai variabel CSS di `index.css`, lalu dipetakan ke
utilitas Tailwind lewat `@theme inline`.

```mermaid
flowchart LR
  ROOT[":root<br/>nilai mode terang"] --> THEME["@theme inline<br/>--color-* = var(--*)"]
  DARK[".dark<br/>nilai mode gelap"] --> THEME
  THEME --> UTIL["Utilitas Tailwind<br/>bg-surface, text-ink-muted,<br/>border-border"]
  UTIL --> COMP["Komponen"]

  HTML["script inline di index.html<br/>pasang class dark sebelum paint"] --> DARK
```

**Aturan mutlak: pakai token, jangan warna Tailwind mentah.** Tulis `bg-surface`,
bukan `bg-white`. Tulis `text-ink-muted`, bukan `text-zinc-500`. Ini yang membuat
mode gelap ikut benar tanpa menulis varian `dark:` di mana mana.

### Daftar token

| Kelompok | Token | Dipakai untuk |
| --- | --- | --- |
| Permukaan | `bg`, `surface`, `surface-2`, `surface-hover` | Latar halaman, kartu, baris, hover |
| Garis | `border`, `border-strong` | Pembatas halus, tepi kontrol |
| Teks | `ink`, `ink-muted`, `ink-subtle`, `ink-inverse` | Hierarki tulisan |
| Aksen | `accent`, `accent-hover`, `accent-fg`, `accent-soft`, `accent-soft-fg` | Tombol utama, badge, sorotan |
| Status | `danger*`, `warning*` | Error, peringatan stok |
| Sidebar | `sidebar`, `sidebar-border`, `sidebar-ink`, `sidebar-ink-active`, `sidebar-active`, `sidebar-bar` | Navigasi, selalu gelap di kedua mode |
| Grafik | `--chart-1`, `--chart-2`, `--chart-grid`, `--chart-axis` | Deret data |

### Aksen bergeser antar mode

| Mode | Nilai aksen | Alasan |
| --- | --- | --- |
| Terang | emerald-700 `#047857` | Teks putih di atasnya lolos WCAG AA |
| Gelap | emerald-500 `#10b981` | Hierarki yang menonjol di terang harus tetap menonjol di gelap |

Bukan sekadar dibalik. Setiap langkah dipilih ulang untuk permukaannya sendiri.

### Skala radius dikunci

| Kelas | Nilai | Untuk |
| --- | --- | --- |
| `rounded-control` | 10px | Tombol, input, select |
| `rounded-panel` | 14px | Kartu, modal, panel |
| `rounded-full` | penuh | Badge, chip kategori |

Mencampur di luar aturan ini membuat tampilan terasa berantakan meski setiap
komponennya rapi sendiri sendiri.

## Kit komponen

```mermaid
flowchart TD
  subgraph ui["components/ui"]
    B["Button, IconButton"]
    C["Card, CardHeader, CardBody"]
    F["TextField, SelectField, TextAreaField"]
    M["Modal, ConfirmDialog"]
    S["EmptyState, ErrorState,<br/>Skeleton, CardSkeleton, TableSkeleton"]
    T["toast, ToastViewport"]
    P["PageHeader, Segmented"]
    BD["Badge"]
  end

  IDX["components/ui/index.ts"] --> ui
  PAGES["pages/ dan features/"] --> IDX
```

### Aturan form

```mermaid
flowchart TD
  L["Label, selalu di atas"] --> I["Input"]
  I --> H["Helper text, opsional"]
  I --> E["Error, di bawah input"]

  X1["Placeholder sebagai label"] -.->|"DILARANG"| L
  X2["Label di samping input"] -.->|"DILARANG"| L

  classDef no fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  class X1,X2 no
```

`aria-invalid` dan `aria-describedby` dipasang otomatis oleh `FieldShell`, jadi
tidak perlu diurus tiap pemakaian.

### Empat keadaan wajib

Setiap layar yang mengambil data harus menangani keempatnya.

```mermaid
stateDiagram-v2
  [*] --> Memuat
  Memuat --> Kosong: berhasil, nol baris
  Memuat --> Berisi: berhasil, ada baris
  Memuat --> Error: kueri gagal
  Berisi --> Kosong: filter tidak cocok
  Kosong --> Berisi: data masuk

  note right of Memuat
    Skeleton berbentuk kontennya,
    bukan spinner bulat generik,
    supaya layout tidak melompat.
  end note

  note right of Kosong
    Dibedakan: belum ada data sama sekali
    versus filter tidak menemukan apa pun.
    Ajakan tindakannya berbeda.
  end note
```

Perhatikan pemisahan pada keadaan kosong. "Belum ada produk" mengajak menambah
produk. "Tidak ada produk yang cocok" mengajak mengatur ulang filter. Menyamakan
keduanya membuat pengguna bingung.

## Grafik

Mengikuti aturan visualisasi data yang ketat. Kodenya di
[`SalesTrendChart.tsx`](../src/features/dashboard/SalesTrendChart.tsx).

| Aturan | Penerapan di sini |
| --- | --- |
| Satu sumbu saja | Omzet dan laba bersih sama sama rupiah, jadi satu sumbu. Dua ukuran berskala beda wajib dipisah jadi dua grafik |
| Warna mengikuti entitas | Slot 1 selalu omzet, slot 2 selalu laba, tidak pernah bertukar |
| Legenda untuk dua deret atau lebih | Selalu ada |
| Identitas bukan hanya warna | Laba bersih memakai garis putus putus, ditambah tampilan tabel |
| Marka tipis, grid mundur | Garis 2px, grid putus putus tipis |
| Bentuk yang benar | Laporan laba rugi tetap tabel, bukan grafik |

### Palet grafik sudah divalidasi

```mermaid
flowchart LR
  A["Kandidat warna"] --> B["Validator"]
  B --> C1["Rentang lightness"]
  B --> C2["Batas bawah chroma"]
  B --> C3["Keterpisahan buta warna"]
  B --> C4["Kontras terhadap permukaan"]
  C1 --> D{"Lolos semua?"}
  C2 --> D
  C3 --> D
  C4 --> D
  D -->|"tidak"| A
  D -->|"ya"| E["Dipakai"]

  classDef ok fill:#047857,stroke:#047857,color:#ffffff
  class E ok
```

Emerald-500 sempat gagal rentang lightness pada permukaan gelap dan diganti
`#0da271`. **Jangan mengganti nilai `--chart-*` tanpa menjalankan validator
lagi.**

## Responsif

Titik henti standar Tailwind. Aturan yang dipegang:

| Aturan | Alasan |
| --- | --- |
| `min-h-[100dvh]`, bukan `h-screen` | Bilah alamat Safari iOS membuat `100vh` meleset |
| CSS Grid, bukan matematika flex | Tidak ada `w-[calc(33%-1rem)]` |
| Tabel lebar dibungkus `overflow-x-auto` | Halaman tidak pernah menggeser mendatar |
| Runtuh mobile dinyatakan eksplisit | Setiap tata letak multi kolom menyebut perilakunya di bawah `md` |

| Layar | Sidebar | Keranjang kasir |
| --- | --- | --- |
| `>= lg` (1024px) | Kolom tetap, bisa diciutkan | Panel menempel 24rem |
| `< lg` | Drawer di atas konten | Bilah total + lembar modal |

## Ikon dan tipografi

- **Ikon hanya dari `@phosphor-icons/react`.** Satu keluarga untuk seluruh
  proyek. Tidak ada path SVG buatan tangan.
- **Font Geist dan Geist Mono** di-bundle lewat Fontsource. Tidak memanggil
  Google Fonts, jadi tidak ada permintaan lintas domain dan tidak ada pergeseran
  tata letak saat font tiba.
- **Angka uang memakai class `tabular`** agar kolomnya rata. Tanpa itu, angka di
  tabel bergeser goyang saat nilainya berubah.

## Aksesibilitas

| Hal | Penerapan |
| --- | --- |
| Kontras | Seluruh pasangan teks dan latar diperiksa terhadap WCAG AA |
| Fokus | Cincin fokus terlihat lewat `:focus-visible`, warna aksen |
| Tombol ikon | `IconButton` mewajibkan prop `label`, dipasang ke `aria-label` dan `title` |
| Modal | `role="dialog"`, `aria-modal`, tutup dengan Escape, fokus dipindah ke dalam, scroll latar dikunci |
| Gerak | `prefers-reduced-motion` mematikan animasi dan transisi |
| Grafik | Identitas deret tidak pernah hanya warna, dan ada tampilan tabel |
