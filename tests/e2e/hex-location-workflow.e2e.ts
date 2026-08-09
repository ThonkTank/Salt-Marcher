import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import {
  clickWhenInteractable,
  expectEditorFrameGeometry,
  expectAccessible,
  expectElementGolden,
  setElectronWindowSize,
  setWindowToMinimumResponsiveSize
} from './support/e2e-assertions.js'

describe('Hex World Location creation workflow', () => {
  it('creates, selects and safely auto-places complete World Locations', async () => {
    const client = browser as unknown as WdioBrowser
    const campaignName = await client.$('#campaign-name')
    await campaignName.waitForDisplayed({ timeout: 30_000 })
    await campaignName.setValue('Hex Location Workflow')
    await (await client.$('button=Anlegen')).click()
    await (await client.$('button[aria-label="Hex-Editor"]')).click()
    await (await client.$('button=Neu')).click()
    const createMap = await client.$(
      '[role="dialog"][aria-label="Hexkarte erstellen"]'
    )
    await (
      await createMap.$('input[aria-label="Kartenname"]')
    ).setValue('Workflow-Karte')
    await (await createMap.$('button=Erstellen')).click()

    const canvas = await client.$('.hex-editor-map canvas')
    await canvas.waitForExist({ timeout: 5_000 })
    await canvas.click()
    await client.waitUntil(
      () =>
        client.execute(async () => {
          const catalog = await window.saltMarcher.hex.catalog()
          return (catalog.maps[0]?.contentRevision ?? 0) >= 1
        }),
      { timeout: 5_000, timeoutMsg: 'Authored Hex was not persisted.' }
    )

    await (await client.$('button=Ort platzieren')).click()
    await createLocation(client, 'Leuchtturmklippe', true)
    await expectLocationState(client, 'Leuchtturmklippe', true)

    await verifySmallViewportKeyboardJourney(client)

    await createLocation(client, 'Zweiter Ort', false)
    await expectLocationState(client, 'Zweiter Ort', false)
    await expectLocationState(client, 'Leuchtturmklippe', true, false)
    await selectLocation(client, 'Leuchtturmklippe')
    await expect(
      await client.$('input[role="combobox"][aria-label="Katalog-Orte"]')
    ).toHaveValue('Leuchtturmklippe')

    await verifyCatalogPlacementJourneys(client)
  })
})

async function createLocation(
  client: WdioBrowser,
  name: string,
  complete: boolean
) {
  await (await client.$('button=Ort erstellen')).click()
  let dialog = await client.$('[role="dialog"][aria-label="Ort erstellen"]')
  await dialog.waitForExist()
  await (await dialog.$('input[aria-label="Ortsname"]')).setValue(name)
  await (
    await dialog.$('input[aria-label="Tags"]')
  ).setValue(complete ? 'Leuchtturm' : 'Küste')
  await client.keys(['Enter'])
  if (complete) {
    await (
      await dialog.$('textarea[aria-label="GM-Notizen"]')
    ).setValue('Zeichen an der Küste.')
    await client.execute(() => {
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur()
    })
    const compactCanvas = await dialog.$('.location-map-section canvas')
    await compactCanvas.waitForExist({ timeout: 5_000 })
    await expectElementGolden(
      client,
      'world-location-placement-compact',
      '.location-map-section'
    )
    await (await dialog.$('button*=Große Karte')).click()
    const expanded = await client.$(
      '[role="dialog"][aria-label="Ort auf Hex-Karte platzieren"]'
    )
    await expanded.waitForExist()
    expect(await client.$$('canvas')).toBeElementsArrayOfSize(1)
    await expectElementGolden(
      client,
      'world-location-placement-expanded',
      '.location-expanded-map-dialog'
    )
    await (await expanded.$('button=Abbrechen')).click()
    await expanded.waitForExist({ reverse: true })
    await (await dialog.$('button*=Große Karte')).click()
    const reapplied = await client.$('.location-expanded-map-dialog')
    await reapplied.waitForExist()
    await (await reapplied.$('button=Auswahl übernehmen')).click()
    await reapplied.waitForExist({ reverse: true })
    await expectElementGolden(
      client,
      'world-location-dialog',
      'section.location-dialog'
    )
    await createAndLinkRelatedRecords(client)
    dialog = await client.$('[role="dialog"][aria-label="Ort erstellen"]')
  }
  await expectAccessible(client)
  const create = await dialog.$('button=Erstellen')
  await client.waitUntil(() => create.isEnabled(), {
    timeout: 5_000,
    timeoutMsg: 'Location references did not become ready.'
  })
  await create.click()
  await dialog.waitForExist({ reverse: true })
}

