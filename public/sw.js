/*
  Service worker seminimal mungkin.

  Ada dua alasan ia diperlukan. Pertama, Chrome menuntut service worker dengan
  penangan fetch sebelum aplikasi dianggap bisa dipasang, jadi tanpa berkas ini
  tombol Pasang tidak akan pernah muncul. Kedua, kerangka aplikasinya jadi bisa
  dibuka tanpa jaringan, melengkapi cache Firestore yang sudah menyimpan datanya.

  Yang sengaja TIDAK dilakukan: menyimpan index.html sebagai jawaban pertama.
  Halaman selalu diambil dari jaringan lebih dulu, sebab index.html-lah yang
  menunjuk berkas bundel mana yang dipakai. Kalau ia dilayani dari cache, kasir
  bisa menjalankan versi lama berhari hari setelah perbaikan dikirim, dan
  kesalahan seperti itu nyaris mustahil disadari dari luar.
*/

const CACHE = 'ipandai-shell-v1'
const FALLBACK = '/index.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(FALLBACK)),
  )
  // Versi baru langsung menggantikan yang lama, tidak menunggu seluruh tab
  // ditutup. Aman karena tidak ada state yang dipegang service worker ini.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Firestore, Firebase Auth, reCAPTCHA, dan Google Fonts lewat apa adanya.
  // Menyentuhnya hanya akan mengacaukan langganan real time dan alur OTP.
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Salinan terbaru disimpan sebagai cadangan offline, bukan sebagai
          // jawaban utama.
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(FALLBACK, copy))
          return response
        })
        .catch(() => caches.match(FALLBACK)),
    )
    return
  }

  // Berkas di /assets/ punya hash isi pada namanya, jadi satu nama selamanya
  // berarti satu isi. Itu yang membuat cache-first di sini tidak bisa basi:
  // bundel baru selalu punya nama baru.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request)
        if (hit) return hit

        const response = await fetch(request)
        if (response.ok) cache.put(request, response.clone())
        return response
      }),
    )
  }
})
