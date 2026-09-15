import { describe, expect, it } from 'vitest'
import { isSuperAdmin, superAdminOsmDisplayNames } from './super-admins.const'

describe('isSuperAdmin', () => {
  it('matches every configured display name exactly', () => {
    for (const name of superAdminOsmDisplayNames) {
      expect(isSuperAdmin(name)).toBe(true)
    }
  })

  it('rejects case-different or partial matches', () => {
    expect(isSuperAdmin('Tordans')).toBe(false)
    expect(isSuperAdmin('tordans2')).toBe(false)
    expect(isSuperAdmin(' tordans')).toBe(false)
  })

  it('rejects unknown, empty, and missing names', () => {
    expect(isSuperAdmin('someone-else')).toBe(false)
    expect(isSuperAdmin('')).toBe(false)
    expect(isSuperAdmin(undefined)).toBe(false)
    expect(isSuperAdmin(null)).toBe(false)
  })
})
