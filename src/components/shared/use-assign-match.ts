import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOsmAuth } from '@/components/shared/use-osm-auth'
import {
  allCountsQueryKey,
  countsQueryKey,
  countStore,
  datasetSummariesQueryKey,
} from '@/shared/counts/counts-query'
import { osmLoginRequiredMessage } from '@/shared/counts/kv-count-store'
import type { CountRecord, MatchStatus } from '@/shared/counts/schema'

type AssignArgs = {
  originalId: string
  matchId: string
  status: Extract<MatchStatus, 'manual' | 'none'>
}

async function invalidateCountQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  dataset: string,
) {
  await queryClient.invalidateQueries({ queryKey: countsQueryKey(dataset) })
  await queryClient.invalidateQueries({ queryKey: allCountsQueryKey })
  await queryClient.invalidateQueries({ queryKey: datasetSummariesQueryKey })
}

export async function persistMatchWrites(
  dataset: string,
  writes: Array<{ originalId: string; record: CountRecord }>,
) {
  const now = new Date().toISOString()
  for (const write of writes) {
    await countStore.put(dataset, write.originalId, {
      ...write.record,
      updated_at: now,
    })
  }
}

export function useAssignMatch(dataset: string | undefined) {
  const queryClient = useQueryClient()
  const auth = useOsmAuth()
  const countsQuery = useQuery({
    queryKey: countsQueryKey(dataset ?? ''),
    queryFn: () => countStore.list(dataset!),
    enabled: Boolean(dataset),
  })

  const assign = useMutation({
    mutationFn: async ({ originalId, matchId, status }: AssignArgs) => {
      if (!dataset) throw new Error('missing')
      if (!auth.authenticated) throw new Error(osmLoginRequiredMessage)
      const current = countsQuery.data?.[originalId] ?? (await countStore.get(dataset, originalId))
      if (!current) throw new Error('Zählung nicht gefunden')
      return countStore.put(dataset, originalId, {
        ...current,
        match_id: matchId,
        match_status: status,
        updated_at: new Date().toISOString(),
      })
    },
    onSuccess: async () => {
      if (!dataset) return
      await invalidateCountQueries(queryClient, dataset)
    },
  })

  const saveAuto = useMutation({
    mutationFn: async (writes: Array<{ originalId: string; record: CountRecord }>) => {
      if (!dataset) throw new Error('missing')
      if (!auth.authenticated) throw new Error(osmLoginRequiredMessage)
      await persistMatchWrites(dataset, writes)
    },
    onSuccess: async () => {
      if (!dataset) return
      await invalidateCountQueries(queryClient, dataset)
    },
  })

  return { assign, saveAuto, authenticated: auth.authenticated }
}
