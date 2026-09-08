import { openSceneWindow } from './scene-desktop-navigation.js'
import {
  beginCampaignCreation,
  openCampaignScreen,
  resumeCampaignFromScreen
} from './campaign-navigation.js'
import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import {
  expectAccessible,
  expectAccessibleInBothThemes,
  expectElementGolden,
  replaceFieldValue,
  setElectronWindowSize,
  setWindowToMinimumResponsiveSize
} from './e2e-assertions.js'
import { clickWhenInteractable } from './e2e-interactions.js'
import { waitForGmRendererReady } from './e2e-ready.js'

export async function runCampaignCreationScenario(): Promise<void> {
  const client = browser as unknown as WdioBrowser
  await (
    await client.$('button=+ Neue Kampagne')
  ).waitForClickable({ timeout: 30_000 })
  await expectElementGolden(client, 'campaign-screen-light', '.app-shell')
  await client.execute(() => {
    document.documentElement.dataset['theme'] = 'dark'
  })
  await expectElementGolden(client, 'campaign-screen-dark', '.app-shell')
  await client.execute(() => {
    document.documentElement.dataset['theme'] = 'light'
  })
  await beginCampaignCreation(client)
  const field = await client.$('#campaign-name')
  await waitForCampaignInput(client, field)
  await expectAccessibleInBothThemes(client)
  await expectElementGolden(
    client,
    'campaign-dialog-light',
    'section.campaign-management-popup'
  )
  await client.execute(() => {
    document.documentElement.dataset['theme'] = 'dark'
  })
  await expectElementGolden(
    client,
    'campaign-dialog-dark',
    'section.campaign-management-popup'
  )
  await client.execute(() => {
    document.documentElement.dataset['theme'] = 'light'
  })
  await field.setValue('test')
  await (await client.$('button=Erstellen & öffnen')).click()
  await (
    await client.$('h1=Session · test')
  ).waitForExist({
    timeout: 10_000
  })
  await expect(await client.$('.error-message')).not.toBeExisting()
  await client.reloadSession()
  await resumeCampaignFromScreen(client)
  await waitForGmRendererReady(client)
  await (await client.$('h1=Session · test')).waitForExist({ timeout: 10_000 })
  await expect(await client.$('.error-message')).not.toBeExisting()
  await expect(await client.$('.scene-desktop')).toBeExisting()
  await expect(client.$('[data-window-id="overview"]')).toBeExisting()
  await expect(
    client.$('[data-window-id="overview"] [aria-label="Gruppen"]')
  ).toBeExisting()
  await openSceneWindow(client, 'combat')
  await expect(client.$('[data-window-id="combat"]')).toBeExisting()
  await client
    .$('[data-window-id="combat"] button[aria-label="Fenster schließen"]')
    .click()
  await (await client.$('button[aria-label="Menü"]')).click()
  await (
    await (await client.$('#campaign-menu')).$('button=Einstellungen')
  ).click()
  await (
    await client.$('section.encounter-settings-dialog')
  ).waitForDisplayed({ timeout: 5_000 })
  const campaignRulesCard = await client.$('.campaign-reward-rules-card')
  await campaignRulesCard.waitForDisplayed({ timeout: 10_000 })
  await client.waitUntil(
    async () => (await campaignRulesCard.getAttribute('aria-busy')) === 'false',
    {
      timeout: 10_000,
      timeoutMsg: 'Campaign reward rules did not finish loading.'
    }
  )
  await (
    await client.$('.generator-settings-card')
  ).waitForDisplayed({ timeout: 10_000 })
  await (
    await campaignRulesCard.$('input[type="radio"]:checked')
  ).waitForExist({ timeout: 10_000 })
  await client.execute(async () => {
    const body = document.querySelector<HTMLElement>('.settings-dialog-body')
    if (!body) throw new Error('Settings dialog body is missing.')
    body.scrollTop = 0
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })
  expect(
    await client.execute(() => {
      const dialog = document.querySelector('section.encounter-settings-dialog')
      return Boolean(
        dialog &&
        document.activeElement instanceof HTMLElement &&
        dialog.contains(document.activeElement)
      )
    })
  ).toBe(true)
  const settingsGoldenFailures: string[] = []
  try {
    await expectElementGolden(
      client,
      'encounter-settings-light',
      'section.encounter-settings-dialog'
    )
  } catch (error) {
    settingsGoldenFailures.push(
      error instanceof Error ? error.message : String(error)
    )
  }
  await client.execute(() => {
    document.documentElement.dataset['theme'] = 'dark'
  })
  try {
    await expectElementGolden(
      client,
      'encounter-settings-dark',
      'section.encounter-settings-dialog'
    )
  } catch (error) {
    settingsGoldenFailures.push(
      error instanceof Error ? error.message : String(error)
    )
  }
  await client.execute(() => {
    document.documentElement.dataset['theme'] = 'light'
  })
  if (settingsGoldenFailures.length > 0)
    throw new Error(
      `Encounter settings goldens failed: ${settingsGoldenFailures.join('; ')}`
    )
  await setWindowToMinimumResponsiveSize(client)
  await client.execute(() => {
    document.documentElement.style.fontSize = '200%'
  })
  try {
    await expectAccessible(client)
    const scaled = await client.execute(() => {
      const dialog = document.querySelector<HTMLElement>(
        'section.encounter-settings-dialog'
      )!
      const body = dialog.querySelector<HTMLElement>('.settings-dialog-body')!
      const rules = dialog.querySelector<HTMLElement>('.generator-rules-grid')!
      const bounds = dialog.getBoundingClientRect()
      return {
        bounds: {
          top: bounds.top,
          right: bounds.right,
          bottom: bounds.bottom,
          left: bounds.left
        },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        bodyScrolls:
          ['auto', 'scroll'].includes(getComputedStyle(body).overflowY) &&
          body.scrollHeight > body.clientHeight,
        ruleColumns:
          getComputedStyle(rules).gridTemplateColumns.split(' ').length,
        matrixCells: dialog.querySelectorAll('.role-matrix td button').length
      }
    })
    expect(scaled.bounds.top).toBeGreaterThanOrEqual(0)
    expect(scaled.bounds.left).toBeGreaterThanOrEqual(0)
    expect(scaled.bounds.right).toBeLessThanOrEqual(scaled.viewport.width)
    expect(scaled.bounds.bottom).toBeLessThanOrEqual(scaled.viewport.height)
    expect(scaled).toMatchObject({
      bodyScrolls: true,
      ruleColumns: 1,
      matrixCells: 680
    })
  } finally {
    await client.execute(() => {
      document.documentElement.style.fontSize = ''
    })
    await setElectronWindowSize(client, 1280, 800)
  }
  const settingsDialog = await client.$('section.encounter-settings-dialog')
  await client.keys('Escape')
  await settingsDialog.waitForExist({ reverse: true, timeout: 5_000 })
  const geometry = await client.execute(() => {
    const desktop = document
      .querySelector('.scene-desktop')!
      .getBoundingClientRect()
    const work = document.querySelector('.work-area')!.getBoundingClientRect()
    return {
      topBar: document.querySelector('.top-bar')!.getBoundingClientRect()
        .height,
      rail: document.querySelector('.icon-bar')!.getBoundingClientRect().width,
      widthDelta: Math.abs(desktop.width - work.width)
    }
  })
  expect(geometry.topBar).toBe(66)
  expect(geometry.rail).toBe(66)
  expect(geometry.widthDelta).toBeLessThan(2)
  await expectAccessibleInBothThemes(client)
  await openSceneWindow(client, 'map')
  await expect(await client.$('strong=Keine Hex-Karte')).toBeExisting()
  const overview = await openSceneWindow(client, 'overview')
  await overview
    .$('button[aria-label="Fenster mit Pfeiltasten verschieben"]')
    .click()
  await client.keys('ArrowRight')
  await expect(overview).toBeDisplayed()

  await openCampaignScreen(client)
  await beginCampaignCreation(client)
  const nextField = await client.$('#campaign-name')
  await nextField.setValue('Campaign B')
  await (await client.$('button=Erstellen & öffnen')).click()
  await (
    await client.$('h1=Session · Campaign B')
  ).waitForExist({
    timeout: 10_000
  })

  await openCampaignScreen(client)
  await (await client.$('button[aria-label="test öffnen"]')).click()
  await (
    await client.$('h1=Session · test')
  ).waitForExist({
    timeout: 10_000
  })

  await openCampaignScreen(client)
  await (await client.$('button[aria-label="Campaign B bearbeiten"]')).click()
  await (await client.$('#campaign-name')).setValue('Campaign B Archiv')
  await (await client.$('button=Speichern')).click()
  await (
    await client.$('button[aria-label="Campaign B Archiv bearbeiten"]')
  ).click()
  await (await client.$('button=In den Papierkorb')).click()
  await (await client.$('button=Papierkorb (1)')).click()
  await (await client.$('button=Wiederherstellen')).click()
  await (await client.$('button[aria-label="Schließen"]')).click()
  await (
    await client.$('button[aria-label="Campaign B Archiv bearbeiten"]')
  ).click()
  await (await client.$('button=In den Papierkorb')).click()
  await (await client.$('button=Papierkorb (1)')).click()
  await (await client.$('button=Löschen …')).click()
  await (await client.$('#campaign-confirm-name')).setValue('Campaign B Archiv')
  await (await client.$('button=Endgültig löschen')).click()
  await expect(await client.$('strong=Campaign B Archiv')).not.toBeExisting()
  await (await client.$('button[aria-label="Schließen"]')).click()
  await (await client.$('button[aria-label="test öffnen"]')).click()
  await client.$('[data-screen="workspace"]').waitForExist({ timeout: 15_000 })
  await runCampaignMinimumSizeScenario(client)
}

