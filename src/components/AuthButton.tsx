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
      <div className="flex items-center gap-2">
        <p className="max-w-36 truncate text-sm/5 font-medium text-white">{displayName}</p>
        <Button outline onClick={auth.logout}>
          Abmelden
        </Button>
      </div>
    )
  }

  return (
    <Button color="sky" onClick={auth.login}>
      Anmelden
    </Button>
  )
}
