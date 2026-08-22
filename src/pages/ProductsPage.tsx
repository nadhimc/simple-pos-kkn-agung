import { useMemo, useState } from 'react'
import {
  MagnifyingGlassIcon,
  PackageIcon,
  PencilSimpleIcon,
  PlusIcon,
  StackPlusIcon,
  TrashIcon,
  WarningIcon,
} from '@phosphor-icons/react'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  SelectField,
  TableSkeleton,
  TextField,
  toast,
} from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { ProductFormModal } from '@/features/products/ProductFormModal'
import { StockModal } from '@/features/products/StockModal'
import { useProducts } from '@/hooks/useProducts'
import { deleteProduct } from '@/services/products'
import { writeErrorMessage } from '@/lib/errors'
import { formatNumber, formatPercent, formatRupiah } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Product, ProductType } from '@/types'

type StockFilter = 'semua' | 'menipis' | 'habis'
type TypeFilter = 'semua' | ProductType

function marginOf(product: Product) {
  if (product.sellPrice <= 0) return 0
  return ((product.sellPrice - product.costPrice) / product.sellPrice) * 100
}

function stockTone(product: Product) {
  if (product.stock <= 0) return 'danger' as const
  if (product.stock <= product.minStock) return 'warning' as const
  return 'neutral' as const
}