export async function runCampaignHexMapScenario(): Promise<void> {
  const client = browser as unknown as WdioBrowser
  await createFreshCampaign(client, 'Hex Workflow E2E')
  await createLocation(client, 'Leuchtturmklippe', 'Zeichen an der Küste.')
  await (await client.$('button[aria-label="Hex-Editor"]')).click()
  await (await client.$('button=Neu')).click()
  const createMap = await client.$(
    '[role="dialog"][aria-label="Hexkarte erstellen"]'
  )
  await (
    await createMap.$('input[aria-label="Kartenname"]')
  ).setValue('Salzmarsch-Küste')
  await (await createMap.$('button=Erstellen')).click()
  const mapHost = await client.$(
    '[role="region"][aria-label="Hex-Editor Salzmarsch-Küste"]'
  )
  await expect(mapHost).toBeExisting()
  const mapCanvas = await mapHost.$('canvas')
  await mapCanvas.waitForExist({ timeout: 5_000 })
  await expect(await client.$('.hex-canvas-render-error')).not.toBeExisting()
  const canvasSize = await client.execute(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[role="region"][aria-label="Hex-Editor Salzmarsch-Küste"] canvas'
    )
    return canvas
      ? { width: canvas.width, height: canvas.height }
      : { width: 0, height: 0 }
  })
  expect(canvasSize.width).toBeGreaterThan(0)
  expect(canvasSize.height).toBeGreaterThan(0)

  await expectHexEditorLayout(client)
  await mapCanvas.click()
  await waitForHexContentRevision(client, 'Salzmarsch-Küste', 1)
  await expectAccessibleInBothThemes(client)
  await client.execute(() => {
    const viewport = document.querySelector<HTMLElement>('.hex-biome-viewport')
    if (!viewport) throw new Error('Biome palette viewport missing')
    viewport.scrollTop = 0
    viewport.dispatchEvent(new Event('scroll', { bubbles: true }))
  })
  await expect(
    await client.$('.hex-biome-tile[aria-pressed="true"]')
  ).toBeExisting()
  await expectElementGolden(
    client,
    'hex-editor-biome-light',
    '.hex-editor-workspace'
  )
  await (
    await client.$('button[aria-label="Zum Kerzenlichtmodus wechseln"]')
  ).click()
  await (await client.$('button=Ort platzieren')).click()
  await client.execute(async () => {
    const api = window.saltMarcher
    const [world, symbols] = await Promise.all([
      api.locations.read(),
      api.locationSymbols.search({ query: '', offset: 0, limit: 24 })
    ])
    const location = world.locations.find(
      (entry) => entry.displayName === 'Leuchtturmklippe'
    )
    if (!location) throw new Error('E2E location missing')
    await api.locationSymbols.importAndAssign({
      commandId: crypto.randomUUID(),
      displayName: 'Leuchtturm',
      source:
        '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M4 22 L10 4 L14 4 L20 22 Z"/></svg>',
      locationId: location.id,
      expectedSymbolRevision: symbols.revision,
      expectedPresentationRevision: location.mapPresentation.revision
    })
  })
  await (await client.$('button[aria-label="Leuchtturm"]')).waitForExist()
  await mapCanvas.click()
  await waitForLocationPlacement(client, 'Leuchtturmklippe', true)
  await expectElementGolden(
    client,
    'hex-editor-location-dark',
    '.hex-editor-workspace'
  )
  const renameSymbol = await (
    await client.$('label*=Eigenes Symbol umbenennen')
  ).$('input')
  await renameSymbol.setValue('Bake')
  await client.keys(['Tab'])
  await (await client.$('button[aria-label="Bake"]')).waitForExist()
  await (await client.$('button=Symbol löschen')).click()
  await (await client.$('button=Löschen und ersetzen')).click()
  await (
    await client.$('button[aria-label="Bake"]')
  ).waitForExist({ reverse: true })
  await client.waitUntil(
    () =>
      client.execute(async () => {
        const world = await window.saltMarcher.locations.read()
        return (
          world.locations.find(
            (entry) => entry.displayName === 'Leuchtturmklippe'
          )?.mapPresentation.symbolId === 'location'
        )
      }),
    {
      timeout: 5_000,
      timeoutMsg: 'Deleted custom symbol was not replaced by the built-in.'
    }
  )
  await (await client.$('button=Biom malen')).click()
  await (await client.$('button=Radieren')).click()
  await mapCanvas.click()
  const eraseDialog = await client.$(
    '[role="dialog"][aria-label="Belegte Hexes löschen?"]'
  )
  await eraseDialog.waitForExist()
  await expect(await eraseDialog.$('li*=Leuchtturmklippe')).toBeExisting()
  await (await eraseDialog.$('button=Hexes und Bezüge entfernen')).click()
  await waitForLocationPlacement(client, 'Leuchtturmklippe', false)
  await (
    await client.$('button[aria-label="Zum Pergamentmodus wechseln"]')
  ).click()
  await (await client.$('button=Auswahl')).click()
  await mapCanvas.click()
  await client.execute(() => {
    document.documentElement.style.zoom = '2'
  })
  await expectAccessible(client)
  await expectHexEditorStackedLayout(client)
  await client.execute(() => {
    document
      .querySelector('.hex-editor-state')
      ?.scrollIntoView({ block: 'start' })
  })
  await expectElementGolden(
    client,
    'hex-editor-selection-light-200',
    '.hex-editor-state'
  )
  await client.execute(() => {
    document.documentElement.style.zoom = ''
    document
      .querySelector('.hex-editor-workspace')
      ?.scrollIntoView({ block: 'start' })
  })
  await (
    await client.$('button[aria-label="Zum Kerzenlichtmodus wechseln"]')
  ).click()
  await expectHexEditorLayout(client)
  await (
    await client.$('button[aria-label="Zum Pergamentmodus wechseln"]')
  ).click()

  await (await client.$('button[aria-label="Session"]')).click()
  await expect(await client.$('h1=Session · Hex Workflow E2E')).toBeExisting()
}

