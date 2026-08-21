import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Product, ProductDraft, ProductType } from '@/types'

export const productsRef = collection(db, 'products')

/** Timestamp dari cache lokal bisa berupa null sesaat sebelum server mengisinya. */
function toDate(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : new Date()
}

export function mapProduct(snapshot: QueryDocumentSnapshot<DocumentData>): Product {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    name: data.name ?? '',
    // Dokumen lama dibuat sebelum ada bahan baku dan tidak punya field ini.
    // Bawaannya barang jadi, karena itulah satu satunya jenis yang ada dulu.
    type: (data.type === 'bahan' ? 'bahan' : 'jadi') as ProductType,
    sku: data.sku ?? '',
    category: data.category ?? 'Umum',
    costPrice: data.costPrice ?? 0,
    sellPrice: data.sellPrice ?? 0,
    stock: data.stock ?? 0,
    unit: data.unit ?? 'pcs',
    minStock: data.minStock ?? 0,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

/**
 * Daftar produk didengarkan real time supaya stok yang berkurang di layar kasir
 * langsung terlihat di halaman produk tanpa perlu memuat ulang.
 */
export function subscribeProducts(
  onData: (products: Product[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    query(productsRef, orderBy('name')),
    (snapshot) => onData(snapshot.docs.map(mapProduct)),
    onError,
  )
}

export async function createProduct(draft: ProductDraft) {
  await addDoc(productsRef, {
    ...draft,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/**
 * `stock` sengaja tidak ikut diperbarui di sini. Form produk bisa terbuka
 * beberapa menit sementara kasir terus berjualan, jadi mengirim nilai stok dari
 * form akan menimpa penjualan yang terjadi di sela-sela itu. Perubahan stok
 * selalu lewat addStock atau setStock.
 */
export async function updateProduct(id: string, draft: Omit<ProductDraft, 'stock'>) {
  await updateDoc(doc(productsRef, id), { ...draft, updatedAt: serverTimestamp() })
}

export async function deleteProduct(id: string) {
  await deleteDoc(doc(productsRef, id))
}

/**
 * Penambahan stok dicatat dengan `increment` supaya dua perangkat yang restock
 * bersamaan tidak saling menimpa hasil hitungan.
 *
 * Pembelian stok sengaja tidak dicatat sebagai beban: modalnya baru diakui
 * sebagai HPP ketika barangnya terjual.
 */
export async function addStock(id: string, quantity: number, newCostPrice?: number) {
  const payload: Record<string, unknown> = {
    stock: increment(quantity),
    updatedAt: serverTimestamp(),
  }
  if (typeof newCostPrice === 'number') payload.costPrice = newCostPrice

  await updateDoc(doc(productsRef, id), payload)
}

/** Koreksi stok manual, misalnya setelah opname atau barang rusak. */
export async function setStock(id: string, stock: number) {
  await updateDoc(doc(productsRef, id), { stock, updatedAt: serverTimestamp() })
}
