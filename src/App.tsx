import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import {
  LOGIN_PATH,
  RedirectIfAuthenticated,
  RequireAuth,
} from '@/components/routing/AuthGuards'
import { AppShell } from '@/components/layout/AppShell'

// Halaman dimuat terpisah supaya bundel awal tetap ringan: grafik laporan
// tidak ikut terunduh saat kasir hanya membuka layar penjualan.
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const CashierPage = lazy(() => import('@/pages/CashierPage'))
const ProductsPage = lazy(() => import('@/pages/ProductsPage'))
const TransactionsPage = lazy(() => import('@/pages/TransactionsPage'))
const ExpensesPage = lazy(() => import('@/pages/ExpensesPage'))
const ReportsPage = lazy(() => import('@/pages/ReportsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

/**
 * PETA RUTE
 *
 * Hanya ada dua wilayah, dan keduanya dijaga di tingkat rute, bukan di dalam
 * komponen halaman:
 *
 *   RedirectIfAuthenticated  halaman masuk, tertutup bagi yang sudah punya sesi
 *   RequireAuth              seluruh aplikasi, tertutup bagi yang belum masuk
 *
 * Menambah halaman: taruh <Route> baru di dalam <AppShell>, dengan path yang
 * sama persis seperti entri di src/components/layout/navigation.ts. Halaman itu
 * ikut terlindungi otomatis, tidak perlu menulis pengecekan sesi sendiri.
 */
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route element={<RedirectIfAuthenticated />}>
              <Route path={LOGIN_PATH} element={<LoginPage />} />
            </Route>

            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="kasir" element={<CashierPage />} />
                <Route path="produk" element={<ProductsPage />} />
                <Route path="transaksi" element={<TransactionsPage />} />
                <Route path="beban" element={<ExpensesPage />} />
                <Route path="laporan" element={<ReportsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
