import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { CircleNotchIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover shadow-e1',
  secondary:
    'bg-surface text-ink border border-border-strong hover:bg-surface-hover shadow-e1',
  ghost: 'text-ink-muted hover:bg-surface-hover hover:text-ink',
  danger: 'bg-danger text-danger-fg hover:brightness-110 shadow-e1',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-13 px-6 text-base gap-2.5',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  /** Ikon di depan label. Gunakan glyph Phosphor, jangan SVG buatan tangan. */
  icon?: ReactNode
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      // `whitespace-nowrap` menjaga label tetap satu baris: tombol yang labelnya
      // membungkus ke baris kedua adalah tombol yang rusak.
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-control',
        'font-medium whitespace-nowrap transition-[background-color,transform,filter] duration-150',
        'active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <CircleNotchIcon size={18} weight="bold" className="animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Wajib: tombol ikon tanpa label butuh nama yang terbaca screen reader. */
  label: string
}

const iconSizes: Record<Size, string> = {
  sm: 'size-9',
  md: 'size-11',
  lg: 'size-13',
}

export function IconButton({
  variant = 'ghost',
  size = 'md',
  label,
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-control',
        'transition-[background-color,transform,filter] duration-150',
        'active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        iconSizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
