import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import {
  expectAccessibleInBothThemes,
  expectElementGolden
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
    const huge = await manager.$('[role="option"]*=Huge')
    await huge.waitForDisplayed()
    await huge.click()
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
    await (await manager.$('button=Erstellen')).click()
    await expect(manager).not.toBeExisting()

    await (await client.$('button=Fraktionen')).click()
    await clickVisibleCatalogCreate(client)
    const faction = await client.$(
      '[role="dialog"][aria-label="Fraktion erstellen"]'
    )
    await (
      await faction.$('input[aria-label="Fraktionsname"]')
    ).setValue('Hafenwache')
    await (await faction.$('button=Neue Encounter-Tabelle')).click()
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
    await (await manager.$('button=Erstellen')).click()
    await expect(
      await faction.$('input[aria-label="Fraktionsname"]')
    ).toHaveValue('Hafenwache')
    await expect(
      await faction.$(
        'select[aria-label="Primäre Encounter-Tabelle"] option:checked'
      )
    ).toHaveText('Verschachtelte Tabelle')

    await setElectronWindowSize(client, 900, 650)
    await (await faction.$('button=Neue Encounter-Tabelle')).click()
    manager = await client.$('section.encounter-table-manager')
    await manager.waitForDisplayed()
    await assertManagerLayout(client, 'stacked')
    await expectAccessibleInBothThemes(client)
    await (await manager.$('button[aria-label="Dialog schließen"]')).click()
    await expect(manager).not.toBeExisting()
    await (await faction.$('button=Abbrechen')).click()
    discard = await client.$('[role="alertdialog"]')
    await (await discard.$('button=Änderungen verwerfen')).click()
  })
})

async function setElectronWindowSize(
  client: WdioBrowser,
  width: number,
  height: number
) {
  const electronClient = client as WdioBrowser & {
    electron: {
      execute: (
        script: (
          electron: typeof import('electron'),
          width: number,
          height: number
        ) => boolean,
        width: number,
        height: number
      ) => Promise<boolean>
    }
  }
  const resized = await electronClient.electron.execute(
    (electron, nextWidth, nextHeight) => {
      const window =
        electron.BrowserWindow.getFocusedWindow() ??
        electron.BrowserWindow.getAllWindows().find(
          (candidate) => !candidate.isDestroyed() && candidate.isVisible()
        )
      if (!window) return false
      window.setSize(nextWidth, nextHeight)
      return true
    },
    width,
    height
  )
  expect(resized).toBe(true)
  await client.waitUntil(
    async () =>
      (
        await client.execute(() => ({
          width: window.innerWidth,
          height: window.innerHeight
        }))
      ).width <= width,
    {
      timeout: 15_000,
      timeoutMsg: 'Renderer did not observe the window resize'
    }
  )
}

async function openCatalogSection(client: WdioBrowser, label: string) {
  await (await client.$('button[aria-label="Katalog"]')).click()
  await (await client.$(`button=${label}`)).click()
}

async function clickVisibleCatalogCreate(client: WdioBrowser) {
  const host = await client.$('.catalog-section-host:not([hidden])')
  await host.waitForDisplayed()
  const create = await host.$('button=Erstellen')
  await create.waitForClickable()
  await create.click()
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
