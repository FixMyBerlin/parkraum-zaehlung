# Parkraum-Zählung

Web mask to count parked vehicles per street edge (left/right: car, motorcycle, truck/bus). Counts stay in the browser until the shared key-value API is ready.

Dev server: [http://127.0.0.1:33478](http://127.0.0.1:33478) (fixed host and port so OSM OAuth redirect URIs stay stable).

## Run

```bash
bun install
bun run dev
```

Then click **Testdatensatz laden** or upload `public/fixtures/loerrach-sample.geojson`.

```bash
bun run check
bun run e2e
```

## OSM login

Register a **non-confidential** OSM OAuth 2 application (`read_prefs`) with both redirect URIs:

- `http://127.0.0.1:33478/osm-oauth-land.html`
- `https://fixmyberlin.github.io/parkraum-zaehlung/osm-oauth-land.html`

Put the public client id in [`src/config/app.const.ts`](src/config/app.const.ts) (`osmClientId`). No `.env` files.

Login uses [`osm-auth`](https://github.com/osmlab/osm-auth) in `singlepage` mode. Counts still go to `localStorage` until `kvBaseUrl` is set.

## Storage workaround (until the KV API exists)

- Counts: `localStorage` key `pz:counts:<dataset>`
- Edge snapshots: IndexedDB (`idb-keyval`)
- Hand files around with **JSON exportieren** / **JSON importieren** (newer `updated_at` wins)

When the Cloudflare KV API is live, set `kvBaseUrl`, `kvProject`, and `kvApiKey` in `app.const.ts`. The `KvCountStore` adapter is already wired.

## Contracts

### Edges GeoJSON v1

`FeatureCollection` of `LineString`s. `metadata.dataset` is optional; the UI asks for a name if it is missing.

Properties: `id`, `name`, `highway`, `road`, `way_ids`, `way_reversed`, `start_node`, `end_node`, `length`, `azimuth`, `capacity_left`, `capacity_right`, `parking_left`, `parking_right`.

Left/right are relative to the edge direction (OSM direction of the longest constituent way).

### Counts

One record per edge: `left` / `right` each `{ pkw, motorrad, lkw_bus }` (integer or `null`), plus `note?`, `updated_at`, `updated_by?`.

## Deploy

GitHub Pages workflow is in `.github/workflows/deploy-pages.yml`. Production base path: `/parkraum-zaehlung/`.
