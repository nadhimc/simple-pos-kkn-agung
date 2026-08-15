import { collection, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export const staffRef = collection(db, 'staff')

export type StaffRole = 'pemilik' | 'kasir'

export interface StaffProfile {
  uid: string
  name: string
  email: string
  role: StaffRole
}

/**
 * DAFTAR STAF ADALAH GERBANG AKSES.
 *
 * Dengan Google Sign-In aktif, siapa pun pemilik akun Google bisa lolos tahap
 * autentikasi. Yang membedakan orang toko dari orang asing adalah keberadaan
 * dokumen `staff/{uid}`. firestore.rules memeriksa dokumen yang sama, jadi
 * pemeriksaan di sini murni untuk pengalaman pengguna, bukan lapisan keamanan.
 *
 * Dokumen staf hanya bisa dibuat lewat Firebase Console. Aplikasi sengaja tidak
 * bisa menambah dirinya sendiri ke daftar.
 */
export async function getStaffProfile(uid: string): Promise<StaffProfile | null> {
  const snapshot = await getDoc(doc(staffRef, uid))
  if (!snapshot.exists()) return null

  const data = snapshot.data()
  return {
    uid: snapshot.id,
    name: data.name ?? '',
    email: data.email ?? '',
    role: data.role === 'pemilik' ? 'pemilik' : 'kasir',
  }
}
