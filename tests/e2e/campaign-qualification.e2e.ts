import { browser, expect } from '@wdio/globals'
import { performance } from 'node:perf_hooks'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import type { Browser as WdioBrowser } from 'webdriverio'

const switchTimeoutMs = 10_000

describe('Campaign production-route qualification', () => {
  it('keeps A/B truth coherent across a warm population and persists the next action', async () => {
    const client = browser as unknown as WdioBrowser
    progress('create-a')
    await createCampaign(client, 'Qualification A')
    const campaignA = await activeCampaign(client)
    const beforeA = await readSession(client, campaignA.id)

    progress('create-b')
    await createCampaign(client, 'Qualification B')
    const campaignB = await activeCampaign(client)
    const beforeB = await readSession(client, campaignB.id)

    progress('initial-switch-a')
    await switchCampaign(client, campaignA.id, campaignA.name)

    for (let index = 0; index < 5; index += 1) {
      progress(`warmup-${index}`)
      const target = index % 2 === 0 ? campaignB : campaignA
      await switchCampaign(client, target.id, target.name)
    }

    const samples: number[] = []
    for (let index = 0; index < 100; index += 1) {
      if (index % 10 === 0) progress(`sample-${index}`)
      const target = index % 2 === 0 ? campaignA : campaignB
      samples.push(await switchCampaign(client, target.id, target.name))
    }

    const sorted = [...samples].sort((left, right) => left - right)
    const p95Ms = sorted[94]!
    const maximumMs = sorted.at(-1)!
    expect(samples).toHaveLength(100)
    expect(maximumMs).toBeLessThan(switchTimeoutMs)
    expect(p95Ms).toBeLessThan(1_000)

    progress('population-complete')
    progress('read-b')
    expect(await readSession(client, campaignB.id)).toEqual(beforeB)

    progress('switch-a-for-oracle')
    await switchCampaign(client, campaignA.id, campaignA.name)
    progress('read-a')
    const beforeMutation = await readSession(client, campaignA.id)
    expect(beforeMutation).toEqual(beforeA)
    const renamedCampaign = 'Qualification A confirmed'
    progress('rename-after-population')
    await renameActiveCampaign(client, campaignA.name, renamedCampaign)

    progress('restart-after-mutation')
    await client.reloadSession()
    await waitForCampaignReady(client, campaignA.id)
    progress('restart-after-mutation-ready')
    await (
      await client.$(`h1=Session · ${renamedCampaign}`)
    ).waitForExist({ timeout: switchTimeoutMs })

    process.stdout.write(
      `${JSON.stringify({
        kind: 'campaign-warm-switch-qualification',
        profile: 'empty-installation-functional-route',
        warmups: 5,
        samples: samples.map((value) => Number(value.toFixed(3))),
        p95Ms: Number(p95Ms.toFixed(3)),
        maximumMs: Number(maximumMs.toFixed(3)),
        timeoutMs: switchTimeoutMs,
        semanticEquivalence: true,
        nextMutation: {
          kind: 'campaign-rename',
          campaignId: campaignA.id,
          name: renamedCampaign,
          restartReadback: true
        }
      })}\n`
    )
  })
})

function progress(stage: string): void {
  process.stdout.write(`[campaign-qualification] ${stage}\n`)
}

async function createCampaign(
  client: WdioBrowser,
  name: string
): Promise<void> {
  let field = await client.$('#campaign-name')
  try {
    await field.waitForDisplayed({ timeout: 5_000 })
  } catch {
    await openCampaignDialog(client)
    field = await client.$('#campaign-name')
  }
  await field.waitForDisplayed({ timeout: 5_000 })
  await field.setValue(name)
  await (await client.$('button=Anlegen')).click()
  await (
    await client.$(`h1=Session · ${name}`)
  ).waitForExist({
    timeout: switchTimeoutMs
  })
  await waitForCampaignDialogClosed(client)
}

async function activeCampaign(
  client: WdioBrowser
): Promise<Readonly<{ id: string; name: string }>> {
  return client.execute(async () => {
    const snapshot = await window.saltMarcher.campaigns.list()
    const campaign = snapshot.campaigns.find(
      (entry) => entry.id === snapshot.activeCampaignId
    )
    if (!campaign) throw new Error('Active E2E Campaign is missing.')
    return { id: campaign.id, name: campaign.name }
  })
}

