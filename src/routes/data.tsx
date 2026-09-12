import { createFileRoute } from '@tanstack/react-router'
import { DataPage } from '@/components/DataPage'
import { dataSearchSchema } from '@/shared/routing/search-schema'

export const Route = createFileRoute('/data')({
  validateSearch: dataSearchSchema,
  component: DataPage,
})
