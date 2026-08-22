# Multi Warung

[← Kembali ke indeks](./README.md)

Satu pemasangan aplikasi ini melayani banyak warung. Dokumen ini menjelaskan
bagaimana warung dipisahkan, siapa yang boleh membuat siapa, dan kenapa
bentuknya begitu. Hampir semua keputusan lain di proyek ini mengikuti dari sini.

## Dua dunia

```mermaid
flowchart TB
  LOGIN["Halaman masuk"] --> GATE{"users/{uid}.role"}

  GATE -->|"admin"| ADMIN["Area platform<br/>/admin"]
  GATE -->|"pemilik atau kasir"| WARUNG["Area warung<br/>/kasir, /produk, /laporan"]

  ADMIN --> A1["Daftar warung"]
  ADMIN --> A2["Daftar pengguna"]

  WARUNG --> W1["Kasir dan struk"]
  WARUNG --> W2["Stok dan resep"]
  WARUNG --> W3["Beban dan laba rugi"]

  ADMIN -.->|"tidak punya akses"| W3

  classDef no fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  class ADMIN no
```

Keduanya memakai kerangka yang sama, `AppShell`, tetapi tidak pernah melihat
halaman satu sama lain. Pemisahannya di tingkat rute lewat `RequireAdmin` dan
`RequireTenantUser`, bukan dengan menyembunyikan menu.

**Kenapa begitu.** Menyembunyikan menu hanya mengubah tampilan. Yang menegakkan
batas sebenarnya adalah `firestore.rules`: admin yang memaksa membuka `/laporan`
tetap tidak mendapat satu angka pun, karena aturannya menolak permintaannya di
server.

## Tenant sebagai jalur, bukan field

Ini keputusan tunggal yang paling menentukan keamanan seluruh layanan.

```mermaid
flowchart LR
  subgraph salah["Kalau tenant cuma field"]
    S1["products/{id}<br/>tenantId: A"]
    S2["Setiap kueri harus ingat<br/>where('tenantId', '==', A)"]
    S3["Satu kueri lupa"]
    S4["Omzet warung tetangga terbaca"]
    S1 --> S2 --> S3 --> S4
  end

  subgraph benar["Tenant jadi bagian jalur"]
    B1["tenants/A/products/{id}"]
    B2["match /tenants/{id}/{doc=**}"]
    B3["Jalur salah ditolak server"]
    B1 --> B2 --> B3
  end

  classDef bad fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  classDef good fill:#047857,stroke:#047857,color:#ffffff
  class S4 bad
  class B3 good
```

Kalau tenant hanya berupa field di dalam dokumen, keamanan bergantung pada
setiap kueri di seluruh kode ingat menyertakan filternya, selamanya, termasuk
kueri yang ditulis orang lain setahun dari sekarang. Kalau tenant jadi bagian
dari jalur dokumen, tidak ada kueri yang **bisa** lupa: jalurnya sendiri yang
menentukan warung mana yang dibaca.

Jalur dirakit di satu tempat, [`src/services/paths.ts`](../src/services/paths.ts),
yang menolak `tenantId` kosong dengan pesan yang jelas alih alih diam diam
membentuk `tenants//products`.

```
users/{uid}
tenants/{tenantId}
tenants/{tenantId}/products/{id}
tenants/{tenantId}/recipes/{id}
tenants/{tenantId}/productions/{id}
tenants/{tenantId}/sales/{id}
tenants/{tenantId}/expenses/{id}
```

## Bagaimana tenantId sampai ke kueri

```mermaid
sequenceDiagram
  autonumber
  participant FB as Firebase Auth
  participant AC as AuthContext
  participant SU as services/users
  participant ST as services/tenants
  participant HK as hooks/useProducts
  participant SP as services/paths

  FB->>AC: onAuthStateChanged(user)
  AC->>SU: getAppUser(uid)
  SU-->>AC: { role, tenantId, active }
  AC->>ST: getTenant(tenantId)
  ST-->>AC: { name, ... }
  AC-->>AC: simpan appUser dan tenant

  HK->>AC: useTenantId()
  AC-->>HK: tenantId
  HK->>SP: tenantCollection(tenantId, 'products')
  SP-->>HK: tenants/{id}/products
```

