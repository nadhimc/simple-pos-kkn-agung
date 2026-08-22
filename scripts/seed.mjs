#!/usr/bin/env node
/**
 * Pengisi dan pembersih data Firestore.
 *
 * Kenapa perlu skrip, bukan lewat aplikasi: firestore.rules hanya mengizinkan
 * admin platform menulis ke koleksi `users`, dan peran `admin` sendiri sengaja
 * ditolak aturannya. Artinya admin pertama tidak mungkin lahir dari dalam
 * aplikasi, dan itu memang disengaja: kalau bisa, siapa pun yang berhasil login
 * bisa mengangkat dirinya sendiri jadi admin seluruh layanan.
 *
 * Skrip ini memakai Firebase Admin SDK, yang berjalan dengan kunci service
 * account dan memang melewati Security Rules.
 *
 * Perintah:
 *   node scripts/seed.mjs admin  --email admin@x.id --password rahasia123 --name "Admin"
 *   node scripts/seed.mjs warung --tenant "Warung Gendis" --email agung@x.id --password rahasia123
 *   node scripts/seed.mjs warung --tenant "Warung Gendis" --phone 085156657853 --with-products
 *   node scripts/seed.mjs reset  --yes
 *
 * Aman dijalankan berulang: dokumen ditimpa dengan merge, warung dicari dulu
 * berdasarkan namanya, dan produk contoh dilewati kalau kodenya sudah ada.
 *
 * Skrip ini TIDAK PERNAH menulis ke koleksi `sales`. Data penjualan palsu akan
 * merusak laporan laba rugi yang sesungguhnya.
 */

import { existsSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    tenant: { type: 'string' },
    email: { type: 'string' },
    phone: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', default: 'pemilik' },
    password: { type: 'string' },
    key: { type: 'string' },
    'with-products': { type: 'boolean', default: false },
    all: { type: 'boolean', default: false },
    yes: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
})

const USAGE = `
Pemakaian:
  node scripts/seed.mjs <perintah> [pilihan]

Perintah:
  admin     Membuat admin platform. Hanya bisa dari sini, tidak dari aplikasi.
  warung    Membuat warung sekaligus orang yang mengelolanya.
  reset     Menghapus data. Perlu --yes.

Pilihan:
  --tenant <nama>       Nama warung. Wajib untuk perintah warung.
  --email <email>       Akun email. Untuk admin wajib.
  --phone <nomor>       Akun nomor HP, misalnya 085156657853.
                        Isi salah satu saja, email atau phone.
  --name <nama>         Nama tampilan di struk. Default: dari email atau nomor.
  --role <peran>        pemilik atau kasir. Default: pemilik. Diabaikan untuk admin.
  --password <sandi>    Kata sandi untuk akun email baru. Minimal 6 karakter.
  --with-products       Ikut mengisi contoh bahan baku dan barang jadi ke warungnya.
  --all                 Untuk reset: ikut menghapus tenants dan users.
  --yes                 Untuk reset: konfirmasi bahwa datanya memang mau dihapus.
  --key <path>          Berkas kunci service account.
                        Default: ./serviceAccountKey.json atau
                        variabel GOOGLE_APPLICATION_CREDENTIALS.
`

const command = positionals[0]

if (values.help || !command) {
  console.log(USAGE)
  process.exit(values.help ? 0 : 1)
}

if (!['admin', 'warung', 'reset'].includes(command)) {
  console.error(`Perintah "${command}" tidak dikenal.`)
  console.log(USAGE)
  process.exit(1)
}

/* ---------------------------------------------------------------- kredensial */

const keyPath =
  values.key ?? process.env.GOOGLE_APPLICATION_CREDENTIALS ?? './serviceAccountKey.json'

if (!existsSync(keyPath)) {
  console.error(`
Kunci service account tidak ditemukan di: ${keyPath}

Cara mengambilnya:
  Firebase Console > Project settings > Service accounts
  > Generate new private key

Simpan berkasnya sebagai serviceAccountKey.json di akar proyek ini.
Berkas itu sudah masuk .gitignore. JANGAN pernah di-commit atau dibagikan:
isinya memberi akses penuh ke seluruh data proyek, melewati Security Rules.
`)
  process.exit(1)
}

let serviceAccount
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'))
} catch (error) {
  console.error(`Kunci di ${keyPath} bukan JSON yang valid: ${error.message}`)
  process.exit(1)
}

/**
 * Kegagalan di skrip ini hampir selalu berasal dari satu dari tiga hal: kunci
 * yang salah, database yang belum dibuat, atau izin service account. Ketiganya
 * punya perbaikan yang jelas, jadi stack trace diganti instruksi.
 */
