import { kvApiKey, kvBaseUrl, kvProject } from '@/config/app.const'
import type { CountRecord } from '@/shared/counts/schema'
import { createKvClient } from '@/shared/kv-client'
import { getOsmToken } from '@/shared/osm/osm-auth'

/** Shared Worker client. Reads send Origin + X-Api-Key; writes add OSM Bearer. */
export const kv = createKvClient<CountRecord>({
  baseUrl: kvBaseUrl,
  project: kvProject,
  apiKey: kvApiKey,
  getOsmToken,
})
