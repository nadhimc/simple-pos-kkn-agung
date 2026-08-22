import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Invite, UserRole } from '@/types'

/**
 * UNDANGAN BERDASARKAN NOMOR HP.
 *
 * Nomor HP tidak bisa didaftarkan sepihak oleh siapa pun: OTP-nya dikirim ke HP
 * orangnya, dengan atau tanpa backend. Undangan memindahkan OTP itu ke tempat
 * yang memang seharusnya, yaitu saat orangnya masuk sendiri. Admin cukup
 * menuliskan nomornya, dan pendaftarannya bisa dilakukan dari jarak jauh.
 *
 * Id dokumennya adalah nomor dalam format E.164, sehingga bisa dicari dengan
 * satu getDoc tanpa kueri dan tanpa indeks.
 */
export const invitesRef = collection(db, 'invites')

function mapInvite(snapshot: QueryDocumentSnapshot<DocumentData>): Invite {
  const data = snapshot.data()
  return {
    phone: snapshot.id,
    name: data.name ?? '',
    role: (data.role === 'pemilik' ? 'pemilik' : 'kasir') as Exclude<UserRole, 'admin'>,
    tenantId: data.tenantId ?? '',
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
  }
}

export async function getInvite(phoneE164: string): Promise<Invite | null> {
  const snapshot = await getDoc(doc(invitesRef, phoneE164))
  if (!snapshot.exists()) return null
  return mapInvite(snapshot as QueryDocumentSnapshot<DocumentData>)
}

/** Seluruh undangan yang belum dipakai. Hanya admin yang lolos aturannya. */
export function subscribeInvites(
  onData: (invites: Invite[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    invitesRef,
    (snapshot) => {
      const list = snapshot.docs.map(mapInvite)
      list.sort((a, b) => a.name.localeCompare(b.name, 'id'))
      onData(list)
    },
    onError,
  )
}

export async function createInvite(invite: Omit<Invite, 'createdAt'>) {
  await setDoc(doc(invitesRef, invite.phone), {
    name: invite.name.trim(),
    role: invite.role,
    tenantId: invite.tenantId,
    createdAt: serverTimestamp(),
  })
}

/**
 * Dipakai dua pihak: admin membatalkan undangan yang salah, dan orang yang
 * diundang menghapus undangannya sendiri begitu barisnya di `users` terbentuk.
 */
export async function deleteInvite(phoneE164: string) {
  await deleteDoc(doc(invitesRef, phoneE164))
}
