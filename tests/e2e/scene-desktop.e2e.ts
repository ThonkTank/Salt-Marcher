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
