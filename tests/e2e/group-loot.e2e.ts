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

describe('Group Loot editor', () => {
  it('edits quantities and packing while keeping catalog definitions immutable', async () => {
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
    await client.waitUntil(
      () =>
        client.execute(() =>
          Boolean(
            document.activeElement?.closest(
              'section[aria-labelledby="group-builder-title"]'
            )
          )
        ),
      { timeout: 5_000, timeoutMsg: 'Focus did not enter the Group dialog.' }
    )
    await (
      await groupDialog.$('select[aria-label="Gruppe auswählen"]')
    ).selectByVisibleText('E2E Gruppenbeute')
    await (await groupDialog.$('[role="tab"]=Schatz-Draft')).click()
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
    await addCatalogEntry(lootCatalog, lootSearch, 'Lamp Oil (pint)')
    await addCatalogEntry(lootCatalog, lootSearch, 'Bead of Nourishment')
    await addCatalogEntry(lootCatalog, lootSearch, 'Pouch')

    const lampOilRow = await findEditorRow(
      await groupLootPanel.$$('.treasure-item-editor-row'),
      'Gegenstand',
      'Lamp Oil (pint)'
    )
    const lampOilName = await lampOilRow.$('input[aria-label="Gegenstand"]')
    const lampOilValue = await lampOilRow.$(
      'input[aria-label="Wert in Kupfermünzen"]'
    )
    const lampOilStackable = await lampOilRow.$('input[aria-label="Teilbar"]')
    expect(await lampOilName.getAttribute('readonly')).not.toBeNull()
    expect(await lampOilValue.getAttribute('readonly')).not.toBeNull()
    expect(await lampOilStackable.isEnabled()).toBe(false)
    expect(await lampOilStackable.isSelected()).toBe(true)
    expect(await lampOilName.getValue()).toBe('Lamp Oil (pint)')
    expect(await lampOilValue.getValue()).toBe('10')
    await replaceFieldValue(
      client,
      await lampOilRow.$('input[aria-label="Menge"]'),
      '2'
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
          await (await lampOilRow.$('select[aria-label="Behälter"]')).getText()
        ).includes('E2E Lootkiste'),
      {
        timeout: 10_000,
        timeoutMsg: 'Renamed catalog container did not reach assignments.'
      }
    )
    await selectOptionContaining(
      await lampOilRow.$('select[aria-label="Behälter"]'),
      'E2E Lootkiste'
    )
    const assignment = await lampOilRow.$('select[aria-label="Behälter"]')
    const assignedContainer = await assignment.getValue()
    await client.execute(() => {
      document.querySelector<HTMLElement>('.group-draft-scroll')?.focus()
    })
    await client.execute(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          bubbles: true,
          cancelable: true
        })
      )
    })
    await client.waitUntil(async () => (await assignment.getValue()) === '', {
      timeout: 5_000,
      timeoutMsg: 'Keyboard undo did not detach the item.'
    })
    await client.execute(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true
        })
      )
    })
    await client.waitUntil(
      async () => (await assignment.getValue()) === assignedContainer,
      {
        timeout: 5_000,
        timeoutMsg: 'Keyboard redo did not restore the item assignment.'
      }
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
    expect(await lampOilName.getValue()).toBe('Lamp Oil (pint)')
    expect(
      await (await lampOilRow.$('input[aria-label="Menge"]')).getValue()
    ).toBe('2')

    await client.execute(() => {
      document.querySelector<HTMLElement>('.group-draft-scroll')?.focus()
    })
    await client.keys('Escape')
    await discardDialog.waitForDisplayed({ timeout: 5_000 })
    expect(await discardDialog.getText()).toContain(
      'Ungespeicherte Änderungen verwerfen?'
    )
    await (await discardDialog.$('button=Abbrechen')).click()
    await discardDialog.waitForExist({ reverse: true, timeout: 5_000 })

    await client.execute(() => {
      document.documentElement.style.zoom = '200%'
    })
    const layout = await client.execute(() => {
      const pane = (selector: string) => {
        const root = document.querySelector<HTMLElement>(selector)
        if (!root) return null
        const scrollOwners = [
          root,
          ...root.querySelectorAll<HTMLElement>('*')
        ].filter((element) => {
          const overflow = getComputedStyle(element).overflowY
          return overflow === 'auto' || overflow === 'scroll'
        }).length
        return {
          horizontalOverflow: root.scrollWidth - root.clientWidth,
          scrollOwners
        }
      }
      return {
        catalog: pane('.loot-catalog-pane'),
        workspace: pane('.group-manager-draft-sheet')
      }
    })
    expect(layout.catalog?.horizontalOverflow ?? 1).toBeLessThanOrEqual(1)
    expect(layout.workspace?.horizontalOverflow ?? 1).toBeLessThanOrEqual(1)
    expect(layout.catalog?.scrollOwners).toBe(1)
    expect(layout.workspace?.scrollOwners).toBe(1)
    await client.execute(() => {
      document.documentElement.style.zoom = ''
    })

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
