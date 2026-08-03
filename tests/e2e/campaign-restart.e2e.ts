import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'

describe('campaign restart', () => {
  it('resumes Campaign A after an Electron process restart and accepts a mutation', async () => {
    const client = browser as unknown as WdioBrowser
    const sessionHeading = await client.$('h1=Session')
    await client.waitUntil(() => sessionHeading.isExisting(), {
      timeout: 10_000,
      timeoutMsg: 'Persisted active campaign did not resume after restart.'
    })
    await expect(
      await client.$(
        '[aria-label="Gekoppelte Grenze zwischen linker und rechter Spalte"]'
      )
    ).toHaveAttribute('aria-valuenow', '60')
    await expect(
      await client.$('[aria-label="Grenze zwischen Details und Szenario"]')
    ).toHaveAttribute('aria-valuenow', '47')
    await expect(
      await client.$('select[aria-label="Scene-Ort"] option:checked')
    ).toHaveText('Salzmarschhafen')
    await (await client.$('button[aria-label="Katalog"]')).click()
    await (await client.$('button=Orte')).click()
    await expect(await client.$('button=Salzmarschhafen')).toBeExisting()
    await (await client.$('button[aria-label="Kampagnen"]')).click()
    const field = await client.$('#campaign-name')
    await client.waitUntil(() => field.isExisting(), {
      timeout: 5_000,
      timeoutMsg: 'Campaign input was not rendered after restart.'
    })
    await expect(await client.$('button=Campaign A')).toBeExisting()

    await field.setValue('Campaign C')
    await (await client.$('button=Kampagne erstellen')).click()
    await expect(await client.$('h1=Session')).toBeExisting()
  })
})
