import { initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  initializeAuth,
} from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missing.length > 0) {
  throw new Error(
    `Konfigurasi Firebase belum lengkap: ${missing.join(', ')}. ` +
      'Salin .env.example menjadi .env, atau isi Environment Variables di Vercel.',
  )
}

export const app = initializeApp(firebaseConfig)

/**
 * SESI SENGAJA DIBUAT AWET.
 *
 * Refresh token Firebase tidak punya masa berlaku: selama tidak logout, tidak
 * ganti kredensial, dan akunnya tidak dinonaktifkan, orang ini tidak akan
 * pernah diminta masuk lagi di perangkat yang sama. Itu memang yang dibutuhkan
 * warung, karena masuk lewat OTP di setiap buka aplikasi terlalu merepotkan.
 *
 * Urutan persistensinya IndexedDB dulu baru localStorage. IndexedDB lebih
 * tahan dibersihkan browser, dan localStorage jadi cadangan untuk browser yang
 * memblokirnya.
 *
 * `browserPopupRedirectResolver` harus disebut sendiri di sini: initializeAuth
 * tidak memasangnya otomatis seperti getAuth, dan tanpa itu login Google lewat
 * popup gagal.
 */
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
})

/*
  Bahasa untuk apa pun yang digambar Firebase sendiri, bukan oleh aplikasi ini:
  kotak reCAPTCHA dan isi SMS verifikasi. Tanpa ini keduanya berbahasa Inggris
  di tengah layar yang seluruhnya berbahasa Indonesia.

  Sengaja dikunci ke 'id', bukan mengikuti bahasa perangkat: seluruh teks
  aplikasi ini memang hanya ada dalam bahasa Indonesia, jadi mengikuti perangkat
  cuma menghasilkan campuran dua bahasa pada satu layar.
*/
auth.languageCode = 'id'

/**
 * Cache lokal persisten dinyalakan supaya kasir tetap bisa membuka daftar
 * produk dan mencatat transaksi ketika koneksi warung terputus sesaat. Tulisan
 * yang tertunda otomatis dikirim ulang saat koneksi kembali.
 *
 * `persistentMultipleTabManager` diperlukan karena kasir sering membuka
 * beberapa tab (kasir di satu tab, laporan di tab lain).
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

/**
 * Nama layanan, bukan nama warung. Nama warung datang dari dokumen tenant yang
 * sedang dibuka, karena satu pemasangan aplikasi ini melayani banyak warung.
 *
 * Sengaja konstanta, bukan environment variable. Ini identitas produk, bukan
 * konfigurasi per-deployment: menaruhnya di env berarti nama layanan bisa
 * berbeda antara localhost dan produksi tanpa ada yang menyadarinya.
 */
export const APP_NAME = 'SIPANDAI Jugosari'
export const APP_LONG_NAME = 'Sistem Informasi Pengelolaan Dana Desa Jugosari'
