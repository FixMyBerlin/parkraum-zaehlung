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

## OSM login

Public client id lives in [`src/config/app.const.ts`](src/config/app.const.ts) (`osmClientId`). No `.env` files, no client secret.

OSM OAuth 2 app must stay **non-confidential** (`read_prefs`) with both redirect URIs:

- `http://127.0.0.1:33478/osm-oauth-land.html`
- `https://fixmyberlin.github.io/parkraum-zaehlung/osm-oauth-land.html`

Login uses [`osm-auth`](https://github.com/osmlab/osm-auth) in `singlepage` mode. Writes to the KV API require a logged-in OSM user (`write_access: any_osm_user`).

## Storage

- Counts: production KV Worker (`kvBaseUrl` / `kvProject` / `kvApiKey` in `app.const.ts`). Reads are public; writes send `Authorization: Bearer <OSM token>`.
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
