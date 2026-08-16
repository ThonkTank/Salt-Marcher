import { browser, expect } from '@wdio/globals'
import type {
  Browser as WdioBrowser,
  ChainablePromiseElement
} from 'webdriverio'
import {
  expectAccessibleInBothThemes,
  setElectronWindowSize,
  setWindowToMinimumResponsiveSize
} from './support/e2e-assertions.js'

describe('NPC catalog journey', () => {
  it('creates, links, edits, restarts, inspects and deletes an NPC accessibly', async () => {
    const client = browser as unknown as WdioBrowser
    const campaignName = await client.$('#campaign-name')
    await campaignName.waitForDisplayed({ timeout: 30_000 })
    await campaignName.setValue('NPC Journey')
    await (await client.$('button=Anlegen')).click()
    await (
      await client.$('section[aria-label="Session Steuerung"]')
    ).waitForExist({ timeout: 10_000 })

    await (await client.$('button[aria-label="Katalog"]')).click()
    await createFaction(client, 'Rosenhof E2E')
    await createLocation(client, 'Flussuferhöhle E2E')
    await createNpc(client)

    let row = await npcRow(client, 'Erika E2E')
    await (await row.$('button=Erika E2E')).click()
    let inspector = await client.$('aside[aria-label="NPC-Inspector"]')
    await expect(await inspector.$('h2=Erika E2E')).toBeExisting()
    await expect(await inspector.$('dd=Rosenhof E2E')).toBeExisting()
    await expect(await inspector.$('dd=Flussuferhöhle E2E')).toBeExisting()
    await (await inspector.$('button=Bearbeiten')).click()
    const dialog = await client.$(
      '[role="dialog"][aria-label="NPC bearbeiten"]'
    )
    await dialog.waitForDisplayed({ timeout: 10_000 })
    await (
      await dialog.$('select[aria-label="Status"]')
    ).selectByVisibleText('Besiegt')
    await textArea(dialog, 'Verhalten').setValue('Nach dem Kampf vorsichtig.')
    await (await dialog.$('button=Speichern')).click()
    await dialog.waitForExist({ reverse: true, timeout: 10_000 })

    await setWindowToMinimumResponsiveSize(client)
    const bounds = await client.execute(() => {
      const catalog = document.querySelector<HTMLElement>('.npc-catalog-layout')
      const inspectorElement =
        document.querySelector<HTMLElement>('.npc-inspector')
      if (!catalog || !inspectorElement) return null
      const outer = catalog.getBoundingClientRect()
      const detail = inspectorElement.getBoundingClientRect()
      const workspace = catalog.closest<HTMLElement>('.catalog-workspace')!
      const browser = catalog.closest<HTMLElement>('.catalog-browser')!
      const workArea = catalog.closest<HTMLElement>('.work-area')!
      const shellBody = catalog.closest<HTMLElement>('.shell-body')!
      const appShell = catalog.closest<HTMLElement>('.app-shell')!
      return {
        outerLeft: outer.left,
        outerTop: outer.top,
        outerWidth: outer.width,
        outerHeight: outer.height,
        outerRight: outer.right,
        detailRight: detail.right,
        viewportWidth: window.innerWidth,
        outerBottom: outer.bottom,
        viewportHeight: window.innerHeight,
        workspaceWidth: workspace.getBoundingClientRect().width,
        workspaceMinWidth: getComputedStyle(workspace).minWidth,
        workspaceColumns: getComputedStyle(workspace).gridTemplateColumns,
        browserWidth: browser.getBoundingClientRect().width,
        browserHeight: browser.getBoundingClientRect().height,
        workspaceHeight: workspace.getBoundingClientRect().height,
        workArea: workArea.getBoundingClientRect().toJSON(),
        shellBody: shellBody.getBoundingClientRect().toJSON(),
        appShell: appShell.getBoundingClientRect().toJSON(),
        appShellHeight: getComputedStyle(appShell).height
      }
    })
    expect(bounds).not.toBeNull()
    if (bounds!.outerRight > bounds!.viewportWidth)
      throw new Error(`NPC viewport overflow: ${JSON.stringify(bounds)}`)
    if (bounds!.outerBottom > bounds!.viewportHeight)
      throw new Error(`NPC viewport overflow: ${JSON.stringify(bounds)}`)
    expect(bounds!.outerRight).toBeLessThanOrEqual(bounds!.viewportWidth)
    expect(bounds!.detailRight).toBeLessThanOrEqual(bounds!.viewportWidth)
    expect(bounds!.outerBottom).toBeLessThanOrEqual(bounds!.viewportHeight)
    await setElectronWindowSize(client, 1280, 800)

    await client.reloadSession()
    await (
      await client.$('h1=Session · NPC Journey')
    ).waitForExist({ timeout: 20_000 })
    await (await client.$('button[aria-label="Katalog"]')).click()
    await (await client.$('button=NPCs')).click()
    row = await npcRow(client, 'Erika E2E')
    await expect(await row.$('td*=Besiegt')).toBeExisting()
    await (await row.$('button=Erika E2E')).click()
    inspector = await client.$('aside[aria-label="NPC-Inspector"]')
    await expect(
      await inspector.$('p=Nach dem Kampf vorsichtig.')
    ).toBeExisting()

    await expectAccessibleInBothThemes(client)

    row = await npcRow(client, 'Erika E2E')
    await (await row.$('button=Löschen')).click()
    await (await row.$('button=Bestätigen')).click()
    await client.waitUntil(
      async () => !(await (await client.$('button=Erika E2E')).isExisting()),
      { timeout: 10_000, timeoutMsg: 'NPC was not deleted.' }
    )
  })
})

