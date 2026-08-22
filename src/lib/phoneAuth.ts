import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type Auth,
  type ConfirmationResult,
} from 'firebase/auth'

/**
 * SATU PERMINTAAN OTP.
 *
 * reCAPTCHA wajib untuk seluruh masuk lewat nomor HP, kecuali untuk nomor uji
 * yang memang dilewatkan Firebase. Verifier dibuat baru setiap percobaan karena
 * satu verifier hanya sah untuk satu permintaan, dan `cleanup` membuang
 * widgetnya supaya tidak menumpuk di DOM.
 */
export interface PhoneChallenge {
  confirmation: ConfirmationResult
  cleanup: () => void
}

/**
 * KOTAK CENTANG, BUKAN TAK TERLIHAT.
 *
 * reCAPTCHA tak terlihat memang lebih rapi, tapi hanya SELAMA ia memutuskan
 * mempercayai pengunjungnya. Kalau tidak, ia menaikkan tantangan gambar, dan
 * kalau tantangan itu tidak diselesaikan maka `signInWithPhoneNumber` tidak
 * pernah selesai juga: tidak ada error, tidak ada SMS, hanya tombol yang
 * berputar selamanya. Kegagalan yang tidak bisa dilihat maupun dilaporkan
 * adalah kegagalan terburuk yang bisa dimiliki layar masuk.
 *
 * Kotak centang membalik itu: orangnya melihat apa yang diminta dan bisa
 * menyelesaikannya sendiri. Harganya satu ketukan, sekali, karena sesinya
 * bertahan selamanya dan orang ini nyaris tidak pernah masuk lagi.
 *
 * `invisible` dipertahankan hanya untuk pengujian otomatis.
 */
export type CaptchaSize = 'invisible' | 'normal'

/**
 * Permintaan yang tidak pernah dijawab.
 *
 * Dibedakan dari kegagalan Firebase biasa karena penanganannya berbeda: yang
 * ini artinya reCAPTCHA menunggu sesuatu dari orangnya, dan jalan keluarnya
 * bukan mengulang diam diam melainkan menampilkan kotak centangnya.
 */
export class OtpTimeoutError extends Error {
  /** Diberi bentuk yang sama dengan error Firebase supaya penerjemahnya seragam. */
  readonly code = 'auth/otp-timeout'

  constructor() {
    super('Permintaan kode tidak dijawab.')
    this.name = 'OtpTimeoutError'
  }
}

/*
  Batas waktunya berbeda menurut siapa yang ditunggu.

  Mode tak terlihat hanya menunggu mesin, jadi tiga puluh detik sudah sangat
  longgar bahkan untuk jaringan warung yang lambat. Mode terlihat menunggu
  MANUSIA mencentang kotak dan mungkin menyelesaikan tantangan gambar, dan
  memutusnya di tengah itu justru menciptakan kegagalan yang tidak perlu.
*/
const TIMEOUT_MS: Record<CaptchaSize, number> = {
  invisible: 30_000,
  normal: 180_000,
}

export async function requestOtp(
  instance: Auth,
  phoneE164: string,
  container: HTMLElement,
  size: CaptchaSize = 'normal',
  timeoutMs = TIMEOUT_MS[size],
): Promise<PhoneChallenge> {
  /*
    Wadahnya dikosongkan lebih dulu.

    Verifier yang gagal sebelumnya kadang meninggalkan iframe reCAPTCHA di DOM,
    misalnya ketika `clear()` sendiri melempar. Verifier baru yang dipasang di
    atas sisa itu menghasilkan token yang ditolak, dan gejalanya di layar cuma
    "gagal masuk" berulang tanpa pola yang jelas.
  */
  container.replaceChildren()

  const verifier = new RecaptchaVerifier(instance, container, { size })

  let cleared = false
  const cleanup = () => {
    if (cleared) return
    cleared = true
    try {
      verifier.clear()
    } catch {
      // Sudah dibuang sendiri oleh SDK. Tidak ada yang perlu dikerjakan.
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    const confirmation = await Promise.race([
      signInWithPhoneNumber(instance, phoneE164, verifier),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new OtpTimeoutError()), timeoutMs)
      }),
    ])
    return { confirmation, cleanup }
  } catch (caught) {
    // Verifier yang gagal tidak boleh ditinggalkan hidup: percobaan berikutnya
    // akan memakai widget basi dan gagal dengan pesan yang menyesatkan.
    cleanup()
    throw caught
  } finally {
    clearTimeout(timer)
  }
}
