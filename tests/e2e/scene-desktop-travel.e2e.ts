import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { openSceneWindow } from './support/scene-desktop-navigation.js'
import { resumeCampaignFromScreen } from './support/campaign-navigation.js'
import { clickWhenInteractable } from './support/e2e-interactions.js'
import { waitSaved, selectScene } from './support/scene-desktop-scenarios.js'

describe('per-scene desktop', () => {
  it('continues travel with its window closed and restores an explicitly paused journey after restart', async () => {
    const client = browser as unknown as WdioBrowser
    await resumeCampaignFromScreen(client)
    await selectScene(client, 'Hafen')
    const combat = await openSceneWindow(client, 'combat')
    await combat.$('.encounter-group-choice input').click()
    await combat.$('button=Initiative vorbereiten').waitForEnabled()
    await combat.$('button=Initiative vorbereiten').click()
    await combat.$('button=Kampf starten').waitForEnabled()
    await combat.$('button=Kampf starten').click()
    await combat.$('.combat-panel').waitForExist()
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
})
