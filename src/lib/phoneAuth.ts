import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type Auth,
  type ConfirmationResult,
} from 'firebase/auth'

/**
 * SATU PERMINTAAN OTP.
 *
 * reCAPTCHA wajib untuk seluruh masuk lewat nomor HP, termasuk untuk nomor uji.
 * Verifier dibuat baru setiap percobaan karena satu verifier hanya sah untuk
 * satu permintaan, dan `cleanup` membuang widgetnya supaya tidak menumpuk di
 * DOM ketika orangnya salah ketik nomor lalu mengulang.
 */
export interface PhoneChallenge {
  confirmation: ConfirmationResult
  cleanup: () => void
}

export async function requestOtp(
  instance: Auth,
  phoneE164: string,
  container: HTMLElement,
): Promise<PhoneChallenge> {
  const verifier = new RecaptchaVerifier(instance, container, { size: 'invisible' })

  /*
    Pembersihan harus tahan dipanggil berkali kali.

    `RecaptchaVerifier.clear()` melempar auth/internal-error kalau verifiernya
    sudah dibuang, dan dua pemanggil yang sama sama benar memang akan
    memanggilnya dua kali: alur OTP membersihkan setelah kodenya dipakai, lalu
    React membersihkan sekali lagi saat layarnya dilepas. Lemparan kedua itu
    terjadi di dalam cleanup efek, jadi tidak ada yang menangkapnya dan seluruh
    aplikasi ikut kosong tepat setelah kode yang benar dimasukkan.
  */
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

  try {
    const confirmation = await signInWithPhoneNumber(instance, phoneE164, verifier)
    return { confirmation, cleanup }
  } catch (caught) {
    // Verifier yang gagal tidak boleh ditinggalkan hidup: percobaan berikutnya
    // akan memakai widget basi dan gagal dengan pesan yang menyesatkan.
    cleanup()
    throw caught
  }
}
