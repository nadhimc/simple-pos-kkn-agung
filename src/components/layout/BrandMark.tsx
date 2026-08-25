import { cn } from '@/lib/cn'

interface BrandMarkProps {
  storeName: string
  /** `dark` untuk latar sidebar gelap, `light` untuk latar permukaan terang. */
  tone?: 'dark' | 'light'
  compact?: boolean
  className?: string
}

/**
 * Monogram sederhana: satu bentuk geometris berisi huruf awal nama toko.
 * Sengaja tidak memakai ilustrasi SVG buatan tangan yang rumit.
 */
export function BrandMark({
  storeName,
  tone = 'dark',
  compact = false,
  className,
}: BrandMarkProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="size-9 shrink-0 select-none"
        aria-hidden
      >
        {/* Background rounded block */}
        <rect width="36" height="36" rx="10" fill="currentColor" className="text-accent" />
        
        {/* Gula Merah Sun (Brown Sugar) */}
        <circle cx="23" cy="14" r="4.5" fill="#d97706" className="dark:fill-[#f59e0b]" />
        
        {/* Mountain Peak (Semeru) */}
        <path
          d="M8 27 L18 12 L28 27"
          stroke="var(--accent-fg)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Coconut Leaf curve */}
        <path
          d="M27 27 Q30 19 26 14"
          stroke="#fef08a"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        
        {/* River curve at bottom */}
        <path
          d="M13 27 Q16 30 18 27 T23 27"
          stroke="#38bdf8"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {!compact ? (
        <span className="min-w-0">
          <span
            className={cn(
              'block truncate text-sm font-semibold tracking-tight',
              tone === 'dark' ? 'text-sidebar-ink-active' : 'text-ink',
            )}
          >
            {storeName}
          </span>
          <span
            className={cn(
              'block text-xs',
              tone === 'dark' ? 'text-sidebar-ink' : 'text-ink-subtle',
            )}
          >
            Kasir dan pembukuan
          </span>
        </span>
      ) : null}
    </div>
  )
}
