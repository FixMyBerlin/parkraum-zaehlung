import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

type Props = {
  open: boolean
  children: ReactNode
  className?: string
}

/**
 * Animated height collapse for disclosure-style content. Unlike scale/opacity
 * transitions, animating real layout height means surrounding layout grows/shrinks
 * smoothly instead of snapping.
 *
 * Uses CSS grid `0fr` / `1fr` instead of Motion `height: 'auto'`.
 * Content stays mounted while collapsed (required for measurement);
 * `inert` keeps the hidden content out of tab order and the a11y tree.
 */
export function MotionCollapse({ open, children, className }: Props) {
  return (
    <motion.div
      initial={false}
      animate={{ gridTemplateRows: open ? '1fr' : '0fr', opacity: open ? 1 : 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      inert={!open}
      className={twMerge('grid', className)}
    >
      <div className="overflow-hidden">{children}</div>
    </motion.div>
  )
}
