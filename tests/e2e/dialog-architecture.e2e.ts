import { browser, expect } from '@wdio/globals'
import type {
  Browser as WdioBrowser,
  ChainablePromiseElement
} from 'webdriverio'
import {
  clickWhenInteractable,
  expectEditorFrameGeometry,
  expectAccessibleInBothThemes,
  expectElementGolden,
  setElectronWindowSize,
  setWindowToMinimumResponsiveSize
} from './support/e2e-assertions.js'

describe('dialog architecture', () => {
  it('stacks, guards and responsively lays out direct and nested table managers', async () => {
    const client = browser as unknown as WdioBrowser
    await setElectronWindowSize(client, 1150, 700)
    const campaignName = await client.$('#campaign-name')
    await campaignName.waitForDisplayed({ timeout: 10_000 })
    await campaignName.setValue('Dialog Architecture')
    await (await client.$('button=Kampagne erstellen')).click()

    await openCatalogSection(client, 'Encounter-Tabellen')
    await clickVisibleCatalogCreate(client)
    let manager = await client.$('section.encounter-table-manager')
    await manager.waitForDisplayed()
    await assertManagerLayout(client, 'columns')
    await expectAccessibleInBothThemes(client)
    await expectElementGolden(
      client,
      'dialog-architecture',
      'section.encounter-table-manager'
    )
    const sizeFilter = await manager.$(
      'input[role="combobox"][aria-label="Größe"]'
    )
    await sizeFilter.setValue('hu')
    const huge = await client.$('[role="option"]*=Huge')
    await clickWhenInteractable(huge)
    const hugeChip = await manager.$('button=Huge ×')
    await expect(hugeChip).toBeExisting()
    await hugeChip.click()

    const name = await manager.$('input[aria-label="Tabellenname"]')
    await name.setValue('Küstenbegegnungen')
    await (await manager.$('button[aria-label="Dialog schließen"]')).click()
    let discard = await client.$('[role="alertdialog"]')
    await expect(discard).toBeDisplayed()
    await expect(await discard.$('button=Abbrechen')).toBeFocused()
    await (await discard.$('button=Abbrechen')).click()
    await expect(name).toHaveValue('Küstenbegegnungen')

    const footer = await manager.$('footer.creature-collection-manager-footer')
    await (await footer.$('button=Abbrechen')).click()
    discard = await client.$('[role="alertdialog"]')
    await (await discard.$('button=Änderungen verwerfen')).click()
    await expect(manager).not.toBeExisting()

    await clickVisibleCatalogCreate(client)
    manager = await client.$('section.encounter-table-manager')
    await manager.waitForDisplayed()
    await (
      await manager.$('input[aria-label="Tabellenname"]')
    ).setValue('Direkte Tabelle')
    await addCreatureToManager(client, manager, 'wolf', 'Wolf')
    expect(
      await client.execute(() => {
        const link = [
          ...document.querySelectorAll<HTMLButtonElement>(
            '.creature-collection-catalog button.creature-collection-link'
          )
        ].find((candidate) => candidate.textContent?.trim() === 'Wolf')
        link?.click()
        return Boolean(link)
      })
    ).toBe(true)
    await (
      await manager.$('.encounter-table-roster button.creature-collection-link')
    ).click()
    await (await manager.$('button=Erstellen')).click()
    await expect(manager).not.toBeExisting()
    let inspector = await client.$('aside[aria-label="Monster Details"]')
    await inspector.waitForDisplayed({ timeout: 5_000 })
    await expect(await inspector.$('h2[aria-label="Wolf"]')).toBeExisting()
    await (
      await inspector.$('button[aria-label="Monster Details schließen"]')
    ).click()

    await (await client.$('button=Fraktionen')).click()
    await clickVisibleCatalogCreate(client)
    const faction = await client.$(
      '[role="dialog"][aria-label="Fraktion erstellen"]'
    )
    await (
      await faction.$('input[aria-label="Fraktionsname"]')
    ).setValue('Hafenwache')
    await (await faction.$('button.faction-table-card')).click()
    await clickWhenInteractable(await client.$('button=Neue Encounter-Tabelle'))
    manager = await client.$('section.encounter-table-manager')
    await manager.waitForDisplayed()

    expect(await modalState(client)).toEqual({
      appInert: true,
      depth: 2,
      inertLayers: 1,
      topModal: 'dialog'
    })
    await (
      await manager.$('input[aria-label="Tabellenname"]')
    ).setValue('Verschachtelte Tabelle')
    await addCreatureToManager(client, manager, 'wolf', 'Wolf')
    await expectElementGolden(
      client,
      'stacked-faction-encounter-dialogs',
      '.modal-backdrop[data-modal-bottom="true"]'
    )
    await (await manager.$('button[aria-label="Dialog schließen"]')).click()
    discard = await client.$('[role="alertdialog"]')
    expect(await modalState(client)).toEqual({
      appInert: true,
      depth: 3,
      inertLayers: 2,
      topModal: 'alertdialog'
    })
    await expect(await discard.$('button=Abbrechen')).toBeFocused()
    await (await discard.$('button=Abbrechen')).click()
    await expect(
      await manager.$('input[aria-label="Tabellenname"]')
    ).toHaveValue('Verschachtelte Tabelle')
    await (await manager.$('button=Erstellen und verknüpfen')).click()
    await expect(
      await faction.$('input[aria-label="Fraktionsname"]')
    ).toHaveValue('Hafenwache')
    await expect(
      await faction.$('button.faction-table-card strong')
    ).toHaveText('Verschachtelte Tabelle')
    await (await faction.$('button=Wohlgesonnen')).click()
    await expectAccessibleInBothThemes(client)
    await expectElementGolden(
      client,
      'world-faction-dialog',
      'section.world-faction-dialog'
    )

    await setWindowToMinimumResponsiveSize(client)
    await expectEditorFrameGeometry(client, '.world-faction-dialog')
    const factionLayout = await client.execute(() => {
      const dialog = document.querySelector<HTMLElement>(
        '.world-faction-dialog'
      )!
      const body = dialog.querySelector<HTMLElement>(
        '.world-faction-dialog-body'
      )!
      const footer = dialog.querySelector<HTMLElement>(
        '.world-faction-dialog-footer'
      )!
      const bounds = dialog.getBoundingClientRect()
      return {
        bodyOverflow: getComputedStyle(body).overflowY,
        footerInside: footer.getBoundingClientRect().bottom <= bounds.bottom,
        horizontalDocumentScroll:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
        right: bounds.right,
        viewportWidth: window.innerWidth
      }
    })
    expect(factionLayout).toMatchObject({
      bodyOverflow: 'auto',
      footerInside: true,
      horizontalDocumentScroll: false
    })
    expect(factionLayout.right).toBeLessThanOrEqual(factionLayout.viewportWidth)
    await expectAccessibleInBothThemes(client)
    await (await faction.$('button.faction-table-card')).click()
    await clickWhenInteractable(await client.$('button=Neue Encounter-Tabelle'))
    manager = await client.$('section.encounter-table-manager')
    await manager.waitForDisplayed()
    await assertManagerLayout(client, 'stacked')
    await expectAccessibleInBothThemes(client)
    await (await manager.$('button[aria-label="Dialog schließen"]')).click()
    await expect(manager).not.toBeExisting()
    const crLink = await faction.$('button.faction-inventory-cr-link')
    await crLink.waitForDisplayed({ timeout: 5_000 })
    expect(await crLink.getText()).toMatch(/^CR (?:0[.,]25|1\/4)$/)
    await crLink.click()
    await (await faction.$('button=Erstellen')).click()
    inspector = await client.$('aside[aria-label="Monster Details"]')
    await inspector.waitForDisplayed({ timeout: 5_000 })
    await expect(await inspector.$('h2[aria-label="Wolf"]')).toBeExisting()
  })
})

