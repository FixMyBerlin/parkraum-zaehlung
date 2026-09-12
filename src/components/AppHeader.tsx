import { Bars3Icon } from '@heroicons/react/20/solid'
import { AuthButton } from '@/components/AuthButton'
import { StepNav, type StepNavItem } from '@/components/StepNav'
import type { AppStep } from '@/shared/routing/app-step'

type Props = {
  steps: StepNavItem[]
  onSelect: (id: AppStep) => void
  onOpenSidebar: () => void
}

export function AppHeader({ steps, onSelect, onOpenSidebar }: Props) {
  return (
    <header className="shrink-0 border-b border-white/10 bg-zinc-900">
      <div className="flex min-h-11 items-stretch">
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
        <StepNav steps={steps} onSelect={onSelect} />
        <div className="flex shrink-0 items-center pr-3 pl-2">
          <AuthButton />
        </div>
      </div>
    </header>
  )
}
