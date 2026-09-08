import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { resumeCampaignFromScreen } from './support/campaign-navigation.js'
import {
  expectAccessibleInBothThemes,
  setElectronWindowSize,
  setWindowToMinimumResponsiveSize
} from './support/e2e-assertions.js'

describe('per-scene desktop preview', () => {
  it('preserves separate arrangements and intentional closure through navigation and process restart', async () => {
    const client = browser as unknown as WdioBrowser
    await resumeCampaignFromScreen(client)
    await client.$('.session-mockup').waitForDisplayed({ timeout: 30_000 })
    await client.$('button[aria-label="Menü"]').click()
    const toggle = client.$('.desktop-preview-setting input')
    await expect(toggle).not.toBeSelected()
    await toggle.click()
    await client.keys('Escape')
    await client.$('.desktop-window').waitForDisplayed({ timeout: 10_000 })
    const spansWorkspace = await client.execute(() => {
      const desktop = document
        .querySelector('.scene-desktop')!
        .getBoundingClientRect()
      const work = document.querySelector('.work-area')!.getBoundingClientRect()
      return Math.abs(desktop.width - work.width) < 2
    })
    expect(spansWorkspace).toBe(true)
    expect(await client.$('.desktop-register').getText()).toContain('Edrik')
    const identities = await client
      .$$('select[aria-label="Szene"] option')
      .map((option) => option.getAttribute('value'))
    if (identities.length < 2)
      throw new Error(
        'Desktop acceptance requires two populated fixture scenes'
      )
    const first = await client.$('select[aria-label="Szene"]').getValue()
    const second = identities.find((id) => id !== first)!
    await client
      .$('button[aria-label="Fenster mit Pfeiltasten verschieben"]')
      .click()
    await client.keys(['ArrowRight', 'ArrowRight'])
    await waitSaved(client)
    const preferred = await geometry(client)
    await client.$('button[aria-label="Maximieren"]').click()
    await client.$('button[aria-label="Wiederherstellen"]').click()
    await waitSaved(client)
    expect(await geometry(client)).toEqual(preferred)
    await client.$('button[aria-label="Minimieren"]').click()
    await expect(client.$('.desktop-window')).not.toBeExisting()
    await client.$('.desktop-taskbar button').click()
    await waitSaved(client)
    expect(await geometry(client)).toEqual(preferred)

    await client
      .$('select[aria-label="Szene"]')
      .selectByAttribute('value', second)
    await expect(client.$('.scene-desktop')).toHaveAttribute(
      'data-scene-id',
      second
    )
    await waitSaved(client)
    await client.$('.desktop-window').waitForDisplayed({ timeout: 10_000 })
    await client.$('button[aria-label="Fenster schließen"]').click()
    await waitSaved(client)
    await expect(client.$('.desktop-window')).not.toBeExisting()
    await client
      .$('select[aria-label="Szene"]')
      .selectByAttribute('value', first)
    await expect(client.$('.scene-desktop')).toHaveAttribute(
      'data-scene-id',
      first
    )
    await waitSaved(client)
    await client.$('.desktop-window').waitForDisplayed({ timeout: 10_000 })
    expect(await geometry(client)).toEqual(preferred)
    await client.$('button[aria-label="Katalog"]').click()
    await client.$('.catalog-workspace').waitForDisplayed({ timeout: 10_000 })
    await client.$('button[aria-label="Session"]').click()
    await client.$('.desktop-window').waitForDisplayed({ timeout: 10_000 })
    expect(await geometry(client)).toEqual(preferred)
    await expectAccessibleInBothThemes(client)
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await client.$('.desktop-window').waitForDisplayed({ timeout: 30_000 })
    await client.$('button[aria-label="Menü"]').click()
    await expect(client.$('.desktop-preview-setting input')).toBeSelected()
    await client.keys('Escape')
    expect(await geometry(client)).toEqual(preferred)
    await client
      .$('select[aria-label="Szene"]')
      .selectByAttribute('value', second)
    await expect(client.$('.scene-desktop')).toHaveAttribute(
      'data-scene-id',
      second
    )
    await waitSaved(client)
    await waitSaved(client)
    await expect(client.$('.desktop-window')).not.toBeExisting()
    await client.$('.desktop-toolbar').$('button=Szenenübersicht').click()
    await client.$('.desktop-window').waitForDisplayed({ timeout: 10_000 })
    await setWindowToMinimumResponsiveSize(client)
    console.info(
      'desktop-minimum-geometry',
      await client.execute(() => {
        const frame = document.querySelector<HTMLElement>('.desktop-window')!
        const stage = document.querySelector<HTMLElement>('.desktop-stage')!
        return {
          frame: frame.getBoundingClientRect().toJSON(),
          stage: stage.getBoundingClientRect().toJSON(),
          css: frame.getAttribute('style'),
          computedHeight: getComputedStyle(frame).height
        }
      })
    )
    await client.waitUntil(
      () =>
        client.execute(() => {
          const frame = document
            .querySelector('.desktop-window')!
            .getBoundingClientRect()
          const area = document
            .querySelector('.desktop-stage')!
            .getBoundingClientRect()
          return (
            frame.left >= area.left &&
            frame.right <= area.right &&
            frame.top >= area.top &&
            frame.bottom <= area.bottom
          )
        }),
      {
        timeout: 10_000,
        timeoutMsg: 'Desktop window did not fit the smaller viewport'
      }
    )
    await client.$('button[aria-label="Menü"]').click()
    await client.$('.desktop-preview-setting input').click()
    await client.keys('Escape')
    await client.$('.session-mockup').waitForDisplayed({ timeout: 10_000 })
    await expect(client.$('.desktop-error')).not.toBeExisting()
  })
  it('reads independent item and location documents with history and restored scroll', async () => {
    const client = browser as unknown as WdioBrowser
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await client.$('button[aria-label="Menü"]').click()
    await client.$('.desktop-preview-setting input').click()
    await client.keys('Escape')
    await client.$('.scene-desktop').waitForDisplayed()
    await setElectronWindowSize(client, 1200, 900)
    const original = await client.$('select[aria-label="Szene"]').getValue()
    const sceneIds = await client
      .$$('select[aria-label="Szene"] option')
      .map((option) => option.getAttribute('value'))
    const other = sceneIds.find((id) => id !== original)!
    await client.$('.desktop-toolbar').$('button*=Nachschlagen').click()
    const search = client.$('[data-window-id="search"]')
    await search.$('input[type="search"]').setValue('Longsword')
    await search.$('[data-reference-kind="item"] button:first-child').click()
    const reader = client.$('[data-window-id="reader"]')
    await client
      .$('[data-window-id="reader"] .reference-document')
      .waitForDisplayed()
    await reader.$('button[aria-label="Maximieren"]').click()
    await reader.$('button[aria-label="Wiederherstellen"]').click()
    await reader.$('button=Separat öffnen').click()
    const separateSelector =
      '.desktop-window:not([data-window-id="reader"]):not([data-window-id="search"]):not([data-window-id="overview"])'
    await client.$(separateSelector).waitForDisplayed()
    await client.$(separateSelector).$('summary').click()
    await client.$(separateSelector).$('button=Linke Hälfte').click()
    await client.$('.desktop-taskbar').$('button*=Nachschlagen').click()
    await search.$('input[type="search"]').setValue('Salzmarschhafen')
    await search
      .$('[data-reference-kind="location"] button:first-child')
      .click()
    await expect(reader.$('.reference-document')).toHaveText(
      expect.stringContaining('Kai 30')
    )
    await reader.$('summary').click()
    await reader.$('button=Rechte Hälfte').click()
    await client.$('.desktop-taskbar').$('button*=Nachschlagen').click()
    await search.$('button[aria-label="Minimieren"]').click()
    const scrollRange = await client.execute(() => {
      const scroll = document.querySelector<HTMLElement>(
        '[data-window-id="reader"] .desktop-reference-scroll'
      )!
      scroll.scrollTop = 200
      scroll.dispatchEvent(new Event('scroll', { bubbles: true }))
      return scroll.scrollHeight - scroll.clientHeight
    })
    expect(scrollRange).toBeGreaterThan(200)
    await waitSaved(client)
    await reader.$('button[aria-label="Zurück"]').click()
    await expect(reader.$('h2')).toHaveText('Longsword')
    await reader.$('button[aria-label="Vorwärts"]').click()
    await expect(reader.$('h2')).toHaveText('Salzmarschhafen')
    await client.waitUntil(() =>
      client.execute(
        () =>
          document.querySelector(
            '[data-window-id="reader"] .desktop-reference-scroll'
          )!.scrollTop === 200
      )
    )
    await expectAccessibleInBothThemes(client)
    await client
      .$('select[aria-label="Szene"]')
      .selectByAttribute('value', other)
    await expect(client.$('.scene-desktop')).toHaveAttribute(
      'data-scene-id',
      other
    )
    await waitSaved(client)
    await expect(client.$('[data-window-id="reader"]')).not.toBeExisting()
    await client
      .$('select[aria-label="Szene"]')
      .selectByAttribute('value', original)
    await expect(client.$('.scene-desktop')).toHaveAttribute(
      'data-scene-id',
      original
    )
    await client
      .$('[data-window-id="reader"] .reference-document')
      .waitForDisplayed()
    await waitSaved(client)
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await client
      .$('[data-window-id="reader"] .reference-document')
      .waitForDisplayed({ timeout: 30_000 })
    await expect(client.$('[data-window-id="reader"] h2')).toHaveText(
      'Salzmarschhafen'
    )
    await client.waitUntil(() =>
      client.execute(
        () =>
          document.querySelector(
            '[data-window-id="reader"] .desktop-reference-scroll'
          )!.scrollTop === 200
      )
    )
    await expect(client.$$(separateSelector)).toBeElementsArrayOfSize(1)
    await client.$('.desktop-taskbar').$('button*=Nachschlagen').click()
    const restoredSearch = client.$('[data-window-id="search"]')
    await restoredSearch.$('input[type="search"]').setValue('Longsword')
    const barOrder = await client
      .$$('.desktop-taskbar button')
      .map((button) => button.getText())
    await restoredSearch
      .$('[data-reference-kind="item"] button[title="Separat öffnen"]')
      .click()
    await expect(client.$$(separateSelector)).toBeElementsArrayOfSize(1)
    await expect(client.$(separateSelector)).toHaveElementClass('raised')
    expect(
      await client
        .$$('.desktop-taskbar button')
        .map((button) => button.getText())
    ).toEqual(barOrder)
  })
  it('keeps map presentation and combat alive independently of their windows', async () => {
    const client = browser as unknown as WdioBrowser
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await client.$('.scene-desktop').waitForDisplayed({ timeout: 30_000 })
    await setElectronWindowSize(client, 1200, 900)
    await client.$('.desktop-toolbar').$('button=Karte & Reise').click()
    await client
      .$('[data-window-id="map"] canvas')
      .waitForDisplayed({ timeout: 30_000 })
    await client
      .$('[data-window-id="map"]')
      .$('button[aria-label="Maximieren"]')
      .click()
    const cameraSelector = '[data-window-id="map"] .hex-location-overlay > g'
    const initial = await client.$(cameraSelector).getAttribute('transform')
    await client.execute(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        '[data-window-id="map"] canvas'
      )!
      const bounds = canvas.getBoundingClientRect()
      canvas.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaY: -100,
          clientX: bounds.left + bounds.width / 2,
          clientY: bounds.top + bounds.height / 2
        })
      )
    })
    await client.waitUntil(
      async () =>
        (await client.$(cameraSelector).getAttribute('transform')) !== initial
    )
    await waitSaved(client)
    const camera = await client.$(cameraSelector).getAttribute('transform')
    await client
      .$('[data-window-id="map"]')
      .$('button[aria-label="Fenster schließen"]')
      .click()
    await client.$('.desktop-toolbar').$('button=Karte & Reise').click()
    await client.$('[data-window-id="map"] canvas').waitForDisplayed()
    await expect(client.$(cameraSelector)).toHaveAttribute('transform', camera)
    await client.$('.desktop-toolbar').$('button=Kampf').click()
    await client
      .$('[data-window-id="combat"] .encounter-group-choice input')
      .click()
    await client
      .$('[data-window-id="combat"]')
      .$('button=Initiative vorbereiten')
      .waitForEnabled()
    await client
      .$('[data-window-id="combat"]')
      .$('button=Initiative vorbereiten')
      .click()
    await client
      .$('[data-window-id="combat"]')
      .$('button=Kampf starten')
      .click()
    await expect(
      client.$('[data-window-id="combat"] .combat-panel')
    ).toBeExisting()
    const readerTitle = await client.$('[data-window-id="reader"] h2').getText()
    await client
      .$('[data-window-id="combat"]')
      .$('button[aria-label="Maximieren"]')
      .click()
    const countSelector = '[data-window-id="map"] [data-render-count]'
    await client.pause(200)
    const count = await client
      .$(countSelector)
      .getAttribute('data-render-count')
    await client.pause(300)
    await expect(client.$(countSelector)).toHaveAttribute(
      'data-render-count',
      count
    )
    await client
      .$('[data-window-id="combat"]')
      .$('button[aria-label="Minimieren"]')
      .click()
    await client.$('.desktop-toolbar').$('button=Karte & Reise').click()
    await expect(client.$(cameraSelector)).toHaveAttribute('transform', camera)
    await client.$('.desktop-toolbar').$('button=Kampf').click()
    await expect(
      client.$('[data-window-id="combat"] .combat-panel')
    ).toBeExisting()
    await client
      .$('[data-window-id="combat"]')
      .$('button[aria-label="Fenster schließen"]')
      .click()
    await client.$('.desktop-toolbar').$('button=Kampf').click()
    await expect(
      client.$('[data-window-id="combat"] .combat-panel')
    ).toBeExisting()
    await expect(client.$('[data-window-id="reader"] h2')).toHaveText(
      readerTitle
    )
    await waitSaved(client)
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await client
      .$('[data-window-id="combat"] .combat-panel')
      .waitForExist({ timeout: 30_000 })
    await client.$('.desktop-toolbar').$('button=Karte & Reise').click()
    await client.$('[data-window-id="map"] canvas').waitForDisplayed()
    await expect(client.$(cameraSelector)).toHaveAttribute('transform', camera)
    const source = await client.$('select[aria-label="Szene"]').getValue()
    const other = (
      await client
        .$$('select[aria-label="Szene"] option')
        .map((option) => option.getAttribute('value'))
    ).find((id) => id !== source)!
    await client
      .$('select[aria-label="Szene"]')
      .selectByAttribute('value', other)
    await expect(client.$('[data-window-id="combat"]')).not.toBeExisting()
    await client
      .$('select[aria-label="Szene"]')
      .selectByAttribute('value', source)
    await expect(
      client.$('[data-window-id="combat"] .combat-panel')
    ).toBeExisting()
  })
  it('continues travel with its window closed and restores an explicitly paused journey after restart', async () => {
    const client = browser as unknown as WdioBrowser
    await client.$('.desktop-toolbar').$('button=Kampf').click()
    await client
      .$('[data-window-id="combat"] .combat-panel footer')
      .$('button*=Auflösung')
      .click()
    await client.$('.desktop-toolbar').$('button=Karte & Reise').click()
    await client.$('[data-window-id="map"] canvas').waitForDisplayed()
    await client.$('[data-window-id="map"]').$('button=Reiseplanung').click()
    await client.$('[data-window-id="map"]').$('button=Route planen').click()
    await client.execute(() =>
      document
        .querySelector<HTMLElement>('[data-window-id="map"] .hex-canvas')!
        .focus()
    )
    for (let index = 0; index < 8; index++) await client.keys('ArrowRight')
    await client.keys('Enter')
    await client
      .$('[data-window-id="map"] button[aria-label="Reise starten"]')
      .waitForEnabled()
    await client
      .$('[data-window-id="map"] button[aria-label="Reise starten"]')
      .click()
    await expect(client.$('[data-window-id="map"] .travel-console')).toHaveText(
      expect.stringContaining('Reise läuft.')
    )
    const startLocation = await client
      .$('[data-window-id="map"] .travel-current-location')
      .getText()
    const selectedHex = await client
      .$('[data-window-id="map"] .hex-canvas-shell .sr-only')
      .getText()
    await client
      .$('[data-window-id="map"]')
      .$('button[aria-label="Fenster schließen"]')
      .click()
    await client.pause(1200)
    await client.$('.desktop-toolbar').$('button=Karte & Reise').click()
    await client.$('[data-window-id="map"]').$('button=Reiseplanung').click()
    await expect(client.$('[data-window-id="map"] .travel-console')).toHaveText(
      expect.stringContaining('Reise läuft.')
    )
    expect(
      await client
        .$('[data-window-id="map"] .travel-current-location')
        .getText()
    ).not.toBe(startLocation)
    await client.$('[data-window-id="map"] button[aria-label="Pause"]').click()
    await expect(client.$('[data-window-id="map"] .travel-console')).toHaveText(
      expect.stringContaining('Reise pausiert.')
    )
    await waitSaved(client)
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await client
      .$('[data-window-id="map"] .travel-console')
      .waitForExist({ timeout: 30_000 })
    await expect(client.$('[data-window-id="map"] .travel-console')).toHaveText(
      expect.stringContaining('Reise pausiert.')
    )
    await expect(
      client.$('[data-window-id="map"] .hex-canvas-shell .sr-only')
    ).toHaveText(selectedHex)
    await client.$('[data-window-id="map"] button[aria-label="Stopp"]').click()
  })
})

async function waitSaved(client: WdioBrowser) {
  await client.waitUntil(
    async () =>
      (await client.$('.desktop-toolbar [role="status"]').getText()) === '',
    { timeout: 10_000 }
  )
  await expect(client.$('.desktop-error')).not.toBeExisting()
}
async function geometry(client: WdioBrowser) {
  return client.execute(() => {
    const frame = document.querySelector<HTMLElement>('.desktop-window')!
    return {
      x: frame.style.left,
      y: frame.style.top,
      width: frame.style.width,
      height: frame.style.height
    }
  })
}
