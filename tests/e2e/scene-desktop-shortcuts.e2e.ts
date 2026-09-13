import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { resumeCampaignFromScreen } from './support/campaign-navigation.js'
import { expectAccessibleInBothThemes } from './support/e2e-assertions.js'
import { waitSaved, selectScene } from './support/scene-desktop-scenarios.js'

describe('per-scene desktop', () => {
  it('opens quickinfos with Alt+P from the catalog and releases repeated map windows', async () => {
    const client = browser as unknown as WdioBrowser
    await resumeCampaignFromScreen(client)
    await selectScene(client, 'Hafen')
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
})
