import { expect, test } from '@playwright/test'

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
  const marker = '/entries'
  const idx = withoutQuery.lastIndexOf(marker)
  if (idx === -1) return { type: 'unknown' as const }
  const after = withoutQuery.slice(idx + marker.length)
  if (after === '' || after === '/') return { type: 'collection' as const }
  return { type: 'entry' as const, id: decodeURIComponent(after.replace(/^\//, '')) }
}

test.describe('counting flow', () => {
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
        await route.fulfill({
          headers: corsHeaders,
          json: { user: dummyUser, can_write: true },
        })
        return
      }
      if (parsed.type === 'me' && method === 'DELETE') {
        await route.fulfill({ status: 204, headers: corsHeaders, body: '' })
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
        const now = '2026-01-01T00:00:00.000Z'
        const entry: KvEntry = {
          id: parsed.id,
          data: body.data,
          tags: body.tags ?? [],
          version: 1,
          created_at: now,
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

  test('loads the sample dataset, saves a count, and exports JSON', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Parkraum-Zählung' })).toBeVisible()

    await page
      .getByTestId('edges-file-input')
      .setInputFiles('public/fixtures/loerrach-sample.geojson')
    await expect(page.getByText('Datensatz loerrach-sample')).toBeVisible()
    await expect(page.getByText('Gespeichert als e2e auf der KV-API')).toBeVisible()
    await expect(page.getByTestId('progress-summary')).toContainText('0/6 Kanten')

    await page.getByTestId('edge-list-ce-basler-nord').click()
    await expect(page.getByTestId('selected-edge-name')).toHaveText('Basler Straße')

    await page.getByTestId('left-pkw').fill('7')
    await page.getByTestId('left-motorrad').fill('1')
    await page.getByTestId('right-pkw').fill('5')
    await page.getByTestId('save-count').click()

    await expect(page.getByTestId('progress-summary')).toContainText('1/6 Kanten')

    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('export-json').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^counts-loerrach-sample-.*\.json$/)
  })
})
