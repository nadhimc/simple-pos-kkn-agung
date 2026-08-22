import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { requestOtp, type PhoneChallenge } from '@/lib/phoneAuth'
import { getAppUser } from '@/services/users'
import { getTenant } from '@/services/tenants'
import type { AppUser, Tenant } from '@/types'

interface AuthContextValue {
  user: User | null
  /** Baris dari koleksi `users`. Null selama statusnya belum diketahui. */
  appUser: AppUser | null
  /** Warung yang sedang dibuka. Null untuk admin platform. */
  tenant: Tenant | null
  /** Jalan pintas ke `appUser.tenantId`. Kosong untuk admin. */
  tenantId: string
  isAdmin: boolean
  /** True sampai Firebase memulihkan sesi dan profilnya selesai dicek. */
  initializing: boolean
  /** Diisi saat login berhasil tetapi orangnya tidak berhak masuk. */
  accessError: string
  /** Diisi saat profilnya gagal dibaca, biasanya karena offline. */
  profileError: string
  clearAccessError: () => void
  reloadProfile: () => void
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  requestPhoneCode: (phoneE164: string, container: HTMLElement) => Promise<PhoneChallenge>
  confirmPhoneCode: (challenge: PhoneChallenge, code: string) => Promise<void>
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [accessError, setAccessError] = useState('')
  const [profileError, setProfileError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null)
        setAppUser(null)
        setTenant(null)
        setProfileError('')
        setInitializing(false)
        return
      }

      try {
        setProfileError('')
        const profile = await getAppUser(nextUser.uid)

        // Login hanya membuktikan siapa orangnya. Sejak Google dan nomor HP
        // aktif, siapa pun bisa lolos tahap itu. Yang menentukan boleh
        // tidaknya masuk adalah baris di koleksi `users`, yang cuma bisa
        // dibuat admin.
        if (!profile) {
          setAccessError(
            `Akun ${nextUser.phoneNumber ?? nextUser.email ?? 'ini'} belum terdaftar. ` +
              `Minta admin mendaftarkannya dengan UID berikut: ${nextUser.uid}`,
          )
          await signOut(auth)
          return
        }

        if (!profile.active) {
          setAccessError(
            'Akun ini dinonaktifkan. Hubungi admin untuk mengaktifkannya kembali.',
          )
          await signOut(auth)
          return
        }

        // Admin platform tidak punya warung, dan memang tidak boleh punya:
        // ia mengelola warung, bukan membaca pembukuannya.
        if (profile.role === 'admin') {
          setUser(nextUser)
          setAppUser(profile)
          setTenant(null)
          return
        }

        const ownTenant = await getTenant(profile.tenantId)
        if (!ownTenant) {
          setAccessError('Unit usaha untuk akun ini tidak ditemukan. Hubungi admin.')
          await signOut(auth)
          return
        }

        // Unit usaha yang dinonaktifkan menutup seluruh datanya di sisi server.
        // Ditolak di sini juga supaya orangnya mendapat penjelasan, bukan layar
        // yang gagal memuat tanpa sebab yang jelas.
        if (!ownTenant.active) {
          setAccessError(
            `${ownTenant.name} sedang dinonaktifkan, jadi datanya tidak bisa dibuka. Hubungi admin.`,
          )
          await signOut(auth)
          return
        }

        setUser(nextUser)
        setAppUser(profile)
        setTenant(ownTenant)
      } catch (caught) {
        // Profilnya gagal dibaca, hampir selalu karena jaringan. Sesinya
        // dipertahankan supaya kasir tidak terlempar keluar di tengah jualan,
        // tapi aplikasinya tidak bisa dibuka tanpa tahu warung mana yang
        // dimaksud, jadi keadaannya ditampilkan apa adanya lewat profileError
        // dan bukan dibiarkan seolah semuanya normal.
        if (import.meta.env.DEV) console.error(caught)
        setUser(nextUser)
        setAppUser(null)
        setTenant(null)
        setProfileError(
          'Profil pengguna gagal dimuat. Periksa koneksi lalu coba lagi.',
        )
      } finally {
        setInitializing(false)
      }
    })
  }, [reloadToken])

  const clearAccessError = useCallback(() => setAccessError(''), [])
  const reloadProfile = useCallback(() => setReloadToken((value) => value + 1), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      appUser,
      tenant,
      tenantId: appUser?.tenantId ?? '',
      isAdmin: appUser?.role === 'admin',
      initializing,
      accessError,
      profileError,
      clearAccessError,
      reloadProfile,
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
      requestPhoneCode: async (phoneE164, container) => {
        setAccessError('')
        return requestOtp(auth, phoneE164, container)
      },
      confirmPhoneCode: async (challenge, code) => {
        try {
          await challenge.confirmation.confirm(code)
        } finally {
          challenge.cleanup()
        }
      },
      signOutUser: async () => {
        setAccessError('')
        await signOut(auth)
      },
    }),
    [
      user,
      appUser,
      tenant,
      initializing,
      accessError,
      profileError,
      clearAccessError,
      reloadProfile,
    ],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth() {
  const context = use(AuthContext)
  if (!context) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return context
}

/**
 * Warung yang sedang dibuka. Dipisahkan dari useAuth supaya pemanggilnya tidak
 * perlu menangani kemungkinan tenantId kosong: layar warung hanya digambar
 * setelah gerbang rute memastikan profilnya ada.
 */
export function useTenantId() {
  return useAuth().tenantId
}

/** Nama tampilan untuk struk dan riwayat transaksi. */
export function displayNameOf(user: User | null, appUser?: AppUser | null) {
  if (appUser?.name) return appUser.name
  if (!user) return 'Tidak diketahui'
  return user.displayName || user.email?.split('@')[0] || user.phoneNumber || 'Kasir'
}

/** Pesan error Firebase Auth diterjemahkan ke bahasa yang dimengerti pengguna. */
export function authErrorMessage(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : ''

  switch (code) {
    case 'auth/invalid-email':
      return 'Format email tidak valid.'
    case 'auth/user-disabled':
      return 'Akun ini dinonaktifkan. Hubungi admin.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email atau kata sandi salah.'
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan gagal. Coba lagi beberapa menit lagi.'
    case 'auth/network-request-failed':
      return 'Tidak ada koneksi internet. Periksa jaringan lalu coba lagi.'

    // Pendaftaran akun baru oleh admin.
    case 'auth/email-already-in-use':
      return 'Email ini sudah dipakai akun lain. Kalau orangnya sudah pernah masuk, daftarkan lewat UID.'
    case 'auth/weak-password':
      return 'Kata sandi terlalu pendek. Minimal enam karakter.'

    // Masuk lewat nomor HP.
    case 'auth/invalid-phone-number':
    case 'auth/missing-phone-number':
      return 'Nomor HP tidak valid. Tulis seperti 0851 5665 7853.'
    case 'auth/invalid-verification-code':
      return 'Kode OTP salah. Periksa lagi angkanya.'
    case 'auth/code-expired':
      return 'Kode OTP sudah kedaluwarsa. Minta kode baru.'
    case 'auth/quota-exceeded':
      return 'Kuota SMS harian habis. Coba lagi besok atau masuk dengan email.'
    case 'auth/captcha-check-failed':
      return 'Pemeriksaan keamanan gagal. Muat ulang halaman lalu coba lagi.'
    case 'auth/credential-already-in-use':
      return 'Nomor ini sudah dipakai akun lain.'

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
