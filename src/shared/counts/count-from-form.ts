import { lineMidpoint } from '@/shared/edges/line-midpoint'
import { type CountRecord, matchStatusSchema, type SideCount } from './schema'

export function readSideCount(form: FormData, side: 'left' | 'right') {
  const read = (key: keyof SideCount) => {
    const raw = form.get(`${side}_${key}`)
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

function occupancyFromForm(data: FormData, updatedBy?: string) {
  const noteValue = data.get('note')
  return {
    left: readSideCount(data, 'left'),
    right: readSideCount(data, 'right'),
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
      mid_lat: args.existing.mid_lat,
      mid_lng: args.existing.mid_lng,
      match_id: matchFromForm?.match_id ?? args.existing.match_id,
      match_status: matchFromForm?.match_status ?? args.existing.match_status,
    }
  }

  if (!args.edgeId || !args.coordinates) {
    throw new Error('New counts need an edge id and coordinates')
  }
  const mid = lineMidpoint(args.coordinates)
  return {
    ...occupancy,
    counted_at: occupancy.updated_at,
    mid_lat: mid.lat,
    mid_lng: mid.lng,
    match_id: matchFromForm?.match_id ?? args.edgeId,
    match_status: matchFromForm?.match_status ?? 'id',
  }
}
