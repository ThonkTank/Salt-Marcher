import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { expectAccessible } from './support/e2e-assertions.js'

describe('Hex World Location creation workflow', () => {
  it('creates, selects and safely auto-places complete World Locations', async () => {
    const client = browser as unknown as WdioBrowser
    const campaignName = await client.$('#campaign-name')
    await campaignName.waitForDisplayed({ timeout: 30_000 })
    await campaignName.setValue('Hex Location Workflow')
    await (await client.$('button=Kampagne erstellen')).click()
    await (await client.$('button[aria-label="Hex-Editor"]')).click()
    await (await client.$('button=Neu')).click()

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

    await createLocation(client, 'Zweiter Ort', false)
    await expectLocationState(client, 'Zweiter Ort', false)
    await expectLocationState(client, 'Leuchtturmklippe', true, false)
  })
})

async function createLocation(
  client: WdioBrowser,
  name: string,
  complete: boolean
) {
  await (await client.$('button=Ort erstellen')).click()
  const dialog = await client.$('[role="dialog"][aria-label="Ort erstellen"]')
  await dialog.waitForExist()
  await (await dialog.$('input[aria-label="Ortsname"]')).setValue(name)
  if (complete) {
    await (await dialog.$('input[aria-label="Ortstyp"]')).setValue('Leuchtturm')
    await (await dialog.$('input[aria-label="Ortsregion"]')).setValue('Küste')
    await (
      await dialog.$('textarea[aria-label="Ortsnotizen"]')
    ).setValue('Zeichen an der Küste.')
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

async function expectLocationState(
  client: WdioBrowser,
  name: string,
  placed: boolean,
  selected = true
) {
  const option = await client.$(`[role="option"]*=${name}`)
  await option.waitForExist()
  await expect(option).toHaveAttribute('aria-selected', String(selected))
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
