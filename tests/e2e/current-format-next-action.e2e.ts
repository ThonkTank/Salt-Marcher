import { browser, expect } from '@wdio/globals'
import { performance } from 'node:perf_hooks'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import type { Browser as WdioBrowser } from 'webdriverio'

const readinessTimeoutMs = 10_000
const warmupCount = 5
const sampleCount = 100
const campaignNames = {
  A: 'Current Format A',
  B: 'Current Format B'
} as const

describe('Current-Format Campaign qualification', () => {
  it('meets the warm-switch budget with coherent useful state and a durable next Scene mutation', async () => {
    const client = browser as unknown as WdioBrowser
    const campaigns = await campaignIdentities(client)

    progress('settle-production-travel-b')
    await switchCampaign(client, campaigns.B.id, campaignNames.B)
    const initialB = await readSession(client, campaigns.B.id)
    await waitForTravelReconciliation(client, initialB.scene.focusedSceneId)
    const baselineB = await readSession(client, campaigns.B.id)

    progress('baseline-a')
    await switchCampaign(client, campaigns.A.id, campaignNames.A)
    const baselineA = await readSession(client, campaigns.A.id)
    expect(focusedScene(baselineA).locationName).toBe('Salt Harbor')
    expect(baselineA.party.members.some(({ active }) => !active)).toBe(true)
    expect(baselineA.combat?.phase).toBe('initiative')

    for (const role of ['B', 'A', 'B', 'A'] as const) {
      progress(`switch-${role.toLowerCase()}`)
      const target = campaigns[role]
      await switchCampaign(client, target.id, campaignNames[role])
      expect(await readSession(client, target.id)).toEqual(
        role === 'A' ? baselineA : baselineB
      )
    }

    for (let index = 0; index < warmupCount; index += 1) {
      progress(`warmup-${index}`)
      const role = index % 2 === 0 ? 'B' : 'A'
      const target = campaigns[role]
      await switchCampaign(client, target.id, campaignNames[role])
    }

    const samples: number[] = []
    for (let index = 0; index < sampleCount; index += 1) {
      if (index % 10 === 0) progress(`sample-${index}`)
      const role = index % 2 === 0 ? 'A' : 'B'
      const target = campaigns[role]
      samples.push(await switchCampaign(client, target.id, campaignNames[role]))
      expect(await readSession(client, target.id)).toEqual(
        role === 'A' ? baselineA : baselineB
      )
    }

    const sorted = [...samples].sort((left, right) => left - right)
    const p95Ms = sorted[94]!
    const maximumMs = sorted.at(-1)!
    process.stdout.write(
      `${JSON.stringify({
        kind: 'current-format-warm-switch-population',
        fixtureIdentity: 'frontend-robustness-current-format-completion-v1',
        profile: 'complete-current-format-not-rp-r-or-rp-l',
        warmups: warmupCount,
        samples: samples.map((value) => Number(value.toFixed(3))),
        p95Ms: Number(p95Ms.toFixed(3)),
        maximumMs: Number(maximumMs.toFixed(3)),
        timeoutMs: readinessTimeoutMs
      })}\n`
    )
    expect(samples).toHaveLength(sampleCount)
    expect(maximumMs).toBeLessThan(readinessTimeoutMs)
    expect(p95Ms).toBeLessThan(1_000)

    progress('population-complete')
    expect(await readSession(client, campaigns.B.id)).toEqual(baselineB)
    await switchCampaign(client, campaigns.A.id, campaignNames.A)
    expect(await readSession(client, campaigns.A.id)).toEqual(baselineA)

    const targetLocation = 'Unterbrochene Küstenwacht'
    progress('focused-scene-next-action')
    await setSceneLocation(client, targetLocation)
    await waitForSceneLocation(client, targetLocation)
    const committed = await readSession(client, campaigns.A.id)
    expect(committed.revision).toBe(baselineA.revision + 1)
    expect(committed.scene.revision).toBe(baselineA.scene.revision + 1)
    expect(committed.scene.focusedSceneId).toBe(baselineA.scene.focusedSceneId)
    expect(focusedScene(committed).locationName).toBe(targetLocation)

    progress('restart-after-focused-scene-action')
    await client.reloadSession()
    await waitForCampaignReady(client, campaigns.A.id)
    await waitForSceneLocation(client, targetLocation)
    const restarted = await readSession(client, campaigns.A.id)
    expect(restarted).toEqual(committed)

    process.stdout.write(
      `${JSON.stringify({
        kind: 'current-format-focused-scene-next-action',
        fixtureIdentity: 'frontend-robustness-current-format-completion-v1',
        profile: 'complete-current-format-not-rp-r-or-rp-l',
        warmups: warmupCount,
        samples: samples.map((value) => Number(value.toFixed(3))),
        p95Ms: Number(p95Ms.toFixed(3)),
        maximumMs: Number(maximumMs.toFixed(3)),
        timeoutMs: readinessTimeoutMs,
        semanticEquivalence: true,
        nextMutation: {
          kind: 'scene-set-location',
          campaignId: campaigns.A.id,
          sceneId: committed.scene.focusedSceneId,
          locationName: targetLocation,
          previousRevision: baselineA.scene.revision,
          committedRevision: committed.scene.revision,
          restartReadback: true
        },
        qualificationClaim:
          'current-format-preliminary-not-rp-r-or-rp-l-or-qs-05'
      })}\n`
    )
  })
})

