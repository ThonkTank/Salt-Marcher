import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { openSceneWindow } from './support/scene-desktop-navigation.js'
import { resumeCampaignFromScreen } from './support/campaign-navigation.js'
import { expectAccessibleInBothThemes } from './support/e2e-assertions.js'
import { waitSaved, selectScene } from './support/scene-desktop-scenarios.js'

describe('per-scene desktop', () => {
  it('manages the campaign library and keeps scene quickinfos beside existing windows', async () => {
    const client = browser as unknown as WdioBrowser
    await resumeCampaignFromScreen(client)
    await selectScene(client, 'Hafen')
    await openSceneWindow(client, 'party')
    const info = () => client.$('[data-window-id="party"]')
    await info().waitForDisplayed({ timeout: 15_000 })
    await expect(info()).toHaveText(expect.stringContaining('Zuga'))
    await expect(info()).not.toHaveText(expect.stringContaining('Vivian'))
    const before = await info().$$('.desktop-party-entry').length
    await info().$('.desktop-party-toggle').click()
    expect(await info().$$('.desktop-party-entry').length).toBe(before)
    await expectAccessibleInBothThemes(client)
    await info().$('button=Katalog').click()
    await client.$('.character-catalog-layout').waitForDisplayed()
    expect(await client.$$('.character-roster > button').length).toBe(18)
    await expect(client.$('.character-catalog-detail h2')).toHaveText('Edrik')
    await client.$('.character-catalog-detail').$('button=Beute').click()
    await client.$('[role="dialog"]').waitForDisplayed()
    await client.keys('Escape')
    await client.$('.character-catalog-tools').$('button=Neu').click()
    await client.$('.character-profile-form').$('button=Speichern').click()
    await expect(client.$('.character-profile-form [role="alert"]')).toHaveText(
      expect.stringContaining('Name erforderlich')
    )
    await client.$('input[name="name"]').setValue('Neue Heldin')
    await client.$('.character-profile-form').$('button=Speichern').click()
    await client.$('.character-catalog-detail h2').waitForExist()
    await expect(client.$('.character-catalog-detail')).toHaveText(
      expect.stringContaining('Inaktiv')
    )
    await client.$('.character-catalog-detail').$('button=Bearbeiten').click()
    await client.$('input[name="playerName"]').setValue('Tessa')
    await client.$('input[name="level"]').setValue('4')
    await client.$('input[name="passiveInsight"]').setValue('15')
    await client.$('input[name="languages"]').setValue('Common, Abyssal')
    await client.$('.character-profile-form').$('button=Speichern').click()
    await expect(client.$('.character-catalog-detail')).toHaveText(
      expect.stringContaining('Tessa')
    )
    await client.$('.character-catalog-detail').$('button=Bearbeiten').click()
    await client.$('input[name="level"]').clearValue()
    await client.$('.character-profile-form').$('button=Speichern').click()
    await client.$('.character-catalog-detail h2').waitForExist()
    await expectAccessibleInBothThemes(client)
    await client.$('.character-catalog-detail').$('button=Löschen').click()
    await expect(client.$('.character-catalog-detail h2')).toHaveText(
      'Neue Heldin'
    )
    await client.$('button=Endgültig löschen').click()
    await client.$('.character-delete-confirm').waitForExist({ reverse: true })
    await client
      .$('input[aria-label="Charakter oder Spieler suchen"]')
      .setValue('kein solcher Charakter')
    await expect(client.$('.character-roster')).toHaveText(
      'Keine Charaktere gefunden.'
    )
    await client.$('button[aria-label="Session"]').click()
    await info().waitForDisplayed()
    await selectScene(client, 'Wald')
    await openSceneWindow(client, 'party')
    await expect(info()).toHaveText(expect.stringContaining('Vivian'))
    await expect(info()).not.toHaveText(expect.stringContaining('Edrik'))
    await waitSaved(client)
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await info().waitForDisplayed({ timeout: 30_000 })
    await expect(info()).toHaveText(expect.stringContaining('Vivian'))
  })
})
