import { useEffect, useState, type FormEvent } from 'react'
import { Button, Modal, TextField, toast } from '@/components/ui'
import { createTenant, updateTenant } from '@/services/tenants'
import { writeErrorMessage } from '@/lib/errors'
import { toE164 } from '@/lib/phone'
import type { Tenant, TenantDraft } from '@/types'

interface TenantFormModalProps {
  open: boolean
  onClose: () => void
  /** Null berarti membuat unit usaha baru. */
  tenant: Tenant | null
  /** Dipanggil dengan id unit usaha yang baru dibuat, supaya bisa langsung diisi pengguna. */
  onCreated?: (tenantId: string) => void
}

const EMPTY = { name: '', ownerName: '', phone: '', address: '' }

export function TenantFormModal({
  open,
  onClose,
  tenant,
  onCreated,
}: TenantFormModalProps) {
  const [form, setForm] = useState(EMPTY)
  const [nameError, setNameError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setNameError('')
    setForm(
      tenant
        ? {
            name: tenant.name,
            ownerName: tenant.ownerName,
            phone: tenant.phone,
            address: tenant.address,
          }
        : EMPTY,
    )
  }, [open, tenant])

  function update(key: keyof typeof EMPTY, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.name.trim()) {
      setNameError('Nama unit usaha wajib diisi.')
      return
    }

    const draft: TenantDraft = {
      name: form.name.trim(),
      ownerName: form.ownerName.trim(),
      // Disimpan dalam bentuk yang sama dengan yang dipakai Firebase Auth,
      // supaya nomor di sini dan nomor untuk masuk tidak pernah berbeda bentuk.
      phone: form.phone.trim() ? toE164(form.phone) : '',
      address: form.address.trim(),
    }

    setSaving(true)
    try {
      if (tenant) {
        await updateTenant(tenant.id, draft)
        toast.success(`${draft.name} diperbarui.`)
      } else {
        const id = await createTenant(draft)
        toast.success(`${draft.name} ditambahkan.`)
        onCreated?.(id)
      }
      onClose()
    } catch (caught) {
      toast.error(writeErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tenant ? 'Ubah unit usaha' : 'Tambah unit usaha'}
      description={
        tenant
          ? 'Mengubah namanya ikut mengubah nama yang tercetak di struk pembeli.'
          : 'Unit usaha baru dimulai kosong. Setelah ini, daftarkan orang yang mengelolanya.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button type="submit" form="tenant-form" loading={saving}>
            {tenant ? 'Simpan perubahan' : 'Tambah unit usaha'}
          </Button>
        </>
      }
    >
      <form id="tenant-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Nama unit usaha"
          required
          autoFocus
          helper="Nama ini yang tercetak di struk pembeli."
          value={form.name}
          error={nameError}
          onChange={(event) => update('name', event.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Nama pemilik"
            helper="Opsional, untuk catatan admin."
            value={form.ownerName}
            onChange={(event) => update('ownerName', event.target.value)}
          />
          <TextField
            label="Nomor HP unit usaha"
            type="tel"
            inputMode="tel"
            placeholder="0851 5665 7853"
            helper="Opsional. Tidak dipakai untuk masuk."
            value={form.phone}
            onChange={(event) => update('phone', event.target.value)}
          />
        </div>
        <TextField
          label="Alamat"
          helper="Opsional."
          value={form.address}
          onChange={(event) => update('address', event.target.value)}
        />
      </form>
    </Modal>
  )
}