function progress(stage: string): void {
  process.stdout.write(`[current-format-next-action] ${stage}\n`)
}

async function campaignIdentities(
  client: WdioBrowser
): Promise<
  Readonly<Record<'A' | 'B', Readonly<{ id: string; name: string }>>>
> {
  const snapshot = await client.execute(() =>
    window.saltMarcher.campaigns.list()
  )
  const byName = (name: string) =>
    snapshot.campaigns.find((campaign) => campaign.name === name)
  const campaignA = byName(campaignNames.A)
  const campaignB = byName(campaignNames.B)
  if (!campaignA || !campaignB)
    throw new Error('Complete Current-Format A/B Campaigns are missing.')
  return { A: campaignA, B: campaignB }
}

async function readSession(
  client: WdioBrowser,
  campaignId: string
): Promise<LiveSessionSnapshot> {
  return client.execute(
    (id) => window.saltMarcher.session.read({ campaignId: id }),
    campaignId
  )
}

function focusedScene(snapshot: LiveSessionSnapshot) {
  const scene = snapshot.scene.scenes.find(
    ({ id }) => id === snapshot.scene.focusedSceneId
  )
  if (!scene) throw new Error('Focused Scene is missing from Session truth.')
  return scene
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
  return performance.now() - startedAt
}

async function openCampaignDialog(client: WdioBrowser): Promise<void> {
  const button = await client.$('button[aria-label="Menü"]')
  if ((await button.getAttribute('aria-expanded')) !== 'true')
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
}

async function waitForCampaignReady(
  client: WdioBrowser,
  campaignId: string
): Promise<void> {
  await (
    await client.$(
      `main[data-renderer-ready="gm"]` +
        `[data-active-campaign-id="${campaignId}"]` +
        `[data-session-campaign-id="${campaignId}"]` +
        '[data-session-revision]:not([data-session-revision=""])' +
        '[data-active-workspace="session"] .session-mockup'
    )
  ).waitForExist({
    timeout: readinessTimeoutMs,
    interval: 25,
    timeoutMsg: `Campaign ${campaignId} did not reach useful Session state.`
  })
}

async function waitForTravelReconciliation(
  client: WdioBrowser,
  sceneId: string
): Promise<void> {
  await client.waitUntil(
    () =>
      client.execute(
        async (id) =>
          (await window.saltMarcher.hexTravel.read({ sceneId: id })).travel
            .status !== 'travelling',
        sceneId
      ),
    {
      timeout: readinessTimeoutMs,
      interval: 25,
      timeoutMsg:
        'Current-Format B Travel did not reconcile on production time.'
    }
  )
}

async function setSceneLocation(
  client: WdioBrowser,
  location: string
): Promise<void> {
  const row = await client.$('[data-register-field="location"]')
  await (await row.$('button=Setzen')).click()
  await (
    await row.$('select[aria-label="Scene-Ort"]')
  ).selectByVisibleText(location)
}

async function waitForSceneLocation(
  client: WdioBrowser,
  expected: string
): Promise<void> {
  await client.waitUntil(
    async () =>
      (await (
        await client.$('[data-register-field="location"] .register-value')
      ).getText()) === expected,
    {
      timeout: 5_000,
      interval: 25,
      timeoutMsg: `Focused Scene location did not become ${expected}.`
    }
  )
}
