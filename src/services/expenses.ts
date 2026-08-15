import {
  addDoc,
  collection,
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
import { db } from '@/lib/firebase'
import type { Expense, ExpenseCategory, ExpenseDraft } from '@/types'

export const expensesRef = collection(db, 'expenses')

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
  from: Date,
  to: Date,
  onData: (expenses: Expense[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    query(
      expensesRef,
      where('date', '>=', Timestamp.fromDate(from)),
      where('date', '<=', Timestamp.fromDate(to)),
      orderBy('date', 'desc'),
    ),
    (snapshot) => onData(snapshot.docs.map(mapExpense)),
    onError,
  )
}

export async function createExpense(draft: ExpenseDraft, createdBy: string) {
  await addDoc(expensesRef, {
    ...draft,
    date: Timestamp.fromDate(draft.date),
    createdBy,
    createdAt: serverTimestamp(),
  })
}

export async function updateExpense(id: string, draft: ExpenseDraft) {
  await updateDoc(doc(expensesRef, id), {
    ...draft,
    date: Timestamp.fromDate(draft.date),
  })
}

export async function deleteExpense(id: string) {
  await deleteDoc(doc(expensesRef, id))
}
