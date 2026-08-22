import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PencilSimpleIcon,
  PlusIcon,
  ProhibitIcon,
  StorefrontIcon,
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
import { TenantFormModal } from '@/features/admin/TenantFormModal'
import { UserFormModal } from '@/features/admin/UserFormModal'
import { useAppUsers, useTenants } from '@/hooks/useAdmin'
import { setTenantActive } from '@/services/tenants'
import { writeErrorMessage } from '@/lib/errors'
import { formatDateShort } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import type { Tenant } from '@/types'

/**
 * Daftar unit usaha desa yang memakai sistem ini.
 *
 * Halaman ini tidak menampilkan satu pun angka pembukuan, dan bukan karena
 * disembunyikan: firestore.rules memang tidak memberi admin akses ke subkoleksi
 * mana pun di bawah tenant. Yang terlihat di sini hanya identitasnya dan berapa
 * orang yang bisa membukanya. Angka usahanya ada di halaman Ringkasan Usaha,
 * yang dijaga unit usahanya sendiri.
 */
export default function AdminTenantsPage() {
  const navigate = useNavigate()
  const { tenants, loading, error } = useTenants()
  const { countByTenant } = useAppUsers()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Tenant | null>(null)
  const [userForTenant, setUserForTenant] = useState<string>('')
  const [toggleTarget, setToggleTarget] = useState<Tenant | null>(null)
  const [toggling, setToggling] = useState(false)

  async function handleToggleActive() {
    if (!toggleTarget) return
    const next = !toggleTarget.active
    setToggling(true)
    try {
      await setTenantActive(toggleTarget.id, next)
      toast.success(
        next
          ? `${toggleTarget.name} diaktifkan kembali.`
          : `${toggleTarget.name} dinonaktifkan.`,
      )
      setToggleTarget(null)
    } catch (caught) {
      toast.error(writeErrorMessage(caught))
    } finally {
      setToggling(false)
    }
  }

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Unit Usaha"
        description="Setiap unit usaha punya data sendiri yang terpisah penuh. Admin mengelola daftarnya, bukan isinya."
        actions={
          <Button icon={<PlusIcon size={17} weight="bold" />} onClick={openNew}>
            Tambah unit usaha
          </Button>
        }
      />

      {error ? <ErrorState message={error} /> : null}

      <Card>
        {loading ? (
          <TableSkeleton rows={4} columns={4} />
        ) : tenants.length === 0 ? (
          <EmptyState
            icon={StorefrontIcon}
            title="Belum ada unit usaha"
            description="Tambahkan unit usaha pertama, lalu daftarkan orang yang mengelolanya."
            action={
              <Button icon={<PlusIcon size={17} weight="bold" />} onClick={openNew}>
                Tambah unit usaha
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-muted">
                  <th className="px-5 py-3 font-medium">Unit usaha</th>
                  <th className="px-5 py-3 font-medium">Pemilik</th>
                  <th className="px-5 py-3 font-medium">Pengguna</th>
                  <th className="px-5 py-3 font-medium">Dibuat</th>
                  <th className="px-5 py-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tenants.map((tenant) => {
                  const users = countByTenant.get(tenant.id) ?? 0
                  return (
                    <tr key={tenant.id} className="transition-colors hover:bg-surface-2">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-ink">{tenant.name}</p>
                          {!tenant.active ? <Badge tone="danger">Nonaktif</Badge> : null}
                        </div>
                        {tenant.address ? (
                          <p className="text-xs text-ink-muted">{tenant.address}</p>
                        ) : null}
                      </td>
                      <td className="px-5 py-3.5 text-ink-muted">
                        <p>{tenant.ownerName || '—'}</p>
                        {tenant.phone ? (
                          <p className="tabular text-xs">{formatPhone(tenant.phone)}</p>
                        ) : null}
                      </td>
                      <td className="px-5 py-3.5">
                        {/*
                          Unit usaha tanpa pengguna tidak bisa dibuka siapa pun, jadi
                          keadaannya ditandai, bukan ditampilkan sebagai angka nol
                          yang mudah terlewat.
                        */}
                        {users === 0 ? (
                          <Badge tone="warning">Belum ada yang bisa masuk</Badge>
                        ) : (
                          <span className="tabular text-ink">{users} orang</span>
                        )}
                      </td>
                      <td className="tabular px-5 py-3.5 whitespace-nowrap text-ink-muted">
                        {formatDateShort(tenant.createdAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            label={`Daftarkan pengguna untuk ${tenant.name}`}
                            size="sm"
                            onClick={() => setUserForTenant(tenant.id)}
                          >
                            <UsersIcon size={18} />
                          </IconButton>
                          <IconButton
                            label={`Ubah ${tenant.name}`}
                            size="sm"
                            onClick={() => {
                              setEditing(tenant)
                              setFormOpen(true)
                            }}
                          >
                            <PencilSimpleIcon size={18} />
                          </IconButton>
                          {/*
                            Tidak ada tombol hapus, dan itu disengaja. Firestore
                            tidak menghapus subkoleksi secara berjenjang, jadi
                            menghapus unit usaha hanya akan meninggalkan produk
                            dan struknya sebagai data yatim yang tidak bisa
                            dibaca siapa pun.
                          */}
                          <IconButton
                            label={
                              tenant.active
                                ? `Nonaktifkan ${tenant.name}`
                                : `Aktifkan kembali ${tenant.name}`
                            }
                            size="sm"
                            className={tenant.active ? 'hover:text-danger' : undefined}
                            onClick={() => setToggleTarget(tenant)}
                          >
                            <ProhibitIcon size={18} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <TenantFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        tenant={editing}
        // Unit usaha kosong tidak ada gunanya, jadi begitu dibuat langsung
        // diantar ke langkah berikutnya: mendaftarkan orang yang mengelolanya.
        onCreated={(id) => setUserForTenant(id)}
      />

      <UserFormModal
        open={Boolean(userForTenant)}
        onClose={() => setUserForTenant('')}
        user={null}
        tenants={tenants}
        defaultTenantId={userForTenant}
      />

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        title={
          toggleTarget?.active ? 'Nonaktifkan unit usaha?' : 'Aktifkan kembali?'
        }
        message={
          toggleTarget?.active
            ? `Tidak ada seorang pun yang bisa membuka ${toggleTarget?.name ?? ''} sampai diaktifkan lagi. Seluruh produk, resep, struk, dan bebannya tetap utuh dan tidak ada yang dihapus.`
            : `${toggleTarget?.name ?? ''} bisa dibuka lagi oleh penggunanya, dengan seluruh data yang sama seperti sebelum dinonaktifkan.`
        }
        confirmLabel={toggleTarget?.active ? 'Nonaktifkan' : 'Aktifkan'}
        destructive={toggleTarget?.active ?? false}
        loading={toggling}
        onConfirm={handleToggleActive}
        onCancel={() => setToggleTarget(null)}
      />

      <p className="text-xs text-ink-subtle">
        Butuh melihat semua pengguna sekaligus?{' '}
        <button
          type="button"
          onClick={() => navigate('/admin/pengguna')}
          className="font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Buka halaman Pengguna
        </button>
        .
      </p>
    </div>
  )
}
