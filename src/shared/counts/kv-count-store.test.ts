import { afterEach, expect, test, vi } from 'vitest'
import { createKvClient } from '@/shared/kv-client'
import { createKvCountStore, osmLoginRequiredMessage } from './kv-count-store'
import { emptyCountRecord, type CountRecord } from './schema'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function jsonResponse(status: number, body: unknown) {
  const headers = new Headers()
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(body), { status, headers })
}

type FetchCall = Parameters<typeof fetch>

function readInit(call: FetchCall | undefined) {
  const [, init] = call ?? []
  if (init == null) throw new Error('expected a RequestInit')
  return init
}

function readUrl(call: FetchCall | undefined) {
  const [url] = call ?? []
  if (typeof url !== 'string') throw new Error('expected a string URL')
  return url
}

const osmUser = { osm_uid: 1, display_name: 'alice' }
const sampleRecordBase = emptyCountRecord('2026-09-08T12:00:00.000Z')
const sampleRecord: CountRecord = {
  ...sampleRecordBase,
  periods: {
    ...sampleRecordBase.periods,
    sunday: { ...sampleRecordBase.periods.sunday, left: { pkw: 4, motorrad: 1, lkw_bus: 0 } },
  },
}

function kvEntry(id: string, data: CountRecord, tags: string[]) {
  return {
    id,
    data,
    tags,
    version: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    created_by: osmUser,
    updated_by: osmUser,
  }
}

function testClient(getOsmToken: () => string | null = () => 'osm-token') {
  return createKvClient<CountRecord>({
    baseUrl: 'https://kv.example',
    project: 'parkraum-zaehlung',
    apiKey: 'key-1',
    getOsmToken,
  })
}

test('list paginates with tag query until next_cursor is null', async () => {
  const first = emptyCountRecord('2026-09-01T00:00:00.000Z')
  const second = emptyCountRecord('2026-09-02T00:00:00.000Z')
  const fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock
    .mockResolvedValueOnce(
      jsonResponse(200, {
        items: [kvEntry('dataset/edge-a', first, ['dataset'])],
        next_cursor: 'page-2',
      }),
    )
    .mockResolvedValueOnce(
      jsonResponse(200, {
        items: [kvEntry('dataset/edge-b', second, ['dataset'])],
        next_cursor: null,
      }),
    )

  const store = createKvCountStore(testClient())
  const records = await store.list('dataset')

  expect(records).toEqual({ 'edge-a': first, 'edge-b': second })
  expect(fetchMock).toHaveBeenCalledTimes(2)

  const firstUrl = new URL(readUrl(fetchMock.mock.calls[0]))
  expect(firstUrl.origin + firstUrl.pathname).toBe(
    'https://kv.example/v1/projects/parkraum-zaehlung/entries',
  )
  expect(firstUrl.searchParams.getAll('tag')).toEqual(['dataset'])
  expect(firstUrl.searchParams.get('match')).toBe('all')
  expect(firstUrl.searchParams.get('limit')).toBe('500')
  expect(firstUrl.searchParams.has('cursor')).toBe(false)

  const secondUrl = new URL(readUrl(fetchMock.mock.calls[1]))
  expect(secondUrl.searchParams.getAll('tag')).toEqual(['dataset'])
  expect(secondUrl.searchParams.get('match')).toBe('all')
  expect(secondUrl.searchParams.get('cursor')).toBe('page-2')
})

test('put sends { data, tags: [dataset] } with encoded id dataset%2Fedge', async () => {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValue(jsonResponse(200, kvEntry('dataset/edge', sampleRecord, ['dataset'])))
  vi.stubGlobal('fetch', fetchMock)

  const store = createKvCountStore(testClient())
  await store.put('dataset', 'edge', sampleRecord)

  expect(readUrl(fetchMock.mock.calls[0])).toBe(
    'https://kv.example/v1/projects/parkraum-zaehlung/entries/dataset%2Fedge',
  )
  const init = readInit(fetchMock.mock.calls[0])
  expect(init.method).toBe('PUT')
  const headers = new Headers(init.headers)
  expect(headers.get('X-Api-Key')).toBe('key-1')
  expect(headers.get('Authorization')).toBe('Bearer osm-token')
  expect(JSON.parse(init.body as string)).toEqual({ data: sampleRecord, tags: ['dataset'] })
})

