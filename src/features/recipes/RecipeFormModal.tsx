import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PlusIcon, TrashIcon, WarningIcon } from '@phosphor-icons/react'
import {
  Button,
  EmptyState,
  IconButton,
  Modal,
  SelectField,
  TextAreaField,
  TextField,
  toast,
} from '@/components/ui'
import { createRecipe, updateRecipe } from '@/services/recipes'
import { useAuth } from '@/contexts/AuthContext'
import { writeErrorMessage } from '@/lib/errors'
import { computeHpp } from '@/lib/hpp'
import { compatibleUnits, defaultRecipeUnit } from '@/lib/units'
import { formatNumber, formatRupiah } from '@/lib/format'
import { cn } from '@/lib/cn'
import { FlaskIcon } from '@phosphor-icons/react'
import type { Product, Recipe, RecipeDraft, RecipeItem } from '@/types'

interface RecipeFormModalProps {
  open: boolean
  onClose: () => void
  /** Null berarti membuat resep baru. */
  recipe: Recipe | null
  materials: Product[]
  finished: Product[]
  productsById: Map<string, Product>
}

interface Row {
  materialId: string
  qty: string
  unit: string
}

const EMPTY_ROW: Row = { materialId: '', qty: '', unit: '' }

export function RecipeFormModal({
  open,
  onClose,
  recipe,
  materials,
  finished,
  productsById,
}: RecipeFormModalProps) {
  const { tenantId } = useAuth()
  const [productId, setProductId] = useState('')
  const [yieldQty, setYieldQty] = useState('10')
  const [note, setNote] = useState('')
  const [rows, setRows] = useState<Row[]>([EMPTY_ROW])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError('')
    setSaving(false)

    if (recipe) {
      setProductId(recipe.productId)
      setYieldQty(String(recipe.yieldQty))
      setNote(recipe.note)
      setRows(
        recipe.items.map((item) => ({
          materialId: item.materialId,
          qty: String(item.qty),
          unit: item.unit,
        })),
      )
      return
    }

    setProductId(finished[0]?.id ?? '')
    setYieldQty('10')
    setNote('')
    setRows([EMPTY_ROW])
  }, [open, recipe, finished])

  const product = productsById.get(productId)

  /** Baris yang sudah lengkap saja yang ikut dihitung. */
  const items = useMemo<RecipeItem[]>(
    () =>
      rows
        .filter((row) => row.materialId && Number(row.qty) > 0)
        .map((row) => ({
          materialId: row.materialId,
          materialName: productsById.get(row.materialId)?.name ?? '',
          qty: Number(row.qty),
          unit: row.unit,
        })),
    [rows, productsById],
  )

  const breakdown = useMemo(
    () => computeHpp(items, Number(yieldQty) || 0, productsById),
    [items, yieldQty, productsById],
  )

  const sellPrice = product?.sellPrice ?? 0
  const profitPerUnit = sellPrice - breakdown.costPerUnit
  const margin = sellPrice > 0 ? (profitPerUnit / sellPrice) * 100 : 0

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((previous) =>
      previous.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    )
  }

  function pickMaterial(index: number, materialId: string) {
    const material = productsById.get(materialId)
    // Satuan pemakaian ikut menyesuaikan bahannya: gula yang distok per kg
    // otomatis ditawarkan dalam gram, karena resep menulis gram.
    updateRow(index, {
      materialId,
      unit: material ? defaultRecipeUnit(material.unit) : '',
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    if (!product) return setError('Pilih dulu produk jadi yang dihasilkan.')
    if (items.length === 0) return setError('Tambahkan minimal satu bahan baku.')
    if (Number(yieldQty) <= 0) return setError('Jumlah hasil produksi harus lebih dari nol.')
    if (breakdown.hasProblem) return setError('Ada baris bahan yang bermasalah. Perbaiki dulu.')

    const draft: RecipeDraft = {
      productId: product.id,
      productName: product.name,
      items,
      yieldQty: Number(yieldQty),
      yieldUnit: product.unit,
      note: note.trim(),
    }

    setSaving(true)
    try {
      if (recipe) {
        await updateRecipe(tenantId, recipe.id, draft)
        toast.success(`Resep ${product.name} diperbarui.`)
      } else {
        await createRecipe(tenantId, draft)
        toast.success(`Resep ${product.name} dibuat.`)
      }
      onClose()
    } catch (caught) {
      toast.error(writeErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  if (materials.length === 0 || finished.length === 0) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={recipe ? 'Ubah resep' : 'Buat resep'}
        size="sm"
        footer={
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
        }
      >
        <EmptyState
          icon={FlaskIcon}
          title={
            materials.length === 0 ? 'Belum ada bahan baku' : 'Belum ada barang jadi'
          }
          description={
            materials.length === 0
              ? 'Tambahkan dulu bahan baku seperti gula, tepung, atau air di halaman Produk & Stok, lengkap dengan harga modal dan satuannya.'
              : 'Tambahkan dulu barang jadi yang akan dihasilkan resep ini di halaman Produk & Stok.'
          }
        />
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={recipe ? 'Ubah resep' : 'Buat resep'}
      description="Harga bahan diambil otomatis dari stok, tidak perlu diketik ulang."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button type="submit" form="recipe-form" loading={saving}>
            {recipe ? 'Simpan perubahan' : 'Simpan resep'}
          </Button>
        </>
      }
    >
      <form id="recipe-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Produk jadi yang dihasilkan"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            options={finished.map((item) => ({ value: item.id, label: item.name }))}
          />
          <TextField
            label="Hasil satu kali produksi"
            type="number"
            inputMode="numeric"
            min={1}
            required
            helper={product ? `Dalam satuan ${product.unit}.` : undefined}
            value={yieldQty}
            onChange={(event) => setYieldQty(event.target.value)}
          />
        </div>

        {/* Daftar bahan. Judul kolom berlaku sebagai label untuk seluruh baris,
            dan tiap kontrol tetap punya aria-label sendiri. */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-ink">Bahan baku yang dipakai</p>

          <div className="hidden gap-2 px-1 text-xs text-ink-muted sm:grid sm:grid-cols-[minmax(0,1fr)_5rem_6rem_7rem_2.25rem]">
            <span>Bahan</span>
            <span>Jumlah</span>
            <span>Satuan</span>
            <span className="text-right">Biaya</span>
            <span />
          </div>

          {rows.map((row, index) => {
            const material = productsById.get(row.materialId)
            const line = breakdown.lines.find(
              (entry) => entry.materialId === row.materialId,
            )
            const units = material ? compatibleUnits(material.unit) : []

            return (
              <div
                key={index}
                className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_6rem_7rem_2.25rem] sm:items-center"
              >
                <select
                  aria-label={`Bahan baris ${index + 1}`}
                  value={row.materialId}
                  onChange={(event) => pickMaterial(index, event.target.value)}
                  className="h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <option value="">Pilih bahan</option>
                  {materials.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({formatRupiah(item.costPrice)}/{item.unit})
                    </option>
                  ))}
                </select>

                <input
                  aria-label={`Jumlah baris ${index + 1}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={row.qty}
                  onChange={(event) => updateRow(index, { qty: event.target.value })}
                  className="tabular h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                />

                <select
                  aria-label={`Satuan baris ${index + 1}`}
                  value={row.unit}
                  disabled={!material}
                  onChange={(event) => updateRow(index, { unit: event.target.value })}
                  className="h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-sm text-ink disabled:bg-surface-2 disabled:text-ink-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  {units.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>

                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <span className="text-xs text-ink-muted sm:hidden">Biaya</span>
                  <span
                    className={cn(
                      'tabular text-sm font-medium',
                      line?.problem ? 'text-danger' : 'text-ink',
                    )}
                  >
                    {line ? formatRupiah(line.cost) : formatRupiah(0)}
                  </span>
                </div>

                <IconButton
                  label={`Hapus bahan baris ${index + 1}`}
                  size="sm"
                  className="justify-self-end hover:text-danger"
                  onClick={() =>
                    setRows((previous) =>
                      previous.length === 1
                        ? [EMPTY_ROW]
                        : previous.filter((_, i) => i !== index),
                    )
                  }
                >
                  <TrashIcon size={17} />
                </IconButton>

                {line?.problem ? (
                  <p className="text-xs font-medium text-danger sm:col-span-5">
                    {line.problem}
                  </p>
                ) : null}
              </div>
            )
          })}

          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            icon={<PlusIcon size={16} weight="bold" />}
            onClick={() => setRows((previous) => [...previous, EMPTY_ROW])}
          >
            Tambah bahan
          </Button>
        </div>

        {/* Hasil hitungan, langsung terlihat sebelum resep disimpan. */}
        <div className="overflow-hidden rounded-panel border border-border">
          <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
            <span className="text-sm text-ink-muted">HPP satu kali produksi</span>
            <span className="tabular text-sm font-semibold text-ink">
              {formatRupiah(breakdown.materialCost)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3 bg-accent-soft px-4 py-3.5">
            <span className="text-sm font-medium text-accent-soft-fg">
              HPP per {product?.unit ?? 'pcs'}
            </span>
            <span className="tabular text-2xl font-semibold tracking-tight text-accent-soft-fg">
              {formatRupiah(breakdown.costPerUnit)}
            </span>
          </div>

          {sellPrice > 0 ? (
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-border px-4 py-3">
              <span className="text-sm text-ink-muted">
                Harga jual {formatRupiah(sellPrice)}
              </span>
              <span
                className={cn(
                  'tabular text-sm font-semibold',
                  profitPerUnit < 0 ? 'text-danger' : 'text-ink',
                )}
              >
                Laba {formatRupiah(profitPerUnit)}
                <span className="ml-2 font-normal text-ink-muted">
                  margin {formatNumber(Math.round(margin))}%
                </span>
              </span>
            </div>
          ) : null}
        </div>

        {profitPerUnit < 0 && sellPrice > 0 ? (
          <p className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger-soft px-4 py-3 text-xs font-medium text-danger-soft-fg">
            <WarningIcon size={15} weight="fill" className="mt-px shrink-0" />
            Harga jual lebih rendah dari HPP. Setiap penjualan produk ini akan rugi.
          </p>
        ) : null}

        <TextAreaField
          label="Catatan resep"
          helper="Opsional. Misalnya cara masak atau lama pengukusan."
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />

        {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
      </form>
    </Modal>
  )
}
