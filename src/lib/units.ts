/**
 * SATUAN DAN KONVERSINYA
 *
 * Resep memakai satuan pemakaian (100 gram gula), sementara stok disimpan dalam
 * satuan pembelian (1 kg gula seharga 14.500). Tanpa konversi, biaya bahan akan
 * meleset seribu kali lipat.
 *
 * Konversi hanya boleh terjadi di dalam dimensi yang sama. Gram tidak bisa
 * diubah jadi mililiter, karena 100 ml air dan 100 ml minyak beratnya berbeda
 * dan aplikasi ini tidak menyimpan massa jenis.
 */

export type UnitDimension = 'berat' | 'volume' | 'jumlah'

interface UnitDef {
  dimension: UnitDimension
  /** Pengali menuju satuan dasar dimensinya: gram, ml, atau pcs. */
  toBase: number
}

export const UNITS: Record<string, UnitDef> = {
  // Berat, dasar gram
  gram: { dimension: 'berat', toBase: 1 },
  ons: { dimension: 'berat', toBase: 100 },
  kg: { dimension: 'berat', toBase: 1000 },

  // Volume, dasar mililiter
  ml: { dimension: 'volume', toBase: 1 },
  liter: { dimension: 'volume', toBase: 1000 },

  // Jumlah, dasar satu buah. Satuan wadah dihitung satu buah karena warung
  // membelinya per wadah, bukan per isi.
  pcs: { dimension: 'jumlah', toBase: 1 },
  bungkus: { dimension: 'jumlah', toBase: 1 },
  botol: { dimension: 'jumlah', toBase: 1 },
  sachet: { dimension: 'jumlah', toBase: 1 },
  kotak: { dimension: 'jumlah', toBase: 1 },
  karung: { dimension: 'jumlah', toBase: 1 },
  porsi: { dimension: 'jumlah', toBase: 1 },
  lusin: { dimension: 'jumlah', toBase: 12 },
}

export const UNIT_LIST = Object.keys(UNITS)

export function dimensionOf(unit: string): UnitDimension | null {
  return UNITS[unit]?.dimension ?? null
}

/**
 * Satuan yang boleh dipakai resep untuk sebuah bahan, yaitu satuan lain dalam
 * dimensi yang sama. Untuk bahan bersatuan jumlah, hanya satuannya sendiri yang
 * ditawarkan: mengubah botol jadi sachet tidak punya arti.
 */
export function compatibleUnits(stockUnit: string): string[] {
  const dimension = dimensionOf(stockUnit)
  if (!dimension) return [stockUnit]
  if (dimension === 'jumlah') {
    return stockUnit === 'lusin' ? ['lusin', 'pcs'] : [stockUnit]
  }
  return UNIT_LIST.filter((unit) => UNITS[unit].dimension === dimension)
}

/**
 * Ubah jumlah dari satu satuan ke satuan lain. Mengembalikan null kalau
 * satuannya tidak dikenal atau beda dimensi, supaya pemanggilnya terpaksa
 * menangani kasus itu alih alih menghasilkan angka yang salah diam diam.
 */
export function convert(qty: number, from: string, to: string): number | null {
  const a = UNITS[from]
  const b = UNITS[to]
  if (!a || !b || a.dimension !== b.dimension) return null
  return (qty * a.toBase) / b.toBase
}

/** Satuan pemakaian yang paling masuk akal untuk resep, dari satuan stoknya. */
export function defaultRecipeUnit(stockUnit: string): string {
  const dimension = dimensionOf(stockUnit)
  if (dimension === 'berat') return 'gram'
  if (dimension === 'volume') return 'ml'
  return stockUnit
}
