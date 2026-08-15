import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { STORE_NAME } from '@/lib/firebase'
import { CardSkeleton, Skeleton, ToastViewport } from '@/components/ui'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { findNavItem } from './navigation'

const COLLAPSE_KEY = 'pos-sidebar-collapsed'

/** Rangka halaman saat chunk-nya masih diunduh. Bentuknya meniru isi akhir. */
function PageFallback() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <Skeleton className="h-72 w-full rounded-panel" />
    </div>
  )
}

/**
 * Kerangka aplikasi: sidebar tetap di kiri, header tetap di atas, sisanya
 * area konten yang diisi <Outlet />. Halaman tidak pernah menggambar
 * sidebar atau header sendiri.
 *
 * Halaman biasa mendapat pembatas lebar dan padding standar. Halaman dengan
 * `fullBleed` di navigation.ts (layar kasir) mengatur tinggi dan scroll-nya
 * sendiri karena panel keranjangnya harus menempel ke tepi layar.
 */
export function AppShell() {
  const location = useLocation()
  const current = findNavItem(location.pathname)

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === 'true',
  )
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, String(collapsed))
  }, [collapsed])

  // Judul tab mengikuti halaman aktif, sumbernya tetap navigation.ts.
  useEffect(() => {
    document.title = current ? `${current.label} · ${STORE_NAME}` : STORE_NAME
  }, [current])

  // Tutup drawer saat pindah halaman supaya tidak menutupi konten baru.
  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  return (
    <div
      className={cn(
        'grid h-[100dvh] grid-cols-1 overflow-hidden',
        collapsed ? 'lg:grid-cols-[72px_minmax(0,1fr)]' : 'lg:grid-cols-[264px_minmax(0,1fr)]',
      )}
    >
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-col overflow-hidden">
        <Header current={current} onOpenMobileNav={() => setMobileNavOpen(true)} />

        <main
          className={cn(
            'min-h-0 flex-1',
            current?.fullBleed ? 'overflow-hidden' : 'overflow-y-auto',
          )}
        >
          {current?.fullBleed ? (
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          ) : (
            <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              <Suspense fallback={<PageFallback />}>
                <Outlet />
              </Suspense>
            </div>
          )}
        </main>
      </div>

      <ToastViewport />
    </div>
  )
}
