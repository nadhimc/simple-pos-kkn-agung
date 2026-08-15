# Autentikasi dan Otorisasi

[← Kembali ke indeks](./README.md)

Dua hal yang sering dianggap satu, padahal berbeda dan ditangani terpisah:

| Lapisan | Menjawab | Ditangani oleh |
| --- | --- | --- |
| Autentikasi | Siapa orang ini | Firebase Authentication |
| Otorisasi | Boleh apa orang ini | Dokumen `staff/{uid}` + Security Rules |

**Lolos autentikasi tidak berarti lolos otorisasi.** Sejak Google Sign-In aktif,
pemilik akun Google mana pun bisa membuktikan identitasnya. Yang menentukan boleh
tidaknya menyentuh data toko adalah keberadaan dokumen `staff/{uid}`.

## Alur masuk dengan email dan kata sandi

```mermaid
sequenceDiagram
  autonumber
  actor U as Kasir
  participant LP as LoginPage
  participant AC as AuthContext
  participant FA as Firebase Auth
  participant SS as services/staff
  participant FS as Firestore
  participant RG as RedirectIfAuthenticated

  U->>LP: isi email dan sandi, tekan Masuk
  LP->>LP: submitting = true
  LP->>AC: signIn(email, password)
  AC->>FA: signInWithEmailAndPassword

  alt kredensial salah
    FA-->>AC: auth/invalid-credential
    AC-->>LP: throw
    LP->>LP: authErrorMessage, submitting = false
    LP-->>U: "Email atau kata sandi salah."
  else kredensial benar
    FA-->>AC: User
    FA->>AC: onAuthStateChanged(user)
    Note over LP: submitting tetap true,<br/>tombol masih berputar
    AC->>SS: getStaffProfile(uid)
    SS->>FS: getDoc(staff/uid)

    alt dokumen staf tidak ada
      FS-->>SS: tidak ada
      SS-->>AC: null
      AC->>AC: setAccessError(pesan berisi uid)
      AC->>FA: signOut()
      FA->>AC: onAuthStateChanged(null)
      AC-->>LP: user null, accessError terisi
      LP->>LP: efek accessError, submitting = false
      LP-->>U: "Akun belum terdaftar" beserta uid
    else dokumen staf ada
      FS-->>SS: StaffProfile
      SS-->>AC: profile
      AC->>AC: setUser, setStaff
      AC-->>RG: user terisi
      RG-->>U: pindah ke /kasir
    end
  end
```

Perhatikan langkah setelah kredensial diterima: **`submitting` sengaja tidak
direset**. Pemeriksaan staf masih berjalan, dan kalau tombol berhenti berputar di
situ, kasir akan mengira klik pertamanya gagal lalu menekannya lagi.

## Alur masuk dengan Google

```mermaid
sequenceDiagram
  autonumber
  actor U as Pengguna
  participant LP as LoginPage
  participant AC as AuthContext
  participant Pop as Jendela popup Google
  participant FA as Firebase Auth
  participant SS as services/staff

  U->>LP: klik "Masuk dengan Google"
  LP->>AC: signInWithGoogle()
  AC->>AC: provider.setCustomParameters<br/>prompt = select_account
  AC->>Pop: signInWithPopup
  Pop-->>U: pemilih akun Google

  alt popup ditutup pengguna
    Pop-->>AC: auth/popup-closed-by-user
    AC-->>LP: throw
    LP->>LP: authErrorMessage mengembalikan string kosong
    Note over LP: tidak ada pesan error ditampilkan,<br/>menutup popup bukan kesalahan
  else popup diblokir browser
    Pop-->>AC: auth/popup-blocked
    LP-->>U: "Jendela Google diblokir browser..."
  else domain belum diizinkan
    Pop-->>AC: auth/unauthorized-domain
    LP-->>U: "Domain ini belum diizinkan..."
  else akun dipilih
    Pop-->>FA: kredensial
    FA->>AC: onAuthStateChanged(user)
    AC->>SS: getStaffProfile(uid)
    Note over AC,SS: lanjut sama persis seperti alur email
  end
```

