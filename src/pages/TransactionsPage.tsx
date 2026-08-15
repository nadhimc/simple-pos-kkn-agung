import { useMemo, useState } from 'react'
import { ArrowCounterClockwiseIcon, ReceiptIcon } from '@phosphor-icons/react'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  Segmented,
  TableSkeleton,
  toast,
} from '@/components/ui'
import { ReceiptModal } from '@/features/sales/ReceiptModal'
import {
  PERIOD_OPTIONS,
  resolvePeriod,
  usePeriodData,
  type PeriodKey,
} from '@/hooks/usePeriod'
import { useProducts } from '@/hooks/useProducts'
import { voidSale } from '@/services/sales'
import { writeErrorMessage } from '@/lib/errors'
import { formatDateTime, formatNumber, formatRupiah } from '@/lib/format'
import type { Sale } from '@/types'

const METHOD_LABEL: Record<Sale['paymentMethod'], string> = {
  tunai: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
}

export default function TransactionsPage() {
  const [period, setPeriod] = useState<PeriodKey>('hari-ini')
  const { from, to } = useMemo(() => resolvePeriod(period), [period])
  const { sales, loading, error } = usePeriodData(from, to)
  const { products } = useProducts()

  const [detail, setDetail] = useState<Sale | null>(null)
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null)
  const [voiding, setVoiding] = useState(false)

  const totals = useMemo(
    () => ({
      revenue: sales.reduce((sum, sale) => sum + sale.total, 0),
      profit: sales.reduce((sum, sale) => sum + sale.grossProfit, 0),
    }),
    [sales],
  )

  async function handleVoid() {
    if (!voidTarget) return
    setVoiding(true)
    try {
      await voidSale(voidTarget, new Set(products.map((product) => product.id)))
      toast.success(`${voidTarget.invoiceNo} dibatalkan dan stoknya dikembalikan.`)
      setVoidTarget(null)
    } catch (caught) {
      toast.error(writeErrorMessage(caught))
    } finally {
      setVoiding(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transaksi"
        description="Riwayat penjualan beserta rincian tiap struk."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          aria-label="Periode transaksi"
          value={period}
          onChange={setPeriod}
          options={PERIOD_OPTIONS}
        />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-muted">
          <span>
            Omzet{' '}
            <span className="tabular font-semibold text-ink">
              {formatRupiah(totals.revenue)}
            </span>
          </span>
          <span>
            Laba kotor{' '}
            <span className="tabular font-semibold text-ink">
              {formatRupiah(totals.profit)}
            </span>
          </span>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <Card>
        {loading ? (
          <TableSkeleton rows={6} columns={5} />
        ) : sales.length === 0 ? (
          <EmptyState
            icon={ReceiptIcon}
            title="Belum ada transaksi pada periode ini"
            description="Setiap penjualan yang diselesaikan di layar kasir akan muncul di sini beserta rincian labanya."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-muted">
                  <th className="px-5 py-3 font-medium">Waktu</th>
                  <th className="px-5 py-3 font-medium">Nomor struk</th>
                  <th className="px-5 py-3 font-medium">Bayar</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                  <th className="px-5 py-3 text-right font-medium">Laba kotor</th>
                  <th className="px-5 py-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sales.map((sale) => (
                  <tr key={sale.id} className="transition-colors hover:bg-surface-2">
                    <td className="tabular px-5 py-3.5 whitespace-nowrap text-ink-muted">
                      {formatDateTime(sale.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-ink">{sale.invoiceNo}</p>
                      <p className="mt-0.5 text-xs text-ink-subtle">
                        {formatNumber(sale.items.length)} jenis oleh {sale.cashierName}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge>{METHOD_LABEL[sale.paymentMethod]}</Badge>
                    </td>
                    <td className="tabular px-5 py-3.5 text-right font-semibold text-ink">
                      {formatRupiah(sale.total)}
                    </td>
                    <td className="tabular px-5 py-3.5 text-right text-ink-muted">
                      {formatRupiah(sale.grossProfit)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setDetail(sale)}
                        >
                          Lihat struk
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hover:text-danger"
                          icon={<ArrowCounterClockwiseIcon size={16} weight="bold" />}
                          onClick={() => setVoidTarget(sale)}
                        >
                          Batalkan
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ReceiptModal
        sale={detail}
        onClose={() => setDetail(null)}
        title={`Struk ${detail?.invoiceNo ?? ''}`}
      />

      <ConfirmDialog
        open={Boolean(voidTarget)}
        title={`Batalkan ${voidTarget?.invoiceNo ?? 'transaksi'}?`}
        message="Struk dihapus dari riwayat dan stok setiap barang di dalamnya dikembalikan. Laporan laba rugi ikut menyesuaikan. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Batalkan transaksi"
        destructive
        loading={voiding}
        onConfirm={handleVoid}
        onCancel={() => setVoidTarget(null)}
      />
    </div>
  )
}
