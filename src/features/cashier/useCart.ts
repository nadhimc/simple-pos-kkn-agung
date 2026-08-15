import { create } from 'zustand'
import type { Product, SaleItem } from '@/types'

interface CartState {
  items: SaleItem[]
  discount: number
  note: string
  /** Tambah satu unit, atau naikkan qty jika produk sudah ada di keranjang. */
  addItem: (product: Product) => void
  setQty: (productId: string, qty: number) => void
  removeItem: (productId: string) => void
  setDiscount: (discount: number) => void
  setNote: (note: string) => void
  clear: () => void
}

function lineOf(product: Product, qty: number): SaleItem {
  return {
    productId: product.id,
    name: product.name,
    unit: product.unit,
    qty,
    // Harga jual dan harga modal disalin saat masuk keranjang supaya perubahan
    // harga di halaman produk tidak mengubah struk yang sedang dikerjakan.
    sellPrice: product.sellPrice,
    costPrice: product.costPrice,
    subtotal: qty * product.sellPrice,
  }
}

export const useCart = create<CartState>((set) => ({
  items: [],
  discount: 0,
  note: '',

  addItem: (product) =>
    set((state) => {
      const existing = state.items.find((item) => item.productId === product.id)
      if (!existing) return { items: [...state.items, lineOf(product, 1)] }

      return {
        items: state.items.map((item) =>
          item.productId === product.id
            ? { ...item, qty: item.qty + 1, subtotal: (item.qty + 1) * item.sellPrice }
            : item,
        ),
      }
    }),

  setQty: (productId, qty) =>
    set((state) => ({
      items:
        qty <= 0
          ? state.items.filter((item) => item.productId !== productId)
          : state.items.map((item) =>
              item.productId === productId
                ? { ...item, qty, subtotal: qty * item.sellPrice }
                : item,
            ),
    })),

  removeItem: (productId) =>
    set((state) => ({
      items: state.items.filter((item) => item.productId !== productId),
    })),

  setDiscount: (discount) => set({ discount: Math.max(discount, 0) }),
  setNote: (note) => set({ note }),
  clear: () => set({ items: [], discount: 0, note: '' }),
}))

export function cartSubtotal(items: SaleItem[]) {
  return items.reduce((total, item) => total + item.subtotal, 0)
}

export function cartCost(items: SaleItem[]) {
  return items.reduce((total, item) => total + item.costPrice * item.qty, 0)
}
