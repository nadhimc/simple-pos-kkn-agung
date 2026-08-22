/**
 * NOMOR HP.
 *
 * Firebase menerima dan mengembalikan nomor dalam format E.164 (+6285…),
 * sementara orang Indonesia menulis dan membaca 0851…. Kedua bentuk itu harus
 * bertemu di satu tempat saja, di sini, supaya tidak ada layar yang menebak
 * sendiri lalu mengirim nomor yang salah ke Firebase.
 */

const COUNTRY = '62'

/** Apa pun yang diketik pengguna diubah ke bentuk yang diterima Firebase. */
export function toE164(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''

  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''

  // Sudah ditulis internasional, entah dengan + atau tanpa.
  if (trimmed.startsWith('+')) return `+${digits}`
  // 0851… , bentuk yang paling sering diketik.
  if (digits.startsWith('0')) return `+${COUNTRY}${digits.slice(1)}`
  // 62851… tanpa tanda plus.
  if (digits.startsWith(COUNTRY)) return `+${digits}`
  // 851… tanpa nol di depan.
  return `+${COUNTRY}${digits}`
}

/** Panjangnya mengikuti batas E.164: paling sedikit 8, paling banyak 15 digit. */
export function isValidPhone(e164: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(e164)
}

/** +6285156657853 ditampilkan sebagai 0851-5665-7853. */
export function formatPhone(e164: string): string {
  if (!e164) return ''
  const local = e164.startsWith(`+${COUNTRY}`)
    ? `0${e164.slice(COUNTRY.length + 1)}`
    : e164
  if (!local.startsWith('0')) return e164
  return local.replace(/(\d{4})(?=\d)/g, '$1-')
}
