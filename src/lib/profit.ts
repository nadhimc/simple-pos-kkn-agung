import type { Expense, ProfitLoss, Sale } from '@/types'
import { toDateInputValue } from './format'

/**
 * PERHITUNGAN LABA RUGI
 *
 *   Omzet          = jumlah total seluruh struk (sudah dipotong diskon)
 *   HPP            = jumlah harga modal barang yang terjual
 *   Laba kotor     = Omzet - HPP
 *   Beban          = pengeluaran operasional pada periode yang sama
 *   Laba bersih    = Laba kotor - Beban
 *
 * Modal barang diakui saat barang TERJUAL, bukan saat dibeli. Karena itu
 * pembelian stok tidak boleh dicatat sebagai beban, sebab modalnya sudah
 * masuk lewat HPP dan akan terhitung dua kali.
 */
export function computeProfitLoss(sales: Sale[], expenses: Expense[]): ProfitLoss {
  const revenue = sales.reduce((total, sale) => total + sale.total, 0)
  const costOfGoodsSold = sales.reduce((total, sale) => total + sale.totalCost, 0)
  const operatingExpense = expenses.reduce((total, expense) => total + expense.amount, 0)
  const itemsSold = sales.reduce(
    (total, sale) => total + sale.items.reduce((sum, item) => sum + item.qty, 0),
    0,
  )

  const grossProfit = revenue - costOfGoodsSold
  const netProfit = grossProfit - operatingExpense

  return {
    revenue,
    costOfGoodsSold,
    grossProfit,
    operatingExpense,
    netProfit,
    transactionCount: sales.length,
    itemsSold,
    grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
  }
}

/**
 * Laba rugi dari angka yang sudah dijumlahkan, bukan dari daftar transaksinya.
 *
 * Dipakai ringkasan admin, yang memang tidak boleh membaca struk unit usaha
 * mana pun dan hanya memegang total per bulan. Rumusnya sengaja memanggil
 * pengurangan yang sama seperti computeProfitLoss di atas, supaya tidak ada dua
 * definisi laba yang bisa berbeda.
 *
 * `itemsSold` tidak bisa direkonstruksi dari total, jadi dilaporkan nol.
 */
export function profitFromTotals(
  revenue: number,
  grossProfit: number,
  operatingExpense: number,
  transactionCount = 0,
): ProfitLoss {
  const netProfit = grossProfit - operatingExpense

  return {
    revenue,
    costOfGoodsSold: revenue - grossProfit,
    grossProfit,
    operatingExpense,
    netProfit,
    transactionCount,
    itemsSold: 0,
    grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
  }
}

export interface DailyPoint {
  /** "2026-08-15" */
  date: string
  revenue: number
  grossProfit: number
  netProfit: number
}

/**
 * Deret harian untuk grafik. Hari tanpa transaksi tetap dimunculkan bernilai
 * nol supaya jarak antar titik di grafik mewakili waktu yang sebenarnya.
 */
export function buildDailySeries(
  sales: Sale[],
  expenses: Expense[],
  from: Date,
  to: Date,
): DailyPoint[] {
  const revenueByDay = new Map<string, number>()
  const costByDay = new Map<string, number>()
  const expenseByDay = new Map<string, number>()

  for (const sale of sales) {
    const key = toDateInputValue(sale.createdAt)
    revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + sale.total)
    costByDay.set(key, (costByDay.get(key) ?? 0) + sale.totalCost)
  }

  for (const expense of expenses) {
    const key = toDateInputValue(expense.date)
    expenseByDay.set(key, (expenseByDay.get(key) ?? 0) + expense.amount)
  }

  const points: DailyPoint[] = []
  const cursor = new Date(from)
  cursor.setHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setHours(0, 0, 0, 0)

  while (cursor <= end) {
    const key = toDateInputValue(cursor)
    const revenue = revenueByDay.get(key) ?? 0
    const grossProfit = revenue - (costByDay.get(key) ?? 0)
    points.push({
      date: key,
      revenue,
      grossProfit,
      netProfit: grossProfit - (expenseByDay.get(key) ?? 0),
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return points
}

export interface ProductSales {
  productId: string
  name: string
  qty: number
  revenue: number
  profit: number
}

/** Peringkat produk berdasarkan kontribusi laba, bukan sekadar jumlah terjual. */
export function rankProducts(sales: Sale[]): ProductSales[] {
  const byProduct = new Map<string, ProductSales>()

  for (const sale of sales) {
    for (const item of sale.items) {
      const existing = byProduct.get(item.productId) ?? {
        productId: item.productId,
        name: item.name,
        qty: 0,
        revenue: 0,
        profit: 0,
      }
      existing.qty += item.qty
      existing.revenue += item.subtotal
      existing.profit += (item.sellPrice - item.costPrice) * item.qty
      byProduct.set(item.productId, existing)
    }
  }

  return [...byProduct.values()].sort((a, b) => b.profit - a.profit)
}

/** Total beban per kategori, terbesar dulu. */
export function groupExpensesByCategory(expenses: Expense[]) {
  const byCategory = new Map<string, number>()
  for (const expense of expenses) {
    byCategory.set(
      expense.category,
      (byCategory.get(expense.category) ?? 0) + expense.amount,
    )
  }
  return [...byCategory.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
}
