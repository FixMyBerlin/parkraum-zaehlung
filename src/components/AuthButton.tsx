import { useOsmAuth } from '@/components/shared/use-osm-auth'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'

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
    const label = `Abmelden (${displayName})`
    return (
      <Button outline onClick={auth.logout} title={label} aria-label={label}>
        Abmelden
      </Button>
    )
  }

  return (
    <Button color="sky" onClick={auth.login}>
      Anmelden
    </Button>
  )
}
