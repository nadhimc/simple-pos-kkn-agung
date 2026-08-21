import { useEffect, useMemo, useState } from 'react'
import { subscribeProducts } from '@/services/products'
import { firestoreErrorMessage } from '@/lib/errors'
import type { Product } from '@/types'

interface UseProductsResult {
  products: Product[]
  /** Bahan baku saja. Dipakai pemilih bahan di resep. */
  materials: Product[]
  /** Barang jadi saja. Dipakai layar kasir dan pemilih hasil produksi. */
  finished: Product[]
  /** Peta id ke produk, dipakai perhitungan HPP dan pemeriksaan stok. */
  productsById: Map<string, Product>
  categories: string[]
  loading: boolean
  error: string
}

/** Satu langganan real time ke koleksi produk, dipakai kasir dan halaman stok. */
export function useProducts(): UseProductsResult {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    return subscribeProducts(
      (next) => {
        setProducts(next)
        setError('')
        setLoading(false)
      },
      (caught) => {
        setError(firestoreErrorMessage(caught))
        setLoading(false)
      },
    )
  }, [])

  const categories = useMemo(() => {
    const unique = new Set(products.map((product) => product.category).filter(Boolean))
    return [...unique].sort((a, b) => a.localeCompare(b, 'id'))
  }, [products])

  const materials = useMemo(
    () => products.filter((product) => product.type === 'bahan'),
    [products],
  )

  const finished = useMemo(
    () => products.filter((product) => product.type === 'jadi'),
    [products],
  )

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  )

  return { products, materials, finished, productsById, categories, loading, error }
}