async function readSession(
  client: WdioBrowser,
  campaignId: string
): Promise<LiveSessionSnapshot> {
  const serialized = await client.execute(async (id) => {
    try {
      return JSON.stringify({
        status: 'ready',
        value: await window.saltMarcher.session.read({ campaignId: id })
      })
    } catch (cause) {
      return JSON.stringify({
        status: 'failure',
        name: cause instanceof Error ? cause.name : typeof cause,
        message: cause instanceof Error ? cause.message : String(cause)
      })
    }
  }, campaignId)
  const outcome = JSON.parse(serialized) as
    | Readonly<{ status: 'ready'; value: LiveSessionSnapshot }>
    | Readonly<{ status: 'failure'; name: string; message: string }>
  if (outcome.status === 'failure')
    throw new Error(
      `Session read failed for ${campaignId}: ${outcome.name}: ${outcome.message}`
    )
  return outcome.value
}

async function switchCampaign(
  client: WdioBrowser,
  campaignId: string,
  campaignName: string
): Promise<number> {
  await openCampaignDialog(client)
  const target = await client.$(`button[aria-label="${campaignName}"]`)
  await target.waitForClickable({ timeout: 5_000 })
  const startedAt = performance.now()
  await target.click()
  await waitForCampaignReady(client, campaignId)
  await waitForCampaignDialogClosed(client)
  const finishedAt = performance.now()
  return finishedAt - startedAt
}

async function openCampaignDialog(client: WdioBrowser): Promise<void> {
  const button = await client.$('button[aria-label="Menü"]')
  if ((await button.getAttribute('aria-expanded')) === 'true') {
    const field = await client.$('#campaign-name')
    if (await field.isDisplayed()) return
    const openMenu = await client.$('nav#campaign-menu')
    if (await openMenu.isDisplayed()) {
      await (await openMenu.$('button=Kampagnen')).click()
      await field.waitForDisplayed({ timeout: 5_000 })
      return
    }
    await field.waitForDisplayed({ timeout: 5_000 })
    return
  }
  await button.click()
  const menu = await client.$('nav#campaign-menu')
  await menu.waitForDisplayed({ timeout: 5_000 })
  await (await menu.$('button=Kampagnen')).click()
  await (await client.$('#campaign-name')).waitForDisplayed({ timeout: 5_000 })
}

async function waitForCampaignDialogClosed(client: WdioBrowser): Promise<void> {
  const button = await client.$('button[aria-label="Menü"]')
  await client.waitUntil(
    async () => (await button.getAttribute('aria-expanded')) === 'false',
    {
      timeout: 5_000,
      interval: 25,
      timeoutMsg: 'Campaign dialog did not close after activation.'
    }
  )
  await button.waitForClickable({ timeout: 5_000 })
}

async function waitForCampaignReady(
  client: WdioBrowser,
  campaignId: string
): Promise<void> {
  const session = await client.$(
    `main[data-renderer-ready="gm"]` +
      `[data-active-campaign-id="${campaignId}"]` +
      `[data-session-campaign-id="${campaignId}"]` +
      '[data-session-revision]:not([data-session-revision=""])' +
      '[data-active-workspace="session"] .session-mockup'
  )
  await session.waitForExist({
    timeout: switchTimeoutMs,
    interval: 25,
    timeoutMsg: `Campaign ${campaignId} did not reach useful Session state.`
  })
}

async function renameActiveCampaign(
  client: WdioBrowser,
  currentName: string,
  nextName: string
): Promise<void> {
  await openCampaignDialog(client)
  let row = await (
    await client.$(`button[aria-label="${currentName}"]`)
  ).$('..')
  await (await row.$('button=Umbenennen')).click()
  const field = await row.$('input[aria-label="Umbenennen"]')
  await field.setValue(nextName)
  row = await field.$('..')
  await (await row.$('button=Speichern')).click()
  await (
    await client.$(`h1=Session · ${nextName}`)
  ).waitForExist({
    timeout: switchTimeoutMs
  })
  await (
    await client.$('#campaign-menu button[aria-label="Schließen"]')
  ).click()
  await waitForCampaignDialogClosed(client)
}
