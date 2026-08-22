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

  ADMIN --> A1["Daftar unit usaha"]
  ADMIN --> A2["Ringkasan usaha"]
  ADMIN --> A3["Daftar pengguna"]

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
tenantStats/{tenantId}
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
  ADMIN --> ADMIN2["users/{uid}<br/>role: admin"]
  USER --> DATA["Seluruh data unit usahanya"]

  SELF["Pendaftaran mandiri"] -.->|"tidak ada"| USER
  ADMIN -.->|"ditolak keepsOwnStanding()"| DEMOTE["Menurunkan dirinya sendiri"]

  classDef no fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  class SELF,DEMOTE no
```

Rantainya punya satu awal yang berada di luar aplikasi, dan itu disengaja: admin
pertama hanya lahir dari skrip yang memakai kunci service account. Sesudahnya
admin boleh mengangkat admin lain dari dalam aplikasi.

`isValidUser()` memeriksa peran dan bentuk barisnya bersama sama, supaya tidak
ada baris setengah jadi:

| Peran | `tenantId` |
| --- | --- |
| `pemilik`, `kasir` | wajib terisi |
| `admin` | wajib kosong |

`keepsOwnStanding()` melarang siapa pun menurunkan peran atau menonaktifkan
**dirinya sendiri**. Tanpa itu satu salah klik bisa menghapus admin terakhir
platform, dan tidak ada cara memulihkannya dari dalam aplikasi. Nama sendiri
tetap boleh diubah.

**Yang ditukar.** Sebelumnya `isValidUser()` menolak peran `admin` sepenuhnya,
sehingga satu akun admin yang bocor pun tidak bisa mencetak admin baru. Sekarang
bisa, jadi mengusir admin yang bocor berarti mencabut juga semua yang dibuatnya.
Yang **tidak** berubah: orang yang belum terdaftar tetap tidak punya pijakan
apa pun, karena seluruh tulisan ke `users` menuntut `isAdmin()` lebih dulu.

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

### Dua cara mendaftarkan

| Cara | Kapan dipakai | Yang terjadi |
| --- | --- | --- |
| Email | Akun yang kata sandinya diberikan admin | Akun dan barisnya dibuat langsung |
| UID | Akun yang sudah pernah masuk, misalnya lewat Google | Barisnya saja yang dibuat |

Akun Google tidak bisa dibuatkan sama sekali. UID-nya baru ada setelah orangnya
sign-in sekali, dan halaman masuk menampilkan UID itu saat menolaknya, supaya
bisa langsung dikirim ke admin.

### Nomor HP pernah jadi cara ketiga

Dulu ada jalur undangan: admin menuliskan nomor HP, orangnya masuk sendiri lewat
OTP, dan barisnya lahir saat itu juga. Itu satu satunya tempat seseorang menulis
barisnya sendiri di `users`, dijaga aturan yang membaca undangan berdasarkan
nomor di tokennya.

Dicabut bersama login nomor HP. OTP menuntut reCAPTCHA, dan reCAPTCHA menuntut
satu langkah lagi dari orang yang sedang membuka kasir. Koleksi `invites` dan
cabang pendaftaran mandiri di aturan `users` ikut dihapus, bukan ditinggalkan
mati: aturan yang tidak mungkin terpicu tapi tetap mengizinkan seseorang menulis
barisnya sendiri hanya menyesatkan pembaca berikutnya tentang apa yang dijaga.

Kalau dikembalikan, kembalikan keduanya sekaligus. Riwayatnya utuh di git.

### Unit usaha tidak dipilihkan otomatis

Form pendaftaran dulu memakai unit usaha pertama menurut abjad sebagai bawaan.
Akibatnya admin yang tidak memperhatikan dropdown memasukkan orang ke unit yang
salah tanpa satu pun tanda, dan salah tempat seperti itu baru ketahuan setelah
orangnya membuka pembukuan yang bukan miliknya.

Sekarang unitnya kosong sampai dipilih, kecuali kalau memang tidak ada yang
ambigu: hanya ada satu unit usaha, atau formnya dibuka dari baris unit tertentu
di halaman Unit Usaha.

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

Itu memang tujuannya. Mengetik kata sandi setiap membuka aplikasi terlalu
merepotkan untuk warung, dan pemilik unit usaha bukan orang yang terbiasa
melakukannya setiap pagi.

**Kenapa tidak ada PIN.** Tanpa backend, PIN tidak mungkin ditukar menjadi sesi
Firebase: tidak ada yang bisa menandatangani token dari sebuah PIN. Jadi PIN
hanya bisa jadi gembok layar di atas sesi yang sudah hidup, bukan faktor
autentikasi kedua. Kalau nanti ditambahkan, sadari batas itu sejak awal dan
jangan menjualnya sebagai keamanan.

## Menonaktifkan unit usaha

Unit usaha tidak bisa dihapus dari aplikasi, dan itu disengaja.

```mermaid
flowchart TD
  A["Hapus tenants/{id}"] --> B["Subkoleksi di bawahnya TIDAK ikut terhapus"]
  B --> C["Produk, resep, struk, beban<br/>jadi data yatim"]
  C --> D["Tidak bisa dibaca siapa pun,<br/>tidak bisa dibersihkan dari aplikasi"]

  E["active: false"] --> F["tenantActive() bernilai salah"]
  F --> G["Seluruh subkoleksinya tertutup<br/>di sisi server"]
  G --> H["Datanya utuh,<br/>bisa dibuka lagi kapan saja"]

  classDef no fill:#b91c1c,stroke:#b91c1c,color:#ffffff
  classDef ok fill:#047857,stroke:#047857,color:#ffffff
  class D no
  class H ok
