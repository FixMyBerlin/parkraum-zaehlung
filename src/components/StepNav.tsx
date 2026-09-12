import { cn } from '@/shared/cn'
import type { AppStep } from '@/shared/routing/app-step'

export type StepNavItem = {
  id: AppStep
  label: string
  description: string
  status: 'complete' | 'current' | 'upcoming'
  testId?: string
}

type Props = {
  steps: StepNavItem[]
  onSelect: (id: AppStep) => void
}

const activeFillClass = 'text-sky-500/25'

export function StepNav({ steps, onSelect }: Props) {
  return (
    <nav aria-label="Fortschritt" className="flex min-w-0 flex-1">
      <div className="flex items-center gap-2 pl-2 sm:pl-4">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-5 shrink-0" />
        <h1 className="text-sm font-medium tracking-wide text-zinc-200">Parkraum-Zählung</h1>
      </div>
      <ol role="list" className="flex min-w-0 flex-1 overflow-x-auto">
        {steps.map((item, index) => {
          const current = item.status === 'current'
          const last = index === steps.length - 1
          return (
            <li key={item.id} className={cn('relative flex min-w-0', current && 'z-10')}>
              <div className="flex h-full items-stretch">
                <span className="relative h-full w-6 shrink-0">
                  {current ? (
                    <svg
                      fill="currentColor"
                      viewBox="0 0 24 44"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                      className={cn('absolute inset-0 h-full w-full', activeFillClass)}
                    >
                      <path d="M24 0v44H0l22-22L0 0z" />
                    </svg>
                  ) : null}
                  <BreadcrumbChevron />
                </span>
                <button
                  type="button"
                  data-testid={item.testId ?? `step-${item.id}`}
                  aria-current={current ? 'step' : undefined}
                  aria-label={`${item.label}: ${item.description}`}
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    'flex h-full items-center truncate pr-4 pl-4 text-sm font-medium',
                    current ? 'bg-sky-500/25 text-white' : 'text-zinc-400 hover:text-zinc-200',
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      'ml-1.5 font-normal',
                      current ? 'text-sky-100/80' : 'text-zinc-500',
                    )}
                    data-testid={item.id === 'count' ? 'progress-summary' : undefined}
                  >
                    {item.description}
                  </span>
                </button>
                {current ? (
                  <svg
                    fill="currentColor"
                    viewBox="0 0 24 44"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    className={cn(
                      'h-full w-6 shrink-0',
                      activeFillClass,
                      !last && 'pointer-events-none absolute inset-y-0 left-full',
                    )}
                  >
                    <path d="M0 0l22 22L0 44z" />
                  </svg>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function BreadcrumbChevron() {
  return (
    <svg
      fill="currentColor"
      viewBox="0 0 24 44"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="relative h-full w-full text-white/10"
    >
      <path d="M.293 0l22 22-22 22h1.414l22-22-22-22H.293z" />
    </svg>
  )
}
