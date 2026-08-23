/**
 * Membuat seluruh berkas ikon di `public/` dari satu sumber geometri.
 *
 * Jalankan setelah mengubah lambangnya:
 *
 *   node scripts/icons.mjs
 *
 * Ikon aplikasi harus tampil di banyak tempat dengan aturan yang berbeda beda:
 * favicon 16px di tab, ikon bulat di layar utama Android, squircle di iOS. Kalau
 * tiap berkas digambar sendiri sendiri, cepat atau lambat ada satu yang bergeser
 * dan tidak ada yang menyadarinya. Karena itu bentuknya didefinisikan sekali di
 * `MARK` di bawah, dan sisanya cuma varian ukuran dan bingkai.
 *
 * PNG dirasterisasi lewat Chromium headless, bukan pustaka gambar, supaya tidak
 * ada dependensi baru yang ikut terpasang cuma untuk pekerjaan sesekali ini.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const publicDir = join(root, 'public')

/* ------------------------------------------------------------- lambangnya */

const INK = '#f6fefa'
const GRADIENT_FROM = '#059669' // emerald-600
const GRADIENT_TO = '#065f46' // emerald-800

/**
 * Huruf S digambar sebagai dua busur lingkaran yang bersinggungan di titik
 * tengah, bukan sebagai teks. Teks menuntut font yang belum tentu ada saat
 * dirasterisasi, dan hasilnya diam diam berbeda antar mesin.
 *
 * Lingkaran atas berpusat di (16, 11.3) dan bawah di (16, 20.7), keduanya
 * berjari jari 4.7, jadi keduanya bersinggungan tepat di (16, 16). Karena
 * bersinggungan, garisnya menyambung mulus tanpa perlu sambungan tambahan.
 */
const MARK = `<path
      d="M19.02 7.7A4.7 4.7 0 1 0 16 16a4.7 4.7 0 1 1-3.02 8.3"
      fill="none"
      stroke="${INK}"
      stroke-width="4"
      stroke-linecap="round"
    />`

/**
 * @param {object} options
 * @param {number} options.radius sudut membulat, 0 berarti persegi penuh
 * @param {number} options.scale  perbesaran lambang terhadap kanvas 32
 */
function svg({ radius, scale }) {
  const mark =
    scale === 1
      ? MARK
      : `<g transform="translate(16 16) scale(${scale}) translate(-16 -16)">${MARK}</g>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" role="img" aria-label="SIPANDAI">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GRADIENT_FROM}" />
      <stop offset="1" stop-color="${GRADIENT_TO}" />
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="${radius}" fill="url(#bg)" />
  ${mark}
</svg>
`
}

/*
  Tiga bingkai, masing masing menjawab satu aturan platform:

  - `any`      sudutnya dibulatkan sendiri, karena browser memasangnya apa
               adanya tanpa masker.
  - `maskable` persegi penuh dan lambangnya dikecilkan, karena Android memotong
               ikon ini jadi lingkaran berdiameter 80% kanvas. Pada skala 0.82,
               sudut terjauh lambang jatuh di radius 11.1 dari 12.8 yang aman.
  - `apple`    persegi penuh tanpa pembulatan, karena iOS memasang masker
               squircle-nya sendiri. Ikon yang sudah dibulatkan akan terlihat
               dibulatkan dua kali.
*/
const VARIANTS = {
  any: svg({ radius: 8, scale: 0.88 }),
  maskable: svg({ radius: 0, scale: 0.74 }),
  apple: svg({ radius: 0, scale: 0.88 }),
}

/* ---------------------------------------------------------- rasterisasinya */

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH

  const candidates = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  const cache = join(process.env.HOME ?? '', '.cache/ms-playwright')
  if (existsSync(cache)) {
    for (const dir of readdirSync(cache).filter((name) => name.startsWith('chromium-')).sort().reverse()) {
      candidates.unshift(join(cache, dir, 'chrome-linux64/chrome'), join(cache, dir, 'chrome-linux/chrome'))
    }
  }

  const found = candidates.find((path) => existsSync(path))
  if (!found) {
    throw new Error(
      'Chromium tidak ditemukan. Pasang Chrome atau sebutkan lokasinya lewat CHROME_PATH.',
    )
  }
  return found
}

const chrome = findChrome()
const work = mkdtempSync(join(tmpdir(), 'sipandai-icons-'))

/** @param {keyof typeof VARIANTS} variant @param {number} size @param {string} out */
function raster(variant, size, out) {
  const page = join(work, `${variant}-${size}.html`)
  // SVG dibungkus HTML supaya ukuran jendela persis jadi ukuran berkasnya.
  writeFileSync(
    page,
    `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;overflow:hidden}svg{display:block;width:${size}px;height:${size}px}</style>
${VARIANTS[variant]}`,
  )

  execFileSync(
    chrome,
    [
      '--headless',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--force-color-profile=srgb',
      // Tanpa ini Chromium mengecat latar halaman putih, dan sudut membulat pada
      // varian `any` jadi kotak putih alih alih tembus pandang.
      '--default-background-color=00000000',
      `--window-size=${size},${size}`,
      `--screenshot=${join(publicDir, out)}`,
      `file://${page}`,
    ],
    { stdio: 'ignore' },
  )
  console.log(`  ${out}`)
}

console.log('Menulis ikon ke public/')
writeFileSync(join(publicDir, 'favicon.svg'), VARIANTS.any)
console.log('  favicon.svg')
raster('any', 192, 'icon-192.png')
raster('any', 512, 'icon-512.png')
raster('maskable', 512, 'icon-maskable-512.png')
raster('apple', 180, 'apple-touch-icon.png')

rmSync(work, { recursive: true, force: true })
console.log('Selesai.')
