import type { CountStore } from './count-store'

export type RenameOutcome = {
  /** Valid entries successfully moved to the new dataset name. */
  migrated: number
  /** Invalid/unparseable entries left behind at the old name (not migrated). */
  remainingInvalid: number
  /** Valid entries that failed to move; each is safe to retry by re-running the rename. */
  failed: Array<{ edgeId: string; error: string }>
}

/**
 * Moves every valid KV entry from `oldName` to `newName` (same record data and tags
 * `[newName]`), then removes the old entry. Invalid/unparseable entries are left in
 * place — the caller decides whether to drop them (see `removeRawEntries`). Also
 * moves the project's own meta entry (name/created_at/created_by), if any.
 *
 * Idempotent: re-running only touches entries still listed under `oldName`, so a
 * partial failure (network drop mid-migration) can be safely retried.
 */
export async function renameKvDataset(
  store: CountStore,
  oldName: string,
  newName: string,
): Promise<RenameOutcome> {
  const entries = await store.listRawEntries(oldName)
  let migrated = 0
  let remainingInvalid = 0
  const failed: Array<{ edgeId: string; error: string }> = []
  for (const entry of entries) {
    if (!entry.valid || !entry.record) {
      remainingInvalid++
      continue
    }
    try {
      await store.put(newName, entry.edgeId, entry.record)
      await store.remove(oldName, entry.edgeId)
      migrated++
    } catch (error) {
      failed.push({
        edgeId: entry.edgeId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  const meta = await store.getProjectMeta(oldName)
  if (meta) {
    await store.putProjectMeta(newName, { createdAt: meta.createdAt, createdBy: meta.createdBy })
    await store.removeProjectMeta(oldName)
  }
  return { migrated, remainingInvalid, failed }
}

export type RemoveOutcome = { removed: number; failed: string[] }

/** Removes the given KV entries (by edge id) from `dataset`, valid or not. */
export async function removeRawEntries(
  store: CountStore,
  dataset: string,
  edgeIds: string[],
): Promise<RemoveOutcome> {
  const failed: string[] = []
  for (const edgeId of edgeIds) {
    try {
      await store.remove(dataset, edgeId)
    } catch {
      failed.push(edgeId)
    }
  }
  return { removed: edgeIds.length - failed.length, failed }
}

/** Removes every KV entry (valid and invalid) tagged with `dataset`, plus its meta entry. */
export async function deleteAllRawEntries(
  store: CountStore,
  dataset: string,
): Promise<RemoveOutcome> {
  const entries = await store.listRawEntries(dataset)
  const outcome = await removeRawEntries(
    store,
    dataset,
    entries.map((entry) => entry.edgeId),
  )
  await store.removeProjectMeta(dataset)
  return outcome
}
