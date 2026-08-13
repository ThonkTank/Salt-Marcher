import { browser, expect } from '@wdio/globals'
import type {
  Browser as WdioBrowser,
  ChainablePromiseArray,
  ChainablePromiseElement,
  Element as WdioElement
} from 'webdriverio'
import {
  expectAccessible,
  expectElementGolden,
  replaceFieldValue,
  setElectronWindowSize
} from './support/e2e-assertions.js'
import { waitForGmRendererReady } from './support/e2e-ready.js'

describe('Group Loot editor', () => {
  it('edits catalog-backed Loot and commits it atomically across restart', async () => {
    const client = browser as unknown as WdioBrowser
    await setElectronWindowSize(client, 1280, 800)
    await (
      await client.$('h1=Session · Gruppenloot-Abnahme')
    ).waitForExist({ timeout: 15_000 })
    await (await client.$('button=Gruppen managen')).click()
    const groupDialog = await client.$(
      'section[aria-labelledby="group-builder-title"]'
    )
    await groupDialog.waitForDisplayed({ timeout: 10_000 })
    await (
      await groupDialog.$('select[aria-label="Gruppe auswählen"]')
    ).selectByVisibleText('E2E Gruppenbeute')
    const openGenerator = await groupDialog.$('button=Loot erzeugen')
    await client.waitUntil(() => openGenerator.isEnabled(), {
      timeout: 10_000,
      timeoutMsg: 'Group Loot generator did not become available.'
    })
    await openGenerator.click()
    const groupLootPanel = await groupDialog.$('.group-loot-inline-panel')
    await (
      await groupLootPanel.$('.generated-loot-results')
    ).waitForDisplayed({ timeout: 15_000 })
    const budgetBefore = Number(
      await (
        await groupLootPanel.$('.group-loot-budget-meter')
      ).getAttribute('aria-valuenow')
    )

    await (await groupDialog.$('[role="tab"]=Loot')).click()
    const lootCatalog = await groupDialog.$('.loot-catalog-pane')
    await lootCatalog.waitForDisplayed({ timeout: 10_000 })
    const lootSearch = await lootCatalog.$('input[type="search"]')
    await addCatalogEntry(lootCatalog, lootSearch, 'Abacus')
    await addCatalogEntry(lootCatalog, lootSearch, 'Bead of Nourishment')
    await addCatalogEntry(lootCatalog, lootSearch, 'Pouch')

    const abacusRow = await findEditorRow(
      await groupLootPanel.$$('.treasure-item-editor-row'),
      'Gegenstand',
      'Abacus'
    )
    await replaceFieldValue(
      client,
      await abacusRow.$('input[aria-label="Gegenstand"]'),
      'E2E Reise-Abakus'
    )
    await (await abacusRow.$('input[aria-label="Teilbar"]')).click()
    await replaceFieldValue(
      client,
      await abacusRow.$('input[aria-label="Menge"]'),
      '2'
    )
    await replaceFieldValue(
      client,
      await abacusRow.$('input[aria-label="Wert in Kupfermünzen"]'),
      '321'
    )

    const catalogContainer = await findEditorRow(
      await groupLootPanel.$$('.treasure-container-editor-row'),
      'Behälter',
      'Pouch'
    )
    await replaceFieldValue(
      client,
      await catalogContainer.$('input[aria-label="Behälter"]'),
      'E2E Lootkiste'
    )
    await replaceFieldValue(
      client,
      await catalogContainer.$('input[aria-label="Kapazität"]'),
      '99'
    )
    await client.waitUntil(
      async () =>
        (
          await (await abacusRow.$('select[aria-label="Behälter"]')).getText()
        ).includes('E2E Lootkiste'),
      {
        timeout: 10_000,
        timeoutMsg: 'Renamed catalog container did not reach assignments.'
      }
    )
    await selectOptionContaining(
      await abacusRow.$('select[aria-label="Behälter"]'),
      'E2E Lootkiste'
    )

    const budgetAfter = Number(
      await (
        await groupLootPanel.$('.group-loot-budget-meter')
      ).getAttribute('aria-valuenow')
    )
    expect(budgetAfter).not.toBe(budgetBefore)
    expect(await groupLootPanel.getText()).toContain('Magie Ist/Soll')

    await (await groupLootPanel.$('button=Loot neu würfeln')).click()
    const discardDialog = await client.$('.discard-changes-dialog')
    await discardDialog.waitForDisplayed({ timeout: 5_000 })
    expect(await discardDialog.getText()).toContain(
      'Eigene Loot-Änderungen verwerfen?'
    )
    await (await discardDialog.$('button=Abbrechen')).click()
    await discardDialog.waitForExist({ reverse: true, timeout: 5_000 })
    expect(
      await (await abacusRow.$('input[aria-label="Gegenstand"]')).getValue()
    ).toBe('E2E Reise-Abakus')

    await expectAccessible(client)
    await expectElementGolden(
      client,
      'group-loot-preview-light',
      '.group-loot-inline-panel',
      false
    )
    await client.execute(() => {
      document.documentElement.dataset['theme'] = 'dark'
    })
    await expectElementGolden(
      client,
      'group-loot-preview-dark',
      '.group-loot-inline-panel',
      false
    )

    await (await groupLootPanel.$('button=Gruppe & Loot übernehmen')).click()
    await groupDialog.waitForExist({ reverse: true, timeout: 10_000 })
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
        editedItem: treasures
          .flatMap((treasure) => treasure.items)
          .find((item) => item.name === 'E2E Reise-Abakus'),
        editedContainer: treasures
          .flatMap((treasure) => treasure.containers)
          .find((container) => container.name === 'E2E Lootkiste'),
        catalogMagic: treasures
          .flatMap((treasure) => treasure.items)
          .find(
            (item) =>
              item.catalogItemId === 'magic:arcana:common:bead-of-nourishment'
          )
      }
    })
    expect(committed.count).toBe(1)
    expect(committed.editedItem).toMatchObject({
      quantity: 2,
      unitValueCp: 321,
      stackable: true,
      magic: false
    })
    expect(committed.editedContainer).toMatchObject({ capacity: 99 })
    expect(committed.editedItem?.containerId).toBe(
      committed.editedContainer?.id
    )
    expect(committed.catalogMagic).toMatchObject({
      magic: true,
      rarity: 'Common',
      curseName: null
    })
  })
})

async function addCatalogEntry(
  catalog: ChainablePromiseElement,
  search: ChainablePromiseElement,
  name: string
): Promise<void> {
  await search.setValue(name)
  const add = await catalog.$(`button[aria-label="${name} hinzufügen"]`)
  await add.waitForClickable({ timeout: 10_000 })
  await add.click()
}

async function findEditorRow(
  rows: readonly WdioElement[] | ChainablePromiseArray,
  label: string,
  value: string
): Promise<WdioElement> {
  for await (const row of rows)
    if (
      (await (await row.$(`input[aria-label="${label}"]`)).getValue()) === value
    )
      return row
  throw new Error(`${value} editor row is missing.`)
}

async function selectOptionContaining(
  select: ChainablePromiseElement,
  label: string
): Promise<void> {
  const options = await select.$$('option')
  for await (const option of options) {
    if (!(await option.getText()).includes(label)) continue
    const value = await option.getAttribute('value')
    if (value === null) throw new Error(`Select option ${label} has no value.`)
    await select.selectByAttribute('value', value)
    return
  }
  throw new Error(`Select option ${label} is missing.`)
}
