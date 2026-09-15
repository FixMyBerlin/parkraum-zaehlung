import { lineMidpoint } from '@/shared/edges/line-midpoint'
import {
  countPeriods,
  isSideCounted,
  matchStatusSchema,
  type CountPeriod,
  type CountRecord,
  type PeriodOccupancy,
  type Side,
  type SideCount,
} from './schema'

export function readSideCount(form: FormData, period: CountPeriod, side: Side) {
  const read = (key: keyof SideCount) => {
    const raw = form.get(`${period}_${side}_${key}`)
    if (raw == null || raw === '') return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }
  return {
    pkw: read('pkw'),
    motorrad: read('motorrad'),
    lkw_bus: read('lkw_bus'),
  }
}

function periodOccupancyFromForm(data: FormData, period: CountPeriod): PeriodOccupancy {
  return {
    left: readSideCount(data, period, 'left'),
    right: readSideCount(data, period, 'right'),
  }
}

function occupancyFromForm(data: FormData, updatedBy?: string) {
  const noteValue = data.get('note')
  const periods = Object.fromEntries(
    countPeriods.map((period) => [period, periodOccupancyFromForm(data, period)]),
  ) as CountRecord['periods']
  return {
    periods,
    note: typeof noteValue === 'string' && noteValue ? noteValue : undefined,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  }
}

type CountRecordFromFormArgs = {
  updatedBy?: string
  existing?: CountRecord
  edgeId?: string
  coordinates?: ReadonlyArray<ReadonlyArray<number>>
  /** Create a manual point instead of an edge count — used together, without `edgeId`/`coordinates`. */
  lng?: number
  lat?: number
}

export function countRecordFromFormData(data: FormData, args: CountRecordFromFormArgs = {}) {
  const occupancy = occupancyFromForm(data, args.updatedBy)
  const matchIdRaw = data.get('match_id')
  const matchStatusRaw = data.get('match_status')
  const matchFromForm =
    typeof matchIdRaw === 'string' && typeof matchStatusRaw === 'string'
      ? {
          match_id: matchIdRaw,
          match_status: matchStatusSchema.parse(matchStatusRaw),
        }
      : undefined

  if (args.existing) {
    return {
      ...occupancy,
      counted_at: args.existing.counted_at,
      created_by: args.existing.created_by,
      source: args.existing.source,
      mid_lat: args.existing.mid_lat,
      mid_lng: args.existing.mid_lng,
      match_id: matchFromForm?.match_id ?? args.existing.match_id,
      match_status: matchFromForm?.match_status ?? args.existing.match_status,
    }
  }

  if (args.edgeId && args.coordinates) {
    const mid = lineMidpoint(args.coordinates)
    return {
      ...occupancy,
      counted_at: occupancy.updated_at,
      created_by: args.updatedBy,
      source: 'imported' as const,
      mid_lat: mid.lat,
      mid_lng: mid.lng,
      match_id: matchFromForm?.match_id ?? args.edgeId,
      match_status: matchFromForm?.match_status ?? 'id',
    }
  }

  if (args.lng != null && args.lat != null) {
    return {
      ...occupancy,
      counted_at: occupancy.updated_at,
      created_by: args.updatedBy,
      source: 'manual' as const,
      mid_lat: args.lat,
      mid_lng: args.lng,
      match_id: matchFromForm?.match_id ?? '',
      match_status: matchFromForm?.match_status ?? 'none',
    }
  }

  throw new Error('New counts need an edge id and coordinates, or a lng/lat')
}

/** The user-entered part of a count record: all three periods and the note, without bookkeeping fields. */
export type Occupancy = Pick<CountRecord, 'periods' | 'note'>

function sameSideCount(a: SideCount, b: SideCount) {
  return a.pkw === b.pkw && a.motorrad === b.motorrad && a.lkw_bus === b.lkw_bus
}

function samePeriodOccupancy(a: PeriodOccupancy, b: PeriodOccupancy) {
  return sameSideCount(a.left, b.left) && sameSideCount(a.right, b.right)
}

function isPeriodOccupancyEmpty(occupancy: PeriodOccupancy) {
  return !isSideCounted(occupancy.left) && !isSideCounted(occupancy.right)
}

/** True when no period has any count and the note is blank (undefined and '' are equivalent). */
export function isEmptyOccupancy(occupancy: Occupancy) {
  return (
    countPeriods.every((period) => isPeriodOccupancyEmpty(occupancy.periods[period])) &&
    !occupancy.note
  )
}

/**
 * Compares two occupancies by user-visible content only (all three periods and the note),
 * ignoring bookkeeping fields like `updated_at`/`updated_by`. Autosave uses this to skip a
 * PUT when the form's content didn't actually change.
 */
export function sameOccupancy(a: Occupancy, b: Occupancy) {
  return (
    countPeriods.every((period) => samePeriodOccupancy(a.periods[period], b.periods[period])) &&
    (a.note ?? '') === (b.note ?? '')
  )
}
