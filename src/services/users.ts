import { getApps, initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { app } from '@/lib/firebase'
import { usersRef } from './paths'
import { deleteInvite, getInvite } from './invites'
import type { AppUser, UserRole } from '@/types'

function mapUser(snapshot: QueryDocumentSnapshot<DocumentData>): AppUser {
  const data = snapshot.data()
  const role = data.role
  return {
    uid: snapshot.id,
    name: data.name ?? '',
    email: data.email ?? '',
    phone: data.phone ?? '',
    role: (role === 'admin' || role === 'pemilik' ? role : 'kasir') as UserRole,
    tenantId: data.tenantId ?? '',
    // Dokumen tanpa field ini dianggap aktif, supaya akun lama tidak mendadak
    // terkunci hanya karena fieldnya belum ada.
    active: data.active !== false,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
  }
}

/**
 * DAFTAR PENGGUNA ADALAH GERBANG AKSES.
 *
 * Login hanya membuktikan siapa orangnya. Yang menentukan dia boleh masuk, dan
 * masuk ke warung yang mana, adalah dokumen `users/{uid}`. firestore.rules
 * membaca dokumen yang sama di sisi server, jadi pemeriksaan di klien murni
 * untuk pengalaman pengguna dan bukan lapisan keamanan.
 */
export async function getAppUser(uid: string): Promise<AppUser | null> {
  const snapshot = await getDoc(doc(usersRef, uid))
  if (!snapshot.exists()) return null
  return mapUser(snapshot as QueryDocumentSnapshot<DocumentData>)
}

/** Seluruh pengguna lintas warung. Hanya admin yang lolos aturannya. */
export function subscribeUsers(
  onData: (users: AppUser[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    usersRef,
    (snapshot) => {
      const list = snapshot.docs.map(mapUser)
      // Diurutkan di sini, bukan lewat orderBy('name'). Firestore melewatkan
      // dokumen yang tidak punya field yang diurutkan, dan orang yang punya
      // akses tapi tidak muncul di daftar adalah hal terakhir yang boleh
      // terjadi di halaman ini.
      list.sort((a, b) => a.name.localeCompare(b.name, 'id'))
      onData(list)
    },
    onError,
  )
}

export interface NewUserDraft {
  name: string
  role: UserRole
  /** Wajib untuk orang warung, dan wajib kosong untuk admin platform. */
  tenantId: string
  email: string
  phone: string
}

/* ------------------------------------------------------ instance pendaftar */

const REGISTRAR_APP = 'user-registrar'

/**
 * MEMBUAT AKUN TANPA KEHILANGAN SESI SENDIRI.
 *
 * `createUserWithEmailAndPassword` dan `confirmationResult.confirm` sama sama
 * ikut me-login akun yang baru dibuat. Dijalankan di instance Firebase utama,
 * admin yang sedang mendaftarkan pemilik warung akan langsung terlempar keluar
 * dan berganti menjadi orang itu, di tengah halaman yang sedang dibukanya.
 *
 * Instance kedua ini punya sesinya sendiri, dan sesinya sengaja tidak disimpan
 * ke browser (`inMemoryPersistence`) sehingga tidak ada sesi menggantung milik
 * orang lain di perangkat admin. Sesi di instance utama tidak tersentuh.
 */
async function registrarAuth() {
  const existing = getApps().find((item) => item.name === REGISTRAR_APP)
  const registrar = existing ?? initializeApp(app.options, REGISTRAR_APP)
  const instance = getAuth(registrar)
  await setPersistence(instance, inMemoryPersistence)
  return instance
}

/**
 * Akun Auth-nya sudah terbentuk tetapi dokumen penggunanya gagal ditulis.
 *
 * Keadaan setengah jadi ini tidak boleh disembunyikan: orangnya belum bisa
 * masuk, dan mendaftarkan ulang email atau nomor yang sama akan ditolak
 * Firebase karena sudah terpakai. UID-nya dibawa serta supaya bisa langsung
 * didaftarkan lewat mode UID tanpa membuat akun baru.
 */
export class UserProfileWriteError extends Error {
  readonly uid: string
  readonly reason: unknown

  constructor(uid: string, reason: unknown) {
    super('Akun berhasil dibuat, tetapi pendaftarannya sebagai pengguna gagal.')
    this.name = 'UserProfileWriteError'
    this.uid = uid
    this.reason = reason
  }
}

async function finishRegistration(user: User, draft: NewUserDraft) {
  try {
    // displayName diisi supaya namanya tetap benar seandainya orang ini masuk
    // sebelum dokumen penggunanya sempat terbaca.
    await updateProfile(user, { displayName: draft.name })
    await writeUserDoc(user.uid, draft)
  } catch (caught) {
    throw new UserProfileWriteError(user.uid, caught)
  }
  return user.uid
}

async function writeUserDoc(uid: string, draft: NewUserDraft) {
  await setDoc(doc(usersRef, uid), {
    name: draft.name.trim(),
    email: draft.email.trim(),
    phone: draft.phone.trim(),
    role: draft.role,
    tenantId: draft.tenantId,
    active: true,
    createdAt: serverTimestamp(),
  })
}

/* --------------------------------------------------------- pendaftaran email */

export async function createUserWithEmail(draft: NewUserDraft, password: string) {
  const registrar = await registrarAuth()
  const credential = await createUserWithEmailAndPassword(
    registrar,
    draft.email.trim(),
    password,
  )
  try {
    return await finishRegistration(credential.user, draft)
  } finally {
    await signOut(registrar)
  }
}

/* -------------------------------------------------------- menerima undangan */

/**
 * Membuat baris pengguna untuk orang yang baru saja masuk lewat nomor HP dan
 * ternyata punya undangan.
 *
 * Ini satu satunya tempat seseorang menulis barisnya sendiri, dan yang
 * menahannya bukan kode ini melainkan firestore.rules: undangannya harus ada
 * untuk nomor yang tercantum di tokennya, dan peran serta unit usahanya dibaca
 * dari undangan itu di sisi server. Mengubah nilai di sini tidak akan lolos.
 *
 * Undangannya dihapus sesudahnya. Kalau penghapusan itu gagal, barisnya sudah
 * terlanjur ada dan orangnya tetap bisa masuk; undangan yang tertinggal cuma
 * membuat admin melihat satu baris "menunggu" yang bisa dibatalkan manual.
 */
export async function claimInvite(user: User): Promise<AppUser | null> {
  const phone = user.phoneNumber
  if (!phone) return null

  const invite = await getInvite(phone)
  if (!invite) return null

  await writeUserDoc(user.uid, {
    name: invite.name,
    role: invite.role,
    tenantId: invite.tenantId,
    email: '',
    phone,
  })

  await deleteInvite(phone).catch(() => {
    // Bukan alasan untuk menggagalkan proses masuknya.
  })

  return getAppUser(user.uid)
}

/* ------------------------------------------------------------ akun yang ada */

/**
 * Mendaftarkan akun yang sudah terlanjur ada di Firebase Auth, lewat UID-nya.
 *
 * Dipakai untuk dua hal: orang yang masuk lewat Google (akunnya tidak bisa
 * dibuatkan dari sini, dan UID-nya baru ada setelah dia sign-in sekali), dan
 * memperbaiki akun setengah jadi yang gagal di langkah kedua. Halaman masuk
 * menampilkan UID itu saat menolaknya.
 */
export async function registerExistingUid(uid: string, draft: NewUserDraft) {
  await writeUserDoc(uid.trim(), draft)
}

/* --------------------------------------------------------------- perubahan */

/** Email dan nomor HP tidak ikut diubah: itu identitas akun di Firebase Auth. */
export async function updateAppUser(
  uid: string,
  changes: { name: string; role: UserRole; tenantId: string; active: boolean },
) {
  await updateDoc(doc(usersRef, uid), {
    name: changes.name.trim(),
    role: changes.role,
    tenantId: changes.tenantId,
    active: changes.active,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Mencabut akses secara permanen. Akun Firebase Auth-nya sengaja tidak ikut
 * dihapus, karena klien tidak bisa menghapus akun orang lain tanpa Admin SDK.
 * Tanpa dokumen pengguna, akun itu tetap bisa login tetapi tidak bisa membaca
 * data apa pun.
 *
 * Untuk pencabutan sementara, pakai `active: false` lewat updateAppUser: nama
 * pemiliknya tetap punya rujukan, dan aksesnya bisa dikembalikan.
 */
export async function deleteAppUser(uid: string) {
  await deleteDoc(doc(usersRef, uid))
}
