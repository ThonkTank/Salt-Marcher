import { browser, expect } from '@wdio/globals'
import { AxeBuilder } from '@axe-core/webdriverio'
import type { Browser as WdioBrowser } from 'webdriverio'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

describe('campaign walking skeleton', () => {
  it('creates and switches the selected campaign', async () => {
    const client = browser as unknown as WdioBrowser
    const field = await client.$('#campaign-name')
    await waitForCampaignInput(client, field)
    await expectAccessibleInBothThemes(client)
    await field.setValue('Campaign A')
    await (await client.$('button=Kampagne erstellen')).click()
    await expect(await client.$('h1=Session · Campaign A')).toBeExisting()
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
    await client.pause(400)

    await (await client.$('button[aria-label="Menü"]')).click()
    const nextField = await client.$('#campaign-name')
    await nextField.setValue('Campaign B')
    await (await client.$('button=Kampagne erstellen')).click()
    await expect(await client.$('h1=Session · Campaign B')).toBeExisting()

    await (await client.$('button[aria-label="Menü"]')).click()
    await (await client.$('button[aria-label="Campaign A"]')).click()
    await expect(await client.$('h1=Session · Campaign A')).toBeExisting()

    await (await client.$('button[aria-label="Menü"]')).click()
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
    await (await client.$('button[aria-label="Hex-Editor"]')).click()
    await (
      await client.$('input[aria-label="Neue Karte"]')
    ).setValue('Salzmarsch-Küste')
    await (await client.$('button=Neu')).click()
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
    await expectAccessibleInBothThemes(client)
    await client.execute(() => {
      document.documentElement.style.zoom = '2'
    })
    await expectAccessible(client)
    await client.execute(() => {
      document.documentElement.style.zoom = ''
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
    const editLocation = await client.$('form[aria-label="Ort bearbeiten"]')
    await (
      await editLocation.$('input[aria-label="Ortsname"]')
    ).setValue('Salzmarschhafen')
    await (
      await editLocation.$('textarea[aria-label="Ortsnotizen"]')
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
      'form[aria-label="Fraktion erstellen"]'
    )
    await (
      await factionDialog.$('input[aria-label="Fraktionsname"]')
    ).setValue('Hafenwache')
    await (await factionDialog.$('button=Neue Encounter-Tabelle')).click()
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
      draftWidth: 424,
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
    await (await tableDialog.$('button=Erstellen')).click()
    await expect(
      await factionDialog.$('input[aria-label="Fraktionsname"]')
    ).toHaveValue('Hafenwache')
    await expect(
      await factionDialog.$(
        'select[aria-label="Primäre Encounter-Tabelle"] option:checked'
      )
    ).toHaveText('Wachpatrouille')
    await (
      await factionDialog.$('input[aria-label="Maximum Wolf"]')
    ).setValue('2')
    await (await factionDialog.$('button=Erstellen')).click()
    await expect(await client.$('button=Hafenwache')).toBeExisting()
    await (await client.$('button=Encounter-Tabellen')).click()
    await (await client.$('button=Wachpatrouille')).click()
    const reopenedTable = await client.$('section.encounter-table-manager')
    await expect(
      await reopenedTable.$(
        'select[aria-label="Encounter-Tabelle auswählen"] option:checked'
      )
    ).toHaveText('Wachpatrouille')
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
    await expect(await client.$('strong=Wolf Pack')).toBeExisting()
    await expect(await client.$('.group-note')).toHaveText(
      'Lauert Prone in den Dünen; Stunned bei Alarm.'
    )

    const groupNote = await client.$('.group-note')
    const proneReference = await groupNote.$('button=Prone')
    const pronePreview = await client.$(
      'section[role="region"][aria-label="Referenz: Prone"]'
    )
    await client.waitUntil(
      async () => {
        await proneReference.moveTo()
        await client.pause(400)
        return pronePreview.isExisting()
      },
      { timeout: 5_000, timeoutMsg: 'Prone reference preview did not open.' }
    )
    const nestedMovement = await pronePreview.$('button=movement')
    await nestedMovement.moveTo()
    await client.pause(400)
    await expect(
      await client.$('section[role="region"][aria-label="Referenz: movement"]')
    ).toBeExisting()
    await (await pronePreview.$('button[aria-label="Prone anheften"]')).click()
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
    await emptyGroupName.setValue('Leere Patrouille')
    await reopenedSelection.selectByVisibleText('Wolf Pack')
    await reopenedSelection.selectByVisibleText('Neue Gruppe')
    await expect(emptyGroupName).toHaveValue('Leere Patrouille')
    await (await reopenedGroupDialog.$('button=Speichern')).click()
    await expect(await client.$('strong=Leere Patrouille')).toBeExisting()

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

async function expectAccessible(client: WdioBrowser): Promise<void> {
  const accessibility = await new AxeBuilder({ client })
    .setLegacyMode()
    .analyze()
  expect(accessibility.violations).toHaveLength(0)
}

async function expectAccessibleInBothThemes(
  client: WdioBrowser
): Promise<void> {
  await expectAccessible(client)
  await client.execute(() => {
    document.querySelector<HTMLButtonElement>('.theme-toggle')?.click()
  })
  try {
    await expectAccessible(client)
  } finally {
    await client.execute(() => {
      document.querySelector<HTMLButtonElement>('.theme-toggle')?.click()
    })
  }
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

async function createLocation(
  client: WdioBrowser,
  name: string,
  notes: string
): Promise<void> {
  await (await client.$('button[aria-label="Katalog"]')).click()
  await (await client.$('button=Orte')).click()
  await (await client.$('button=Erstellen')).click()
  const dialog = await client.$('form[aria-label="Ort erstellen"]')
  await (await dialog.$('input[aria-label="Ortsname"]')).setValue(name)
  await (await dialog.$('textarea[aria-label="Ortsnotizen"]')).setValue(notes)
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

async function expectElementGolden(
  client: WdioBrowser,
  name: string,
  selector: string
): Promise<void> {
  if (process.platform !== 'linux') return
  await client.execute(() => {
    const style = document.createElement('style')
    style.dataset['visualTest'] = 'true'
    style.textContent =
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'
    document.head.append(style)
  })
  const directory = join(process.cwd(), 'tests', 'e2e', 'goldens', 'linux')
  const artifacts = join(process.cwd(), '.tmp', 'visual-diffs')
  mkdirSync(directory, { recursive: true })
  mkdirSync(artifacts, { recursive: true })
  const actualPath = join(artifacts, `${name}.png`)
  const baselinePath = join(directory, `${name}.png`)
  const bytes = await (await client.$(selector)).saveScreenshot(actualPath)
  if (process.env['UPDATE_VISUAL_GOLDENS'] === '1') {
    writeFileSync(baselinePath, bytes)
    return
  }
  if (!existsSync(baselinePath))
    throw new Error(`Missing golden ${baselinePath}`)
  const expected = PNG.sync.read(readFileSync(baselinePath))
  const actual = PNG.sync.read(bytes)
  expect({ width: actual.width, height: actual.height }).toEqual({
    width: expected.width,
    height: expected.height
  })
  const diff = new PNG({ width: actual.width, height: actual.height })
  const changed = pixelmatch(
    expected.data,
    actual.data,
    diff.data,
    actual.width,
    actual.height,
    { threshold: 0.2 }
  )
  writeFileSync(join(artifacts, `${name}.diff.png`), PNG.sync.write(diff))
  expect(changed / (actual.width * actual.height)).toBeLessThanOrEqual(0.03)
}
