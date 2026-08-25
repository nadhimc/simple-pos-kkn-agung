import { NavLink } from 'react-router-dom'
import { CaretLeftIcon, XIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'
import { navigationFor } from './navigation'
import { BrandMark } from './BrandMark'
import { VillageLandscape } from './VillageLandscape'

interface SidebarProps {
  /** Nama warung yang sedang dibuka, atau nama layanan untuk admin. */
  brandName: string
  isAdmin: boolean
  /** Rail ikon di desktop. Tidak berlaku di drawer mobile. */
  collapsed: boolean
  onToggleCollapsed: () => void
  /** Drawer mobile. */
  mobileOpen: boolean
  onCloseMobile: () => void
}

function NavList({
  isAdmin,
  collapsed,
  onNavigate,
}: {
  isAdmin: boolean
  collapsed: boolean
  onNavigate?: () => void
}) {
  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
      {navigationFor(isAdmin).map((group) => (
        <div key={group.label}>
          {!collapsed ? (
            <p className="px-3 pb-2 text-[11px] font-medium tracking-wide text-sidebar-ink/70 uppercase">
              {group.label}
            </p>
          ) : (
            <div aria-hidden className="mx-3 mb-2 h-px bg-sidebar-border" />
          )}

          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/' || item.path === '/admin'}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-3 rounded-control py-2.5 text-sm font-medium transition-colors',
                      collapsed ? 'justify-center px-0' : 'px-3',
                      isActive
                        ? 'bg-sidebar-active text-sidebar-ink-active'
                        : 'text-sidebar-ink hover:bg-white/5 hover:text-sidebar-ink-active',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Penanda aktif berupa garis, bukan titik warna dekoratif. */}
                      <span
                        aria-hidden
                        className={cn(
                          'absolute left-0 h-5 w-0.5 rounded-full bg-sidebar-bar transition-opacity',
                          isActive ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <item.icon
                        size={20}
                        weight={isActive ? 'fill' : 'regular'}
                        className="shrink-0"
                      />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function Sidebar({
  brandName,
  isAdmin,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  return (
    <>
      {/* Desktop: kolom tetap, lebarnya diatur grid di AppShell. */}
      <aside className="hidden h-[100dvh] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-sidebar-border',
            collapsed ? 'justify-center px-2' : 'px-4',
          )}
        >
          <BrandMark storeName={brandName} tone="dark" compact={collapsed} />
        </div>

        <NavList isAdmin={isAdmin} collapsed={collapsed} />

        {/* Dekorasi pedesaan di sidebar ketika melebar (expanded) */}
        {!collapsed ? (
          <div className="shrink-0 px-3 pb-4 select-none">
            <VillageLandscape tone="dark" className="border-sidebar-border bg-white/5 opacity-80" />
          </div>
        ) : null}

        <div className="shrink-0 border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Lebarkan menu' : 'Ciutkan menu'}
            className={cn(
              'flex w-full items-center gap-3 rounded-control py-2.5 text-sm font-medium',
              'text-sidebar-ink transition-colors hover:bg-white/5 hover:text-sidebar-ink-active',
              collapsed ? 'justify-center px-0' : 'px-3',
            )}
          >
            <CaretLeftIcon
              size={18}
              weight="bold"
              className={cn('shrink-0 transition-transform', collapsed && 'rotate-180')}
            />
            {!collapsed ? <span>Ciutkan menu</span> : null}
          </button>
        </div>
      </aside>

      {/* Mobile: drawer di atas konten. */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={onCloseMobile}
            className="absolute inset-0 bg-zinc-950/50"
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-sidebar shadow-e3">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border pr-2 pl-4">
              <BrandMark storeName={brandName} tone="dark" />
              <button
                type="button"
                aria-label="Tutup menu"
                onClick={onCloseMobile}
                className="grid size-10 place-items-center rounded-control text-sidebar-ink transition-colors hover:bg-white/5 hover:text-sidebar-ink-active"
              >
                <XIcon size={20} weight="bold" />
              </button>
            </div>
            <NavList isAdmin={isAdmin} collapsed={false} onNavigate={onCloseMobile} />
            {/* Dekorasi pedesaan di drawer mobile */}
            <div className="mt-auto shrink-0 p-4 select-none">
              <VillageLandscape tone="dark" className="border-sidebar-border bg-white/5 opacity-80" />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  )
}
