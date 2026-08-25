import { cn } from '@/lib/cn'

interface VillageLandscapeProps {
  className?: string
  tone?: 'dark' | 'light'
}

/**
 * VillageLandscape
 * Ilustrasi lanskap pedesaan minimalis (Gunung Semeru, sungai, pohon kelapa, dan matahari gula merah).
 * Dibuat bersih (clean line-art) agar tidak membuat aplikasi terkesan terlalu ramai.
 */
export function VillageLandscape({ className, tone = 'dark' }: VillageLandscapeProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-panel border p-4 transition-all duration-300',
        tone === 'dark'
          ? 'border-sidebar-border bg-zinc-900/30 text-sidebar-ink'
          : 'border-border bg-surface-2 text-ink-muted',
        className,
      )}
    >
      <svg
        viewBox="0 0 300 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full"
      >
        <defs>
          {/* Gradasi warna Gula Merah kelapa khas Jugosari */}
          <linearGradient id="gulaMerahGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d97706" /> {/* amber-600 */}
            <stop offset="100%" stopColor="#78350f" /> {/* amber-900 */}
          </linearGradient>
          {/* Gradasi aliran sungai pegunungan dingin */}
          <linearGradient id="riverGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* 1. Unsur Gula Merah (Matahari terbit berbentuk kepingan gula kelapa) */}
        <circle
          cx="170"
          cy="50"
          r="20"
          fill="url(#gulaMerahGrad)"
          className="opacity-90 filter drop-shadow-[0_2px_8px_rgba(217,119,6,0.3)]"
        />

        {/* 2. Pegunungan (Gunung Semeru di Jugosari) */}
        {/* Gunung Belakang (Siluet tipis) */}
        <path
          d="M50 100 L120 40 L180 100"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={tone === 'dark' ? 'text-zinc-700' : 'text-zinc-300'}
        />
        {/* Gunung Depan (Lebih tebal dan bertekstur lipatan lahar gunung) */}
        <path
          d="M90 100 L160 25 L220 100"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={tone === 'dark' ? 'text-accent' : 'text-accent'}
        />
        {/* Punggungan gunung */}
        <path
          d="M160 25 Q158 55 175 100"
          stroke="currentColor"
          strokeWidth="1.5"
          className={tone === 'dark' ? 'text-accent-hover/70' : 'text-accent-hover/70'}
        />

        {/* 3. Sungai Berkelok (Aliran lahar dingin/sungai Jugosari Lumajang) */}
        <path
          d="M150 93 Q140 100 152 108 T130 120"
          stroke="url(#riverGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 4. Pohon Kelapa (Unsur nira kelapa nenas penghasil gula merah) */}
        {/* Batang Pohon Kelapa */}
        <path
          d="M245 100 Q235 65 220 45"
          stroke={tone === 'dark' ? '#b45309' : '#854d0e'}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Daun-daun Kelapa */}
        <path
          d="M220 45 Q200 42 188 50"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={tone === 'dark' ? 'text-accent-hover' : 'text-accent-hover'}
        />
        <path
          d="M220 45 Q205 52 198 67"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={tone === 'dark' ? 'text-accent-hover' : 'text-accent-hover'}
        />
        <path
          d="M220 45 Q235 38 248 44"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={tone === 'dark' ? 'text-accent-hover' : 'text-accent-hover'}
        />
        <path
          d="M220 45 Q233 54 238 68"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={tone === 'dark' ? 'text-accent-hover' : 'text-accent-hover'}
        />
        <path
          d="M220 45 Q220 30 212 18"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={tone === 'dark' ? 'text-accent-hover' : 'text-accent-hover'}
        />
        {/* Buah Kelapa */}
        <circle cx="217" cy="48" r="2.5" fill="#fef08a" />
        <circle cx="222" cy="47" r="3" fill="#fef08a" />

        {/* Garis Tanah/Bukit */}
        <path
          d="M20 100 Q80 94 150 100 T280 100"
          stroke="currentColor"
          strokeWidth="1"
          className={tone === 'dark' ? 'text-zinc-800' : 'text-zinc-300'}
        />
      </svg>

      {/* Label kecil nuansa pedesaan secara estetik */}
      <div className="mt-2.5 flex items-center justify-between text-[10px] font-medium tracking-wider uppercase opacity-75">
        <span>Kawasan Jugosari</span>
        <span>Lereng Semeru</span>
      </div>
    </div>
  )
}
