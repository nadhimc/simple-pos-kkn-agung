import { useEffect, useState, type FormEvent } from 'react'
import { GoogleLogoIcon, StorefrontIcon } from '@phosphor-icons/react'
import { authErrorMessage, useAuth } from '@/contexts/AuthContext'
import { APP_LONG_NAME, APP_NAME } from '@/lib/firebase'
import { Button, ErrorState, TextField } from '@/components/ui'
import { BrandMark } from '@/components/layout/BrandMark'
import { InstallAppButton } from '@/components/layout/InstallAppButton'

/**
 * Halaman ini tidak memeriksa sesi sama sekali. Pemantulan bagi pengguna yang
 * sudah masuk ditangani <RedirectIfAuthenticated> di tingkat rute, supaya form
 * ini tidak pernah sempat tergambar.
 *
 * Masuk lewat nomor HP pernah ada di sini dan dicabut kembali. Alasannya bukan
 * teknis melainkan pilihan: OTP menuntut reCAPTCHA, dan reCAPTCHA menuntut satu
 * langkah lagi dari orang yang sedang buru buru membuka kasir. Riwayatnya utuh
 * di git kalau nanti dibutuhkan lagi.
 */
export default function LoginPage() {
  const { signIn, signInWithGoogle, accessError, clearAccessError } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googlePending, setGooglePending] = useState(false)

  /*
    Kredensial diterima bukan berarti sudah masuk: pendaftarannya masih
    diperiksa sesudahnya. Flag pending sengaja tidak direset saat kredensial
    berhasil, jadi tombolnya tetap berputar sampai aplikasi benar benar terbuka
    atau penolakan muncul. Tanpa ini ada jeda diam yang bikin kasir menekan
    tombolnya dua kali.
  */
  useEffect(() => {
    if (accessError) {
      setSubmitting(false)
      setGooglePending(false)
    }
  }, [accessError])

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
      setGooglePending(false)
    }
  }

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.1fr_1fr]">
      {/* Panel merek. Disembunyikan di layar kecil supaya form langsung terlihat. */}
      <aside className="hidden flex-col justify-between bg-sidebar px-12 py-12 lg:flex">
        <BrandMark storeName={APP_NAME} tone="dark" />

        <div className="max-w-md">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight text-sidebar-ink-active">
            {APP_LONG_NAME}.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-sidebar-ink">
            Catat penjualan, pantau stok, dan lihat untung rugi tiap unit usaha
            desa tanpa perlu menutup buku manual di akhir bulan.
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
              Bahan baku dan barang jadi
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
            <BrandMark storeName={APP_NAME} tone="light" />
          </div>

          <h2 className="mt-8 text-2xl font-semibold tracking-tight text-ink lg:mt-0">
            Masuk ke kasir
          </h2>
          <p className="mt-1.5 text-sm text-ink-muted">
            Hanya akun yang sudah didaftarkan admin yang bisa masuk.
          </p>

          {/*
            Akun yang lolos autentikasi tapi belum terdaftar ditolak di sini,
            lengkap dengan UID-nya supaya bisa langsung dikirim ke admin.
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

          {/*
            Ditawarkan sebelum masuk, karena di sinilah kasir pertama kali
            membuka aplikasinya di HP. Hilang sendiri kalau sudah terpasang.
          */}
          <InstallAppButton className="mt-6" size="lg" fullWidth />

          <p className="mt-8 flex items-start gap-2 text-xs text-ink-subtle">
            <StorefrontIcon size={14} weight="bold" className="mt-0.5 shrink-0" />
            Akun dibuat admin, bukan dengan mendaftar sendiri. Belum bisa masuk?
            Hubungi admin.
          </p>
        </div>
      </main>
    </div>
  )
}
