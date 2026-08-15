import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { RequireAuth } from '@/components/RequireAuth'
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
 * Menambah halaman: daftarkan <Route> di sini dengan path yang sama persis
 * seperti entri di src/components/layout/navigation.ts. Kerangka layar
 * (sidebar, header, skeleton saat memuat) sudah ditangani <AppShell />.
 */
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/masuk" element={<LoginPage />} />

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
