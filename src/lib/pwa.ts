/**
 * PEMASANGAN APLIKASI.
 *
 * Browser hanya memunculkan tawaran pasang lewat event `beforeinstallprompt`,
 * dan event itu datang sekali, lebih awal dari mounting komponen mana pun.
 * Kalau tidak ditangkap di titik masuk aplikasi, tawarannya hilang dan tombol
 * Pasang tidak akan pernah bisa muncul. Karena itu penangkapnya dipasang di
 * sini, bukan di dalam React.
 */

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

/**
 * Sudah terpasang, jadi tombolnya tidak boleh muncul.
 *
 * Diperiksa lewat mode tampilan, bukan lewat catatan tersimpan: aplikasi yang
 * dibuka dari ikon layar utama berjalan `standalone`, dan itu satu satunya
 * penanda yang benar di semua browser. `navigator.standalone` khusus iOS, yang
 * tidak mengenal display-mode.
 */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false

  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: window-controls-overlay)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true

  return Boolean(standalone)
}

export function canInstall(): boolean {
  return deferred !== null && !isInstalled()
}

export function subscribeInstallState(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Mengembalikan true kalau pemasangannya jadi dilakukan. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false

  await deferred.prompt()
  const { outcome } = await deferred.userChoice

  // Tawaran hanya sah sekali dipakai. Menyimpannya untuk klik berikutnya akan
  // menghasilkan error, jadi tombolnya ikut hilang setelah ini.
  deferred = null
  notify()

  return outcome === 'accepted'
}

export function setupInstallPrompt() {
  if (typeof window === 'undefined') return

  window.addEventListener('beforeinstallprompt', (event) => {
    // Tanpa ini Chrome menampilkan bilah tawarannya sendiri di bawah layar,
    // yang menutupi panel keranjang di layar kasir.
    event.preventDefault()
    deferred = event as InstallPromptEvent
    notify()
  })

  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

/**
 * Service worker hanya didaftarkan pada build produksi. Di server pengembangan
 * ia akan bersaing dengan hot reload Vite dan menyajikan berkas basi, kesalahan
 * yang sangat mahal waktunya untuk ditelusuri.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      // Gagal mendaftar berarti aplikasi tidak bisa dipasang dan tidak punya
      // kerangka offline. Keduanya bukan alasan untuk menggagalkan aplikasinya.
      console.error('Service worker gagal didaftarkan', error)
    })
  })
}