Hook mengambil `tenantId` sendiri dari context, bukan menerimanya dari halaman.
Akibatnya halaman tidak perlu tahu apa apa soal tenant, dan tidak ada halaman
yang bisa lupa mengoper warungnya lalu diam diam membaca warung lain.

`tenantId` dibaca dari dokumen pengguna **di sisi server** oleh Security Rules,
bukan dari apa pun yang dikirim browser, jadi tidak ada cara memalsukannya.

## Siapa membuat siapa

```mermaid
flowchart TD
  SEED["scripts/seed.mjs<br/>Admin SDK, melewati Rules"] --> ADMIN["users/{uid}<br/>role: admin"]
  ADMIN --> TENANT["tenants/{id}"]
  ADMIN --> USER["users/{uid}<br/>role: pemilik atau kasir"]
  USER --> DATA["Seluruh data warungnya"]

  SELF["Pendaftaran mandiri"] -.->|"tidak ada"| USER
  ADMIN -.->|"ditolak isValidUser()"| ADMIN2["Admin baru"]

  classDef no fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  class SELF,ADMIN2 no
```

Rantainya punya satu awal yang berada di luar aplikasi, dan itu disengaja.
Validator `isValidUser()` di `firestore.rules` hanya menerima peran `pemilik`
dan `kasir`, sehingga tidak ada jalan bagi siapa pun, termasuk admin yang sudah
ada, mengangkat admin baru dari dalam aplikasi. Admin baru hanya lahir dari
skrip yang memakai kunci service account.

## Mendaftarkan pengguna tanpa kehilangan sesi sendiri

`createUserWithEmailAndPassword` dan `confirmationResult.confirm` sama sama ikut
me-login akun yang baru dibuat. Itu perilaku Firebase, bukan kekeliruan.

```mermaid
sequenceDiagram
  autonumber
  participant AD as Admin (instance utama)
  participant UI as UserFormModal
  participant R2 as Instance kedua<br/>inMemoryPersistence
  participant FB as Firebase Auth
  participant FS as Firestore

  AD->>UI: isi nama, warung, email, sandi
  UI->>R2: createUserWithEmailAndPassword
  R2->>FB: buat akun
  FB-->>R2: sesi akun BARU (di instance kedua)
  UI->>FS: setDoc users/{uid baru}
  Note over AD,FS: ditulis dengan sesi ADMIN di instance utama
  UI->>R2: signOut
  Note over AD: sesi admin tidak pernah tersentuh
```

Tanpa instance kedua, admin yang mendaftarkan pemilik warung akan langsung
terlempar keluar dan berganti jadi orang itu, di tengah halaman yang sedang
dibukanya. Sesinya dipasang `inMemoryPersistence` supaya tidak ada sesi
menggantung milik orang lain di perangkat admin.

### Tiga cara mendaftarkan

| Cara | Kapan dipakai | Kenapa ada |
| --- | --- | --- |
| Nomor HP | Pemilik warung yang tidak punya email | Paling mudah diingat orangnya |
| Email | Akun yang kata sandinya diberikan admin | Bisa dibuat sepihak, tanpa OTP |
| UID | Akun yang sudah pernah masuk, misalnya lewat Google | Satu satunya cara untuk akun Google |

Nomor HP tidak bisa didaftarkan sepihak: OTP-nya dikirim ke HP orangnya, dan itu
berlaku dengan atau tanpa backend. Jadi alurnya memang dirancang berdua, admin
mengetik nomornya lalu pemilik warung membacakan kodenya.

Akun Google tidak bisa dibuatkan sama sekali. UID-nya baru ada setelah orangnya
sign-in sekali, dan halaman masuk menampilkan UID itu saat menolaknya, supaya
bisa langsung dikirim ke admin.

