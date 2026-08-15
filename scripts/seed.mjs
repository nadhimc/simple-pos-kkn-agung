#!/usr/bin/env node
/**
 * Pengisi data awal Firestore.
 *
 * Kenapa perlu skrip, bukan lewat aplikasi: firestore.rules menutup koleksi
 * `staff` dari sisi klien (`allow write: if false`), supaya tidak ada orang yang
 * bisa mendaftarkan dirinya sendiri jadi staf. Konsekuensinya staf pertama harus
 * dibuat dari luar aplikasi. Skrip ini memakai Firebase Admin SDK, yang berjalan
 * dengan kunci service account dan memang melewati Security Rules.
 *
 * Contoh:
 *   node scripts/seed.mjs --email pemilik@toko.id --password rahasia123 --name "Bu Sri"
 *   node scripts/seed.mjs --email kasir@toko.id --role kasir
 *   node scripts/seed.mjs --email pemilik@toko.id --with-products
 *
 * Skrip ini aman dijalankan berulang kali. Dokumen staf ditimpa dengan merge,
 * dan produk contoh dilewati kalau kodenya sudah ada.
 *
 * Skrip ini TIDAK PERNAH menulis ke koleksi `sales`. Data penjualan palsu akan
 * merusak laporan laba rugi yang sesungguhnya.
 */

import { existsSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', default: 'pemilik' },
    password: { type: 'string' },
    key: { type: 'string' },
    'with-products': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
})

const USAGE = `
Pemakaian:
  node scripts/seed.mjs --email <email staf> [pilihan]

Pilihan:
  --email <email>       Wajib. Akun yang didaftarkan sebagai staf.
  --name <nama>         Nama tampilan di struk. Default: bagian depan email.
  --role <peran>        pemilik atau kasir. Default: pemilik.
  --password <sandi>    Buat akun email/password baru kalau emailnya belum ada.
                        Kosongkan kalau akunnya sudah pernah masuk lewat Google.
  --with-products       Ikut mengisi contoh produk warung. Boleh dihapus nanti.
  --key <path>          Berkas kunci service account.
                        Default: ./serviceAccountKey.json atau
                        variabel GOOGLE_APPLICATION_CREDENTIALS.
`

if (values.help || !values.email) {
  console.log(USAGE)
  process.exit(values.help ? 0 : 1)
}

if (values.role !== 'pemilik' && values.role !== 'kasir') {
  console.error(`Peran "${values.role}" tidak dikenal. Isi pemilik atau kasir.`)
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

/* --------------------------------------------------------------- akun staf */

const email = values.email.trim().toLowerCase()
let user

try {
  user = await auth.getUserByEmail(email)
  console.log(`Akun ditemukan: ${email}`)
} catch (error) {
  if (error.code && error.code !== 'auth/user-not-found') fail(explain(error))
  if (!error.code) fail(explain(error))

  if (!values.password) {
    console.error(`
Akun ${email} belum ada di Firebase Authentication.

Dua cara melanjutkan:
  1. Jalankan ulang dengan --password untuk membuat akun email/password baru.
  2. Atau masuk sekali ke aplikasi dengan akun Google itu. Aplikasi akan
     menolak karena belum terdaftar sebagai staf, tapi akunnya sudah tercipta
     di Authentication. Setelah itu jalankan skrip ini lagi tanpa --password.
`)
    process.exit(1)
  }

  try {
    user = await auth.createUser({
      email,
      password: values.password,
      displayName: values.name,
    })
  } catch (caught) {
    if (caught.code === 'auth/invalid-password') {
      fail('Kata sandi terlalu pendek. Firebase mensyaratkan minimal 6 karakter.')
    }
    if (caught.code === 'auth/invalid-email') {
      fail(`Format email "${email}" tidak valid.`)
    }
    fail(explain(caught))
  }
  console.log(`Akun dibuat: ${email}`)
}

const name = values.name?.trim() || email.split('@')[0]

try {
  await db.collection('staff').doc(user.uid).set(
    {
      name,
      email,
      role: values.role,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
} catch (error) {
  fail(explain(error))
}

console.log(`Terdaftar sebagai staf: ${name} (${values.role})`)
console.log(`   uid ${user.uid}`)

/* ----------------------------------------------------------- produk contoh */

/**
 * Barang warung yang umum, dengan harga modal dan harga jual yang masuk akal.
 * Semuanya boleh dihapus dari halaman Produk & Stok setelah dagangan asli
 * dimasukkan.
 */
const SAMPLE_PRODUCTS = [
  { sku: 'MI-001', name: 'Mie instan goreng', category: 'Makanan', unit: 'pcs', costPrice: 2800, sellPrice: 3500, stock: 48, minStock: 12 },
  { sku: 'MN-001', name: 'Air mineral 600 ml', category: 'Minuman', unit: 'botol', costPrice: 2400, sellPrice: 3000, stock: 60, minStock: 24 },
  { sku: 'MN-002', name: 'Teh kotak 250 ml', category: 'Minuman', unit: 'kotak', costPrice: 3600, sellPrice: 4500, stock: 36, minStock: 12 },
  { sku: 'MN-003', name: 'Kopi sachet', category: 'Minuman', unit: 'pcs', costPrice: 1300, sellPrice: 2000, stock: 80, minStock: 20 },
  { sku: 'SB-001', name: 'Gula pasir 1 kg', category: 'Sembako', unit: 'kg', costPrice: 14500, sellPrice: 17000, stock: 15, minStock: 5 },
  { sku: 'SB-002', name: 'Minyak goreng 1 liter', category: 'Sembako', unit: 'botol', costPrice: 16800, sellPrice: 19500, stock: 12, minStock: 4 },
  { sku: 'SB-003', name: 'Telur ayam', category: 'Sembako', unit: 'kg', costPrice: 27000, sellPrice: 31000, stock: 8, minStock: 3 },
  { sku: 'SB-004', name: 'Beras 5 kg', category: 'Sembako', unit: 'karung', costPrice: 62000, sellPrice: 69000, stock: 6, minStock: 2 },
  { sku: 'MK-002', name: 'Roti tawar', category: 'Makanan', unit: 'bungkus', costPrice: 13500, sellPrice: 16000, stock: 9, minStock: 3 },
  { sku: 'RT-001', name: 'Sabun mandi batang', category: 'Kebutuhan Rumah', unit: 'pcs', costPrice: 3200, sellPrice: 4500, stock: 24, minStock: 8 },
]

if (values['with-products']) {
  const products = db.collection('products')
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
