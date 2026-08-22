import {
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
import { tenantCollection } from './paths'
import type { PaymentMethod, Sale, SaleItem } from '@/types'

export function salesRef(tenantId: string) {
  return tenantCollection(tenantId, 'sales')
}

function toDate(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : new Date()
}

export function mapSale(snapshot: QueryDocumentSnapshot<DocumentData>): Sale {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    invoiceNo: data.invoiceNo ?? snapshot.id,
    items: (data.items ?? []) as SaleItem[],
    subtotal: data.subtotal ?? 0,
    discount: data.discount ?? 0,
    total: data.total ?? 0,
    totalCost: data.totalCost ?? 0,
    grossProfit: data.grossProfit ?? 0,
    paymentMethod: (data.paymentMethod ?? 'tunai') as PaymentMethod,
    cashReceived: data.cashReceived ?? 0,
    change: data.change ?? 0,
    note: data.note ?? '',
    cashierId: data.cashierId ?? '',
    cashierName: data.cashierName ?? '',
    createdAt: toDate(data.createdAt),
  }
}

/** INV-260815-143052: tanggal dan jam lokal, cukup unik untuk satu gerai. */
export function generateInvoiceNo(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  const date = `${pad(now.getFullYear() % 100)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `INV-${date}-${time}`
}

export interface NewSaleInput {
  items: SaleItem[]
  discount: number
  paymentMethod: PaymentMethod
  cashReceived: number
  note: string
  cashierId: string
  cashierName: string
}

/**
 * Penjualan ditulis dengan writeBatch, bukan runTransaction.
 *
 * runTransaction wajib bolak-balik ke server dan langsung gagal saat koneksi
 * putus, sedangkan warung harus tetap bisa melayani pembeli waktu internet
 * mati. writeBatch berisi `increment(-qty)` masuk antrean cache lokal dan
 * dikirim otomatis begitu koneksi kembali, dan karena increment dievaluasi di
 * server, dua perangkat yang menjual bersamaan tetap menghasilkan sisa stok
 * yang benar.
 *
 * Konsekuensinya stok tidak bisa dikunci di sisi server, jadi pemeriksaan
 * "stok cukup" dilakukan di layar kasir memakai data snapshot terbaru.
 */
export async function createSale(tenantId: string, input: NewSaleInput): Promise<Sale> {
  const subtotal = input.items.reduce((total, item) => total + item.subtotal, 0)
  const discount = Math.min(Math.max(input.discount, 0), subtotal)
  const total = subtotal - discount
  const totalCost = input.items.reduce(
    (sum, item) => sum + item.costPrice * item.qty,
    0,
  )

  const invoiceNo = generateInvoiceNo()
  const saleDoc = doc(salesRef(tenantId))
  const batch = writeBatch(db)

  batch.set(saleDoc, {
    invoiceNo,
    items: input.items,
    subtotal,
    discount,
    total,
    totalCost,
    grossProfit: total - totalCost,
    paymentMethod: input.paymentMethod,
    cashReceived: input.cashReceived,
    change: Math.max(input.cashReceived - total, 0),
    note: input.note,
    cashierId: input.cashierId,
    cashierName: input.cashierName,
    createdAt: serverTimestamp(),
  })

  for (const item of input.items) {
    batch.update(doc(productsRef(tenantId), item.productId), {
      stock: increment(-item.qty),
      updatedAt: serverTimestamp(),
    })
  }

  await batch.commit()

  return {
    id: saleDoc.id,
    invoiceNo,
    items: input.items,
    subtotal,
    discount,
    total,
    totalCost,
    grossProfit: total - totalCost,
    paymentMethod: input.paymentMethod,
    cashReceived: input.cashReceived,
    change: Math.max(input.cashReceived - total, 0),
    note: input.note,
    cashierId: input.cashierId,
    cashierName: input.cashierName,
    createdAt: new Date(),
  }
}

/**
 * Pembatalan transaksi menghapus struk sekaligus mengembalikan stok dalam satu
 * batch. Dokumen penjualan tidak boleh diedit (lihat firestore.rules), jadi
 * koreksi selalu berupa hapus lalu input ulang.
 *
 * `existingProductIds` diambil dari snapshot produk yang sedang aktif. Produk
 * yang sudah dihapus dilewati, sebab batch.update ke dokumen yang tidak ada
 * akan menggagalkan seluruh batch dan membuat struk gagal dibatalkan.
 */
export async function voidSale(
  tenantId: string,
  sale: Sale,
  existingProductIds: Set<string>,
) {
  const batch = writeBatch(db)
  batch.delete(doc(salesRef(tenantId), sale.id))

  for (const item of sale.items) {
    if (!existingProductIds.has(item.productId)) continue
    batch.update(doc(productsRef(tenantId), item.productId), {
      stock: increment(item.qty),
      updatedAt: serverTimestamp(),
    })
  }

  await batch.commit()
}

/** Penjualan dalam rentang tanggal, terbaru di atas. */
export function subscribeSales(
  tenantId: string,
  from: Date,
  to: Date,
  onData: (sales: Sale[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    query(
      salesRef(tenantId),
      where('createdAt', '>=', Timestamp.fromDate(from)),
      where('createdAt', '<=', Timestamp.fromDate(to)),
      orderBy('createdAt', 'desc'),
    ),
    (snapshot) => onData(snapshot.docs.map(mapSale)),
    onError,
  )
}
