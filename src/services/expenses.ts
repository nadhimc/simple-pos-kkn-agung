import {
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { tenantCollection } from './paths'
import { addStatsToBatch } from './stats'
import type { Expense, ExpenseCategory, ExpenseDraft } from '@/types'

export function expensesRef(tenantId: string) {
  return tenantCollection(tenantId, 'expenses')
}

function toDate(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : new Date()
}

export function mapExpense(snapshot: QueryDocumentSnapshot<DocumentData>): Expense {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    date: toDate(data.date),
    category: (data.category ?? 'Lain-lain') as ExpenseCategory,
    description: data.description ?? '',
    amount: data.amount ?? 0,
    createdBy: data.createdBy ?? '',
    createdAt: toDate(data.createdAt),
  }
}

export function subscribeExpenses(
  tenantId: string,
  from: Date,
  to: Date,
  onData: (expenses: Expense[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    query(
      expensesRef(tenantId),
      where('date', '>=', Timestamp.fromDate(from)),
      where('date', '<=', Timestamp.fromDate(to)),
      orderBy('date', 'desc'),
    ),
    (snapshot) => onData(snapshot.docs.map(mapExpense)),
    onError,
  )
}

/*
  Ketiga fungsi di bawah memakai writeBatch, walaupun masing masing hanya
  menyentuh satu dokumen beban. Alasannya ringkasan untuk admin: totalnya harus
  berubah bersama bebannya, dalam satu tulisan yang gagal atau berhasil
  bersama sama. Beban yang tercatat tapi tidak terhitung di ringkasan lebih
  buruk daripada keduanya gagal.
*/

export async function createExpense(
  tenantId: string,
  draft: ExpenseDraft,
  createdBy: string,
) {
  const batch = writeBatch(db)

  batch.set(doc(expensesRef(tenantId)), {
    ...draft,
    date: Timestamp.fromDate(draft.date),
    createdBy,
    createdAt: serverTimestamp(),
  })
  addStatsToBatch(batch, tenantId, [{ at: draft.date, expenseTotal: draft.amount }])

  await batch.commit()
}

/**
 * `previous` dibutuhkan karena ringkasan bulanan tidak bisa dikoreksi tanpa
 * tahu nilai lamanya, dan tanggalnya boleh ikut berubah: beban yang dipindahkan
 * dari Juli ke Agustus harus mengurangi Juli sekaligus menambah Agustus.
 */
export async function updateExpense(
  tenantId: string,
  id: string,
  draft: ExpenseDraft,
  previous: Expense,
) {
  const batch = writeBatch(db)

  batch.update(doc(expensesRef(tenantId), id), {
    ...draft,
    date: Timestamp.fromDate(draft.date),
  })
  addStatsToBatch(batch, tenantId, [
    { at: previous.date, expenseTotal: -previous.amount },
    { at: draft.date, expenseTotal: draft.amount },
  ])

  await batch.commit()
}

export async function deleteExpense(tenantId: string, expense: Expense) {
  const batch = writeBatch(db)

  batch.delete(doc(expensesRef(tenantId), expense.id))
  addStatsToBatch(batch, tenantId, [
    { at: expense.date, expenseTotal: -expense.amount },
  ])

  await batch.commit()
}
