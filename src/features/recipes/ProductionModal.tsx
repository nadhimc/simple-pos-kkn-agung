import { useEffect, useMemo, useState } from 'react'
import { WarningIcon } from '@phosphor-icons/react'
import { Button, Modal, TextAreaField, TextField, toast } from '@/components/ui'
import { createProduction } from '@/services/productions'
import { saleErrorMessage } from '@/lib/errors'
import { checkMaterialStock, computeHpp } from '@/lib/hpp'
import { formatNumber, formatRupiah } from '@/lib/format'
import { cn } from '@/lib/cn'
import { displayNameOf, useAuth } from '@/contexts/AuthContext'
import type { Product, Production, Recipe } from '@/types'

interface ProductionModalProps {
  recipe: Recipe | null
  onClose: () => void
  productsById: Map<string, Product>
  onProduced: (production: Production) => void
}

export function ProductionModal({
  recipe,
  onClose,
  productsById,
  onProduced,
}: ProductionModalProps) {
  const { user, staff } = useAuth()
  const [batch, setBatch] = useState('1')
  const [actualYield, setActualYield] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!recipe) return
    setBatch('1')
    setActualYield(String(recipe.yieldQty))
    setNote('')
    setSubmitting(false)
  }, [recipe])

  const batchCount = Number(batch) || 0

  /** Pemakaian bahan dikali jumlah batch yang dimasak sekaligus. */
  const scaledItems = useMemo(
    () =>
      (recipe?.items ?? []).map((item) => ({
        ...item,
        qty: item.qty * batchCount,
      })),
    [recipe, batchCount],
  )

  const yieldQty = Number(actualYield) || 0

  const breakdown = useMemo(
    () => computeHpp(scaledItems, yieldQty, productsById),
    [scaledItems, yieldQty, productsById],
  )

  const shortages = useMemo(
    () => checkMaterialStock(breakdown, productsById),
    [breakdown, productsById],
  )

  if (!recipe) return null

  const product = productsById.get(recipe.productId)
  const blocked =
    !product ||
    breakdown.hasProblem ||
    shortages.length > 0 ||
    yieldQty <= 0 ||
    batchCount <= 0

  async function handleConfirm() {
    if (!recipe || !product || !user) return

    setSubmitting(true)
    try {
      const production = await createProduction({
        product,
        recipeId: recipe.id,
        items: breakdown.lines.map((line) => ({
          materialId: line.materialId,
          materialName: line.materialName,
          qty: line.qty,
          unit: line.unit,
          qtyInStockUnit: line.qtyInStockUnit,
          stockUnit: line.stockUnit,
          costPerStockUnit: line.costPerStockUnit,
          cost: line.cost,
        })),
        materialCost: breakdown.materialCost,
        yieldQty,
        yieldUnit: product.unit,
        costPerUnit: breakdown.costPerUnit,
        operatorId: user.uid,
        operatorName: displayNameOf(user, staff),
        note: note.trim(),
      })
      onProduced(production)
    } catch (caught) {
      toast.error(saleErrorMessage(caught))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Produksi ${recipe.productName}`}
      description="Stok bahan berkurang dan produk jadi bertambah begitu disimpan."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button loading={submitting} disabled={blocked} onClick={handleConfirm}>
            Catat produksi
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Jumlah batch"
            type="number"
            inputMode="numeric"
            min={1}
            step="any"
            helper="Berapa kali resep ini dimasak sekaligus."
            value={batch}
            onChange={(event) => {
              setBatch(event.target.value)
              // Perkiraan hasil ikut menyesuaikan, tetap boleh dikoreksi manual
              // karena hasil nyata dapur sering meleset dari resep.
              const next = Number(event.target.value) || 0
              setActualYield(String(recipe.yieldQty * next))
            }}
          />
          <TextField
            label="Hasil nyata"
            type="number"
            inputMode="numeric"
            min={1}
            required
            helper={`Dalam satuan ${product?.unit ?? 'pcs'}. Isi apa adanya.`}
            value={actualYield}
            onChange={(event) => setActualYield(event.target.value)}
          />
        </div>

        <div className="overflow-hidden rounded-panel border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-xs text-ink-muted">
                <th className="px-4 py-2.5 font-medium">Bahan</th>
                <th className="px-4 py-2.5 text-right font-medium">Pakai</th>
                <th className="px-4 py-2.5 text-right font-medium">Sisa stok</th>
                <th className="px-4 py-2.5 text-right font-medium">Biaya</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {breakdown.lines.map((line) => {
                const material = productsById.get(line.materialId)
                const remaining = (material?.stock ?? 0) - line.qtyInStockUnit
                return (
                  <tr key={line.materialId}>
                    <td className="px-4 py-2.5 font-medium text-ink">
                      {line.materialName}
                      {line.problem ? (
                        <span className="mt-0.5 block text-xs font-normal text-danger">
                          {line.problem}
                        </span>
                      ) : null}
                    </td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-muted">
                      {formatNumber(line.qty)} {line.unit}
                    </td>
                    <td
                      className={cn(
                        'tabular px-4 py-2.5 text-right',
                        remaining < 0 ? 'font-semibold text-danger' : 'text-ink-muted',
                      )}
                    >
                      {formatNumber(remaining)} {line.stockUnit}
                    </td>
                    <td className="tabular px-4 py-2.5 text-right font-medium text-ink">
                      {formatRupiah(line.cost)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {shortages.length > 0 ? (
          <div
            role="alert"
            className="flex flex-col gap-1.5 rounded-control border border-danger/30 bg-danger-soft px-4 py-3"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-danger-soft-fg">
              <WarningIcon size={16} weight="fill" />
              Stok bahan tidak cukup
            </p>
            {shortages.map((entry) => (
              <p key={entry.materialName} className="text-xs text-danger-soft-fg">
                {entry.materialName} kurang {formatNumber(entry.shortage)}{' '}
                {entry.stockUnit}. Tersedia {formatNumber(entry.available)}, dibutuhkan{' '}
                {formatNumber(entry.needed)}.
              </p>
            ))}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-panel border border-border">
          <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
            <span className="text-sm text-ink-muted">Total biaya bahan</span>
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
        </div>

        <TextAreaField
          label="Catatan produksi"
          helper="Opsional. Misalnya nama pemasak atau kendala saat produksi."
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />

        {/* Produksi memindahkan nilai antar persediaan, bukan mengeluarkan uang. */}
        <p className="text-xs text-ink-subtle">
          Produksi tidak dicatat sebagai beban operasional. Nilai bahan berpindah
          jadi nilai produk jadi, dan baru diakui sebagai HPP saat produknya terjual.
        </p>
      </div>
    </Modal>
  )
}
