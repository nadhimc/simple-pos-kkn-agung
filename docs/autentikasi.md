# Autentikasi dan Otorisasi

[← Kembali ke indeks](./README.md)

Dua hal yang sering dianggap satu, padahal berbeda dan ditangani terpisah:

| Lapisan | Menjawab | Ditangani oleh |
| --- | --- | --- |
| Autentikasi | Siapa orang ini | Firebase Authentication |
| Otorisasi | Boleh apa orang ini, di warung mana | Dokumen `users/{uid}` + Security Rules |

**Lolos autentikasi tidak berarti lolos otorisasi.** Pemilik akun Google mana pun
bisa membuktikan identitasnya, begitu juga pemilik nomor HP mana pun. Yang
menentukan boleh tidaknya menyentuh data, dan data warung yang mana, adalah
dokumen `users/{uid}` beserta `tenantId` di dalamnya.

Ada tiga metode masuk. Nomor HP didahulukan di layar dan dua sisanya
disembunyikan di balik satu tautan, karena pemilik warung menghafal nomornya
sendiri, tidak selalu punya email, dan tidak perlu memilih apa apa.

| Metode | Untuk siapa | Catatan |
| --- | --- | --- |
| Nomor HP (OTP) | Orang unit usaha | Butuh reCAPTCHA, kode enam angka lewat SMS. Boleh diketik `0851…` maupun `+62851…` |
| Email dan kata sandi | Admin platform, dan orang warung yang dibuatkan admin | Tidak butuh reCAPTCHA |
| Google | Akun yang sudah ada | Tidak bisa dibuatkan admin, harus sign-in sendiri dulu |

## Alur masuk dengan nomor HP

```mermaid
sequenceDiagram
  autonumber
  actor U as Pemilik warung
  participant LP as LoginPage
  participant AC as AuthContext
  participant PA as lib/phoneAuth
  participant RC as reCAPTCHA
  participant FA as Firebase Auth

  U->>LP: ketik 0851 5665 7853, tekan Kirim kode
  LP->>LP: toE164 jadi +6285156657853
  LP->>AC: requestPhoneCode(nomor, wadah)
  AC->>PA: requestOtp(auth, nomor, wadah)
  PA->>RC: RecaptchaVerifier invisible
  RC-->>PA: token
  PA->>FA: signInWithPhoneNumber
  FA-->>PA: ConfirmationResult
  PA-->>LP: { confirmation, cleanup }
  LP-->>U: kolom Kode OTP muncul

  U->>LP: ketik enam angka
  LP->>AC: confirmPhoneCode(challenge, kode)
  AC->>FA: confirmation.confirm(kode)

  alt kode salah
    FA-->>AC: auth/invalid-verification-code
    AC-->>LP: throw
    LP-->>U: "Kode OTP salah. Periksa lagi angkanya."
  else kode benar
    FA-->>AC: User
    Note over AC: lanjut ke pemeriksaan pendaftaran di bawah
  end
```

**Nomor selalu disimpan dalam E.164** (`+6285…`) dan hanya ditampilkan sebagai
`0851…`. Konversinya cuma ada di [`src/lib/phone.ts`](../src/lib/phone.ts),
supaya tidak ada layar yang menebak sendiri lalu mengirim nomor yang salah.

