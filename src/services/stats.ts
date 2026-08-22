import {
  collection,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
  type WriteBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { TenantStats } from '@/types'

/**
 * RINGKASAN PER UNIT USAHA.
 *
 * Admin platform sengaja tidak diberi akses ke subkoleksi unit usaha mana pun,
 * jadi ia tidak bisa menjumlahkan struk sendiri. Ringkasan ini yang menjembatani:
 * unit usahanya sendiri yang menambahkannya, dalam batch yang sama dengan
 * transaksinya, dan admin hanya membaca.
 *
 * Konsekuensinya jujur: angka di sini persis sepercaya data yang mendasarinya,
 * tidak lebih. Unit usaha memang sudah memegang penuh catatan penjualannya
 * sendiri, jadi ini tidak menambah kepercayaan baru yang harus diberikan.
 *
 * Ditulis dengan `increment` supaya dua perangkat yang menjual bersamaan tetap
 * menghasilkan total yang benar, dan supaya ikut mengantre di cache lokal saat
 * warung sedang offline, sama seperti transaksinya.
 */
// Koleksi di akar, bukan di bawah tenant, supaya admin bisa membacanya
// sekaligus tanpa menyentuh isi unit usaha mana pun.
export const tenantStatsRef = collection(db, 'tenantStats')

export function statsRef(tenantId: string) {
  return doc(tenantStatsRef, tenantId)
}

/** "2026-08". Memakai waktu lokal, sama seperti seluruh pengelompokan periode. */
export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function mapTenantStats(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): TenantStats {
  const data = snapshot.data()
  const months: TenantStats['months'] = {}

  for (const [key, value] of Object.entries(data.months ?? {})) {
    const entry = value as Record<string, unknown>
    months[key] = {
      revenue: Number(entry.revenue ?? 0),
      grossProfit: Number(entry.grossProfit ?? 0),
      expenseTotal: Number(entry.expenseTotal ?? 0),
      salesCount: Number(entry.salesCount ?? 0),
    }
  }

  return {
    tenantId: snapshot.id,
    salesCount: data.salesCount ?? 0,
    revenue: data.revenue ?? 0,
    grossProfit: data.grossProfit ?? 0,
    expenseTotal: data.expenseTotal ?? 0,
    productionCount: data.productionCount ?? 0,
    lastSaleAt: data.lastSaleAt instanceof Timestamp ? data.lastSaleAt.toDate() : null,
    months,
  }
}

export function subscribeTenantStats(
  onData: (stats: Map<string, TenantStats>) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    tenantStatsRef,
    (snapshot) => onData(new Map(snapshot.docs.map((d) => [d.id, mapTenantStats(d)]))),
    onError,
  )
}

export interface StatsDelta {
  /** Menentukan bulan mana yang ditambah. Tanggal transaksinya, bukan hari ini. */
  at: Date
  salesCount?: number
  revenue?: number
  grossProfit?: number
  expenseTotal?: number
  productionCount?: number
  /** Diisi hanya saat penjualan baru, untuk menandai unit usaha yang masih hidup. */
  markLastSale?: boolean
}

/**
 * Menambahkan perubahan ringkasan ke batch yang sudah ada.
 *
 * Selalu ikut batch transaksinya, tidak pernah ditulis terpisah: kalau
 * transaksinya gagal, ringkasannya pun tidak boleh berubah.
 *
 * Menerima daftar, bukan satu, karena satu aksi bisa menyentuh dua bulan
 * sekaligus: mengubah tanggal sebuah beban mengurangi bulan lama dan menambah
 * bulan baru. Keduanya harus jadi SATU tulisan ke dokumen yang sama, sebab dua
 * `set` ke dokumen yang sama dalam satu batch bukan sesuatu yang layak
 * diandalkan.
 */
export function addStatsToBatch(
  batch: WriteBatch,
  tenantId: string,
  deltas: StatsDelta[],
) {
  const lifetimeTotals: Record<string, number> = {}
  const monthTotals: Record<string, Record<string, number>> = {}
  let markLastSale = false

  const monthly = ['salesCount', 'revenue', 'grossProfit', 'expenseTotal'] as const

  for (const delta of deltas) {
    const key = monthKey(delta.at)

    for (const field of monthly) {
      const value = delta[field]
      if (!value) continue
      lifetimeTotals[field] = (lifetimeTotals[field] ?? 0) + value
      monthTotals[key] ??= {}
      monthTotals[key][field] = (monthTotals[key][field] ?? 0) + value
    }

    // Produksi bukan angka bulanan: ia penanda kegiatan, bukan uang masuk.
    if (delta.productionCount) {
      lifetimeTotals.productionCount =
        (lifetimeTotals.productionCount ?? 0) + delta.productionCount
    }

    if (delta.markLastSale) markLastSale = true
  }

  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() }

  for (const [field, value] of Object.entries(lifetimeTotals)) {
    // Nol dilewati supaya tidak ada tulisan yang tidak mengubah apa apa.
    if (value !== 0) payload[field] = increment(value)
  }

  const months: Record<string, Record<string, unknown>> = {}
  for (const [key, totals] of Object.entries(monthTotals)) {
    const entry: Record<string, unknown> = {}
    for (const [field, value] of Object.entries(totals)) {
      if (value !== 0) entry[field] = increment(value)
    }
    if (Object.keys(entry).length > 0) months[key] = entry
  }

  if (Object.keys(months).length > 0) payload.months = months
  if (markLastSale) payload.lastSaleAt = serverTimestamp()

  batch.set(statsRef(tenantId), payload, { merge: true })
}
