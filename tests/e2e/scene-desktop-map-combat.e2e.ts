import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { openSceneWindow } from './support/scene-desktop-navigation.js'
import { resumeCampaignFromScreen } from './support/campaign-navigation.js'
import {
  replaceFieldValue,
  setElectronWindowSize
} from './support/e2e-assertions.js'
import { waitSaved, selectScene } from './support/scene-desktop-scenarios.js'
import { clickWhenInteractable } from './support/e2e-interactions.js'

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
    const campaignId = await client.execute(
      async () => (await window.saltMarcher.campaigns.list()).activeCampaignId!
    )
    const liveCombatBefore = await client.execute(
      (id) => window.saltMarcher.session.read({ campaignId: id }),
      campaignId
    )
    expect(liveCombatBefore.combat).not.toBeNull()
    await openSceneWindow(client, 'search')
    await replaceFieldValue(
      client,
      client.$('[data-window-id="search"] input[type="search"]'),
      'Salzmarschhafen Kai 30'
    )
    await client
      .$(
        '[data-window-id="search"] [data-reference-kind="location"] button:first-child'
      )
      .waitForClickable({ timeout: 10000 })
    await client.keys('Enter')
    await expect(
      client.$('[data-window-id="reader"] .reference-document')
    ).toHaveText(expect.stringContaining('Kai 30'))
    expect(
      await client.execute(
        (id) => window.saltMarcher.session.read({ campaignId: id }),
        campaignId
      )
    ).toEqual(liveCombatBefore)
    await client.saveScreenshot('.tmp/gm-live-combat-lookup.png')
    await openSceneWindow(client, 'search')
    await client
      .$('[data-window-id="search"] button[aria-label="Fenster schließen"]')
      .click()
    process.stdout.write(
      'GM live lookup: active Combat and complete Session preserved after note retrieval\n'
    )
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
    await verifyPreparedNarration(client)
  })
})

async function verifyPreparedNarration(client: WdioBrowser) {
  await client.$('button[aria-label="Katalog"]').click()
  await client.$('button=Orte').click()
  await client.$('button=Erstellen').click()
  const dialog = client.$('[role="dialog"][aria-label="Ort erstellen"]')
  await dialog.$('input[aria-label="Ortsname"]').setValue('Glassteg')
  await dialog.$('input[aria-label="Tags"]').setValue('Schauplatz')
  await client.keys('Enter')
  await dialog
    .$('textarea[aria-label="Vorlesetext"]')
    .setValue(
      'Unter euch glühen sternenblaue Quallen.\n\nAm Ende wartet die schweigende Fährfrau.'
    )
  await dialog
    .$('textarea[aria-label="GM-Notizen"]')
    .setValue('Die Fährfrau fordert eine Erinnerung statt Münzen.')
  await clickWhenInteractable(
    client,
    async () => await dialog.$('button=Erstellen')
  )
  await expect(client.$('h2[aria-label="Glassteg"]')).toBeExisting()
  await client.$('button[aria-label="Ort Details schließen"]').click()
  await client.$('button[aria-label="Session"]').click()
  const campaignId = await client.execute(
    async () => (await window.saltMarcher.campaigns.list()).activeCampaignId!
  )
  const liveBefore = await client.execute(
    (id) => window.saltMarcher.session.read({ campaignId: id }),
    campaignId
  )
  expect(liveBefore.combat).not.toBeNull()
  await client.$('.desktop-toolbar').$('button*=Nachschlagen').click()
  let input = client.$('[data-window-id="search"] input[type="search"]')
  await replaceFieldValue(client, input, 'Glassteg')
  await client
    .$(
      '[data-window-id="search"] [data-reference-kind="location"] button:first-child'
    )
    .waitForClickable({ timeout: 10000 })
  await client.keys('Enter')
  await client.waitUntil(
    () =>
      client.execute(() => {
        const frame = document.querySelector('[data-window-id="reader"]')
        return (
          frame?.querySelector('h2')?.textContent === 'Glassteg' &&
          frame
            .querySelector('.reference-document')
            ?.textContent?.includes('Die Fährfrau fordert')
        )
      }),
    {
      timeout: 10000,
      timeoutMsg:
        'The new reader must finish replacing the previous document before asserting its text'
    }
  )
  await expect(
    client.$('[data-window-id="reader"] .reference-document')
  ).toHaveText(expect.stringContaining('Die Fährfrau fordert'))
  const body = await client
    .$('[data-window-id="reader"] .reference-document')
    .getText()
  await client.saveScreenshot('.tmp/gm-read-aloud-after.png')
  expect(body).toContain('Vorlesetext')
  expect(body).toContain('sternenblaue Quallen')
  expect(body).toContain('GM-Notizen')
  await client.$('.desktop-toolbar').$('button*=Nachschlagen').click()
  input = client.$('[data-window-id="search"] input[type="search"]')
  await replaceFieldValue(client, input, 'sternenblaue Quallen')
  await client.keys('Enter')
  await client.waitUntil(
    () =>
      client.execute(() => {
        const range = CSS.highlights
          .get('reference-search')
          ?.values()
          .next().value
        return (
          range instanceof Range && range.toString() === 'sternenblaue Quallen'
        )
      }),
    { timeout: 10000 }
  )

  expect(
    await client.execute(
      (id) => window.saltMarcher.session.read({ campaignId: id }),
      campaignId
    )
  ).toEqual(liveBefore)
  process.stdout.write(
    'GM prepared narration: UI creation, early Enter, narration retrieval and active Combat preserved\n'
  )
}
