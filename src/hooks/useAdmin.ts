import { useEffect, useMemo, useState } from 'react'
import { subscribeTenants } from '@/services/tenants'
import { subscribeUsers } from '@/services/users'
import { subscribeTenantStats } from '@/services/stats'
import { subscribeInvites } from '@/services/invites'
import { firestoreErrorMessage } from '@/lib/errors'
import type { AppUser, Invite, Tenant, TenantStats } from '@/types'

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

/**
 * Ringkasan angka tiap unit usaha. Dijaga oleh unit usahanya sendiri dan hanya
 * dibaca di sini, karena admin memang tidak boleh membaca struknya langsung.
 */
export function useTenantStats() {
  const [stats, setStats] = useState<Map<string, TenantStats>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    return subscribeTenantStats(
      (next) => {
        setStats(next)
        setError('')
        setLoading(false)
      },
      (caught) => {
        setError(firestoreErrorMessage(caught))
        setLoading(false)
      },
    )
  }, [])

  return { stats, loading, error }
}

/**
 * Undangan yang belum dipakai, yaitu orang yang sudah didaftarkan tapi belum
 * pernah masuk. Perlu terlihat: tanpanya, admin tidak punya cara tahu bahwa
 * seseorang belum juga menyentuh aplikasinya.
 */
export function useInvites() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    return subscribeInvites(
      (next) => {
        setInvites(next)
        setError('')
        setLoading(false)
      },
      (caught) => {
        setError(firestoreErrorMessage(caught))
        setLoading(false)
      },
    )
  }, [])

  return { invites, loading, error }
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
