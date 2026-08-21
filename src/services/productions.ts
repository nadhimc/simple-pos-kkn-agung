import {
  collection,
  doc,
  increment,
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
import { productsRef } from './products'
import { blendedCostPrice } from '@/lib/hpp'
import type { Product, Production, ProductionItem } from '@/types'

export const productionsRef = collection(db, 'productions')

function toDate(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : new Date()
}

export function mapProduction(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): Production {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    productionNo: data.productionNo ?? snapshot.id,
    productId: data.productId ?? '',
    productName: data.productName ?? '',
    recipeId: data.recipeId ?? '',
    items: (data.items ?? []) as ProductionItem[],
    materialCost: data.materialCost ?? 0,
    yieldQty: data.yieldQty ?? 0,
    yieldUnit: data.yieldUnit ?? 'pcs',
    costPerUnit: data.costPerUnit ?? 0,
    operatorId: data.operatorId ?? '',
    operatorName: data.operatorName ?? '',
    note: data.note ?? '',
    createdAt: toDate(data.createdAt),
  }
}

/** PRD-260815-143052, mengikuti pola nomor struk penjualan. */
export function generateProductionNo(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  const date = `${pad(now.getFullYear() % 100)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `PRD-${date}-${time}`
}

export interface NewProductionInput {
  product: Product
  recipeId: string
  items: ProductionItem[]
  materialCost: number
  yieldQty: number
  yieldUnit: string
  costPerUnit: number
  operatorId: string
  operatorName: string
  note: string
}

/**
 * Menjalankan produksi memindahkan nilai dari stok bahan ke stok produk jadi.
 *
 * Ini BUKAN beban operasional. Modal bahan sudah diakui waktu dibeli sebagai
 * persediaan, lalu berpindah wujud jadi persediaan barang jadi, dan baru diakui
 * sebagai HPP ketika produknya terjual. Mencatatnya sebagai beban akan membuat
 * modal terhitung dua kali, persis seperti kalau pembelian stok dicatat sebagai
 * beban.
 *
 * Memakai writeBatch dengan increment, dengan alasan yang sama seperti
 * penjualan: dapur bisa saja memproduksi saat internet mati, dan batch akan
 * terkirim sendiri begitu koneksi kembali.
 */
export async function createProduction(input: NewProductionInput): Promise<Production> {
  const productionNo = generateProductionNo()
  const productionDoc = doc(productionsRef)
  const batch = writeBatch(db)

  batch.set(productionDoc, {
    productionNo,
    productId: input.product.id,
    productName: input.product.name,
    recipeId: input.recipeId,
    items: input.items,
    materialCost: input.materialCost,
    yieldQty: input.yieldQty,
    yieldUnit: input.yieldUnit,
    costPerUnit: input.costPerUnit,
    operatorId: input.operatorId,
    operatorName: input.operatorName,
    note: input.note,
    createdAt: serverTimestamp(),
  })

  // Bahan berkurang sesuai pemakaian yang sudah dikonversi ke satuan stoknya.
  for (const item of input.items) {
    batch.update(doc(productsRef, item.materialId), {
      stock: increment(-item.qtyInStockUnit),
      updatedAt: serverTimestamp(),
    })
  }

  // Produk jadi bertambah, dan harga modalnya jadi rata rata tertimbang antara
  // sisa stok lama dan hasil produksi ini.
  batch.update(doc(productsRef, input.product.id), {
    stock: increment(input.yieldQty),
    costPrice: blendedCostPrice(
      input.product.stock,
      input.product.costPrice,
      input.yieldQty,
      input.costPerUnit,
    ),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()

  return {
    id: productionDoc.id,
    productionNo,
    productId: input.product.id,
    productName: input.product.name,
    recipeId: input.recipeId,
    items: input.items,
    materialCost: input.materialCost,
    yieldQty: input.yieldQty,
    yieldUnit: input.yieldUnit,
    costPerUnit: input.costPerUnit,
    operatorId: input.operatorId,
    operatorName: input.operatorName,
    note: input.note,
    createdAt: new Date(),
  }
}

/**
 * Membatalkan produksi mengembalikan stok bahan dan menarik kembali produk jadi.
 *
 * Harga modal produk TIDAK dikembalikan ke nilai sebelumnya, karena rata rata
 * tertimbang tidak bisa dibalik tanpa menyimpan riwayat nilainya. Kalau produk
 * jadinya sudah terlanjur terjual, stoknya akan jadi negatif dan Security Rules
 * menolak seluruh batch, sehingga pembatalan gagal dengan sendirinya.
 */
export async function voidProduction(
  production: Production,
  existingProductIds: Set<string>,
) {
  const batch = writeBatch(db)
  batch.delete(doc(productionsRef, production.id))

  for (const item of production.items) {
    if (!existingProductIds.has(item.materialId)) continue
    batch.update(doc(productsRef, item.materialId), {
      stock: increment(item.qtyInStockUnit),
      updatedAt: serverTimestamp(),
    })
  }

  if (existingProductIds.has(production.productId)) {
    batch.update(doc(productsRef, production.productId), {
      stock: increment(-production.yieldQty),
      updatedAt: serverTimestamp(),
    })
  }

  await batch.commit()
}

export function subscribeProductions(
  from: Date,
  to: Date,
  onData: (productions: Production[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    query(
      productionsRef,
      where('createdAt', '>=', Timestamp.fromDate(from)),
      where('createdAt', '<=', Timestamp.fromDate(to)),
      orderBy('createdAt', 'desc'),
    ),
    (snapshot) => onData(snapshot.docs.map(mapProduction)),
    onError,
  )
}
