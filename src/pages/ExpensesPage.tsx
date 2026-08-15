import { useMemo, useState } from 'react'
import { PencilSimpleIcon, PlusIcon, TrashIcon, WalletIcon } from '@phosphor-icons/react'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  Segmented,
  TableSkeleton,
  toast,
} from '@/components/ui'
import { ExpenseFormModal } from '@/features/expenses/ExpenseFormModal'
import { PERIOD_OPTIONS, resolvePeriod, usePeriodData, type PeriodKey } from '@/hooks/usePeriod'
import { deleteExpense } from '@/services/expenses'
import { writeErrorMessage } from '@/lib/errors'
import { formatDateShort, formatRupiah } from '@/lib/format'
import { groupExpensesByCategory } from '@/lib/profit'
import type { Expense } from '@/types'

export default function ExpensesPage() {
  const [period, setPeriod] = useState<PeriodKey>('bulan-ini')
  const { from, to } = useMemo(() => resolvePeriod(period), [period])
  const { expenses, loading, error } = usePeriodData(from, to)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState(false)

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const byCategory = useMemo(() => groupExpensesByCategory(expenses), [expenses])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteExpense(deleteTarget.id)
      toast.success('Beban dihapus.')
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
        title="Beban Operasional"
        description="Pengeluaran rutin di luar harga modal barang. Angka ini yang memisahkan laba kotor dari laba bersih."
        actions={
          <Button
            icon={<PlusIcon size={17} weight="bold" />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Catat beban
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          aria-label="Periode beban"
          value={period}
          onChange={setPeriod}
          options={PERIOD_OPTIONS}
        />
        <p className="text-sm text-ink-muted">
          Total periode ini{' '}
          <span className="tabular font-semibold text-ink">{formatRupiah(total)}</span>
        </p>
      </div>

      {error ? <ErrorState message={error} /> : null}

      {byCategory.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {byCategory.map((entry) => (
            <Badge key={entry.category} tone="neutral">
              {entry.category}
              <span className="tabular font-semibold text-ink">
                {formatRupiah(entry.amount)}
              </span>
            </Badge>
          ))}
        </div>
      ) : null}

      <Card>
        {loading ? (
          <TableSkeleton rows={5} columns={4} />
        ) : expenses.length === 0 ? (
          <EmptyState
            icon={WalletIcon}
            title="Belum ada beban pada periode ini"
            description="Catat sewa tempat, listrik, gaji, atau pengeluaran rutin lain supaya laba bersih terhitung benar."
            action={
              <Button
                icon={<PlusIcon size={17} weight="bold" />}
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                Catat beban
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-muted">
                  <th className="px-5 py-3 font-medium">Tanggal</th>
                  <th className="px-5 py-3 font-medium">Keterangan</th>
                  <th className="px-5 py-3 font-medium">Kategori</th>
                  <th className="px-5 py-3 text-right font-medium">Nominal</th>
                  <th className="px-5 py-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="transition-colors hover:bg-surface-2">
                    <td className="tabular px-5 py-3.5 whitespace-nowrap text-ink-muted">
                      {formatDateShort(expense.date)}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-ink">
                      {expense.description}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">{expense.category}</td>
                    <td className="tabular px-5 py-3.5 text-right font-semibold text-ink">
                      {formatRupiah(expense.amount)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          label={`Ubah ${expense.description}`}
                          size="sm"
                          onClick={() => {
                            setEditing(expense)
                            setFormOpen(true)
                          }}
                        >
                          <PencilSimpleIcon size={18} />
                        </IconButton>
                        <IconButton
                          label={`Hapus ${expense.description}`}
                          size="sm"
                          className="hover:text-danger"
                          onClick={() => setDeleteTarget(expense)}
                        >
                          <TrashIcon size={18} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-surface-2">
                  <td colSpan={3} className="px-5 py-3.5 font-medium text-ink">
                    Total
                  </td>
                  <td className="tabular px-5 py-3.5 text-right font-semibold text-ink">
                    {formatRupiah(total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <ExpenseFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        expense={editing}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus catatan beban?"
        message={`"${deleteTarget?.description ?? ''}" sebesar ${formatRupiah(deleteTarget?.amount ?? 0)} akan dihapus dan laporan laba rugi ikut menyesuaikan.`}
        confirmLabel="Hapus"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
