import { describe, expect, it } from 'vitest'
import {
  isManualCountId,
  isManualRecord,
  newManualPointId,
  withManualPointLocation,
} from './manual-points'
import { emptyCountRecord } from './schema'

describe('isManualCountId', () => {
  it('matches only the manual- prefix', () => {
    expect(isManualCountId('manual-abc-123')).toBe(true)
    expect(isManualCountId('ce-1')).toBe(false)
    expect(isManualCountId('_meta/loerrach')).toBe(false)
  })
})

describe('isManualRecord', () => {
  it('reads the source field', () => {
    expect(isManualRecord(emptyCountRecord(undefined, { source: 'manual' }))).toBe(true)
    expect(isManualRecord(emptyCountRecord(undefined, { source: 'imported' }))).toBe(false)
    expect(isManualRecord(emptyCountRecord())).toBe(false)
  })
})

describe('newManualPointId', () => {
  it('is prefixed and unique', () => {
    const a = newManualPointId()
    const b = newManualPointId()
    expect(isManualCountId(a)).toBe(true)
    expect(a).not.toBe(b)
  })
})

describe('withManualPointLocation', () => {
  it('updates only mid_lat/mid_lng and the last-edit bookkeeping', () => {
    const record = {
      ...emptyCountRecord('2026-01-01T00:00:00.000Z', {
        mid_lat: 47.61,
        mid_lng: 7.66,
        source: 'manual',
        created_by: 'alice',
        counted_at: '2026-01-01T00:00:00.000Z',
      }),
      note: 'kept',
    }
    const moved = withManualPointLocation(record, 7.7, 47.7, 'bob')
    expect(moved.mid_lng).toBe(7.7)
    expect(moved.mid_lat).toBe(47.7)
    expect(moved.updated_by).toBe('bob')
    expect(moved.updated_at).not.toBe(record.updated_at)
    // Everything else stays put.
    expect(moved.counted_at).toBe('2026-01-01T00:00:00.000Z')
    expect(moved.created_by).toBe('alice')
    expect(moved.source).toBe('manual')
    expect(moved.note).toBe('kept')
    expect(moved.periods).toBe(record.periods)
  })
})
