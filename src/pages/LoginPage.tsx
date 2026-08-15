import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { GoogleLogoIcon, StorefrontIcon } from '@phosphor-icons/react'
import { authErrorMessage, useAuth } from '@/contexts/AuthContext'
import { STORE_NAME } from '@/lib/firebase'
import { Button, ErrorState, TextField } from '@/components/ui'
import { BrandMark } from '@/components/layout/BrandMark'

export default function LoginPage() {
  const { user, signIn, signInWithGoogle, accessError, clearAccessError } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googlePending, setGooglePending] = useState(false)

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/kasir'
    return <Navigate to={from} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signIn(email, password)
    } catch (caught) {
      setError(authErrorMessage(caught))
      setSubmitting(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setGooglePending(true)
    try {
      await signInWithGoogle()
    } catch (caught) {
      // Menutup jendela Google bukan kesalahan, jadi pesannya sengaja kosong.
      const message = authErrorMessage(caught)
      if (message) setError(message)
    } finally {
      setGooglePending(false)
    }
  }

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.1fr_1fr]">
      {/* Panel merek. Disembunyikan di layar kecil supaya form langsung terlihat. */}
      <aside className="hidden flex-col justify-between bg-sidebar px-12 py-12 lg:flex">
        <BrandMark storeName={STORE_NAME} tone="dark" />

        <div className="max-w-md">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight text-sidebar-ink-active">
            Kasir dan pembukuan warung dalam satu layar.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-sidebar-ink">
            Catat penjualan, pantau stok, dan lihat untung rugi harian tanpa perlu
            menutup buku manual di akhir bulan.
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-6 border-t border-sidebar-border pt-6">
          <div>
            <dt className="text-xs text-sidebar-ink">Transaksi</dt>
            <dd className="mt-1 text-sm font-medium text-sidebar-ink-active">
              Tunai, QRIS, transfer
            </dd>
          </div>
          <div>
            <dt className="text-xs text-sidebar-ink">Stok</dt>
            <dd className="mt-1 text-sm font-medium text-sidebar-ink-active">
              Berkurang otomatis
            </dd>
          </div>
          <div>
            <dt className="text-xs text-sidebar-ink">Laporan</dt>
            <dd className="mt-1 text-sm font-medium text-sidebar-ink-active">
              Laba rugi per periode
            </dd>
          </div>
        </dl>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <BrandMark storeName={STORE_NAME} tone="light" />
          </div>

          <h2 className="mt-8 text-2xl font-semibold tracking-tight text-ink lg:mt-0">
            Masuk ke kasir
          </h2>
          <p className="mt-1.5 text-sm text-ink-muted">
            Hanya akun yang terdaftar sebagai staf toko yang bisa masuk.
          </p>

          {/*
            Akun yang lolos Google tetapi bukan staf ditolak di sini, lengkap
            dengan UID-nya supaya bisa langsung dikirim ke pemilik toko.
          */}
          {accessError ? (
            <ErrorState
              className="mt-6"
              title="Akun belum terdaftar"
              message={accessError}
              action={
                <Button variant="secondary" size="sm" onClick={clearAccessError}>
                  Coba akun lain
                </Button>
              }
            />
          ) : null}

          <div className="mt-6">
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              loading={googlePending}
              disabled={submitting}
              icon={<GoogleLogoIcon size={19} weight="bold" />}
              onClick={handleGoogle}
            >
              Masuk dengan Google
            </Button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-ink-subtle">atau pakai email</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <TextField
              label="Kata sandi"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={error}
            />
            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={submitting}
              disabled={googlePending}
              className="mt-2"
            >
              Masuk
            </Button>
          </form>

          <p className="mt-8 flex items-start gap-2 text-xs text-ink-subtle">
            <StorefrontIcon size={14} weight="bold" className="mt-0.5 shrink-0" />
            Akun baru dibuat pemilik toko lewat Firebase Console, lalu didaftarkan ke
            koleksi staff.
          </p>
        </div>
      </main>
    </div>
  )
}
