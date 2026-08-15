/**
 * Model data aplikasi. Semua uang disimpan sebagai angka rupiah penuh (bukan sen)
 * karena rupiah tidak lagi memakai pecahan desimal di transaksi ritel.
 */

export interface Product {
  id: string
  name: string
  /** Kode/barcode opsional, dipakai untuk pencarian cepat di kasir. */
  sku: string
  category: string
  /** Harga modal per unit. Dasar perhitungan HPP saat penjualan. */
  costPrice: number
  /** Harga jual per unit. */
  sellPrice: number
  stock: number
  /** Satuan tampilan: pcs, kg, botol, porsi, dll. */
  unit: string
  /** Ambang peringatan stok menipis. */
  minStock: number
  createdAt: Date
  updatedAt: Date
}

/**
 * Produk boleh dihapus permanen: setiap baris penjualan menyimpan salinan nama
 * dan harganya sendiri, jadi riwayat dan laba lama tetap utuh.
 */
export type ProductDraft = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>

/**
 * Baris penjualan menyimpan salinan harga jual DAN harga modal saat transaksi
 * terjadi. Tanpa salinan ini, mengubah harga produk akan mengubah laba historis.
 */
export interface SaleItem {
  productId: string
  name: string
  unit: string
  qty: number
  sellPrice: number
  costPrice: number
  /** qty * sellPrice */
  subtotal: number
}

export type PaymentMethod = 'tunai' | 'qris' | 'transfer'

export interface Sale {
  id: string
  invoiceNo: string
  items: SaleItem[]
  /** Jumlah seluruh subtotal item sebelum diskon. */
  subtotal: number
  discount: number
  /** subtotal - discount */
  total: number
  /** Total harga modal seluruh item (HPP transaksi ini). */
  totalCost: number
  /** total - totalCost */
  grossProfit: number
  paymentMethod: PaymentMethod
  cashReceived: number
  change: number
  note: string
  cashierId: string
  cashierName: string
  createdAt: Date
}

export const EXPENSE_CATEGORIES = [
  'Sewa Tempat',
  'Listrik & Air',
  'Gaji Karyawan',
  'Transportasi',
  'Perlengkapan',
  'Pemasaran',
  'Lain-lain',
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

/**
 * Beban operasional saja. Pembelian stok TIDAK dicatat di sini karena modalnya
 * sudah diakui sebagai HPP pada saat barang terjual (lihat CLAUDE.md).
 */
export interface Expense {
  id: string
  date: Date
  category: ExpenseCategory
  description: string
  amount: number
  createdBy: string
  createdAt: Date
}

export type ExpenseDraft = Omit<Expense, 'id' | 'createdAt' | 'createdBy'>

export interface ProfitLoss {
  revenue: number
  costOfGoodsSold: number
  grossProfit: number
  operatingExpense: number
  netProfit: number
  transactionCount: number
  itemsSold: number
  /** grossProfit / revenue * 100 */
  grossMargin: number
  /** netProfit / revenue * 100 */
  netMargin: number
}

export interface DateRange {
  from: Date
  to: Date
}