async function createAndLinkRelatedRecords(client: WdioBrowser) {
  let locationDialog = await client.$(
    '[role="dialog"][aria-label="Ort erstellen"]'
  )
  await (await locationDialog.$('button=Neue Fraktion')).click()
  const faction = await client.$(
    '[role="dialog"][aria-label="Fraktion erstellen"]'
  )
  await (
    await faction.$('input[aria-label="Fraktionsname"]')
  ).setValue('Küstenbund')
  await (
    await faction.$('textarea[aria-label="Fraktionsnotizen"]')
  ).setValue('Bewacht den unveränderten Ortsentwurf.')
  await expectElementGolden(
    client,
    'stacked-location-faction-dialogs',
    '.modal-backdrop[data-modal-bottom="true"]'
  )
  await (await faction.$('button.faction-table-card')).click()
  await clickWhenInteractable(await client.$('button=Neue Encounter-Tabelle'))
  const factionTable = await client.$('section.encounter-table-manager')
  await (
    await factionTable.$('input[aria-label="Tabellenname"]')
  ).setValue('Bundpatrouille')
  await (
    await factionTable.$('input[aria-label="Monster suchen"]')
  ).setValue('wolf')
  const addFactionWolf = await factionTable.$(
    'button[aria-label="Wolf hinzufügen"]'
  )
  await addFactionWolf.waitForExist({ timeout: 5_000 })
  await addFactionWolf.click()
  await (await factionTable.$('button=Erstellen und verknüpfen')).click()
  await factionTable.waitForExist({ reverse: true })
  await expect(
    await faction.$('input[aria-label="Fraktionsname"]')
  ).toHaveValue('Küstenbund')
  await expect(
    await faction.$('textarea[aria-label="Fraktionsnotizen"]')
  ).toHaveValue('Bewacht den unveränderten Ortsentwurf.')
  await expect(await faction.$('button.faction-table-card strong')).toHaveText(
    'Bundpatrouille'
  )
  await (await faction.$('button=Erstellen und verknüpfen')).click()
  await faction.waitForExist({ reverse: true })
  locationDialog = await client.$('[role="dialog"][aria-label="Ort erstellen"]')
  await locationDialog.waitForExist({ timeout: 5_000 })
  await expect(
    await locationDialog.$('button[aria-label="Küstenbund entfernen"]')
  ).toBeExisting()

  await (await locationDialog.$('button=Neue Tabelle')).click()
  const table = await client.$('section.encounter-table-manager')
  await (
    await table.$('input[aria-label="Tabellenname"]')
  ).setValue('Küstenwache')
  await (
    await table.$('select[aria-label="Geltung der Encounter-Tabelle"]')
  ).selectByAttribute('value', 'installation')
  await (await table.$('input[aria-label="Monster suchen"]')).setValue('wolf')
  const addWolf = await table.$('button[aria-label="Wolf hinzufügen"]')
  await addWolf.waitForExist({ timeout: 5_000 })
  await addWolf.click()
  await (await table.$('button=Erstellen und verknüpfen')).click()
  await table.waitForExist({ reverse: true })
  locationDialog = await client.$('[role="dialog"][aria-label="Ort erstellen"]')
  await locationDialog.waitForExist({ timeout: 5_000 })
  await expect(
    await locationDialog.$('button[aria-label="Küstenwache entfernen"]')
  ).toBeExisting()
  expect(
    await client.execute(async () => {
      const snapshot = await window.saltMarcher.encounterTables.read()
      return [
        ...snapshot.installation.tables,
        ...snapshot.campaign.tables
      ].find((entry) => entry.displayName === 'Küstenwache')?.scope
    })
  ).toBe('installation')

  await (await locationDialog.$('button=Neue Karte')).click()
  const map = await client.$('[role="dialog"][aria-label="Hexkarte erstellen"]')
  await (await map.$('input[aria-label="Kartenname"]')).setValue('Nebenkarte')
  await (await map.$('button=Erstellen und verknüpfen')).click()
  await map.waitForExist({ reverse: true })
  locationDialog = await client.$('[role="dialog"][aria-label="Ort erstellen"]')
  await locationDialog.waitForExist({ timeout: 5_000 })

  await expect(
    await locationDialog.$('input[aria-label="Ortsname"]')
  ).toHaveValue('Leuchtturmklippe')
  await expect(
    await locationDialog.$('textarea[aria-label="GM-Notizen"]')
  ).toHaveValue('Zeichen an der Küste.')
}

