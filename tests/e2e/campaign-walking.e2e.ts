import { $, browser, expect } from '@wdio/globals'

describe('campaign walking skeleton', () => {
  it('creates and switches the selected campaign', async () => {
    await (
      browser as unknown as { pause(milliseconds: number): Promise<void> }
    ).pause(1_000)
    const field = await $('#campaign-name')
    await browser.waitUntil(() => field.isExisting(), {
      timeout: 5_000,
      timeoutMsg: 'Campaign input was not rendered.'
    })
    await field.setValue('Campaign A')
    await $('button=Create campaign').click()
    await expect($('button=Campaign A (active)')).toBeExisting()

    await field.setValue('Campaign B')
    await $('button=Create campaign').click()
    await expect($('button=Campaign B (active)')).toBeExisting()

    await $('button=Campaign A').click()
    await expect($('button=Campaign A (active)')).toBeExisting()

    await expect($('button=Campaign B')).toBeExisting()
  })
})