async function addCreatureToManager(
  client: WdioBrowser,
  manager: ChainablePromiseElement,
  query: string,
  name: string
) {
  await (await manager.$('input[aria-label="Monster suchen"]')).setValue(query)
  const add = await manager.$(`button[aria-label="${name} hinzufügen"]`)
  await client.waitUntil(() => add.isExisting(), {
    timeout: 5_000,
    timeoutMsg: `Shared table dialog did not render ${name}.`
  })
  await add.click()
  await expect(add).toBeDisabled()
}

async function openCatalogSection(client: WdioBrowser, label: string) {
  await (await client.$('button[aria-label="Katalog"]')).click()
  await (await client.$(`button=${label}`)).click()
}

async function clickVisibleCatalogCreate(client: WdioBrowser) {
  const host = await client.$('.catalog-section-host:not([hidden])')
  await host.waitForDisplayed()
  const create = await host.$('button=Erstellen')
  await clickWhenInteractable(create)
}

async function assertManagerLayout(
  client: WdioBrowser,
  expected: 'columns' | 'stacked'
) {
  const layout = await client.execute(() => {
    const root = document.documentElement
    const manager = document.querySelector('.creature-collection-manager')
    const grid = document.querySelector('.creature-collection-layout')
    const catalog = document.querySelector('.creature-collection-catalog')
    const draft = document.querySelector('.creature-collection-draft')
    if (
      !(manager instanceof HTMLElement) ||
      !(grid instanceof HTMLElement) ||
      !(catalog instanceof HTMLElement) ||
      !(draft instanceof HTMLElement)
    )
      return null
    const catalogBox = catalog.getBoundingClientRect()
    const draftBox = draft.getBoundingClientRect()
    return {
      columns: getComputedStyle(grid).gridTemplateAreas,
      horizontalDocumentScroll: root.scrollWidth > root.clientWidth,
      managerRight: manager.getBoundingClientRect().right,
      viewportWidth: window.innerWidth,
      stacked: draftBox.top >= catalogBox.bottom - 1
    }
  })
  expect(layout).not.toBeNull()
  expect(layout?.horizontalDocumentScroll).toBe(false)
  expect(layout?.managerRight).toBeLessThanOrEqual(layout?.viewportWidth ?? 0)
  expect(layout?.stacked).toBe(expected === 'stacked')
}

async function modalState(client: WdioBrowser) {
  return client.execute(() => {
    const layers = [...document.querySelectorAll('.modal-backdrop')]
    const top = layers.at(-1)?.querySelector('[role]')
    return {
      appInert: document
        .querySelector('.modal-app-root')
        ?.hasAttribute('inert'),
      depth: layers.length,
      inertLayers: layers.filter((layer) => layer.hasAttribute('inert')).length,
      topModal: top?.getAttribute('role') ?? ''
    }
  })
}
