import { describe, expect, it } from 'vitest'
import type { CountStore, RawCountEntry } from './count-store'
import { deleteAllRawEntries, removeRawEntries, renameKvDataset } from './dataset-admin'
import { emptyCountRecord, type CountRecord } from './schema'

/** Minimal in-memory CountStore, keyed like the real one: `${dataset}/${edgeId}`. */
function fakeStore(initial: Record<string, { raw: unknown; valid: boolean }> = {}) {
  const entries = new Map(Object.entries(initial))
  const meta = new Map<string, { createdAt: string; createdBy?: string }>()

  function idFor(dataset: string, edgeId: string) {
    return `${dataset}/${edgeId}`
  }

  const store: CountStore = {
    async list(dataset) {
      const result: Record<string, CountRecord> = {}
      for (const [id, entry] of entries) {
        if (!id.startsWith(`${dataset}/`) || !entry.valid) continue
        result[id.slice(dataset.length + 1)] = entry.raw as CountRecord
      }
      return result
    },
    async get(dataset, edgeId) {
      const entry = entries.get(idFor(dataset, edgeId))
      return entry?.valid ? (entry.raw as CountRecord) : undefined
    },
    async put(dataset, edgeId, record) {
      entries.set(idFor(dataset, edgeId), { raw: record, valid: true })
      return record
    },
    async remove(dataset, edgeId) {
      entries.delete(idFor(dataset, edgeId))
    },
    async merge(dataset, incoming) {
      for (const [edgeId, record] of Object.entries(incoming)) {
        await store.put(dataset, edgeId, record)
      }
      return store.list(dataset)
    },
    async listDatasetSummaries() {
      const counts = new Map<string, number>()
      for (const id of entries.keys()) {
        const dataset = id.split('/')[0]!
        counts.set(dataset, (counts.get(dataset) ?? 0) + 1)
      }
      return [...counts.entries()].map(([dataset, entryCount]) => ({ dataset, entryCount }))
    },
    async listAll() {
      return []
    },
    async listRawEntries(dataset) {
      const raw: RawCountEntry[] = []
      for (const [id, entry] of entries) {
        if (!id.startsWith(`${dataset}/`)) continue
        const edgeId = id.slice(dataset.length + 1)
        raw.push({
          id,
          edgeId,
          valid: entry.valid,
          record: entry.valid ? (entry.raw as CountRecord) : undefined,
          raw: entry.raw,
          updatedAt: '2026-01-01T00:00:00.000Z',
          version: 1,
        })
      }
      return raw
    },
    async getProjectMeta(dataset) {
      const found = meta.get(dataset)
      return found ? { dataset, ...found } : undefined
    },
    async putProjectMeta(dataset, data) {
      meta.set(dataset, data)
      return { dataset, ...data }
    },
    async removeProjectMeta(dataset) {
      meta.delete(dataset)
    },
    async listProjectMeta() {
      return [...meta.entries()].map(([dataset, data]) => ({ dataset, ...data }))
    },
  }
  return { store, entries, meta }
}

const sample = emptyCountRecord('2026-09-01T00:00:00.000Z')

