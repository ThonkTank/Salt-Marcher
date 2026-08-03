import { browser, expect } from '@wdio/globals'
import { AxeBuilder } from '@axe-core/webdriverio'
import type { Browser as WdioBrowser } from 'webdriverio'

describe('campaign walking skeleton', () => {
  it('creates and switches the selected campaign', async () => {
    const client = browser as unknown as WdioBrowser
    const field = await client.$('#campaign-name')
    await waitForCampaignInput(client, field)
    const accessibility = await new AxeBuilder({ client })
      .setLegacyMode()
      .analyze()
    expect(accessibility.violations).toHaveLength(0)
    await field.setValue('Campaign A')
    await (await client.$('button=Create campaign')).click()
    await expect(await client.$('h1=Session')).toBeExisting()
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
    await (await client.$('button=Karte')).click()
    await expect(await client.$('strong=Reiseplanung')).toBeExisting()
    await (await client.$('button=Details')).click()
    await expect(await client.$$('[role="separator"]')).toBeElementsArrayOfSize(
      2
    )
    const columnDivider = await client.$(
      '[aria-label="Gekoppelte Grenze zwischen linker und rechter Spalte"]'
    )
    await pressDividerKey(
      client,
      'Gekoppelte Grenze zwischen linker und rechter Spalte',
      'ArrowLeft'
    )
    await expect(columnDivider).toHaveAttribute('aria-valuenow', '60')
    const rightDivider = await client.$(
      '[aria-label="Grenze zwischen Details und Szenario"]'
    )
    await pressDividerKey(
      client,
      'Grenze zwischen Details und Szenario',
      'ArrowDown'
    )
    await expect(rightDivider).toHaveAttribute('aria-valuenow', '47')
    await client.pause(400)

    await (await client.$('button[aria-label="Campaigns"]')).click()
    const nextField = await client.$('#campaign-name')
    await nextField.setValue('Campaign B')
    await (await client.$('button=Create campaign')).click()
    await expect(await client.$('h1=Session')).toBeExisting()

    await (await client.$('button[aria-label="Campaigns"]')).click()
    await (await client.$('button=Campaign A')).click()
    await expect(await client.$('h1=Session')).toBeExisting()
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
    await expect(await client.$('h2=Salzmarschhafen')).toBeExisting()
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
    const tableDialog = await client.$(
      'section[aria-labelledby="encounter-table-manager-title"]'
    )
    await (
      await tableDialog.$('input[aria-label="Tabellenname"]')
    ).setValue('Wachpatrouille')
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
    const reopenedTable = await client.$(
      'section[aria-labelledby="encounter-table-manager-title"]'
    )
    await expect(
      await reopenedTable.$(
        'select[aria-label="Encounter-Tabelle auswählen"] option:checked'
      )
    ).toHaveText('Wachpatrouille')
    await (
      await reopenedTable.$('button[aria-label="Dialog schließen"]')
    ).click()
    await (await client.$('button[aria-label="Session"]')).click()

    await (await client.$('button=Keine Party')).click()
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

    for (let assigned = 1; assigned <= 2; assigned += 1) {
      const sceneButtons = await client.$$('button=Zur Scene')
      await sceneButtons[0]?.click()
      await client.pause(300)
      const assignmentError = await client.$('.error-message')
      if (await assignmentError.isExisting())
        throw new Error(await assignmentError.getText())
      await client.waitUntil(
        async () => (await client.$$('button=Entfernen').length) === assigned,
        {
          timeout: 5_000,
          timeoutMsg: `Scene assignment ${assigned} was not published.`
        }
      )
    }

    await (await client.$('button[aria-label="Katalog"]')).click()
    const monsterSearch = await client.$('input[aria-label="Monster suchen"]')
    await monsterSearch.setValue('wolf')
    const wolf = await client.$('button=Wolf')
    await client.waitUntil(() => wolf.isExisting(), {
      timeout: 5_000,
      timeoutMsg: 'Filtered Wolf catalog row was not rendered.'
    })
    await expect(await client.$('button=+ Encounter')).not.toBeExisting()

    await (await client.$('button[aria-label="Session"]')).click()
    await (await client.$('button=Gruppen managen')).click()
    await (await client.$('button=Neue Gruppe')).click()
    await (
      await client.$('input[aria-label="Gruppenname"]')
    ).setValue('Wolf Pack')
    const dialogSearch = await client.$('input[aria-label="Monster suchen"]')
    await dialogSearch.setValue('wolf')
    const addWolf = await client.$('button[aria-label="Wolf hinzufügen"]')
    await client.waitUntil(() => addWolf.isExisting(), {
      timeout: 5_000,
      timeoutMsg: 'Wolf add action was not rendered.'
    })
    for (let count = 0; count < 4; count += 1) await addWolf.click()
    await (await client.$('button=Gruppe erstellen')).click()
    await expect(await client.$('strong=Wolf Pack')).toBeExisting()

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
    await expect(await client.$('h2=Initiative')).toBeExisting()
  })
})

async function waitForCampaignInput(
  client: WdioBrowser,
  field: Awaited<ReturnType<WdioBrowser['$']>>
): Promise<void> {
  await client.waitUntil(() => field.isExisting(), {
    timeout: 5_000,
    timeoutMsg: 'Campaign input was not rendered.'
  })
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
  await expect(await client.$(`h2=${name}`)).toBeExisting()
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
