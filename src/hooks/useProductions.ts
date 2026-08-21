import { useEffect, useState } from 'react'
import { subscribeProductions } from '@/services/productions'
import { firestoreErrorMessage } from '@/lib/errors'
import type { Production } from '@/types'

/** Riwayat produksi pada satu rentang tanggal. */
export function useProductions(from: Date, to: Date) {
  const [productions, setProductions] = useState<Production[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Bergantung pada nilai waktunya, bukan identitas objek Date, supaya
  // langganan tidak dibuat ulang setiap render.
  const fromTime = from.getTime()
  const toTime = to.getTime()

  useEffect(() => {
    setLoading(true)
    return subscribeProductions(
      new Date(fromTime),
      new Date(toTime),
      (next) => {
        setProductions(next)
        setError('')
        setLoading(false)
      },
      (caught) => {
        setError(firestoreErrorMessage(caught))
        setLoading(false)
      },
    )
  }, [fromTime, toTime])

  return { productions, loading, error }
}
