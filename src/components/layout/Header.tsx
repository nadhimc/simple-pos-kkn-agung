import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ListIcon,
  MoonIcon,
  ShoppingCartSimpleIcon,
  SignOutIcon,
  SunIcon,
  UserCircleIcon,
} from '@phosphor-icons/react'
import { cn } from '@/lib/cn'
import { useTheme } from '@/hooks/useTheme'
import { displayNameOf, useAuth } from '@/contexts/AuthContext'
import { Badge, Button, IconButton } from '@/components/ui'
import { formatPhone } from '@/lib/phone'
import { InstallAppButton } from './InstallAppButton'
import type { NavItem } from './navigation'

interface HeaderProps {
  current?: NavItem
  onOpenMobileNav: () => void
}

function UserMenu() {
  const { user, appUser, tenant, signOutUser } = useAuth()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex items-center gap-2 rounded-control py-1.5 pr-2 pl-1.5 transition-colors',
          'text-ink-muted hover:bg-surface-hover hover:text-ink',
        )}
      >
        <UserCircleIcon size={26} weight="regular" className="shrink-0" />
        <span className="hidden max-w-32 truncate text-sm font-medium sm:block">
          {displayNameOf(user, appUser)}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-panel border border-border bg-surface shadow-e3"
        >
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-ink">
                {displayNameOf(user, appUser)}
              </p>
              {appUser ? (
                <Badge tone="accent" className="capitalize">
                  {appUser.role}
                </Badge>
              ) : null}
            </div>
            <p className="truncate text-xs text-ink-muted">
              {user?.email || formatPhone(user?.phoneNumber ?? '')}
            </p>
            {tenant ? (
              <p className="truncate text-xs text-ink-subtle">{tenant.name}</p>
            ) : null}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOutUser()}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <SignOutIcon size={18} weight="bold" />
            Keluar
          </button>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Header tetap sama di semua halaman. Judulnya dibaca dari konfigurasi
 * navigasi, jadi halaman baru tidak perlu menyentuh berkas ini.
 */
export function Header({ current, onOpenMobileNav }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const { isAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur-md sm:px-6">
      <IconButton
        label="Buka menu"
        size="sm"
        onClick={onOpenMobileNav}
        className="lg:hidden"
      >
        <ListIcon size={20} weight="bold" />
      </IconButton>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold tracking-tight text-ink">
          {current?.label ?? 'Halaman tidak ditemukan'}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {/* Admin tidak punya layar kasir, jadi pintasannya pun tidak ada. */}
        {!isAdmin && location.pathname !== '/kasir' ? (
          <Button
            size="sm"
            className="hidden sm:inline-flex"
            icon={<ShoppingCartSimpleIcon size={17} weight="bold" />}
            onClick={() => navigate('/kasir')}
          >
            Transaksi baru
          </Button>
        ) : null}

        <InstallAppButton className="hidden sm:inline-flex" />

        <IconButton
          label={theme === 'dark' ? 'Gunakan mode terang' : 'Gunakan mode gelap'}
          size="sm"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? (
            <SunIcon size={19} weight="bold" />
          ) : (
            <MoonIcon size={19} weight="bold" />
          )}
        </IconButton>

        <UserMenu />
      </div>
    </header>
  )
}
