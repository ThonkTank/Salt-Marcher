import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'

describe('session generation capability', () => {
  it('runs the bundled encounter-intent generator through the utility process', async () => {
    const client = browser as unknown as WdioBrowser
    await (
      await client.$('#campaign-name')
    ).waitForDisplayed({ timeout: 30_000 })
    const result = await client.execute(async () =>
      window.saltMarcher.sessionGeneration.generateEncounterIntents({
        party: [
          { level: 3, count: 2 },
          { level: 4, count: 2 }
        ],
        adventureDayFraction: '0.6',
        encounterCount: 3,
        seed: 179974
      })
    )
    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    expect(result.engineVersion).toBe('saltmarcher-v2')
    expect(result.encounters.map((encounter) => encounter.targetXp)).toEqual([
      680, 1000, 1800
    ])
  })
})
