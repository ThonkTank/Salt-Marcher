import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { resumeCampaignFromScreen } from './support/campaign-navigation.js'
import {
  expectAccessibleInBothThemes,
  setElectronWindowSize,
  setWindowToMinimumResponsiveSize
} from './support/e2e-assertions.js'

describe('per-scene desktop', () => {
  it('preserves separate arrangements and intentional closure through navigation and process restart', async () => {
    const client = browser as unknown as WdioBrowser
    await resumeCampaignFromScreen(client)
    await client.$('.scene-desktop').waitForDisplayed({ timeout: 30_000 })
    await expect(client.$('.desktop-preview-setting')).not.toBeExisting()
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
    await expect(client.$('.desktop-preview-setting')).not.toBeExisting()
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
            area.right <= window.innerWidth &&
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
    await client.$('.scene-desktop').waitForDisplayed({ timeout: 10_000 })
    await expect(client.$('.desktop-error')).not.toBeExisting()
  })
  it('reads independent item and location documents with history and restored scroll', async () => {
    const client = browser as unknown as WdioBrowser
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
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
  it('manages the campaign library and keeps scene quickinfos beside existing windows', async () => {
    const client = browser as unknown as WdioBrowser
    await client.$('select[aria-label="Szene"]').selectByVisibleText('Hafen')
    await client.$('.desktop-toolbar').$('button=Charaktere').click()
    const info = () => client.$('[data-window-id="characters"]')
    await info().waitForDisplayed()
    await expect(info()).toHaveText(expect.stringContaining('Zuga'))
    await expect(info()).not.toHaveText(expect.stringContaining('Vivian'))
    const before = await info()
      .$$('tbody')
      .map((row) => row.getAttribute('data-character-id'))
    await info()
      .$('select[aria-label="Sprache hervorheben"]')
      .selectByVisibleText('Abyssal')
    expect(
      await info()
        .$$('tbody')
        .map((row) => row.getAttribute('data-character-id'))
    ).toEqual(before)
    expect(await info().$$('tbody[data-match="true"]').length).toBe(2)
    await expectAccessibleInBothThemes(client)
    await info().$('button=Katalog').click()
    await client.$('.character-catalog-layout').waitForDisplayed()
    expect(await client.$$('.character-roster > button').length).toBe(18)
    await expect(client.$('.character-catalog-detail h2')).toHaveText('Edrik')
    await client.$('.character-catalog-detail').$('button=Beute').click()
    await client.$('[role="dialog"]').waitForDisplayed()
    await client.keys('Escape')
    await client.$('.character-catalog-tools').$('button=Neu').click()
    await client.$('.character-profile-form').$('button=Speichern').click()
    await expect(client.$('.character-profile-form [role="alert"]')).toHaveText(
      expect.stringContaining('Name erforderlich')
    )
    await client.$('input[name="name"]').setValue('Neue Heldin')
    await client.$('.character-profile-form').$('button=Speichern').click()
    await client.$('.character-catalog-detail h2').waitForExist()
    await expect(client.$('.character-catalog-detail')).toHaveText(
      expect.stringContaining('Inaktiv')
    )
    await client.$('.character-catalog-detail').$('button=Bearbeiten').click()
    await client.$('input[name="playerName"]').setValue('Tessa')
    await client.$('input[name="level"]').setValue('4')
    await client.$('input[name="passiveInsight"]').setValue('15')
    await client.$('input[name="languages"]').setValue('Common, Abyssal')
    await client.$('.character-profile-form').$('button=Speichern').click()
    await expect(client.$('.character-catalog-detail')).toHaveText(
      expect.stringContaining('Tessa')
    )
    await client.$('.character-catalog-detail').$('button=Bearbeiten').click()
    await client.$('input[name="level"]').clearValue()
    await client.$('.character-profile-form').$('button=Speichern').click()
    await client.$('.character-catalog-detail h2').waitForExist()
    await expectAccessibleInBothThemes(client)
    await client.$('.character-catalog-detail').$('button=Löschen').click()
    await expect(client.$('.character-catalog-detail h2')).toHaveText(
      'Neue Heldin'
    )
    await client.$('button=Endgültig löschen').click()
    await client.$('.character-delete-confirm').waitForExist({ reverse: true })
    await client
      .$('input[aria-label="Charakter oder Spieler suchen"]')
      .setValue('kein solcher Charakter')
    await expect(client.$('.character-roster')).toHaveText(
      'Keine Charaktere gefunden.'
    )
    await client.$('button[aria-label="Session"]').click()
    await info().waitForDisplayed()
    await expect(
      info().$('select[aria-label="Sprache hervorheben"]')
    ).toHaveValue('Abyssal')
    await client.$('select[aria-label="Szene"]').selectByVisibleText('Wald')
    await client.$('.desktop-toolbar').$('button=Charaktere').click()
    await expect(info()).toHaveText(expect.stringContaining('Vivian'))
    await expect(info()).not.toHaveText(expect.stringContaining('Edrik'))
    await waitSaved(client)
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await info().waitForDisplayed({ timeout: 30_000 })
    await expect(info()).toHaveText(expect.stringContaining('Vivian'))
  })
  it('batches stable rosters, splits and merges scenes, changes XP and confirms selected rests', async () => {
    const client = browser as unknown as WdioBrowser
    await selectScene(client, 'Wald')
    await client.$('.desktop-toolbar').$('button=Charaktere').click()
    const info = () => client.$('[data-window-id="characters"]')
    await info().$('button=Besetzung').click()
    const popup = () => client.$('.desktop-roster-popup')
    await popup().$('button=Auswahl leeren').click()
    await popup()
      .$('input[aria-label="Charakter oder Spieler"]')
      .setValue('Reserve 4')
    await popup().$('input[type="checkbox"]').click()
    await popup()
      .$('input[aria-label="Charakter oder Spieler"]')
      .setValue('Reserve 5')
    await popup().$('input[type="checkbox"]').click()
    await popup().$('button=Übernehmen').click()
    await popup().waitForExist({ reverse: true })
    await expect(info()).toHaveText(expect.stringContaining('Reserve 4'))
    await expect(info()).not.toHaveText(expect.stringContaining('Vivian'))
    const row = () => info().$('tbody')
    const burden = await row().$('.desktop-character-burden').getText()
    await row().$('button=XP').click()
    await client.$('.desktop-xp-popup input').setValue('100')
    await client.$('.desktop-xp-popup').$('button=+').click()
    await expect(row()).toHaveText(expect.stringContaining('XP 100 /'))
    await client.$('.desktop-xp-popup').$('button=−').click()
    await expect(row()).toHaveText(expect.stringContaining('XP 0 /'))
    await client.$('.desktop-xp-popup').$('button=Überschreiben').click()
    await expect(row()).toHaveText(expect.stringContaining('XP 100 /'))
    expect(await row().$('.desktop-character-burden').getText()).toBe(burden)
    await client.keys('Escape')
    await info().$('button=Rasten').click()
    await popup().$('button=Kurze Rast').click()
    await expect(popup().$('button=Kurze Rast bestätigen')).toBeDisplayed()
    const checks = await popup().$$('input[type="checkbox"]')
    await checks[1]!.click()
    await expect(popup().$('button=Kurze Rast bestätigen')).not.toBeExisting()
    await popup().$('button=Lange Rast').click()
    await popup().$('button=Lange Rast bestätigen').click()
    await expect(popup().$('button=Lange Rast')).toBeEnabled()
    await client.keys('Escape')
    await info().$('button=Verschieben').click()
    await popup().$('button=Alle auswählen').click()
    await popup()
      .$('select[aria-label="Zielszene"]')
      .selectByVisibleText('Neue Szene')
    await popup().$('input[aria-label="Szenenname"]').setValue('Vorhut')
    await popup().$('button=Übernehmen').click()
    await popup().waitForExist({ reverse: true })
    await expect(info()).toHaveText(expect.stringContaining('Keine Charaktere'))
    await selectScene(client, 'Vorhut')
    await client.$('.desktop-toolbar').$('button=Charaktere').click()
    await expect(info()).toHaveText(expect.stringContaining('Reserve 4'))
    await info().$('button=Verschieben').click()
    await popup().$('button=Alle auswählen').click()
    await popup()
      .$('select[aria-label="Zielszene"]')
      .selectByVisibleText('Wald')
    await popup().$('button=Übernehmen').click()
    await popup().waitForExist({ reverse: true })
    await selectScene(client, 'Wald')
    await expect(info()).toHaveText(expect.stringContaining('Reserve 5'))
    await expectAccessibleInBothThemes(client)
    await waitSaved(client)
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await info().waitForDisplayed({ timeout: 30_000 })
    await expect(info()).toHaveText(expect.stringContaining('XP 100 /'))
  })
  it('opens quickinfos with Alt+P from the catalog and releases repeated map windows', async () => {
    const client = browser as unknown as WdioBrowser
    await client.$('button[aria-label="Katalog"]').click()
    await client.$('.catalog-workspace').waitForDisplayed()
    await client.keys(['Alt', 'p'])
    await client.$('[data-window-id="characters"]').waitForDisplayed()
    await client.waitUntil(() =>
      client.execute(
        () =>
          document.activeElement?.getAttribute('data-window-id') ===
          'characters'
      )
    )
    await expect(client.$('.party-panel:not(.day-panel)')).not.toBeExisting()
    const map = () => client.$('[data-window-id="map"]')
    if (await map().isExisting())
      await map().$('button[aria-label="Fenster schließen"]').click()
    const evidence = () =>
      client.execute(async () => {
        const bridge = (
          window as typeof window & {
            __saltMarcherE2e: {
              runtimeEvidence: () => Promise<
                import('../../src/shared/contracts/runtime-evidence.js').RuntimeEvidence
              >
            }
          }
        ).__saltMarcherE2e
        return bridge.runtimeEvidence()
      })
    const before = await evidence()
    for (let iteration = 0; iteration < 8; iteration++) {
      await client.$('.desktop-toolbar').$('button=Karte & Reise').click()
      await map().waitForDisplayed()
      expect(await client.$$('[data-window-id="map"]').length).toBe(1)
      await map().$('button[aria-label="Fenster schließen"]').click()
      await map().waitForExist({ reverse: true })
      expect(await client.$$('.desktop-stage canvas').length).toBe(0)
    }
    const after = await evidence()
    expect(after.supervisor.generation).toBe(before.supervisor.generation)
    expect(after.supervisor.utility.activeDomainTimers).toBe(
      before.supervisor.utility.activeDomainTimers
    )
    await waitSaved(client)
    await expectAccessibleInBothThemes(client)
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

async function selectScene(client: WdioBrowser, title: string) {
  const options = await client.$$('select[aria-label="Szene"] option')
  let target = ''
  for (const option of options)
    if ((await option.getText()) === title)
      target = (await option.getAttribute('value')) ?? ''
  if (!target) throw new Error(`Missing scene ${title}`)
  await client
    .$('select[aria-label="Szene"]')
    .selectByAttribute('value', target)
  await expect(client.$('.scene-desktop')).toHaveAttribute(
    'data-scene-id',
    target
  )
}
