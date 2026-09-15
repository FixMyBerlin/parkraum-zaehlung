import { expect, test } from '@playwright/test'

test.describe('map controls', () => {
  test('shows the background layer control', async ({ page }) => {
    // ELI's layer index ships bundled with the npm package (code-split JS chunks,
    // not a runtime fetch), so this needs no network mocking to stay non-flaky.
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Hintergrundkarte' })).toBeVisible()
  })
})
