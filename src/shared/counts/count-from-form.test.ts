import { describe, expect, it } from 'vitest'
import { countRecordFromFormData, readSideCount } from './count-from-form'

function formData(entries: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

describe('countRecordFromFormData', () => {
  it('reads sides, note, and author', () => {
    const record = countRecordFromFormData(
      formData({
        left_pkw: '4',
        left_motorrad: '',
        left_lkw_bus: '0',
        right_pkw: '2',
        right_motorrad: '1',
        right_lkw_bus: '',
        note: 'Ecke',
      }),
      'tordans',
    )
    expect(record.left).toEqual({ pkw: 4, motorrad: null, lkw_bus: 0 })
    expect(record.right).toEqual({ pkw: 2, motorrad: 1, lkw_bus: null })
    expect(record.note).toBe('Ecke')
    expect(record.updated_by).toBe('tordans')
    expect(record.updated_at).toEqual(expect.any(String))
  })

  it('omits an empty note', () => {
    const record = countRecordFromFormData(formData({ note: '' }))
    expect(record.note).toBeUndefined()
    expect(readSideCount(formData({}), 'left')).toEqual({
      pkw: null,
      motorrad: null,
      lkw_bus: null,
    })
  })
})
