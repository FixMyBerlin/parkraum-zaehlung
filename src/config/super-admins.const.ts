/**
 * OSM display names allowed to fully delete a project (all KV entries, valid and
 * invalid). This is a UI-only guard to keep the destructive action out of casual
 * reach — the KV server itself only enforces write access, not super-admin status,
 * so any authenticated user with write access could still call the API directly.
 */
export const superAdminOsmDisplayNames = ['tordans', 'Supaplex030'] as const

export function isSuperAdmin(displayName: string | undefined | null): boolean {
  if (!displayName) return false
  return (superAdminOsmDisplayNames as readonly string[]).includes(displayName)
}
