import type { ComponentType, ReactNode } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import { WarningCircleIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'

/**
 * Skeleton mengikuti bentuk konten akhirnya, bukan spinner bulat generik,
 * supaya layout tidak melompat saat data tiba.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-control bg-surface-2', className)}
    />
  )
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-border" aria-hidden>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-5 py-3.5">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className={cn('h-4', colIndex === 0 ? 'w-2/5' : 'w-1/6')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-panel border border-border bg-surface p-5 shadow-e1',
        className,
      )}
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-36" />
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  )
}

interface EmptyStateProps {
  icon: ComponentType<IconProps>
  title: string
  description: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="grid size-12 place-items-center rounded-full bg-surface-2 text-ink-subtle">
        <Icon size={24} weight="regular" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-[46ch] text-sm text-ink-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  message: string
  action?: ReactNode
  className?: string
}

export function ErrorState({
  title = 'Gagal memuat data',
  message,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-panel border border-danger/30 bg-danger-soft px-5 py-4',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <WarningCircleIcon
          size={20}
          weight="fill"
          className="mt-0.5 shrink-0 text-danger"
        />
        <div>
          <h3 className="text-sm font-semibold text-danger-soft-fg">{title}</h3>
          <p className="mt-0.5 text-sm text-danger-soft-fg/90">{message}</p>
        </div>
      </div>
      {action}
    </div>
  )
}