export async function runCampaignCombatScenario(): Promise<void> {
  const client = browser as unknown as WdioBrowser
  await createFreshCampaign(client, 'Session Combat E2E')
  await createLocation(client, 'Saltmarsh', 'A busy harbour town.')
  await (await client.$('button=Bearbeiten')).click()
  const editLocation = await client.$(
    '[role="dialog"][aria-label="Ort bearbeiten"]'
  )
  await replaceFieldValue(
    client,
    await editLocation.$('input[aria-label="Ortsname"]'),
    'Salzmarschhafen'
  )
  await replaceFieldValue(
    client,
    await editLocation.$('textarea[aria-label="GM-Notizen"]'),
    'Nebel, Lagerhäuser und eine geschäftige Anlegestelle.'
  )
  await (await editLocation.$('button=Speichern')).click()
  await expect(
    await client.$('h2[aria-label="Salzmarschhafen"]')
  ).toBeExisting()
  await (await client.$('button[aria-label="Ort Details schließen"]')).click()
  await (await client.$('button[aria-label="Session"]')).click()
  await setSceneLocation(client, 'Salzmarschhafen')
  await waitForSceneLocation(client, 'Salzmarschhafen')

  await createLocation(client, 'Verfallener Turm', 'Soll gelöscht werden.')
  await (await client.$('button[aria-label="Ort Details schließen"]')).click()
  await (await client.$('button[aria-label="Session"]')).click()
  await setSceneLocation(client, 'Verfallener Turm')
  await waitForSceneLocation(client, 'Verfallener Turm')
  await (await client.$('button[aria-label="Katalog"]')).click()
  await (await client.$('button=Orte')).click()
  await (await client.$('button=Verfallener Turm')).click()
  await (await client.$('button=Löschen')).click()
  await (await client.$('button=Wirklich löschen')).click()
  await (await client.$('button[aria-label="Session"]')).click()
  await waitForSceneLocation(client, 'Nicht verfügbarer Ort')
  await setSceneLocation(client, 'Salzmarschhafen')

  await (await client.$('button[aria-label="Katalog"]')).click()
  await (await client.$('button=Fraktionen')).click()
  await (await client.$('button=Erstellen')).click()
  const factionDialog = await client.$(
    '[role="dialog"][aria-label="Fraktion erstellen"]'
  )
  await factionDialog.waitForDisplayed({ timeout: 10_000 })
  await (
    await factionDialog.$('input[aria-label="Fraktionsname"]')
  ).setValue('Hafenwache')
  await (await factionDialog.$('button.faction-table-card')).click()
  await clickWhenInteractable(
    client,
    async () => await client.$('button=Neue Encounter-Tabelle')
  )
  const tableDialog = await client.$('section.encounter-table-manager')
  await tableDialog
    .$('.creature-collection-layout')
    .waitForDisplayed({ timeout: 10000 })
  const tableGeometry = await client.execute(() => {
    const layout = document.querySelector('.creature-collection-layout')!
    const catalog = layout
      .querySelector('.creature-collection-catalog')!
      .getBoundingClientRect()
    const seam = layout
      .querySelector('.creature-collection-divider')!
      .getBoundingClientRect()
    const draft = layout
      .querySelector('.creature-collection-draft')!
      .getBoundingClientRect()
    return {
      seamWidth: Math.round(seam.width),
      draftWidth: Math.round(draft.width),
      ordered: catalog.right <= seam.left && seam.right <= draft.left
    }
  })
  expect(tableGeometry).toEqual({
    seamWidth: 9,
    draftWidth: 627,
    ordered: true
  })
  await (
    await tableDialog.$('input[aria-label="Tabellenname"]')
  ).setValue('Wachpatrouille')
  await (await tableDialog.$('button[aria-label="Dialog schließen"]')).click()
  const keepDraftAlert = await client.$('[role="alertdialog"]')
  await expect(keepDraftAlert).toBeDisplayed()
  await (await keepDraftAlert.$('button=Abbrechen')).click()
  await expect(await client.$('[role="alertdialog"]')).not.toBeExisting()
  await expect(
    await tableDialog.$('input[aria-label="Tabellenname"]')
  ).toHaveValue('Wachpatrouille')
  await (
    await tableDialog.$('input[aria-label="Monster suchen"]')
  ).setValue('wolf')
  const addTableWolf = await tableDialog.$(
    'button[aria-label="Wolf hinzufügen"]'
  )
  await client.waitUntil(() => addTableWolf.isExisting(), {
    timeout: 5_000,
    timeoutMsg: 'Shared table manager did not render the filtered Wolf.'
  })
  await addTableWolf.click()
  await (await tableDialog.$('button=Erstellen und verknüpfen')).click()
  await expect(
    await factionDialog.$('input[aria-label="Fraktionsname"]')
  ).toHaveValue('Hafenwache')
  await client.waitUntil(
    async () =>
      (await (
        await factionDialog.$('button.faction-table-card strong')
      ).getText()) === 'Wachpatrouille',
    {
      timeout: 15_000,
      timeoutMsg: 'New encounter table was not selected in the faction draft.'
    }
  )
  await (
    await factionDialog.$('input[aria-label="Maximum Wolf"]')
  ).setValue('2')
  await (await factionDialog.$('button=Erstellen')).click()
  await expect(await client.$('button=Hafenwache')).toBeExisting()
  await (await client.$('button=Encounter-Tabellen')).click()
  await (await client.$('button=Wachpatrouille')).click()
  const reopenedTable = await client.$('section.encounter-table-manager')
  await expect(
    await reopenedTable.$('input[aria-label="Tabellenname"]')
  ).toHaveValue('Wachpatrouille')
  await (
    await reopenedTable.$('textarea[aria-label="Tabellenbeschreibung"]')
  ).setValue('Nicht speichern')
  const tableFooter = await reopenedTable.$(
    'footer.creature-collection-manager-footer'
  )
  await (await tableFooter.$('button=Abbrechen')).click()
  const discardDraftAlert = await client.$('[role="alertdialog"]')
  await expect(discardDraftAlert).toBeDisplayed()
  await (await discardDraftAlert.$('button=Änderungen verwerfen')).click()
  await expect(reopenedTable).not.toBeExisting()
  await (await client.$('button=Orte')).click()
  await (await client.$('button=Salzmarschhafen')).click()
  await (await client.$('button=Bearbeiten')).click()
  const locationDialog = await client.$(
    '[role="dialog"][aria-label="Ort bearbeiten"]'
  )
  const encounterTableSearch = await locationDialog.$(
    'input[aria-label="Encounter-Tabelle suchen …"]'
  )
  await encounterTableSearch.setValue('wach')
  const encounterTableOption = await locationDialog.$(
    '[role="option"]*=Wachpatrouille'
  )
  await encounterTableOption.waitForDisplayed({ timeout: 5_000 })
  await encounterTableOption.click()
  await (await locationDialog.$('button=Speichern')).click()
  await (await client.$('button[aria-label="Ort Details schließen"]')).click()
  await (await client.$('button[aria-label="Session"]')).click()

  await client.$('button[aria-label="Katalog"]').click()
  await client.$('.catalog-section-selector').$('button=Charaktere').click()
  for (const name of ['Alrik', 'Brynn']) {
    await client.$('.character-catalog-tools').$('button=Neu').click()
    const editor = client.$('form.character-profile-form')
    await editor.$('input[name="name"]').setValue(name)
    await editor.$('input[name="level"]').setValue('3')
    await editor.$('button=Speichern').click()
    await editor.waitForExist({ reverse: true, timeout: 5000 })
  }
  await client.$('button[aria-label="Session"]').click()
  const characters = await openSceneWindow(client, 'characters', true)
  await characters.$('button=Besetzung').click()
  const roster = client.$('.desktop-roster-popup')
  await roster.waitForDisplayed()
  for (const name of ['Alrik', 'Brynn'])
    await roster.$(`label*=${name}`).$('input').click()
  await roster.$('button=Übernehmen').click()
  await roster.waitForExist({ reverse: true, timeout: 5000 })
  expect(await characters.getText()).toContain('Alrik')
  expect(await characters.getText()).toContain('Brynn')
  await characters.$('button[aria-label="Fenster schließen"]').click()

  await (await client.$('button[aria-label="Katalog"]')).click()
  await (
    await client.$('.catalog-section-selector')
  )
    .$('button=Monster')
    .click()
  const monsterSearch = await client.$('input[aria-label="Monster suchen"]')
  await monsterSearch.setValue('wolf')
  const wolf = await client.$('button=Wolf')
  await client.waitUntil(() => wolf.isExisting(), {
    timeout: 5_000,
    timeoutMsg: 'Filtered Wolf catalog row was not rendered.'
  })
  const tableFilter = await client.$(
    'input[role="combobox"][aria-label="Tabelle"]'
  )
  await tableFilter.setValue('wach')
  const tableOption = await client.$('[role="option"]*=Wachpatrouille')
  await tableOption.waitForDisplayed()
  await tableOption.click()
  await expect(await client.$('button=Wachpatrouille ×')).toBeExisting()
  await tableFilter.click()
  await client.keys('Escape')
  await expect(tableFilter).toHaveAttribute('aria-expanded', 'false')
  await client
    .$('[role="listbox"][aria-label="Tabelle"]')
    .waitForExist({ reverse: true, timeout: 5_000 })
  await expect(await client.$('button=+ Encounter')).not.toBeExisting()
  await expectAccessibleInBothThemes(client)

  await (await client.$('button[aria-label="Session"]')).click()
  const groupsHeading = await client.$('[data-window-id="overview"]')
  await expect(await groupsHeading.$('button=Neue Gruppe')).not.toBeExisting()
  await (
    await openSceneWindow(client, 'overview')
  )
    .$('button[aria-label="Gruppen bearbeiten"]')
    .click()
  const groupDialog = await client.$(
    'section[aria-labelledby="group-builder-title"]'
  )
  await expectAccessibleInBothThemes(client)
  const groupSelection = await groupDialog.$(
    'select[aria-label="Gruppe auswählen"]'
  )
  await expect(await groupSelection.$('option:checked')).toHaveText(
    'Neue Gruppe'
  )
  await expect(await groupDialog.$('button*=Neue Gruppe')).toBeExisting()
  await expect(
    await groupDialog.$('section[aria-label="Filter und Generator"]')
  ).toBeExisting()
  const draftDivider = await groupDialog.$(
    '[aria-label="Breite des Gruppenentwurfs"]'
  )
  await expect(draftDivider).toHaveAttribute('aria-valuenow', '460')
  await pressDividerKey(client, 'Breite des Gruppenentwurfs', 'ArrowLeft')
  await expect(draftDivider).toHaveAttribute('aria-valuenow', '470')
  await (
    await groupDialog.$('input[aria-label="Gruppenname"]')
  ).setValue('Wolf Pack')
  await (
    await groupDialog.$('textarea[aria-label="Gruppennotiz"]')
  ).setValue('Lauert Prone in den Dünen; Stunned bei Alarm.')
  const generate = await groupDialog.$('button=Neu generieren')
  await client.waitUntil(() => generate.isEnabled(), {
    timeout: 5_000,
    timeoutMsg: 'Generator was not available for the new group draft.'
  })
  await generate.click()
  await waitForGroupManagementReady(client)
  await expectGroupManagementGolden(client)
  await expect(await groupDialog.$('button=Leeren')).not.toBeExisting()
  await (await groupDialog.$('button=Gruppe')).click()
  const undoGenerated = await groupDialog.$(
    'button[aria-label="Änderung zurücknehmen"]'
  )
  await client.waitUntil(() => undoGenerated.isEnabled(), {
    timeout: 5_000,
    timeoutMsg: 'Generated group draft did not become undoable.'
  })
  await undoGenerated.click()
  const dialogSearch = await groupDialog.$('input[aria-label="Monster suchen"]')
  const discardGeneratedLoot = await client.$('section[role="alertdialog"]')
  await discardGeneratedLoot.waitForDisplayed({ timeout: 5_000 })
  expect(
    await client.execute(() =>
      Boolean(
        document
          .querySelector(
            'section[aria-labelledby="group-builder-title"] input[aria-label="Monster suchen"]'
          )
          ?.closest('[inert]')
      )
    )
  ).toBe(true)
  await (await discardGeneratedLoot.$('button=Änderungen verwerfen')).click()
  await discardGeneratedLoot.waitForExist({ reverse: true, timeout: 5_000 })
  await dialogSearch.setValue('wolf')
  const addWolf = await client.$('button[aria-label="Wolf hinzufügen"]')
  await client.waitUntil(() => addWolf.isExisting(), {
    timeout: 5_000,
    timeoutMsg: 'Wolf add action was not rendered.'
  })
  await addWolf.click()
  for (let count = 1; count < 4; count += 1)
    await client.execute(() => {
      const increase = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Anzahl Wolf erhöhen"]'
      )
      increase?.click()
    })
  await (await groupDialog.$('button=Speichern')).click()
  const confirmSave = await client.$('section[role="alertdialog"]')
  await confirmSave.waitForDisplayed({ timeout: 5_000 })
  await (await confirmSave.$('button=Änderungen verwerfen')).click()
  await expect(await client.$('.group-name=Wolf Pack')).toBeExisting()
  const expandWolf = await client.$('button[aria-label="Wolf Pack aufklappen"]')
  if (await expandWolf.isExisting()) await expandWolf.click()
  await expect(await client.$('.group-note')).toHaveText(
    'Lauert Prone in den Dünen; Stunned bei Alarm.'
  )

  const groupNote = await client.$('.group-note')
  const proneReference = await groupNote.$('button=Prone')
  await proneReference.waitForExist({ timeout: 5_000 })
  const pronePreview = await client.$(
    'section[role="region"][aria-label="Referenz: Prone"]'
  )
  await client.execute(() => {
    const term = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.group-note .reference-term'
      )
    ].find((button) => button.textContent === 'Prone')
    term?.focus()
  })
  await pronePreview.waitForExist({ timeout: 5_000 })
  await client.execute(() => {
    const term = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.reference-hover-card .reference-term'
      )
    ].find((button) => button.textContent === 'movement')
    term?.focus()
  })
  const movementPreview = await client.$(
    'section[role="region"][aria-label="Referenz: movement"]'
  )
  await expect(movementPreview).toBeExisting()
  await client.keys('Escape')
  await movementPreview.waitForExist({ reverse: true, timeout: 5_000 })
  await client.execute(() => {
    const term = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.group-note .reference-term'
      )
    ].find((button) => button.textContent === 'Prone')
    term?.focus()
  })
  const reopenedPronePreview = await client.$(
    'section[role="region"][aria-label="Referenz: Prone"]'
  )
  await reopenedPronePreview.waitForExist({ timeout: 5_000 })
  await (
    await reopenedPronePreview.$('button[aria-label="Prone separat öffnen"]')
  ).click()
  const pinnedProne = await client.$('.desktop-window[aria-label="Prone"]')
  await pinnedProne.waitForExist({ timeout: 5_000 })
  const movePinned = await pinnedProne.$(
    'button[aria-label="Fenster mit Pfeiltasten verschieben"]'
  )
  await movePinned.click()
  await client.keys(['SHIFT', 'ARROWRIGHT'])
  await (await pinnedProne.$('button[aria-label="Fenster schließen"]')).click()

  await proneReference.click()
  const reader = await client.$('.desktop-window[data-window-id="reader"]')
  await expect(reader).toHaveAttribute(
    'aria-label',
    expect.stringContaining('Prone')
  )
  await (await reader.$('.reference-document')).waitForDisplayed()
  await openSceneWindow(client, 'overview')
  await (await groupNote.$('button=Stunned')).click()
  await expect(reader).toHaveAttribute(
    'aria-label',
    expect.stringContaining('Stunned')
  )
  await (await reader.$('button[aria-label="Zurück"]')).click()
  await expect(reader).toHaveAttribute(
    'aria-label',
    expect.stringContaining('Prone')
  )
  await (await reader.$('button[aria-label="Vorwärts"]')).click()
  await expect(reader).toHaveAttribute(
    'aria-label',
    expect.stringContaining('Stunned')
  )

  await client.execute(() => {
    document.documentElement.style.zoom = '200%'
  })
  await expectAccessible(client)
  await client.execute(() => {
    document.documentElement.style.zoom = ''
  })

  await (await client.$('.workspace-heading')).moveTo()
  await client.keys('Escape')
  await (
    await client.$('.reference-hover-card')
  ).waitForExist({
    reverse: true,
    timeout: 5_000
  })
  await (await reader.$('button[aria-label="Fenster schließen"]')).click()
  await reader.waitForExist({ reverse: true, timeout: 5_000 })

  await (
    await openSceneWindow(client, 'overview')
  )
    .$('button[aria-label="Gruppen bearbeiten"]')
    .click()
  const reopenedGroupDialog = await client.$(
    'section[aria-labelledby="group-builder-title"]'
  )
  const reopenedSelection = await reopenedGroupDialog.$(
    'select[aria-label="Gruppe auswählen"]'
  )
  await reopenedSelection.selectByVisibleText('Wolf Pack')
  await (await reopenedGroupDialog.$('button*=Neue Gruppe')).click()
  const emptyGroupName = await reopenedGroupDialog.$(
    'input[aria-label="Gruppenname"]'
  )
  await expect(emptyGroupName).toHaveAttribute(
    'placeholder',
    'Optional · automatisch Gruppe 1, 2, …'
  )
  await (
    await reopenedGroupDialog.$('textarea[aria-label="Gruppennotiz"]')
  ).setValue('Erhält automatisch einen Namen.')
  await reopenedSelection.selectByVisibleText('Wolf Pack')
  await reopenedSelection.selectByVisibleText('Neue Gruppe')
  await expect(emptyGroupName).toHaveValue('')
  await (await reopenedGroupDialog.$('button=Speichern')).click()
  const confirmNewGroupSave = await client.$('section[role="alertdialog"]')
  await confirmNewGroupSave.waitForDisplayed({ timeout: 5_000 })
  await (await confirmNewGroupSave.$('button=Änderungen verwerfen')).click()
  await expect(await client.$('.group-name=Gruppe 1')).toBeExisting()

  await openSceneWindow(client, 'combat', true)
  const groupChoice = await client.$('label*=Wolf Pack')
  await (await groupChoice.$('input')).click()
  const prepare = await client.$('button=Initiative vorbereiten')
  await client.waitUntil(() => prepare.isEnabled(), {
    timeout: 5_000,
    timeoutMsg: 'Encounter selection evaluation did not become ready.'
  })
  await prepare.click()
  await expect(
    await client.$('button[aria-current="step"]*=Initiative')
  ).toBeExisting()
  await expectScenarioGolden(client, 'initiative')
  await (await client.$('button=Kampf starten')).click()
  await expect(
    await client.$('button[aria-current="step"]*=Kampf')
  ).toBeExisting()
  await expectScenarioGolden(client, 'combat')
  await (
    await (await client.$('.combat-panel footer')).$('button*=Auflösung')
  ).click()
  await expect(await client.$('.resolution-panel')).toBeExisting()
  await expectScenarioGolden(client, 'resolution')
}

