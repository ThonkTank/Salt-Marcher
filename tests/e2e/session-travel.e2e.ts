import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RuntimeEvidence } from '../../src/shared/contracts/runtime-evidence.js'
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
    await (await client.$('[role="tab"]=Reise')).click()

    const mapRegion = await client.$(
      '[role="region"][aria-label="Hex-Karte Reiseküste"]'
    )
    await mapRegion.waitForExist({ timeout: 10_000 })
    let settlingRenderCount = -1
    let stableSamples = 0
    await client.waitUntil(
      async () => {
        const current = Number(
          await mapRegion.getAttribute('data-render-count')
        )
        stableSamples = current === settlingRenderCount ? stableSamples + 1 : 0
        settlingRenderCount = current
        return stableSamples >= 4
      },
      {
        timeout: 5_000,
        interval: 250,
        timeoutMsg: 'Travel map did not reach a stable render state.'
      }
    )
    const idleRenderCountBefore = settlingRenderCount
    const idleRenderReasonsBefore = JSON.parse(
      (await mapRegion.getAttribute('data-render-reason-counts')) ?? '{}'
    ) as Record<string, number>
    const runtimeBefore = await readRuntimeEvidence(client)
    await client.pause(1_000)
    const idleRenderCountAfter = Number(
      await mapRegion.getAttribute('data-render-count')
    )
    const idleRenderReasonsAfter = JSON.parse(
      (await mapRegion.getAttribute('data-render-reason-counts')) ?? '{}'
    ) as Record<string, number>
    const runtimeAfter = await readRuntimeEvidence(client)
    expect(idleRenderCountAfter).toBe(idleRenderCountBefore)
    expect(runtimeAfter.supervisor.generation).toBe(
      runtimeBefore.supervisor.generation
    )
    expect(runtimeAfter.supervisor.generation).toBe(1)
    expect(runtimeBefore.supervisor.utility.activeDomainTimers).toBe(0)
    expect(runtimeAfter.supervisor.utility.activeDomainTimers).toBe(0)
    expect(runtimeAfter.supervisor.utility.scheduledWakeups).toBe(
      runtimeBefore.supervisor.utility.scheduledWakeups
    )
    writeIdleEvidence({
      observationMs: 1_000,
      renderCountBefore: idleRenderCountBefore,
      renderCountAfter: idleRenderCountAfter,
      renderDelta: idleRenderCountAfter - idleRenderCountBefore,
      renderReasonsBefore: idleRenderReasonsBefore,
      renderReasonsAfter: idleRenderReasonsAfter,
      utilityWakeupDelta:
        runtimeAfter.supervisor.utility.scheduledWakeups -
        runtimeBefore.supervisor.utility.scheduledWakeups,
      runtimeBefore,
      runtimeAfter,
      cpuGate: 'evidence-only'
    })
    await (await client.$('select[aria-label="Hex-Karte"]')).waitForExist()
    const partyCard = await client.$('.scene-party-card')
    await partyCard.waitForExist()
    const partyExpansion = await partyCard.$('.group-expand')
    if ((await partyExpansion.getAttribute('aria-expanded')) !== 'true')
      await partyExpansion.click()
    expect(await client.$('.scene-party-expanded').getText()).toContain('Alrik')
    expect(await partyCard.$('.count').getText()).toBe('1')
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
        viewportHeight: window.innerHeight,
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
    if (!geometry) throw new Error('Travel map geometry is unavailable.')
    expect(geometry.mapHeight).toBeGreaterThan(geometry.viewportHeight * 0.8)

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

function writeIdleEvidence(
  evidence: Readonly<{
    observationMs: number
    renderCountBefore: number
    renderCountAfter: number
    renderDelta: number
    renderReasonsBefore: Readonly<Record<string, number>>
    renderReasonsAfter: Readonly<Record<string, number>>
    utilityWakeupDelta: number
    runtimeBefore: RuntimeEvidence
    runtimeAfter: RuntimeEvidence
    cpuGate: 'evidence-only'
  }>
): void {
  const runId = process.env['SALT_MARCHER_E2E_RUN_ID'] ?? 'standalone'
  const directory = join('.tmp', 'e2e-runs', runId, 'evidence')
  const target = join(directory, 'travel-static-render.json')
  const temporary = `${target}.tmp-${process.pid}`
  mkdirSync(directory, { recursive: true })
  writeFileSync(
    temporary,
    `${JSON.stringify(
      {
        version: 1,
        kind: 'static-render-idle',
        fixture: 'v2/travel-scenario',
        recordedAt: new Date().toISOString(),
        ...evidence
      },
      null,
      2
    )}\n`
  )
  renameSync(temporary, target)
}

function readRuntimeEvidence(client: WdioBrowser): Promise<RuntimeEvidence> {
  return client.execute(async () => {
    const e2eWindow = window as typeof window & {
      __saltMarcherE2e?: {
        runtimeEvidence: () => Promise<RuntimeEvidence>
      }
    }
    if (!e2eWindow.__saltMarcherE2e)
      throw new Error('E2E runtime evidence bridge is unavailable.')
    return await e2eWindow.__saltMarcherE2e.runtimeEvidence()
  }) as unknown as Promise<RuntimeEvidence>
}
