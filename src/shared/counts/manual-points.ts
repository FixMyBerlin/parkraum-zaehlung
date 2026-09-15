import type { CountRecord } from './schema'

/** KV id prefix for a manually placed point, e.g. `manual-3f2504e0-...`. */
const MANUAL_POINT_ID_PREFIX = 'manual-'

export function isManualCountId(id: string) {
  return id.startsWith(MANUAL_POINT_ID_PREFIX)
}

export function isManualRecord(record: CountRecord) {
  return record.source === 'manual'
}

export function newManualPointId() {
  return `${MANUAL_POINT_ID_PREFIX}${crypto.randomUUID()}`
}

/**
 * Moves a manual point after a drag. Only `mid_lat`/`mid_lng` and the last-edit
 * bookkeeping change — occupancy, `note`, `counted_at`, and `created_by` all stay as
 * they were. Imported edge counts never call this; their midpoint is the line's own
 * and stays frozen (see `countRecordFromFormData`).
 */
export function withManualPointLocation(
  record: CountRecord,
  lng: number,
  lat: number,
  updatedBy: string | undefined,
): CountRecord {
  return {
    ...record,
    mid_lng: lng,
    mid_lat: lat,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  }
}