function fail(message) {
  console.error(`\n${message}\n`)
  process.exit(1)
}

function explain(error) {
  const code = error?.code ?? ''
  const text = String(error?.message ?? error)

  if (code === 'app/invalid-credential' || text.includes('Failed to parse private key')) {
    return `Kunci service account di ${keyPath} tidak bisa dibaca.

Berkasnya kemungkinan rusak, terpotong, atau bukan kunci service account.
Unduh ulang: Firebase Console > Project settings > Service accounts
> Generate new private key. Pakai berkas JSON-nya apa adanya, jangan diedit.`
  }

  if (code === 5 || code === 'NOT_FOUND' || text.includes('NOT_FOUND')) {
    return `Database Firestore belum ada di proyek ${serviceAccount.project_id}.

Buat dulu di Firebase Console > Firestore Database > Create database,
pilih lokasi terdekat, lalu jalankan skrip ini lagi.`
  }

  if (code === 7 || code === 'PERMISSION_DENIED' || text.includes('PERMISSION_DENIED')) {
    return `Service account ini tidak punya izin ke proyek ${serviceAccount.project_id}.

Pastikan kuncinya diunduh dari proyek yang sama dengan yang ada di .env,
dan perannya minimal Editor atau Cloud Datastore User.`
  }

  if (text.includes('ENOTFOUND') || text.includes('ETIMEDOUT') || text.includes('EAI_AGAIN')) {
    return 'Tidak bisa menghubungi server Google. Periksa koneksi internet lalu ulangi.'
  }

  return `Gagal: ${text}${code ? `\n(kode ${code})` : ''}`
}

let auth
let db

try {
  initializeApp({ credential: cert(serviceAccount) })
  auth = getAuth()
  db = getFirestore()
} catch (error) {
  fail(explain(error))
}

console.log(`Proyek: ${serviceAccount.project_id}\n`)

/* -------------------------------------------------------------------- utilitas */

/** 0851… jadi +62851…, bentuk yang dipakai Firebase Auth. Sama seperti src/lib/phone.ts. */
function toE164(input) {
  const trimmed = String(input).trim()
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''
  if (trimmed.startsWith('+')) return `+${digits}`
  if (digits.startsWith('0')) return `+62${digits.slice(1)}`
  if (digits.startsWith('62')) return `+${digits}`
  return `+62${digits}`
}

/**
 * Mencari akun yang sudah ada, atau membuatnya. Admin SDK bisa membuat akun
 * nomor HP tanpa OTP, sesuatu yang tidak bisa dilakukan aplikasi: dari browser,
 * nomor HP selalu harus dibuktikan pemilik nomornya.
 */
async function findOrCreateAccount({ email, phone, password, name }) {
  if (email) {
    try {
      const found = await auth.getUserByEmail(email)
      console.log(`Akun ditemukan: ${email}`)
      return found
    } catch (error) {
      if (error.code !== 'auth/user-not-found') fail(explain(error))
    }

    if (!password) {
      fail(`Akun ${email} belum ada. Jalankan ulang dengan --password untuk membuatnya.`)
    }

    try {
      const created = await auth.createUser({ email, password, displayName: name })
      console.log(`Akun dibuat: ${email}`)
      return created
    } catch (error) {
      if (error.code === 'auth/invalid-password') {
        fail('Kata sandi terlalu pendek. Firebase mensyaratkan minimal 6 karakter.')
      }
      if (error.code === 'auth/invalid-email') fail(`Format email "${email}" tidak valid.`)
      fail(explain(error))
    }
  }

  try {
    const found = await auth.getUserByPhoneNumber(phone)
    console.log(`Akun ditemukan: ${phone}`)
    return found
  } catch (error) {
    if (error.code !== 'auth/user-not-found') fail(explain(error))
  }

  try {
    const created = await auth.createUser({ phoneNumber: phone, displayName: name })
    console.log(`Akun dibuat: ${phone}`)
    return created
  } catch (error) {
    if (error.code === 'auth/invalid-phone-number') {
      fail(`Nomor "${phone}" tidak valid. Tulis seperti 085156657853.`)
    }
    fail(explain(error))
  }
}

/* ----------------------------------------------------------------- perintah */

