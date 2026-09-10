# Parkraum-Zählung

Web mask to count parked vehicles per street edge (left/right: car, motorcycle, truck/bus). Counts persist in the shared key-value API after OSM login.

Dev server: [http://127.0.0.1:33478](http://127.0.0.1:33478) (fixed host and port so OSM OAuth redirect URIs stay stable).

## Run

```bash
bun install
bun run dev
```

Download [Testdaten herunterladen (dann hochladen)](https://github.com/FixMyBerlin/parkraum-zaehlung/raw/main/public/fixtures/loerrach-sample.geojson), then upload the file with **Datei wählen**.

```bash
bun run check
bun run e2e
```

`@playwright/test` is pinned **exactly** and kept in sync with [tilda-geo](https://github.com/FixMyBerlin/tilda-geo) so both repos want the same browser build. Playwright ships no browsers in `node_modules`; they live in one shared cache (`~/Library/Caches/ms-playwright` on macOS) that every repo on the same version reuses. Matching the pin therefore means `bun run e2e` works with no download. Bump this pin together with the other repos, then run `bunx playwright install chromium` once — and `bunx playwright uninstall --all` occasionally, since old builds are never pruned automatically.

## OSM login

Public client id lives in [`src/config/app.const.ts`](src/config/app.const.ts) (`osmClientId`). No `.env` files, no client secret.

OSM OAuth 2 app must stay **non-confidential** (`read_prefs`) with both redirect URIs:

- `http://127.0.0.1:33478/osm-oauth-land.html`
- `https://fixmyberlin.github.io/parkraum-zaehlung/osm-oauth-land.html`

Login uses [`osm-api`](https://github.com/osmlab/osm-api-js) v4 in **redirect PKCE** mode (not popup: OSM sends `COOP: same-origin`). The land page is `public/osm-oauth-land.html`. Redirect URIs are already registered on the OSM OAuth app above.

Writes to the KV API require a logged-in OSM user (`Authorization: Bearer <OSM token>`).

## Storage

- Counts: production Cloudflare Worker at `https://key-value-store.fixmycity.workers.dev` (`kvBaseUrl` / `kvProject` / `kvApiKey` in `app.const.ts`). **Reads are public** (no OSM token). **Writes send the OSM Bearer token.** The SPA uses a vendored `@kv/client` from [key-value-db](https://github.com/FixMyBerlin/key-value-db) (`src/shared/kv-client/`). If KV is not configured, counts fall back to `localStorage`.
- Edge snapshots: IndexedDB (`idb-keyval`)
- Hand files around with **JSON exportieren** / **JSON importieren** (newer `updated_at` wins)

## Contracts

### Edges GeoJSON v1

`FeatureCollection` of `LineString`s. `metadata.dataset` is optional; the UI asks for a name if it is missing.

Properties: `id`, `name`, `highway`, `road`, `way_ids`, `way_reversed`, `start_node`, `end_node`, `length`, `azimuth`, `capacity_left`, `capacity_right`, `parking_left`, `parking_right`.

Left/right are relative to the edge direction (OSM direction of the longest constituent way).

### Counts

One record per edge: `left` / `right` each `{ pkw, motorrad, lkw_bus }` (integer or `null`), plus `note?`, `updated_at`, `updated_by?`.

## Deploy

GitHub Pages workflow is in `.github/workflows/deploy-pages.yml`. Production base path: `/parkraum-zaehlung/`.