**Kenapa `prompt: select_account`.** Satu perangkat kasir dipakai bergantian.
Tanpa paksaan memilih akun, Google akan diam diam memakai sesi terakhir, dan
struk tercatat atas nama orang yang salah. Nama kasir ikut tersimpan permanen di
dokumen penjualan, jadi kesalahan ini tidak bisa diperbaiki belakangan.

## Mesin keadaan sesi

```mermaid
stateDiagram-v2
  [*] --> Memulihkan: aplikasi dibuka

  Memulihkan --> TanpaSesi: onAuthStateChanged(null)
  Memulihkan --> MemeriksaStaf: onAuthStateChanged(user)

  TanpaSesi --> MemeriksaStaf: kredensial diterima
  MemeriksaStaf --> Masuk: dokumen staff ada
  MemeriksaStaf --> Ditolak: dokumen staff tidak ada
  MemeriksaStaf --> MasukTanpaProfil: pemeriksaan gagal, jaringan

  Ditolak --> TanpaSesi: signOut otomatis,<br/>accessError terisi
  Masuk --> TanpaSesi: pengguna menekan Keluar
  MasukTanpaProfil --> TanpaSesi: pengguna menekan Keluar

  note right of MasukTanpaProfil
    Gagal terbuka saat offline.
    Kasir tidak dilempar keluar
    di tengah jualan. Aman karena
    Security Rules tetap menolak
    di sisi server.
  end note

  note right of Memulihkan
    initializing = true.
    Guard menampilkan layar tunggu,
    bukan form login.
  end note
```

### Kenapa gagal terbuka, bukan gagal tertutup

Kalau `getStaffProfile` melempar error karena jaringan mati, kode **tetap
mempertahankan sesi**.

```mermaid
flowchart TD
  A["getStaffProfile gagal"] --> B{"Pilihan rancangan"}
  B -->|"gagal tertutup:<br/>signOut"| C["Kasir terlempar keluar<br/>saat internet warung putus"]
  B -->|"gagal terbuka:<br/>sesi dipertahankan"| D["Kasir tetap bisa melayani"]

  C --> E["Tidak bisa berjualan.<br/>Kerugian nyata."]
  D --> F["Bisa membaca cache lokal.<br/>Tulisan ke server tetap<br/>diperiksa Security Rules."]

  F --> G["Tidak ada data bocor:<br/>rules memeriksa staff/uid<br/>yang sama di server"]

  classDef bad fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  classDef good fill:#047857,stroke:#047857,color:#ffffff
  class E bad
  class G good
```

Pemeriksaan staf di klien hanya untuk pengalaman pengguna. Lapisan keamanan yang
sesungguhnya ada di `firestore.rules`, dan itu tidak bisa dilewati dari browser.

## Penjagaan rute

Dijaga di tingkat rute, bukan di dalam komponen halaman. Kodenya di
[`src/components/routing/AuthGuards.tsx`](../src/components/routing/AuthGuards.tsx).

```mermaid
flowchart TD
  START(["Pengguna membuka sebuah URL"]) --> INIT{"initializing?"}

  INIT -->|"ya"| WAIT["Layar tunggu<br/>BrandMark + 'Memuat sesi.'"]
  WAIT --> INIT

  INIT -->|"tidak"| WHICH{"Rute mana?"}

  WHICH -->|"/masuk"| G2{"punya sesi?"}
  G2 -->|"tidak"| LOGIN["Tampilkan LoginPage"]
  G2 -->|"ya"| BOUNCE["Navigate ke<br/>safeRedirectTarget(state)"]

  WHICH -->|"rute aplikasi"| G1{"punya sesi?"}
  G1 -->|"ya"| APP["Render AppShell + halaman"]
  G1 -->|"tidak"| SAVE["Navigate ke /masuk<br/>state.from = location saat ini"]

  SAVE --> LOGIN
  LOGIN -->|"berhasil masuk"| BOUNCE
  BOUNCE --> APP

  classDef guard fill:#047857,stroke:#047857,color:#ffffff
  class G1,G2 guard
```