export async function runCampaignPseudoLocaleScenario(): Promise<void> {
  const client = browser as unknown as WdioBrowser
  await createFreshCampaign(client, 'Pseudo Locale E2E')
  const url = new URL(await client.getUrl())
  url.searchParams.set('locale', 'pseudo')
  await client.url(url.href)
  await (await client.$('.eyebrow*=⟦')).waitForExist()
  await expectAccessible(client)
}

async function waitForCampaignInput(
  client: WdioBrowser,
  field: Awaited<ReturnType<WdioBrowser['$']>>
): Promise<void> {
  try {
    await client.waitUntil(() => field.isExisting(), {
      timeout: 5_000,
      timeoutMsg: 'Campaign input was not rendered.'
    })
  } catch (cause) {
    const diagnostic = await client.execute(() => ({
      url: window.location.href,
      body: document.body.innerHTML,
      capability: typeof (window as unknown as { saltMarcher?: unknown })
        .saltMarcher,
      scripts: [...document.scripts].map((script) => script.src)
    }))
    throw new Error(
      `Campaign input was not rendered: ${JSON.stringify(diagnostic)}`,
      { cause }
    )
  }
}

async function createFreshCampaign(
  client: WdioBrowser,
  name: string
): Promise<void> {
  await beginCampaignCreation(client)
  const field = await client.$('#campaign-name')
  await waitForCampaignInput(client, field)
  await field.setValue(name)
  await (await client.$('button=Erstellen & öffnen')).click()
  await (
    await client.$(`h1=Session · ${name}`)
  ).waitForExist({
    timeout: 10_000
  })
}

