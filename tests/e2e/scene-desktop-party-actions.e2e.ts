import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { openSceneWindow } from './support/scene-desktop-navigation.js'
import { resumeCampaignFromScreen } from './support/campaign-navigation.js'
import { expectAccessibleInBothThemes } from './support/e2e-assertions.js'
import { waitSaved, selectScene } from './support/scene-desktop-scenarios.js'

describe('per-scene desktop', () => {
  it('batches rosters, changes XP through bars, confirms rests and reverses scene creation', async () => {
    const client = browser as unknown as WdioBrowser
    await resumeCampaignFromScreen(client)
    await selectScene(client, 'Wald')
    const read = () =>
      client.execute(async () => {
        const campaignId = (await window.saltMarcher.campaigns.list())
          .activeCampaignId!
        return window.saltMarcher.session.read({ campaignId })
      })
    await selectScene(client, 'Wald')
    const info = await openSceneWindow(client, 'party')
    const menu = async (label: string) => {
      const popup = client.$('.party-action-menu')
      if (!(await popup.isDisplayed()))
        await info.$('button[aria-label="Party-Aktionen"]').click()
      await popup.$(`button=${label}`).click()
    }
    await menu('Aktives Roster bearbeiten')
    const popup = () => client.$('.desktop-roster-popup')
    await popup().$('button=Auswahl leeren').click()
    for (const name of ['Reserve 4', 'Reserve 5']) {
      await popup()
        .$('input[aria-label="Charakter oder Spieler"]')
        .setValue(name)
      await popup().$('input[type="checkbox"]').click()
    }
    await popup().$('button=Übernehmen').click()
    await popup().waitForExist({ reverse: true })
    await client.keys('Escape')
    const row = info.$('.desktop-party-entry')
    const beforeXp = await read()
    const scene = beforeXp.scene.scenes.find(
      (scene) => scene.id === beforeXp.scene.focusedSceneId
    )!
    const first = beforeXp.party.members.find(
      (member) => member.id === scene.partyMemberIds[0]
    )!
    await row.$('.party-xp-meter').click()
    await client.$('.desktop-xp-popup input').setValue('100')
    await client
      .$('.desktop-xp-popup button[aria-label="XP addieren"]')
      .waitForEnabled()
    await client.$('.desktop-xp-popup button[aria-label="XP addieren"]').click()
    await client.waitUntil(
      async () =>
        (await read()).party.members.find((member) => member.id === first.id)!
          .xp ===
        first.xp + 100
    )
    await client
      .$('.desktop-xp-popup button[aria-label="XP subtrahieren"]')
      .waitForEnabled()
    await client
      .$('.desktop-xp-popup button[aria-label="XP subtrahieren"]')
      .click()
    await client.waitUntil(
      async () =>
        (await read()).party.members.find((member) => member.id === first.id)!
          .xp === first.xp
    )
    await client
      .$(
        '.desktop-xp-popup button[aria-label="Gesamt-XP durch Betrag ersetzen"]'
      )
      .waitForEnabled()
    await client
      .$(
        '.desktop-xp-popup button[aria-label="Gesamt-XP durch Betrag ersetzen"]'
      )
      .click()
    await client.waitUntil(
      async () =>
        (await read()).party.members.find((member) => member.id === first.id)!
          .xp === 100
    )
    expect(
      (await read()).party.members.find((member) => member.id === first.id)!
        .xpSinceLongRest
    ).toBe(first.xpSinceLongRest)
    await client.keys('Escape')
    await menu('Rasten')
    await popup().$('button=Lange Rast').click()
    await popup().$('button=Lange Rast bestätigen').click()
    await popup().waitForExist({ reverse: true })
    await client.keys('Escape')
    const beforeMove = await read()
    await menu('Verschieben')
    expect(
      await popup().$('input[aria-label="Charakter oder Spieler"]').isExisting()
    ).toBe(false)
    await popup().$('input[type="checkbox"]').click()
    await popup().$('select').selectByAttribute('value', '')
    expect(await popup().$('input[aria-label="Szenenname"]').isExisting()).toBe(
      false
    )
    await popup().$('button=Übernehmen').click()
    await popup().waitForExist({ reverse: true })
    await client.keys('Escape')
    await client.waitUntil(
      async () =>
        (await read()).scene.scenes.length ===
        beforeMove.scene.scenes.length + 1
    )
    const added = (await read()).scene.scenes.find(
      (scene) =>
        !beforeMove.scene.scenes.some((previous) => previous.id === scene.id)
    )!
    expect(added.locationId).toBe(scene.locationId)
    expect(added.gameTimeSeconds).toBe(scene.gameTimeSeconds)
    await info.$('button[aria-label^="Rückgängig:"]').waitForEnabled()
    await info.$('button[aria-label^="Rückgängig:"]').click()
    await client.waitUntil(
      async () =>
        (await read()).scene.scenes.length === beforeMove.scene.scenes.length
    )
    await info.$('button[aria-label^="Wiederherstellen:"]').click()
    await client.waitUntil(
      async () =>
        (await read()).scene.scenes.length ===
        beforeMove.scene.scenes.length + 1
    )
    await info.$('button[aria-label^="Rückgängig:"]').click()
    await client.waitUntil(
      async () =>
        (await read()).scene.scenes.length === beforeMove.scene.scenes.length
    )
    await expectAccessibleInBothThemes(client)
    await waitSaved(client)
  })
})
