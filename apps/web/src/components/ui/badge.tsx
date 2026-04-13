import { type ReactNode } from 'react'
import { clsx } from 'clsx'

type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral'

const variants: Record<BadgeVariant, string> = {
  success: 'bg-brand-50 text-brand-600 ring-brand-200',
  danger:  'bg-red-50 text-red-600 ring-red-200',
  warning: 'bg-amber-50 text-amber-600 ring-amber-200',
  info:    'bg-blue-50 text-blue-600 ring-blue-200',
  neutral: 'bg-gray-100 text-gray-600 ring-gray-200',
}

export function Badge({ children, variant = 'neutral' }: { children: ReactNode; variant?: BadgeVariant }) {
  return (
    <span className={clsx(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
      variants[variant]
    )}>
      {children}
    </span>
  )
}

export function FlagStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    active:   'success',
    killed:   'danger',
    inactive: 'neutral',
    running:  'success',
    paused:   'warning',
    stopped:  'neutral',
    draft:    'info',
    archived: 'neutral',
  }
  return <Badge variant={map[status] ?? 'neutral'}>{status}</Badge>
}
