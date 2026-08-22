import { useMemo, useState } from 'react'
import {
  ChartLineUpIcon,
  CoinsIcon,
  StorefrontIcon,
  WalletIcon,
} from '@phosphor-icons/react'
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SelectField,
  TableSkeleton,
} from '@/components/ui'
import { StatTile } from '@/features/dashboard/StatTile'
import { useTenantStats, useTenants } from '@/hooks/useAdmin'
import { profitFromTotals } from '@/lib/profit'
import { formatDateShort, formatNumber, formatPercent, formatRupiah } from '@/lib/format'
import { monthKey } from '@/services/stats'
import type { TenantStats } from '@/types'

const ALL = 'semua'

/** "2026-08" jadi "Agustus 2026". */
function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  })
}

/** Angka satu unit usaha pada periode terpilih. */
function totalsFor(stats: TenantStats | undefined, period: string) {
  if (!stats) return { revenue: 0, grossProfit: 0, expenseTotal: 0, salesCount: 0 }
  if (period === ALL) {
    return {
      revenue: stats.revenue,
      grossProfit: stats.grossProfit,
      expenseTotal: stats.expenseTotal,
      salesCount: stats.salesCount,
    }
  }
  return (
    stats.months[period] ?? {
      revenue: 0,
      grossProfit: 0,
      expenseTotal: 0,
      salesCount: 0,
    }
  )
}

/**
 * Ringkasan seluruh unit usaha untuk admin platform.
 *
 * Angkanya TIDAK dibaca dari struk. Admin sengaja tidak diberi akses ke
 * subkoleksi unit usaha mana pun, jadi yang dibaca di sini adalah dokumen
 * ringkasan yang ditambahkan tiap unit usaha sendiri, dalam batch yang sama
 * dengan transaksinya. Konsekuensinya disebutkan langsung di halaman ini,
 * bukan disembunyikan.
 */
