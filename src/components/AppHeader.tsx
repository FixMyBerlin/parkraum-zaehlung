import { Bars3Icon, CircleStackIcon } from '@heroicons/react/20/solid'
import { Link } from '@tanstack/react-router'
import { AuthButton } from '@/components/AuthButton'
import { Tooltip } from '@/components/shared/Tooltip/Tooltip'
import { StepNav, type StepNavItem } from '@/components/StepNav'
import { cn } from '@/shared/cn'
import type { AppStep } from '@/shared/routing/app-step'

type Props = {
  steps: StepNavItem[]
  onSelect: (id: AppStep) => void
  onOpenSidebar?: () => void
  dataPage?: boolean
}

export function AppHeader({ steps, onSelect, onOpenSidebar, dataPage = false }: Props) {
  return (
    <header className="shrink-0 border-b border-white/10 bg-zinc-900">
      <div className="flex min-h-11 items-stretch">
        {onOpenSidebar ? (
          <div className="flex shrink-0 items-center pl-1 lg:hidden">
            <button
              type="button"
              className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
              aria-label="Seitenleiste öffnen"
              onClick={onOpenSidebar}
            >
              <Bars3Icon className="size-5" aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <StepNav steps={steps} onSelect={onSelect} />
        <div className="flex shrink-0 items-center gap-1 pr-3 pl-2">
          <Tooltip text="Zähl-Datenbank — alle Zählungen ansehen und bearbeiten">
            <Link
              to="/data"
              aria-label="Zähl-Datenbank"
              aria-current={dataPage ? 'page' : undefined}
              className={cn(
                'rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white',
                dataPage && 'bg-white/10 text-white',
              )}
            >
              <CircleStackIcon className="size-5" aria-hidden="true" />
            </Link>
          </Tooltip>
          <AuthButton />
        </div>
      </div>
    </header>
  )
}
