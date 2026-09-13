import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { openSceneWindow } from './support/scene-desktop-navigation.js'
import { resumeCampaignFromScreen } from './support/campaign-navigation.js'
import { expectAccessibleInBothThemes } from './support/e2e-assertions.js'
import { waitSaved, selectScene } from './support/scene-desktop-scenarios.js'

describe('per-scene desktop', () => {
  it('shows party details and accepts a group drop without preparing initiative', async () => {
    const client = browser as unknown as WdioBrowser
    await resumeCampaignFromScreen(client)
    await selectScene(client, 'Hafen')
    const party = await openSceneWindow(client, 'party')
    await party.$('.desktop-party-toggle').click()
    await expect(party.$('.desktop-party-details')).toHaveText(
      expect.stringContaining('ft.')
    )
    await party.$('button[aria-label="Party-Aktionen"]').click()
    await client.$('.party-action-menu').$('button=Schnellwerte').click()
    await expect(client.$('.desktop-party-popup')).toBeDisplayed()
    await client.$('.desktop-party-popup').$('button=Fertig').click()
    await client.keys('Escape')
    const combat = await openSceneWindow(client, 'combat')
    const groups = await openSceneWindow(client, 'groups')
    await groups.$('.desktop-group-grip').click()
    await client.keys('Enter')
    await expect(combat.$('.desktop-drop-ready')).toBeExisting()
    await client.execute(() =>
      document.querySelector<HTMLElement>('.desktop-combat')!.focus()
    )
    await client.keys('Enter')
    await waitSaved(client)
    await expect(
      combat.$('.encounter-group-choice input:checked')
    ).toBeExisting()
    await expect(combat.$('.combat-setup')).toBeExisting()
    await combat.$('.encounter-group-choice input:checked').click()
    await openSceneWindow(client, 'groups')
    await groups.$('summary').click()
    await groups.$('button=Linke Hälfte').click()
    await openSceneWindow(client, 'combat')
    await combat.$('summary').click()
    await combat.$('button=Rechte Hälfte').click()
    await groups
      .$('.desktop-group-grip')
      .dragAndDrop(combat.$('.desktop-combat'), { duration: 500 })
    await expect(
      combat.$('.encounter-group-choice input:checked')
    ).toBeExisting()
    await combat.$('.encounter-group-choice input:checked').click()
    await combat.$('button[aria-label="Fenster schließen"]').click()
    await openSceneWindow(client, 'party')
    await expectAccessibleInBothThemes(client)
    await client.saveScreenshot('/tmp/saltmarcher-party-groups.png')
    for (const kind of ['party', 'groups'] as const) {
      const panel = await openSceneWindow(client, kind)
      await panel.$('summary').click()
      await panel.$('button=Freie Position wiederherstellen').click()
      await panel.$('.desktop-resize-keyboard').click()
      for (let i = 0; i < 14; i++) await client.keys('ArrowLeft')
      for (let i = 0; i < 14; i++) await client.keys('ArrowUp')
      await expect(panel).toHaveAttribute(
        'style',
        expect.stringContaining('width: 240px')
      )
      await expectAccessibleInBothThemes(client)
      if (kind === 'party') {
        const layout = await client.execute(() => {
          const frame = document.querySelector('[data-window-id="party"]')!
          const bounds = frame.getBoundingClientRect()
          const buttons = [
            ...frame.querySelectorAll(
              '.desktop-window-title button, .desktop-window-title summary'
            )
          ]
          const row = frame.querySelector('.desktop-party-row')!
          const name = row
            .querySelector('.desktop-party-toggle')!
            .getBoundingClientRect()
          return {
            controlsInside: buttons.every(
              (button) => button.getBoundingClientRect().right <= bounds.right
            ),
            nameWidth: name.width,
            meterCount: row.querySelectorAll('.party-meter').length
          }
        })
        expect(layout.controlsInside).toBe(true)
        expect(layout.nameWidth).toBeGreaterThan(35)
        expect(layout.meterCount).toBe(2)
      }
      await client.saveScreenshot(`/tmp/saltmarcher-${kind}-minimum.png`)
      await panel.$('.desktop-resize-keyboard').click()
      for (let i = 0; i < 7; i++) await client.keys('ArrowRight')
      for (let i = 0; i < 13; i++) await client.keys('ArrowDown')
    }
    await waitSaved(client)
  })
})
