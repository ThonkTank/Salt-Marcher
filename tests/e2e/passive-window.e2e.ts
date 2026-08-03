import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import {
  coreOperations,
  mainOperations
} from '../../src/shared/contracts/operations.js'

describe('passive display isolation', () => {
  it('never renders a GM sentinel and exposes only the empty projection', async () => {
    const client = browser as unknown as WdioBrowser
    await client.waitUntil(
      async () => (await client.getWindowHandles()).length === 2
    )
    const handles = await client.getWindowHandles()
    let gm = ''
    let passive = ''
    for (const handle of handles) {
      await client.switchToWindow(handle)
      const title = await client.getTitle()
      if (title.toLocaleLowerCase().includes('passive')) passive = handle
      else gm = handle
    }
    expect(gm).not.toBe('')
    expect(passive).not.toBe('')
    await client.switchToWindow(gm)
    const input = await client.$('#campaign-name')
    await input.waitForExist()
    await input.setValue('GM-SENTINEL-DO-NOT-LEAK')
    await (await client.$('button=Kampagne erstellen')).click()
    await expect(await client.$('h1=Session')).toBeExisting()

    await client.switchToWindow(passive)
    await expect(await client.$('h1=Passive Anzeige')).toBeExisting()
    expect(
      (await (await client.$('body')).getText()).includes(
        'GM-SENTINEL-DO-NOT-LEAK'
      )
    ).toBe(false)
    await client.waitUntil(
      async () =>
        (await (await client.$('.status')).getText()).includes(
          'Keine Datenfreigabe aktiv'
        ),
      {
        timeout: 5_000,
        timeoutMsg: 'Passive projection did not settle to its safe empty state.'
      }
    )

    const probe = await client.execute(async () => {
      const api = (
        window as unknown as {
          saltMarcherPassive: {
            __e2eProbePrivilegedChannels?: () => Promise<
              Record<string, boolean>
            >
          }
        }
      ).saltMarcherPassive as {
        __e2eProbePrivilegedChannels?: () => Promise<Record<string, boolean>>
      }
      return api.__e2eProbePrivilegedChannels?.()
    })
    const expectedChannels = [
      ...Object.values(coreOperations),
      ...Object.values(mainOperations)
    ]
      .filter(
        (definition) =>
          definition.channel !== null &&
          definition.roles.includes('gm') &&
          !definition.roles.includes('passive')
      )
      .map((definition) => definition.channel!)
      .sort()
    expect(Object.keys(probe ?? {}).sort()).toEqual(expectedChannels)
    expect(Object.values(probe ?? {}).every(Boolean)).toBe(true)
    expect(JSON.stringify(probe)).not.toContain('GM-SENTINEL-DO-NOT-LEAK')
  })
})
