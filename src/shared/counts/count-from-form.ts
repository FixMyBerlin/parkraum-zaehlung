import { type CountRecord, type SideCount } from './schema'

export function readSideCount(form: FormData, side: 'left' | 'right'): SideCount {
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

export function countRecordFromFormData(data: FormData, updatedBy?: string): CountRecord {
  const noteValue = data.get('note')
  return {
    left: readSideCount(data, 'left'),
    right: readSideCount(data, 'right'),
    note: typeof noteValue === 'string' && noteValue ? noteValue : undefined,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  }
}
