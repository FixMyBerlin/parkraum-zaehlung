import { expect, test, type Page } from '@playwright/test'

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

/** A minimal valid CountRecord (see src/shared/counts/schema.ts). */
function validRecord(overrides: Partial<Record<string, unknown>> = {}) {
  const side = { pkw: null, motorrad: null, lkw_bus: null }
  const occupancy = { left: side, right: side }
  return {
    periods: { sunday: occupancy, midday: occupancy, evening: occupancy },
    updated_at: '2026-01-01T00:00:00.000Z',
    counted_at: '2026-01-01T00:00:00.000Z',
    match_id: '',
    match_status: 'id',
    mid_lat: 0,
    mid_lng: 0,
    ...overrides,
  }
}

/** An old-format record (top-level left/right, no `periods`) — fails countRecordSchema. */
function legacyRecord() {
  return {
    left: { pkw: 1, motorrad: 0, lkw_bus: 0 },
    right: { pkw: 2, motorrad: 0, lkw_bus: 0 },
    updated_at: '2025-01-01T00:00:00.000Z',
  }
}

type SeedEntry = { id: string; data: unknown; tags: string[] }

async function setupKvMock(page: Page, options: { displayName?: string; seed?: SeedEntry[] } = {}) {
  const displayName = options.displayName ?? 'e2e'
  const user: KvUser = { osm_uid: 1, display_name: displayName }
  const now = '2026-01-01T00:00:00.000Z'
  const saved = new Map<string, KvEntry>()
  for (const item of options.seed ?? []) {
    saved.set(item.id, {
      id: item.id,
      data: item.data,
      tags: item.tags,
      version: 1,
      created_at: now,
      updated_at: now,
      created_by: user,
      updated_by: user,
    })
  }

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
      await route.fulfill({ headers: corsHeaders, json: { user, can_write: true } })
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
      const entry: KvEntry = {
        id: parsed.id,
        data: body.data,
        tags: body.tags ?? [],
        version: 1,
        created_at: now,
        updated_at: now,
        created_by: user,
        updated_by: user,
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

  return saved
}

test.describe('project admin on /data', () => {
  test('lists every project with its valid/invalid entry counts', async ({ page }) => {
    await setupKvMock(page, {
      seed: [
        { id: 'alpha/edge-1', data: validRecord(), tags: ['alpha'] },
        { id: 'alpha/edge-2', data: validRecord(), tags: ['alpha'] },
        { id: 'beta/edge-1', data: validRecord(), tags: ['beta'] },
        { id: 'beta/edge-legacy', data: legacyRecord(), tags: ['beta'] },
      ],
    })

    await page.goto('/data')
    await expect(page.getByTestId('projects-table')).toBeVisible()

    const alphaRow = page.getByTestId('project-row-alpha')
    await expect(alphaRow).toContainText('2/2 gültig')

    const betaRow = page.getByTestId('project-row-beta')
    await expect(betaRow).toContainText('1/2 gültig')

    // Invalid entries are visible and individually deletable.
    await page.getByTestId('project-show-invalid-beta').click()
    await expect(page.getByTestId('project-invalid-entry-beta-edge-legacy')).toBeVisible()
    await page.getByTestId('project-invalid-remove-beta-edge-legacy').click()
    await expect(betaRow).toContainText('1/1 gültig')
  })

  test('renaming a project moves its counts to the new name', async ({ page }) => {
    await setupKvMock(page, {
      seed: [
        { id: 'old-project/edge-1', data: validRecord(), tags: ['old-project'] },
        { id: 'old-project/edge-2', data: validRecord(), tags: ['old-project'] },
      ],
    })

    await page.goto('/data')
    await expect(page.getByTestId('project-row-old-project')).toBeVisible()

    await page.getByTestId('project-rename-button-old-project').click()
    await page.getByTestId('project-rename-input-old-project').fill('new-project')
    await page.getByTestId('project-rename-confirm-old-project').click()

    await expect(page.getByTestId('project-row-new-project')).toBeVisible()
    await expect(page.getByTestId('project-row-old-project')).not.toBeVisible()
    await expect(page.getByTestId('project-row-new-project')).toContainText('2/2 gültig')

    // The counts themselves moved, visible in the counts table below.
    await expect(page.getByTestId('admin-row-new-project-edge-1')).toBeVisible()
    await expect(page.getByTestId('admin-row-new-project-edge-2')).toBeVisible()
  })

  test('full project delete is disabled for a non-super-admin and enabled for tordans', async ({
    page,
  }) => {
    await setupKvMock(page, {
      displayName: 'e2e',
      seed: [{ id: 'proj1/edge-1', data: validRecord(), tags: ['proj1'] }],
    })
    await page.goto('/data')
    await expect(page.getByTestId('project-delete-button-proj1')).toBeDisabled()
  })

  test('super admin (tordans) can fully delete a project, including a legacy entry', async ({
    page,
  }) => {
    await setupKvMock(page, {
      displayName: 'tordans',
      seed: [
        { id: 'doomed/edge-1', data: validRecord(), tags: ['doomed'] },
        { id: 'doomed/edge-legacy', data: legacyRecord(), tags: ['doomed'] },
      ],
    })

    await page.goto('/data')
    const deleteButton = page.getByTestId('project-delete-button-doomed')
    await expect(deleteButton).toBeEnabled()
    await deleteButton.click()

    await page.getByTestId('project-delete-confirm-input-doomed').fill('doomed')
    await page.getByTestId('project-delete-confirm-button-doomed').click()

    await expect(page.getByTestId('project-row-doomed')).not.toBeVisible()
  })
})
