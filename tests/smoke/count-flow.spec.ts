import { expect, test } from '@playwright/test'

test.describe('counting flow', () => {
  test('loads the sample dataset, saves a count, and exports JSON', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Parkraum-Zählung' })).toBeVisible()

    await page.getByTestId('load-sample').click()
    await expect(page.getByText('Datensatz loerrach-sample')).toBeVisible()
    await expect(page.getByTestId('progress-summary')).toContainText('0/6 Kanten')

    await page.getByTestId('edge-list-ce-basler-nord').click()
    await expect(page.getByTestId('selected-edge-name')).toHaveText('Basler Straße')

    await page.getByTestId('left-pkw').fill('7')
    await page.getByTestId('left-motorrad').fill('1')
    await page.getByTestId('right-pkw').fill('5')
    await page.getByTestId('save-count').click()

    await expect(page.getByTestId('progress-summary')).toContainText('1/6 Kanten')

    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('export-json').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^counts-loerrach-sample-.*\.json$/)
  })
})
