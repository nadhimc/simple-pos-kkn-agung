import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { tenantsRef } from './paths'
import type { Tenant, TenantDraft } from '@/types'

function toDate(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : new Date()
}

function mapTenant(snapshot: QueryDocumentSnapshot<DocumentData>): Tenant {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    name: data.name ?? '',
    ownerName: data.ownerName ?? '',
    phone: data.phone ?? '',
    address: data.address ?? '',
    // Dokumen lama dibuat sebelum ada penonaktifan dan tidak punya field ini.
    active: data.active !== false,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

/**
 * Dibaca orang warung untuk mengetahui nama warungnya sendiri, dan oleh admin
 * platform untuk daftar warung. Isinya hanya identitas, tidak ada angka usaha.
 */
export async function getTenant(id: string): Promise<Tenant | null> {
  const snapshot = await getDoc(doc(tenantsRef, id))
  if (!snapshot.exists()) return null
  return mapTenant(snapshot as QueryDocumentSnapshot<DocumentData>)
}

/** Hanya admin yang lolos aturan untuk membaca seluruh daftar. */
export function subscribeTenants(
  onData: (tenants: Tenant[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    tenantsRef,
    (snapshot) => {
      const list = snapshot.docs.map(mapTenant)
      list.sort((a, b) => a.name.localeCompare(b.name, 'id'))
      onData(list)
    },
    onError,
  )
}

export async function createTenant(draft: TenantDraft): Promise<string> {
  const created = await addDoc(tenantsRef, {
    ...draft,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return created.id
}

/**
 * Menutup atau membuka kembali satu unit usaha.
 *
 * Nonaktif menghentikan seluruh akses ke datanya lewat `tenantActive()` di
 * firestore.rules, tanpa menyentuh satu dokumen pun di dalamnya. Mengaktifkan
 * kembali mengembalikan semuanya seperti semula.
 */
export async function setTenantActive(id: string, active: boolean) {
  await updateDoc(doc(tenantsRef, id), { active, updatedAt: serverTimestamp() })
}

export async function updateTenant(id: string, draft: TenantDraft) {
  await updateDoc(doc(tenantsRef, id), { ...draft, updatedAt: serverTimestamp() })
}

/**
 * Menghapus dokumen unit usaha TIDAK ikut menghapus subkoleksi di bawahnya:
 * Firestore tidak mengenal penghapusan berjenjang, dan klien tidak punya cara
 * murah untuk menyapunya. Karena itu aplikasi hanya menyediakan penonaktifan,
 * dan fungsi ini cuma dipakai skrip pemeliharaan.
 */
export async function deleteTenant(id: string) {
  await deleteDoc(doc(tenantsRef, id))
}
