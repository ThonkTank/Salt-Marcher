import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import {
  expectAccessible,
  expectElementGolden,
  setElectronWindowSize
} from './support/e2e-assertions.js'

describe('Session map and travel console', () => {
  it('plans and controls one journey from the shared borderless map state', async () => {
    const client = browser as unknown as WdioBrowser
    await setElectronWindowSize(client, 1280, 800)
    await (
      await client.$('h1=Session · Reise-Abnahme')
    ).waitForExist({
      timeout: 10_000
    })

    await (await client.$('button=Karte')).click()
    await (
      await client.$('select[aria-label="Szenario Auswahl"]')
    ).selectByAttribute('value', 'travel')

    const mapRegion = await client.$(
      '[role="region"][aria-label="Hex-Karte Reiseküste"]'
    )
    await mapRegion.waitForExist({ timeout: 10_000 })
    await (await client.$('select[aria-label="Hex-Karte"]')).waitForExist()
    const partyCard = await client.$('.scene-party-card')
    await partyCard.waitForExist()
    expect(await partyCard.getText()).toContain('Alrik')
    expect(await partyCard.getText()).toContain('1 in dieser Scene')
    const speedWarning = await client.$('.travel-warning')
    await speedWarning.waitForExist()
    expect(await speedWarning.getText()).toContain('Alrik')
    await expect(await client.$('strong=Salzscheune')).toBeExisting()
    await expect(
      await client.$('button[aria-label="Reise starten"]')
    ).toBeDisabled()

    const geometry = await client.execute(() => {
      const map = document.querySelector<HTMLElement>('.hex-travel-map')
      const shell = map?.querySelector<HTMLElement>('.hex-canvas-shell')
      if (!map || !shell) return null
      const mapBounds = map.getBoundingClientRect()
      const shellBounds = shell.getBoundingClientRect()
      return {
        toolbarCount: document.querySelectorAll('.hex-map-toolbar').length,
        statusCount: document.querySelectorAll('.hex-map-status').length,
        mapHeight: Math.round(mapBounds.height),
        widthDelta: Math.round(mapBounds.width - shellBounds.width),
        heightDelta: Math.round(mapBounds.height - shellBounds.height)
      }
    })
    expect(geometry).toMatchObject({
      toolbarCount: 0,
      statusCount: 0,
      widthDelta: 2,
      heightDelta: 2
    })
    expect(geometry?.mapHeight).toBeGreaterThan(650)

    const dragToken = (fromQ: number, toQ: number) =>
      client.execute(
        (startQ, destinationQ) => {
          const canvas = document.querySelector<HTMLCanvasElement>(
            '.hex-travel-map canvas'
          )
          if (!canvas) throw new Error('Travel canvas is missing.')
          const bounds = canvas.getBoundingClientRect()
          const centerX = bounds.left + bounds.width / 2
          const centerY = bounds.top + bounds.height / 2
          const horizontalHexStep = 28 * Math.sqrt(3)
          const pointer = (type: string, q: number) =>
            canvas.dispatchEvent(
              new PointerEvent(type, {
                bubbles: true,
                button: 0,
                buttons: type === 'pointerup' ? 0 : 1,
                pointerId: 41,
                clientX: centerX + horizontalHexStep * q,
                clientY: centerY
              })
            )
          pointer('pointerdown', startQ)
          pointer('pointermove', destinationQ)
          pointer('pointerup', destinationQ)
        },
        fromQ,
        toQ
      )
    await dragToken(0, 1)
    await client.waitUntil(
      async () =>
        (await client.$('.travel-current-location strong').getText()) ===
        'Hex q=1, r=0',
      { timeout: 5_000, timeoutMsg: 'Direct token drag did not persist.' }
    )
    await dragToken(1, 0)
    await client.waitUntil(
      async () =>
        (await client.$('.travel-current-location strong').getText()) ===
        'Salzscheune',
      { timeout: 5_000, timeoutMsg: 'Return token drag did not persist.' }
    )

    await (await client.$('button=Route planen')).click()
    await client.execute(() => {
      const map = document.querySelector<HTMLElement>(
        '[role="region"][aria-label="Hex-Karte Reiseküste"]'
      )
      map?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      )
    })
    await (
      await client.$('.travel-current-hex*=q 1 · r 0')
    ).waitForExist({
      timeout: 5_000
    })
    await client.execute(() => {
      const map = document.querySelector<HTMLElement>(
        '[role="region"][aria-label="Hex-Karte Reiseküste"]'
      )
      map?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      )
    })
    await (
      await client.$('.travel-route-facts*=4 Std.')
    ).waitForExist({
      timeout: 5_000
    })
    await expect(await client.$('.travel-route-facts*=4 P')).toBeExisting()
    await expect(
      await client.$('button[aria-label="Reise starten"]')
    ).toBeEnabled()
    await expectAccessible(client)

    await expectElementGolden(client, 'session-travel-light', '.session-mockup')
    await client.execute(() => {
      document.documentElement.dataset['theme'] = 'dark'
    })
    await expectElementGolden(client, 'session-travel-dark', '.session-mockup')
    await client.execute(() => {
      document.documentElement.dataset['theme'] = 'light'
    })

    await (await client.$('button[aria-label="Reise starten"]')).click()
    const pause = await client.$('button[aria-label="Pause"]')
    await client.waitUntil(() => pause.isEnabled(), {
      timeout: 5_000,
      timeoutMsg: 'Travel did not enter the travelling state.'
    })
    await pause.click()
    const resume = await client.$('button[aria-label="Fortsetzen"]')
    await resume.waitForExist({ timeout: 5_000 })
    await (await client.$('button[aria-label="Schneller"]')).click()
    await expect(await client.$('.travel-multiplier')).toHaveText('2×')
    await resume.click()
    await (await client.$('button[aria-label="Stopp"]')).click()
    await client.waitUntil(
      () =>
        client.execute(async () => {
          const session = await window.saltMarcher.session.read()
          return session.travel.kind === 'hex'
            ? session.travel.status === 'aborted'
            : false
        }),
      { timeout: 5_000, timeoutMsg: 'Travel did not abort.' }
    )

    await (await client.$('button=Route planen')).click()
    await client.execute(() => {
      const map = document.querySelector<HTMLElement>(
        '[role="region"][aria-label="Hex-Karte Reiseküste"]'
      )
      map?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      )
    })
    await (
      await client.$('.travel-route-facts*=4 Std.')
    ).waitForExist({
      timeout: 5_000
    })
    await (await client.$('button[aria-label="Schneller"]')).click()
    await expect(await client.$('.travel-multiplier')).toHaveText('5×')
    await (await client.$('button[aria-label="Schneller"]')).click()
    await expect(await client.$('.travel-multiplier')).toHaveText('10×')
    await (await client.$('button[aria-label="Reise starten"]')).click()

    const completed = await client.waitUntil(
      () =>
        client.execute(async () => {
          const session = await window.saltMarcher.session.read()
          const context = await window.saltMarcher.hexTravel.read({
            sceneId: session.scene.focusedSceneId
          })
          return context.travel.status === 'completed'
            ? {
                status: context.travel.status,
                current: context.travel.current,
                path: context.travel.path
              }
            : null
        }),
      {
        timeout: 5_000,
        timeoutMsg: 'Travel did not complete at presentation speed 10×.'
      }
    )
    expect(completed).toEqual({
      status: 'completed',
      current: { q: 1, r: 0 },
      path: []
    })
    await client.waitUntil(
      async () =>
        (await client.$('.travel-route-message').getText()) ===
        'Ziel erreicht.',
      { timeout: 5_000, timeoutMsg: 'Completed status was not rendered.' }
    )
    await client.waitUntil(
      async () =>
        (await client.$('.travel-current-location strong').getText()) ===
        'Hex q=1, r=0',
      { timeout: 5_000, timeoutMsg: 'Final Party position was not rendered.' }
    )
    await expect(await client.$('button=Löschen')).toBeDisabled()
    await expectElementGolden(
      client,
      'session-travel-completed-light',
      '.session-mockup'
    )

    await client.execute(() => {
      document.documentElement.style.fontSize = '200%'
    })
    try {
      await expectAccessible(client)
    } finally {
      await client.execute(() => {
        document.documentElement.style.fontSize = ''
      })
    }
  })
})
