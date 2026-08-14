import { browser, expect } from '@wdio/globals'
import type {
  Browser as WdioBrowser,
  ChainablePromiseArray,
  ChainablePromiseElement,
  Element as WdioElement
} from 'webdriverio'
import {
  replaceFieldValue,
  setElectronWindowSize
} from './support/e2e-assertions.js'
import { waitForGmRendererReady } from './support/e2e-ready.js'

describe('Group Loot atomic commit', () => {
  it('persists edited normal, magic, and packed catalog Loot across restart', async () => {
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
    ).waitForDisplayed({ timeout: 15_000 })

    const catalog = await dialog.$('.loot-catalog-pane')
    await catalog.waitForDisplayed({ timeout: 10_000 })
    const search = await catalog.$('input[type="search"]')
    await addCatalogEntry(catalog, search, 'Abacus')
    await addCatalogEntry(catalog, search, 'Bead of Nourishment')
    await addCatalogEntry(catalog, search, 'Pouch')

    const abacus = await findEditorRow(
      await panel.$$('.treasure-item-editor-row'),
      'Gegenstand',
      'Abacus'
    )
    await replaceFieldValue(
      client,
      await abacus.$('input[aria-label="Gegenstand"]'),
      'E2E Reise-Abakus'
    )
    await (await abacus.$('input[aria-label="Teilbar"]')).click()
    await replaceFieldValue(
      client,
      await abacus.$('input[aria-label="Menge"]'),
      '2'
    )
    await replaceFieldValue(
      client,
      await abacus.$('input[aria-label="Wert in Kupfermünzen"]'),
      '321'
    )
    const container = await findEditorRow(
      await panel.$$('.treasure-container-editor-row'),
      'Behälter',
      'Pouch'
    )
    await replaceFieldValue(
      client,
      await container.$('input[aria-label="Behälter"]'),
      'E2E Lootkiste'
    )
    await replaceFieldValue(
      client,
      await container.$('input[aria-label="Kapazität"]'),
      '99'
    )
    await selectOptionContaining(
      await abacus.$('select[aria-label="Behälter"]'),
      'E2E Lootkiste'
    )

    await (await panel.$('button=Gruppe & Loot übernehmen')).click()
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
        editedItem: treasures
          .flatMap((treasure) => treasure.items)
          .find((item) => item.name === 'E2E Reise-Abakus'),
        editedContainer: treasures
          .flatMap((treasure) => treasure.containers)
          .find((candidate) => candidate.name === 'E2E Lootkiste'),
        catalogMagic: treasures
          .flatMap((treasure) => treasure.items)
          .find(
            (item) =>
              item.provenance.kind === 'catalog' &&
              item.provenance.catalogEntry.kind === 'magic_item' &&
              item.provenance.catalogEntry.id ===
                'magic:arcana:common:bead-of-nourishment'
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
