import { isKvConfigured } from '@/config/app.const'
import { useOsmAuth } from '@/features/osm/use-osm-auth'

export function AuthButton() {
  const auth = useOsmAuth()

  if (!auth.configured) {
    return (
      <p className="max-w-56 text-right text-xs text-slate-500">
        OSM-Login nach Client-ID in <code>app.const.ts</code>
      </p>
    )
  }

  if (auth.authenticated) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-300">{auth.displayName ?? 'OSM'}</span>
        {!isKvConfigured() && <span className="text-amber-400">lokal</span>}
        <button
          type="button"
          className="rounded border border-slate-600 px-2 py-1 hover:bg-slate-800"
          onClick={auth.logout}
        >
          Abmelden
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      className="rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-500"
      onClick={auth.login}
    >
      Mit OSM anmelden
    </button>
  )
}
