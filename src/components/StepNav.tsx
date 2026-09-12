import { CheckIcon } from '@heroicons/react/20/solid'
import type React from 'react'
import { Tooltip } from '@/components/shared/Tooltip/Tooltip'
import { cn } from '@/shared/cn'
import type { AppStep } from '@/shared/routing/app-step'

export type StepNavItem = {
  id: AppStep
  label: string
  shortLabel: string
  description: string
  status: 'complete' | 'current' | 'upcoming'
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  testId?: string
}

type Props = {
  steps: StepNavItem[]
  onSelect: (id: AppStep) => void
}

export function StepNav({ steps, onSelect }: Props) {
  return (
    <nav aria-label="Fortschritt">
      <ol role="list" className="flex w-full min-w-0 divide-x divide-white/10">
        {steps.map((item) => {
          const Icon = item.icon
          const current = item.status === 'current'
          return (
            <li
              key={item.id}
              className={cn(
                '@container relative min-w-0 overflow-hidden',
                current ? 'min-w-28 flex-2' : 'min-w-10 flex-1',
              )}
            >
              <Tooltip text={item.label} className="w-full min-w-0">
                <button
                  type="button"
                  data-testid={item.testId ?? `step-${item.id}`}
                  aria-current={current ? 'step' : undefined}
                  aria-label={current ? `${item.label}: ${item.description}` : item.label}
                  onClick={() => onSelect(item.id)}
                  className="relative flex w-full min-w-0 items-center gap-1.5 px-1.5 py-2 text-left"
                >
                  {item.status === 'complete' ? (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-500">
                      <CheckIcon className="size-4 text-white" aria-hidden="true" />
                    </span>
                  ) : current ? (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-sky-400">
                      <Icon className="size-3.5 text-sky-400" aria-hidden="true" />
                    </span>
                  ) : (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-white/15">
                      <Icon className="size-3.5 text-zinc-500" aria-hidden="true" />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    {current ? (
                      <span className="block truncate text-xs font-medium text-white">
                        {item.label}
                      </span>
                    ) : (
                      <>
                        <span className="hidden truncate text-xs font-medium text-zinc-300 @min-[4.5rem]:block @min-[6.5rem]:hidden">
                          {item.shortLabel}
                        </span>
                        <span className="hidden truncate text-xs font-medium text-zinc-300 @min-[6.5rem]:block">
                          {item.label}
                        </span>
                      </>
                    )}
                    {current ? (
                      <span
                        className="block truncate text-xs text-zinc-400 @max-[8rem]:hidden"
                        data-testid={item.id === 'count' ? 'progress-summary' : undefined}
                      >
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                  {current ? (
                    <span
                      className="absolute inset-x-0 bottom-0 h-0.5 bg-sky-400"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              </Tooltip>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
