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
  const initial = storeName.trim().charAt(0).toUpperCase() || 'W'

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-accent font-semibold text-accent-fg"
      >
        {initial}
      </span>
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
