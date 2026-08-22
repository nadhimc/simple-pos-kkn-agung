import { useEffect, useState, type FormEvent } from 'react'
import { Button, Modal, SelectField, TextField, toast } from '@/components/ui'
import { createExpense, updateExpense } from '@/services/expenses'
import { writeErrorMessage } from '@/lib/errors'
import { toDateInputValue } from '@/lib/format'
import { useAuth } from '@/contexts/AuthContext'
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory } from '@/types'

interface ExpenseFormModalProps {
  open: boolean
  onClose: () => void
  expense: Expense | null
}

export function ExpenseFormModal({ open, onClose, expense }: ExpenseFormModalProps) {
  const { user, tenantId } = useAuth()
  const [date, setDate] = useState(toDateInputValue(new Date()))
  const [category, setCategory] = useState<ExpenseCategory>(EXPENSE_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [errors, setErrors] = useState<{ description?: string; amount?: string }>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setDate(toDateInputValue(expense?.date ?? new Date()))
    setCategory(expense?.category ?? EXPENSE_CATEGORIES[0])
    setDescription(expense?.description ?? '')
    setAmount(expense ? String(expense.amount) : '')
  }, [open, expense])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const value = Number(amount)
    const next: typeof errors = {}
    if (!description.trim()) next.description = 'Keterangan wajib diisi.'
    if (!Number.isFinite(value) || value <= 0) next.amount = 'Nominal harus lebih dari nol.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    // Tanggal dari input disimpan pada jam 12 siang lokal supaya pergeseran
    // zona waktu tidak pernah memindahkannya ke tanggal sebelah.
    const [year, month, day] = date.split('-').map(Number)
    const draft = {
      date: new Date(year, month - 1, day, 12, 0, 0),
      category,
      description: description.trim(),
      amount: value,
    }

    setSaving(true)
    try {
      if (expense) {
        await updateExpense(tenantId, expense.id, draft)
        toast.success('Beban diperbarui.')
      } else {
        await createExpense(tenantId, draft, user?.uid ?? '')
        toast.success('Beban dicatat.')
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
      title={expense ? 'Ubah beban' : 'Catat beban operasional'}
      description="Pengeluaran rutin di luar harga modal barang, misalnya sewa, listrik, atau gaji."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button type="submit" form="expense-form" loading={saving}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Tanggal"
            type="date"
            required
            value={date}
            max={toDateInputValue(new Date())}
            onChange={(event) => setDate(event.target.value)}
          />
          <SelectField
            label="Kategori"
            value={category}
            onChange={(event) => setCategory(event.target.value as ExpenseCategory)}
            options={EXPENSE_CATEGORIES.map((item) => ({ value: item, label: item }))}
          />
        </div>

        <TextField
          label="Keterangan"
          required
          autoFocus
          placeholder="Bayar listrik bulan Agustus"
          value={description}
          error={errors.description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <TextField
          label="Nominal"
          prefix="Rp"
          type="number"
          inputMode="numeric"
          min={0}
          step={1000}
          required
          value={amount}
          error={errors.amount}
          onChange={(event) => setAmount(event.target.value)}
        />

        <p className="text-xs text-ink-subtle">
          Pembelian stok barang tidak dicatat di sini. Modalnya sudah dihitung
          sebagai HPP saat barang terjual.
        </p>
      </form>
    </Modal>
  )
}