```

Firestore tidak mengenal penghapusan berjenjang, dan klien tidak punya cara
murah untuk menyapu subkoleksi. Menonaktifkan menutup aksesnya tanpa menyentuh
satu dokumen pun di dalamnya.

**Membaca dokumen unit usahanya sendiri sengaja tidak ikut diperiksa status
aktifnya.** Kalau ikut, orang dari unit usaha yang baru dinonaktifkan akan
mendapat `permission-denied`, dan aplikasi membacanya sebagai gangguan jaringan,
bukan sebagai "unit usaha ini sedang ditutup". Yang dijaga status aktif adalah
datanya, di subkoleksi bawah.

## Ringkasan usaha untuk admin

Admin tidak boleh membaca struk unit usaha mana pun, tapi tetap perlu tahu unit
mana yang jalan dan berapa hasilnya. Jembatannya adalah `tenantStats/{tenantId}`.

```mermaid
sequenceDiagram
  autonumber
  participant K as Kasir unit usaha
  participant S as services/sales
  participant B as writeBatch
  participant FS as Firestore
  participant AD as Admin

  K->>S: createSale(...)
  S->>B: set sales/{id}
  S->>B: increment stok tiap produk
  S->>B: increment tenantStats/{id}
  B->>FS: commit, satu tulisan
  Note over B,FS: gagal atau berhasil bersama sama

  AD->>FS: baca tenantStats
  FS-->>AD: total per bulan dan sepanjang waktu
  AD-->>AD: tidak pernah menyentuh sales
```

Ditulis dengan `increment`, sehingga dua perangkat yang menjual bersamaan tetap
menghasilkan total yang benar, dan ikut mengantre di cache lokal saat unit usaha
sedang offline, sama seperti transaksinya.

Bulan diambil dari **tanggal transaksinya**, bukan hari ini. Struk bulan lalu
yang dibatalkan hari ini mengurangi bulan lalu, dan beban yang tanggalnya
dipindahkan dari Juli ke Agustus mengurangi Juli sekaligus menambah Agustus.

**Batas ketelitiannya disebutkan langsung di halamannya.** Angka itu persis
sepercaya catatan yang mendasarinya, tidak lebih: unit usaha sudah memegang penuh
catatan penjualannya sendiri, jadi ringkasan ini tidak menuntut kepercayaan baru.
Ia bukan alat audit, dan tidak boleh dijual sebagai itu.

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
| Satu akun untuk beberapa unit usaha | Orang yang mengelola dua unit butuh dua akun |
| Menghapus unit usaha dari aplikasi | Diganti penonaktifan; penghapusan sungguhan butuh skrip |
| Hak akses berbeda antara pemilik dan kasir | Peran disimpan dan ditampilkan, tapi belum membatasi apa pun |
| Rincian transaksi untuk admin | Sengaja tidak ada. Yang tersedia hanya total lewat `tenantStats` |
| Membangun ulang `tenantStats` dari struk | Ringkasan yang terlanjur melenceng hanya bisa dikoreksi lewat skrip Admin SDK |

Baris keempat sengaja dibiarkan: memberi admin akses baca ke subkoleksi akan
membatalkan jaminan bahwa satu akun admin yang bocor tidak membuka pembukuan
semua unit usaha. Sisanya tinggal ditambahkan kalau dibutuhkan.