**Masuk pertama kali bisa sekaligus jadi pendaftaran.** Kalau nomor itu punya
undangan, barisnya di `users` dibuat tepat setelah OTP-nya berhasil, dan orangnya
langsung mendarat di unit usahanya tanpa pernah melihat penolakan. Alurnya di
[Multi Warung](./multi-warung.md#undangan-nomor-hp).

**reCAPTCHA memakai kotak centang, bukan mode tak terlihat.** Mode tak terlihat
lebih rapi, tapi hanya selama ia mempercayai pengunjungnya. Kalau tidak, ia
menaikkan tantangan gambar, dan kalau tantangan itu tidak diselesaikan maka
`signInWithPhoneNumber` tidak pernah selesai: tanpa error, tanpa SMS, hanya
tombol yang berputar. Kegagalan yang tidak bisa dilihat maupun dilaporkan adalah
yang terburuk untuk layar masuk, jadi ditukar dengan satu ketukan yang terlihat.

**Ada batas waktu.** Permintaan yang tidak dijawab dalam tiga menit berhenti
dengan `auth/otp-timeout`, bukan menggantung selamanya.

**Pembersihan reCAPTCHA harus tahan dipanggil berkali kali.**
`RecaptchaVerifier.clear()` melempar `auth/internal-error` kalau verifiernya
sudah dibuang, dan dua pemanggil yang sama sama benar memang memanggilnya dua
kali: alur OTP membersihkan setelah kodenya dipakai, lalu React membersihkan
sekali lagi saat layarnya dilepas. Lemparan kedua itu terjadi di dalam cleanup
efek, jadi tidak ada yang menangkapnya dan seluruh aplikasi ikut kosong tepat
setelah kode yang benar dimasukkan.

## Alur masuk dengan email dan kata sandi

```mermaid
sequenceDiagram
  autonumber
  actor U as Kasir
  participant LP as LoginPage
  participant AC as AuthContext
  participant FA as Firebase Auth
  participant SU as services/users
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
    AC->>SU: getAppUser(uid)
    SU->>FS: getDoc(users/uid)

    alt belum terdaftar
      FS-->>SU: tidak ada
      SU-->>AC: null
      AC->>AC: setAccessError(pesan berisi uid)
      AC->>FA: signOut()
      FA->>AC: onAuthStateChanged(null)
      AC-->>LP: user null, accessError terisi
      LP->>LP: efek accessError, submitting = false
      LP-->>U: "Akun belum terdaftar" beserta uid
    else terdaftar dan aktif
      FS-->>SU: AppUser
      SU-->>AC: { role, tenantId, active }
      AC->>FS: getTenant(tenantId)
      FS-->>AC: Tenant
      AC->>AC: setUser, setAppUser, setTenant
      AC-->>RG: user terisi
      RG-->>U: pindah ke /kasir atau /admin
    end
  end
```

Perhatikan langkah setelah kredensial diterima: **`submitting` sengaja tidak
direset**. Pemeriksaan pendaftaran masih berjalan, dan kalau tombol berhenti
berputar di situ, kasir akan mengira klik pertamanya gagal lalu menekannya lagi.

Tujuan setelah masuk berbeda menurut perannya: orang warung mendarat di layar
kasir, admin platform di daftar warung. Kalau sebelumnya ada tautan dalam yang
dituju, tautan itulah yang dipulihkan.

## Alur masuk dengan Google

```mermaid
sequenceDiagram
  autonumber
  actor U as Pengguna
  participant LP as LoginPage
  participant AC as AuthContext
  participant Pop as Jendela popup Google
  participant FA as Firebase Auth
  participant SS as services/users

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
    AC->>SS: getAppUser(uid)
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
  MemeriksaStaf --> Masuk: baris users ada dan aktif
  MemeriksaStaf --> Masuk: belum ada baris,<br/>tapi nomornya diundang
  MemeriksaStaf --> Ditolak: belum terdaftar, atau dinonaktifkan
  MemeriksaStaf --> GagalMemuatProfil: pemeriksaan gagal, jaringan

  Ditolak --> TanpaSesi: signOut otomatis,<br/>accessError terisi
  Masuk --> TanpaSesi: pengguna menekan Keluar
  GagalMemuatProfil --> MemeriksaStaf: tekan "Coba lagi"
  GagalMemuatProfil --> TanpaSesi: pengguna menekan Keluar

  note right of GagalMemuatProfil
    Sesinya TIDAK diputus.
    Kasir tidak dilempar keluar
    di tengah jualan, tapi layarnya
    juga tidak digambar tanpa tahu
    warung mana yang dimaksud.
  end note

  note right of Memulihkan
    initializing = true.
    Guard menampilkan layar tunggu,
    bukan form login.
  end note
```

### Kalau profilnya gagal dibaca

`getAppUser` bisa melempar error, hampir selalu karena jaringan. Ada tiga pilihan
rancangan, dan yang dipakai adalah yang ketiga.

```mermaid
flowchart TD
  A["getAppUser gagal"] --> B{"Pilihan rancangan"}

  B -->|"1. signOut"| C["Kasir terlempar keluar<br/>saat internet warung putus"]
  C --> C1["Tidak bisa berjualan.<br/>Kerugian nyata."]

  B -->|"2. biarkan masuk<br/>tanpa profil"| D["Aplikasi digambar<br/>tanpa tahu warung mana"]
  D --> D1["Seluruh kueri melempar,<br/>layar kosong tanpa penjelasan"]

  B -->|"3. pertahankan sesi,<br/>tampilkan layar coba lagi"| E["Sesi utuh,<br/>keadaannya terbaca"]
  E --> E1["Sekali sambungan pulih,<br/>satu tombol dan lanjut jualan"]

  classDef bad fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  classDef good fill:#047857,stroke:#047857,color:#ffffff
  class C1,D1 bad
  class E1 good
```

Pilihan kedua dulu masuk akal ketika koleksinya masih datar: sesi cukup untuk
membaca cache lokal. Sejak data pindah ke bawah warungnya masing masing, itu
tidak berlaku lagi, karena tanpa `tenantId` tidak ada jalur yang bisa dibaca.

Dalam praktiknya pilihan ketiga jarang terlihat: `getDoc` jatuh ke cache
persisten saat offline, jadi profil yang pernah dibaca tetap terbaca tanpa
jaringan.

Pemeriksaan di klien tetap hanya untuk pengalaman pengguna. Lapisan keamanan yang
sesungguhnya ada di `firestore.rules`, dan itu tidak bisa dilewati dari browser.

## Penjagaan rute

Dijaga di tingkat rute, bukan di dalam komponen halaman. Kodenya di
[`src/components/routing/AuthGuards.tsx`](../src/components/routing/AuthGuards.tsx).

| Gerbang | Menjaga | Memantulkan ke |
| --- | --- | --- |
| `RequireAuth` | seluruh aplikasi | `/masuk` |
| `RedirectIfAuthenticated` | `/masuk` | tujuan tersimpan, atau landing perannya |
| `RequireTenantUser` | halaman warung | `/admin` |
| `RequireAdmin` | halaman platform | `/kasir` |

Dua gerbang terakhir memisahkan admin platform dari orang warung. Pemisahannya
bukan sekadar menyembunyikan menu: `firestore.rules` menegakkan batas yang sama
di server, jadi admin yang memaksa membuka `/laporan` tetap tidak mendapat satu
angka pun. Lihat [Multi Warung](./multi-warung.md#dua-dunia).

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
  C1 -->|"tidak"| DEF["landing perannya:<br/>/kasir, atau /admin"]
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
