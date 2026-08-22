import { useMemo, useState } from 'react'
import { PencilSimpleIcon, PlusIcon, TrashIcon, UsersIcon } from '@phosphor-icons/react'
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
import { useAppUsers, useTenants } from '@/hooks/useAdmin'
import { useAuth } from '@/contexts/AuthContext'
import { deleteAppUser } from '@/services/users'
import { writeErrorMessage } from '@/lib/errors'
import { formatPhone } from '@/lib/phone'
import type { AppUser } from '@/types'

/**
 * Siapa saja yang boleh membuka aplikasi ini, dan warung yang mana.
 *
 * Daftar ini adalah gerbang aksesnya: login hanya membuktikan siapa orangnya,
 * baris di sinilah yang menentukan dia boleh masuk. firestore.rules memeriksa
 * dokumen yang sama di sisi server.
 */
export default function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const { tenants, tenantsById, loading: tenantsLoading } = useTenants()
  const { users, loading, error } = useAppUsers()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Admin platform ditampilkan terpisah di bawah: mereka tidak punya warung,
  // dan mencampurnya ke daftar yang berkolom "Warung" hanya membingungkan.
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
        description="Login hanya membuktikan siapa orangnya. Baris di daftar inilah yang menentukan dia boleh masuk, dan ke warung mana."
        actions={
          <Button
            icon={<PlusIcon size={17} weight="bold" />}
            onClick={openNew}
            disabled={tenants.length === 0}
          >
            Daftarkan pengguna
          </Button>
        }
      />

      {error ? <ErrorState message={error} /> : null}

      {!tenantsLoading && tenants.length === 0 ? (
        <ErrorState
          title="Belum ada warung"
          message="Pengguna selalu terikat pada satu warung, jadi tambahkan warungnya dulu di halaman Warung."
        />
      ) : null}

      <Card>
        {loading ? (
          <TableSkeleton rows={5} columns={4} />
        ) : staff.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="Belum ada pengguna warung"
            description="Daftarkan pemilik warung supaya dia bisa membuka kasirnya sendiri."
            action={
              <Button
                icon={<PlusIcon size={17} weight="bold" />}
                onClick={openNew}
                disabled={tenants.length === 0}
              >
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
                  <th className="px-5 py-3 font-medium">Warung</th>
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
                        <span className="text-danger">Warung sudah tidak ada</span>
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

      {admins.length > 0 ? (
        <Card>
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Admin platform</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Mengelola warung dan pengguna, dan tidak bisa membaca pembukuan warung
              mana pun. Admin baru hanya bisa dibuat lewat skrip seed, supaya tidak
              ada jalan mengangkat diri sendiri dari dalam aplikasi.
            </p>
          </div>
          <ul className="divide-y divide-border">
            {admins.map((item) => (
              <li
                key={item.uid}
                className="flex items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {item.email || formatPhone(item.phone)}
                  </p>
                </div>
                {item.uid === currentUser?.uid ? (
                  <Badge tone="accent">Anda</Badge>
                ) : null}
              </li>
            ))}
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
