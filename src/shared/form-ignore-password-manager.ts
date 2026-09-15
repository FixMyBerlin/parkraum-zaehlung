/**
 * Spread onto non-credential form fields (count numbers, notes, project names,
 * search) to suppress password-manager overlays — 1Password's inline icon and
 * similar from other managers — that otherwise render on top of plain form inputs.
 */
export const ignorePasswordManagerProps = {
  autoComplete: 'off',
  'data-1p-ignore': true,
  'data-lpignore': 'true',
  'data-form-type': 'other',
} as const
