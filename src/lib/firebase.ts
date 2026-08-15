import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
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
export const auth = getAuth(app)

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

export const STORE_NAME = import.meta.env.VITE_STORE_NAME || 'Warungku'
