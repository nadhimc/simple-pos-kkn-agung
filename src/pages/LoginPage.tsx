import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DeviceMobileIcon, EnvelopeSimpleIcon, GoogleLogoIcon, StorefrontIcon } from '@phosphor-icons/react'
import { authErrorMessage, useAuth } from '@/contexts/AuthContext'
import { APP_NAME } from '@/lib/firebase'
import { formatPhone, isValidPhone, toE164 } from '@/lib/phone'
import type { PhoneChallenge } from '@/lib/phoneAuth'
import { Button, ErrorState, TextField } from '@/components/ui'
import { BrandMark } from '@/components/layout/BrandMark'

/**
 * Halaman ini tidak memeriksa sesi sama sekali. Pemantulan bagi pengguna yang
 * sudah masuk ditangani <RedirectIfAuthenticated> di tingkat rute, supaya form
 * ini tidak pernah sempat tergambar.
 *
 * Nomor HP didahulukan dan email disembunyikan di balik satu tautan. Orang
 * warung menghafal nomornya sendiri, tidak selalu punya email, dan tidak perlu
 * memilih apa apa saat membuka layar ini.
 */
export default function LoginPage() {
  const {
    signIn,
    signInWithGoogle,
    requestPhoneCode,
    confirmPhoneCode,
    accessError,
    clearAccessError,
  } = useAuth()

  const [method, setMethod] = useState<'hp' | 'email'>('hp')
  const [error, setError] = useState('')

  // Nomor HP
  const [phone, setPhone] = useState('')
  const [challenge, setChallenge] = useState<PhoneChallenge | null>(null)
  const [code, setCode] = useState('')
  const [phonePending, setPhonePending] = useState(false)
  const recaptchaRef = useRef<HTMLDivElement>(null)

  // Email
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      setPhonePending(false)
    }
  }, [accessError])

  // Widget reCAPTCHA yang ditinggalkan akan menumpuk di DOM dan membuat
  // percobaan berikutnya gagal dengan pesan yang menyesatkan.
  useEffect(() => {
    return () => challenge?.cleanup()
  }, [challenge])

  async function handleSendCode(event: FormEvent) {
    event.preventDefault()
    setError('')

    const e164 = toE164(phone)
    if (!isValidPhone(e164)) {
      setError('Nomor HP tidak valid. Tulis seperti 0851 5665 7853.')
      return
    }
    if (!recaptchaRef.current) return

    setPhonePending(true)
    try {
      setChallenge(await requestPhoneCode(e164, recaptchaRef.current))
      setCode('')
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setPhonePending(false)
    }
  }

  async function handleVerifyCode(event: FormEvent) {
    event.preventDefault()
    if (!challenge) return

    setError('')
    setPhonePending(true)
    try {
      await confirmPhoneCode(challenge, code.trim())
      // Sengaja tidak mematikan pending: layar berganti sendiri begitu
      // pendaftarannya selesai diperiksa.
    } catch (caught) {
      setError(authErrorMessage(caught))
      setChallenge(null)
      setPhonePending(false)
    }
  }

  function resetPhone() {
    challenge?.cleanup()
    setChallenge(null)
    setCode('')
    setError('')
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
      setGooglePending(false)
    }
  }

  function switchMethod(next: 'hp' | 'email') {
    resetPhone()
    setMethod(next)
  }

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.1fr_1fr]">
      {/* Panel merek. Disembunyikan di layar kecil supaya form langsung terlihat. */}
      <aside className="hidden flex-col justify-between bg-sidebar px-12 py-12 lg:flex">
        <BrandMark storeName={APP_NAME} tone="dark" />

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

          {method === 'hp' ? (
            challenge ? (
              <form onSubmit={handleVerifyCode} className="mt-6 flex flex-col gap-4">
                <p className="text-sm text-ink-muted">
                  Kode enam angka dikirim lewat SMS ke{' '}
                  <span className="font-medium text-ink">{formatPhone(toE164(phone))}</span>.
                </p>
                <TextField
                  label="Kode OTP"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  required
                  value={code}
                  error={error}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                />
                <Button type="submit" size="lg" fullWidth loading={phonePending}>
                  Masuk
                </Button>
                <button
                  type="button"
                  onClick={resetPhone}
                  className="text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  Ganti nomor
                </button>
              </form>
            ) : (
              <form onSubmit={handleSendCode} className="mt-6 flex flex-col gap-4">
                <TextField
                  label="Nomor HP"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0851 5665 7853"
                  autoFocus
                  required
                  value={phone}
                  error={error}
                  helper="Kode masuk dikirim lewat SMS ke nomor ini."
                  onChange={(event) => setPhone(event.target.value)}
                />
                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  loading={phonePending}
                  icon={<DeviceMobileIcon size={19} weight="bold" />}
                >
                  Kirim kode
                </Button>
              </form>
            )
          ) : (
            <>
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
            </>
          )}

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => switchMethod(method === 'hp' ? 'email' : 'hp')}
              className="inline-flex items-center gap-2 text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            >
              {method === 'hp' ? (
                <>
                  <EnvelopeSimpleIcon size={16} weight="bold" />
                  Masuk dengan email
                </>
              ) : (
                <>
                  <DeviceMobileIcon size={16} weight="bold" />
                  Masuk dengan nomor HP
                </>
              )}
            </button>
          </div>

          {/*
            reCAPTCHA tak terlihat. Wadahnya harus ada di DOM sebelum permintaan
            OTP dikirim, jadi tetap dirender walaupun tidak menampilkan apa apa.
          */}
          <div ref={recaptchaRef} />

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
