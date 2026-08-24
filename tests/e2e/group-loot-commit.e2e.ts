import { browser, expect } from '@wdio/globals'
import type {
  Browser as WdioBrowser,
  ChainablePromiseArray,
  Element as WdioElement
} from 'webdriverio'
import {
  replaceFieldValue,
  setElectronWindowSize
} from './support/e2e-assertions.js'
import {
  clickWhenInteractable,
  selectByVisibleTextWhenInteractable
} from './support/e2e-interactions.js'
import { waitForGmRendererReady } from './support/e2e-ready.js'

describe('Group Loot atomic commit', () => {
  it('persists editable quantity and packing with generated references', async () => {
    const client = browser as unknown as WdioBrowser
    await setElectronWindowSize(client, 1280, 800)
    await (
      await client.$('h1=Session · Gruppenloot-Abnahme')
    ).waitForExist({ timeout: 15_000 })
    await clickWhenInteractable(
      client,
      async () => await client.$('button=Gruppen managen')
    )
    const dialogSelector = 'section[aria-labelledby="group-builder-title"]'
    let dialog = await client.$(dialogSelector)
    await dialog.waitForDisplayed({ timeout: 10_000 })
    await selectByVisibleTextWhenInteractable(
      client,
      async () =>
        await (
          await client.$(dialogSelector)
        ).$('select[aria-label="Gruppe auswählen"]'),
      'E2E Gruppenbeute'
    )
    await clickWhenInteractable(
      client,
      async () =>
        await (await client.$(dialogSelector)).$('[role="tab"]=Schatz-Draft')
    )
    await client.waitUntil(
      async () =>
        await (
          await (await client.$(dialogSelector)).$('button=Loot erzeugen')
        ).isEnabled(),
      { timeout: 10_000 }
    )
    await clickWhenInteractable(
      client,
      async () =>
        await (await client.$(dialogSelector)).$('button=Loot erzeugen')
    )
    dialog = await client.$(dialogSelector)
    const panel = await dialog.$('.group-loot-inline-panel')
    await (
      await panel.$('.generated-loot-results')
    ).waitForDisplayed({
      timeout: 15_000
    })

    const catalog = await dialog.$('.loot-catalog-pane')
    await catalog.waitForDisplayed({ timeout: 10_000 })
    expect(await catalog.$$('button[aria-label$=" hinzufügen"]')).toHaveLength(
      0
    )

    const item = await findStackableItem(
      await panel.$$('.treasure-item-editor-row')
    )
    const itemName = await (
      await item.$('input[aria-label="Gegenstand"]')
    ).getValue()
    const quantity = await item.$('input[aria-label="Menge"]')
    const committedQuantity = Number(await quantity.getValue()) + 1
    await replaceFieldValue(client, quantity, String(committedQuantity))

    const container = await panel.$('.treasure-container-editor-row')
    await container.waitForDisplayed({ timeout: 5_000 })
    const containerName = await (
      await container.$('input[aria-label="Behälter"]')
    ).getValue()
    await selectByVisibleTextWhenInteractable(
      client,
      async () => {
        const currentDialog = await client.$(dialogSelector)
        const currentPanel = await currentDialog.$('.group-loot-inline-panel')
        const currentItem = await findStackableItem(
          await currentPanel.$$('.treasure-item-editor-row')
        )
        return await currentItem.$('select[aria-label="Behälter"]')
      },
      containerName
    )

    const commit = await panel.$('button=Gruppe & Loot übernehmen')
    expect(await commit.isEnabled()).toBe(true)
    await clickWhenInteractable(
      client,
      async () =>
        await (
          await (await client.$(dialogSelector)).$('.group-loot-inline-panel')
        ).$('button=Gruppe & Loot übernehmen')
    )
    const readCommitState = async (): Promise<'pending' | 'closed' | 'error'> =>
      await client.execute((selector) => {
        const currentDialog = document.querySelector(selector)
        if (!currentDialog) return 'closed'
        const error = currentDialog.querySelector('.group-loot-inline-error')
        return error && error.getClientRects().length > 0 ? 'error' : 'pending'
      }, dialogSelector)
    try {
      await client.waitUntil(
        async () => (await readCommitState()) !== 'pending',
        { timeout: 10_000, timeoutMsg: 'Group Loot commit did not settle.' }
      )
    } catch (cause) {
      const currentPanel = await (
        await client.$(dialogSelector)
      ).$('.group-loot-inline-panel')
      throw new Error(
        `Group Loot commit did not settle: ${await currentPanel.getText()}`,
        { cause }
      )
    }
    const commitState = await readCommitState()
    if (commitState === 'error')
      throw new Error(
        `Group Loot commit failed: ${await client.execute(
          (selector) =>
            document
              .querySelector(selector)
              ?.querySelector('.group-loot-inline-error')?.textContent ?? '',
          dialogSelector
        )}`
      )
    await client.reloadSession()
    await waitForGmRendererReady(client)
    const committed = await client.execute(async () => {
      const api = window.saltMarcher
      const campaignId = (await api.campaigns.list()).activeCampaignId!
      const live = await api.session.read({ campaignId })
      const scene = live.scene.scenes.find(
        (candidate) => candidate.id === live.scene.focusedSceneId
      )!
      const group = scene.groups.find(
        (candidate) => candidate.name === 'E2E Gruppenbeute'
      )!
      const projection = await api.loot.scene({ sceneId: scene.id })
      const treasures =
        projection.groupTreasures.find(
          (candidate) => candidate.groupId === group.id
        )?.treasures ?? []
      return {
        count: treasures.length,
        items: treasures.flatMap((treasure) => treasure.items),
        containers: treasures.flatMap((treasure) => treasure.containers)
      }
    })
    const committedItem = committed.items.find(
      (candidate) => candidate.definition.name === itemName
    )
    const committedContainer = committed.containers.find(
      (candidate) => candidate.name === containerName
    )
    expect(committed.count).toBe(1)
    expect(committedItem).toMatchObject({
      quantity: committedQuantity,
      provenance: { kind: 'generator' }
    })
    expect(committedItem?.containerId).toBe(committedContainer?.id)
  })
})

async function findStackableItem(
  rows: readonly WdioElement[] | ChainablePromiseArray
): Promise<WdioElement> {
  for await (const row of rows)
    if (await (await row.$('input[aria-label="Teilbar"]')).isSelected())
      return row
  throw new Error('Generated Group Loot has no stackable item row.')
}