if (command === 'reset') {
  if (!values.yes) {
    fail(`Perintah ini menghapus data secara permanen. Ulangi dengan --yes kalau memang itu maksudnya.

Yang akan dihapus:
  koleksi lama di akar: staff, products, recipes, productions, sales, expenses${
    values.all ? '\n  DAN SELURUH DATA BARU: tenants (beserta isinya) dan users' : ''
  }`)
  }

  // Koleksi datar peninggalan model satu warung. Model sekarang menaruh semua
  // data usaha di bawah tenants/{id}/…, jadi yang di akar tidak dibaca siapa pun
  // lagi dan hanya membingungkan kalau ditinggalkan.
  const legacy = ['staff', 'products', 'recipes', 'productions', 'sales', 'expenses']
  const targets = values.all ? [...legacy, 'tenants', 'users'] : legacy

  for (const name of targets) {
    try {
      const snapshot = await db.collection(name).count().get()
      const total = snapshot.data().count
      if (total === 0) {
        console.log(`${name}: kosong`)
        continue
      }
      // recursiveDelete ikut menyapu subkoleksi, yang penting untuk tenants:
      // menghapus dokumen induk saja akan meninggalkan produk dan struk di
      // bawahnya sebagai data yatim yang tidak bisa dibaca siapa pun.
      await db.recursiveDelete(db.collection(name))
      console.log(`${name}: ${total} dokumen dihapus`)
    } catch (error) {
      fail(explain(error))
    }
  }

  console.log('\nSelesai.')
  process.exit(0)
}

