import { $, browser, expect } from '@wdio/globals'

describe('campaign walking skeleton', () => {
  it('creates, switches, and reopens the selected campaign', async () => {
    await switchToWritableWindow()
    const field = await $('#campaign-name')
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
    await switchToWritableWindow()
    await expect($('button=Campaign A (active)')).toBeExisting()
    await expect($('button=Campaign B')).toBeExisting()
  })
})

async function switchToWritableWindow(): Promise<void> {
  const windowBrowser = browser as unknown as {
    getWindowHandles(): Promise<string[]>
    switchToWindow(handle: string): Promise<void>
  }
  for (const handle of await windowBrowser.getWindowHandles()) {
    await windowBrowser.switchToWindow(handle)
    if (await $('#campaign-name').isExisting()) return
  }
  throw new Error('The writable campaign window was not opened')
}