async function expectHexEditorLayout(client: WdioBrowser): Promise<void> {
  const layout = await client.execute(() => {
    const workspace = document.querySelector('.hex-editor-workspace')
    const shell = document.querySelector('.hex-canvas-shell')
    const host = document.querySelector('.hex-canvas')
    if (
      !(workspace instanceof HTMLElement) ||
      !(shell instanceof HTMLElement) ||
      !(host instanceof HTMLElement)
    )
      return null
    const shellBounds = shell.getBoundingClientRect()
    return {
      workspaceDisplay: getComputedStyle(workspace).display,
      shellPosition: getComputedStyle(shell).position,
      hostPosition: getComputedStyle(host).position,
      shellWidth: shellBounds.width,
      shellHeight: shellBounds.height,
      shellRight: shellBounds.right,
      viewportWidth: window.innerWidth
    }
  })

  expect(layout).not.toBeNull()
  expect(layout?.workspaceDisplay).toBe('grid')
  expect(layout?.shellPosition).toBe('relative')
  expect(layout?.hostPosition).toBe('absolute')
  expect(layout?.shellWidth).toBeGreaterThan(0)
  expect(layout?.shellHeight).toBeGreaterThanOrEqual(260)
  expect(layout?.shellRight).toBeLessThanOrEqual(layout?.viewportWidth ?? 0)
}

