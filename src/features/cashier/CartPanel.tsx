import { MinusIcon, PlusIcon, ShoppingCartIcon, TrashIcon } from '@phosphor-icons/react'
import { Button, EmptyState, IconButton } from '@/components/ui'
import { formatRupiah } from '@/lib/format'
import { cartSubtotal, useCart } from './useCart'
import type { Product } from '@/types'

interface CartPanelProps {
  /** Dipakai untuk membatasi qty agar tidak melebihi stok terbaru. */
  productsById: Map<string, Product>
  onCheckout: () => void
}

export function CartPanel({ productsById, onCheckout }: CartPanelProps) {
  const { items, discount, setQty, removeItem, setDiscount, clear } = useCart()

  const subtotal = cartSubtotal(items)
  const appliedDiscount = Math.min(discount, subtotal)
  const total = subtotal - appliedDiscount

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCartIcon}
        title="Keranjang masih kosong"
        description="Pilih produk di sebelah kiri untuk mulai mencatat penjualan."
        className="my-auto"
      />
    )
  }

  return (
    <>
      <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
        {items.map((item) => {
          const stock = productsById.get(item.productId)?.stock ?? item.qty
          const atStockLimit = item.qty >= stock

          return (
            <div key={item.productId} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                  <p className="tabular mt-0.5 text-xs text-ink-subtle">
                    {formatRupiah(item.sellPrice)} per {item.unit}
                  </p>
                </div>
                <p className="tabular shrink-0 text-sm font-semibold text-ink">
                  {formatRupiah(item.subtotal)}
                </p>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 rounded-control border border-border">
                  <IconButton
                    label={`Kurangi ${item.name}`}
                    size="sm"
                    className="size-8"
                    onClick={() => setQty(item.productId, item.qty - 1)}
                  >
                    <MinusIcon size={15} weight="bold" />
                  </IconButton>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={stock}
                    aria-label={`Jumlah ${item.name}`}
                    value={item.qty}
                    onChange={(event) =>
                      setQty(item.productId, Math.min(Number(event.target.value), stock))
                    }
                    className="tabular w-12 bg-transparent text-center text-sm font-medium text-ink focus:outline-none"
                  />
                  <IconButton
                    label={`Tambah ${item.name}`}
                    size="sm"
                    className="size-8"
                    disabled={atStockLimit}
                    onClick={() => setQty(item.productId, item.qty + 1)}
                  >
                    <PlusIcon size={15} weight="bold" />
                  </IconButton>
                </div>

                <div className="flex items-center gap-2">
                  {atStockLimit ? (
                    <span className="text-xs text-warning-soft-fg">Stok maksimal</span>
                  ) : null}
                  <IconButton
                    label={`Hapus ${item.name} dari keranjang`}
                    size="sm"
                    className="size-8 hover:text-danger"
                    onClick={() => removeItem(item.productId)}
                  >
                    <TrashIcon size={16} />
                  </IconButton>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="shrink-0 border-t border-border bg-surface-2 px-4 py-4">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between text-ink-muted">
            <span>Subtotal</span>
            <span className="tabular">{formatRupiah(subtotal)}</span>
          </div>

          <div className="flex items-center justify-between gap-3 text-ink-muted">
            <label htmlFor="cart-discount" className="shrink-0">
              Diskon
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-ink-subtle">Rp</span>
              <input
                id="cart-discount"
                type="number"
                inputMode="numeric"
                min={0}
                max={subtotal}
                value={discount || ''}
                placeholder="0"
                onChange={(event) => setDiscount(Number(event.target.value))}
                className="tabular h-9 w-28 rounded-control border border-border-strong bg-surface px-2.5 text-right text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              />
            </div>
          </div>

          <div className="mt-1 flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-sm font-medium text-ink">Total</span>
            <span className="tabular text-2xl font-semibold tracking-tight text-ink">
              {formatRupiah(total)}
            </span>
          </div>
        </div>

        {/*
          Grid, bukan flex. `fullWidth` menghasilkan `w-full`, dan di dalam baris
          flex itu berarti 100% lebar BARIS, bukan sisa ruangnya: tombol Bayar
          menuntut selebar seluruh baris sementara Kosongkan masih memakan
          tempatnya sendiri, sehingga Bayar terdorong keluar layar. Di dalam sel
          grid, `w-full` berarti selebar selnya, yang memang yang dimaksud.
        */}
        <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
          <Button variant="secondary" onClick={clear}>
            Kosongkan
          </Button>
          <Button size="lg" fullWidth onClick={onCheckout} disabled={total < 0}>
            Bayar
          </Button>
        </div>
      </div>
    </>
  )
}
