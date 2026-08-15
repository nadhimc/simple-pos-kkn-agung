import type { ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import {
  ChartPieSliceIcon,
  GaugeIcon,
  PackageIcon,
  ReceiptIcon,
  ShoppingCartSimpleIcon,
  WalletIcon,
} from '@phosphor-icons/react'

/**
 * SATU SUMBER KEBENARAN UNTUK NAVIGASI.
 *
 * Menambah halaman baru cukup tiga langkah:
 *   1. tambahkan entri di sini,
 *   2. daftarkan <Route> dengan `path` yang sama di src/App.tsx,
 *   3. buat komponen halamannya di src/pages.
 *
 * Sidebar, judul header, dan tag <title> browser semuanya ikut otomatis.
 * Jangan menulis daftar menu di tempat lain.
 */

export interface NavItem {
  /** Harus persis sama dengan `path` di router. */
  path: string
  label: string
  /** Dipakai sebagai deskripsi di bawah judul halaman. */
  description: string
  icon: ComponentType<IconProps>
  /**
   * Halaman mengelola tinggi dan scroll-nya sendiri (dipakai layar kasir).
   * Shell tidak menambahkan padding maupun pembatas lebar.
   */
  fullBleed?: boolean
}

export interface NavGroup {
  /** Label kelompok di sidebar. Kosongkan untuk kelompok tanpa judul. */
  label: string
  items: NavItem[]
}

export const navigation: NavGroup[] = [
  {
    label: 'Operasional',
    items: [
      {
        path: '/',
        label: 'Dashboard',
        description: 'Ringkasan penjualan, laba, dan stok hari ini.',
        icon: GaugeIcon,
      },
      {
        path: '/kasir',
        label: 'Kasir',
        description: 'Catat penjualan dan cetak struk.',
        icon: ShoppingCartSimpleIcon,
        fullBleed: true,
      },
    ],
  },
  {
    label: 'Inventaris',
    items: [
      {
        path: '/produk',
        label: 'Produk & Stok',
        description: 'Kelola daftar barang, harga modal, harga jual, dan stok.',
        icon: PackageIcon,
      },
    ],
  },
  {
    label: 'Keuangan',
    items: [
      {
        path: '/transaksi',
        label: 'Transaksi',
        description: 'Riwayat penjualan beserta rincian tiap struk.',
        icon: ReceiptIcon,
      },
      {
        path: '/beban',
        label: 'Beban Operasional',
        description: 'Catat pengeluaran rutin di luar harga modal barang.',
        icon: WalletIcon,
      },
      {
        path: '/laporan',
        label: 'Laba Rugi',
        description: 'Omzet, HPP, laba kotor, beban, dan laba bersih per periode.',
        icon: ChartPieSliceIcon,
      },
    ],
  },
]

export const navItems: NavItem[] = navigation.flatMap((group) => group.items)

export function findNavItem(pathname: string): NavItem | undefined {
  return navItems.find((item) => item.path === pathname)
}