test('put maps unauthenticated KvError to a login prompt', async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    jsonResponse(401, {
      error: {
        code: 'unauthenticated',
        message: 'OSM token required',
        details: { reason: 'missing' },
      },
    }),
  )
  vi.stubGlobal('fetch', fetchMock)

  const store = createKvCountStore(testClient(() => null))
  const err = await store.put('dataset', 'edge', sampleRecord).catch((error: unknown) => error)
  expect(err).toBeInstanceOf(Error)
  expect(err).not.toHaveProperty('code')
  expect((err as Error).message).toBe(osmLoginRequiredMessage)
})

test('listDatasetSummaries maps GET /tags and sorts by dataset name', async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    jsonResponse(200, {
      tags: [
        { tag: 'zeta', count: 2 },
        { tag: 'alpha', count: 10 },
      ],
    }),
  )
  vi.stubGlobal('fetch', fetchMock)

  const store = createKvCountStore(testClient())
  const summaries = await store.listDatasetSummaries()

  expect(readUrl(fetchMock.mock.calls[0])).toBe(
    'https://kv.example/v1/projects/parkraum-zaehlung/tags',
  )
  expect(summaries).toEqual([
    { dataset: 'alpha', entryCount: 10 },
    { dataset: 'zeta', entryCount: 2 },
  ])
})

test('listAll paginates with no tag query until next_cursor is null', async () => {
  const first = emptyCountRecord('2026-09-01T00:00:00.000Z')
  const second = emptyCountRecord('2026-09-02T00:00:00.000Z')
  const fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock
    .mockResolvedValueOnce(
      jsonResponse(200, {
        items: [kvEntry('alpha/edge-a', first, ['alpha'])],
        next_cursor: 'page-2',
      }),
    )
    .mockResolvedValueOnce(
      jsonResponse(200, {
        items: [kvEntry('beta/edge-b', second, ['beta'])],
        next_cursor: null,
      }),
    )

  const store = createKvCountStore(testClient())
  const entries = await store.listAll()

  expect(entries).toEqual([
    { dataset: 'alpha', edgeId: 'edge-a', record: first },
    { dataset: 'beta', edgeId: 'edge-b', record: second },
  ])
  expect(fetchMock).toHaveBeenCalledTimes(2)

  const firstUrl = new URL(readUrl(fetchMock.mock.calls[0]))
  expect(firstUrl.origin + firstUrl.pathname).toBe(
    'https://kv.example/v1/projects/parkraum-zaehlung/entries',
  )
  expect(firstUrl.searchParams.has('tag')).toBe(false)
  expect(firstUrl.searchParams.get('limit')).toBe('500')
  expect(firstUrl.searchParams.has('cursor')).toBe(false)

  const secondUrl = new URL(readUrl(fetchMock.mock.calls[1]))
  expect(secondUrl.searchParams.has('tag')).toBe(false)
  expect(secondUrl.searchParams.get('cursor')).toBe('page-2')
})

test('listAll skips invalid payloads and ids without a slash', async () => {
  const valid = emptyCountRecord('2026-09-01T00:00:00.000Z')
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    jsonResponse(200, {
      items: [
        kvEntry('alpha/edge-a', valid, ['alpha']),
        kvEntry('alpha/edge-bad', { not: 'a record' } as unknown as CountRecord, ['alpha']),
        kvEntry('noslash', valid, ['alpha']),
      ],
      next_cursor: null,
    }),
  )
  vi.stubGlobal('fetch', fetchMock)

  const store = createKvCountStore(testClient())
  const entries = await store.listAll()

  expect(entries).toEqual([{ dataset: 'alpha', edgeId: 'edge-a', record: valid }])
})

test('listAll splits on the first slash only', async () => {
  const record = emptyCountRecord('2026-09-01T00:00:00.000Z')
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    jsonResponse(200, {
      items: [kvEntry('alpha/edge/with/slash', record, ['alpha'])],
      next_cursor: null,
    }),
  )
  vi.stubGlobal('fetch', fetchMock)

  const store = createKvCountStore(testClient())
  const entries = await store.listAll()

  expect(entries).toEqual([{ dataset: 'alpha', edgeId: 'edge/with/slash', record }])
})
