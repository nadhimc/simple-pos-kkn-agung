/**
 * Model data aplikasi. Semua uang disimpan sebagai angka rupiah penuh (bukan sen)
 * karena rupiah tidak lagi memakai pecahan desimal di transaksi ritel.
 */

/* -------------------------------------------------------- warung & pengguna */

/**
 * Satu warung. Seluruh data usahanya hidup di bawah `tenants/{id}/…`, jadi
 * tenant adalah bagian dari jalur dokumen dan bukan sekadar field. Itu yang
 * membuat kueri tidak mungkin lupa memfilter warung.
 */
export interface Tenant {
  id: string
  name: string
  ownerName: string
  phone: string
  address: string
  /**
   * Unit usaha yang tutup dinonaktifkan, bukan dihapus. Firestore tidak
   * menghapus subkoleksi secara berjenjang, jadi menghapus dokumen induknya
   * hanya akan meninggalkan produk dan struk sebagai data yatim yang tidak bisa
   * dibaca siapa pun. Menonaktifkan menutup aksesnya sambil menjaga datanya
   * tetap utuh dan bisa dibuka lagi.
   */
  active: boolean
  createdAt: Date
  updatedAt: Date
}

/** `active` diubah lewat setTenantActive, bukan lewat form. */
export type TenantDraft = Omit<Tenant, 'id' | 'active' | 'createdAt' | 'updatedAt'>

/**
 * Peran menentukan dunia mana yang dilihat orang ini.
 *
 * `admin` adalah admin platform: ia mengelola warung dan pengguna, dan sengaja
 * tidak bisa membaca pembukuan warung mana pun. Ia satu satunya peran yang
 * `tenantId`-nya kosong, dan satu satunya yang tidak bisa dibuat dari dalam
 * aplikasi.
 *
 * `pemilik` dan `kasir` adalah orang warung. Keduanya belum dibedakan haknya:
 * untuk sekarang setiap orang warung boleh membuka seluruh halaman warungnya.
 */
export type UserRole = 'admin' | 'pemilik' | 'kasir'

export interface AppUser {
  uid: string
  name: string
  /** Terisi kalau akunnya dibuat dengan email. Boleh kosong. */
  email: string
  /** Format E.164, misalnya +6285156657853. Terisi kalau masuk lewat nomor HP. */
  phone: string
  role: UserRole
  /** Kosong hanya untuk admin platform. */
  tenantId: string
  /** Akses dicabut dengan mematikan ini, bukan menghapus barisnya. */
  active: boolean
  createdAt: Date | null
}

export type AppUserDraft = Omit<AppUser, 'uid' | 'createdAt'>

/**
 * Undangan untuk satu nomor HP yang belum pernah masuk.
 *
 * Ada karena nomor HP tidak bisa didaftarkan sepihak: OTP-nya dikirim ke HP
 * orangnya. Undangan memindahkan OTP itu ke saat orangnya masuk sendiri,
 * sehingga admin tidak perlu ikut memegang HP-nya.
 *
 * Hilang dengan sendirinya begitu dipakai.
 */
export interface Invite {
  /** Format E.164, sekaligus id dokumennya. */
  phone: string
  name: string
  role: Exclude<UserRole, 'admin'>
  tenantId: string
  createdAt: Date | null
}

/**
 * Ringkasan angka satu unit usaha, dijaga oleh unit usahanya sendiri dan hanya
 * dibaca admin. Ada karena admin platform sengaja tidak diberi akses ke
 * subkoleksi unit usaha mana pun, sehingga ia tidak bisa menjumlahkan struk
 * sendiri.
 */
export interface TenantStatsMonth {
  revenue: number
  grossProfit: number
  expenseTotal: number
  salesCount: number
}

