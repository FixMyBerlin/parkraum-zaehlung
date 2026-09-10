import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from '@heroicons/react/20/solid'
import clsx from 'clsx'
import type React from 'react'

type CalloutTone = 'info' | 'warning' | 'error'

const tones: Record<
  CalloutTone,
  {
    wrap: string
    icon: string
    title: string
    body: string
    Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  }
> = {
  info: {
    wrap: 'bg-blue-50 dark:bg-blue-500/10 dark:outline dark:outline-blue-500/15',
    icon: 'text-blue-400 dark:text-blue-300',
    title: 'text-blue-800 dark:text-blue-100',
    body: 'text-blue-700 dark:text-blue-100/80',
    Icon: InformationCircleIcon,
  },
  warning: {
    wrap: 'bg-yellow-50 dark:bg-yellow-500/10 dark:outline dark:outline-yellow-500/15',
    icon: 'text-yellow-400 dark:text-yellow-300',
    title: 'text-yellow-800 dark:text-yellow-100',
    body: 'text-yellow-700 dark:text-yellow-100/80',
    Icon: ExclamationTriangleIcon,
  },
  error: {
    wrap: 'bg-red-50 dark:bg-red-500/15 dark:outline dark:outline-red-500/25',
    icon: 'text-red-400',
    title: 'text-red-800 dark:text-red-200',
    body: 'text-red-700 dark:text-red-200/80',
    Icon: XCircleIcon,
  },
}

type CalloutProps = {
  tone?: CalloutTone
  title?: React.ReactNode
  children?: React.ReactNode
  className?: string
} & Omit<React.ComponentPropsWithoutRef<'div'>, 'title' | 'children'>

/**
 * Compact status box based on Tailwind Plus Application UI → Feedback → Alerts
 * (“With description”, system / dark outline).
 */
export function Callout({ tone = 'info', title, children, className, ...props }: CalloutProps) {
  const style = tones[tone]
  const { Icon } = style

  return (
    <div
      role={tone === 'info' ? 'status' : 'alert'}
      {...props}
      className={clsx('rounded-md p-3', style.wrap, className)}
    >
      <div className="flex">
        <div className="shrink-0">
          <Icon aria-hidden="true" className={clsx('size-5', style.icon)} />
        </div>
        <div className="ml-3">
          {title ? <p className={clsx('text-sm font-medium', style.title)}>{title}</p> : null}
          {children ? (
            <div className={clsx(title ? 'mt-1' : null, 'text-sm', style.body)}>{children}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
