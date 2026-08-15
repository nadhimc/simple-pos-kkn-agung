/**
 * Pesan error Firestore diterjemahkan ke kalimat yang bisa ditindaklanjuti
 * pemilik warung. Kode aslinya tetap dicatat di console untuk penelusuran.
 */
export function firestoreErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : ''

  if (import.meta.env.DEV) console.error(error)

  switch (code) {
    case 'permission-denied':
      return 'Akses ditolak oleh aturan keamanan Firestore. Pastikan sudah masuk dan firestore.rules sudah diterapkan.'
    case 'unavailable':
      return 'Tidak dapat menghubungi server. Data yang tampil mungkin dari cache, dan perubahan akan dikirim saat koneksi kembali.'
    case 'failed-precondition':
      return 'Kueri ini membutuhkan indeks Firestore yang belum dibuat. Buka tautan indeks di console browser untuk membuatnya.'
    case 'resource-exhausted':
      return 'Kuota Firestore harian sudah habis. Coba lagi besok atau tingkatkan paket Firebase.'
    default:
      return 'Terjadi kesalahan saat mengambil data. Muat ulang halaman lalu coba lagi.'
  }
}

/**
 * Khusus kegagalan menyimpan penjualan.
 *
 * firestore.rules menolak stok bernilai negatif, jadi kalau barang terakhir
 * habis terjual lebih dulu di perangkat lain, seluruh batch penjualan ditolak
 * dengan kode permission-denied. Penolakan itu justru mencegah oversell, tapi
 * pesan bawaannya menyesatkan kasir, jadi diterjemahkan di sini.
 */
export function saleErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : ''

  if (import.meta.env.DEV) console.error(error)

  if (code === 'permission-denied') {
    return 'Transaksi ditolak. Kemungkinan stok salah satu barang sudah habis terjual dari perangkat lain. Periksa sisa stok lalu ulangi.'
  }
  return writeErrorMessage(error)
}

/** Sama seperti di atas, untuk aksi tulis yang gagal. */
export function writeErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : ''

  if (import.meta.env.DEV) console.error(error)

  if (code === 'permission-denied') {
    return 'Perubahan ditolak aturan keamanan Firestore.'
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Perubahan gagal disimpan. Coba lagi.'
}
