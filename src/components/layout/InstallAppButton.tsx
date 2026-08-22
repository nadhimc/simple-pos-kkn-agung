import { useSyncExternalStore } from 'react'
import { DownloadSimpleIcon } from '@phosphor-icons/react'
import { Button, toast } from '@/components/ui'
import { canInstall, promptInstall, subscribeInstallState } from '@/lib/pwa'

interface InstallAppButtonProps {
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  label?: string
  className?: string
}

/**
 * TOMBOL PASANG APLIKASI.
 *
 * Tidak pernah tergambar kecuali browser benar benar menawarkan pemasangan.
 * Artinya ia hilang sendiri dalam tiga keadaan: aplikasinya sudah dipasang,
 * browsernya tidak mendukung pemasangan, atau syarat pemasangannya belum
 * terpenuhi. Tombol yang muncul lalu tidak melakukan apa apa jauh lebih buruk
 * daripada tombol yang tidak ada.
 *
 * Safari di iOS tidak pernah mengirim `beforeinstallprompt`, jadi di sana
 * tombol ini memang tidak akan muncul. Pemasangan di iOS hanya bisa lewat menu
 * Bagikan, dan tidak ada API yang boleh dipanggil halaman untuk memicunya.
 */
export function InstallAppButton({
  variant = 'secondary',
  size = 'sm',
  fullWidth = false,
  label = 'Pasang aplikasi',
  className,
}: InstallAppButtonProps) {
  const available = useSyncExternalStore(
    subscribeInstallState,
    canInstall,
    // Nilai untuk render di server. Tidak dipakai proyek ini, tapi hook-nya
    // menuntutnya ada.
    () => false,
  )

  if (!available) return null

  return (
    <Button
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      className={className}
      icon={<DownloadSimpleIcon size={17} weight="bold" />}
      onClick={async () => {
        const installed = await promptInstall()
        if (installed) {
          toast.success('Aplikasi terpasang. Buka lewat ikonnya di layar utama.')
        }
      }}
    >
      {label}
    </Button>
  )
}
