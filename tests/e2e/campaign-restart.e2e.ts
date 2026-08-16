import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'

describe('campaign restart', () => {
  it('resumes Campaign A after an Electron process restart and accepts a mutation', async () => {
    const client = browser as unknown as WdioBrowser
    const sessionHeading = await client.$('h1=Session · Campaign A')
    try {
      await client.waitUntil(() => sessionHeading.isExisting(), {
        timeout: 10_000,
        timeoutMsg: 'Persisted active campaign did not resume after restart.'
      })
    } catch {
      throw new Error(
        `Persisted active campaign did not resume after restart. Renderer: ${await (await client.$('body')).getText()}`
      )
    }
    await expect(
      await client.$('[aria-label="Breite der Steuerungsspalte"]')
    ).toHaveAttribute('aria-valuenow', '290')
    await expect(
      await client.$('[aria-label="Breite der Szenariospalte"]')
    ).toHaveAttribute('aria-valuenow', '274')
    await expect(
      await client.$(
        '.control-register .register-row:nth-child(2) .register-value'
      )
    ).toHaveText('Salzmarschhafen')
    await (await client.$('button[aria-label="Katalog"]')).click()
    await (await client.$('button=Orte')).click()
    await expect(await client.$('button=Salzmarschhafen')).toBeExisting()
    await (await client.$('button[aria-label="Menü"]')).click()
    const menu = await client.$('#campaign-menu')
    await (await menu.$('button=Kampagnen')).click()
    const field = await client.$('#campaign-name')
    await client.waitUntil(() => field.isExisting(), {
      timeout: 5_000,
      timeoutMsg: 'Campaign input was not rendered after restart.'
    })
    await expect(
      await client.$('button[aria-label="Campaign A"]')
    ).toBeExisting()

    await field.setValue('Campaign C')
    await (await client.$('button=Anlegen')).click()
    await (
      await client.$('h1=Session · Campaign C')
    ).waitForExist({
      timeout: 10_000
    })
  })
})
