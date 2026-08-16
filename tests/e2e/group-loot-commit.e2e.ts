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
import { waitForGmRendererReady } from './support/e2e-ready.js'

describe('Group Loot atomic commit', () => {
  it('persists editable quantity and packing with generated references', async () => {
    const client = browser as unknown as WdioBrowser
    await setElectronWindowSize(client, 1280, 800)
    await (
      await client.$('h1=Session · Gruppenloot-Abnahme')
    ).waitForExist({ timeout: 15_000 })
    await (await client.$('button=Gruppen managen')).click()
    const dialog = await client.$(
      'section[aria-labelledby="group-builder-title"]'
    )
    await dialog.waitForDisplayed({ timeout: 10_000 })
    await (
      await dialog.$('select[aria-label="Gruppe auswählen"]')
    ).selectByVisibleText('E2E Gruppenbeute')
    await (await dialog.$('[role="tab"]=Schatz-Draft')).click()
    const generate = await dialog.$('button=Loot erzeugen')
    await client.waitUntil(() => generate.isEnabled(), { timeout: 10_000 })
    await generate.click()
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
    const assignment = await item.$('select[aria-label="Behälter"]')
    await assignment.selectByVisibleText(containerName)

    const commit = await panel.$('button=Gruppe & Loot übernehmen')
    expect(await commit.isEnabled()).toBe(true)
    await commit.click()
    try {
      await client.waitUntil(
        async () =>
          !(await dialog.isExisting()) ||
          (await (await panel.$('.group-loot-inline-error')).isDisplayed()),
        { timeout: 10_000, timeoutMsg: 'Group Loot commit did not settle.' }
      )
    } catch (cause) {
      throw new Error(
        `Group Loot commit did not settle: ${await panel.getText()}`,
        { cause }
      )
    }
    if (await dialog.isExisting())
      throw new Error(
        `Group Loot commit failed: ${await (
          await panel.$('.group-loot-inline-error')
        ).getText()}`
      )
    await dialog.waitForExist({ reverse: true, timeout: 10_000 })
    await client.reloadSession()
    await waitForGmRendererReady(client)
    const committed = await client.execute(async () => {
      const api = window.saltMarcher
      const live = await api.session.read()
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
