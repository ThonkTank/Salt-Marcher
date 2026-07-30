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
    await expect(await client.$('button=Campaign A (active)')).toBeExisting()

    await field.setValue('Campaign B')
    await (await client.$('button=Create campaign')).click()
    await expect(await client.$('button=Campaign B (active)')).toBeExisting()

    await (await client.$('button=Campaign A')).click()
    await expect(await client.$('button=Campaign A (active)')).toBeExisting()
    await expect(await client.$('button=Campaign B')).toBeExisting()
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
