import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'

describe('passive display isolation', () => {
  it('never renders a GM sentinel and exposes only the empty projection', async () => {
    const client = browser as unknown as WdioBrowser
    await client.waitUntil(
      async () => (await client.getWindowHandles()).length === 2
    )
    const handles = await client.getWindowHandles()
    let gm = ''
    let passive = ''
    for (const handle of handles) {
      await client.switchToWindow(handle)
      const title = await client.getTitle()
      if (title.toLocaleLowerCase().includes('passive')) passive = handle
      else gm = handle
    }
    expect(gm).not.toBe('')
    expect(passive).not.toBe('')
    await client.switchToWindow(gm)
    const input = await client.$('#campaign-name')
    await input.waitForExist()
    await input.setValue('GM-SENTINEL-DO-NOT-LEAK')
    await (await client.$('button=Kampagne erstellen')).click()
    await expect(await client.$('h1=Session')).toBeExisting()

    await client.switchToWindow(passive)
    await expect(await client.$('h1=Passive Anzeige')).toBeExisting()
    expect(
      (await (await client.$('body')).getText()).includes(
        'GM-SENTINEL-DO-NOT-LEAK'
      )
    ).toBe(false)
    expect(
      (await (await client.$('.status')).getText()).includes(
        'Keine Datenfreigabe aktiv'
      )
    ).toBe(true)
  })
})
