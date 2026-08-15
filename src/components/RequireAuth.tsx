import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { BrandMark } from '@/components/layout/BrandMark'
import { STORE_NAME } from '@/lib/firebase'

/**
 * Gerbang rute. Selama Firebase memulihkan sesi, tampilkan layar tenang supaya
 * pengguna yang sudah login tidak melihat kedipan halaman masuk.
 */
export function RequireAuth() {
  const { user, initializing } = useAuth()
  const location = useLocation()

  if (initializing) {
    return (
      <div className="grid min-h-[100dvh] place-items-center px-6">
        <div className="flex flex-col items-center gap-4">
          <BrandMark storeName={STORE_NAME} tone="light" compact />
          <p className="text-sm text-ink-muted">Memuat sesi.</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/masuk" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
