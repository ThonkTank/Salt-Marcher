import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { openSceneWindow } from './support/scene-desktop-navigation.js'
import { resumeCampaignFromScreen } from './support/campaign-navigation.js'
import {
  expectAccessibleInBothThemes,
  setWindowToMinimumResponsiveSize
} from './support/e2e-assertions.js'
import {
  waitSaved,
  geometry,
  selectScene
} from './support/scene-desktop-scenarios.js'

describe('per-scene desktop', () => {
  it('preserves separate arrangements and intentional closure through navigation and process restart', async () => {
    const client = browser as unknown as WdioBrowser
    await resumeCampaignFromScreen(client)
    await selectScene(client, 'Hafen')
    await openSceneWindow(client, 'party')
    await openSceneWindow(client, 'groups')
    await client.$('.scene-desktop').waitForDisplayed({ timeout: 30_000 })
    await expect(client.$('.desktop-preview-setting')).not.toBeExisting()
    await client.$('.desktop-window').waitForDisplayed({ timeout: 10_000 })
    const spansWorkspace = await client.execute(() => {
      const desktop = document
        .querySelector('.scene-desktop')!
        .getBoundingClientRect()
      const work = document.querySelector('.work-area')!.getBoundingClientRect()
      return Math.abs(desktop.width - work.width) < 2
    })
    expect(spansWorkspace).toBe(true)
    await client
      .$('[data-window-id="groups"] button[aria-label="Fenster schließen"]')
      .click()
    expect(await client.$('.desktop-party').getText()).toContain('Edrik')
    const identities = await client
      .$$('select[aria-label="Szene"] option')
      .map((option) => option.getAttribute('value'))
    if (identities.length < 2)
      throw new Error(
        'Desktop acceptance requires two populated fixture scenes'
      )
    const first = await client.$('select[aria-label="Szene"]').getValue()
    const second = identities.find((id) => id !== first)!
    await client
      .$('button[aria-label="Fenster mit Pfeiltasten verschieben"]')
      .click()
    await client.keys(['ArrowRight', 'ArrowRight'])
    await waitSaved(client)
    const preferred = await geometry(client)
    await client.$('button[aria-label="Maximieren"]').click()
    await waitSaved(client)
    await client.$('button[aria-label="Wiederherstellen"]').click()
    await waitSaved(client)
    expect(await geometry(client)).toEqual(preferred)
    await client.$('button[aria-label="Minimieren"]').click()
    await expect(client.$('.desktop-window')).not.toBeDisplayed()
    await client.$('.desktop-taskbar button').click()
    await waitSaved(client)
    expect(await geometry(client)).toEqual(preferred)

    await client
      .$('select[aria-label="Szene"]')
      .selectByAttribute('value', second)
    await expect(client.$('.scene-desktop')).toHaveAttribute(
      'data-scene-id',
      second
    )
    await waitSaved(client)
    await client.$('.desktop-window').waitForDisplayed({ timeout: 10_000 })
    await client
      .$('[data-window-id="groups"] button[aria-label="Fenster schließen"]')
      .click()
    await client.$('button[aria-label="Fenster schließen"]').click()
    await waitSaved(client)
    await expect(client.$('.desktop-window')).not.toBeExisting()
    await client
      .$('select[aria-label="Szene"]')
      .selectByAttribute('value', first)
    await expect(client.$('.scene-desktop')).toHaveAttribute(
      'data-scene-id',
      first
    )
    await waitSaved(client)
    await client.$('.desktop-window').waitForDisplayed({ timeout: 10_000 })
    expect(await geometry(client)).toEqual(preferred)
    await client.$('button[aria-label="Katalog"]').click()
    await client.$('.catalog-workspace').waitForDisplayed({ timeout: 10_000 })
    await client.$('button[aria-label="Session"]').click()
    await client.$('.desktop-window').waitForDisplayed({ timeout: 10_000 })
    expect(await geometry(client)).toEqual(preferred)
    await expectAccessibleInBothThemes(client)
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await client.$('.desktop-window').waitForDisplayed({ timeout: 30_000 })
    await expect(client.$('.desktop-preview-setting')).not.toBeExisting()
    expect(await geometry(client)).toEqual(preferred)
    await client
      .$('select[aria-label="Szene"]')
      .selectByAttribute('value', second)
    await expect(client.$('.scene-desktop')).toHaveAttribute(
      'data-scene-id',
      second
    )
    await waitSaved(client)
    await waitSaved(client)
    await expect(client.$('.desktop-window')).not.toBeExisting()
    await client.$('.desktop-toolbar').$('button=Gruppen').click()
    await client.$('.desktop-window').waitForDisplayed({ timeout: 10_000 })
    await setWindowToMinimumResponsiveSize(client)
    console.info(
      'desktop-minimum-geometry',
      await client.execute(() => {
        const frame = document.querySelector<HTMLElement>('.desktop-window')!
        const stage = document.querySelector<HTMLElement>('.desktop-stage')!
        return {
          frame: frame.getBoundingClientRect().toJSON(),
          stage: stage.getBoundingClientRect().toJSON(),
          css: frame.getAttribute('style'),
          computedHeight: getComputedStyle(frame).height
        }
      })
    )
    await client.waitUntil(
      () =>
        client.execute(() => {
          const frame = document
            .querySelector('.desktop-window')!
            .getBoundingClientRect()
          const area = document
            .querySelector('.desktop-stage')!
            .getBoundingClientRect()
          return (
            area.right <= window.innerWidth &&
            frame.left >= area.left &&
            frame.right <= area.right &&
            frame.top >= area.top &&
            frame.bottom <= area.bottom
          )
        }),
      {
        timeout: 10_000,
        timeoutMsg: 'Desktop window did not fit the smaller viewport'
      }
    )
    await client.$('.scene-desktop').waitForDisplayed({ timeout: 10_000 })
    await expect(client.$('.desktop-error')).not.toBeExisting()
  })
})
