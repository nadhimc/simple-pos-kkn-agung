import { useLocation } from 'react-router-dom'
import { HammerIcon } from '@phosphor-icons/react'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { findNavItem } from '@/components/layout/navigation'

/**
 * Isi sementara untuk rute yang sudah terdaftar di navigasi tetapi halamannya
 * belum dibangun. Setiap commit fitur mengganti satu pemakaian komponen ini.
 */
export function PlaceholderPage() {
  const location = useLocation()
  const current = findNavItem(location.pathname)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={current?.label ?? 'Halaman'} description={current?.description} />
      <Card>
        <EmptyState
          icon={HammerIcon}
          title="Halaman ini sedang dibangun"
          description="Rute dan navigasinya sudah siap. Isi halaman menyusul di langkah berikutnya."
        />
      </Card>
    </div>
  )
}
