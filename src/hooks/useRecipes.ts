import { useEffect, useState } from 'react'
import { useTenantId } from '@/contexts/AuthContext'
import { subscribeRecipes } from '@/services/recipes'
import { firestoreErrorMessage } from '@/lib/errors'
import type { Recipe } from '@/types'

/** Langganan real time daftar resep, dipakai halaman Resep & HPP. */
export function useRecipes() {
  const tenantId = useTenantId()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    return subscribeRecipes(
      tenantId,
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
  }, [tenantId])

  return { recipes, loading, error }
}
