import { useEffect, useState, type FormEvent } from 'react'
import { Button, Modal, SelectField, TextField, toast } from '@/components/ui'
import { createProduct, updateProduct } from '@/services/products'
import { writeErrorMessage } from '@/lib/errors'
import { formatPercent, formatRupiah } from '@/lib/format'
import type { Product, ProductDraft } from '@/types'

const UNITS = ['pcs', 'bungkus', 'botol', 'kg', 'gram', 'liter', 'porsi', 'lusin']

interface ProductFormModalProps {
  open: boolean
  onClose: () => void
  /** Null berarti membuat produk baru. */
  product: Product | null
  /** Kategori yang sudah ada, dipakai sebagai saran input. */
  categories: string[]
}

interface FormState {
  name: string
  sku: string
  category: string
  unit: string
  costPrice: string
  sellPrice: string
  stock: string
  minStock: string
}

const EMPTY: FormState = {
  name: '',
  sku: '',
  category: '',
  unit: 'pcs',
  costPrice: '',
  sellPrice: '',
  stock: '0',
  minStock: '5',
}

function toNumber(value: string) {
  const parsed = Number(value.replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

export function ProductFormModal({
  open,
  onClose,
  product,
  categories,
}: ProductFormModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(
      product
        ? {
            name: product.name,
            sku: product.sku,
            category: product.category,
            unit: product.unit,
            costPrice: String(product.costPrice),
            sellPrice: String(product.sellPrice),
            stock: String(product.stock),
            minStock: String(product.minStock),
          }
        : EMPTY,
    )
  }, [open, product])

  const cost = toNumber(form.costPrice)
  const sell = toNumber(form.sellPrice)
  const profitPerUnit = sell - cost
  const margin = sell > 0 ? (profitPerUnit / sell) * 100 : 0

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function validate() {
    const next: Partial<Record<keyof FormState, string>> = {}
    if (!form.name.trim()) next.name = 'Nama produk wajib diisi.'
    if (cost < 0) next.costPrice = 'Harga modal tidak boleh negatif.'
    if (sell <= 0) next.sellPrice = 'Harga jual harus lebih dari nol.'
    if (toNumber(form.stock) < 0) next.stock = 'Stok tidak boleh negatif.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!validate()) return

    const draft: ProductDraft = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      category: form.category.trim() || 'Umum',
      unit: form.unit,
      costPrice: cost,
      sellPrice: sell,
      stock: toNumber(form.stock),
      minStock: toNumber(form.minStock),
    }

    setSaving(true)
    try {
      if (product) {
        const { stock: _ignoredStock, ...withoutStock } = draft
        await updateProduct(product.id, withoutStock)
        toast.success(`${draft.name} diperbarui.`)
      } else {
        await createProduct(draft)
        toast.success(`${draft.name} ditambahkan.`)
      }
      onClose()
    } catch (caught) {
      toast.error(writeErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? 'Ubah produk' : 'Tambah produk'}
      description={
        product
          ? 'Perubahan harga hanya berlaku untuk penjualan berikutnya.'
          : 'Harga modal dipakai menghitung laba setiap kali produk ini terjual.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button type="submit" form="product-form" loading={saving}>
            {product ? 'Simpan perubahan' : 'Tambah produk'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Nama produk"
          required
          autoFocus
          value={form.name}
          error={errors.name}
          onChange={(event) => update('name', event.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Kode / barcode"
            helper="Opsional. Mempercepat pencarian di kasir."
            value={form.sku}
            onChange={(event) => update('sku', event.target.value)}
          />
          <TextField
            label="Kategori"
            helper="Dipakai sebagai filter di layar kasir."
            list="product-categories"
            value={form.category}
            onChange={(event) => update('category', event.target.value)}
          />
          <datalist id="product-categories">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Harga modal"
            prefix="Rp"
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            required
            value={form.costPrice}
            error={errors.costPrice}
            onChange={(event) => update('costPrice', event.target.value)}
          />
          <TextField
            label="Harga jual"
            prefix="Rp"
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            required
            value={form.sellPrice}
            error={errors.sellPrice}
            onChange={(event) => update('sellPrice', event.target.value)}
          />
        </div>

        {/* Umpan balik laba langsung terlihat sebelum produk disimpan. */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border bg-surface-2 px-4 py-3">
          <span className="text-sm text-ink-muted">Laba per {form.unit}</span>
          <span
            className={`tabular text-sm font-semibold ${
              profitPerUnit < 0 ? 'text-danger' : 'text-ink'
            }`}
          >
            {formatRupiah(profitPerUnit)}
            <span className="ml-2 font-normal text-ink-muted">
              margin {formatPercent(margin)}
            </span>
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Satuan"
            value={form.unit}
            options={UNITS.map((unit) => ({ value: unit, label: unit }))}
            onChange={(event) => update('unit', event.target.value)}
          />
          <TextField
            label={product ? 'Stok saat ini' : 'Stok awal'}
            type="number"
            inputMode="numeric"
            min={0}
            disabled={Boolean(product)}
            helper={product ? 'Ubah lewat tombol Tambah stok.' : undefined}
            value={form.stock}
            error={errors.stock}
            onChange={(event) => update('stock', event.target.value)}
          />
          <TextField
            label="Batas stok menipis"
            type="number"
            inputMode="numeric"
            min={0}
            helper="Peringatan muncul di bawah angka ini."
            value={form.minStock}
            onChange={(event) => update('minStock', event.target.value)}
          />
        </div>
      </form>
    </Modal>
  )
}
