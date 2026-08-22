import { useMemo, useState } from 'react'
import {
  ArrowCounterClockwiseIcon,
  CookingPotIcon,
  FactoryIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  WarningIcon,
} from '@phosphor-icons/react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  Segmented,
  TableSkeleton,
  toast,
} from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { RecipeFormModal } from '@/features/recipes/RecipeFormModal'
import { ProductionModal } from '@/features/recipes/ProductionModal'
import { useProducts } from '@/hooks/useProducts'
import { useRecipes } from '@/hooks/useRecipes'
import { deleteRecipe } from '@/services/recipes'
import { voidProduction } from '@/services/productions'
import { PERIOD_OPTIONS, resolvePeriod, type PeriodKey } from '@/hooks/usePeriod'
import { useProductions } from '@/hooks/useProductions'
import { writeErrorMessage } from '@/lib/errors'
import { computeHpp } from '@/lib/hpp'
import { formatDateTime, formatNumber, formatRupiah } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Production, Recipe } from '@/types'

export default function RecipesPage() {
  const { tenantId } = useAuth()
  const { products, materials, finished, productsById, loading, error } = useProducts()
  const { recipes, loading: recipesLoading, error: recipesError } = useRecipes()

  const [period, setPeriod] = useState<PeriodKey>('7-hari')
  const { from, to } = useMemo(() => resolvePeriod(period), [period])
  const {
    productions,
    loading: productionsLoading,
    error: productionsError,
  } = useProductions(from, to)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [produceTarget, setProduceTarget] = useState<Recipe | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null)
  const [voidTarget, setVoidTarget] = useState<Production | null>(null)
  const [busy, setBusy] = useState(false)

  /** HPP dihitung ulang tiap render dari harga bahan terkini, bukan dari nilai tersimpan. */
  const rows = useMemo(
    () =>
      recipes.map((recipe) => {
        const breakdown = computeHpp(recipe.items, recipe.yieldQty, productsById)
        const product = productsById.get(recipe.productId)
        const sellPrice = product?.sellPrice ?? 0
        const profit = sellPrice - breakdown.costPerUnit
        return {
          recipe,
          breakdown,
          product,
          sellPrice,
          profit,
          margin: sellPrice > 0 ? (profit / sellPrice) * 100 : 0,
        }
      }),
    [recipes, productsById],
  )

  async function handleDeleteRecipe() {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await deleteRecipe(tenantId, deleteTarget.id)
      toast.success('Resep dihapus.')
      setDeleteTarget(null)
    } catch (caught) {
      toast.error(writeErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function handleVoidProduction() {
    if (!voidTarget) return
    setBusy(true)
    try {
      await voidProduction(tenantId, voidTarget, new Set(products.map((item) => item.id)))
      toast.success(`${voidTarget.productionNo} dibatalkan, stok bahan dikembalikan.`)
      setVoidTarget(null)
    } catch (caught) {
      toast.error(writeErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const combinedError = error || recipesError || productionsError

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Resep & HPP"
        description="Susun resep dari bahan baku, dan sistem menghitung harga pokok produksi per satuan otomatis dari harga stok terkini."
        actions={
          <Button
            icon={<PlusIcon size={17} weight="bold" />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Buat resep
          </Button>
        }
      />

      {combinedError ? <ErrorState message={combinedError} /> : null}

      <Card>
        <CardHeader
          title="Daftar resep"
          description="HPP ikut berubah sendiri begitu harga bahan baku diperbarui."
        />

        {loading || recipesLoading ? (
          <TableSkeleton rows={4} columns={5} />
        ) : recipes.length === 0 ? (
          <EmptyState
            icon={CookingPotIcon}
            title="Belum ada resep"
            description="Buat resep untuk produk olahan seperti cenil atau klepon, lalu sistem menghitung HPP per pcs dari bahan bakunya."
            action={
              <Button
                icon={<PlusIcon size={17} weight="bold" />}
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                Buat resep
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-muted">
                  <th className="px-5 py-3 font-medium">Produk</th>
                  <th className="px-5 py-3 text-right font-medium">Biaya produksi</th>
                  <th className="px-5 py-3 text-right font-medium">Hasil</th>
                  <th className="px-5 py-3 text-right font-medium">HPP per satuan</th>
                  <th className="px-5 py-3 text-right font-medium">Harga jual</th>
                  <th className="px-5 py-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ recipe, breakdown, product, sellPrice, profit, margin }) => (
                  <tr key={recipe.id} className="transition-colors hover:bg-surface-2">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-ink">{recipe.productName}</p>
                        {breakdown.hasProblem ? (
                          <Badge tone="danger">
                            <WarningIcon size={12} weight="fill" />
                            perlu diperbaiki
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-subtle">
                        {formatNumber(recipe.items.length)} bahan
                        {product ? ` · stok ${formatNumber(product.stock)} ${product.unit}` : ''}
                      </p>
                    </td>
                    <td className="tabular px-5 py-3.5 text-right text-ink-muted">
                      {formatRupiah(breakdown.materialCost)}
                    </td>
                    <td className="tabular px-5 py-3.5 text-right text-ink-muted">
                      {formatNumber(recipe.yieldQty)} {recipe.yieldUnit}
                    </td>
                    <td className="tabular px-5 py-3.5 text-right text-base font-semibold text-ink">
                      {formatRupiah(breakdown.costPerUnit)}
                    </td>
                    <td className="tabular px-5 py-3.5 text-right">
                      {sellPrice > 0 ? (
                        <>
                          <span className="text-ink">{formatRupiah(sellPrice)}</span>
                          <span
                            className={cn(
                              'mt-0.5 block text-xs',
                              profit < 0 ? 'font-medium text-danger' : 'text-ink-subtle',
                            )}
                          >
                            laba {formatRupiah(profit)} · {formatNumber(Math.round(margin))}%
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-subtle">belum diatur</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          icon={<FactoryIcon size={16} weight="bold" />}
                          disabled={breakdown.hasProblem}
                          onClick={() => setProduceTarget(recipe)}
                        >
                          Produksi
                        </Button>
                        <IconButton
                          label={`Ubah resep ${recipe.productName}`}
                          size="sm"
                          onClick={() => {
                            setEditing(recipe)
                            setFormOpen(true)
                          }}
                        >
                          <PencilSimpleIcon size={18} />
                        </IconButton>
                        <IconButton
                          label={`Hapus resep ${recipe.productName}`}
                          size="sm"
                          className="hover:text-danger"
                          onClick={() => setDeleteTarget(recipe)}
                        >
                          <TrashIcon size={18} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Riwayat produksi"
          description="Setiap produksi mengurangi stok bahan dan menambah stok produk jadi."
          action={
            <Segmented
              aria-label="Periode riwayat produksi"
              value={period}
              onChange={setPeriod}
              options={PERIOD_OPTIONS}
            />
          }
        />

        {productionsLoading ? (
          <TableSkeleton rows={3} columns={4} />
        ) : productions.length === 0 ? (
          <EmptyState
            icon={FactoryIcon}
            title="Belum ada produksi pada periode ini"
            description="Tekan tombol Produksi pada salah satu resep untuk mencatat hasil masak dan memotong stok bahannya."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-muted">
                  <th className="px-5 py-3 font-medium">Waktu</th>
                  <th className="px-5 py-3 font-medium">Produk</th>
                  <th className="px-5 py-3 text-right font-medium">Hasil</th>
                  <th className="px-5 py-3 text-right font-medium">Biaya bahan</th>
                  <th className="px-5 py-3 text-right font-medium">HPP satuan</th>
                  <th className="px-5 py-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {productions.map((production) => (
                  <tr key={production.id} className="transition-colors hover:bg-surface-2">
                    <td className="tabular px-5 py-3.5 whitespace-nowrap text-ink-muted">
                      {formatDateTime(production.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-ink">{production.productName}</p>
                      <p className="mt-0.5 text-xs text-ink-subtle">
                        {production.productionNo} · {production.operatorName}
                      </p>
                    </td>
                    <td className="tabular px-5 py-3.5 text-right text-ink-muted">
                      {formatNumber(production.yieldQty)} {production.yieldUnit}
                    </td>
                    <td className="tabular px-5 py-3.5 text-right text-ink-muted">
                      {formatRupiah(production.materialCost)}
                    </td>
                    <td className="tabular px-5 py-3.5 text-right font-semibold text-ink">
                      {formatRupiah(production.costPerUnit)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hover:text-danger"
                        icon={<ArrowCounterClockwiseIcon size={16} weight="bold" />}
                        onClick={() => setVoidTarget(production)}
                      >
                        Batalkan
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RecipeFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        recipe={editing}
        materials={materials}
        finished={finished}
        productsById={productsById}
      />

      <ProductionModal
        recipe={produceTarget}
        onClose={() => setProduceTarget(null)}
        productsById={productsById}
        onProduced={(production) => {
          setProduceTarget(null)
          toast.success(
            `${formatNumber(production.yieldQty)} ${production.yieldUnit} ${production.productName} masuk stok. HPP ${formatRupiah(production.costPerUnit)} per ${production.yieldUnit}.`,
          )
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Hapus resep ${deleteTarget?.productName ?? ''}?`}
        message="Riwayat produksi dan stok tidak berubah, karena setiap produksi menyimpan salinan bahan dan harganya sendiri."
        confirmLabel="Hapus resep"
        destructive
        loading={busy}
        onConfirm={handleDeleteRecipe}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(voidTarget)}
        title={`Batalkan ${voidTarget?.productionNo ?? 'produksi'}?`}
        message="Stok bahan dikembalikan dan produk jadi ditarik dari stok. Kalau produknya sudah terlanjur terjual, pembatalan akan ditolak karena stok jadi minus."
        confirmLabel="Batalkan produksi"
        destructive
        loading={busy}
        onConfirm={handleVoidProduction}
        onCancel={() => setVoidTarget(null)}
      />
    </div>
  )
}
