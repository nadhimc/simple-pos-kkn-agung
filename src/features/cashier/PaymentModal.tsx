import { useEffect, useMemo, useState } from 'react'
import { Button, Modal, Segmented, TextAreaField, toast } from '@/components/ui'
import { formatRupiah } from '@/lib/format'
import { cn } from '@/lib/cn'
import { createSale } from '@/services/sales'
import { saleErrorMessage } from '@/lib/errors'
import { displayNameOf, useAuth } from '@/contexts/AuthContext'
import { cartSubtotal, useCart } from './useCart'
import type { PaymentMethod, Product, Sale } from '@/types'

interface PaymentModalProps {
  open: boolean
  onClose: () => void
  productsById: Map<string, Product>
  onPaid: (sale: Sale) => void
}

/** Pecahan uang yang paling sering diterima kasir warung. */
const CASH_PRESETS = [2000, 5000, 10000, 20000, 50000, 100000]

/** Bulatkan ke atas ke kelipatan 5.000 supaya saran uang pas terasa wajar. */
function roundUpTo(value: number, step: number) {
  return Math.ceil(value / step) * step
}

export function PaymentModal({
  open,
  onClose,
  productsById,
  onPaid,
}: PaymentModalProps) {
  const { user, appUser, tenantId } = useAuth()
  const { items, discount, note, setNote, clear } = useCart()

  const [method, setMethod] = useState<PaymentMethod>('tunai')
  const [cashReceived, setCashReceived] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const subtotal = cartSubtotal(items)
  const total = subtotal - Math.min(discount, subtotal)

  const suggestions = useMemo(() => {
    const rounded = [
      total,
      roundUpTo(total, 5000),
      roundUpTo(total, 10000),
      roundUpTo(total, 50000),
    ]
    const fromPresets = CASH_PRESETS.filter((value) => value >= total)
    return [...new Set([...rounded, ...fromPresets])]
      .filter((value) => value >= total)
      .sort((a, b) => a - b)
      .slice(0, 4)
  }, [total])

  useEffect(() => {
    if (!open) return
    setMethod('tunai')
    setCashReceived(total)
    setSubmitting(false)
  }, [open, total])

  const change = Math.max(cashReceived - total, 0)
  const cashShort = method === 'tunai' && cashReceived < total

  async function handleConfirm() {
    if (!user) return

    // Pemeriksaan terakhir terhadap stok snapshot terbaru. Batch penjualan
    // memakai increment dan tidak bisa mengunci stok di sisi server.
    const overSold = items.find((item) => {
      const stock = productsById.get(item.productId)?.stock
      return typeof stock === 'number' && item.qty > stock
    })

    if (overSold) {
      toast.error(
        `Stok ${overSold.name} tinggal ${productsById.get(overSold.productId)?.stock ?? 0}. Kurangi jumlahnya dulu.`,
      )
      return
    }

    setSubmitting(true)
    try {
      const sale = await createSale(tenantId, {
        items,
        discount,
        paymentMethod: method,
        cashReceived: method === 'tunai' ? cashReceived : total,
        note,
        cashierId: user.uid,
        cashierName: displayNameOf(user, appUser),
      })
      clear()
      onPaid(sale)
    } catch (caught) {
      toast.error(saleErrorMessage(caught))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pembayaran"
      description={`${items.length} jenis barang.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Kembali
          </Button>
          <Button
            size="lg"
            loading={submitting}
            disabled={cashShort || items.length === 0}
            onClick={handleConfirm}
          >
            Selesaikan transaksi
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="rounded-panel bg-accent-soft px-5 py-4">
          <p className="text-sm text-accent-soft-fg">Total tagihan</p>
          <p className="tabular mt-1 text-3xl font-semibold tracking-tight text-accent-soft-fg">
            {formatRupiah(total)}
          </p>
        </div>

        <Segmented
          aria-label="Metode pembayaran"
          value={method}
          onChange={setMethod}
          options={[
            { value: 'tunai', label: 'Tunai' },
            { value: 'qris', label: 'QRIS' },
            { value: 'transfer', label: 'Transfer' },
          ]}
        />

        {method === 'tunai' ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="cash-received" className="text-sm font-medium text-ink">
                Uang diterima
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-subtle">
                  Rp
                </span>
                <input
                  id="cash-received"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={500}
                  value={cashReceived || ''}
                  onChange={(event) => setCashReceived(Number(event.target.value))}
                  className={cn(
                    'tabular h-13 w-full rounded-control border bg-surface pr-3 pl-10 text-lg font-semibold text-ink',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                    cashShort ? 'border-danger' : 'border-border-strong',
                  )}
                />
              </div>
              {cashShort ? (
                <p className="text-xs font-medium text-danger">
                  Uang diterima kurang {formatRupiah(total - cashReceived)}.
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {suggestions.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCashReceived(value)}
                  className={cn(
                    'tabular rounded-control border px-3 py-2 text-sm font-medium transition-colors',
                    cashReceived === value
                      ? 'border-accent bg-accent-soft text-accent-soft-fg'
                      : 'border-border-strong text-ink-muted hover:bg-surface-hover hover:text-ink',
                  )}
                >
                  {value === total ? 'Uang pas' : formatRupiah(value)}
                </button>
              ))}
            </div>

            <div className="flex items-baseline justify-between rounded-control border border-border bg-surface-2 px-4 py-3">
              <span className="text-sm text-ink-muted">Kembalian</span>
              <span className="tabular text-xl font-semibold text-ink">
                {formatRupiah(change)}
              </span>
            </div>
          </div>
        ) : (
          <p className="rounded-control border border-border bg-surface-2 px-4 py-3 text-sm text-ink-muted">
            Pastikan pembayaran {method === 'qris' ? 'QRIS' : 'transfer'} sudah masuk
            sebelum menyelesaikan transaksi. Nominal dicatat pas sebesar total tagihan.
          </p>
        )}

        <TextAreaField
          label="Catatan"
          helper="Opsional. Misalnya nama pembeli atau pesanan khusus."
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </Modal>
  )
}
