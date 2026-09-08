import { isKvConfigured, kvApiKey, kvBaseUrl, kvProject } from '@/config/app.const'
import { type CountStore } from './count-store'
import { createKvCountStore } from './kv-count-store'
import { createLocalStorageCountStore } from './local-storage-count-store'

export function createCountStore(getOsmToken: () => string | null): CountStore {
  if (isKvConfigured()) {
    return createKvCountStore({
      baseUrl: kvBaseUrl.replace(/\/$/, ''),
      project: kvProject,
      apiKey: kvApiKey,
      getOsmToken,
    })
  }
  return createLocalStorageCountStore()
}
