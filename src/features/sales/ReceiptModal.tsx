import { PrinterIcon } from '@phosphor-icons/react'
import { Button, Modal } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { APP_NAME } from '@/lib/firebase'
import { formatDateTime, formatNumber, formatRupiah } from '@/lib/format'
import type { Sale } from '@/types'

const METHOD_LABEL: Record<Sale['paymentMethod'], string> = {
  tunai: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
}

/**
 * Isi struk. Lebarnya sengaja sempit dan tipografinya monospace agar mendekati
 * hasil cetak printer termal 58mm yang biasa dipakai warung.
 */
export function ReceiptBody({ sale }: { sale: Sale }) {
  // Nama yang tercetak adalah nama warungnya, bukan nama layanan: struk ini
  // dipegang pembeli, dan yang dia kenali warungnya.
  const { tenant } = useAuth()

  return (
    <div
      id="receipt-print-area"
      className="mx-auto w-full max-w-80 font-mono text-xs text-ink"
    >
      <div className="text-center">
        <p className="text-sm font-semibold tracking-tight">
          {tenant?.name ?? APP_NAME}
        </p>
        <p className="mt-1 text-ink-muted">{sale.invoiceNo}</p>
        <p className="text-ink-muted">{formatDateTime(sale.createdAt)}</p>
        <p className="text-ink-muted">Kasir: {sale.cashierName}</p>
      </div>

      <div className="my-3 border-t border-dashed border-border-strong" />

      <ul className="flex flex-col gap-2">
        {sale.items.map((item) => (
          <li key={item.productId}>
            <p className="font-sans font-medium">{item.name}</p>
            <div className="mt-0.5 flex justify-between text-ink-muted">
              <span className="tabular">
                {formatNumber(item.qty)} {item.unit} x {formatRupiah(item.sellPrice)}
              </span>
              <span className="tabular text-ink">{formatRupiah(item.subtotal)}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="my-3 border-t border-dashed border-border-strong" />

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-ink-muted">
          <span>Subtotal</span>
          <span className="tabular">{formatRupiah(sale.subtotal)}</span>
        </div>
        {sale.discount > 0 ? (
          <div className="flex justify-between text-ink-muted">
            <span>Diskon</span>
            <span className="tabular">- {formatRupiah(sale.discount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between text-sm font-semibold">
          <span>Total</span>
          <span className="tabular">{formatRupiah(sale.total)}</span>
        </div>
        <div className="flex justify-between text-ink-muted">
          <span>{METHOD_LABEL[sale.paymentMethod]}</span>
          <span className="tabular">{formatRupiah(sale.cashReceived)}</span>
        </div>
        {sale.paymentMethod === 'tunai' ? (
          <div className="flex justify-between text-ink-muted">
            <span>Kembali</span>
            <span className="tabular">{formatRupiah(sale.change)}</span>
          </div>
        ) : null}
      </div>

      {sale.note ? (
        <>
          <div className="my-3 border-t border-dashed border-border-strong" />
          <p className="font-sans text-ink-muted">{sale.note}</p>
        </>
      ) : null}

      <div className="my-3 border-t border-dashed border-border-strong" />
      <p className="text-center text-ink-muted">Terima kasih sudah berbelanja.</p>
    </div>
  )
}

interface ReceiptModalProps {
  sale: Sale | null
  onClose: () => void
  /** Tombol utama setelah transaksi selesai, misalnya lanjut ke penjualan berikutnya. */
  primaryAction?: { label: string; onClick: () => void }
  title?: string
}

export function ReceiptModal({
  sale,
  onClose,
  primaryAction,
  title = 'Transaksi tersimpan',
}: ReceiptModalProps) {
  if (!sale) return null

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={`${sale.invoiceNo} · ${formatRupiah(sale.total)}`}
      size="sm"
      footer={
        <>
          <Button
            variant="secondary"
            icon={<PrinterIcon size={17} weight="bold" />}
            // Area cetak diisolasi lewat @media print di index.css, jadi hanya
            // struk ini yang keluar, bukan seluruh layar aplikasi.
            onClick={() => window.print()}
          >
            Cetak struk
          </Button>
          {primaryAction ? (
            <Button onClick={primaryAction.onClick}>{primaryAction.label}</Button>
          ) : (
            <Button onClick={onClose}>Tutup</Button>
          )}
        </>
      }
    >
      <ReceiptBody sale={sale} />
    </Modal>
  )
}
