import { useEffect, useMemo, useState } from 'react'
import { subscribeTenants } from '@/services/tenants'
import { subscribeUsers } from '@/services/users'
import { firestoreErrorMessage } from '@/lib/errors'
import type { AppUser, Tenant } from '@/types'

/**
 * Langganan khusus area admin. Keduanya hanya berisi identitas warung dan
 * penggunanya, tidak ada satu pun angka pembukuan: firestore.rules memang tidak
 * mengizinkan admin membacanya.
 */
export function useTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    return subscribeTenants(
      (next) => {
        setTenants(next)
        setError('')
        setLoading(false)
      },
      (caught) => {
        setError(firestoreErrorMessage(caught))
        setLoading(false)
      },
    )
  }, [])

  const tenantsById = useMemo(
    () => new Map(tenants.map((tenant) => [tenant.id, tenant])),
    [tenants],
  )

  return { tenants, tenantsById, loading, error }
}

export function useAppUsers() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    return subscribeUsers(
      (next) => {
        setUsers(next)
        setError('')
        setLoading(false)
      },
      (caught) => {
        setError(firestoreErrorMessage(caught))
        setLoading(false)
      },
    )
  }, [])

  /** Berapa orang yang bisa membuka tiap warung, dipakai daftar warung. */
  const countByTenant = useMemo(() => {
    const counts = new Map<string, number>()
    for (const user of users) {
      if (user.role === 'admin') continue
      counts.set(user.tenantId, (counts.get(user.tenantId) ?? 0) + 1)
    }
    return counts
  }, [users])

  return { users, countByTenant, loading, error }
}
