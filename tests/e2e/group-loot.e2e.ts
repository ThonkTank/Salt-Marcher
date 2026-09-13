import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { resumeCampaignFromScreen } from './support/campaign-navigation.js'
import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import {
  expectAccessible,
  expectElementGolden,
  setElectronWindowSize
} from './support/e2e-assertions.js'

describe('Group Loot editor', () => {
  it('manually selects loot and keeps both compact views and histories', async () => {
    const client = browser as unknown as WdioBrowser
    await resumeCampaignFromScreen(client)
    await setElectronWindowSize(client, 1280, 800)
    await client
      .$('h1=Session · Gruppenloot-Abnahme')
      .waitForExist({ timeout: 15000 })
    const expand = client.$('button[aria-label="E2E Gruppenbeute aufklappen"]')
    if (await expand.isExisting()) await expand.click()
    await client
      .$('.group-register[aria-label="E2E Gruppenbeute"]')
      .$('button=Loot bearbeiten')
      .click()
    const dialog = client.$('section[aria-labelledby="group-builder-title"]')
    await dialog.waitForDisplayed({ timeout: 10000 })
    await expect(dialog.$('[role="tab"]=Loot')).toHaveAttribute(
      'aria-selected',
      'true'
    )
    const search = () => dialog.$('.loot-catalog-pane input[type="search"]')
    await search().setValue('Gold Coin')
    const add = dialog.$('button[aria-label="Gold Coin hinzufügen"]')
    try {
      await add.waitForDisplayed()
    } catch (cause) {
      throw new Error(await dialog.getText(), { cause })
    }
    await add.click()
    await dialog.$('.group-editor-selection').$('summary=Münzen').click()
    const coins = dialog.$(
      '.group-editor-selection button[aria-label="Gold Coin: Menge erhöhen"]'
    )
    await coins.click()
    await expect(dialog.$('.group-editor-selection output')).toHaveText('2')
    await dialog.$('[role="tab"]=Monster').click()
    await expect(dialog.$('input[aria-label="Monster suchen"]')).toBeDisplayed()
    const monsterCatalog = () => dialog.$('.group-editor-catalog')
    await monsterCatalog().$('summary=Filter').click()
    for (const label of [
      'CR minimum',
      'CR maximum',
      'Größe',
      'Typ',
      'Unterart',
      'Biom',
      'Gesinnung',
      'Tabelle',
      'Fraktionen',
      'Ort'
    ])
      await expect(monsterCatalog().$(`[aria-label="${label}"]`)).toBeExisting()
    await monsterCatalog()
      .$('select[aria-label="CR maximum"]')
      .selectByAttribute('value', '1')
    await dialog.$('[role="tab"]=Loot').click()
    await dialog.$('[role="tab"]=Monster').click()
    await monsterCatalog().$('summary=Filter').click()
    await expect(
      monsterCatalog().$('select[aria-label="CR maximum"]')
    ).toHaveValue('1')
    await dialog.$('[role="tab"]=Loot').click()
    await expect(search()).toHaveValue('Gold Coin')
    await dialog.$('.group-editor-selection').$('summary=Münzen').click()
    await expect(dialog.$('.group-editor-selection output')).toHaveText('2')
    await dialog.$('button[aria-label="Änderung zurücknehmen"]').click()
    await expect(dialog.$('.group-editor-selection output')).toHaveText('1')
    await dialog.$('button[aria-label="Änderung wiederholen"]').click()
    await expect(dialog.$('.group-editor-selection output')).toHaveText('2')
    await dialog.$('button=Loot generieren').click()
    const discard = client.$('.discard-changes-dialog')
    await discard.waitForDisplayed()
    await discard.$('button=Abbrechen').click()
    await expect(dialog.$('.group-editor-selection output')).toHaveText('2')
    await expect(dialog.$('.group-editor-balance')).toHaveText(
      expect.stringContaining('Abweichung')
    )
    await setElectronWindowSize(client, 720, 540)
    await expectAccessible(client)
    await captureEditor(client, 'group-editor-minimum')
    await setElectronWindowSize(client, 1280, 800)
    await setZoom(client, 2)
    const geometry = await client.execute(() => {
      const editor = document.querySelector<HTMLElement>('.group-editor')!
      const rect = editor.getBoundingClientRect()
      return {
        right: rect.right,
        bottom: rect.bottom,
        width: innerWidth,
        height: innerHeight,
        overflow: [
          ...document.querySelectorAll<HTMLElement>(
            '.group-editor,.loot-catalog-pane,.group-editor-selection'
          )
        ].map((e) => e.scrollWidth - e.clientWidth)
      }
    })
    expect(geometry.right).toBeLessThanOrEqual(geometry.width + 1)
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.height + 1)
    for (const value of geometry.overflow) expect(value).toBeLessThanOrEqual(1)
    await expectAccessible(client)
    await captureEditor(client, 'group-editor-zoom')
    await setZoom(client, 1)
    await setElectronWindowSize(client, 1280, 800)
    await expectElementGolden(
      client,
      'group-loot-preview-light',
      '.group-editor',
      false
    )
    await client.execute(() => {
      document.documentElement.dataset['theme'] = 'dark'
    })
    await expectElementGolden(
      client,
      'group-loot-preview-dark',
      '.group-editor',
      false
    )
  })
})

async function setZoom(client: WdioBrowser, factor: number) {
  // The resize helper can emulate a viewport on desktop hosts. Clear that
  // override so this assertion exercises Electron zoom on the real window.
  const url = await client.getUrl()
  const puppeteer = await client.getPuppeteer()
  const page = (await puppeteer.pages()).find(
    (candidate) => candidate.url() === url
  )
  if (!page) throw new Error('Renderer page missing')
  const cdp = await page.createCDPSession()
  await cdp.send('Emulation.clearDeviceMetricsOverride')
  await cdp.detach()
  const electronClient = client as WdioBrowser & {
    electron: {
      execute: (
        script: (
          electron: typeof import('electron'),
          url: string,
          factor: number
        ) => number,
        url: string,
        factor: number
      ) => Promise<number>
    }
  }
  const previousScale = await client.execute(() => devicePixelRatio)
  const previousZoom = await electronClient.electron.execute(
    (electron, url, next) => {
      const candidates = electron.BrowserWindow.getAllWindows().filter(
        (w) => w.webContents.getURL() === url
      )
      const target =
        candidates.find((w) => w.isFocused()) ??
        candidates.find((w) => w.isVisible()) ??
        candidates[0]
      if (!target) throw new Error('Renderer window missing')
      const previous = target.webContents.getZoomFactor()
      target.webContents.setZoomFactor(next)
      return previous
    },
    await client.getUrl(),
    factor
  )
  await client.waitUntil(
    async () =>
      Math.abs(
        (await client.execute(() => devicePixelRatio)) -
          (previousScale * factor) / previousZoom
      ) < 0.01
  )
}

async function captureEditor(client: WdioBrowser, name: string) {
  const artifacts =
    process.env['SALT_MARCHER_E2E_ARTIFACT_DIR'] ?? '.tmp/visual-diffs'
  mkdirSync(artifacts, { recursive: true })
  await client.saveScreenshot(join(artifacts, `${name}.png`))
}
