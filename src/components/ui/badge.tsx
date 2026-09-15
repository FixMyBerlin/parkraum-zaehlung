import clsx from 'clsx'
import type React from 'react'

const colors = {
  zinc: 'bg-zinc-500/15 text-zinc-700 dark:bg-white/5 dark:text-zinc-400',
  green: 'bg-green-500/15 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  amber: 'bg-amber-400/20 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400',
  red: 'bg-red-500/15 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  sky: 'bg-sky-500/15 text-sky-700 dark:bg-sky-400/10 dark:text-sky-400',
}

type BadgeProps = {
  color?: keyof typeof colors
  className?: string
} & Omit<React.ComponentPropsWithoutRef<'span'>, 'color'>

/** Small pill for status/count indicators, based on Tailwind Plus Catalyst's Badge. */
export function Badge({ color = 'zinc', className, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={clsx(
        className,
        'inline-flex items-center gap-x-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium forced-colors:outline',
        colors[color],
      )}
    />
  )
}
