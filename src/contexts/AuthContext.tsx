import { createContext, use, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

interface AuthContextValue {
  user: User | null
  /** True sampai Firebase selesai memulihkan sesi dari penyimpanan lokal. */
  initializing: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setInitializing(false)
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      },
      signOutUser: async () => {
        await signOut(auth)
      },
    }),
    [user, initializing],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth() {
  const context = use(AuthContext)
  if (!context) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return context
}

/** Nama tampilan kasir untuk struk dan riwayat transaksi. */
export function displayNameOf(user: User | null) {
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
    default:
      return 'Gagal masuk. Coba lagi sebentar lagi.'
  }
}
