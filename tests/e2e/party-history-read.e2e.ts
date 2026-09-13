import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { resumeCampaignFromScreen } from './support/campaign-navigation.js'
import { openSceneWindow } from './support/scene-desktop-navigation.js'
import { expectAccessibleInBothThemes } from './support/e2e-assertions.js'

type ElectronBrowser = WdioBrowser & {
  electron: {
    execute: <Result, Arguments extends readonly unknown[]>(
      script: (
        electron: typeof import('electron'),
        ...args: Arguments
      ) => Result,
      ...args: Arguments
    ) => Promise<Result>
  }
}

describe('Party history read errors', () => {
  it('keeps the error reachable at 360/240 px and retries with the keyboard without changing Party data', async () => {
    const client = browser as unknown as ElectronBrowser
    await resumeCampaignFromScreen(client)
    const before = await client.execute(async () => {
      const campaignId = (await window.saltMarcher.campaigns.list())
        .activeCampaignId!
      return {
        campaignId,
        history: await window.saltMarcher.party.history({ campaignId }),
        party: await window.saltMarcher.party.read()
      }
    })
    // This process owns an isolated fixture. Replace only its history read handler;
    // no production injection hook, campaign mutation or original-write replay.
    await client.electron.execute((electron) => {
      electron.ipcMain.removeHandler('party:history')
      electron.ipcMain.handle('party:history', () => ({
        ok: false,
        error: { code: 'core_unavailable', retryable: true }
      }))
    })
    let party = await openSceneWindow(client, 'party')
    await party.$('button[aria-label="Fenster schließen"]').click()
    party = await openSceneWindow(client, 'party')
    const alert = () => party.$('.desktop-party-history-error')
    await alert().waitForDisplayed()
    await expect(alert()).toHaveText(
      expect.stringContaining('Verlauf konnte nicht geladen werden.')
    )
    await expect(
      party.$('button[aria-label="Party-Aktion rückgängig machen"]')
    ).toBeDisabled()
    for (const width of [360, 240]) {
      if (width === 240) {
        await party.$('.desktop-resize-keyboard').click()
        for (let i = 0; i < 6; i++) await client.keys('ArrowLeft')
      }
      await expect(party).toHaveAttribute(
        'style',
        expect.stringContaining(`width: ${width}px`)
      )
      await client.execute(() => {
        document.querySelector(
          '[data-window-id="party"] .desktop-window-content'
        )!.scrollTop = 0
      })
      const geometry = await client.execute(() => {
        const frame = document
          .querySelector('[data-window-id="party"]')!
          .getBoundingClientRect()
        const alert = document.querySelector('.desktop-party-history-error')!
        const button = alert.querySelector('button')!.getBoundingClientRect()
        const area = alert.getBoundingClientRect()
        return {
          buttonInside:
            button.left >= frame.left &&
            button.right <= frame.right &&
            button.top >= frame.top &&
            button.bottom <= frame.bottom,
          alertInside:
            area.left >= frame.left &&
            area.right <= frame.right &&
            area.top >= frame.top &&
            area.bottom <= frame.bottom
        }
      })
      expect(geometry).toEqual({ buttonInside: true, alertInside: true })
      await expectAccessibleInBothThemes(client)
      await client.saveScreenshot(`/tmp/party-history-error-${width}.png`)
    }
    await client.electron.execute((electron, history) => {
      electron.ipcMain.removeHandler('party:history')
      electron.ipcMain.handle('party:history', () => ({
        ok: true,
        payload: history
      }))
    }, before.history)
    await client.execute(() =>
      document
        .querySelector<HTMLButtonElement>(
          '.desktop-party-history-error button'
        )!
        .focus()
    )
    await client.keys('Enter')
    await alert().waitForExist({ reverse: true })
    expect(await client.execute(() => window.saltMarcher.party.read())).toEqual(
      before.party
    )
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    expect(
      await client.execute(
        (campaignId) => window.saltMarcher.party.history({ campaignId }),
        before.campaignId
      )
    ).toEqual(before.history)
  })
})
