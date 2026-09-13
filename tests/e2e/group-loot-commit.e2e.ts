import { resumeCampaignFromScreen } from './support/campaign-navigation.js'
import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { setElectronWindowSize } from './support/e2e-assertions.js'
import { waitForGmRendererReady } from './support/e2e-ready.js'

describe('Group Loot atomic commit', () => {
  it('persists mixed manual and generated loot with original references', async () => {
    const client = browser as unknown as WdioBrowser
    await resumeCampaignFromScreen(client)
    await setElectronWindowSize(client, 1280, 800)
    await client
      .$('h1=Session · Gruppenloot-Abnahme')
      .waitForExist({ timeout: 15000 })
    const expand = client.$('button[aria-label="E2E Gruppenbeute aufklappen"]')
    if (await expand.isExisting()) await expand.click()
    await client
      .$('.group-register[aria-label="E2E Gruppenbeute"]')
      .$('button=Loot bearbeiten')
      .click()
    const dialog = client.$('section[aria-labelledby="group-builder-title"]')
    await dialog.waitForDisplayed({ timeout: 10000 })
    const generate = dialog.$('button=Loot generieren')
    await client.waitUntil(() => generate.isEnabled(), { timeout: 10000 })
    await generate.click()
    await client.waitUntil(
      async () =>
        await dialog.$('[data-group-loot-phase="ready"]').isExisting(),
      { timeout: 15000 }
    )
    await dialog
      .$('.loot-catalog-pane input[type="search"]')
      .setValue('Gold Coin')
    const add = dialog.$('button[aria-label="Gold Coin hinzufügen"]')
    await add.waitForDisplayed()
    await add.click()
    await dialog.$('.group-editor-selection').$('summary=Münzen').click()
    await dialog
      .$(
        '.group-editor-selection button[aria-label="Gold Coin: Menge erhöhen"]'
      )
      .click()
    await dialog.$('[role="tab"]=Monster').click()
    const increment = dialog.$(
      '.group-editor-selection button[aria-label$="Menge erhöhen"]'
    )
    await increment.click()
    await dialog.$('button=Übernehmen').click()
    await dialog.waitForExist({ reverse: true, timeout: 10000 })
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await waitForGmRendererReady(client)
    const result = await client.execute(async () => {
      const api = window.saltMarcher,
        campaignId = (await api.campaigns.list()).activeCampaignId!
      const snapshot = await api.session.read({ campaignId }),
        scene = snapshot.scene.scenes.find(
          (s) => s.id === snapshot.scene.focusedSceneId
        )!
      const group = scene.groups.find((g) => g.name === 'E2E Gruppenbeute')!
      const loot = await api.loot.scene({ sceneId: scene.id })
      return (
        loot.groupTreasures.find((t) => t.groupId === group.id)?.treasures ?? []
      )
    })
    expect(result).toHaveLength(1)
    expect(result[0]?.source.kind).toBe('generated')
    expect(
      result[0]?.items.some(
        (i) =>
          i.itemReference.kind === 'generated' &&
          i.provenance.kind === 'generator'
      )
    ).toBe(true)
    expect(
      result[0]?.items.find(
        (i) =>
          i.itemReference.kind === 'catalog' &&
          i.itemReference.catalogId === 'coin:gp'
      )?.quantity
    ).toBe(2)
    const expanded = client.$(
      'button[aria-label="E2E Gruppenbeute aufklappen"]'
    )
    if (await expanded.isExisting()) await expanded.click()
    const register = client.$('.group-register[aria-label="E2E Gruppenbeute"]')
    const species = register.$('.scene-group-species')
    const original = Number(await species.$('output').getText())
    const increase = species.$('button[aria-label$="Menge erhöhen"]')
    await increase.click()
    await increase.click()
    await expect(species.$('output')).toHaveText(String(original + 2))
    await species.$('button[aria-label$="Menge verringern"]').click()
    await expect(species.$('output')).toHaveText(String(original + 1))
    const count = await register.$$('.scene-group-species').length
    await species.$('button[aria-label$=" entfernen"]').click()
    await client.waitUntil(
      async () =>
        (await register.$$('.scene-group-species').length) === count - 1
    )
    await expect(dialog).not.toBeExisting()
  })
})
