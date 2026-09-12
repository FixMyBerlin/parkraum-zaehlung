import { z } from 'zod'
import type { KvErrorCode } from './types'

const kvErrorBodySchema = z.object({
  error: z
    .object({
      code: z.unknown().optional(),
      message: z.unknown().optional(),
      details: z.unknown().optional(),
    })
    .nullable()
    .optional(),
})

const KV_ERROR_CODES: Record<KvErrorCode, true> = {
  invalid_project_key: true,
  origin_not_allowed: true,
  unauthenticated: true,
  forbidden_user: true,
  not_found: true,
  validation_failed: true,
  payload_too_large: true,
  version_conflict: true,
  rate_limited: true,
  osm_unavailable: true,
  internal: true,
}

function isKvErrorCode(code: string): code is KvErrorCode {
  return code in KV_ERROR_CODES
}

export class KvError extends Error {
  constructor(
    readonly status: number,
    readonly code: KvErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'KvError'
  }
}

function asKvErrorCode(code: unknown) {
  if (typeof code === 'string' && isKvErrorCode(code)) {
    return code
  }
  return 'internal'
}

export async function kvErrorFromResponse(response: Response) {
  let code: KvErrorCode = 'internal'
  let message = response.statusText || 'Request failed'
  let details: unknown
  try {
    const body: unknown = await response.json()
    const parsed = kvErrorBodySchema.safeParse(body)
    const envelope = parsed.success ? parsed.data.error : undefined
    if (envelope) {
      code = asKvErrorCode(envelope.code)
      if (typeof envelope.message === 'string') message = envelope.message
      details = envelope.details
    }
  } catch {
    // Non-JSON error bodies still become a KvError with status.
  }
  return new KvError(response.status, code, message, details)
}
