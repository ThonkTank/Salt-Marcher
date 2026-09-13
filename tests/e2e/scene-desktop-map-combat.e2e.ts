import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { openSceneWindow } from './support/scene-desktop-navigation.js'
import { resumeCampaignFromScreen } from './support/campaign-navigation.js'
import {
  replaceFieldValue,
  setElectronWindowSize
} from './support/e2e-assertions.js'
import { waitSaved, selectScene } from './support/scene-desktop-scenarios.js'

describe('per-scene desktop', () => {
  it('keeps map presentation and combat alive independently of their windows', async () => {
    const client = browser as unknown as WdioBrowser
    await resumeCampaignFromScreen(client)
    await selectScene(client, 'Hafen')
    const search = await openSceneWindow(client, 'search')
    await replaceFieldValue(
      client,
      search.$('input[type="search"]'),
      'Longsword'
    )
    await search.$('[data-reference-kind="item"] button:first-child').click()
    await client
      .$('[data-window-id="reader"] .reference-document')
      .waitForDisplayed()
    await openSceneWindow(client, 'search')
    await search.$('button[aria-label="Fenster schließen"]').click()
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
})
