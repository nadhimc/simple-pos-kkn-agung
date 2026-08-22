import { useEffect, useMemo, useState } from 'react'
import { useTenantId } from '@/contexts/AuthContext'
import { subscribeSales } from '@/services/sales'
import { subscribeExpenses } from '@/services/expenses'
import { firestoreErrorMessage } from '@/lib/errors'
import { addDays, endOfDay, startOfDay } from '@/lib/format'
import type { Expense, Sale } from '@/types'

export type PeriodKey = 'hari-ini' | '7-hari' | 'bulan-ini' | '30-hari'

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: 'hari-ini', label: 'Hari ini' },
  { value: '7-hari', label: '7 hari' },
  { value: 'bulan-ini', label: 'Bulan ini' },
  { value: '30-hari', label: '30 hari' },
]

/** Rentang tanggal dari pilihan periode, selalu dalam waktu lokal perangkat. */
export function resolvePeriod(period: PeriodKey, now = new Date()) {
  switch (period) {
    case 'hari-ini':
      return { from: startOfDay(now), to: endOfDay(now) }
    case '7-hari':
      return { from: startOfDay(addDays(now, -6)), to: endOfDay(now) }
    case '30-hari':
      return { from: startOfDay(addDays(now, -29)), to: endOfDay(now) }
    case 'bulan-ini':
      return {
        from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: endOfDay(now),
      }
  }
}

interface PeriodDataResult {
  sales: Sale[]
  expenses: Expense[]
  loading: boolean
  error: string
}

/**
 * Langganan real time untuk penjualan dan beban pada satu rentang tanggal.
 * Dipakai dashboard, laporan laba rugi, dan riwayat transaksi.
 */
export function usePeriodData(from: Date, to: Date): PeriodDataResult {
  const tenantId = useTenantId()
  const [sales, setSales] = useState<Sale[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [salesLoading, setSalesLoading] = useState(true)
  const [expensesLoading, setExpensesLoading] = useState(true)
  const [error, setError] = useState('')

  // Objek Date baru setiap render akan memicu langganan ulang tanpa henti,
  // jadi efek di bawah bergantung pada nilai waktunya, bukan identitas objek.
  const fromTime = from.getTime()
  const toTime = to.getTime()

  useEffect(() => {
    setSalesLoading(true)
    return subscribeSales(
      tenantId,
      new Date(fromTime),
      new Date(toTime),
      (next) => {
        setSales(next)
        setSalesLoading(false)
      },
      (caught) => {
        setError(firestoreErrorMessage(caught))
        setSalesLoading(false)
      },
    )
  }, [tenantId, fromTime, toTime])

  useEffect(() => {
    setExpensesLoading(true)
    return subscribeExpenses(
      tenantId,
      new Date(fromTime),
      new Date(toTime),
      (next) => {
        setExpenses(next)
        setExpensesLoading(false)
      },
      (caught) => {
        setError(firestoreErrorMessage(caught))
        setExpensesLoading(false)
      },
    )
  }, [tenantId, fromTime, toTime])

  return useMemo(
    () => ({ sales, expenses, loading: salesLoading || expensesLoading, error }),
    [sales, expenses, salesLoading, expensesLoading, error],
  )
}
