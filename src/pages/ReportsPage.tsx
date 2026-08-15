import { useMemo, useState } from 'react'
import { DownloadSimpleIcon, ChartPieSliceIcon } from '@phosphor-icons/react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Segmented,
  Skeleton,
  TextField,
} from '@/components/ui'
import { PERIOD_OPTIONS, resolvePeriod, usePeriodData, type PeriodKey } from '@/hooks/usePeriod'
import {
  computeProfitLoss,
  groupExpensesByCategory,
  rankProducts,
} from '@/lib/profit'
import {
  endOfDay,
  formatDate,
  formatNumber,
  formatPercent,
  formatRupiah,
  startOfDay,
  toDateInputValue,
} from '@/lib/format'
import { cn } from '@/lib/cn'

type RangeMode = PeriodKey | 'kustom'

function toCsvValue(value: string | number) {
  const text = String(value)
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export default function ReportsPage() {
  const [mode, setMode] = useState<RangeMode>('bulan-ini')
  const [customFrom, setCustomFrom] = useState(toDateInputValue(new Date()))
  const [customTo, setCustomTo] = useState(toDateInputValue(new Date()))

  const { from, to } = useMemo(() => {
    if (mode !== 'kustom') return resolvePeriod(mode)

    const [fy, fm, fd] = customFrom.split('-').map(Number)
    const [ty, tm, td] = customTo.split('-').map(Number)
    return {
      from: startOfDay(new Date(fy, fm - 1, fd)),
      to: endOfDay(new Date(ty, tm - 1, td)),
    }
  }, [mode, customFrom, customTo])

  const { sales, expenses, loading, error } = usePeriodData(from, to)

  const report = useMemo(() => computeProfitLoss(sales, expenses), [sales, expenses])
  const expenseGroups = useMemo(() => groupExpensesByCategory(expenses), [expenses])
  const products = useMemo(() => rankProducts(sales), [sales])

  function handleExport() {
    const rows: (string | number)[][] = [
      ['Laporan Laba Rugi'],
      ['Periode', `${formatDate(from)} sampai ${formatDate(to)}`],
      [],
      ['Keterangan', 'Nominal'],
      ['Omzet penjualan', report.revenue],
      ['Harga pokok penjualan', -report.costOfGoodsSold],
      ['Laba kotor', report.grossProfit],
      ...expenseGroups.map((group) => [`Beban ${group.category}`, -group.amount]),
      ['Total beban operasional', -report.operatingExpense],
      ['Laba bersih', report.netProfit],
      [],
      ['Produk', 'Qty terjual', 'Omzet', 'Laba'],
      ...products.map((product) => [
        product.name,
        product.qty,
        product.revenue,
        product.profit,
      ]),
    ]

    // Pemisah titik koma dipakai supaya Excel berlokal Indonesia langsung
    // memecah kolomnya dengan benar tanpa wizard impor.
    const csv = rows.map((row) => row.map(toCsvValue).join(';')).join('\n')
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `laba-rugi-${toDateInputValue(from)}-sd-${toDateInputValue(to)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const statementRows = [
    { label: 'Omzet penjualan', value: report.revenue, tone: 'plain' as const },
    {
      label: 'Harga pokok penjualan (HPP)',
      value: -report.costOfGoodsSold,
      tone: 'plain' as const,
    },
    { label: 'Laba kotor', value: report.grossProfit, tone: 'subtotal' as const },
    ...expenseGroups.map((group) => ({
      label: `Beban ${group.category.toLowerCase()}`,
      value: -group.amount,
      tone: 'plain' as const,
    })),
    {
      label: 'Total beban operasional',
      value: -report.operatingExpense,
      tone: 'subtotal' as const,
    },
    { label: 'Laba bersih', value: report.netProfit, tone: 'total' as const },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Laba Rugi"
        description="Omzet dikurangi harga pokok penjualan dan beban operasional pada periode yang dipilih."
        actions={
          <Button
            variant="secondary"
            icon={<DownloadSimpleIcon size={17} weight="bold" />}
            onClick={handleExport}
            disabled={loading || sales.length + expenses.length === 0}
          >
            Unduh CSV
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <Segmented
          aria-label="Periode laporan"
          value={mode}
          onChange={setMode}
          options={[...PERIOD_OPTIONS, { value: 'kustom' as const, label: 'Pilih tanggal' }]}
        />
        {mode === 'kustom' ? (
          <div className="flex flex-wrap items-end gap-3">
            <TextField
              label="Dari"
              type="date"
              containerClassName="w-44"
              value={customFrom}
              max={customTo}
              onChange={(event) => setCustomFrom(event.target.value)}
            />
            <TextField
              label="Sampai"
              type="date"
              containerClassName="w-44"
              value={customTo}
              min={customFrom}
              max={toDateInputValue(new Date())}
              onChange={(event) => setCustomTo(event.target.value)}
            />
          </div>
        ) : null}
      </div>

      {error ? <ErrorState message={error} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Laporan laba rugi"
            description={`${formatDate(from)} sampai ${formatDate(to)}`}
          />
          {loading ? (
            <CardBody>
              <Skeleton className="h-64 w-full" />
            </CardBody>
          ) : (
            <>
              {/*
                Laporan keuangan dibaca baris demi baris, jadi bentuk yang benar
                adalah daftar angka, bukan grafik. Grafik dipakai di dashboard
                untuk pergerakan waktu.
              */}
              <ul className="divide-y divide-border">
                {statementRows.map((row) => (
                  <li
                    key={row.label}
                    className={cn(
                      'flex items-baseline justify-between gap-4 px-5',
                      row.tone === 'total' ? 'bg-surface-2 py-4' : 'py-3',
                    )}
                  >
                    <span
                      className={cn(
                        'text-sm',
                        row.tone === 'plain' ? 'text-ink-muted' : 'font-medium text-ink',
                      )}
                    >
                      {row.label}
                    </span>
                    <span
                      className={cn(
                        'tabular shrink-0',
                        row.tone === 'total'
                          ? 'text-lg font-semibold'
                          : row.tone === 'subtotal'
                            ? 'text-sm font-semibold'
                            : 'text-sm',
                        row.value < 0 && row.tone !== 'plain'
                          ? 'text-danger'
                          : row.tone === 'plain'
                            ? 'text-ink-muted'
                            : 'text-ink',
                      )}
                    >
                      {row.value < 0
                        ? `(${formatRupiah(Math.abs(row.value))})`
                        : formatRupiah(row.value)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4">
                <div className="bg-surface px-5 py-3.5">
                  <p className="text-xs text-ink-muted">Transaksi</p>
                  <p className="tabular mt-0.5 text-sm font-semibold text-ink">
                    {formatNumber(report.transactionCount)}
                  </p>
                </div>
                <div className="bg-surface px-5 py-3.5">
                  <p className="text-xs text-ink-muted">Item terjual</p>
                  <p className="tabular mt-0.5 text-sm font-semibold text-ink">
                    {formatNumber(report.itemsSold)}
                  </p>
                </div>
                <div className="bg-surface px-5 py-3.5">
                  <p className="text-xs text-ink-muted">Margin kotor</p>
                  <p className="tabular mt-0.5 text-sm font-semibold text-ink">
                    {formatPercent(report.grossMargin)}
                  </p>
                </div>
                <div className="bg-surface px-5 py-3.5">
                  <p className="text-xs text-ink-muted">Margin bersih</p>
                  <p
                    className={cn(
                      'tabular mt-0.5 text-sm font-semibold',
                      report.netMargin < 0 ? 'text-danger' : 'text-ink',
                    )}
                  >
                    {formatPercent(report.netMargin)}
                  </p>
                </div>
              </div>
            </>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Kontribusi per produk"
            description="Laba tiap barang pada periode ini, terbesar di atas."
          />
          {loading ? (
            <CardBody>
              <Skeleton className="h-64 w-full" />
            </CardBody>
          ) : products.length === 0 ? (
            <EmptyState
              icon={ChartPieSliceIcon}
              title="Belum ada data penjualan"
              description="Laporan akan terisi begitu ada transaksi yang tercatat pada rentang tanggal ini."
            />
          ) : (
            <div className="max-h-[28rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-left text-xs text-ink-muted">
                    <th className="px-5 py-3 font-medium">Produk</th>
                    <th className="px-5 py-3 text-right font-medium">Qty</th>
                    <th className="px-5 py-3 text-right font-medium">Omzet</th>
                    <th className="px-5 py-3 text-right font-medium">Laba</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.map((product) => (
                    <tr key={product.productId}>
                      <td className="px-5 py-3 font-medium text-ink">{product.name}</td>
                      <td className="tabular px-5 py-3 text-right text-ink-muted">
                        {formatNumber(product.qty)}
                      </td>
                      <td className="tabular px-5 py-3 text-right text-ink-muted">
                        {formatRupiah(product.revenue)}
                      </td>
                      <td
                        className={cn(
                          'tabular px-5 py-3 text-right font-semibold',
                          product.profit < 0 ? 'text-danger' : 'text-ink',
                        )}
                      >
                        {formatRupiah(product.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
