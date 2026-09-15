import { describe, expect, it } from 'vitest'
import { routerSearch } from '@/shared/routing/router-search'
import { dataSearchSchema, indexSearchSchema } from '@/shared/routing/search-schema'

function roundTrip(search: Record<string, unknown>) {
  return indexSearchSchema.parse(routerSearch.parse(routerSearch.stringify(search)))
}

describe('routerSearch', () => {
  it('keeps the map param readable instead of percent-encoding the slashes', () => {
    expect(routerSearch.stringify({ map: '13.5/52.4918/13.4261' })).toBe(
      '?map=13.5/52.4918/13.4261',
    )
  })

  it('round-trips an all-digit edge id as a string', () => {
    // `parseSearch` JSON-parses values, so `edge=12345` comes back as a number.
    expect(roundTrip({ edge: '12345' }).edge).toBe('12345')
  })

  it('round-trips an all-digit dataset slug as a string', () => {
    expect(roundTrip({ dataset: '2026' }).dataset).toBe('2026')
  })

  it('round-trips match as a string', () => {
    expect(roundTrip({ match: 'ce-old' }).match).toBe('ce-old')
  })

  it('round-trips the flags', () => {
    const search = roundTrip({ parkings: true, uncounted: false })
    expect(search.parkings).toBe(true)
    expect(search.uncounted).toBe(false)
  })

  it('round-trips step=export', () => {
    expect(roundTrip({ step: 'export' }).step).toBe('export')
  })

  it('drops the former login step from the URL', () => {
    expect(roundTrip({ step: 'login' }).step).toBeUndefined()
  })

  it('round-trips the ELI background slug', () => {
    expect(roundTrip({ bg: 'osm-mapnik' }).bg).toBe('osm-mapnik')
  })

  it('drops an empty bg', () => {
    expect(roundTrip({ bg: '' }).bg).toBeUndefined()
    expect(roundTrip({ bg: '   ' }).bg).toBeUndefined()
  })
})

describe('dataSearchSchema', () => {
  it('round-trips dataset, edge, and q', () => {
    const search = dataSearchSchema.parse(
      routerSearch.parse(routerSearch.stringify({ dataset: '2026', edge: '12345', q: 'note' })),
    )
    expect(search).toEqual({ dataset: '2026', edge: '12345', q: 'note' })
  })

  it('drops empty strings', () => {
    expect(dataSearchSchema.parse({ dataset: '  ', edge: '', q: undefined })).toEqual({
      dataset: undefined,
      edge: undefined,
      q: undefined,
    })
  })
})
