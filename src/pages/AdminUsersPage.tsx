import { useMemo, useState } from 'react'
import {
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
} from '@phosphor-icons/react'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  TableSkeleton,
  toast,
} from '@/components/ui'
import { UserFormModal } from '@/features/admin/UserFormModal'
import { useAppUsers, useInvites, useTenants } from '@/hooks/useAdmin'
import { useAuth } from '@/contexts/AuthContext'
import { deleteAppUser } from '@/services/users'
import { deleteInvite } from '@/services/invites'
import { writeErrorMessage } from '@/lib/errors'
import { formatPhone } from '@/lib/phone'
import type { AppUser, Invite } from '@/types'

/**
 * Siapa saja yang boleh membuka sistem ini, dan unit usaha yang mana.
 *
 * Daftar ini adalah gerbang aksesnya: login hanya membuktikan siapa orangnya,
 * baris di sinilah yang menentukan dia boleh masuk. firestore.rules memeriksa
 * dokumen yang sama di sisi server.
 */
export default function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const { tenants, tenantsById, loading: tenantsLoading } = useTenants()
  const { users, loading, error } = useAppUsers()
  const { invites } = useInvites()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<Invite | null>(null)
  const [cancelling, setCancelling] = useState(false)

  async function handleCancelInvite() {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      await deleteInvite(cancelTarget.phone)
      toast.success(`Undangan untuk ${cancelTarget.name} dibatalkan.`)
      setCancelTarget(null)
    } catch (caught) {
      toast.error(writeErrorMessage(caught))
    } finally {
      setCancelling(false)
    }
  }

  // Admin platform ditampilkan terpisah di bawah: mereka tidak punya unit
  // usaha, dan mencampurnya ke daftar berkolom "Unit usaha" cuma membingungkan.
  const { staff, admins } = useMemo(
    () => ({
      staff: users.filter((item) => item.role !== 'admin'),
      admins: users.filter((item) => item.role === 'admin'),
    }),
    [users],
  )

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteAppUser(deleteTarget.uid)
      toast.success(`Akses ${deleteTarget.name} dicabut.`)
      setDeleteTarget(null)
    } catch (caught) {
      toast.error(writeErrorMessage(caught))
    } finally {
      setDeleting(false)
    }
  }

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pengguna"
        description="Login hanya membuktikan siapa orangnya. Baris di daftar inilah yang menentukan dia boleh masuk, dan ke unit usaha mana."
        actions={
          <Button icon={<PlusIcon size={17} weight="bold" />} onClick={openNew}>
            Daftarkan pengguna
          </Button>
        }
      />

      {error ? <ErrorState message={error} /> : null}

      {!tenantsLoading && tenants.length === 0 ? (
        <ErrorState
          title="Belum ada unit usaha"
          message="Pemilik dan kasir selalu terikat pada satu unit usaha, jadi tambahkan unit usahanya dulu di halaman Unit Usaha. Admin platform tetap bisa didaftarkan sekarang."
        />
      ) : null}

      <Card>
        {loading ? (
          <TableSkeleton rows={5} columns={4} />
        ) : staff.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="Belum ada pengguna unit usaha"
            description="Daftarkan pemilik unit usaha supaya dia bisa membuka kasirnya sendiri."
            action={
              <Button icon={<PlusIcon size={17} weight="bold" />} onClick={openNew}>
                Daftarkan pengguna
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-muted">
                  <th className="px-5 py-3 font-medium">Nama</th>
                  <th className="px-5 py-3 font-medium">Masuk lewat</th>
                  <th className="px-5 py-3 font-medium">Unit usaha</th>
                  <th className="px-5 py-3 font-medium">Peran</th>
                  <th className="px-5 py-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {staff.map((item) => (
                  <tr key={item.uid} className="transition-colors hover:bg-surface-2">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{item.name}</span>
                        {!item.active ? <Badge tone="danger">Nonaktif</Badge> : null}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {item.phone ? (
                        <span className="tabular">{formatPhone(item.phone)}</span>
                      ) : (
                        item.email || <span className="text-ink-subtle">UID saja</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {tenantsById.get(item.tenantId)?.name ?? (
                        <span className="text-danger">Unit usaha sudah tidak ada</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone="neutral" className="capitalize">
                        {item.role}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          label={`Ubah ${item.name}`}
                          size="sm"
                          onClick={() => {
                            setEditing(item)
                            setFormOpen(true)
                          }}
                        >
                          <PencilSimpleIcon size={18} />
                        </IconButton>
                        <IconButton
                          label={`Cabut akses ${item.name}`}
                          size="sm"
                          className="hover:text-danger"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <TrashIcon size={18} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {invites.length > 0 ? (
        <Card>
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Menunggu masuk pertama</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Sudah diundang lewat nomor HP, tapi belum pernah masuk. Barisnya di
              daftar pengguna lahir sendiri begitu orangnya masuk dengan nomor itu,
              dan undangan ini hilang dengan sendirinya.
            </p>
          </div>
          <ul className="divide-y divide-border">
            {invites.map((invite) => (
              <li
                key={invite.phone}
                className="flex items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-ink">{invite.name}</p>
                    <Badge tone="warning" className="capitalize">
                      {invite.role}
                    </Badge>
                  </div>
                  <p className="tabular truncate text-xs text-ink-muted">
                    {formatPhone(invite.phone)}
                    <span className="ml-2 text-ink-subtle">
                      {tenantsById.get(invite.tenantId)?.name ?? 'unit usaha tidak ada'}
                    </span>
                  </p>
                </div>
                <IconButton
                  label={`Batalkan undangan ${invite.name}`}
                  size="sm"
                  className="hover:text-danger"
                  onClick={() => setCancelTarget(invite)}
                >
                  <TrashIcon size={18} />
                </IconButton>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {admins.length > 0 ? (
        <Card>
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Admin platform</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Mengelola unit usaha dan pengguna, dan sengaja tidak bisa membaca
              pembukuan unit usaha mana pun. Admin bisa mengangkat admin lain, tapi
              hanya admin: orang yang belum terdaftar tidak punya pijakan sama
              sekali, dan tidak ada seorang pun yang bisa menurunkan atau
              menonaktifkan dirinya sendiri.
            </p>
          </div>
          <ul className="divide-y divide-border">
            {admins.map((item) => {
              const isSelf = item.uid === currentUser?.uid
              return (
                <li
                  key={item.uid}
                  className="flex items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                      {!item.active ? <Badge tone="danger">Nonaktif</Badge> : null}
                    </div>
                    <p className="truncate text-xs text-ink-muted">
                      {item.email || formatPhone(item.phone)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {isSelf ? <Badge tone="accent">Anda</Badge> : null}
                    <IconButton
                      label={`Ubah ${item.name}`}
                      size="sm"
                      onClick={() => {
                        setEditing(item)
                        setFormOpen(true)
                      }}
                    >
                      <PencilSimpleIcon size={18} />
                    </IconButton>
                    {/*
                      Menghapus baris sendiri ditolak Security Rules, jadi
                      tombolnya pun tidak ditawarkan: lebih baik tidak ada
                      daripada ada lalu gagal.
                    */}
                    {!isSelf ? (
                      <IconButton
                        label={`Cabut akses ${item.name}`}
                        size="sm"
                        className="hover:text-danger"
                        onClick={() => setDeleteTarget(item)}
                      >
                        <TrashIcon size={18} />
                      </IconButton>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      ) : null}

      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        user={editing}
        tenants={tenants}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Batalkan undangan?"
        message={`${cancelTarget?.name ?? ''} tidak akan bisa masuk dengan nomor ${formatPhone(cancelTarget?.phone ?? '')}. Undangan baru bisa dibuat lagi kapan saja.`}
        confirmLabel="Batalkan undangan"
        destructive
        loading={cancelling}
        onConfirm={handleCancelInvite}
        onCancel={() => setCancelTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Cabut akses pengguna?"
        message={`${deleteTarget?.name ?? ''} tidak akan bisa membuka aplikasi lagi. Akun loginnya tetap ada tapi tidak bisa membaca data apa pun, dan riwayat transaksi yang sudah tercatat tidak berubah karena tiap struk menyimpan nama kasirnya sendiri.`}
        confirmLabel="Cabut akses"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
