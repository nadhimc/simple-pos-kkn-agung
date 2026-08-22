import type { ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import {
  ChartPieSliceIcon,
  CookingPotIcon,
  GaugeIcon,
  PackageIcon,
  ReceiptIcon,
  ShoppingCartSimpleIcon,
  StorefrontIcon,
  UsersIcon,
  WalletIcon,
} from '@phosphor-icons/react'

/**
 * SATU SUMBER KEBENARAN UNTUK NAVIGASI.
 *
 * Ada dua daftar karena ada dua dunia: orang warung melihat kasir dan
 * pembukuannya, admin platform melihat daftar warung dan penggunanya. Keduanya
 * tidak pernah bercampur dalam satu sidebar.
 *
 * Menambah halaman baru cukup tiga langkah:
 *   1. tambahkan entri di daftar yang sesuai,
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

/** Menu orang warung. */
export const tenantNavigation: NavGroup[] = [
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
        description: 'Kelola bahan baku dan barang jadi beserta harga dan stoknya.',
        icon: PackageIcon,
      },
      {
        path: '/resep',
        label: 'Resep & HPP',
        description: 'Hitung harga pokok produksi per satuan dari bahan baku, lalu catat produksinya.',
        icon: CookingPotIcon,
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

/**
 * Menu admin platform. Sengaja tidak berisi satu pun halaman pembukuan: admin
 * mengelola warung, bukan membaca isinya, dan firestore.rules menegakkan hal
 * yang sama di sisi server.
 */
export const adminNavigation: NavGroup[] = [
  {
    label: 'Platform',
    items: [
      {
        path: '/admin',
        label: 'Warung',
        description: 'Daftar warung yang memakai layanan ini.',
        icon: StorefrontIcon,
      },
      {
        path: '/admin/pengguna',
        label: 'Pengguna',
        description: 'Daftarkan dan kelola siapa yang boleh membuka tiap warung.',
        icon: UsersIcon,
      },
    ],
  },
]

export function navigationFor(isAdmin: boolean): NavGroup[] {
  return isAdmin ? adminNavigation : tenantNavigation
}

export function findNavItem(pathname: string, isAdmin: boolean): NavItem | undefined {
  return navigationFor(isAdmin)
    .flatMap((group) => group.items)
    .find((item) => item.path === pathname)
}
