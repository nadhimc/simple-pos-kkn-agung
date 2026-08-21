import { convert } from './units'
import type { HppBreakdown, Product, RecipeItem } from '@/types'

/**
 * HARGA POKOK PRODUKSI
 *
 *   biaya bahan = jumlah pemakaian (dikonversi ke satuan stok) x harga modal
 *   HPP produksi = jumlah seluruh biaya bahan
 *   HPP per pcs  = HPP produksi dibagi jumlah produk jadi yang dihasilkan
 *
 * Harga bahan SELALU diambil dari dokumen produk terkini, tidak pernah diketik
 * ulang. Itulah gunanya: begitu harga kulakan gula naik, HPP seluruh resep yang
 * memakai gula ikut menyesuaikan tanpa ada yang perlu diperbarui manual.
 *
 * Rumusnya hanya ada di sini. Jangan menghitung ulang di komponen.
 */
export function computeHpp(
  items: RecipeItem[],
  yieldQty: number,
  productsById: Map<string, Product>,
): HppBreakdown {
  const lines = items.map((item) => {
    const material = productsById.get(item.materialId)

    if (!material) {
      return {
        materialId: item.materialId,
        materialName: item.materialName,
        qty: item.qty,
        unit: item.unit,
        qtyInStockUnit: 0,
        stockUnit: item.unit,
        costPerStockUnit: 0,
        cost: 0,
        problem: 'Bahan sudah dihapus dari daftar produk.',
      }
    }

    const qtyInStockUnit = convert(item.qty, item.unit, material.unit)

    if (qtyInStockUnit === null) {
      return {
        materialId: item.materialId,
        materialName: material.name,
        qty: item.qty,
        unit: item.unit,
        qtyInStockUnit: 0,
        stockUnit: material.unit,
        costPerStockUnit: material.costPrice,
        cost: 0,
        problem: `Satuan ${item.unit} tidak bisa diubah ke ${material.unit}.`,
      }
    }

    return {
      materialId: item.materialId,
      materialName: material.name,
      qty: item.qty,
      unit: item.unit,
      qtyInStockUnit,
      stockUnit: material.unit,
      costPerStockUnit: material.costPrice,
      // Dibulatkan di tiap baris supaya angka yang dijumlahkan sama persis
      // dengan angka yang tampil di layar. Menjumlah dulu baru membulat
      // membuat total tidak cocok dengan penjumlahan manual barisnya.
      cost: Math.round(qtyInStockUnit * material.costPrice),
      problem: '',
    }
  })

  const materialCost = lines.reduce((total, line) => total + line.cost, 0)
  const safeYield = yieldQty > 0 ? yieldQty : 0

  return {
    lines,
    materialCost,
    yieldQty: safeYield,
    costPerUnit: safeYield > 0 ? Math.round(materialCost / safeYield) : 0,
    hasProblem: lines.some((line) => line.problem !== ''),
  }
}

/**
 * Apakah stok bahan mencukupi untuk menjalankan produksi ini.
 * Dipakai layar produksi sebelum menyimpan, karena stok tidak bisa dikunci.
 */
export function checkMaterialStock(
  breakdown: HppBreakdown,
  productsById: Map<string, Product>,
) {
  return breakdown.lines
    .map((line) => {
      const material = productsById.get(line.materialId)
      if (!material) return null
      const shortage = line.qtyInStockUnit - material.stock
      if (shortage <= 0) return null
      return {
        materialName: line.materialName,
        needed: line.qtyInStockUnit,
        available: material.stock,
        shortage,
        stockUnit: material.unit,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
}

/**
 * Harga modal produk jadi setelah produksi masuk, memakai rata rata tertimbang.
 *
 * Kalau masih ada sisa stok lama dengan harga modal berbeda, menimpa begitu saja
 * dengan HPP produksi terbaru akan membuat laba sisa stok lama salah hitung.
 * Rata rata tertimbang menjaga nilai persediaan tetap benar.
 */
export function blendedCostPrice(
  currentStock: number,
  currentCostPrice: number,
  addedQty: number,
  addedCostPerUnit: number,
): number {
  const oldStock = Math.max(currentStock, 0)
  const totalQty = oldStock + addedQty
  if (totalQty <= 0) return Math.round(addedCostPerUnit)

  const totalValue = oldStock * currentCostPrice + addedQty * addedCostPerUnit
  return Math.round(totalValue / totalQty)
}
