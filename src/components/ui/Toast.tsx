import { useEffect } from 'react'
import { create } from 'zustand'
import { CheckCircleIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'

type ToastTone = 'success' | 'error'

interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}

interface ToastState {
  toasts: ToastItem[]
  push: (tone: ToastTone, message: string) => void
  dismiss: (id: number) => void
}

let nextId = 0

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (tone, message) => {
    const id = nextId++
    set((state) => ({ toasts: [...state.toasts, { id, tone, message }] }))
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

/** Notifikasi sementara untuk hasil aksi. Error yang butuh perbaikan tetap inline di form. */
export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
}

function ToastRow({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((state) => state.dismiss)

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(item.id), 4000)
    return () => window.clearTimeout(timer)
  }, [item.id, dismiss])

  const Icon = item.tone === 'success' ? CheckCircleIcon : WarningCircleIcon

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-panel border px-4 py-3 shadow-e2',
        item.tone === 'success'
          ? 'border-accent/25 bg-accent-soft text-accent-soft-fg'
          : 'border-danger/25 bg-danger-soft text-danger-soft-fg',
      )}
    >
      <Icon size={20} weight="fill" className="mt-px shrink-0" />
      <p className="flex-1 text-sm font-medium">{item.message}</p>
      <button
        type="button"
        aria-label="Tutup notifikasi"
        onClick={() => dismiss(item.id)}
        className="shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
      >
        <XIcon size={16} weight="bold" />
      </button>
    </div>
  )
}

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts)

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-90">
      {toasts.map((item) => (
        <ToastRow key={item.id} item={item} />
      ))}
    </div>
  )
}