if (command === 'admin') {
  const email = values.email?.trim().toLowerCase()
  const phone = values.phone ? toE164(values.phone) : ''
  if (!email && !phone) fail('Admin perlu --email atau --phone.')

  const account = await findOrCreateAccount({
    email,
    phone,
    password: values.password,
    name: values.name,
  })
  const name = values.name?.trim() || email?.split('@')[0] || phone

  try {
    await db.collection('users').doc(account.uid).set(
      {
        name,
        email: email ?? '',
        phone,
        role: 'admin',
        // Admin platform tidak punya warung, dan memang tidak boleh punya: ia
        // mengelola warung, bukan membaca pembukuannya.
        tenantId: '',
        active: true,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  } catch (error) {
    fail(explain(error))
  }

  console.log(`\nAdmin platform: ${name}`)
  console.log(`   uid ${account.uid}`)
  console.log('\nSelesai. Masuk ke aplikasi, lalu tambahkan warung dari menu Warung.')
  process.exit(0)
}

/* ------------------------------------------------------------------- warung */

if (!values.tenant) fail('Perintah warung perlu --tenant "Nama Warung".')
if (values.role !== 'pemilik' && values.role !== 'kasir') {
  fail(`Peran "${values.role}" tidak dikenal. Isi pemilik atau kasir.`)
}

const tenantName = values.tenant.trim()
let tenantId

try {
  const existing = await db
    .collection('tenants')
    .where('name', '==', tenantName)
    .limit(1)
    .get()

  if (existing.empty) {
    const created = await db.collection('tenants').add({
      name: tenantName,
      ownerName: values.name?.trim() ?? '',
      phone: values.phone ? toE164(values.phone) : '',
      address: '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    tenantId = created.id
    console.log(`Warung dibuat: ${tenantName}`)
  } else {
    tenantId = existing.docs[0].id
    console.log(`Warung ditemukan: ${tenantName}`)
  }
} catch (error) {
  fail(explain(error))
}

console.log(`   id ${tenantId}`)

const email = values.email?.trim().toLowerCase()
const phone = values.phone ? toE164(values.phone) : ''

if (email || phone) {
  const account = await findOrCreateAccount({
    email,
    phone,
    password: values.password,
    name: values.name,
  })
  const name = values.name?.trim() || email?.split('@')[0] || phone

  try {
    await db.collection('users').doc(account.uid).set(
      {
        name,
        email: email ?? '',
        phone,
        role: values.role,
        tenantId,
        active: true,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  } catch (error) {
    fail(explain(error))
  }

  console.log(`Pengguna: ${name} (${values.role})`)
  console.log(`   uid ${account.uid}`)
}

/* ----------------------------------------------------------- produk contoh */

/**
 * Contoh isi awal, mencakup ketiga jenis yang dipakai aplikasi: barang dagangan
 * yang dijual apa adanya, produk olahan yang harga modalnya datang dari
 * perhitungan HPP, dan bahan baku yang hanya dipakai lewat resep.
 *
 * Semuanya boleh dihapus dari halaman Produk & Stok setelah dagangan asli
 * dimasukkan.
 */
const SAMPLE_PRODUCTS = [
  // Barang jadi: dibeli lalu dijual apa adanya, muncul di layar kasir.
  { type: 'jadi', sku: 'MI-001', name: 'Mie instan goreng', category: 'Makanan', unit: 'pcs', costPrice: 2800, sellPrice: 3500, stock: 48, minStock: 12 },
  { type: 'jadi', sku: 'MN-001', name: 'Air mineral 600 ml', category: 'Minuman', unit: 'botol', costPrice: 2400, sellPrice: 3000, stock: 60, minStock: 24 },
  { type: 'jadi', sku: 'MN-002', name: 'Teh kotak 250 ml', category: 'Minuman', unit: 'kotak', costPrice: 3600, sellPrice: 4500, stock: 36, minStock: 12 },
  { type: 'jadi', sku: 'MN-003', name: 'Kopi sachet', category: 'Minuman', unit: 'pcs', costPrice: 1300, sellPrice: 2000, stock: 80, minStock: 20 },
  { type: 'jadi', sku: 'SB-001', name: 'Gula pasir 1 kg', category: 'Sembako', unit: 'kg', costPrice: 14500, sellPrice: 17000, stock: 15, minStock: 5 },
  { type: 'jadi', sku: 'SB-002', name: 'Minyak goreng 1 liter', category: 'Sembako', unit: 'botol', costPrice: 16800, sellPrice: 19500, stock: 12, minStock: 4 },
  { type: 'jadi', sku: 'RT-001', name: 'Sabun mandi batang', category: 'Kebutuhan Rumah', unit: 'pcs', costPrice: 3200, sellPrice: 4500, stock: 24, minStock: 8 },

  // Produk olahan sendiri. Stok awalnya nol dan harga modalnya nol, karena
  // keduanya diisi oleh perhitungan HPP saat produksi pertama dijalankan.
  { type: 'jadi', sku: 'OL-001', name: 'Cenil gula merah', category: 'Jajanan Olahan', unit: 'pcs', costPrice: 0, sellPrice: 1500, stock: 0, minStock: 20 },
  { type: 'jadi', sku: 'OL-002', name: 'Klepon gula merah', category: 'Jajanan Olahan', unit: 'pcs', costPrice: 0, sellPrice: 2000, stock: 0, minStock: 20 },

  // Bahan baku: tidak pernah muncul di kasir, hanya dipakai lewat resep.
  // Satuannya satuan pembelian; resep boleh memakai gram atau ml.
  { type: 'bahan', sku: 'BB-001', name: 'Gula merah', category: 'Bahan Baku', unit: 'kg', costPrice: 18000, sellPrice: 0, stock: 10, minStock: 3 },
  { type: 'bahan', sku: 'BB-002', name: 'Tepung tapioka', category: 'Bahan Baku', unit: 'kg', costPrice: 12000, sellPrice: 0, stock: 8, minStock: 2 },
  { type: 'bahan', sku: 'BB-003', name: 'Tepung beras ketan', category: 'Bahan Baku', unit: 'kg', costPrice: 16500, sellPrice: 0, stock: 5, minStock: 2 },
  { type: 'bahan', sku: 'BB-004', name: 'Kelapa parut', category: 'Bahan Baku', unit: 'kg', costPrice: 9000, sellPrice: 0, stock: 4, minStock: 1 },
  { type: 'bahan', sku: 'BB-005', name: 'Air galon', category: 'Bahan Baku', unit: 'liter', costPrice: 1200, sellPrice: 0, stock: 19, minStock: 5 },
  { type: 'bahan', sku: 'BB-006', name: 'Garam', category: 'Bahan Baku', unit: 'kg', costPrice: 8000, sellPrice: 0, stock: 2, minStock: 1 },
  { type: 'bahan', sku: 'BB-007', name: 'Pewarna makanan', category: 'Bahan Baku', unit: 'botol', costPrice: 6500, sellPrice: 0, stock: 3, minStock: 1 },
  { type: 'bahan', sku: 'BB-008', name: 'Daun pandan', category: 'Bahan Baku', unit: 'bungkus', costPrice: 3000, sellPrice: 0, stock: 6, minStock: 2 },
  { type: 'bahan', sku: 'BB-009', name: 'Mika kemasan', category: 'Kemasan', unit: 'pcs', costPrice: 450, sellPrice: 0, stock: 200, minStock: 50 },
]

if (values['with-products']) {
  const products = db.collection('tenants').doc(tenantId).collection('products')
  let created = 0
  let skipped = 0

  try {
    for (const product of SAMPLE_PRODUCTS) {
      const existing = await products.where('sku', '==', product.sku).limit(1).get()
      if (!existing.empty) {
        skipped += 1
        continue
      }

      await products.add({
        ...product,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      created += 1
    }
  } catch (error) {
    fail(explain(error))
  }

  console.log(`\nProduk contoh: ${created} ditambahkan, ${skipped} dilewati karena sudah ada.`)
}

console.log('\nSelesai. Silakan masuk ke aplikasi.')
process.exit(0)
