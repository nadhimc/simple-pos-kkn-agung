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
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { tenantCollection } from './paths'
import type { Recipe, RecipeDraft, RecipeItem } from '@/types'

export function recipesRef(tenantId: string) {
  return tenantCollection(tenantId, 'recipes')
}

function toDate(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : new Date()
}

export function mapRecipe(snapshot: QueryDocumentSnapshot<DocumentData>): Recipe {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    productId: data.productId ?? '',
    productName: data.productName ?? '',
    items: (data.items ?? []) as RecipeItem[],
    yieldQty: data.yieldQty ?? 1,
    yieldUnit: data.yieldUnit ?? 'pcs',
    note: data.note ?? '',
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

export function subscribeRecipes(
  tenantId: string,
  onData: (recipes: Recipe[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    query(recipesRef(tenantId), orderBy('productName')),
    (snapshot) => onData(snapshot.docs.map(mapRecipe)),
    onError,
  )
}

export async function createRecipe(tenantId: string, draft: RecipeDraft) {
  await addDoc(recipesRef(tenantId), {
    ...draft,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateRecipe(tenantId: string, id: string, draft: RecipeDraft) {
  await updateDoc(doc(recipesRef(tenantId), id), { ...draft, updatedAt: serverTimestamp() })
}

/**
 * Menghapus resep tidak menyentuh riwayat produksi maupun stok. Produksi yang
 * sudah terjadi menyimpan salinan bahan dan harganya sendiri.
 */
export async function deleteRecipe(tenantId: string, id: string) {
  await deleteDoc(doc(recipesRef(tenantId), id))
}
