import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { useOsmAuth } from '@/features/osm/use-osm-auth'

export function AuthButton() {
  const auth = useOsmAuth()

  if (!auth.configured) {
    return (
      <Callout title="OSM-Login nicht konfiguriert">
        Client-ID in <code>app.const.ts</code> eintragen.
      </Callout>
    )
  }

  if (auth.authenticated) {
    const displayName = auth.displayName ?? 'OSM'
    return (
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-200 ring-1 ring-white/10"
        >
          {displayName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm/5 font-medium text-white">{displayName}</p>
        </div>
        <Button outline onClick={auth.logout}>
          Abmelden
        </Button>
      </div>
    )
  }

  return (
    <Button color="sky" className="w-full" onClick={auth.login}>
      Mit OSM anmelden
    </Button>
  )
}
