import { Navigate, Outlet, useLocation, type Location } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { BrandMark } from '@/components/layout/BrandMark'
import { Button } from '@/components/ui'
import { APP_NAME } from '@/lib/firebase'

/** Halaman masuk. Satu satunya rute yang boleh diakses tanpa sesi. */
export const LOGIN_PATH = '/masuk'

/**
 * Tujuan bawaan setelah berhasil masuk. Untuk orang warung sengaja layar kasir,
 * bukan dashboard: itu pekerjaan yang dibuka puluhan kali sehari. Admin
 * platform tidak punya kasir, jadi mendarat di daftar warung.
 */
export const AUTH_LANDING = '/kasir'
export const ADMIN_LANDING = '/admin'

function landingFor(isAdmin: boolean) {
  return isAdmin ? ADMIN_LANDING : AUTH_LANDING
}

/**
 * Layar tenang selama Firebase memulihkan sesi dan memeriksa pendaftarannya.
 * Tanpa ini, pengguna yang sudah masuk akan melihat kedipan halaman login
 * setiap kali menyegarkan halaman.
 */
function AuthLoading() {
  return (
    <div className="grid min-h-[100dvh] place-items-center px-6">
      <div className="flex flex-col items-center gap-4">
        <BrandMark storeName={APP_NAME} tone="light" compact />
        <p className="text-sm text-ink-muted">Memuat sesi.</p>
      </div>
    </div>
  )
}

/**
 * Sesi ada, tapi profilnya gagal dibaca, hampir selalu karena jaringan.
 *
 * Sesinya sengaja tidak diputus: kasir tidak boleh terlempar keluar di tengah
 * jualan hanya karena internetnya berkedip. Tapi aplikasinya juga tidak bisa
 * digambar tanpa tahu warung mana yang dimaksud, jadi keadaannya ditampilkan
 * apa adanya, bukan disamarkan jadi layar kosong.
 */
function ProfileError({ message }: { message: string }) {
  const { reloadProfile, signOutUser } = useAuth()

  return (
    <div className="grid min-h-[100dvh] place-items-center px-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <BrandMark storeName={APP_NAME} tone="light" compact />
        <p className="text-sm text-ink-muted">{message}</p>
        <div className="flex gap-2">
          <Button onClick={reloadProfile}>Coba lagi</Button>
          <Button variant="secondary" onClick={() => void signOutUser()}>
            Keluar
          </Button>
        </div>
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
function safeRedirectTarget(state: unknown, isAdmin: boolean): string {
  const fallback = landingFor(isAdmin)
  const from = (state as { from?: Location } | null)?.from
  if (!from || typeof from.pathname !== 'string') return fallback

  const path = `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
  if (!path.startsWith('/') || path.startsWith('//')) return fallback
  if (path === LOGIN_PATH) return fallback

  return path
}

/**
 * Gerbang rute privat. Semua halaman aplikasi berada di bawah ini.
 *
 * Halaman tidak pernah memeriksa sesinya sendiri, jadi tidak ada halaman yang
 * bisa lupa dijaga. Alamat yang sedang dituju disimpan lengkap dengan query dan
 * hash, jadi tautan dalam seperti /laporan?periode=bulan-ini tetap sampai ke
 * tujuan setelah masuk.
 */
export function RequireAuth() {
  const { user, appUser, initializing, profileError } = useAuth()
  const location = useLocation()

  if (initializing) return <AuthLoading />

  if (!user) {
    return <Navigate to={LOGIN_PATH} replace state={{ from: location }} />
  }

  if (profileError) return <ProfileError message={profileError} />

  // Sesi sudah pulih tapi profilnya belum. Keadaan sesaat, bukan kesalahan.
  if (!appUser) return <AuthLoading />

  return <Outlet />
}

/**
 * Kebalikannya: rute yang justru tidak boleh dibuka saat sudah punya sesi.
 * Membuka /masuk dalam keadaan sudah masuk akan memantul kembali ke aplikasi,
 * bukan menampilkan form yang tidak ada gunanya.
 */
export function RedirectIfAuthenticated() {
  const { user, isAdmin, initializing } = useAuth()
  const location = useLocation()

  if (initializing) return <AuthLoading />

  if (user) {
    return <Navigate to={safeRedirectTarget(location.state, isAdmin)} replace />
  }

  return <Outlet />
}

/**
 * PEMISAH DUA DUNIA.
 *
 * Admin platform dan orang warung memakai kerangka yang sama tapi tidak pernah
 * melihat halaman satu sama lain. Pemisahannya di tingkat rute, bukan dengan
 * menyembunyikan menu, dan firestore.rules menegakkan hal yang sama di server:
 * admin yang memaksa membuka /laporan tetap tidak akan mendapat satu angka pun.
 */
export function RequireAdmin() {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to={AUTH_LANDING} replace />
  return <Outlet />
}

export function RequireTenantUser() {
  const { isAdmin } = useAuth()
  if (isAdmin) return <Navigate to={ADMIN_LANDING} replace />
  return <Outlet />
}
