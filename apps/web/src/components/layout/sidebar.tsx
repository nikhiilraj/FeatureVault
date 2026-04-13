'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { useWSStore } from '@/stores/ws.store'

const navItems = [
  { label: 'Flags',        href: '/dashboard/flags',       icon: '⚑' },
  { label: 'Experiments',  href: '/dashboard/experiments', icon: '⚗' },
  { label: 'SDK Keys',     href: '/dashboard/sdk-keys',    icon: '🔑' },
  { label: 'Audit Log',    href: '/dashboard/audit',       icon: '📋' },
  { label: 'Team',         href: '/dashboard/team',        icon: '👥' },
]

export function Sidebar() {
  const pathname = usePathname()
  const wsStatus = useWSStore(s => s.status)

  return (
    <aside className="flex h-full w-56 flex-col border-r border-gray-200 bg-gray-50">
      <div className="flex h-14 items-center border-b border-gray-200 px-4">
        <span className="text-sm font-bold text-gray-900 tracking-tight">FeatureVault</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
              pathname.startsWith(item.href)
                ? 'bg-brand-50 text-brand-600 font-medium'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={clsx('h-2 w-2 rounded-full', {
            'bg-brand-400': wsStatus === 'connected',
            'bg-amber-400 animate-pulse': wsStatus === 'connecting',
            'bg-gray-300': wsStatus === 'disconnected',
            'bg-red-400': wsStatus === 'error',
          })} />
          <span className="text-xs text-gray-500 capitalize">{wsStatus}</span>
        </div>
      </div>
    </aside>
  )
}