### Kalau langkah kedua gagal

```mermaid
flowchart LR
  A["Akun Auth dibuat"] --> B{"setDoc users/{uid}"}
  B -->|"berhasil"| OK["Selesai"]
  B -->|"gagal"| HALF["Akun ada,<br/>tapi belum bisa masuk"]
  HALF --> ERR["UserProfileWriteError<br/>membawa UID-nya"]
  ERR --> UID["Form beralih ke mode UID<br/>dengan UID sudah terisi"]

  classDef warn fill:#b45309,stroke:#b45309,color:#ffffff
  class HALF warn
```

Keadaan setengah jadi ini tidak disembunyikan. Kalau disembunyikan, admin akan
mencoba mendaftar ulang dengan email yang sama dan ditolak Firebase karena
emailnya sudah terpakai, tanpa penjelasan.

## Sesi, dan kenapa tidak ada PIN

Persistensi auth dipasang IndexedDB dengan localStorage sebagai cadangan.
Refresh token Firebase **tidak punya masa berlaku**: selama tidak menekan
Keluar, tidak mengganti kredensial, dan akunnya tidak dinonaktifkan, orangnya
tidak akan pernah diminta masuk lagi di perangkat yang sama.

Itu memang tujuannya. Masuk lewat OTP setiap membuka aplikasi terlalu
merepotkan untuk warung, dan pemilik warung bukan orang yang terbiasa mengetik
kata sandi panjang setiap pagi.

**Kenapa tidak ada PIN.** Tanpa backend, PIN tidak mungkin ditukar menjadi sesi
Firebase: tidak ada yang bisa menandatangani token dari sebuah PIN. Jadi PIN
hanya bisa jadi gembok layar di atas sesi yang sudah hidup, bukan faktor
autentikasi kedua. Kalau nanti ditambahkan, sadari batas itu sejak awal dan
jangan menjualnya sebagai keamanan.

## Mencabut akses

```mermaid
flowchart LR
  A["Nonaktifkan<br/>active: false"] --> A1["Tidak bisa masuk"]
  A1 --> A2["Barisnya tetap ada,<br/>bisa diaktifkan lagi"]

  B["Cabut akses<br/>hapus users/{uid}"] --> B1["Tidak bisa masuk"]
  B1 --> B2["Barisnya hilang,<br/>daftar ulang kalau berubah pikiran"]

  C["Akun Firebase Auth"] -.->|"tetap ada di keduanya"| D["Tapi tidak bisa membaca<br/>data apa pun"]
```

Klien tidak bisa menghapus akun Firebase Auth milik orang lain tanpa Admin SDK,
jadi yang dicabut selalu barisnya di `users`, bukan akunnya. Efeknya sama:
tanpa baris itu, `isActive()` di Security Rules bernilai salah dan seluruh
koleksi menolak.

Riwayat transaksi tidak terpengaruh keduanya, karena setiap struk menyimpan
salinan nama kasirnya sendiri.

## Yang belum dilakukan

| Belum ada | Konsekuensi |
| --- | --- |
| Satu akun untuk beberapa warung | Orang yang mengelola dua warung butuh dua akun |
| Admin membuat admin lain | Admin baru hanya lewat `scripts/seed.mjs` |
| Menghapus warung dari aplikasi | Firestore tidak menghapus subkoleksi berjenjang; pakai skrip |
| Hak akses berbeda antara pemilik dan kasir | Peran disimpan dan ditampilkan, tapi belum membatasi apa pun |
| Admin melihat ringkasan usaha tiap warung | Butuh dokumen ringkasan terpisah, karena admin sengaja tidak boleh membaca subkoleksinya |

Empat yang pertama tinggal ditambahkan kalau dibutuhkan. Yang terakhir sengaja
tidak dilakukan dengan cara memberi admin akses baca: satu akun admin yang bocor
tidak boleh berarti seluruh pembukuan semua warung ikut terbuka.
