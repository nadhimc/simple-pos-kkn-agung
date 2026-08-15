import { Navigate, Outlet, useLocation, type Location } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { BrandMark } from '@/components/layout/BrandMark'
import { STORE_NAME } from '@/lib/firebase'

/** Halaman masuk. Satu satunya rute yang boleh diakses tanpa sesi. */
export const LOGIN_PATH = '/masuk'

/**
 * Tujuan bawaan setelah berhasil masuk. Sengaja layar kasir, bukan dashboard:
 * itu pekerjaan yang dibuka orang toko puluhan kali sehari.
 */
export const AUTH_LANDING = '/kasir'

/**
 * Layar tenang selama Firebase memulihkan sesi dan memeriksa keanggotaan staf.
 * Tanpa ini, pengguna yang sudah masuk akan melihat kedipan halaman login
 * setiap kali menyegarkan halaman.
 */
function AuthLoading() {
  return (
    <div className="grid min-h-[100dvh] place-items-center px-6">
      <div className="flex flex-col items-center gap-4">
        <BrandMark storeName={STORE_NAME} tone="light" compact />
        <p className="text-sm text-ink-muted">Memuat sesi.</p>
      </div>
    </div>
  )
}

/**
 * Rakit ulang alamat tujuan dari state navigasi.
 *
 * Nilainya hanya pernah diisi oleh RequireAuth di bawah, tapi tetap divalidasi:
 * hanya jalur relatif satu garis miring yang diterima, sehingga tidak ada cara
 * mengubahnya jadi lemparan ke domain luar.
 */
function safeRedirectTarget(state: unknown): string {
  const from = (state as { from?: Location } | null)?.from
  if (!from || typeof from.pathname !== 'string') return AUTH_LANDING

  const path = `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
  if (!path.startsWith('/') || path.startsWith('//')) return AUTH_LANDING
  if (path === LOGIN_PATH) return AUTH_LANDING

  return path
}

/**
 * Gerbang rute privat. Semua halaman aplikasi berada di bawah ini.
 *
 * Alamat yang sedang dituju disimpan lengkap dengan query dan hash, jadi tautan
 * dalam seperti /laporan?periode=bulan-ini tetap sampai ke tujuan setelah masuk.
 */
export function RequireAuth() {
  const { user, initializing } = useAuth()
  const location = useLocation()

  if (initializing) return <AuthLoading />

  if (!user) {
    return <Navigate to={LOGIN_PATH} replace state={{ from: location }} />
  }

  return <Outlet />
}

/**
 * Kebalikannya: rute yang justru tidak boleh dibuka saat sudah punya sesi.
 * Membuka /masuk dalam keadaan sudah masuk akan memantul kembali ke aplikasi,
 * bukan menampilkan form yang tidak ada gunanya.
 */
export function RedirectIfAuthenticated() {
  const { user, initializing } = useAuth()
  const location = useLocation()

  if (initializing) return <AuthLoading />

  if (user) {
    return <Navigate to={safeRedirectTarget(location.state)} replace />
  }

  return <Outlet />
}
