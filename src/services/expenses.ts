import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { tenantCollection } from './paths'
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

export async function createExpense(
  tenantId: string,
  draft: ExpenseDraft,
  createdBy: string,
) {
  await addDoc(expensesRef(tenantId), {
    ...draft,
    date: Timestamp.fromDate(draft.date),
    createdBy,
    createdAt: serverTimestamp(),
  })
}

export async function updateExpense(tenantId: string, id: string, draft: ExpenseDraft) {
  await updateDoc(doc(expensesRef(tenantId), id), {
    ...draft,
    date: Timestamp.fromDate(draft.date),
  })
}

export async function deleteExpense(tenantId: string, id: string) {
  await deleteDoc(doc(expensesRef(tenantId), id))
}