async function createFaction(client: WdioBrowser, name: string): Promise<void> {
  await (await client.$('button=Fraktionen')).click()
  await clickVisibleCreate(client)
  const dialog = await client.$(
    '[role="dialog"][aria-label="Fraktion erstellen"]'
  )
  await dialog.waitForDisplayed({ timeout: 10_000 })
  await (await dialog.$('input[aria-label="Fraktionsname"]')).setValue(name)
  await (await dialog.$('button=Erstellen')).click()
  await (await client.$(`button=${name}`)).waitForExist({ timeout: 10_000 })
}

async function createLocation(
  client: WdioBrowser,
  name: string
): Promise<void> {
  await (await client.$('button=Orte')).click()
  await clickVisibleCreate(client)
  const dialog = await client.$('[role="dialog"][aria-label="Ort erstellen"]')
  await dialog.waitForDisplayed({ timeout: 10_000 })
  await (await dialog.$('input[aria-label="Ortsname"]')).setValue(name)
  await (await dialog.$('input[aria-label="Tags"]')).setValue('Höhle')
  await client.keys(['Enter'])
  await (await dialog.$('button=Erstellen')).click()
  await (
    await client.$(`h2[aria-label="${name}"]`)
  ).waitForExist({ timeout: 10_000 })
  await (await client.$('button[aria-label="Ort Details schließen"]')).click()
}

async function createNpc(client: WdioBrowser): Promise<void> {
  await (await client.$('button=NPCs')).click()
  const catalog = await client.$('.npc-catalog-layout')
  await catalog.waitForDisplayed({ timeout: 10_000 })
  const geometry = await client.execute(() => {
    const layout = document.querySelector<HTMLElement>('.npc-catalog-layout')!
    const browser = layout.querySelector<HTMLElement>('.npc-catalog-browser')!
    const button = browser.querySelector<HTMLButtonElement>('button')!
    const inspector = layout.querySelector<HTMLElement>('.npc-inspector')!
    const bounds = (element: HTMLElement) => {
      const box = element.getBoundingClientRect()
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom
      }
    }
    return {
      layout: bounds(layout),
      browser: bounds(browser),
      button: bounds(button),
      inspector: bounds(inspector),
      columns: getComputedStyle(layout).gridTemplateColumns
    }
  })
  if (geometry.button.right > geometry.inspector.left)
    throw new Error(
      `NPC catalog controls overlap Inspector: ${JSON.stringify(geometry)}`
    )
  await (await catalog.$('button=Erstellen')).click()
  const dialog = await client.$('[role="dialog"][aria-label="NPC erstellen"]')
  await dialog.waitForDisplayed({ timeout: 10_000 })
  await (
    await dialog.$('input[required][maxlength="100"]')
  ).setValue('Erika E2E')
  const statblock = await dialog.$(
    'input[role="combobox"][aria-label="Statblock"]'
  )
  await statblock.setValue('sprite')
  const option = await client.$('button[role="option"]*=Sprite')
  await option.waitForDisplayed({ timeout: 10_000 })
  await option.click()
  await (
    await dialog.$('select[aria-label="Fraktion"]')
  ).selectByVisibleText('Rosenhof E2E')
  await (
    await dialog.$('select[aria-label="Ort"]')
  ).selectByVisibleText('Flussuferhöhle E2E')
  await textArea(dialog, 'Aussehen').setValue('Silberne Flügel.')
  await textArea(dialog, 'Verhalten').setValue('Neugierig.')
  await textArea(dialog, 'Geschichte').setValue('Aus dem Rosenhof.')
  await textArea(dialog, 'Notizen').setValue('Vollständiger Ursprungstext.')
  await (await dialog.$('button=Speichern')).click()
  await dialog.waitForExist({ reverse: true, timeout: 10_000 })
}

async function clickVisibleCreate(client: WdioBrowser): Promise<void> {
  const buttons = await client.$$('button=Erstellen')
  for (const button of buttons)
    if (await button.isDisplayed()) {
      await button.click()
      return
    }
  throw new Error('Visible catalog create action is missing.')
}

async function npcRow(
  client: WdioBrowser,
  name: string
): Promise<ChainablePromiseElement> {
  const row = await client.$(`//tr[.//button[normalize-space()="${name}"]]`)
  await row.waitForExist({ timeout: 10_000 })
  return row
}

function textArea(
  dialog: ChainablePromiseElement,
  label: string
): ChainablePromiseElement {
  return dialog.$(`//label[contains(normalize-space(.), "${label}")]//textarea`)
}
