import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import {
  clickWhenInteractable,
  expectAccessible,
  expectAccessibleInBothThemes,
  expectElementGolden,
  setElectronWindowSize,
  setWindowToMinimumResponsiveSize
} from './support/e2e-assertions.js'

describe('campaign walking skeleton', () => {
  it('creates and switches the selected campaign', async () => {
    const client = browser as unknown as WdioBrowser
    const field = await client.$('#campaign-name')
    await waitForCampaignInput(client, field)
    await expectAccessibleInBothThemes(client)
    await expectElementGolden(
      client,
      'campaign-dialog-light',
      'section.campaign-dialog'
    )
    await client.execute(() => {
      document.documentElement.dataset['theme'] = 'dark'
    })
    await expectElementGolden(
      client,
      'campaign-dialog-dark',
      'section.campaign-dialog'
    )
    await client.execute(() => {
      document.documentElement.dataset['theme'] = 'light'
    })
    await field.setValue('Campaign A')
    await (await client.$('button=Anlegen')).click()
    await (
      await client.$('h1=Session · Campaign A')
    ).waitForExist({
      timeout: 10_000
    })
    await expect(
      await client.$('section[aria-label="Session Steuerung"]')
    ).toBeExisting()
    await expect(
      await client.$('section[aria-label="Detailansicht"]')
    ).toBeExisting()
    await expect(await client.$('section[aria-label="Gruppen"]')).toBeExisting()
    await expect(
      await client.$('aside[aria-label="Szenario Panel"]')
    ).toBeExisting()
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
      async () =>
        (await campaignRulesCard.getAttribute('aria-busy')) === 'false',
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
        const dialog = document.querySelector(
          'section.encounter-settings-dialog'
        )
        return Boolean(
          dialog &&
          document.activeElement instanceof HTMLElement &&
          dialog.contains(document.activeElement)
        )
      })
    ).toBe(true)
    await expectElementGolden(
      client,
      'encounter-settings-light',
      'section.encounter-settings-dialog'
    )
    await client.execute(() => {
      document.documentElement.dataset['theme'] = 'dark'
    })
    await expectElementGolden(
      client,
      'encounter-settings-dark',
      'section.encounter-settings-dialog'
    )
    await client.execute(() => {
      document.documentElement.dataset['theme'] = 'light'
    })
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
        const rules = dialog.querySelector<HTMLElement>(
          '.generator-rules-grid'
        )!
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
      const height = (selector: string) =>
        Math.round(
          document.querySelector(selector)!.getBoundingClientRect().height
        )
      const width = (selector: string) =>
        Math.round(
          document.querySelector(selector)!.getBoundingClientRect().width
        )
      return {
        topBar: height('.top-bar'),
        rail: width('.icon-bar'),
        control: width('.session-control-column'),
        scenario: width('.session-scenario-column'),
        dividers: [...document.querySelectorAll('.session-divider')].map(
          (element) => Math.round(element.getBoundingClientRect().width)
        )
      }
    })
    expect(geometry).toEqual({
      topBar: 66,
      rail: 66,
      control: 300,
      scenario: 264,
      dividers: [9, 9]
    })
    await expectAccessibleInBothThemes(client)
    await (await client.$('button=Karte')).click()
    await expect(await client.$('strong=Keine Hex-Karte')).toBeExisting()
    await (await client.$('button=Detail')).click()
    await expect(await client.$$('[role="separator"]')).toBeElementsArrayOfSize(
      2
    )
    const columnDivider = await client.$(
      '[aria-label="Breite der Steuerungsspalte"]'
    )
    await pressDividerKey(client, 'Breite der Steuerungsspalte', 'ArrowLeft')
    await expect(columnDivider).toHaveAttribute('aria-valuenow', '290')
    const rightDivider = await client.$(
      '[aria-label="Breite der Szenariospalte"]'
    )
    await pressDividerKey(client, 'Breite der Szenariospalte', 'ArrowLeft')
    await expect(rightDivider).toHaveAttribute('aria-valuenow', '274')

    await openCampaignDialog(client)
    const nextField = await client.$('#campaign-name')
    await nextField.setValue('Campaign B')
    await (await client.$('button=Anlegen')).click()
    await (
      await client.$('h1=Session · Campaign B')
    ).waitForExist({
      timeout: 10_000
    })

    await openCampaignDialog(client)
    await (await client.$('button[aria-label="Campaign A"]')).click()
    await (
      await client.$('h1=Session · Campaign A')
    ).waitForExist({
      timeout: 10_000
    })

    await openCampaignDialog(client)
    let campaignBRow = await (
      await client.$('button[aria-label="Campaign B"]')
    ).$('..')
    await (await campaignBRow.$('button=Umbenennen')).click()
    const rename = await campaignBRow.$('input[aria-label="Umbenennen"]')
    await rename.setValue('Campaign B Archiv')
    await (await campaignBRow.$('button=Speichern')).click()
    campaignBRow = await (
      await client.$('button[aria-label="Campaign B Archiv"]')
    ).$('..')
    await (await campaignBRow.$('button=In Papierkorb')).click()
    await (await client.$('summary=Papierkorb (1)')).click()
    let trashedRow = await (await client.$('span=Campaign B Archiv')).$('..')
    await (await trashedRow.$('button=Wiederherstellen')).click()
    campaignBRow = await (
      await client.$('button[aria-label="Campaign B Archiv"]')
    ).$('..')
    await (await campaignBRow.$('button=In Papierkorb')).click()
    await (await client.$('summary=Papierkorb (1)')).click()
    trashedRow = await (await client.$('span=Campaign B Archiv')).$('..')
    await (await trashedRow.$('button=Endgültig löschen')).click()
    const deleteConfirmation = await client.$('.campaign-delete-confirm')
    await (
      await deleteConfirmation.$(
        'input[aria-label="Kampagnenname zur Bestätigung"]'
      )
    ).setValue('Campaign B Archiv')
    await (await deleteConfirmation.$('button=Endgültig löschen')).click()
    await expect(
      await client.$('button[aria-label="Campaign B Archiv"]')
    ).not.toBeExisting()
    await (
      await client.$('#campaign-menu button[aria-label="Schließen"]')
    ).click()
  })

  it('keeps a newly created hex map inside the workspace', async () => {
    const client = browser as unknown as WdioBrowser
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
      const viewport = document.querySelector<HTMLElement>(
        '.hex-biome-viewport'
      )
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
    await expect(await client.$('h1=Session · Campaign A')).toBeExisting()
  })

  it('builds a scene party, browses monsters and starts a scene group combat', async () => {
    const client = browser as unknown as WdioBrowser
    await createLocation(client, 'Saltmarsh', 'A busy harbour town.')
    await (await client.$('button=Bearbeiten')).click()
    const editLocation = await client.$(
      '[role="dialog"][aria-label="Ort bearbeiten"]'
    )
    await (
      await editLocation.$('input[aria-label="Ortsname"]')
    ).setValue('Salzmarschhafen')
    await (
      await editLocation.$('textarea[aria-label="GM-Notizen"]')
    ).setValue('Nebel, Lagerhäuser und eine geschäftige Anlegestelle.')
    await (await editLocation.$('button=Speichern')).click()
    await expect(
      await client.$('h2[aria-label="Salzmarschhafen"]')
    ).toBeExisting()
    await (await client.$('button[aria-label="Ort Details schließen"]')).click()
    await (await client.$('button[aria-label="Session"]')).click()
    const sceneLocation = await client.$('select[aria-label="Scene-Ort"]')
    await sceneLocation.selectByVisibleText('Salzmarschhafen')
    await waitForSceneLocation(client, 'Salzmarschhafen')

    await createLocation(client, 'Verfallener Turm', 'Soll gelöscht werden.')
    await (await client.$('button[aria-label="Ort Details schließen"]')).click()
    await (await client.$('button[aria-label="Session"]')).click()
    await (
      await client.$('select[aria-label="Scene-Ort"]')
    ).selectByVisibleText('Verfallener Turm')
    await (await client.$('button[aria-label="Katalog"]')).click()
    await (await client.$('button=Orte')).click()
    await (await client.$('button=Verfallener Turm')).click()
    await (await client.$('button=Löschen')).click()
    await (await client.$('button=Wirklich löschen')).click()
    await (await client.$('button[aria-label="Session"]')).click()
    await waitForSceneLocation(client, 'Nicht verfügbarer Ort')
    await (
      await client.$('select[aria-label="Scene-Ort"]')
    ).selectByVisibleText('Salzmarschhafen')

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
    await clickWhenInteractable(await client.$('button=Neue Encounter-Tabelle'))
    const tableDialog = await client.$('section.encounter-table-manager')
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

    await (await client.$('button=Party')).click()
    for (let active = 1; active <= 2; active += 1) {
      const addButtons = await client.$$('button=Zur Party')
      await addButtons[0]?.click()
      await client.waitUntil(
        async () => (await client.$$('button=Aus Party').length) === active,
        {
          timeout: 5_000,
          timeoutMsg: `Party membership ${active} was not published.`
        }
      )
    }
    await (await client.$('button[aria-label="Party-Panel schließen"]')).click()

    const partyCard = await client.$('article.scene-party-card')
    await client.waitUntil(
      async () => (await partyCard.$$('.group-members span').length) === 2,
      {
        timeout: 5_000,
        timeoutMsg: 'New party members were not assigned to the focused scene.'
      }
    )
    await (await partyCard.$('button=Bearbeiten')).click()
    const scenePartyDialog = await client.$(
      'section[aria-labelledby="scene-party-dialog-title"]'
    )
    await expect(
      await scenePartyDialog.$$('button=Entfernen')
    ).toBeElementsArrayOfSize(2)
    await expect(
      await scenePartyDialog.$$('button=Zur Scene')
    ).toBeElementsArrayOfSize(0)
    await (await scenePartyDialog.$('button=Schließen')).click()
    await expect(
      await partyCard.$$('.group-members span')
    ).toBeElementsArrayOfSize(2)

    await (await client.$('button[aria-label="Katalog"]')).click()
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
    await client.keys(['Escape'])
    await expect(await client.$('button=+ Encounter')).not.toBeExisting()
    await expectAccessibleInBothThemes(client)

    await (await client.$('button[aria-label="Session"]')).click()
    const groupsHeading = await client.$('.groups-heading')
    await expect(await groupsHeading.$('button=Neue Gruppe')).not.toBeExisting()
    await (await client.$('button=Gruppen managen')).click()
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
    const dialogSearch = await groupDialog.$(
      'input[aria-label="Monster suchen"]'
    )
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
    await expect(await client.$('strong=Wolf Pack')).toBeExisting()
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
      await reopenedPronePreview.$('button[aria-label="Prone anheften"]')
    ).click()
    const pinnedProne = await client.$(
      'section[aria-label="Angeheftete Referenz: Prone"]'
    )
    await pinnedProne.waitForExist({ timeout: 5_000 })
    const movePinned = await pinnedProne.$(
      'button[aria-label="Prone verschieben"]'
    )
    await movePinned.click()
    await client.keys(['SHIFT', 'ARROWRIGHT'])
    await (await pinnedProne.$('button[aria-label="Prone schließen"]')).click()

    await proneReference.click()
    let referenceDocument = await client.$('.reference-document')
    await expect(await referenceDocument.$('h2=Prone')).toBeExisting()
    await (await groupNote.$('button=Stunned')).click()
    referenceDocument = await client.$('.reference-document')
    await expect(await referenceDocument.$('h2=Stunned')).toBeExisting()
    await (await client.$('button[aria-label="Zurück"]')).click()
    referenceDocument = await client.$('.reference-document')
    await expect(await referenceDocument.$('h2=Prone')).toBeExisting()
    await (await client.$('button[aria-label="Vor"]')).click()
    referenceDocument = await client.$('.reference-document')
    await expect(await referenceDocument.$('h2=Stunned')).toBeExisting()

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
    await client.execute(() => {
      for (const close of document.querySelectorAll<HTMLButtonElement>(
        '.reference-pinned-window button[aria-label$=" schließen"]'
      ))
        close.click()
    })
    await (
      await client.$('.reference-pinned-window')
    ).waitForExist({
      reverse: true,
      timeout: 5_000
    })

    await (await client.$('button=Gruppen managen')).click()
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
    await expect(await client.$('strong=Gruppe 1')).toBeExisting()

    await (
      await client.$('select[aria-label="Szenario Auswahl"]')
    ).selectByAttribute('value', 'encounter')
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
  })

  it('survives the pseudo locale without accessibility regressions', async () => {
    const client = browser as unknown as WdioBrowser
    const url = new URL(await client.getUrl())
    url.searchParams.set('locale', 'pseudo')
    await client.url(url.href)
    await (await client.$('.eyebrow*=⟦')).waitForExist()
    await expectAccessible(client)
  })
})

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

async function openCampaignDialog(client: WdioBrowser): Promise<void> {
  await (await client.$('button[aria-label="Menü"]')).click()
  const menu = await client.$('#campaign-menu')
  await (await menu.$('button=Kampagnen')).click()
  await (await client.$('#campaign-name')).waitForDisplayed({ timeout: 5_000 })
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
      (await (
        await client.$('select[aria-label="Scene-Ort"] option:checked')
      ).getText()) === expected,
    {
      timeout: 5_000,
      timeoutMsg: `Scene location did not become ${expected}.`
    }
  )
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
  await expectElementGolden(client, name, 'aside[aria-label="Szenario Panel"]')
}

async function expectGroupManagementGolden(client: WdioBrowser): Promise<void> {
  await expectElementGolden(
    client,
    'group-management',
    'section[aria-labelledby="group-builder-title"]'
  )
}
