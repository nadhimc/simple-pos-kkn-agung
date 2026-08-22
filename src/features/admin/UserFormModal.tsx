import { useEffect, useState, type FormEvent } from 'react'
import {
  Button,
  Modal,
  Segmented,
  SelectField,
  TextField,
  toast,
} from '@/components/ui'
import { authErrorMessage } from '@/contexts/AuthContext'
import {
  createUserWithEmail,
  registerExistingUid,
  updateAppUser,
  UserProfileWriteError,
  type NewUserDraft,
} from '@/services/users'
import { createInvite } from '@/services/invites'
import { writeErrorMessage } from '@/lib/errors'
import { formatPhone, isValidPhone, toE164 } from '@/lib/phone'
import type { AppUser, Tenant, UserRole } from '@/types'

type Mode = 'hp' | 'email' | 'uid'

interface UserFormModalProps {
  open: boolean
  onClose: () => void
  /** Null berarti mendaftarkan orang baru. */
  user: AppUser | null
  tenants: Tenant[]
  /** Unit usaha yang dipilih lebih dulu, dipakai saat menambah dari daftarnya. */
  defaultTenantId?: string
}

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'hp', label: 'Nomor HP' },
  { value: 'email', label: 'Email' },
  { value: 'uid', label: 'UID' },
]

const ROLE_OPTIONS = [
  { value: 'pemilik', label: 'Pemilik unit usaha' },
  { value: 'kasir', label: 'Kasir' },
  { value: 'admin', label: 'Admin platform' },
]

