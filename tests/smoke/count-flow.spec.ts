import { expect, test, type Page } from '@playwright/test'

/**
 * Creates a project via the "+" reveal next to "Projekt auswählen", then selects
 * the given edges fixture file for it (the import target is always the selected
 * project — there is no free-text name field on the import side anymore).
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
      if (parsed.type === 'tags' && method === 'GET') {
        const counts = new Map<string, number>()
        for (const entry of saved.values()) {
          for (const tag of entry.tags) {
            counts.set(tag, (counts.get(tag) ?? 0) + 1)
          }
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

    await createProjectAndStageFile(
      page,
      'loerrach-sample',
      'public/fixtures/loerrach-sample.geojson',
    )
    await page.getByTestId('import-dataset').click()
    await expect(page.getByTestId('progress-summary')).toContainText('0/6 Kanten')

    await page.getByTestId('edge-list-ce-basler-nord').click()
    await expect(page.getByTestId('selected-edge-name')).toHaveText('Basler Straße')

    await page.getByTestId('sunday-left-pkw').fill('7')
    await page.getByTestId('sunday-left-motorrad').fill('1')
    await page.getByTestId('sunday-right-pkw').fill('5')
    await page.getByTestId('selected-edge-name').click()

    await expect(page.getByTestId('progress-summary')).toContainText('1/6 Kanten')

    await page.getByTestId('step-export').click()
    await expect(page.getByText('Gespeichert als e2e in der Zähl-Datenbank')).toBeVisible()

    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('export-json').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^counts-loerrach-sample-.*\.json$/)
  })

  test('opens the count database page and edits a row', async ({ page }) => {
    await page.goto('/')
    await createProjectAndStageFile(
      page,
      'loerrach-sample',
      'public/fixtures/loerrach-sample.geojson',
    )
    await page.getByTestId('import-dataset').click()
    await expect(page.getByTestId('progress-summary')).toContainText('0/6 Kanten')
    await page.getByTestId('edge-list-ce-basler-nord').click()
    await expect(page.getByTestId('selected-edge-name')).toHaveText('Basler Straße')
    await page.getByTestId('sunday-left-pkw').fill('7')
    await page.getByTestId('sunday-left-motorrad').fill('1')
    await page.getByTestId('sunday-right-pkw').fill('5')
    await page.getByTestId('selected-edge-name').click()
    await expect(page.getByTestId('progress-summary')).toContainText('1/6 Kanten')

    await page.getByRole('link', { name: 'Zähl-Datenbank' }).click()
    await expect(page.getByRole('heading', { name: 'Zähl-Datenbank', exact: true })).toBeVisible()
    const row = page.getByTestId('admin-row-loerrach-sample-ce-basler-nord')
    await expect(row).toContainText('7')
    await row.click()
    await page.getByTestId('admin-sunday-left-pkw').fill('9')
    await page.getByTestId('admin-save-count').click()
    await expect(row).toContainText('9')
  })

  test('keeps the active period after switching edges, and Sunday-only progress', async ({
    page,
  }) => {
    await page.goto('/')
    await createProjectAndStageFile(
      page,
      'loerrach-sample',
      'public/fixtures/loerrach-sample.geojson',
    )
    await page.getByTestId('import-dataset').click()
    await expect(page.getByTestId('progress-summary')).toContainText('0/6 Kanten')

    await page.getByTestId('edge-list-ce-basler-nord').click()
    await expect(page.getByTestId('selected-edge-name')).toHaveText('Basler Straße')

    // Fill Sunday (the default period) completely on this edge.
    await page.getByTestId('sunday-left-pkw').fill('7')
    await page.getByTestId('sunday-right-pkw').fill('5')
    await expect(page.getByTestId('progress-summary')).toContainText('1/6 Kanten')

    // Switch to Mittags via the D shortcut and fill it in — Sunday-only progress must
    // not change, since midday/evening are optional extras.
    await page.getByTestId('selected-edge-name').click()
    await page.keyboard.press('d')
    await expect(page.getByTestId('period-toggle-midday')).toHaveAttribute('aria-checked', 'true')
    await page.getByTestId('midday-left-pkw').fill('3')
    await expect(page.getByTestId('progress-summary')).toContainText('1/6 Kanten')

    // Switching edges keeps Mittags active, and lands on that period's own fields.
    await page.getByTestId('edge-list-ce-tumringer').click()
    await expect(page.getByTestId('selected-edge-name')).toHaveText('Tumringer Straße')
    await expect(page.getByTestId('period-toggle-midday')).toHaveAttribute('aria-checked', 'true')
  })

  test('a period hotkey keeps focus on the same side+category cell instead of jumping', async ({
    page,
  }) => {
    await page.goto('/')
    await createProjectAndStageFile(
      page,
      'loerrach-sample',
      'public/fixtures/loerrach-sample.geojson',
    )
    await page.getByTestId('import-dataset').click()
    await page.getByTestId('edge-list-ce-basler-nord').click()
    await expect(page.getByTestId('selected-edge-name')).toHaveText('Basler Straße')

    const rightMotorrad = page.getByTestId('sunday-right-motorrad')
    await rightMotorrad.click()
    await expect(rightMotorrad).toBeFocused()

    await page.keyboard.press('d')
    await expect(page.getByTestId('period-toggle-midday')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('midday-right-motorrad')).toBeFocused()
  })

  test('keeps a multiline note after switching edges and back', async ({ page }) => {
    await page.goto('/')
    await createProjectAndStageFile(
      page,
      'loerrach-sample',
      'public/fixtures/loerrach-sample.geojson',
    )
    await page.getByTestId('import-dataset').click()
    await expect(page.getByTestId('progress-summary')).toContainText('0/6 Kanten')

    await page.getByTestId('edge-list-ce-basler-nord').click()
    await expect(page.getByTestId('selected-edge-name')).toHaveText('Basler Straße')

    const note = page.locator('form[data-testid="count-form"] textarea[name="note"]')
    await note.fill('Zeile 1\nZeile 2')

    await page.getByTestId('edge-list-ce-tumringer').click()
    await expect(page.getByTestId('selected-edge-name')).toHaveText('Tumringer Straße')

    await page.getByTestId('edge-list-ce-basler-nord').click()
    await expect(page.getByTestId('selected-edge-name')).toHaveText('Basler Straße')
    await expect(note).toHaveValue('Zeile 1\nZeile 2')
  })

  test('selecting a remote-only project stays on the dataset step', async ({ page }) => {
    await page.goto('/')
    // Seed a project that exists only in the KV store (no local edges in this browser).
    await page.evaluate(async () => {
      await fetch(
        'https://key-value-store.fixmycity.workers.dev/v1/projects/parkraum-zaehlung/entries/loerrach%2Fce-basler-nord',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: {
              periods: {
                sunday: {
                  left: { pkw: 3, motorrad: null, lkw_bus: null },
                  right: { pkw: null, motorrad: null, lkw_bus: null },
                },
                midday: {
                  left: { pkw: null, motorrad: null, lkw_bus: null },
                  right: { pkw: null, motorrad: null, lkw_bus: null },
                },
                evening: {
                  left: { pkw: null, motorrad: null, lkw_bus: null },
                  right: { pkw: null, motorrad: null, lkw_bus: null },
                },
              },
              updated_at: '2026-01-01T00:00:00.000Z',
              counted_at: '2026-01-01T00:00:00.000Z',
              match_id: 'ce-basler-nord',
              match_status: 'id',
              mid_lat: 0,
              mid_lng: 0,
            },
            tags: ['loerrach'],
          }),
        },
      )
    })
    await page.reload()

    await expect(page.getByTestId('dataset-row-loerrach')).toBeVisible()
    await page.getByTestId('dataset-row-loerrach').click()

    // No local edges for "loerrach": selecting it must not jump to the count step —
    // the dataset-step Callout (only rendered by DatasetPanel) stays visible.
    await expect(page.getByText('Nur in der Zähl-Datenbank')).toBeVisible()
    await expect(page.getByTestId('edge-list-ce-basler-nord')).toHaveCount(0)
  })

  test('importing edges under an existing remote-only project name links them to its counts', async ({
    page,
  }) => {
    await page.goto('/')
    // Seed a project that exists only in the KV store, with one existing count entry.
    await page.evaluate(async () => {
      await fetch(
        'https://key-value-store.fixmycity.workers.dev/v1/projects/parkraum-zaehlung/entries/loerrach%2Fce-basler-nord',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: {
              periods: {
                sunday: {
                  left: { pkw: 3, motorrad: null, lkw_bus: null },
                  right: { pkw: 2, motorrad: null, lkw_bus: null },
                },
                midday: {
                  left: { pkw: null, motorrad: null, lkw_bus: null },
                  right: { pkw: null, motorrad: null, lkw_bus: null },
                },
                evening: {
                  left: { pkw: null, motorrad: null, lkw_bus: null },
                  right: { pkw: null, motorrad: null, lkw_bus: null },
                },
              },
              updated_at: '2026-01-01T00:00:00.000Z',
              counted_at: '2026-01-01T00:00:00.000Z',
              match_id: 'ce-basler-nord',
              match_status: 'id',
              mid_lat: 0,
              mid_lng: 0,
            },
            tags: ['loerrach'],
          }),
        },
      )
    })
    await page.reload()

    await expect(page.getByTestId('dataset-row-loerrach')).toBeVisible()
    await page.getByTestId('dataset-row-loerrach').click()
    await expect(page.getByText('Nur in der Zähl-Datenbank')).toBeVisible()

    // Import the sample edges file under the same project name — no name field to
    // fill in, the file's own metadata name is overridden by the selected project.
    await expect(page.getByTestId('import-dataset')).toBeDisabled()
    await page
      .getByTestId('edges-file-input')
      .setInputFiles('public/fixtures/loerrach-sample.geojson')
    await page.getByTestId('import-dataset').click()

    // Edges now show up, and the existing count carried over.
    await expect(page.getByTestId('progress-summary')).toContainText('1/6 Kanten')
  })
})
