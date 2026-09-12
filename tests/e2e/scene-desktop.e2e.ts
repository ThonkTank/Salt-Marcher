import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { openSceneWindow } from './support/scene-desktop-navigation.js'
import { resumeCampaignFromScreen } from './support/campaign-navigation.js'
import { clickWhenInteractable } from './support/e2e-interactions.js'
import {
  expectAccessibleInBothThemes,
  replaceFieldValue,
  setElectronWindowSize,
  setWindowToMinimumResponsiveSize
} from './support/e2e-assertions.js'

describe('per-scene desktop', () => {
  it('shows party details and accepts a group drop without preparing initiative', async () => {
    const client = browser as unknown as WdioBrowser
    await resumeCampaignFromScreen(client)
    const party = await openSceneWindow(client, 'party')
    await party.$('.desktop-party-toggle').click()
    await expect(party.$('.desktop-party-details')).toHaveText(
      expect.stringContaining('ft.')
    )
    await party.$('button[aria-label="Party-Aktionen"]').click()
    await client.$('.party-action-menu').$('button=Schnellwerte').click()
    await expect(client.$('.desktop-party-popup')).toBeDisplayed()
    await client.$('.desktop-party-popup').$('button=Fertig').click()
    await client.keys('Escape')
    const combat = await openSceneWindow(client, 'combat')
    const groups = await openSceneWindow(client, 'groups')
    await groups.$('.desktop-group-grip').click()
    await client.keys('Enter')
    await expect(combat.$('.desktop-drop-ready')).toBeExisting()
    await client.execute(() =>
      document.querySelector<HTMLElement>('.desktop-combat')!.focus()
    )
    await client.keys('Enter')
    await waitSaved(client)
    await expect(
      combat.$('.encounter-group-choice input:checked')
    ).toBeExisting()
    await expect(combat.$('.combat-setup')).toBeExisting()
    await combat.$('.encounter-group-choice input:checked').click()
    await openSceneWindow(client, 'groups')
    await groups.$('summary').click()
    await groups.$('button=Linke Hälfte').click()
    await openSceneWindow(client, 'combat')
    await combat.$('summary').click()
    await combat.$('button=Rechte Hälfte').click()
    await groups
      .$('.desktop-group-grip')
      .dragAndDrop(combat.$('.desktop-combat'), { duration: 500 })
    await expect(
      combat.$('.encounter-group-choice input:checked')
    ).toBeExisting()
    await combat.$('.encounter-group-choice input:checked').click()
    await combat.$('button[aria-label="Fenster schließen"]').click()
    await openSceneWindow(client, 'party')
    await expectAccessibleInBothThemes(client)
    await client.saveScreenshot('/tmp/saltmarcher-party-groups.png')
    for (const kind of ['party', 'groups'] as const) {
      const panel = await openSceneWindow(client, kind)
      await panel.$('summary').click()
      await panel.$('button=Freie Position wiederherstellen').click()
      await panel.$('.desktop-resize-keyboard').click()
      for (let i = 0; i < 14; i++) await client.keys('ArrowLeft')
      for (let i = 0; i < 14; i++) await client.keys('ArrowUp')
      await expect(panel).toHaveAttribute(
        'style',
        expect.stringContaining('width: 240px')
      )
      await expectAccessibleInBothThemes(client)
      if (kind === 'party') {
        const layout = await client.execute(() => {
          const frame = document.querySelector('[data-window-id="party"]')!
          const bounds = frame.getBoundingClientRect()
          const buttons = [
            ...frame.querySelectorAll(
              '.desktop-window-title button, .desktop-window-title summary'
            )
          ]
          const row = frame.querySelector('.desktop-party-row')!
          const name = row
            .querySelector('.desktop-party-toggle')!
            .getBoundingClientRect()
          return {
            controlsInside: buttons.every(
              (button) => button.getBoundingClientRect().right <= bounds.right
            ),
            nameWidth: name.width,
            meterCount: row.querySelectorAll('.party-meter').length
          }
        })
        expect(layout.controlsInside).toBe(true)
        expect(layout.nameWidth).toBeGreaterThan(35)
        expect(layout.meterCount).toBe(2)
      }
      await client.saveScreenshot(`/tmp/saltmarcher-${kind}-minimum.png`)
      await panel.$('.desktop-resize-keyboard').click()
      for (let i = 0; i < 7; i++) await client.keys('ArrowRight')
      for (let i = 0; i < 13; i++) await client.keys('ArrowDown')
    }
    await waitSaved(client)
  })

  it('preserves separate arrangements and intentional closure through navigation and process restart', async () => {
    const client = browser as unknown as WdioBrowser
    await client.reloadSession()
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
    await client
      .$('[data-window-id="groups"] button[aria-label="Fenster schließen"]')
      .click()
    expect(await client.$('.desktop-party').getText()).toContain('Edrik')
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
    await waitSaved(client)
    await client.$('button[aria-label="Wiederherstellen"]').click()
    await waitSaved(client)
    expect(await geometry(client)).toEqual(preferred)
    await client.$('button[aria-label="Minimieren"]').click()
    await expect(client.$('.desktop-window')).not.toBeDisplayed()
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
    await client
      .$('[data-window-id="groups"] button[aria-label="Fenster schließen"]')
      .click()
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
    await client.$('.desktop-toolbar').$('button=Gruppen').click()
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
    await replaceFieldValue(
      client,
      search.$('input[type="search"]'),
      'Longsword'
    )
    await search.$('[data-reference-kind="item"] button:first-child').click()
    const reader = client.$('[data-window-id="reader"]')
    await client
      .$('[data-window-id="reader"] .reference-document')
      .waitForDisplayed()
    await reader.$('button[aria-label="Maximieren"]').click()
    await reader.$('button[aria-label="Wiederherstellen"]').click()
    await reader.$('button=Separat öffnen').click()
    const separateSelector =
      '.desktop-window:not([data-window-id="reader"]):not([data-window-id="search"]):not([data-window-id="groups"]):not([data-window-id="party"])'
    await client.$(separateSelector).waitForDisplayed()
    await client.$(separateSelector).$('summary').click()
    await client.$(separateSelector).$('button=Linke Hälfte').click()
    await client.$('.desktop-taskbar').$('button*=Nachschlagen').click()
    await replaceFieldValue(
      client,
      search.$('input[type="search"]'),
      'Salzmarschhafen'
    )
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
    await replaceFieldValue(
      client,
      restoredSearch.$('input[type="search"]'),
      'Longsword'
    )
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
    const initiative = () =>
      client.$('[data-window-id="combat"] .initiative-list input')
    await initiative().setValue('23')
    const startCombat = () =>
      client.$('[data-window-id="combat"]').$('button=Kampf starten')
    const combatConfirmation = () =>
      client.$('[role="alertdialog"][aria-label="Kampfaktion fortsetzen"]')
    await startCombat().click()
    await combatConfirmation().waitForDisplayed()
    await combatConfirmation().$('button=Abbrechen').click()
    await expect(initiative()).toHaveValue('23')
    await startCombat().click()
    await combatConfirmation().waitForDisplayed()
    await combatConfirmation().$('button=Speichern und fortfahren').click()
    await expect(
      client.$('[data-window-id="combat"] .combat-panel')
    ).toBeExisting()
    await expect(
      client.$('.combat-card.player-character .initiative-gutter')
    ).toHaveText('23')
    const monster = () => client.$('.combat-card:not(.player-character)')
    const hpBefore = await monster().$('.hp-value').getText()
    await monster().$('.hp-bar').click()
    const hpDialog = () => client.$('.hp-dialog-controls').$('..')
    await hpDialog().$('input[type="number"]').setValue('2')
    await hpDialog().$('.hp-dialog-close').click()
    const hpConfirmation = () => client.$('[role="alertdialog"]')
    await hpConfirmation().waitForDisplayed()
    await hpConfirmation().$('button=Abbrechen').click()
    await expect(hpDialog().$('input[type="number"]')).toHaveValue('2')
    await hpDialog().$('.hp-dialog-close').click()
    await hpConfirmation().waitForDisplayed()
    await hpConfirmation().$('button=Verwerfen und fortfahren').click()
    await expect(monster().$('.hp-value')).toHaveText(hpBefore)
    await monster().$('.hp-bar').click()
    await expect(hpDialog().$('input[type="number"]')).toHaveValue('1')
    await hpDialog().$('.damage').click()
    await client.waitUntil(
      async () => await hpDialog().$('input[type="number"]').isEnabled()
    )
    await hpDialog().$('.hp-dialog-close').click()
    await expect(monster().$('.hp-value')).not.toHaveText(hpBefore)
    await expect(client.$('[data-error-scope="workspace"]')).not.toBeExisting()
    const readerTitle = await client.$('[data-window-id="reader"] h2').getText()
    await client
      .$('[data-window-id="combat"]')
      .$('button[aria-label="Maximieren"]')
      .click()
    await expect(client.$('[data-error-scope="workspace"]')).not.toBeExisting()
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
    await expect(client.$('[data-error-scope="workspace"]')).not.toBeExisting()
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
    for (let index = 0; index < 24; index++) await client.keys('ArrowRight')
    await client.keys('Enter')
    await client
      .$('[data-window-id="map"] button[aria-label="Reise starten"]')
      .waitForEnabled()
    await client
      .$('[data-window-id="map"] button[aria-label="Reise starten"]')
      .click()
    const routeConfirmation = client.$(
      '[role="alertdialog"][aria-label="Reiseaktion bestätigen"]'
    )
    await routeConfirmation.waitForDisplayed()
    await expect(
      routeConfirmation.$('ul[aria-label="Offene Änderungen"]')
    ).toHaveText(expect.stringContaining('Routenentwurf'))
    await routeConfirmation.$('button=Speichern und fortfahren').click()
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
    await client
      .$('[data-window-id="map"]')
      .waitForExist({ reverse: true, timeout: 5_000 })
    const savedRoute = await client.execute(async () => {
      const campaignId = (await window.saltMarcher.campaigns.list())
        .activeCampaignId!
      const session = await window.saltMarcher.session.read({ campaignId })
      return (
        await window.saltMarcher.hexTravel.readState({
          campaignId,
          sceneId: session.scene.focusedSceneId
        })
      ).routePlan
    })
    expect(savedRoute.plan?.waypoints).toHaveLength(1)
    expect(savedRoute.revision).toBeGreaterThan(0)
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
    // Pause just after an observed boundary, with plenty of route remaining.
    // A fixed delay can otherwise race the next legitimate revision change.
    const beforeBoundary = await client
      .$('[data-window-id="map"] .travel-current-location')
      .getText()
    await client.waitUntil(
      async () =>
        (await client
          .$('[data-window-id="map"] .travel-current-location')
          .getText()) !== beforeBoundary,
      { timeout: 15_000 }
    )
    await client
      .$('[data-window-id="map"] button[aria-label="Pause"]')
      .waitForClickable()
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
    await clickWhenInteractable(
      client,
      async () =>
        await client.$('[data-window-id="map"] button[aria-label="Stopp"]')
    )
    await expect(client.$('[data-window-id="map"] .travel-console')).toHaveText(
      expect.stringContaining('Reise abgebrochen.')
    )
  })
  it('manages the campaign library and keeps scene quickinfos beside existing windows', async () => {
    const client = browser as unknown as WdioBrowser
    await selectScene(client, 'Hafen')
    await openSceneWindow(client, 'party')
    const info = () => client.$('[data-window-id="party"]')
    await info().waitForDisplayed({ timeout: 15_000 })
    await expect(info()).toHaveText(expect.stringContaining('Zuga'))
    await expect(info()).not.toHaveText(expect.stringContaining('Vivian'))
    const before = await info().$$('.desktop-party-entry').length
    await info().$('.desktop-party-toggle').click()
    expect(await info().$$('.desktop-party-entry').length).toBe(before)
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
    await selectScene(client, 'Wald')
    await openSceneWindow(client, 'party')
    await expect(info()).toHaveText(expect.stringContaining('Vivian'))
    await expect(info()).not.toHaveText(expect.stringContaining('Edrik'))
    await waitSaved(client)
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await info().waitForDisplayed({ timeout: 30_000 })
    await expect(info()).toHaveText(expect.stringContaining('Vivian'))
  })
  it('batches rosters, changes XP through bars, confirms rests and reverses scene creation', async () => {
    const client = browser as unknown as WdioBrowser
    const read = () =>
      client.execute(async () => {
        const campaignId = (await window.saltMarcher.campaigns.list())
          .activeCampaignId!
        return window.saltMarcher.session.read({ campaignId })
      })
    await selectScene(client, 'Wald')
    const info = await openSceneWindow(client, 'party')
    const menu = async (label: string) => {
      const popup = client.$('.party-action-menu')
      if (!(await popup.isDisplayed()))
        await info.$('button[aria-label="Party-Aktionen"]').click()
      await popup.$(`button=${label}`).click()
    }
    await menu('Aktives Roster bearbeiten')
    const popup = () => client.$('.desktop-roster-popup')
    await popup().$('button=Auswahl leeren').click()
    for (const name of ['Reserve 4', 'Reserve 5']) {
      await popup()
        .$('input[aria-label="Charakter oder Spieler"]')
        .setValue(name)
      await popup().$('input[type="checkbox"]').click()
    }
    await popup().$('button=Übernehmen').click()
    await popup().waitForExist({ reverse: true })
    await client.keys('Escape')
    const row = info.$('.desktop-party-entry')
    const beforeXp = await read()
    const scene = beforeXp.scene.scenes.find(
      (scene) => scene.id === beforeXp.scene.focusedSceneId
    )!
    const first = beforeXp.party.members.find(
      (member) => member.id === scene.partyMemberIds[0]
    )!
    await row.$('.party-xp-meter').click()
    await client.$('.desktop-xp-popup input').setValue('100')
    await client
      .$('.desktop-xp-popup button[aria-label="XP addieren"]')
      .waitForEnabled()
    await client.$('.desktop-xp-popup button[aria-label="XP addieren"]').click()
    await client.waitUntil(
      async () =>
        (await read()).party.members.find((member) => member.id === first.id)!
          .xp ===
        first.xp + 100
    )
    await client
      .$('.desktop-xp-popup button[aria-label="XP subtrahieren"]')
      .waitForEnabled()
    await client
      .$('.desktop-xp-popup button[aria-label="XP subtrahieren"]')
      .click()
    await client.waitUntil(
      async () =>
        (await read()).party.members.find((member) => member.id === first.id)!
          .xp === first.xp
    )
    await client
      .$(
        '.desktop-xp-popup button[aria-label="Gesamt-XP durch Betrag ersetzen"]'
      )
      .waitForEnabled()
    await client
      .$(
        '.desktop-xp-popup button[aria-label="Gesamt-XP durch Betrag ersetzen"]'
      )
      .click()
    await client.waitUntil(
      async () =>
        (await read()).party.members.find((member) => member.id === first.id)!
          .xp === 100
    )
    expect(
      (await read()).party.members.find((member) => member.id === first.id)!
        .xpSinceLongRest
    ).toBe(first.xpSinceLongRest)
    await client.keys('Escape')
    await menu('Rasten')
    await popup().$('button=Lange Rast').click()
    await popup().$('button=Lange Rast bestätigen').click()
    await popup().waitForExist({ reverse: true })
    await client.keys('Escape')
    const beforeMove = await read()
    await menu('Verschieben')
    expect(
      await popup().$('input[aria-label="Charakter oder Spieler"]').isExisting()
    ).toBe(false)
    await popup().$('input[type="checkbox"]').click()
    await popup().$('select').selectByAttribute('value', '')
    expect(await popup().$('input[aria-label="Szenenname"]').isExisting()).toBe(
      false
    )
    await popup().$('button=Übernehmen').click()
    await popup().waitForExist({ reverse: true })
    await client.keys('Escape')
    await client.waitUntil(
      async () =>
        (await read()).scene.scenes.length ===
        beforeMove.scene.scenes.length + 1
    )
    const added = (await read()).scene.scenes.find(
      (scene) =>
        !beforeMove.scene.scenes.some((previous) => previous.id === scene.id)
    )!
    expect(added.locationId).toBe(scene.locationId)
    expect(added.gameTimeSeconds).toBe(scene.gameTimeSeconds)
    await info.$('button[aria-label^="Rückgängig:"]').waitForEnabled()
    await info.$('button[aria-label^="Rückgängig:"]').click()
    await client.waitUntil(
      async () =>
        (await read()).scene.scenes.length === beforeMove.scene.scenes.length
    )
    await info.$('button[aria-label^="Wiederherstellen:"]').click()
    await client.waitUntil(
      async () =>
        (await read()).scene.scenes.length ===
        beforeMove.scene.scenes.length + 1
    )
    await info.$('button[aria-label^="Rückgängig:"]').click()
    await client.waitUntil(
      async () =>
        (await read()).scene.scenes.length === beforeMove.scene.scenes.length
    )
    await expectAccessibleInBothThemes(client)
    await waitSaved(client)
  })
  it('opens quickinfos with Alt+P from the catalog and releases repeated map windows', async () => {
    const client = browser as unknown as WdioBrowser
    await client.$('button[aria-label="Katalog"]').click()
    await client.$('.catalog-workspace').waitForDisplayed()
    await client.keys(['Alt', 'p'])
    await client.$('[data-window-id="party"]').waitForDisplayed()
    await client.waitUntil(() =>
      client.execute(
        () => document.activeElement?.getAttribute('data-window-id') === 'party'
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
  it('restores archived groups and deletes only after confirmation across restart', async () => {
    const client = browser as unknown as WdioBrowser
    const target = await client.execute(async () => {
      const api = window.saltMarcher
      const campaignId = (await api.campaigns.list()).activeCampaignId!
      const snapshot = await api.session.read({ campaignId })
      const sceneId = snapshot.scene.focusedSceneId
      await api.scene.saveGroup({
        commandId: crypto.randomUUID(),
        sceneId,
        groupId: null,
        name: 'Lifecycle E2E',
        note: 'Preserve through restore',
        disposition: 'neutral',
        entries: [],
        expectedRevision: snapshot.scene.revision,
        expectedGroupRevision: null
      })
      const current = await api.session.read({ campaignId })
      const group = current.scene.scenes
        .find((scene) => scene.id === sceneId)!
        .groups.find((group) => group.name === 'Lifecycle E2E')!
      return { campaignId, sceneId, groupId: group.id }
    })
    const openGroup = async () => {
      await client.refresh()
      await resumeCampaignFromScreen(client)
      await client.$('.scene-desktop').waitForDisplayed({ timeout: 30_000 })
      await client.$('.desktop-toolbar').$('button=Gruppen').click()
      await client.$('button[aria-label="Lifecycle E2E aufklappen"]').click()
    }
    const readGroup = () =>
      client.execute(async (input) => {
        const snapshot = await window.saltMarcher.session.read({
          campaignId: input.campaignId
        })
        return (
          snapshot.scene.scenes
            .find((scene) => scene.id === input.sceneId)!
            .groups.find((group) => group.id === input.groupId) ?? null
        )
      }, target)
    const archiveGroup = async (edit: boolean) => {
      await client.refresh()
      await resumeCampaignFromScreen(client)
      await client.$('.scene-desktop').waitForDisplayed({ timeout: 30_000 })
      await client.$('.desktop-toolbar').$('button=Gruppen').click()
      await client
        .$('[data-window-id="groups"] button[aria-label="Gruppen bearbeiten"]')
        .click()
      const manager = client.$('section[aria-labelledby="group-builder-title"]')
      await manager.waitForDisplayed({ timeout: 10_000 })
      await manager
        .$('select[aria-label="Gruppe auswählen"]')
        .selectByVisibleText('Lifecycle E2E')
      if (edit)
        await manager
          .$('.group-manager-disposition')
          .selectByAttribute('value', 'allied')
      await manager.$('button=Archivieren').click()
      if (edit) {
        const confirmation = client.$(
          '[role="alertdialog"][aria-label="Gruppe archivieren"]'
        )
        await confirmation.waitForDisplayed()
        await confirmation.$('button=Speichern und fortfahren').click()
      }
      await manager.waitForExist({ reverse: true, timeout: 10_000 })
      expect((await readGroup())?.archived).toBe(true)
      expect((await readGroup())?.disposition).toBe('allied')
    }
    await archiveGroup(true)
    await openGroup()
    await client
      .$('[data-window-id="groups"]')
      .$('button=Wiederherstellen')
      .click()
    await client.waitUntil(async () => (await readGroup())?.archived === false)
    expect((await readGroup())?.note).toBe('Preserve through restore')
    await archiveGroup(false)
    await openGroup()
    await client.$('[data-window-id="groups"]').$('button=Löschen').click()
    await client.$('.group-delete-confirm').$('button=Abbrechen').click()
    expect((await readGroup())?.archived).toBe(true)
    await client.$('[data-window-id="groups"]').$('button=Löschen').click()
    await client.$('.group-delete-confirm').$('button=Wirklich löschen').click()
    await client.waitUntil(async () => (await readGroup()) === null)
    await expect(client.$('.group-name=Lifecycle E2E')).not.toBeExisting()
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await client.$('.scene-desktop').waitForDisplayed({ timeout: 30_000 })
    expect(await readGroup()).toBeNull()
    await waitSaved(client)
  })
  it('resolves result drafts and awards XP exactly once through completion and restart', async () => {
    const client = browser as unknown as WdioBrowser
    const target = await client.execute(async () => {
      let stage = 'read session'
      try {
        const api = window.saltMarcher
        const campaignId = (await api.campaigns.list()).activeCampaignId!
        let snapshot = await api.session.read({ campaignId })
        stage = 'clear previous combat'
        if (snapshot.combat)
          await api.combat.complete({
            expectedRevision: snapshot.combat.revision
          })
        snapshot = await api.session.read({ campaignId })
        stage = 'set a combat-ready roster'
        const member = snapshot.party.members.find(
          (entry) => entry.level !== null
        )
        if (!member)
          throw new Error('Fixture requires a character with a level')
        const sceneId = snapshot.scene.focusedSceneId
        if (
          !snapshot.scene.scenes
            .find((scene) => scene.id === sceneId)!
            .partyMemberIds.includes(member.id)
        ) {
          if (!member.active) {
            await api.party.setMembership({
              id: member.id,
              active: true,
              expectedRevision: snapshot.party.revision
            })
          } else {
            await api.scene.assignPartyMember({
              sceneId,
              partyMemberId: member.id,
              assigned: true,
              expectedRevision: snapshot.scene.revision
            })
          }
          snapshot = await api.session.read({ campaignId })
        }
        await api.scene.setRoster({
          sceneId,
          memberIds: [member.id],
          expectedRevision: snapshot.scene.revision,
          expectedPartyRevision: snapshot.party.revision
        })
        snapshot = await api.session.read({ campaignId })
        stage = 'create resolution group'
        await api.scene.saveGroup({
          commandId: crypto.randomUUID(),
          sceneId,
          groupId: null,
          name: 'Resolution E2E',
          note: '',
          disposition: 'hostile',
          entries: [{ creatureId: 'wolf', quantity: 2 }],
          expectedRevision: snapshot.scene.revision,
          expectedGroupRevision: null
        })
        snapshot = await api.session.read({ campaignId })
        const groupId = snapshot.scene.scenes
          .find((scene) => scene.id === sceneId)!
          .groups.find((group) => group.name === 'Resolution E2E')!.id
        stage = 'prepare resolution combat'
        await api.combat.prepare({
          sceneId,
          groupIds: [groupId],
          expectedSceneRevision: snapshot.scene.revision
        })
        return { campaignId, sceneId, memberId: member.id }
      } catch (cause) {
        return {
          failureText: `${stage}: ${cause instanceof Error ? cause.message : JSON.stringify(cause)}`
        }
      }
    })
    if ('failureText' in target) throw new Error(target.failureText)
    const read = () =>
      client.execute(
        async (campaignId) => window.saltMarcher.session.read({ campaignId }),
        target.campaignId
      )
    await client.refresh()
    await resumeCampaignFromScreen(client)
    await client.$('.scene-desktop').waitForDisplayed({ timeout: 30_000 })
    await client.$('.desktop-toolbar').$('button=Kampf').click()
    await client
      .$('[data-window-id="combat"]')
      .$('button=Kampf starten')
      .click()
    await client.$('.combat-panel footer').$('button*=Auflösung').click()
    const panel = () => client.$('.resolution-panel')
    await panel().waitForDisplayed()
    const before = await read()
    await panel()
      .$('.resolution-controls select')
      .selectByAttribute('value', 'manual')
    const enemies = await panel().$$('input[type="checkbox"]')
    for (const enemy of enemies)
      if (!(await enemy.isSelected())) await enemy.click()
    const award = Number(
      (
        await panel().$('.resolution-award div:last-child dd').getText()
      ).replace(/[^0-9]/g, '')
    )
    expect(award).toBeGreaterThan(0)
    await panel().$('button=XP vergeben und beenden').click()
    const confirmation = () =>
      client.$('[role="alertdialog"][aria-label="Kampfaktion fortsetzen"]')
    await confirmation().waitForDisplayed()
    await confirmation().$('button=Abbrechen').click()
    expect((await read()).party).toEqual(before.party)
    await expect(panel().$('.resolution-controls select')).toHaveValue('manual')
    await panel().$('button=XP vergeben und beenden').click()
    await confirmation().waitForDisplayed()
    await confirmation().$('button=Speichern und fortfahren').click()
    await panel().waitForExist({ reverse: true })
    await client.waitUntil(async () => (await read()).combat === null)
    const after = await read()
    const assigned = before.scene.scenes.find(
      (scene) => scene.id === target.sceneId
    )!.partyMemberIds
    for (const member of before.party.members) {
      expect(
        after.party.members.find((entry) => entry.id === member.id)!.xp
      ).toBe(
        member.xp + (member.active && assigned.includes(member.id) ? award : 0)
      )
    }
    await expect(client.$('[data-error-scope="workspace"]')).not.toBeExisting()
    await waitSaved(client)
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await client.$('.scene-desktop').waitForDisplayed({ timeout: 30_000 })
    const restarted = await read()
    expect(restarted.combat).toBeNull()
    expect(restarted.party).toEqual(after.party)
  })
  it('changes scene location without resolving an independent XP draft', async () => {
    const client = browser as unknown as WdioBrowser
    const read = () =>
      client.execute(async () => {
        const campaignId = (await window.saltMarcher.campaigns.list())
          .activeCampaignId!
        return window.saltMarcher.session.read({ campaignId })
      })
    await expect(client.$('[data-error-scope="workspace"]')).not.toBeExisting()
    const before = await read()
    const sceneId = before.scene.focusedSceneId
    const original = before.scene.scenes.find(
      (scene) => scene.id === sceneId
    )!.locationId
    const destination = before.scene.locationChoices.find(
      (location) => location.id !== original
    )
    if (!destination) throw new Error('Fixture requires another location')
    await client.$('.desktop-toolbar').$('button=Party').click()
    await client.$('[data-window-id="party"]').$('.party-xp-meter').click()
    await client.$('.desktop-xp-popup input').setValue('250')
    const chooseLocation = async () => {
      await client.$('.desktop-toolbar .desktop-scene-facts button').click()
      await client
        .$('.desktop-toolbar .desktop-scene-facts select')
        .selectByAttribute('value', destination.id)
    }
    await chooseLocation()
    await client.waitUntil(
      async () =>
        (await read()).scene.scenes.find((scene) => scene.id === sceneId)!
          .locationId === destination.id
    )
    await expect(client.$('[role="alertdialog"]')).not.toBeExisting()
    await client.$('[data-window-id="party"]').$('.party-xp-meter').click()
    await expect(client.$('.desktop-xp-popup input')).toHaveValue('250')
    expect((await read()).party).toEqual(before.party)
    await expect(client.$('[data-error-scope="workspace"]')).not.toBeExisting()
    await client
      .$('[data-window-id="party"] button[aria-label="Fenster schließen"]')
      .click()
    const confirmation = client.$(
      '[role="alertdialog"][aria-label="Fensteränderung bestätigen"]'
    )
    await confirmation.waitForDisplayed()
    await confirmation.$('button=Verwerfen und fortfahren').click()
    await waitSaved(client)
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await client.$('.scene-desktop').waitForDisplayed({ timeout: 30_000 })
    const restarted = await read()
    expect(
      restarted.scene.scenes.find((scene) => scene.id === sceneId)!.locationId
    ).toBe(destination.id)
    expect(restarted.party).toEqual(before.party)
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
  const target = await client.execute(async (name) => {
    const campaignId = (await window.saltMarcher.campaigns.list())
      .activeCampaignId!
    return (
      (await window.saltMarcher.session.read({ campaignId })).scene.scenes.find(
        (scene) => scene.title === name
      )?.id ?? ''
    )
  }, title)
  if (!target) throw new Error(`Missing scene ${title}`)
  await client
    .$('select[aria-label="Szene"]')
    .selectByAttribute('value', target)
  await expect(client.$('.scene-desktop')).toHaveAttribute(
    'data-scene-id',
    target
  )
}