export function UserFormModal({
  open,
  onClose,
  user,
  tenants,
  defaultTenantId,
}: UserFormModalProps) {
  const [mode, setMode] = useState<Mode>('hp')
  const [name, setName] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [role, setRole] = useState<UserRole>('pemilik')
  const [active, setActive] = useState(true)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [uid, setUid] = useState('')

  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode('hp')
    setError('')
    setSaving(false)
    setPassword('')
    setUid('')
    setName(user?.name ?? '')
    /*
      Unit usaha TIDAK dipilihkan otomatis saat ada lebih dari satu.

      Sebelumnya form ini memakai unit pertama menurut abjad sebagai bawaan, dan
      itu berarti admin yang tidak memperhatikan dropdown akan memasukkan orang
      ke unit usaha yang salah tanpa satu pun tanda. Salah tempat seperti itu
      baru ketahuan setelah orangnya membuka pembukuan yang bukan miliknya.

      Kalau unitnya cuma satu, atau formnya dibuka dari baris unit tertentu di
      halaman Unit Usaha, tidak ada yang ambigu jadi boleh dipilihkan.
    */
    setTenantId(
      user?.tenantId ?? defaultTenantId ?? (tenants.length === 1 ? tenants[0].id : ''),
    )
    setRole(user?.role ?? 'pemilik')
    setActive(user?.active ?? true)
    setEmail(user?.email ?? '')
    setPhone(user?.phone ?? '')
  }, [open, user, defaultTenantId, tenants])

  // Admin platform mengelola unit usaha, bukan menjalankannya, jadi barisnya
  // wajib tidak terikat unit usaha mana pun. Security Rules menolak baris admin
  // yang punya tenantId, dan sebaliknya.
  const isAdminRole = role === 'admin'

  function draftOf(): NewUserDraft {
    return {
      name: name.trim(),
      role,
      tenantId: isAdminRole ? '' : tenantId,
      email: mode === 'email' ? email.trim() : '',
      phone: mode === 'hp' ? toE164(phone) : '',
    }
  }

  function validate() {
    if (!name.trim()) return 'Nama wajib diisi.'
    if (!isAdminRole && !tenantId) return 'Pilih unit usaha dulu.'
    // Undangan nomor HP membuat barisnya sendiri saat orangnya masuk, dan jalur
    // itu sengaja tidak boleh menghasilkan admin. Ditolak di sini juga supaya
    // perannya tidak diam diam diturunkan tanpa admin menyadarinya.
    if (mode === 'hp' && isAdminRole) {
      return 'Admin tidak bisa diundang lewat nomor HP. Pakai email atau UID.'
    }
    if (mode === 'email' && !email.trim()) return 'Email wajib diisi.'
    if (mode === 'email' && password.length < 6)
      return 'Kata sandi minimal enam karakter.'
    if (mode === 'hp' && !isValidPhone(toE164(phone)))
      return 'Nomor HP tidak valid. Tulis seperti 0851 5665 7853.'
    if (mode === 'uid' && !uid.trim()) return 'UID wajib diisi.'
    return ''
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')

    if (user) {
      setSaving(true)
      try {
        await updateAppUser(user.uid, {
          name: name.trim(),
          role,
          tenantId: isAdminRole ? '' : tenantId,
          active,
        })
        toast.success(`${name.trim()} diperbarui.`)
        onClose()
      } catch (caught) {
        toast.error(writeErrorMessage(caught))
      } finally {
        setSaving(false)
      }
      return
    }

    const invalid = validate()
    if (invalid) {
      setError(invalid)
      return
    }

    setSaving(true)
    try {
      if (mode === 'email') {
        await createUserWithEmail(draftOf(), password)
        toast.success(`${name.trim()} didaftarkan.`)
      } else if (mode === 'uid') {
        await registerExistingUid(uid, { ...draftOf(), email: email.trim() })
        toast.success(`${name.trim()} didaftarkan.`)
      } else {
        // Nomor HP tidak bisa didaftarkan sepihak, jadi yang disimpan adalah
        // undangannya. Barisnya lahir sendiri saat orangnya masuk.
        await createInvite({
          phone: toE164(phone),
          name: name.trim(),
          // validate() sudah menolak peran admin untuk jalur ini.
          role: role === 'pemilik' ? 'pemilik' : 'kasir',
          tenantId,
        })
        toast.success(
          `Undangan untuk ${formatPhone(toE164(phone))} disimpan. ${name.trim()} tinggal masuk pakai nomor itu.`,
        )
      }

      onClose()
    } catch (caught) {
      // Akun Auth-nya sudah jadi tapi barisnya gagal ditulis. Menyembunyikan ini
      // akan meninggalkan akun yang tidak bisa dipakai dan emailnya terlanjur
      // terpakai, jadi UID-nya langsung disodorkan lewat mode UID.
      if (caught instanceof UserProfileWriteError) {
        setUid(caught.uid)
        setMode('uid')
        setError(
          `Akunnya sudah dibuat, tetapi pendaftarannya gagal. UID sudah diisikan, tekan Daftarkan sekali lagi. (${writeErrorMessage(caught.reason)})`,
        )
      } else {
        setError(authErrorMessage(caught) || writeErrorMessage(caught))
      }
      setSaving(false)
    }
  }

  const tenantOptions = [
    // Pilihan kosong hanya ditawarkan kalau memang belum ada yang dipilih,
    // supaya tidak ada cara mengosongkannya kembali secara tidak sengaja.
    ...(tenantId ? [] : [{ value: '', label: 'Pilih unit usaha' }]),
    ...tenants.map((tenant) => ({ value: tenant.id, label: tenant.name })),
  ]

  const submitLabel = user
    ? 'Simpan perubahan'
    : mode === 'hp'
      ? 'Simpan undangan'
      : 'Daftarkan'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user ? 'Ubah pengguna' : 'Daftarkan pengguna'}
      description={
        user
          ? 'Email dan nomor HP tidak bisa diubah, karena itu identitas akunnya di Firebase.'
          : 'Tidak ada pendaftaran mandiri. Semua berawal dari sini, termasuk undangan nomor HP.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button type="submit" form="user-form" loading={saving}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {!user ? (
          <div>
            <p className="pb-2 text-sm font-medium text-ink">Cara masuk</p>
            <Segmented
              aria-label="Cara masuk"
              value={mode}
              onChange={(next: Mode) => {
                setError('')
                setMode(next)
              }}
              options={MODE_OPTIONS}
            />
            <p className="pt-2 text-xs text-ink-muted">
              {mode === 'hp'
                ? 'Paling mudah, dan tidak perlu OTP di sini. Cukup tulis nomornya; orangnya masuk sendiri kapan saja dari HP-nya.'
                : mode === 'email'
                  ? 'Akun dan kata sandinya dibuat di sini, lalu diberikan ke orangnya.'
                  : 'Untuk akun yang sudah pernah masuk, misalnya lewat Google. UID-nya ditampilkan halaman masuk saat ditolak.'}
            </p>
          </div>
        ) : null}

        <TextField
          label="Nama"
          required
          autoFocus
          helper="Nama ini yang tercatat di struk sebagai kasir."
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Peran"
            value={role}
            options={ROLE_OPTIONS}
            helper={
              isAdminRole
                ? 'Mengelola unit usaha dan pengguna, tanpa akses ke pembukuannya.'
                : 'Pemilik dan kasir belum dibedakan haknya, ini baru keterangan.'
            }
            onChange={(event) => setRole(event.target.value as UserRole)}
          />
          {!isAdminRole ? (
            <SelectField
              label="Unit usaha"
              value={tenantId}
              options={tenantOptions}
              helper="Satu akun hanya bisa membuka satu unit usaha."
              onChange={(event) => setTenantId(event.target.value)}
            />
          ) : null}
        </div>

        {isAdminRole ? (
          <p className="rounded-control border border-border bg-surface-2 px-4 py-3 text-xs text-ink-muted">
            Admin platform tidak terikat unit usaha mana pun, dan sengaja tidak bisa
            membaca pembukuan unit usaha mana pun. Yang bisa dilihatnya hanya daftar
            unit usaha, penggunanya, dan ringkasan angkanya.
          </p>
        ) : null}

        {user ? (
          <SelectField
            label="Status"
            value={active ? 'aktif' : 'nonaktif'}
            options={[
              { value: 'aktif', label: 'Aktif' },
              { value: 'nonaktif', label: 'Nonaktif, tidak bisa masuk' },
            ]}
            helper="Menonaktifkan mencabut aksesnya tanpa menghapus riwayatnya."
            onChange={(event) => setActive(event.target.value === 'aktif')}
          />
        ) : null}

        {!user && mode === 'hp' ? (
          <TextField
            label="Nomor HP"
            type="tel"
            inputMode="tel"
            placeholder="0851 5665 7853"
            required
            value={phone}
            helper={
              isValidPhone(toE164(phone))
                ? `Disimpan sebagai ${toE164(phone)}`
                : 'Boleh ditulis 0851…, 851…, atau +62851…. Semuanya diperlakukan sama.'
            }
            onChange={(event) => setPhone(event.target.value)}
          />
        ) : null}

        {!user && mode === 'email' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Email"
              type="email"
              inputMode="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <TextField
              label="Kata sandi"
              type="password"
              required
              helper="Minimal enam karakter. Berikan ke orangnya."
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        ) : null}

        {!user && mode === 'uid' ? (
          <>
            <TextField
              label="UID"
              required
              helper="Salin dari pesan penolakan di halaman masuk."
              value={uid}
              onChange={(event) => setUid(event.target.value)}
            />
            <TextField
              label="Email atau nomor HP"
              helper="Opsional, hanya untuk ditampilkan di daftar."
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </>
        ) : null}

        {error ? (
          <p className="rounded-control border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  )
}
