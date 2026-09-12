import { createFileRoute } from '@tanstack/react-router'
import { AppShell } from '@/components/AppShell'
import { indexSearchSchema } from '@/shared/routing/search-schema'

export const Route = createFileRoute('/')({
  validateSearch: indexSearchSchema,
  component: AppShell,
})