export interface TenantStats {
  tenantId: string
  salesCount: number
  revenue: number
  grossProfit: number
  expenseTotal: number
  productionCount: number
  /** Null kalau unit usaha ini belum pernah menjual apa pun. */
  lastSaleAt: Date | null
  /** Kunci "2026-08", waktu lokal. */
  months: Record<string, TenantStatsMonth>
}

/**
 * Bahan baku tidak pernah muncul di layar kasir. Ia hanya dipakai lewat resep
 * untuk memproduksi barang jadi. Barang jadi mencakup dua hal sekaligus:
 * barang dagangan yang dibeli lalu dijual apa adanya, dan hasil produksi
 * sendiri yang harga modalnya datang dari perhitungan HPP.
 */
export type ProductType = 'bahan' | 'jadi'

export interface Product {
  id: string
  name: string
  type: ProductType
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

/* ------------------------------------------------------------------ resep */

/**
 * Satu baris bahan dalam resep. `unit` adalah satuan PEMAKAIAN, yang boleh
 * berbeda dari satuan stok bahannya: resep menulis 100 gram sementara gula
 * disimpan per kg. Konversinya ditangani src/lib/units.ts.
 *
 * Harga sengaja TIDAK disimpan di sini. Resep selalu memakai harga bahan
 * terkini, karena gunanya memang untuk menghitung ulang HPP saat harga
 * kulakan berubah.
 */
export interface RecipeItem {
  materialId: string
  /** Salinan nama untuk tampilan, supaya daftar resep tidak perlu join. */
  materialName: string
  qty: number
  unit: string
}

export interface Recipe {
  id: string
  /** Produk jadi yang dihasilkan resep ini. */
  productId: string
  productName: string
  items: RecipeItem[]
  /** Jumlah produk jadi yang dihasilkan satu kali produksi. */
  yieldQty: number
  yieldUnit: string
  note: string
  createdAt: Date
  updatedAt: Date
}

export type RecipeDraft = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>

/* --------------------------------------------------------------- produksi */

/**
 * Baris pemakaian bahan pada satu produksi yang benar benar dijalankan.
 * Berbeda dari RecipeItem, baris ini MENYIMPAN harga saat produksi terjadi,
 * dengan alasan yang sama seperti baris penjualan: HPP historis tidak boleh
 * berubah ketika harga bahan naik bulan depan.
 */
export interface ProductionItem {
  materialId: string
  materialName: string
  qty: number
  unit: string
  /** Hasil konversi ke satuan stok bahan, inilah yang dikurangkan dari stok. */
  qtyInStockUnit: number
  stockUnit: string
  /** Salinan harga modal per satuan stok saat produksi. */
  costPerStockUnit: number
  /** qtyInStockUnit dikali costPerStockUnit, dibulatkan. */
  cost: number
}

export interface Production {
  id: string
  productionNo: string
  productId: string
  productName: string
  /** Resep yang dipakai. Boleh menunjuk resep yang sudah dihapus. */
  recipeId: string
  items: ProductionItem[]
  /** Jumlah seluruh biaya bahan, yaitu HPP satu kali produksi. */
  materialCost: number
  /** Jumlah produk jadi yang benar benar dihasilkan. */
  yieldQty: number
  yieldUnit: string
  /** materialCost dibagi yieldQty, inilah HPP per pcs. */
  costPerUnit: number
  operatorId: string
  operatorName: string
  note: string
  createdAt: Date
}

/** Hasil hitungan HPP yang belum disimpan, dipakai untuk pratinjau langsung. */
export interface HppBreakdown {
  lines: {
    materialId: string
    materialName: string
    qty: number
    unit: string
    qtyInStockUnit: number
    stockUnit: string
    costPerStockUnit: number
    cost: number
    /** Bahan sudah dihapus, atau satuannya tidak bisa dikonversi. */
    problem: string
  }[]
  materialCost: number
  yieldQty: number
  costPerUnit: number
  /** True kalau ada baris bermasalah, sehingga totalnya tidak bisa dipercaya. */
  hasProblem: boolean
}

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
