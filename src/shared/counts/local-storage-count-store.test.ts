import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createLocalStorageCountStore } from './local-storage-count-store'
import { emptyCountRecord } from './schema'

const memory = new Map<string, string>()

beforeEach(() => {
  memory.clear()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: (key: string) => {
        memory.delete(key)
      },
      clear: () => {
        memory.clear()
      },
    },
  })
})

afterEach(() => {
  memory.clear()
})

describe('LocalStorageCountStore', () => {
  it('puts, lists, gets and removes a record', async () => {
    const store = createLocalStorageCountStore()
    const record = {
      ...emptyCountRecord('2026-09-08T12:00:00.000Z'),
      left: { pkw: 4, motorrad: 1, lkw_bus: 0 },
    }
    await store.put('demo', 'ce-1', record)
    expect(await store.get('demo', 'ce-1')).toEqual(record)
    expect(Object.keys(await store.list('demo'))).toEqual(['ce-1'])
    await store.remove('demo', 'ce-1')
    expect(await store.get('demo', 'ce-1')).toBeUndefined()
  })

  it('merges with newer updated_at winning', async () => {
    const store = createLocalStorageCountStore()
    const older = {
      ...emptyCountRecord('2026-09-01T00:00:00.000Z'),
      left: { pkw: 1, motorrad: null, lkw_bus: null },
    }
    const newer = {
      ...emptyCountRecord('2026-09-08T00:00:00.000Z'),
      left: { pkw: 9, motorrad: null, lkw_bus: null },
    }
    await store.put('demo', 'ce-1', older)
    const merged = await store.merge('demo', { 'ce-1': newer, 'ce-2': older })
    expect(merged['ce-1']?.left.pkw).toBe(9)
    expect(merged['ce-2']?.left.pkw).toBe(1)
  })
})