**Kenapa di tingkat rute.** Kalau pemeriksaan ada di dalam halaman, halaman baru
bisa lupa menuliskannya dan langsung bocor. Dengan guard membungkus `<Outlet />`,
halaman baru terlindungi hanya dengan didaftarkan di tempat yang benar.

### Membawa tujuan awal

```mermaid
sequenceDiagram
  autonumber
  actor U as Pengguna
  participant R as Router
  participant RA as RequireAuth
  participant LP as LoginPage
  participant RG as RedirectIfAuthenticated

  U->>R: buka /laporan?periode=bulan-ini
  R->>RA: cocokkan rute terlindungi
  RA->>RA: tidak ada sesi
  RA->>R: Navigate /masuk,<br/>state.from = {pathname, search, hash}
  R->>RG: cocokkan /masuk
  RG->>LP: tidak ada sesi, render form
  U->>LP: masuk berhasil
  LP->>RG: user terisi, render ulang
  RG->>RG: safeRedirectTarget(state.from)
  RG->>R: Navigate /laporan?periode=bulan-ini
  R-->>U: mendarat di tujuan semula
```

### `safeRedirectTarget`

State navigasi tidak bisa diisi lewat URL, tapi tetap divalidasi:

```mermaid
flowchart TD
  IN["state.from"] --> C1{"ada dan pathname string?"}
  C1 -->|"tidak"| DEF["AUTH_LANDING = /kasir"]
  C1 -->|"ya"| BUILD["gabung pathname + search + hash"]
  BUILD --> C2{"diawali satu garis miring?"}
  C2 -->|"tidak"| DEF
  C2 -->|"ya"| C3{"diawali dua garis miring?"}
  C3 -->|"ya, protocol-relative"| DEF
  C3 -->|"tidak"| C4{"sama dengan /masuk?"}
  C4 -->|"ya"| DEF
  C4 -->|"tidak"| OK["pakai tujuan itu"]

  classDef safe fill:#047857,stroke:#047857,color:#ffffff
  class OK,DEF safe
```

Penolakan `//` mencegah pola `//situs-lain.com` yang oleh browser dibaca sebagai
alamat absolut. Penolakan `/masuk` mencegah pantulan tak berujung.

## Hasil pengujian

Alur ini sudah diuji di Chromium headless. Semua kasus lulus:

| Keadaan sesi | URL dibuka | Hasil |
| --- | --- | --- |
| belum masuk | `/`, `/kasir`, `/produk`, `/transaksi`, `/beban`, `/laporan`, path ngawur | semua dipantulkan ke `/masuk` |
| belum masuk | `/masuk` | form login tampil |
| belum masuk | deep link | tujuan tersimpan di history state |
| sudah masuk | `/masuk` | dipantulkan ke `/kasir` |
| sudah masuk | `/kasir`, `/laporan` | halaman tampil langsung |
| sesi masih dimuat | `/kasir`, `/masuk` | layar tunggu, bukan form maupun isi aplikasi |

## Pesan error

Kode Firebase diterjemahkan di `authErrorMessage`
([`src/contexts/AuthContext.tsx`](../src/contexts/AuthContext.tsx)).

| Kode | Ditampilkan sebagai |
| --- | --- |
| `auth/invalid-credential`, `auth/wrong-password`, `auth/user-not-found` | Email atau kata sandi salah. |
| `auth/too-many-requests` | Terlalu banyak percobaan gagal. Coba lagi beberapa menit lagi. |
| `auth/network-request-failed` | Tidak ada koneksi internet. |
| `auth/popup-closed-by-user`, `auth/cancelled-popup-request` | *(string kosong, tidak ditampilkan)* |
| `auth/popup-blocked` | Jendela Google diblokir browser. |
| `auth/unauthorized-domain` | Domain belum diizinkan, beserta letak pengaturannya. |
| `auth/operation-not-allowed` | Metode masuk belum diaktifkan di Console. |
| `auth/account-exists-with-different-credential` | Email sudah dipakai metode lain. |

Tiga kode terakhir menunjuk langsung ke menu Firebase Console yang harus dibuka,
karena ketiganya adalah salah konfigurasi, bukan salah pengguna.
