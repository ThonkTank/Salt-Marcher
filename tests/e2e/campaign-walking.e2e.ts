import { $, browser, expect } from '@wdio/globals'

describe('campaign walking skeleton', () => {
  it('creates, switches, and reopens the selected campaign', async () => {
    await (
      browser as unknown as { pause(milliseconds: number): Promise<void> }
    ).pause(1_000)
    const field = await $('#campaign-name')
    if (!(await field.isExisting())) {
      const page = await (
        browser as unknown as { getPageSource(): Promise<string> }
      ).getPageSource()
      const logs = await (
        browser as unknown as {
          getLogs(type: 'browser'): Promise<unknown>
        }
      ).getLogs('browser')
      throw new Error(
        `Campaign input was not rendered: ${page.slice(0, 1_500)}; logs: ${JSON.stringify(logs)}`
      )
    }
    await field.setValue('Campaign A')
    await $('button=Create campaign').click()
    await expect($('button=Campaign A (active)')).toBeExisting()

    await field.setValue('Campaign B')
    await $('button=Create campaign').click()
    await expect($('button=Campaign B (active)')).toBeExisting()

    await $('button=Campaign A').click()
    await expect($('button=Campaign A (active)')).toBeExisting()

    await (
      browser as unknown as { reloadSession(): Promise<void> }
    ).reloadSession()
    await expect($('button=Campaign A (active)')).toBeExisting()
    await expect($('button=Campaign B')).toBeExisting()
  })
})