async function verifyCatalogPlacementJourneys(client: WdioBrowser) {
  await (await client.$('button[aria-label="Katalog"]')).click()
  await (await client.$('button=Orte')).click()
  await (await client.$('button=Leuchtturmklippe')).click()

  await (await client.$('button=Platzieren / verschieben')).click()
  let placementDialog = await client.$(
    '[role="dialog"][aria-label="Ort auf Hex-Karte platzieren"]'
  )
  await placementDialog.waitForExist()
  await (await placementDialog.$('button=Von Karte entfernen')).click()
  await placementDialog.waitForExist({ reverse: true })
  await waitForNamedLocationPlacement(client, 'Leuchtturmklippe', false)

  await (await client.$('button=Platzieren / verschieben')).click()
  placementDialog = await client.$(
    '[role="dialog"][aria-label="Ort auf Hex-Karte platzieren"]'
  )
  const canvas = await placementDialog.$('canvas')
  await canvas.waitForExist()
  await canvas.click()
  const place = await placementDialog.$('button=Hier platzieren')
  await client.waitUntil(() => place.isEnabled(), {
    timeout: 5_000,
    timeoutMsg: 'Catalog placement selection did not become valid.'
  })
  await place.click()
  await placementDialog.waitForExist({ reverse: true })
  await waitForNamedLocationPlacement(client, 'Leuchtturmklippe', true)

  const filters = await client.$('.catalog-filters')
  await (await filters.$('button=Erstellen')).click()
  const editor = await client.$('[role="dialog"][aria-label="Ort erstellen"]')
  await editor.waitForExist()
  await (
    await editor.$('input[aria-label="Ortsname"]')
  ).setValue('Teilerfolg-Kap')
  const tags = await editor.$('input[aria-label="Tags"]')
  await tags.setValue('Küste')
  await client.keys(['Enter'])
  const occupiedCanvas = await editor.$('.location-map-section canvas')
  await occupiedCanvas.waitForExist()
  await occupiedCanvas.click()
  await (await editor.$('button=Erstellen')).click()
  const retry = await editor.$('button=Erneut versuchen')
  await retry.waitForExist({ timeout: 5_000 })
  const revisionAfterBaseSave = await client.execute(async () => {
    const world = await window.saltMarcher.locations.read()
    if (
      world.locations.filter(
        (location) => location.displayName === 'Teilerfolg-Kap'
      ).length !== 1
    )
      throw new Error('Partially saved location missing or duplicated.')
    return world.revision
  })
  await client.execute(async () => {
    const api = window.saltMarcher
    const world = await api.locations.read()
    const blocker = world.locations.find(
      (location) => location.displayName === 'Leuchtturmklippe'
    )
    if (!blocker) throw new Error('Placement blocker missing.')
    const existing = await api.hex.locateLocation(blocker.id)
    if (!existing) throw new Error('Placement blocker is not on the map.')
    await api.locations.commitPlacement({
      commandId: crypto.randomUUID(),
      locationId: blocker.id,
      placement: { kind: 'remove' }
    })
  })
  await retry.click()
  await editor.waitForExist({ reverse: true })
  await waitForNamedLocationPlacement(client, 'Teilerfolg-Kap', true)
  const revisionAfterRetry = await client.execute(
    async () => (await window.saltMarcher.locations.read()).revision
  )
  expect(revisionAfterRetry).toBe(revisionAfterBaseSave)
  await expect(
    await client.$(
      'aside[aria-label="Ort Details"] h2[aria-label="Teilerfolg-Kap"]'
    )
  ).toBeExisting()
}

