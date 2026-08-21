import { useEffect, useState } from 'react'
import { subscribeRecipes } from '@/services/recipes'
import { firestoreErrorMessage } from '@/lib/errors'
import type { Recipe } from '@/types'

/** Langganan real time daftar resep, dipakai halaman Resep & HPP. */
export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    return subscribeRecipes(
      (next) => {
        setRecipes(next)
        setError('')
        setLoading(false)
      },
      (caught) => {
        setError(firestoreErrorMessage(caught))
        setLoading(false)
      },
    )
  }, [])

  return { recipes, loading, error }
}
