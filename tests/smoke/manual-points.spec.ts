import { expect, test, type Page } from '@playwright/test'

/**
 * Creates a project via the "+" reveal next to "Projekt auswählen", then selects
 * the given edges fixture file for it (mirrors tests/smoke/count-flow.spec.ts).
 */
async function createProjectAndStageFile(page: Page, name: string, fixturePath: string) {
  await page.getByTestId('create-project-toggle').click()
  await page.getByTestId('dataset-name-input').fill(name)
  await page.getByTestId('create-project').click()
  await expect(page.getByTestId('dataset-row-' + name)).toBeVisible()
  await page.getByTestId('edges-file-input').setInputFiles(fixturePath)
}

const kvOrigin = 'https://key-value-store.fixmycity.workers.dev'

type KvUser = { osm_uid: number; display_name: string }
type KvEntry = {
  id: string
  data: unknown
  tags: string[]
  version: number
  created_at: string
  updated_at: string
  created_by: KvUser
  updated_by: KvUser
}

const dummyUser: KvUser = { osm_uid: 1, display_name: 'e2e' }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Api-Key',
}

function parseKvUrl(raw: string) {
  const withoutQuery = raw.split('?')[0] ?? raw
  if (withoutQuery.endsWith('/v1/health')) return { type: 'health' as const }
  if (withoutQuery.endsWith('/me')) return { type: 'me' as const }
  if (withoutQuery.endsWith('/tags')) return { type: 'tags' as const }
  const marker = '/entries'
  const idx = withoutQuery.lastIndexOf(marker)
  if (idx === -1) return { type: 'unknown' as const }
  const after = withoutQuery.slice(idx + marker.length)
  if (after === '' || after === '/') return { type: 'collection' as const }
  return { type: 'entry' as const, id: decodeURIComponent(after.replace(/^\//, '')) }
}

/** A point clearly away from every edge in loerrach-sample.geojson (see its fixture). */
const EMPTY_SPOT = { lng: 7.664, lat: 47.6115 }

/**
 * Resolves once `window.__mainMap` (exposed in dev builds, see
 * src/shared/map/expose-main-map.ts) has projected `lngLat` to viewport pixel
 * coordinates, so a real `page.mouse` click lands exactly on that map location.
 */
async function viewportPointFor(page: Page, lngLat: { lng: number; lat: number }) {
  await page.waitForFunction(() => Boolean(window.__mainMap?.loaded()), undefined, {
    timeout: 15_000,
  })
  return page.evaluate((coords) => {
    const map = window.__mainMap!
    const projected = map.project([coords.lng, coords.lat])
    const rect = map.getCanvas().getBoundingClientRect()
    return { x: rect.left + projected.x, y: rect.top + projected.y }
  }, lngLat)
}

test.describe('manual count points', () => {
  test.beforeEach(async ({ page }) => {
    const saved = new Map<string, KvEntry>()

    await page.addInitScript(() => {
      localStorage.setItem('__osmAuth', JSON.stringify({ accessToken: 'e2e-osm-token' }))
    })

    await page.route(`${kvOrigin}/**`, async (route) => {
      const request = route.request()
      const method = request.method()
      if (method === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders, body: '' })
        return
      }

      const parsed = parseKvUrl(request.url())
      if (parsed.type === 'health' && method === 'GET') {
        await route.fulfill({ headers: corsHeaders, json: { ok: true } })
        return
      }
      if (parsed.type === 'me' && method === 'GET') {
        await route.fulfill({ headers: corsHeaders, json: { user: dummyUser, can_write: true } })
        return
      }
      if (parsed.type === 'me' && method === 'DELETE') {
        await route.fulfill({ status: 204, headers: corsHeaders, body: '' })
        return
      }
      if (parsed.type === 'tags' && method === 'GET') {
        const counts = new Map<string, number>()
        for (const entry of saved.values()) {
          for (const tag of entry.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
        }
        const tags = [...counts.entries()].map(([tag, count]) => ({ tag, count }))
        await route.fulfill({ headers: corsHeaders, json: { tags } })
        return
      }
      if (parsed.type === 'collection' && method === 'GET') {
        const tag = new URL(request.url()).searchParams.get('tag')
        const items = [...saved.values()].filter((entry) => (tag ? entry.tags.includes(tag) : true))
        await route.fulfill({ headers: corsHeaders, json: { items, next_cursor: null } })
        return
      }
      if (parsed.type === 'entry' && method === 'PUT') {
        const body = request.postDataJSON() as { data: unknown; tags?: string[] }
        const now = new Date().toISOString()
        const entry: KvEntry = {
          id: parsed.id,
          data: body.data,
          tags: body.tags ?? [],
          version: (saved.get(parsed.id)?.version ?? 0) + 1,
          created_at: saved.get(parsed.id)?.created_at ?? now,
          updated_at: now,
          created_by: dummyUser,
          updated_by: dummyUser,
        }
        saved.set(parsed.id, entry)
        await route.fulfill({ headers: corsHeaders, json: entry })
        return
      }
      if (parsed.type === 'entry' && method === 'DELETE') {
        saved.delete(parsed.id)
        await route.fulfill({ status: 204, headers: corsHeaders, body: '' })
        return
      }
      if (parsed.type === 'entry' && method === 'GET') {
        const entry = saved.get(parsed.id)
        if (!entry) {
          await route.fulfill({
            status: 404,
            headers: corsHeaders,
            json: { error: { code: 'not_found', message: 'not found' } },
          })
          return
        }
        await route.fulfill({ headers: corsHeaders, json: entry })
        return
      }

      await route.fulfill({
        status: 404,
        headers: corsHeaders,
        json: { error: { code: 'not_found', message: 'unhandled mock route' } },
      })
    })
  })

  test('places a point, edits it, drags it, and deletes it', async ({ page }) => {
    page.on('dialog', (dialog) => void dialog.accept())

    await page.goto('/')
    await createProjectAndStageFile(
      page,
      'loerrach-sample',
      'public/fixtures/loerrach-sample.geojson',
    )
    await page.getByTestId('import-dataset').click()
    await expect(page.getByTestId('progress-summary')).toContainText('0/6 Kanten')

    // Place: toggle draw mode, click an empty spot, land on the point's own form.
    const toggle = page.getByTestId('place-point-toggle')
    await expect(toggle).toBeEnabled()
    await toggle.click()
    const emptySpot = await viewportPointFor(page, EMPTY_SPOT)
    await page.mouse.click(emptySpot.x, emptySpot.y)

    await expect(page.getByTestId('selected-edge-name')).toHaveText('Manueller Punkt')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    // Placing an empty point still PUTs immediately — it's reachable from the list.
    await expect(page.getByTestId(/^manual-point-list-manual-/)).toBeVisible()

    const url = new URL(page.url())
    const pointId = url.searchParams.get('edge')
    expect(pointId).toMatch(/^manual-/)
    if (!pointId) throw new Error('no point id in the URL')

    // Edit occupancy — same CountGrid, same autosave as an edge count.
    await page.getByTestId('sunday-left-pkw').fill('3')
    await page.getByTestId('selected-edge-name').click()
    await expect(page.getByTestId('progress-summary')).toContainText('0/6 Kanten') // unaffected

    async function fetchStoredEntry() {
      return page.evaluate(
        async ([origin, id]) => {
          const response = await fetch(
            `${origin}/v1/projects/parkraum-zaehlung/entries/${encodeURIComponent('loerrach-sample/' + id)}`,
          )
          if (!response.ok) return null
          return response.json()
        },
        [kvOrigin, pointId] as const,
      )
    }

    await expect
      .poll(async () => {
        const entry = await fetchStoredEntry()
        return (entry as { data?: { periods?: { sunday?: { left?: { pkw?: number } } } } } | null)
          ?.data?.periods?.sunday?.left?.pkw
      })
      .toBe(3)

    const beforeDrag = (await fetchStoredEntry()) as { data: { mid_lat: number; mid_lng: number } }

    // Drag: mouse down/move/up on the marker element (react-map-gl <Marker draggable>).
    const marker = page.getByTestId('manual-point-marker')
    const markerBox = await marker.boundingBox()
    if (!markerBox) throw new Error('manual point marker not found')
    const startX = markerBox.x + markerBox.width / 2
    const startY = markerBox.y + markerBox.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 40, startY + 30, { steps: 5 })
    await page.mouse.up()

    await expect
      .poll(async () => {
        const entry = (await fetchStoredEntry()) as { data: { mid_lat: number; mid_lng: number } }
        return (
          entry.data.mid_lat !== beforeDrag.data.mid_lat ||
          entry.data.mid_lng !== beforeDrag.data.mid_lng
        )
      })
      .toBe(true)

    // The occupancy entered before the drag must survive it (no revert to stale coords).
    const afterDrag = (await fetchStoredEntry()) as {
      data: { periods: { sunday: { left: { pkw: number } } } }
    }
    expect(afterDrag.data.periods.sunday.left.pkw).toBe(3)

    // Delete: confirm, KV entry gone, selection cleared from the URL.
    await page.getByTestId('delete-count').click()
    await expect(page.getByText('Keine Kante gewählt')).toBeVisible()
    await expect(page.getByTestId(/^manual-point-list-manual-/)).toHaveCount(0)
    await expect.poll(async () => fetchStoredEntry()).toBeNull()
  })
})
