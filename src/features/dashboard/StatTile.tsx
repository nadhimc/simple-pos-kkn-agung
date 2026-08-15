import type { ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'

interface StatTileProps {
  label: string
  value: string
  /** Konteks singkat di bawah angka, misalnya margin atau jumlah item. */
  hint?: string
  icon: ComponentType<IconProps>
  /** Sorot angka merah saat rugi. */
  negative?: boolean
}

export function StatTile({ label, value, hint, icon: Icon, negative }: StatTileProps) {
  return (
    <div className="rounded-panel border border-border bg-surface px-5 py-4 shadow-e1">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <Icon size={17} weight="regular" className="shrink-0 text-ink-subtle" />
      </div>
      <p
        className={cn(
          'mt-2 text-2xl font-semibold tracking-tight',
          negative ? 'text-danger' : 'text-ink',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink-subtle">{hint}</p> : null}
    </div>
  )
}