async function expectHexEditorStackedLayout(
  client: WdioBrowser
): Promise<void> {
  const geometry = await client.execute(() => {
    const workspace = document.querySelector('.hex-editor-workspace')
    const map = document.querySelector('.hex-editor-map')
    const state = document.querySelector('.hex-editor-state')
    if (
      !(workspace instanceof HTMLElement) ||
      !(map instanceof HTMLElement) ||
      !(state instanceof HTMLElement)
    )
      return null
    const workspaceBounds = workspace.getBoundingClientRect()
    const mapBounds = map.getBoundingClientRect()
    const stateBounds = state.getBoundingClientRect()
    return {
      columns: getComputedStyle(workspace).gridTemplateColumns,
      workspaceWidth: Math.round(workspaceBounds.width),
      stateWidth: Math.round(stateBounds.width),
      mapBottom: Math.round(mapBounds.bottom),
      stateTop: Math.round(stateBounds.top)
    }
  })
  expect(geometry).not.toBeNull()
  expect(geometry?.columns.split(' ')).toHaveLength(1)
  expect(geometry?.stateWidth).toBe(geometry?.workspaceWidth)
  expect(geometry?.stateTop).toBeGreaterThanOrEqual(
    (geometry?.mapBottom ?? 0) - 1
  )
}

