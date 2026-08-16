import { browser, expect } from '@wdio/globals'
import type {
  Browser as WdioBrowser,
  ChainablePromiseArray,
  Element as WdioElement
} from 'webdriverio'
import {
  expectAccessible,
  expectElementGolden,
  replaceFieldValue,
  setElectronWindowSize
} from './support/e2e-assertions.js'

describe('Group Loot editor', () => {
  it('edits only quantities and packing while keeping generated facts fixed', async () => {
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
      await dialog.$('select[aria-label="Gruppe auswählen"]')
    ).selectByVisibleText('E2E Gruppenbeute')
    await (await dialog.$('[role="tab"]=Schatz-Draft')).click()
    const generate = await dialog.$('button=Loot erzeugen')
    await client.waitUntil(() => generate.isEnabled(), {
      timeout: 10_000,
      timeoutMsg: 'Group Loot generator did not become available.'
    })
    await generate.click()
    const panel = await dialog.$('.group-loot-inline-panel')
    await (
      await panel.$('.generated-loot-results')
    ).waitForDisplayed({
      timeout: 15_000
    })

    await (await dialog.$('[role="tab"]=Loot')).click()
    const catalog = await dialog.$('.loot-catalog-pane')
    await catalog.waitForDisplayed({ timeout: 10_000 })
    expect(await catalog.$$('button[aria-label$=" hinzufügen"]')).toHaveLength(
      0
    )

    const item = await findStackableItem(
      await panel.$$('.treasure-item-editor-row')
    )
    await item.waitForDisplayed({ timeout: 5_000 })
    const name = await item.$('input[aria-label="Gegenstand"]')
    const value = await item.$('input[aria-label="Wert in Kupfermünzen"]')
    const stackable = await item.$('input[aria-label="Teilbar"]')
    const removeItem = await item.$('button[aria-label="Gegenstand entfernen"]')
    expect(await name.getAttribute('readonly')).not.toBeNull()
    expect(await value.getAttribute('readonly')).not.toBeNull()
    expect(await stackable.isEnabled()).toBe(false)
    expect(await removeItem.isEnabled()).toBe(false)

    const quantity = await item.$('input[aria-label="Menge"]')
    const quantityBefore = Number(await quantity.getValue())
    await replaceFieldValue(client, quantity, String(quantityBefore + 1))

    const container = await panel.$('.treasure-container-editor-row')
    await container.waitForDisplayed({ timeout: 5_000 })
    expect(
      await (
        await container.$('input[aria-label="Behälter"]')
      ).getAttribute('readonly')
    ).not.toBeNull()
    expect(
      await (
        await container.$('input[aria-label="Kapazität"]')
      ).getAttribute('readonly')
    ).not.toBeNull()
    expect(
      await (
        await container.$('button[aria-label="Behälter entfernen"]')
      ).isEnabled()
    ).toBe(false)

    await client.execute(() => {
      document.querySelector<HTMLElement>('.group-draft-scroll')?.focus()
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          bubbles: true,
          cancelable: true
        })
      )
    })
    await client.waitUntil(
      async () => Number(await quantity.getValue()) === quantityBefore,
      { timeout: 5_000, timeoutMsg: 'Keyboard undo did not restore quantity.' }
    )
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
      async () => Number(await quantity.getValue()) === quantityBefore + 1,
      { timeout: 5_000, timeoutMsg: 'Keyboard redo did not restore quantity.' }
    )

    expect(await panel.getText()).toContain('Magie Ist/Soll')
    await (await panel.$('button=Loot neu würfeln')).click()
    const discard = await client.$('.discard-changes-dialog')
    await discard.waitForDisplayed({ timeout: 5_000 })
    expect(await discard.getText()).toContain(
      'Eigene Loot-Änderungen verwerfen?'
    )
    await (await discard.$('button=Abbrechen')).click()
    await discard.waitForExist({ reverse: true, timeout: 5_000 })

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

async function findStackableItem(
  rows: readonly WdioElement[] | ChainablePromiseArray
): Promise<WdioElement> {
  for await (const row of rows)
    if (await (await row.$('input[aria-label="Teilbar"]')).isSelected())
      return row
  throw new Error('Generated Group Loot has no stackable item row.')
}
