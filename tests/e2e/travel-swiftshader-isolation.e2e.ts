import { browser, expect } from '@wdio/globals'
import { performance } from 'node:perf_hooks'
import type { Browser as WdioBrowser } from 'webdriverio'

const travelTimeoutMs = 10_000

describe('Travel SwiftShader isolation', () => {
  it('opens empty and mapped Travel routes and accepts the next Pixi interaction', async () => {
    const client = browser as unknown as WdioBrowser

    progress('create-empty-campaign')
    await createCampaign(client, 'SwiftShader leer')
    const emptyStartedAt = performance.now()
    await openTravel(client)
    const emptyConsole = await travelConsole(client)
    const emptySelect = await emptyConsole.$('select[aria-label="Hex-Karte"]')
    await emptySelect.waitForExist({ timeout: travelTimeoutMs })
    expect(await emptySelect.isEnabled()).toBe(false)
    expect(await emptyConsole.$('[role="alert"]').isExisting()).toBe(false)
    const emptyTravelReadyMs = performance.now() - emptyStartedAt
    expect(emptyTravelReadyMs).toBeLessThan(travelTimeoutMs)

    progress('switch-to-mapped-campaign')
    await switchCampaign(client, 'Reise-Abnahme')
    await openTravel(client)
    const mappedConsole = await travelConsole(client)
    const mappedSelect = await mappedConsole.$('select[aria-label="Hex-Karte"]')
    await mappedSelect.waitForEnabled({ timeout: travelTimeoutMs })
    expect(await mappedSelect.getValue()).not.toBe('')
    expect(await mappedSelect.$('option:checked').getText()).toBe('Reiseküste')

    progress('open-pixi-map')
    await (await mappedConsole.$('button=Karte öffnen')).click()
    const map = await client.$(
      '[role="region"][aria-label="Hex-Karte Reiseküste"]'
    )
    await map.waitForExist({ timeout: travelTimeoutMs })
    const webgl = await webglObservation(client)
    expect(webgl.version).toContain('WebGL 2')
    expect(webgl.renderer.toLowerCase()).toContain('swiftshader')

    progress('next-pixi-interaction')
    await (await client.$('button=Route planen')).click()
    await client.execute(() => {
      const region = document.querySelector<HTMLElement>(
        '[role="region"][aria-label="Hex-Karte Reiseküste"]'
      )
      region?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      )
    })
    await (
      await client.$('.travel-current-hex*=q 1 · r 0')
    ).waitForExist({
      timeout: 5_000,
      timeoutMsg: 'SwiftShader Pixi map did not accept the next interaction.'
    })
    await client.execute(() => {
      const region = document.querySelector<HTMLElement>(
        '[role="region"][aria-label="Hex-Karte Reiseküste"]'
      )
      region?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      )
    })
    await (
      await client.$('.travel-route-facts*=4 Std.')
    ).waitForExist({
      timeout: 5_000,
      timeoutMsg: 'Travel route evaluation did not follow the Pixi interaction.'
    })

    process.stdout.write(
      `${JSON.stringify({
        kind: 'travel-swiftshader-isolation',
        emptyTravelReadyMs: Number(emptyTravelReadyMs.toFixed(3)),
        timeoutMs: travelTimeoutMs,
        webgl,
        emptyTravelRoute: true,
        mappedTravelRoute: true,
        nextPixiInteraction: true,
        qualificationClaim:
          'isolated-travel-swiftshader-disposition-not-production-timing'
      })}\n`
    )
  })
})

function progress(stage: string): void {
  process.stdout.write(`[travel-swiftshader-isolation] ${stage}\n`)
}

async function createCampaign(
  client: WdioBrowser,
  name: string
): Promise<void> {
  await openCampaignDialog(client)
  const field = await client.$('#campaign-name')
  await field.setValue(name)
  await (await client.$('button=Anlegen')).click()
  await (
    await client.$(`h1=Session · ${name}`)
  ).waitForExist({
    timeout: travelTimeoutMs
  })
  await waitForCampaignDialogClosed(client)
}

async function switchCampaign(
  client: WdioBrowser,
  name: string
): Promise<void> {
  await openCampaignDialog(client)
  const target = await client.$(`button[aria-label="${name}"]`)
  await target.waitForClickable({ timeout: 5_000 })
  await target.click()
  await (
    await client.$(`h1=Session · ${name}`)
  ).waitForExist({
    timeout: travelTimeoutMs
  })
  await waitForCampaignDialogClosed(client)
}

async function openCampaignDialog(client: WdioBrowser): Promise<void> {
  const menuButton = await client.$('button[aria-label="Menü"]')
  if ((await menuButton.getAttribute('aria-expanded')) !== 'true')
    await menuButton.click()
  const menu = await client.$('nav#campaign-menu')
  await menu.waitForDisplayed({ timeout: 5_000 })
  await (await menu.$('button=Kampagnen')).click()
  await (await client.$('#campaign-name')).waitForDisplayed({ timeout: 5_000 })
}

async function waitForCampaignDialogClosed(client: WdioBrowser): Promise<void> {
  const menuButton = await client.$('button[aria-label="Menü"]')
  await client.waitUntil(
    async () => (await menuButton.getAttribute('aria-expanded')) === 'false',
    {
      timeout: 5_000,
      interval: 25,
      timeoutMsg: 'Campaign dialog did not close.'
    }
  )
}

async function openTravel(client: WdioBrowser): Promise<void> {
  const actions = await client.$('.shell-quick-actions')
  const button = await actions.$('button=Reise')
  await button.waitForClickable({ timeout: 5_000 })
  await button.click()
}

async function travelConsole(client: WdioBrowser) {
  const console = await client.$('section.travel-console[aria-label="Reise"]')
  await console.waitForExist({ timeout: travelTimeoutMs })
  return console
}

async function webglObservation(
  client: WdioBrowser
): Promise<Readonly<{ version: string; renderer: string }>> {
  const serialized = await client.execute(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '.hex-travel-map canvas'
    )
    if (!canvas) throw new Error('Travel Pixi canvas is missing.')
    const context = canvas.getContext('webgl2')
    if (!context) throw new Error('Travel Pixi canvas has no WebGL 2 context.')
    const debug = context.getExtension('WEBGL_debug_renderer_info')
    return JSON.stringify({
      version: String(context.getParameter(context.VERSION)),
      renderer:
        debug === null
          ? 'unavailable (WEBGL_debug_renderer_info disabled)'
          : String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL))
    })
  })
  return JSON.parse(serialized) as Readonly<{
    version: string
    renderer: string
  }>
}