async function waitForHexContentRevision(
  client: WdioBrowser,
  mapName: string,
  minimumRevision: number
): Promise<void> {
  await client.waitUntil(
    () =>
      client.execute(
        async (name, minimum) => {
          const catalog = await window.saltMarcher.hex.catalog()
          return (
            (catalog.maps.find((entry) => entry.displayName === name)
              ?.contentRevision ?? -1) >= minimum
          )
        },
        mapName,
        minimumRevision
      ),
    {
      timeout: 5_000,
      timeoutMsg: `Hex map ${mapName} did not reach revision ${minimumRevision}.`
    }
  )
}

async function waitForLocationPlacement(
  client: WdioBrowser,
  locationName: string,
  expectedPlaced: boolean
): Promise<void> {
  await client.waitUntil(
    () =>
      client.execute(
        async (name, expected) => {
          const world = await window.saltMarcher.locations.read()
          const location = world.locations.find(
            (entry) => entry.displayName === name
          )
          if (!location) return false
          const placement = await window.saltMarcher.hex.locateLocation({
            locationId: location.id
          })
          return (placement !== null) === expected
        },
        locationName,
        expectedPlaced
      ),
    {
      timeout: 5_000,
      timeoutMsg: `Location ${locationName} placement did not become ${String(expectedPlaced)}.`
    }
  )
}

async function createLocation(
  client: WdioBrowser,
  name: string,
  notes: string
): Promise<void> {
  await (await client.$('button[aria-label="Katalog"]')).click()
  await (await client.$('button=Orte')).click()
  await (await client.$('button=Erstellen')).click()
  const dialog = await client.$('[role="dialog"][aria-label="Ort erstellen"]')
  await (await dialog.$('input[aria-label="Ortsname"]')).setValue(name)
  await (await dialog.$('input[aria-label="Tags"]')).setValue('Schauplatz')
  await client.keys(['Enter'])
  await (await dialog.$('textarea[aria-label="GM-Notizen"]')).setValue(notes)
  await (await dialog.$('button=Erstellen')).click()
  await expect(await client.$(`h2[aria-label="${name}"]`)).toBeExisting()
}

async function waitForSceneLocation(
  client: WdioBrowser,
  expected: string
): Promise<void> {
  await client.waitUntil(
    async () =>
      (await (await client.$('.desktop-scene-facts > button')).getText()) ===
      expected,
    {
      timeout: 5_000,
      timeoutMsg: `Scene location did not become ${expected}.`
    }
  )
}

async function setSceneLocation(
  client: WdioBrowser,
  location: string
): Promise<void> {
  const row = await client.$('.desktop-scene-facts')
  await (await row.$('button')).click()
  await (
    await row.$('select[aria-label="Scene-Ort"]')
  ).selectByVisibleText(location)
}

async function pressDividerKey(
  client: WdioBrowser,
  label: string,
  key: string
): Promise<void> {
  await client.execute(
    (ariaLabel, keyboardKey) => {
      const divider = document.querySelector<HTMLElement>(
        `[aria-label="${ariaLabel}"]`
      )
      divider?.focus()
      divider?.dispatchEvent(
        new KeyboardEvent('keydown', { key: keyboardKey, bubbles: true })
      )
    },
    label,
    key
  )
}

async function expectScenarioGolden(
  client: WdioBrowser,
  name: 'initiative' | 'combat' | 'resolution'
): Promise<void> {
  for (const width of [1024, 1280, 1600]) {
    await setElectronWindowSize(client, width, 800)
    const overflow = await client.execute(() => {
      const panel = document.querySelector<HTMLElement>(
        '.desktop-window[data-window-id="combat"]'
      )
      const workspace = document.querySelector<HTMLElement>('.scene-desktop')
      if (!panel || !workspace) return null
      const panelBounds = panel.getBoundingClientRect()
      const workspaceBounds = workspace.getBoundingClientRect()
      return {
        panelOverflow: panel.scrollWidth - panel.clientWidth,
        outsideWorkspace: panelBounds.right - workspaceBounds.right
      }
    })
    expect(overflow).not.toBeNull()
    expect(overflow?.panelOverflow).toBeLessThanOrEqual(1)
    expect(overflow?.outsideWorkspace).toBeLessThanOrEqual(1)
  }
  await setElectronWindowSize(client, 1280, 800)
  await client.execute(async () => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur()
    const panel = document.querySelector<HTMLElement>(
      '.desktop-window[data-window-id="combat"]'
    )
    const resetScroll = () => {
      if (panel) {
        panel.scrollTop = 0
        panel.scrollLeft = 0
      }
      for (
        let ancestor = panel?.parentElement ?? null;
        ancestor;
        ancestor = ancestor.parentElement
      ) {
        ancestor.scrollTop = 0
        ancestor.scrollLeft = 0
      }
    }
    resetScroll()
    panel?.scrollIntoView({ block: 'start', inline: 'nearest' })
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
    resetScroll()
  })
  await expectElementGolden(
    client,
    name,
    '.desktop-window[data-window-id="combat"]',
    false
  )
}

