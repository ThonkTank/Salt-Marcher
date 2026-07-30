import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'

describe('campaign restart', () => {
  it('resumes Campaign A after an Electron process restart and accepts a mutation', async () => {
    const client = browser as unknown as WdioBrowser
    const field = await client.$('#campaign-name')
    await client.waitUntil(() => field.isExisting(), {
      timeout: 5_000,
      timeoutMsg: 'Campaign input was not rendered after restart.'
    })
    await expect(await client.$('button=Campaign A (active)')).toBeExisting()

    await field.setValue('Campaign C')
    await (await client.$('button=Create campaign')).click()
    await expect(await client.$('button=Campaign C (active)')).toBeExisting()
  })
})
