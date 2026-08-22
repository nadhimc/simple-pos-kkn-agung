import { collection, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * JALUR DATA WARUNG.
 *
 * Seluruh data usaha hidup di bawah `tenants/{tenantId}/…`. Tenant sengaja
 * dijadikan bagian dari jalur dokumen, bukan sekadar field di dalamnya, karena
 * dengan begitu kueri yang lupa memfilter warung tidak mungkin ada: jalurnya
 * sendiri yang menentukan warung mana yang dibaca, dan firestore.rules
 * memeriksa keanggotaannya di server pada setiap permintaan.
 */
function requireTenant(tenantId: string) {
  // Tanpa penjagaan ini, tenantId kosong akan membentuk jalur `tenants//products`
  // yang ditolak Firestore dengan pesan yang tidak menjelaskan apa apa. Gagal
  // di sini jauh lebih mudah ditelusuri.
  if (!tenantId) {
    throw new Error(
      'Warung belum diketahui. Data hanya bisa dibaca setelah profil pengguna dimuat.',
    )
  }
  return tenantId
}

export function tenantDoc(tenantId: string) {
  return doc(db, 'tenants', requireTenant(tenantId))
}

export function tenantCollection(tenantId: string, name: string) {
  return collection(db, 'tenants', requireTenant(tenantId), name)
}

export const tenantsRef = collection(db, 'tenants')
export const usersRef = collection(db, 'users')
