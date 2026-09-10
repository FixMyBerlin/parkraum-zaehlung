import { kv } from '@/shared/kv/kv'
import { type CountStore } from './count-store'
import { createKvCountStore } from './kv-count-store'

export function createCountStore(): CountStore {
  return createKvCountStore(kv)
}
