import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CoinsIcon,
  PackageIcon,
  ReceiptIcon,
  TrendUpIcon,
  WalletIcon,
  WarningIcon,
} from '@phosphor-icons/react'
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardSkeleton,
  EmptyState,
  ErrorState,
  PageHeader,
  Segmented,
  Skeleton,
} from '@/components/ui'
import { SalesTrendChart } from '@/features/dashboard/SalesTrendChart'
import { StatTile } from '@/features/dashboard/StatTile'
import {
  PERIOD_OPTIONS,
  resolvePeriod,
  usePeriodData,
  type PeriodKey,
} from '@/hooks/usePeriod'
import { useProducts } from '@/hooks/useProducts'
import { buildDailySeries, computeProfitLoss, rankProducts } from '@/lib/profit'
import { formatNumber, formatPercent, formatRupiah } from '@/lib/format'

export default function DashboardPage() {
  const [period, setPeriod] = useState<PeriodKey>('hari-ini')
  const { from, to } = useMemo(() => resolvePeriod(period), [period])
  const { sales, expenses, loading, error } = usePeriodData(from, to)
  const { products, loading: productsLoading } = useProducts()

  const profitLoss = useMemo(
    () => computeProfitLoss(sales, expenses),
    [sales, expenses],
  )

  const series = useMemo(
    () => buildDailySeries(sales, expenses, from, to),
    [sales, expenses, from, to],
  )

  const topProducts = useMemo(() => rankProducts(sales).slice(0, 5), [sales])

  const needsRestock = useMemo(
    () =>
      products
        .filter((product) => product.stock <= product.minStock)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 6),
    [products],
  )

  const maxProfit = topProducts[0]?.profit ?? 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Ringkasan penjualan, laba, dan stok untuk periode yang dipilih."
        actions={
          <Segmented
            aria-label="Periode ringkasan"
            value={period}
            onChange={setPeriod}
            options={PERIOD_OPTIONS}
          />
        }
      />

      {error ? <ErrorState message={error} /> : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Omzet"
            value={formatRupiah(profitLoss.revenue)}
            hint={`${formatNumber(profitLoss.transactionCount)} transaksi · ${formatNumber(profitLoss.itemsSold)} item`}
            icon={CoinsIcon}
          />
          <StatTile
            label="Laba kotor"
            value={formatRupiah(profitLoss.grossProfit)}
            hint={`Margin ${formatPercent(profitLoss.grossMargin)} setelah HPP`}
            icon={TrendUpIcon}
          />
          <StatTile
            label="Beban operasional"
            value={formatRupiah(profitLoss.operatingExpense)}
            hint="Di luar harga modal barang"
            icon={WalletIcon}
          />
          <StatTile
            label="Laba bersih"
            value={formatRupiah(profitLoss.netProfit)}
            hint={`Margin ${formatPercent(profitLoss.netMargin)}`}
            icon={ReceiptIcon}
            negative={profitLoss.netProfit < 0}
          />
        </div>
      )}

      <Card>
        <CardHeader
          title="Pergerakan harian"
          description="Omzet dan laba bersih per hari pada periode ini."
        />
        <CardBody>
          {loading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <SalesTrendChart data={series} />
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Penyumbang laba terbesar"
            description="Diurutkan berdasarkan kontribusi laba, bukan jumlah terjual."
          />
          {loading ? (
            <CardBody>
              <Skeleton className="h-40 w-full" />
            </CardBody>
          ) : topProducts.length === 0 ? (
            <EmptyState
              icon={ReceiptIcon}
              title="Belum ada penjualan"
              description="Catat transaksi pertama di layar kasir untuk melihat produk mana yang paling menguntungkan."
            />
          ) : (
            <ul className="divide-y divide-border">
              {topProducts.map((product) => (
                <li key={product.productId} className="px-5 py-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium text-ink">
                      {product.name}
                    </p>
                    <p className="tabular shrink-0 text-sm font-semibold text-ink">
                      {formatRupiah(product.profit)}
                    </p>
                  </div>
                  {/* Batang tanpa track abu abu: panjangnya sendiri yang membandingkan. */}
                  <div className="mt-2 flex items-center gap-3">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        backgroundColor: 'var(--chart-1)',
                        width: `${maxProfit > 0 ? Math.max((product.profit / maxProfit) * 100, 2) : 0}%`,
                      }}
                    />
                    <span className="tabular shrink-0 text-xs text-ink-subtle">
                      {formatNumber(product.qty)} terjual
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Stok perlu perhatian"
            description="Barang yang sudah menyentuh batas minimum atau habis."
            action={
              <Link
                to="/produk"
                className="text-sm font-medium text-accent underline-offset-4 hover:underline"
              >
                Kelola stok
              </Link>
            }
          />
          {productsLoading ? (
            <CardBody>
              <Skeleton className="h-40 w-full" />
            </CardBody>
          ) : needsRestock.length === 0 ? (
            <EmptyState
              icon={PackageIcon}
              title="Semua stok aman"
              description="Tidak ada barang yang menyentuh batas minimum saat ini."
            />
          ) : (
            <ul className="divide-y divide-border">
              {needsRestock.map((product) => (
                <li
                  key={product.id}
                  className="flex items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {product.name}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-subtle">{product.category}</p>
                  </div>
                  <Badge tone={product.stock <= 0 ? 'danger' : 'warning'}>
                    <WarningIcon size={12} weight="fill" />
                    <span className="tabular">
                      {product.stock <= 0
                        ? 'Habis'
                        : `Sisa ${formatNumber(product.stock)} ${product.unit}`}
                    </span>
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
