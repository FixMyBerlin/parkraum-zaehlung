import { haversineMeters, lineMidpoint, MATCH_RADIUS_M } from '@/shared/edges/line-midpoint'
import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'
import { type CountRecord, type MatchStatus } from './schema'

export type EdgeMatchInput = {
  id: string
  coordinates: ReadonlyArray<ReadonlyArray<number>>
  name?: string | null
  highway?: string | null
}

export type MatchCandidate = {
  id: string
  name?: string | null
  highway?: string | null
  distanceM: number
}

export type CountMatchStatus = MatchStatus | 'unresolved' | 'conflict'

export type CountMatchRow = {
  originalId: string
  record: CountRecord
  status: CountMatchStatus
  matchId: string
  candidates: MatchCandidate[]
  needsWrite: boolean
}

export type MatchCountsResult = {
  rows: CountMatchRow[]
  writes: Array<{ originalId: string; record: CountRecord }>
  unresolved: CountMatchRow[]
  summary: {
    id: number
    midpoint: number
    manual: number
    none: number
    unresolved: number
    conflict: number
  }
}

type EdgeWithMid = EdgeMatchInput & { mid: { lng: number; lat: number } }

function candidatesFor(
  record: CountRecord,
  edges: EdgeWithMid[],
  radiusM = MATCH_RADIUS_M,
): MatchCandidate[] {
  return edges
    .map((edge) => ({
      id: edge.id,
      name: edge.name,
      highway: edge.highway,
      distanceM: haversineMeters([record.mid_lng, record.mid_lat], [edge.mid.lng, edge.mid.lat]),
    }))
    .filter((candidate) => candidate.distanceM <= radiusM)
    .sort((left, right) => left.distanceM - right.distanceM || left.id.localeCompare(right.id))
}

function withMatch(record: CountRecord, matchId: string, matchStatus: MatchStatus): CountRecord {
  return {
    ...record,
    match_id: matchId,
    match_status: matchStatus,
  }
}

function row(
  originalId: string,
  record: CountRecord,
  status: CountMatchStatus,
  matchId: string,
  candidates: MatchCandidate[],
  nextRecord?: CountRecord,
): CountMatchRow {
  const recordToWrite = nextRecord ?? record
  const needsWrite =
    Boolean(nextRecord) &&
    (record.match_id !== recordToWrite.match_id ||
      record.match_status !== recordToWrite.match_status)
  return {
    originalId,
    record: recordToWrite,
    status,
    matchId,
    candidates,
    needsWrite,
  }
}

export function edgeMatchInputs(collection: CountingEdgesGeoJSON): EdgeMatchInput[] {
  return collection.features.map((feature) => ({
    id: feature.properties.id,
    coordinates: feature.geometry.coordinates,
    name: feature.properties.name,
    highway: feature.properties.highway,
  }))
}

export function matchCountsToEdges(
  records: Record<string, CountRecord>,
  edges: EdgeMatchInput[],
): MatchCountsResult {
  const withMids: EdgeWithMid[] = edges.map((edge) => ({
    ...edge,
    mid: lineMidpoint(edge.coordinates),
  }))
  const edgeIds = new Set(edges.map((edge) => edge.id))
  const claimed = new Set<string>()
  const pending: Array<{ originalId: string; record: CountRecord }> = []
  const built: CountMatchRow[] = []

  for (const [originalId, record] of Object.entries(records)) {
    if (record.match_status === 'none') {
      built.push(row(originalId, record, 'none', '', candidatesFor(record, withMids)))
      continue
    }
    if (edgeIds.has(originalId)) {
      claimed.add(originalId)
      built.push(row(originalId, record, 'id', originalId, [], withMatch(record, originalId, 'id')))
      continue
    }
    if (
      (record.match_status === 'manual' ||
        record.match_status === 'midpoint' ||
        record.match_status === 'id') &&
      record.match_id &&
      edgeIds.has(record.match_id)
    ) {
      claimed.add(record.match_id)
      built.push(row(originalId, record, record.match_status, record.match_id, []))
      continue
    }
    pending.push({ originalId, record })
  }

  for (const { originalId, record } of pending) {
    const nearby = candidatesFor(record, withMids)
    const unclaimed = nearby.filter((candidate) => !claimed.has(candidate.id))
    if (unclaimed.length === 1) {
      const matchId = unclaimed[0]!.id
      claimed.add(matchId)
      built.push(
        row(
          originalId,
          record,
          'midpoint',
          matchId,
          nearby,
          withMatch(record, matchId, 'midpoint'),
        ),
      )
      continue
    }
    built.push(row(originalId, record, 'unresolved', '', nearby))
  }

  const byMatchId = new Map<string, CountMatchRow[]>()
  for (const item of built) {
    if (!item.matchId || item.status === 'none') continue
    const list = byMatchId.get(item.matchId) ?? []
    list.push(item)
    byMatchId.set(item.matchId, list)
  }
  const rows = built.map((item) => {
    if (!item.matchId || item.status === 'none') return item
    const list = byMatchId.get(item.matchId)
    if (!list || list.length < 2) return item
    return { ...item, status: 'conflict' as const, needsWrite: false }
  })

  const writes = rows
    .filter((item) => item.needsWrite && (item.status === 'id' || item.status === 'midpoint'))
    .map((item) => ({ originalId: item.originalId, record: item.record }))

  const summary = {
    id: 0,
    midpoint: 0,
    manual: 0,
    none: 0,
    unresolved: 0,
    conflict: 0,
  }
  for (const item of rows) {
    summary[item.status]++
  }

  return {
    rows,
    writes,
    unresolved: rows.filter((item) => item.status === 'unresolved' || item.status === 'conflict'),
    summary,
  }
}

export function recordForEdge(
  records: Record<string, CountRecord>,
  edgeId: string,
): CountRecord | undefined {
  const originalId = originalIdForEdge(records, edgeId)
  return originalId ? records[originalId] : undefined
}

export function originalIdForEdge(
  records: Record<string, CountRecord>,
  edgeId: string,
): string | undefined {
  const hits = Object.entries(records).filter(
    ([, record]) => record.match_status !== 'none' && record.match_id === edgeId,
  )
  if (hits.length === 1) return hits[0]![0]
  return undefined
}

export function assignedMatchIds(records: Record<string, CountRecord>): string[] {
  return Object.values(records)
    .filter((record) => record.match_status !== 'none' && record.match_id !== '')
    .map((record) => record.match_id)
}
