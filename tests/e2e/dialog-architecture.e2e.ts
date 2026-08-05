import { browser, expect } from '@wdio/globals'
import { AxeBuilder } from '@axe-core/webdriverio'
import type { Browser as WdioBrowser } from 'webdriverio'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

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
    const faction = await client.$('form[aria-label="Fraktion erstellen"]')
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
        ) => void,
        width: number,
        height: number
      ) => Promise<void>
    }
  }
  await electronClient.electron.execute(
    (electron, nextWidth, nextHeight) => {
      electron.BrowserWindow.getFocusedWindow()?.setSize(nextWidth, nextHeight)
    },
    width,
    height
  )
  await client.waitUntil(
    async () =>
      (
        await client.execute(() => ({
          width: window.innerWidth,
          height: window.innerHeight
        }))
      ).width <= width,
    { timeout: 5_000, timeoutMsg: 'Renderer did not observe the window resize' }
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

async function expectAccessibleInBothThemes(client: WdioBrowser) {
  await expectAccessible(client)
  await toggleTheme(client)
  await expectAccessible(client)
  await toggleTheme(client)
}

async function toggleTheme(client: WdioBrowser) {
  await client.execute(() => {
    document.querySelector<HTMLButtonElement>('.theme-toggle')?.click()
  })
}

async function expectAccessible(client: WdioBrowser) {
  const results = await new AxeBuilder({ client }).setLegacyMode().analyze()
  expect(results.violations).toEqual([])
}

async function expectElementGolden(
  client: WdioBrowser,
  name: string,
  selector: string
) {
  if (process.platform !== 'linux') return
  await client.execute(() => {
    const style = document.createElement('style')
    style.textContent =
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'
    document.head.append(style)
  })
  const directory = join(process.cwd(), 'tests', 'e2e', 'goldens', 'linux')
  const artifacts = join(process.cwd(), '.tmp', 'visual-diffs')
  mkdirSync(directory, { recursive: true })
  mkdirSync(artifacts, { recursive: true })
  const actualPath = join(artifacts, `${name}.png`)
  const baselinePath = join(directory, `${name}.png`)
  const bytes = await (await client.$(selector)).saveScreenshot(actualPath)
  if (process.env['UPDATE_VISUAL_GOLDENS'] === '1') {
    writeFileSync(baselinePath, bytes)
    return
  }
  if (!existsSync(baselinePath))
    throw new Error(`Missing golden ${baselinePath}`)
  const expected = PNG.sync.read(readFileSync(baselinePath))
  const actual = PNG.sync.read(bytes)
  expect({ width: actual.width, height: actual.height }).toEqual({
    width: expected.width,
    height: expected.height
  })
  const diff = new PNG({ width: actual.width, height: actual.height })
  const changed = pixelmatch(
    expected.data,
    actual.data,
    diff.data,
    actual.width,
    actual.height,
    { threshold: 0.2 }
  )
  writeFileSync(join(artifacts, `${name}.diff.png`), PNG.sync.write(diff))
  expect(changed / (actual.width * actual.height)).toBeLessThanOrEqual(0.03)
}