async function waitForNamedLocationPlacement(
  client: WdioBrowser,
  displayName: string,
  expected: boolean
) {
  await client.waitUntil(
    () =>
      client.execute(
        async (name, shouldExist) => {
          const api = window.saltMarcher
          const world = await api.locations.read()
          const location = world.locations.find(
            (entry) => entry.displayName === name
          )
          if (!location) return false
          return (
            ((await api.hex.locateLocation(location.id)) !== null) ===
            shouldExist
          )
        },
        displayName,
        expected
      ),
    {
      timeout: 5_000,
      timeoutMsg: `${displayName} placement did not become ${String(expected)}.`
    }
  )
}

async function verifySmallViewportKeyboardJourney(client: WdioBrowser) {
  const original = await client.execute(() => ({
    width: window.innerWidth,
    height: window.innerHeight
  }))
  await setWindowToMinimumResponsiveSize(client)
  try {
    await (await client.$('button=Ort erstellen')).click()
    const dialog = await client.$('[role="dialog"][aria-label="Ort erstellen"]')
    await dialog.waitForExist()
    const name = await dialog.$('input[aria-label="Ortsname"]')
    await name.click()
    await client.keys('Tastaturkap')
    await client.keys(['Tab'])
    const tags = await dialog.$('input[aria-label="Tags"]')
    await expect(tags).toBeFocused()
    await client.keys('Küste')
    await client.keys(['Home', 'End', 'Enter'])
    const geometry = await client.execute(() => {
      const element = document.querySelector<HTMLElement>('.location-dialog')!
      const bounds = element.getBoundingClientRect()
      const body = element.querySelector<HTMLElement>('.location-dialog-body')!
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        bodyScrollable: body.scrollHeight >= body.clientHeight
      }
    })
    expect(geometry.left).toBeGreaterThanOrEqual(0)
    expect(geometry.top).toBeGreaterThanOrEqual(0)
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth)
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight)
    expect(geometry.bodyScrollable).toBe(true)
    await expectEditorFrameGeometry(client, '.location-dialog')
    await expectAccessible(client)
    await client.keys(['Escape'])
    const discard = await client.$('[role="alertdialog"]')
    await discard.waitForExist()
    await (await discard.$('button=Änderungen verwerfen')).click()
  } finally {
    await setElectronWindowSize(client, original.width, original.height)
  }
}

async function expectLocationState(
  client: WdioBrowser,
  name: string,
  placed: boolean,
  selected = true
) {
  const selector = await client.$(
    'input[role="combobox"][aria-label="Katalog-Orte"]'
  )
  if (selected) await expect(selector).toHaveValue(name)
  await selector.setValue(name)
  const option = await client.$(`[role="option"]*=${name}`)
  await option.waitForExist()
  await expect(option).toHaveAttribute('aria-selected', String(selected))
  await client.keys(['Escape'])
  await client.waitUntil(
    () =>
      client.execute(
        async (displayName, expectedPlaced) => {
          const world = await window.saltMarcher.locations.read()
          const location = world.locations.find(
            (entry) => entry.displayName === displayName
          )
          if (!location) return false
          const placement = await window.saltMarcher.hex.locateLocation(
            location.id
          )
          return (placement !== null) === expectedPlaced
        },
        name,
        placed
      ),
    {
      timeout: 5_000,
      timeoutMsg: `${name} placement did not become ${String(placed)}.`
    }
  )
}

async function selectLocation(client: WdioBrowser, name: string) {
  const selector = await client.$(
    'input[role="combobox"][aria-label="Katalog-Orte"]'
  )
  await selector.setValue(name)
  const option = await client.$(`[role="option"]*=${name}`)
  await option.waitForDisplayed()
  await option.click()
}
