const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const rupiahCompact = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1,
})

const number = new Intl.NumberFormat('id-ID')

/** "Rp 12.500" */
export function formatRupiah(value: number) {
  return rupiah.format(Math.round(value || 0)).replace(/\s/g, ' ')
}

/** "12,5 jt" untuk KPI dan sumbu grafik yang sempit. */
export function formatRupiahCompact(value: number) {
  return `Rp ${rupiahCompact.format(Math.round(value || 0))}`
}

export function formatNumber(value: number) {
  return number.format(value || 0)
}

export function formatPercent(value: number, fractionDigits = 1) {
  if (!Number.isFinite(value)) return '0%'
  return `${value.toFixed(fractionDigits).replace('.', ',')}%`
}

const dateLong = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const dateShort = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
})

const dateTime = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const time = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' })

export function formatDate(value: Date) {
  return dateLong.format(value)
}

export function formatDateShort(value: Date) {
  return dateShort.format(value)
}

export function formatDateTime(value: Date) {
  return dateTime.format(value)
}

export function formatTime(value: Date) {
  return time.format(value)
}

/** "2026-08-15" dalam zona waktu lokal, dipakai untuk input[type=date] dan pengelompokan harian. */
export function toDateInputValue(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offset).toISOString().slice(0, 10)
}

export function startOfDay(value: Date) {
  const d = new Date(value)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(value: Date) {
  const d = new Date(value)
  d.setHours(23, 59, 59, 999)
  return d
}

export function addDays(value: Date, days: number) {
  const d = new Date(value)
  d.setDate(d.getDate() + days)
  return d
}
