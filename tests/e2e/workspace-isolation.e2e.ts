import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'

describe('isolated workspace routes', () => {
  it('loads Session, Catalog and Hex through the persistent shell', async () => {
    const client = browser as unknown as WdioBrowser
    const campaignName = await client.$('#campaign-name')
    await campaignName.waitForDisplayed({ timeout: 30_000 })
    await campaignName.setValue('Workspace Isolation')
    await (await client.$('button=Anlegen')).click()
    await (
      await client.$('section[aria-label="Session Steuerung"]')
    ).waitForExist({ timeout: 10_000 })

    const menu = await client.$('button[aria-label="Menü"]')
    await expect(menu).toBeExisting()
    await expect(
      await client.$('section[aria-label="Session Steuerung"]')
    ).toBeExisting()

    await (await client.$('button[aria-label="Katalog"]')).click()
    await expect(await client.$('.catalog-workspace')).toBeExisting()
    await expect(menu).toBeExisting()

    await (await client.$('button[aria-label="Hex-Editor"]')).click()
    await expect(await client.$('.hex-editor-workspace')).toBeExisting()
    await expect(menu).toBeExisting()

    await (await client.$('button[aria-label="Session"]')).click()
    await expect(
      await client.$('section[aria-label="Session Steuerung"]')
    ).toBeExisting()
    await expect(menu).toBeExisting()
  })
})
