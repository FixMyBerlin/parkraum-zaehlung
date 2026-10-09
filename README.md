# Parkraum-Zählung

Web mask to count parked vehicles per street edge (left/right, five vehicle classes, five count tabs). Counts persist in the shared Zähl-Datenbank after OSM login.

Dev server: [http://127.0.0.1:33478](http://127.0.0.1:33478) (fixed host and port so OSM OAuth redirect URIs stay stable).

## Run

```bash
bun install
bun run dev
```

Download [Testdaten herunterladen (dann hochladen)](https://github.com/FixMyBerlin/parkraum-zaehlung/raw/main/public/fixtures/loerrach-sample.geojson), then **Datei wählen**, check the dataset name, and click **Importieren**.

```bash
bun run check
bun run e2e
```

`@playwright/test` is pinned **exactly** and kept in sync with [tilda-geo](https://github.com/FixMyBerlin/tilda-geo) so both repos want the same browser build. Playwright ships no browsers in `node_modules`; they live in one shared cache (`~/Library/Caches/ms-playwright` on macOS) that every repo on the same version reuses. Matching the pin therefore means `bun run e2e` works with no download. Bump this pin together with the other repos, then run `bunx playwright install chromium` once for the whole fleet. Do not run `playwright uninstall --all`: the cache also holds builds for repos pinned to older Playwright versions, and removing them forces every one of those repos to re-download.

## OSM login

Public client id lives in [`src/config/app.const.ts`](src/config/app.const.ts) (`osmClientId`). No `.env` files, no client secret.

OSM OAuth 2 app must stay **non-confidential** (`read_prefs`) with both redirect URIs:

- `http://127.0.0.1:33478/osm-oauth-land.html`
- `https://fixmyberlin.github.io/parkraum-zaehlung/osm-oauth-land.html`

Login uses [`osm-api`](https://github.com/osmlab/osm-api-js) v4 in **redirect PKCE** mode (not popup: OSM sends `COOP: same-origin`). The land page is `public/osm-oauth-land.html`. Redirect URIs are already registered on the OSM OAuth app above.

Writes to the Zähl-Datenbank require a logged-in OSM user (`Authorization: Bearer <OSM token>`).

## Storage

Kanten liegen als Datei in deinem Browser. Zählungen liegen in der gemeinsamen Zähl-Datenbank. Beide gehören über den Projektnamen und die Kanten-IDs zusammen.

- **Zähl-Datenbank (counts):** production Cloudflare Worker at `https://key-value-store.fixmycity.workers.dev` (`kvBaseUrl` / `kvProject` / `kvApiKey` in `app.const.ts`). **Reads are public** (no OSM token). **Writes send the OSM Bearer token.** The SPA uses a vendored `@kv/client` from [key-value-db](https://github.com/FixMyBerlin/key-value-db) (`src/shared/kv-client/`). Worker project `parkraum-zaehlung` is the app tenant; each campaign is a **project slug** used as entry id prefix and tag. The slug cannot be renamed later without rewriting every count. Use a stable name without dates (e.g. `loerrach`), not a month stamp. `/data` lists and edits every count in that database and does not need the edges file.
- **Edges:** IndexedDB (`idb-keyval`), never uploaded. Keep the GeoJSON file so you can re-match counts on another browser. Import is file-picker only. Re-import under the same name replaces the local snapshot; if edge ids changed, the UI warns how many counts would no longer match.
- **Exports:** JSON of counts only (also when no edges are loaded). GeoJSON of edges + counts when a file is present (`count_status`: counted / uncounted / orphan with `geometry: null`). **Alle Zählungen exportieren** dumps every dataset from the database.

## Contracts

### Edges GeoJSON v1

`FeatureCollection` of `LineString`s. `metadata.dataset` is a suggestion; the UI always asks you to confirm a slug (`^[a-z0-9]+(-[a-z0-9]+)*$`, 3–60 chars), e.g. `loerrach`. Import skips `geometry: null` features (orphans from a previous GeoJSON export).

Properties: `id`, `name`, `highway`, `road`, `way_ids`, `way_reversed`, `start_node`, `end_node`, `length`, `azimuth`, `capacity_left`, `capacity_right`, `parking_left`, `parking_right`.

Left/right are relative to the edge direction (OSM direction of the longest constituent way).

### Counts

One record per edge: `periods.{sunday,midday,evening,period_4,period_5}`, each with `left` / `right` as `{ pkw, kleintransporter, lkw_bus, motorrad, sonstiges }` (integer or `null` for "not counted"), plus `note?`, `updated_at`, `updated_by?` and the match/midpoint fields.

The period and category keys are stored in the Zähl-Datenbank and name the GeoJSON export columns (`{period}_{side}_{category}`), so they are never renamed; only the labels in `src/shared/counts/schema.ts` change (`period_4`/`period_5` show as "Zeit 4"/"Zeit 5" until they get a real name). New keys are added with a default in `countRecordSchema`, so older records parse without rewriting the database: `kleintransporter`, `sonstiges`, `period_4` and `period_5` are simply empty on records stored before they existed.

Progress, the `x/2` badges, the map colours and **nur ungezählt** always describe the open count tab. An edge is done in a tab once both sides hold a value there.

**Mehrfachauswahl:** Shift+click edges on the map or in the list, then **Überall 0 eintragen** writes 0 in all categories to every still-open side of those edges in the open tab (for roundabouts and junctions). Existing values are kept.

## Deploy

GitHub Pages workflow is in `.github/workflows/deploy-pages.yml`. Production base path: `/parkraum-zaehlung/`.
