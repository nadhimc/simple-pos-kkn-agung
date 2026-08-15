import { useMemo, useRef, useState } from 'react'
import {
  BarcodeIcon,
  MagnifyingGlassIcon,
  PackageIcon,
  ShoppingCartIcon,
} from '@phosphor-icons/react'
import {
  Button,
  EmptyState,
  ErrorState,
  Modal,
  Skeleton,
  toast,
} from '@/components/ui'
import { CartPanel } from '@/features/cashier/CartPanel'
import { PaymentModal } from '@/features/cashier/PaymentModal'
import { ReceiptModal } from '@/features/sales/ReceiptModal'
import { cartSubtotal, useCart } from '@/features/cashier/useCart'
import { useProducts } from '@/hooks/useProducts'
import { formatNumber, formatRupiah } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Product, Sale } from '@/types'

function ProductTile({
  product,
  inCart,
  onSelect,
}: {
  product: Product
  inCart: number
  onSelect: () => void
}) {
  const soldOut = product.stock <= 0
  const low = !soldOut && product.stock <= product.minStock

  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={onSelect}
      className={cn(
        'flex h-full flex-col justify-between rounded-panel border bg-surface p-3.5 text-left',
        'transition-[background-color,border-color,transform] duration-150',
        soldOut
          ? 'cursor-not-allowed border-border opacity-55'
          : 'border-border hover:border-accent hover:bg-surface-hover active:translate-y-px',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm leading-snug font-medium text-ink">
          {product.name}
        </p>
        {inCart > 0 ? (
          <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-fg">
            {inCart}
          </span>
        ) : null}
      </div>

      <div className="mt-3">
        <p className="tabular text-sm font-semibold text-ink">
          {formatRupiah(product.sellPrice)}
        </p>
        <p
          className={cn(
            'tabular mt-0.5 text-xs',
            soldOut ? 'text-danger' : low ? 'text-warning-soft-fg' : 'text-ink-subtle',
          )}
        >
          {soldOut
            ? 'Stok habis'
            : `Sisa ${formatNumber(product.stock)} ${product.unit}`}
        </p>
      </div>
    </button>
  )
}

export default function CashierPage() {
  const { products, categories, loading, error } = useProducts()
  const { items, addItem } = useCart()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('semua')
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [cartSheetOpen, setCartSheetOpen] = useState(false)
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  )

  const qtyInCart = useMemo(
    () => new Map(items.map((item) => [item.productId, item.qty])),
    [items],
  )

  const visible = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return products.filter((product) => {
      if (category !== 'semua' && product.category !== category) return false
      if (!keyword) return true
      return (
        product.name.toLowerCase().includes(keyword) ||
        product.sku.toLowerCase().includes(keyword)
      )
    })
  }, [products, search, category])

  const subtotal = cartSubtotal(items)

  /**
   * Enter di kolom pencarian memasukkan satu-satunya hasil yang cocok. Ini yang
   * membuat pemindai barcode bekerja: alat itu mengetik kode lalu menekan Enter.
   */
  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault()
    const keyword = search.trim().toLowerCase()
    if (!keyword) return

    const exact = products.find((product) => product.sku.toLowerCase() === keyword)
    const target = exact ?? (visible.length === 1 ? visible[0] : undefined)
    if (!target) return

    if (target.stock <= 0) {
      toast.error(`Stok ${target.name} habis.`)
      return
    }

    addItem(target)
    setSearch('')
    searchRef.current?.focus()
  }

  function handleAdd(product: Product) {
    const current = qtyInCart.get(product.id) ?? 0
    if (current >= product.stock) {
      toast.error(`Stok ${product.name} tinggal ${formatNumber(product.stock)}.`)
      return
    }
    addItem(product)
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Kolom kiri: pemilihan produk. */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border bg-surface px-4 py-3 sm:px-5">
          <form onSubmit={handleSearchSubmit} className="relative">
            <MagnifyingGlassIcon
              size={18}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-subtle"
            />
            <input
              ref={searchRef}
              type="search"
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama produk atau pindai barcode"
              aria-label="Cari produk"
              className="h-12 w-full rounded-control border border-border-strong bg-surface-2 pr-3 pl-11 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            />
          </form>

          {categories.length > 0 ? (
            <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {['semua', ...categories].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={cn(
                    'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                    category === item
                      ? 'border-accent bg-accent-soft text-accent-soft-fg'
                      : 'border-border text-ink-muted hover:bg-surface-hover hover:text-ink',
                  )}
                >
                  {item === 'semua' ? 'Semua' : item}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-24 sm:px-5 lg:pb-5">
          {error ? <ErrorState message={error} /> : null}

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, index) => (
                <Skeleton key={index} className="h-28 rounded-panel" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              icon={PackageIcon}
              title="Belum ada produk untuk dijual"
              description="Tambahkan barang dagangan di halaman Produk & Stok, lalu kembali ke sini untuk mulai berjualan."
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={BarcodeIcon}
              title="Produk tidak ditemukan"
              description="Tidak ada barang yang cocok dengan pencarian atau kategori yang dipilih."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('')
                    setCategory('semua')
                  }}
                >
                  Atur ulang pencarian
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visible.map((product) => (
                <ProductTile
                  key={product.id}
                  product={product}
                  inCart={qtyInCart.get(product.id) ?? 0}
                  onSelect={() => handleAdd(product)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Kolom kanan: keranjang, menempel penuh setinggi layar di desktop. */}
      <aside className="hidden w-96 shrink-0 flex-col border-l border-border bg-surface lg:flex">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="text-sm font-semibold text-ink">Keranjang</h2>
          <span className="tabular text-xs text-ink-muted">
            {formatNumber(items.length)} jenis
          </span>
        </div>
        <CartPanel productsById={productsById} onCheckout={() => setPaymentOpen(true)} />
      </aside>

      {/* Di layar kecil keranjang jadi lembar terpisah supaya grid produk tetap lega. */}
      {items.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-4 py-3 shadow-e3 lg:hidden">
          <Button size="lg" fullWidth onClick={() => setCartSheetOpen(true)}>
            <ShoppingCartIcon size={18} weight="bold" />
            <span className="flex-1 text-left">
              {formatNumber(items.length)} jenis barang
            </span>
            <span className="tabular">{formatRupiah(subtotal)}</span>
          </Button>
        </div>
      ) : null}

      <Modal
        open={cartSheetOpen}
        onClose={() => setCartSheetOpen(false)}
        title="Keranjang"
        size="sm"
      >
        <div className="-mx-5 -my-5 flex max-h-[70dvh] flex-col">
          <CartPanel
            productsById={productsById}
            onCheckout={() => {
              setCartSheetOpen(false)
              setPaymentOpen(true)
            }}
          />
        </div>
      </Modal>

      <PaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        productsById={productsById}
        onPaid={(sale) => {
          setPaymentOpen(false)
          setLastSale(sale)
        }}
      />

      <ReceiptModal
        sale={lastSale}
        onClose={() => setLastSale(null)}
        primaryAction={{
          label: 'Transaksi berikutnya',
          onClick: () => {
            setLastSale(null)
            searchRef.current?.focus()
          },
        }}
      />
    </div>
  )
}
