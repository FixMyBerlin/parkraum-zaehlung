import { isKvConfigured } from '@/config/app.const'
import { kv } from '@/shared/kv/kv'
import { type CountStore } from './count-store'
import { createKvCountStore } from './kv-count-store'
import { createLocalStorageCountStore } from './local-storage-count-store'

export function createCountStore(): CountStore {
  if (!isKvConfigured()) return createLocalStorageCountStore()
  return createKvCountStore(kv)
}
