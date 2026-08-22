import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import {
  LOGIN_PATH,
  RedirectIfAuthenticated,
  RequireAdmin,
  RequireAuth,
  RequireTenantUser,
} from '@/components/routing/AuthGuards'
import { AppShell } from '@/components/layout/AppShell'

// Halaman dimuat terpisah supaya bundel awal tetap ringan: grafik laporan
// tidak ikut terunduh saat kasir hanya membuka layar penjualan.
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const CashierPage = lazy(() => import('@/pages/CashierPage'))
const ProductsPage = lazy(() => import('@/pages/ProductsPage'))
const RecipesPage = lazy(() => import('@/pages/RecipesPage'))
const TransactionsPage = lazy(() => import('@/pages/TransactionsPage'))
const ExpensesPage = lazy(() => import('@/pages/ExpensesPage'))
const ReportsPage = lazy(() => import('@/pages/ReportsPage'))
const AdminTenantsPage = lazy(() => import('@/pages/AdminTenantsPage'))
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

/**
 * PETA RUTE
 *
 * Seluruh penjagaan ada di tingkat rute, tidak satu pun di dalam komponen
 * halaman, jadi tidak ada halaman yang bisa lupa dijaga:
 *
 *   RedirectIfAuthenticated  halaman masuk, tertutup bagi yang sudah punya sesi
 *   RequireAuth              seluruh aplikasi, tertutup bagi yang belum masuk
 *   RequireTenantUser        halaman warung, tertutup bagi admin platform
 *   RequireAdmin             halaman platform, tertutup bagi orang warung
 *
 * Dua wilayah terakhir memakai kerangka yang sama tapi tidak pernah saling
 * terlihat. Pemisahannya bukan sekadar menyembunyikan menu: firestore.rules
 * menegakkan batas yang sama di server, jadi admin yang memaksa membuka
 * /laporan tetap tidak mendapat satu angka pun.
 *
 * Menambah halaman: taruh <Route> baru di wilayah yang sesuai, dengan path yang
 * sama persis seperti entri di src/components/layout/navigation.ts.
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
                <Route element={<RequireTenantUser />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="kasir" element={<CashierPage />} />
                  <Route path="produk" element={<ProductsPage />} />
                  <Route path="resep" element={<RecipesPage />} />
                  <Route path="transaksi" element={<TransactionsPage />} />
                  <Route path="beban" element={<ExpensesPage />} />
                  <Route path="laporan" element={<ReportsPage />} />
                </Route>

                <Route path="admin" element={<RequireAdmin />}>
                  <Route index element={<AdminTenantsPage />} />
                  <Route path="pengguna" element={<AdminUsersPage />} />
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
