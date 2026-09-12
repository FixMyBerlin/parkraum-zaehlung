import { kv } from '@/shared/kv/kv'
import { createKvCountStore } from './kv-count-store'

export function createCountStore() {
  return createKvCountStore(kv)
}
