import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getStaffProfile, type StaffProfile } from '@/services/staff'

interface AuthContextValue {
  user: User | null
  /** Profil dari koleksi `staff`. Null saat statusnya belum diketahui. */
  staff: StaffProfile | null
  /** True sampai Firebase memulihkan sesi dan keanggotaan staf selesai dicek. */
  initializing: boolean
  /** Diisi saat akun berhasil login tetapi tidak terdaftar sebagai staf. */
  accessError: string
  clearAccessError: () => void
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [staff, setStaff] = useState<StaffProfile | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [accessError, setAccessError] = useState('')

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null)
        setStaff(null)
        setInitializing(false)
        return
      }

      try {
        const profile = await getStaffProfile(nextUser.uid)

        if (!profile) {
          // Autentikasi berhasil tetapi orangnya bukan staf toko. Sesinya
          // ditutup supaya tidak ada layar aplikasi yang sempat terlihat.
          setAccessError(
            `Akun ${nextUser.email ?? 'ini'} belum terdaftar sebagai staf toko. ` +
              `Minta pemilik menambahkan UID berikut ke koleksi "staff" di Firebase Console: ${nextUser.uid}`,
          )
          await signOut(auth)
          return
        }

        setUser(nextUser)
        setStaff(profile)
      } catch {
        // Pemeriksaan staf gagal, biasanya karena sedang offline. Sesi
        // dipertahankan supaya kasir tidak terlempar keluar di tengah jualan.
        // Keamanannya tetap terjaga: firestore.rules memeriksa keanggotaan yang
        // sama di sisi server, jadi lolos di sini tidak memberi akses apa pun.
        setUser(nextUser)
        setStaff(null)
      } finally {
        setInitializing(false)
      }
    })
  }, [])

  const clearAccessError = useCallback(() => setAccessError(''), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      staff,
      initializing,
      accessError,
      clearAccessError,
      signIn: async (email, password) => {
        setAccessError('')
        await signInWithEmailAndPassword(auth, email.trim(), password)
      },
      signInWithGoogle: async () => {
        setAccessError('')
        const provider = new GoogleAuthProvider()
        // Selalu tampilkan pemilih akun: satu perangkat kasir sering dipakai
        // bergantian, dan diam diam memakai sesi Google terakhir bikin struk
        // tercatat atas nama orang yang salah.
        provider.setCustomParameters({ prompt: 'select_account' })
        await signInWithPopup(auth, provider)
      },
      signOutUser: async () => {
        setAccessError('')
        await signOut(auth)
      },
    }),
    [user, staff, initializing, accessError, clearAccessError],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth() {
  const context = use(AuthContext)
  if (!context) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return context
}

/** Nama tampilan kasir untuk struk dan riwayat transaksi. */
export function displayNameOf(user: User | null, staff?: StaffProfile | null) {
  if (staff?.name) return staff.name
  if (!user) return 'Tidak diketahui'
  return user.displayName || user.email?.split('@')[0] || 'Kasir'
}

/** Pesan error Firebase Auth diterjemahkan ke bahasa yang dimengerti pemilik warung. */
export function authErrorMessage(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : ''

  switch (code) {
    case 'auth/invalid-email':
      return 'Format email tidak valid.'
    case 'auth/user-disabled':
      return 'Akun ini dinonaktifkan. Hubungi pemilik toko.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email atau kata sandi salah.'
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan gagal. Coba lagi beberapa menit lagi.'
    case 'auth/network-request-failed':
      return 'Tidak ada koneksi internet. Periksa jaringan lalu coba lagi.'

    // Kode khusus alur Google.
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return ''
    case 'auth/popup-blocked':
      return 'Jendela Google diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.'
    case 'auth/unauthorized-domain':
      return 'Domain ini belum diizinkan. Tambahkan di Firebase Console, menu Authentication, Settings, Authorized domains.'
    case 'auth/operation-not-allowed':
      return 'Metode masuk ini belum diaktifkan di Firebase Console, menu Authentication, Sign-in method.'
    case 'auth/account-exists-with-different-credential':
      return 'Email ini sudah dipakai dengan metode masuk lain. Gunakan email dan kata sandi.'

    default:
      return 'Gagal masuk. Coba lagi sebentar lagi.'
  }
}