describe('renameKvDataset', () => {
  it('moves valid entries to the new name and removes the old ones', async () => {
    const { store, entries } = fakeStore({
      'old/edge-a': { raw: sample, valid: true },
      'old/edge-b': { raw: sample, valid: true },
    })

    const outcome = await renameKvDataset(store, 'old', 'new')

    expect(outcome).toEqual({ migrated: 2, remainingInvalid: 0, failed: [] })
    expect(entries.has('old/edge-a')).toBe(false)
    expect(entries.has('old/edge-b')).toBe(false)
    expect(entries.get('new/edge-a')?.raw).toEqual(sample)
    expect(entries.get('new/edge-b')?.raw).toEqual(sample)
  })

  it('leaves invalid entries behind and reports them, without touching valid ones', async () => {
    const { store, entries } = fakeStore({
      'old/edge-a': { raw: sample, valid: true },
      'old/edge-legacy': { raw: { left: {}, right: {} }, valid: false },
    })

    const outcome = await renameKvDataset(store, 'old', 'new')

    expect(outcome.migrated).toBe(1)
    expect(outcome.remainingInvalid).toBe(1)
    expect(entries.has('old/edge-legacy')).toBe(true)
    expect(entries.has('new/edge-legacy')).toBe(false)
  })

  it('is idempotent: re-running after a partial rename only touches what remains', async () => {
    const { store, entries } = fakeStore({
      'old/edge-a': { raw: sample, valid: true },
      'old/edge-b': { raw: sample, valid: true },
    })

    // Simulate a partial failure: move edge-a by hand, as if the first run died
    // after the put but a retry had not yet removed the old copy.
    entries.set('new/edge-a', { raw: sample, valid: true })

    const outcome = await renameKvDataset(store, 'old', 'new')

    expect(outcome.migrated).toBe(2) // edge-a (re-put, harmless) + edge-b
    expect(entries.has('old/edge-a')).toBe(false)
    expect(entries.has('old/edge-b')).toBe(false)
    expect(entries.get('new/edge-a')?.raw).toEqual(sample)
    expect(entries.get('new/edge-b')?.raw).toEqual(sample)
  })

  it('does nothing when the old dataset has no entries', async () => {
    const { store } = fakeStore()
    const outcome = await renameKvDataset(store, 'old', 'new')
    expect(outcome).toEqual({ migrated: 0, remainingInvalid: 0, failed: [] })
  })

  it('moves the project meta entry to the new name', async () => {
    const { store, meta } = fakeStore({ 'old/edge-a': { raw: sample, valid: true } })
    await store.putProjectMeta('old', { createdAt: '2026-01-01T00:00:00.000Z', createdBy: 'alice' })

    await renameKvDataset(store, 'old', 'new')

    expect(meta.has('old')).toBe(false)
    expect(meta.get('new')).toEqual({ createdAt: '2026-01-01T00:00:00.000Z', createdBy: 'alice' })
  })

  it('is a no-op on meta when the old dataset has none', async () => {
    const { store, meta } = fakeStore({ 'old/edge-a': { raw: sample, valid: true } })
    await renameKvDataset(store, 'old', 'new')
    expect(meta.size).toBe(0)
  })

  it('migrates a manual point entry like any other id', async () => {
    const manualId = 'manual-11111111-1111-1111-1111-111111111111'
    const manualRecord = { ...sample, source: 'manual' as const, created_by: 'alice' }
    const { store, entries } = fakeStore({
      [`old/${manualId}`]: { raw: manualRecord, valid: true },
    })

    const outcome = await renameKvDataset(store, 'old', 'new')

    expect(outcome).toEqual({ migrated: 1, remainingInvalid: 0, failed: [] })
    expect(entries.has(`old/${manualId}`)).toBe(false)
    expect(entries.get(`new/${manualId}`)?.raw).toEqual(manualRecord)
  })
})

describe('removeRawEntries', () => {
  it('removes the requested entries, valid or not', async () => {
    const { store, entries } = fakeStore({
      'proj/edge-a': { raw: sample, valid: true },
      'proj/edge-legacy': { raw: { anything: true }, valid: false },
    })

    const outcome = await removeRawEntries(store, 'proj', ['edge-a', 'edge-legacy'])

    expect(outcome).toEqual({ removed: 2, failed: [] })
    expect(entries.size).toBe(0)
  })
})

describe('deleteAllRawEntries', () => {
  it('removes every entry tagged with the dataset, valid and invalid, and none other', async () => {
    const { store, entries } = fakeStore({
      'proj/edge-a': { raw: sample, valid: true },
      'proj/edge-legacy': { raw: { anything: true }, valid: false },
      'other/edge-a': { raw: sample, valid: true },
    })

    const outcome = await deleteAllRawEntries(store, 'proj')

    expect(outcome).toEqual({ removed: 2, failed: [] })
    expect(entries.has('other/edge-a')).toBe(true)
    expect(entries.has('proj/edge-a')).toBe(false)
    expect(entries.has('proj/edge-legacy')).toBe(false)
  })

  it('also removes the project meta entry', async () => {
    const { store, meta } = fakeStore({ 'proj/edge-a': { raw: sample, valid: true } })
    await store.putProjectMeta('proj', { createdAt: '2026-01-01T00:00:00.000Z' })

    await deleteAllRawEntries(store, 'proj')

    expect(meta.has('proj')).toBe(false)
  })

  it('removes manual point entries alongside edge counts, and none from another dataset', async () => {
    const manualId = 'manual-22222222-2222-2222-2222-222222222222'
    const { store, entries } = fakeStore({
      'proj/edge-a': { raw: sample, valid: true },
      [`proj/${manualId}`]: { raw: { ...sample, source: 'manual' as const }, valid: true },
      'other/edge-a': { raw: sample, valid: true },
    })

    const outcome = await deleteAllRawEntries(store, 'proj')

    expect(outcome).toEqual({ removed: 2, failed: [] })
    expect(entries.has(`proj/${manualId}`)).toBe(false)
    expect(entries.has('other/edge-a')).toBe(true)
  })
})
