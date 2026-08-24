import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'

describe('Campaign receipt reconciliation', () => {
  it('keeps the dialog and draft mounted across an interrupted committed create', async () => {
    const client = browser as unknown as WdioBrowser
    const field = await client.$('#campaign-name')
    await field.waitForDisplayed({ timeout: 30_000 })
    await field.setValue('Receipt E2E')
    const interruptionArmed = await client.execute(async () => {
      const e2eWindow = window as typeof window & {
        __saltMarcherE2e?: Readonly<{
          interruptCampaignCreate: () => Promise<boolean>
        }>
        __fr2cCampaignDialog?: Element | null
      }
      e2eWindow.__fr2cCampaignDialog = document.querySelector(
        'section.campaign-dialog'
      )
      return (
        (await e2eWindow.__saltMarcherE2e?.interruptCampaignCreate()) ?? false
      )
    })
    expect(interruptionArmed).toBe(true)

    await (await client.$('button=Anlegen')).click()
    await client.waitUntil(async () => (await coreStatus(client)) !== 'ready', {
      timeout: 10_000,
      interval: 100,
      timeoutMsg: 'Campaign create did not interrupt the Utility process.'
    })
    await (
      await client.$(
        'p=Das Ergebnis der letzten Kampagnenaktion wird geprüft. Weitere Aktionen warten.'
      )
    ).waitForExist({ timeout: 10_000 })

    expect(await field.getValue()).toBe('Receipt E2E')
    expect(await field.isEnabled()).toBe(false)
    expect(
      await client.execute(() => {
        const e2eWindow = window as typeof window & {
          __fr2cCampaignDialog?: Element | null
        }
        return (
          e2eWindow.__fr2cCampaignDialog ===
          document.querySelector('section.campaign-dialog')
        )
      })
    ).toBe(true)

    await client.waitUntil(async () => (await coreStatus(client)) === 'ready', {
      timeout: 45_000,
      interval: 250,
      timeoutMsg: 'Utility did not recover after Campaign creation.'
    })
    await (await client.$('button=Ergebnis prüfen')).click()
    await (
      await client.$('h1=Session · Receipt E2E')
    ).waitForExist({ timeout: 15_000 })

    const matchingCampaigns = await client.execute(async () => {
      const snapshot = await window.saltMarcher.campaigns.list()
      return snapshot.campaigns.filter(
        (campaign) => campaign.name === 'Receipt E2E'
      ).length
    })
    expect(matchingCampaigns).toBe(1)
  })
})

async function coreStatus(client: WdioBrowser): Promise<string> {
  try {
    return await client.execute(async () =>
      window.saltMarcher.runtime.coreStatus()
    )
  } catch {
    return 'unreachable'
  }
}
