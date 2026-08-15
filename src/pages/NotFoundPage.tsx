import { useNavigate } from 'react-router-dom'
import { CompassIcon } from '@phosphor-icons/react'
import { Button, Card, EmptyState } from '@/components/ui'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <Card>
      <EmptyState
        icon={CompassIcon}
        title="Halaman tidak ditemukan"
        description="Tautan yang dibuka tidak ada di aplikasi ini. Kembali ke dashboard untuk melanjutkan."
        action={<Button onClick={() => navigate('/')}>Kembali ke dashboard</Button>}
      />
    </Card>
  )
}