export default function ProductsPage() {
  const { tenantId } = useAuth()
  const { products, categories, loading, error } = useProducts()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('semua')
  const [stockFilter, setStockFilter] = useState<StockFilter>('semua')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('semua')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [stockTarget, setStockTarget] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)

  const visible = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return products.filter((product) => {
      if (typeFilter !== 'semua' && product.type !== typeFilter) return false
      if (category !== 'semua' && product.category !== category) return false
      if (stockFilter === 'habis' && product.stock > 0) return false
      if (
        stockFilter === 'menipis' &&
        !(product.stock > 0 && product.stock <= product.minStock)
      ) {
        return false
      }
      if (!keyword) return true
      return (
        product.name.toLowerCase().includes(keyword) ||
        product.sku.toLowerCase().includes(keyword)
      )
    })
  }, [products, search, category, stockFilter, typeFilter])

  const summary = useMemo(() => {
    const lowStock = products.filter(
      (product) => product.stock > 0 && product.stock <= product.minStock,
    ).length
    const outOfStock = products.filter((product) => product.stock <= 0).length
    const valueOf = (list: Product[]) =>
      list.reduce((total, product) => total + product.costPrice * product.stock, 0)

    const materials = products.filter((product) => product.type === 'bahan')
    const finished = products.filter((product) => product.type === 'jadi')

    return {
      lowStock,
      outOfStock,
      materialCount: materials.length,
      finishedCount: finished.length,
      materialValue: valueOf(materials),
      finishedValue: valueOf(finished),
      inventoryValue: valueOf(products),
    }
  }, [products])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteProduct(tenantId, deleteTarget.id)
      toast.success(`${deleteTarget.name} dihapus.`)
      setDeleteTarget(null)
    } catch (caught) {
      toast.error(writeErrorMessage(caught))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Produk & Stok"
        description="Bahan baku dan barang jadi dalam satu daftar. Bahan baku dipakai lewat resep, barang jadi dijual di kasir."
        actions={
          <Button
            icon={<PlusIcon size={17} weight="bold" />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Tambah produk
          </Button>
        }
      />

      {/* Ringkasan dibiarkan sebagai satu baris bergaris, bukan tiga kartu seragam. */}
      <div className="grid gap-px overflow-hidden rounded-panel border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-surface px-5 py-4">
          <p className="text-xs text-ink-muted">Bahan baku</p>
          <p className="tabular mt-1 text-xl font-semibold text-ink">
            {formatNumber(summary.materialCount)}
            <span className="ml-2 text-xs font-normal text-ink-muted">
              {formatRupiah(summary.materialValue)}
            </span>
          </p>
        </div>
        <div className="bg-surface px-5 py-4">
          <p className="text-xs text-ink-muted">Barang jadi</p>
          <p className="tabular mt-1 text-xl font-semibold text-ink">
            {formatNumber(summary.finishedCount)}
            <span className="ml-2 text-xs font-normal text-ink-muted">
              {formatRupiah(summary.finishedValue)}
            </span>
          </p>
        </div>
        <div className="bg-surface px-5 py-4">
          <p className="text-xs text-ink-muted">Nilai stok (harga modal)</p>
          <p className="tabular mt-1 text-xl font-semibold text-ink">
            {formatRupiah(summary.inventoryValue)}
          </p>
        </div>
        <div className="bg-surface px-5 py-4">
          <p className="text-xs text-ink-muted">Perlu restock</p>
          <p className="tabular mt-1 flex items-baseline gap-2 text-xl font-semibold text-ink">
            {formatNumber(summary.lowStock + summary.outOfStock)}
            {summary.outOfStock > 0 ? (
              <span className="text-xs font-normal text-danger">
                {formatNumber(summary.outOfStock)} habis
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-border px-5 py-4">
          <TextField
            label="Cari produk"
            placeholder="Nama atau kode barang"
            containerClassName="min-w-56 flex-1"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <SelectField
            label="Jenis"
            containerClassName="w-44"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
            options={[
              { value: 'semua', label: 'Semua jenis' },
              { value: 'jadi', label: 'Barang jadi' },
              { value: 'bahan', label: 'Bahan baku' },
            ]}
          />
          <SelectField
            label="Kategori"
            containerClassName="w-44"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            options={[
              { value: 'semua', label: 'Semua kategori' },
              ...categories.map((item) => ({ value: item, label: item })),
            ]}
          />
          <SelectField
            label="Status stok"
            containerClassName="w-44"
            value={stockFilter}
            onChange={(event) => setStockFilter(event.target.value as StockFilter)}
            options={[
              { value: 'semua', label: 'Semua status' },
              { value: 'menipis', label: 'Menipis' },
              { value: 'habis', label: 'Habis' },
            ]}
          />
        </div>

        {loading ? (
          <TableSkeleton rows={6} columns={5} />
        ) : products.length === 0 ? (
          <EmptyState
            icon={PackageIcon}
            title="Belum ada produk"
            description="Tambahkan barang dagangan beserta harga modalnya supaya kasir bisa mulai mencatat penjualan."
            action={
              <Button
                icon={<PlusIcon size={17} weight="bold" />}
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                Tambah produk
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={MagnifyingGlassIcon}
            title="Tidak ada produk yang cocok"
            description="Ubah kata kunci atau pilihan filter untuk melihat produk lain."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('')
                  setCategory('semua')
                  setStockFilter('semua')
                }}
              >
                Atur ulang filter
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-muted">
                  <th className="px-5 py-3 font-medium">Produk</th>
                  <th className="px-5 py-3 text-right font-medium">Modal</th>
                  <th className="px-5 py-3 text-right font-medium">Jual</th>
                  <th className="px-5 py-3 text-right font-medium">Laba</th>
                  <th className="px-5 py-3 text-right font-medium">Stok</th>
                  <th className="px-5 py-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((product) => {
                  const tone = stockTone(product)
                  return (
                    <tr key={product.id} className="transition-colors hover:bg-surface-2">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-ink">{product.name}</p>
                          {product.type === 'bahan' ? (
                            <Badge tone="accent">bahan</Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-ink-subtle">
                          {product.category}
                          {product.sku ? ` · ${product.sku}` : ''}
                        </p>
                      </td>
                      <td className="tabular px-5 py-3.5 text-right text-ink-muted">
                        {formatRupiah(product.costPrice)}
                      </td>
                      <td className="tabular px-5 py-3.5 text-right font-medium text-ink">
                        {product.type === 'bahan' ? (
                          <span className="text-ink-subtle">-</span>
                        ) : (
                          formatRupiah(product.sellPrice)
                        )}
                      </td>
                      <td className="tabular px-5 py-3.5 text-right">
                        {product.type === 'bahan' ? (
                          <span className="text-ink-subtle">-</span>
                        ) : (
                          <>
                            <span
                              className={cn(
                                product.sellPrice < product.costPrice
                                  ? 'text-danger'
                                  : 'text-ink',
                              )}
                            >
                              {formatRupiah(product.sellPrice - product.costPrice)}
                            </span>
                            <span className="ml-2 text-xs text-ink-subtle">
                              {formatPercent(marginOf(product), 0)}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Badge tone={tone}>
                          {tone !== 'neutral' ? (
                            <WarningIcon size={12} weight="fill" />
                          ) : null}
                          <span className="tabular">
                            {formatNumber(product.stock)} {product.unit}
                          </span>
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            label={`Tambah stok ${product.name}`}
                            size="sm"
                            onClick={() => setStockTarget(product)}
                          >
                            <StackPlusIcon size={18} />
                          </IconButton>
                          <IconButton
                            label={`Ubah ${product.name}`}
                            size="sm"
                            onClick={() => {
                              setEditing(product)
                              setFormOpen(true)
                            }}
                          >
                            <PencilSimpleIcon size={18} />
                          </IconButton>
                          <IconButton
                            label={`Hapus ${product.name}`}
                            size="sm"
                            className="hover:text-danger"
                            onClick={() => setDeleteTarget(product)}
                          >
                            <TrashIcon size={18} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ProductFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        product={editing}
        categories={categories}
      />

      <StockModal
        open={Boolean(stockTarget)}
        onClose={() => setStockTarget(null)}
        product={stockTarget}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Hapus ${deleteTarget?.name ?? 'produk'}?`}
        message="Produk hilang dari daftar dan layar kasir. Transaksi yang sudah tercatat tidak berubah karena setiap struk menyimpan nama dan harganya sendiri."
        confirmLabel="Hapus produk"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
