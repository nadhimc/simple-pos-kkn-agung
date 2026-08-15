import { useEffect, useMemo, useState } from 'react'
import { subscribeProducts } from '@/services/products'
import { firestoreErrorMessage } from '@/lib/errors'
import type { Product } from '@/types'

interface UseProductsResult {
  products: Product[]
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

  return { products, categories, loading, error }
}