async function expectGroupManagementGolden(client: WdioBrowser): Promise<void> {
  await expectElementGolden(
    client,
    'group-management',
    'section[aria-labelledby="group-builder-title"]'
  )
}

async function waitForGroupManagementReady(client: WdioBrowser): Promise<void> {
  await client.waitUntil(
    async () =>
      client.execute(() => {
        const dialog = document.querySelector(
          'section[aria-labelledby="group-builder-title"]'
        )
        const draft = dialog?.querySelector('.group-manager-draft-rim')
        const catalog = dialog?.querySelector('.loot-catalog-pane')
        const selectedTabs = dialog?.querySelectorAll(
          'button[role="tab"][aria-selected="true"]'
        )
        return (
          draft?.getAttribute('data-group-draft-ready') === 'true' &&
          catalog?.getAttribute('data-loot-catalog-ready') === 'true' &&
          selectedTabs?.length === 2 &&
          dialog?.querySelector('.generated-loot-results') !== null
        )
      }),
    {
      timeout: 15_000,
      interval: 100,
      timeoutMsg:
        'Group roster, Loot draft, catalog, and workspace layout did not become ready.'
    }
  )
}

async function runCampaignMinimumSizeScenario(
  client: WdioBrowser
): Promise<void> {
  await openCampaignScreen(client)
  await setWindowToMinimumResponsiveSize(client)
  const name =
    'Die außergewöhnlich lange Kampagne der Salzmark '.repeat(3).slice(0, 99) +
    '!'
  const before = await client.execute(() => window.saltMarcher.campaigns.list())
  for (let i = 0; i < 2; i++) {
    await beginCampaignCreation(client)
    await client.$('#campaign-name').setValue(name)
    await expectCampaignLayout(client)
    await client.$('button=Erstellen & öffnen').click()
    await client
      .$('[data-screen="workspace"]')
      .waitForExist({ timeout: 15_000 })
    await openCampaignScreen(client)
  }
  const created = await client.execute(() =>
    window.saltMarcher.campaigns.list()
  )
  const duplicates = created.campaigns.filter(
    (campaign) => campaign.name === name
  )
  expect(created.campaigns.length).toBe(before.campaigns.length + 2)
  expect(duplicates).toHaveLength(2)
  expect(new Set(duplicates.map((campaign) => campaign.id)).size).toBe(2)

  const originalTheme = await client.execute(
    () => document.documentElement.dataset['theme']
  )
  try {
    for (const theme of ['light', 'dark']) {
      await client.execute((theme: string) => {
        document.documentElement.dataset['theme'] = theme
      }, theme)
      await expect(client.$$('strong=' + name)).toBeElementsArrayOfSize(2)
      await expectCampaignLayout(client)
      await beginCampaignCreation(client)
      await client.$('#campaign-name').setValue(name)
      await expectCampaignLayout(client)
      await client.$('button[aria-label="Schließen"]').click()
      await client.$('button[aria-label="' + name + ' bearbeiten"]').click()
      await expect(client.$('#campaign-name')).toHaveValue(name)
      await expectCampaignLayout(client)
      await client.$('button=In den Papierkorb').click()
      await client.$('button=Papierkorb (1)').click()
      await expectCampaignLayout(client)
      await client.$('button=Löschen …').click()
      await expectCampaignLayout(client)
      await client.$('#campaign-confirm-name').setValue(name.toLowerCase())
      await expect(client.$('button=Endgültig löschen')).toBeDisabled()
      await client.$('#campaign-confirm-name').setValue(name)
      await expect(client.$('button=Endgültig löschen')).toBeEnabled()
      await client.$('button=Abbrechen').click()
      await client.$('button=Wiederherstellen').click()
      await client.$('p*=Die Kampagne wurde wiederhergestellt').waitForExist()
      await expectCampaignLayout(client)
      await client.$('button[aria-label="Schließen"]').click()
      const restored = await client.execute(() =>
        window.saltMarcher.campaigns.list()
      )
      expect(restored.activeCampaignId).toBeNull()
      expect(
        restored.campaigns.filter((campaign) => campaign.name === name)
      ).toEqual(duplicates)
    }
  } finally {
    await client.execute((theme: string | null) => {
      if (theme === null) delete document.documentElement.dataset['theme']
      else document.documentElement.dataset['theme'] = theme
    }, originalTheme ?? null)
  }
}

async function expectCampaignLayout(client: WdioBrowser): Promise<void> {
  await expectAccessible(client)
  const layout = await client.execute(() => {
    const popup = document.querySelector<HTMLElement>(
      '.campaign-management-popup'
    )
    const surface =
      popup ?? document.querySelector<HTMLElement>('.campaign-screen')
    if (!surface) throw new Error('Campaign surface is missing')
    const bounds = surface.getBoundingClientRect()
    const controls = [...surface.querySelectorAll<HTMLElement>('button,input')]
    return {
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
      surfaceOverflow: surface.scrollWidth > surface.clientWidth + 1,
      outsideViewport: bounds.left < 0 || bounds.right > innerWidth + 1,
      popupOutsideViewport:
        popup !== null && (bounds.top < 0 || bounds.bottom > innerHeight + 1),
      controlsOutsideSurface: controls.some((control) => {
        const rect = control.getBoundingClientRect()
        return rect.left < bounds.left - 1 || rect.right > bounds.right + 1
      })
    }
  })
  expect(layout).toEqual({
    pageOverflow: false,
    surfaceOverflow: false,
    outsideViewport: false,
    popupOutsideViewport: false,
    controlsOutsideSurface: false
  })
}
