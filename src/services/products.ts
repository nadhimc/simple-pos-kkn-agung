import {
  addDoc,
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
import { tenantCollection } from './paths'
import type { Product, ProductDraft, ProductType } from '@/types'

/** Produk selalu milik satu warung, jadi jalurnya ikut tenant-nya. */
export function productsRef(tenantId: string) {
  return tenantCollection(tenantId, 'products')
}

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
  tenantId: string,
  onData: (products: Product[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    query(productsRef(tenantId), orderBy('name')),
    (snapshot) => onData(snapshot.docs.map(mapProduct)),
    onError,
  )
}

export async function createProduct(tenantId: string, draft: ProductDraft) {
  await addDoc(productsRef(tenantId), {
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
export async function updateProduct(
  tenantId: string,
  id: string,
  draft: Omit<ProductDraft, 'stock'>,
) {
  await updateDoc(doc(productsRef(tenantId), id), { ...draft, updatedAt: serverTimestamp() })
}

export async function deleteProduct(tenantId: string, id: string) {
  await deleteDoc(doc(productsRef(tenantId), id))
}

/**
 * Penambahan stok dicatat dengan `increment` supaya dua perangkat yang restock
 * bersamaan tidak saling menimpa hasil hitungan.
 *
 * Pembelian stok sengaja tidak dicatat sebagai beban: modalnya baru diakui
 * sebagai HPP ketika barangnya terjual.
 */
export async function addStock(
  tenantId: string,
  id: string,
  quantity: number,
  newCostPrice?: number,
) {
  const payload: Record<string, unknown> = {
    stock: increment(quantity),
    updatedAt: serverTimestamp(),
  }
  if (typeof newCostPrice === 'number') payload.costPrice = newCostPrice

  await updateDoc(doc(productsRef(tenantId), id), payload)
}

/** Koreksi stok manual, misalnya setelah opname atau barang rusak. */
export async function setStock(tenantId: string, id: string, stock: number) {
  await updateDoc(doc(productsRef(tenantId), id), { stock, updatedAt: serverTimestamp() })
}
