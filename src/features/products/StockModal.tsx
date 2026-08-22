import { useEffect, useState, type FormEvent } from 'react'
import { Button, Modal, Segmented, TextField, toast } from '@/components/ui'
import { addStock, setStock } from '@/services/products'
import { useAuth } from '@/contexts/AuthContext'
import { writeErrorMessage } from '@/lib/errors'
import { formatNumber, formatRupiah } from '@/lib/format'
import type { Product } from '@/types'

type Mode = 'tambah' | 'koreksi'

interface StockModalProps {
  open: boolean
  onClose: () => void
  product: Product | null
}

export function StockModal({ open, onClose, product }: StockModalProps) {
  const { tenantId } = useAuth()
  const [mode, setMode] = useState<Mode>('tambah')
  const [quantity, setQuantity] = useState('')
  const [newCost, setNewCost] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode('tambah')
    setQuantity('')
    setNewCost(product ? String(product.costPrice) : '')
  }, [open, product])

  if (!product) return null

  const amount = Number(quantity) || 0
  const cost = Number(newCost) || 0
  const resultingStock = mode === 'tambah' ? product.stock + amount : amount

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!product) return

    setSaving(true)
    try {
      if (mode === 'tambah') {
        const costChanged = cost > 0 && cost !== product.costPrice
        await addStock(tenantId, product.id, amount, costChanged ? cost : undefined)
        toast.success(
          `${formatNumber(amount)} ${product.unit} ${product.name} masuk ke stok.`,
        )
      } else {
        await setStock(tenantId, product.id, amount)
        toast.success(`Stok ${product.name} dikoreksi jadi ${formatNumber(amount)}.`)
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
      title={`Stok ${product.name}`}
      description={`Stok sekarang ${formatNumber(product.stock)} ${product.unit}.`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button
            type="submit"
            form="stock-form"
            loading={saving}
            disabled={quantity === '' || amount < 0}
          >
            Simpan
          </Button>
        </>
      }
    >
      <form id="stock-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Segmented
          aria-label="Jenis perubahan stok"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'tambah', label: 'Barang masuk' },
            { value: 'koreksi', label: 'Koreksi opname' },
          ]}
        />

        <TextField
          label={mode === 'tambah' ? 'Jumlah masuk' : 'Stok hasil hitung ulang'}
          type="number"
          inputMode="numeric"
          min={0}
          required
          autoFocus
          value={quantity}
          helper={
            mode === 'tambah'
              ? 'Jumlah yang baru dibeli atau diproduksi.'
              : 'Isi angka fisik hasil opname. Selisihnya menimpa catatan lama.'
          }
          onChange={(event) => setQuantity(event.target.value)}
        />

        {mode === 'tambah' ? (
          <TextField
            label="Harga modal terbaru"
            prefix="Rp"
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            value={newCost}
            helper={`Sebelumnya ${formatRupiah(product.costPrice)}. Ubah bila harga kulakan naik.`}
            onChange={(event) => setNewCost(event.target.value)}
          />
        ) : null}

        <div className="flex items-center justify-between rounded-control border border-border bg-surface-2 px-4 py-3">
          <span className="text-sm text-ink-muted">Stok setelah disimpan</span>
          <span className="tabular text-sm font-semibold text-ink">
            {formatNumber(resultingStock)} {product.unit}
          </span>
        </div>

        {/* Pembelian stok bukan beban: modalnya diakui saat barang terjual. */}
        <p className="text-xs text-ink-subtle">
          Pembelian stok tidak dicatat sebagai beban operasional.{' '}
          {product.type === 'bahan'
            ? 'Modalnya masuk hitungan laba lewat HPP, saat produk yang memakai bahan ini terjual.'
            : 'Modalnya masuk hitungan laba saat barang ini terjual.'}
        </p>
      </form>
    </Modal>
  )
}
