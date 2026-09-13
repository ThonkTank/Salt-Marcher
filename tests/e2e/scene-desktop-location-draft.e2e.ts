import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { resumeCampaignFromScreen } from './support/campaign-navigation.js'
import { waitSaved, selectScene } from './support/scene-desktop-scenarios.js'

describe('per-scene desktop', () => {
  it('changes scene location without resolving an independent XP draft', async () => {
    const client = browser as unknown as WdioBrowser
    await resumeCampaignFromScreen(client)
    await selectScene(client, 'Hafen')
    const read = () =>
      client.execute(async () => {
        const campaignId = (await window.saltMarcher.campaigns.list())
          .activeCampaignId!
        return window.saltMarcher.session.read({ campaignId })
      })
    await expect(client.$('[data-error-scope="workspace"]')).not.toBeExisting()
    const before = await read()
    const sceneId = before.scene.focusedSceneId
    const original = before.scene.scenes.find(
      (scene) => scene.id === sceneId
    )!.locationId
    const destination = before.scene.locationChoices.find(
      (location) => location.id !== original
    )
    if (!destination) throw new Error('Fixture requires another location')
    await client.$('.desktop-toolbar').$('button=Party').click()
    await client.$('[data-window-id="party"]').$('.party-xp-meter').click()
    await client.$('.desktop-xp-popup input').setValue('250')
    const chooseLocation = async () => {
      await client.$('.desktop-toolbar .desktop-scene-facts button').click()
      await client
        .$('.desktop-toolbar .desktop-scene-facts select')
        .selectByAttribute('value', destination.id)
    }
    await chooseLocation()
    await client.waitUntil(
      async () =>
        (await read()).scene.scenes.find((scene) => scene.id === sceneId)!
          .locationId === destination.id
    )
    await expect(client.$('[role="alertdialog"]')).not.toBeExisting()
    await client.$('[data-window-id="party"]').$('.party-xp-meter').click()
    await expect(client.$('.desktop-xp-popup input')).toHaveValue('250')
    expect((await read()).party).toEqual(before.party)
    await expect(client.$('[data-error-scope="workspace"]')).not.toBeExisting()
    await client
      .$('[data-window-id="party"] button[aria-label="Fenster schließen"]')
      .click()
    const confirmation = client.$(
      '[role="alertdialog"][aria-label="Fensteränderung bestätigen"]'
    )
    await confirmation.waitForDisplayed()
    await confirmation.$('button=Verwerfen und fortfahren').click()
    await waitSaved(client)
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await client.$('.scene-desktop').waitForDisplayed({ timeout: 30_000 })
    const restarted = await read()
    expect(
      restarted.scene.scenes.find((scene) => scene.id === sceneId)!.locationId
    ).toBe(destination.id)
    expect(restarted.party).toEqual(before.party)
  })
})