export default function AdminSummaryPage() {
  const { tenants, loading: tenantsLoading, error: tenantsError } = useTenants()
  const { stats, loading: statsLoading, error: statsError } = useTenantStats()

  const [period, setPeriod] = useState(() => monthKey(new Date()))

  // Pilihan bulan datang dari bulan yang benar benar punya angka, ditambah bulan
  // berjalan supaya selalu ada yang bisa dipilih di sistem yang masih kosong.
  const periodOptions = useMemo(() => {
    const keys = new Set<string>([monthKey(new Date())])
    for (const entry of stats.values()) {
      for (const key of Object.keys(entry.months)) keys.add(key)
    }
    const sorted = [...keys].sort().reverse()
    return [
      ...sorted.map((key) => ({ value: key, label: monthLabel(key) })),
      { value: ALL, label: 'Sepanjang waktu' },
    ]
  }, [stats])

  const rows = useMemo(
    () =>
      tenants.map((tenant) => {
        const totals = totalsFor(stats.get(tenant.id), period)
        return {
          tenant,
          entry: stats.get(tenant.id),
          profit: profitFromTotals(
            totals.revenue,
            totals.grossProfit,
            totals.expenseTotal,
            totals.salesCount,
          ),
        }
      }),
    [tenants, stats, period],
  )

  const grand = useMemo(() => {
    const revenue = rows.reduce((sum, row) => sum + row.profit.revenue, 0)
    const grossProfit = rows.reduce((sum, row) => sum + row.profit.grossProfit, 0)
    const expense = rows.reduce((sum, row) => sum + row.profit.operatingExpense, 0)
    const count = rows.reduce((sum, row) => sum + row.profit.transactionCount, 0)
    return profitFromTotals(revenue, grossProfit, expense, count)
  }, [rows])

  const activeCount = rows.filter((row) => row.profit.transactionCount > 0).length
  const neverSold = rows.filter((row) => !row.entry?.lastSaleAt).length
  const loading = tenantsLoading || statsLoading
  const error = tenantsError || statsError

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ringkasan Usaha"
        description="Omzet, laba, dan kegiatan tiap unit usaha desa. Rinciannya tetap milik unit usaha masing masing."
        actions={
          <div className="w-56">
            <SelectField
              label="Periode"
              value={period}
              options={periodOptions}
              onChange={(event) => setPeriod(event.target.value)}
            />
          </div>
        }
      />

      {error ? <ErrorState message={error} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Omzet seluruh unit"
          value={formatRupiah(grand.revenue)}
          hint={`${formatNumber(grand.transactionCount)} transaksi`}
          icon={CoinsIcon}
        />
        <StatTile
          label="Laba bersih"
          value={formatRupiah(grand.netProfit)}
          hint={`margin ${formatPercent(grand.netMargin)}`}
          icon={ChartLineUpIcon}
          negative={grand.netProfit < 0}
        />
        <StatTile
          label="Beban operasional"
          value={formatRupiah(grand.operatingExpense)}
          hint="di luar harga modal barang"
          icon={WalletIcon}
        />
        <StatTile
          label="Unit usaha aktif"
          value={`${activeCount} dari ${rows.length}`}
          hint={
            neverSold > 0 ? `${neverSold} belum pernah menjual` : 'semua pernah menjual'
          }
          icon={StorefrontIcon}
        />
      </div>

      <Card>
        {loading ? (
          <TableSkeleton rows={4} columns={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={StorefrontIcon}
            title="Belum ada unit usaha"
            description="Tambahkan unit usaha lebih dulu di halaman Unit Usaha, lalu angkanya muncul di sini begitu ada transaksi."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-muted">
                  <th className="px-5 py-3 font-medium">Unit usaha</th>
                  <th className="px-5 py-3 text-right font-medium">Transaksi</th>
                  <th className="px-5 py-3 text-right font-medium">Omzet</th>
                  <th className="px-5 py-3 text-right font-medium">HPP</th>
                  <th className="px-5 py-3 text-right font-medium">Laba kotor</th>
                  <th className="px-5 py-3 text-right font-medium">Beban</th>
                  <th className="px-5 py-3 text-right font-medium">Laba bersih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ tenant, entry, profit }) => (
                  <tr key={tenant.id} className="transition-colors hover:bg-surface-2">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{tenant.name}</span>
                        {!tenant.active ? <Badge tone="danger">Nonaktif</Badge> : null}
                      </div>
                      <p className="text-xs text-ink-subtle">
                        {entry?.lastSaleAt
                          ? `Terakhir menjual ${formatDateShort(entry.lastSaleAt)}`
                          : 'Belum pernah menjual'}
                      </p>
                    </td>
                    <td className="tabular px-5 py-3.5 text-right text-ink-muted">
                      {formatNumber(profit.transactionCount)}
                    </td>
                    <td className="tabular px-5 py-3.5 text-right text-ink">
                      {formatRupiah(profit.revenue)}
                    </td>
                    <td className="tabular px-5 py-3.5 text-right text-ink-muted">
                      {formatRupiah(profit.costOfGoodsSold)}
                    </td>
                    <td className="tabular px-5 py-3.5 text-right text-ink">
                      {formatRupiah(profit.grossProfit)}
                    </td>
                    <td className="tabular px-5 py-3.5 text-right text-ink-muted">
                      {formatRupiah(profit.operatingExpense)}
                    </td>
                    <td
                      className={`tabular px-5 py-3.5 text-right font-semibold ${
                        profit.netProfit < 0 ? 'text-danger' : 'text-ink'
                      }`}
                    >
                      {formatRupiah(profit.netProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-surface-2">
                  <td className="px-5 py-3.5 font-medium text-ink">Seluruh unit</td>
                  <td className="tabular px-5 py-3.5 text-right text-ink-muted">
                    {formatNumber(grand.transactionCount)}
                  </td>
                  <td className="tabular px-5 py-3.5 text-right font-semibold text-ink">
                    {formatRupiah(grand.revenue)}
                  </td>
                  <td className="tabular px-5 py-3.5 text-right text-ink-muted">
                    {formatRupiah(grand.costOfGoodsSold)}
                  </td>
                  <td className="tabular px-5 py-3.5 text-right font-semibold text-ink">
                    {formatRupiah(grand.grossProfit)}
                  </td>
                  <td className="tabular px-5 py-3.5 text-right text-ink-muted">
                    {formatRupiah(grand.operatingExpense)}
                  </td>
                  <td
                    className={`tabular px-5 py-3.5 text-right font-semibold ${
                      grand.netProfit < 0 ? 'text-danger' : 'text-ink'
                    }`}
                  >
                    {formatRupiah(grand.netProfit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/*
        Batas ketelitian angka ini disebutkan terang terangan. Menyembunyikannya
        akan membuat orang memakai halaman ini untuk hal yang tidak sanggup
        ditanggungnya, misalnya audit.
      */}
      <div className="rounded-panel border border-border bg-surface-2 px-5 py-4">
        <p className="text-sm font-medium text-ink">Dari mana angka ini datang</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Admin sengaja tidak bisa membaca struk maupun catatan beban unit usaha mana
          pun, jadi angka di sini bukan hasil menjumlahkan ulang pembukuan mereka.
          Tiap unit usaha menambahkan totalnya sendiri setiap kali menyimpan
          transaksi. Artinya angkanya persis sepercaya catatan yang mendasarinya,
          tidak lebih dan tidak kurang. Untuk memeriksa rinciannya, minta pemilik
          unit usaha membuka halaman Laba Rugi miliknya.
        </p>
      </div>
    </div>
  )
}
