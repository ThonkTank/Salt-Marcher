import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { expectAccessible } from './support/e2e-assertions.js'
import { clickWhenInteractable } from './support/e2e-interactions.js'

describe('generator preset integration', () => {
  it('resumes durable Planner work across active process restarts', async () => {
    const client = browser as unknown as WdioBrowser
    const campaignName = await client.$('#campaign-name')
    await campaignName.waitForDisplayed({ timeout: 30_000 })
    await campaignName.setValue('Preset E2E')
    await (await client.$('button=Anlegen')).click()
    await (
      await client.$('h1=Session · Preset E2E')
    ).waitForExist({ timeout: 10_000 })

    await (await client.$('button[aria-label="Menü"]')).click()
    await (
      await (await client.$('#campaign-menu')).$('button=Einstellungen')
    ).click()
    let dialog = await client.$('section.encounter-settings-dialog')
    await dialog.waitForDisplayed({ timeout: 5_000 })
    await (await dialog.$('.preset-toolbar input')).setValue('E2E Generator')
    await (
      await dialog.$('input[aria-label="Als Mob führen ab"]')
    ).setValue('7')
    const interruptionArmed = await client.execute(async () => {
      const e2eWindow = window as typeof window & {
        __saltMarcherE2e?: Readonly<{
          interruptGeneratorPresetCreate: () => Promise<boolean>
        }>
      }
      return (
        (await e2eWindow.__saltMarcherE2e?.interruptGeneratorPresetCreate()) ??
        false
      )
    })
    expect(interruptionArmed).toBe(true)
    await (await dialog.$('button=Als Kopie speichern')).click()
    await client.waitUntil(
      async () => {
        try {
          return (
            (await client.execute(async () =>
              window.saltMarcher.runtime.coreStatus()
            )) !== 'ready'
          )
        } catch {
          return false
        }
      },
      {
        timeout: 10_000,
        interval: 100,
        timeoutMsg: 'Preset write did not interrupt the Utility process.'
      }
    )
    await client.waitUntil(
      async () => {
        try {
          return (
            (await client.execute(async () =>
              window.saltMarcher.runtime.coreStatus()
            )) === 'ready'
          )
        } catch {
          return false
        }
      },
      {
        timeout: 45_000,
        interval: 250,
        timeoutMsg: 'Utility did not recover after the preset write.'
      }
    )
    await (
      await client.$('h1=Session · Preset E2E')
    ).waitForExist({ timeout: 15_000 })
    let menu = await client.$('#campaign-menu')
    if (!(await menu.isExisting())) {
      await (await client.$('button[aria-label="Menü"]')).click()
      menu = await client.$('#campaign-menu')
    }
    await menu.waitForDisplayed({ timeout: 10_000 })
    await (await menu.$('button=Einstellungen')).click()
    dialog = await client.$('section.encounter-settings-dialog')
    await dialog.waitForDisplayed({ timeout: 10_000 })
    await (
      await dialog.$(
        'p=Speicherergebnis noch unklar. Prüfe zuerst den Befehlsbeleg.'
      )
    ).waitForExist({ timeout: 10_000 })
    expect(await (await dialog.$('.preset-toolbar input')).isEnabled()).toBe(
      false
    )
    await (await dialog.$('button=Speicherergebnis prüfen')).click()
    await (
      await dialog.$('p=Speicherergebnis bestätigt.')
    ).waitForExist({ timeout: 10_000 })
    const recoveredPresetCount = await client.execute(async () => {
      const activeCampaignId = (await window.saltMarcher.campaigns.list())
        .activeCampaignId
      const presets = await window.saltMarcher.generatorPresets.readEditor({
        campaignId: activeCampaignId
      })
      return presets.registry.presets.filter(
        (preset) => preset.name === 'E2E Generator'
      ).length
    })
    expect(recoveredPresetCount).toBe(1)
    await (await dialog.$('button=Für aktive Kampagne zuweisen')).click()
    await (
      await dialog.$('p=Preset der aktiven Kampagne zugewiesen.')
    ).waitForExist({ timeout: 5_000 })
    await (await dialog.$('button[aria-label="Schließen"]')).click()

    await client.refresh()
    await (
      await client.$('h1=Session · Preset E2E')
    ).waitForExist({ timeout: 15_000 })
    const setup = await client.execute(async () => {
      const api = window.saltMarcher
      const presets = await api.generatorPresets.readEditor({
        campaignId: (await api.campaigns.list()).activeCampaignId
      })
      const custom = presets.registry.presets.find(
        (preset) => preset.name === 'E2E Generator'
      )
      if (!custom) throw new Error('Copied E2E preset is missing after reload.')

      let party = await api.party.read()
      if (party.members.length === 0)
        party = await api.party.create({
          character: {
            name: 'Preset Participant',
            playerName: null,
            species: null,
            characterClass: null,
            languages: [],
            level: 3,
            passivePerception: null,
            passiveInvestigation: null,
            passiveInsight: null,
            armorClass: null,
            movementSpeedFeet: null
          },
          expectedRevision: party.revision
        })
      for (const member of party.members)
        party = await api.party.setMembership({
          id: member.id,
          active: true,
          expectedRevision: party.revision
        })
      const campaignId = (await api.campaigns.list()).activeCampaignId!
      const live = await api.session.read({ campaignId })
      const scene = await api.scene.generateGroupDraft({
        sceneId: live.scene.focusedSceneId,
        entries: [],
        mode: 'replace',
        filters: {
          name: '',
          sizes: [],
          types: [],
          subtypes: [],
          biomes: [],
          alignments: [],
          encounterTableIds: [],
          factionIds: [],
          locationId: null,
          sort: 'name',
          direction: 'asc',
          offset: 0,
          limit: 50
        },
        tuning: {
          difficulty: 'preset',
          amount: 'preset',
          balance: 'preset',
          diversity: 'preset'
        },
        seed: 179974,
        expectedRevision: live.scene.revision
      })
      const planner = await api.sessionPlanner.read()
      await api.sessionPlanner.save({
        sessionId: planner.session.id,
        expectedRevision: planner.session.revision,
        participantIds: party.members.map((member) => member.id),
        adventureDayFraction: '0.25',
        encounterCount: 1,
        selectedSceneId: null,
        scenes: []
      })
      return {
        custom: {
          id: custom.id,
          revision: custom.revision,
          mobThreshold: custom.config.combat.mobThreshold
        },
        activePresetId: presets.assignment?.effectivePresetId,
        assignment: presets.assignment,
        scene: {
          id: scene.context.generatorPresetId,
          revision: scene.context.generatorPresetRevision,
          hash: scene.context.generatorConfigHash
        }
      }
    })

    await (await client.$('button[aria-label="Session-Planer"]')).click()
    let plannerSurface = await client.$('section[aria-label="Session-Planer"]')
    await plannerSurface.waitForDisplayed({ timeout: 15_000 })
    await expectAccessible(client)
    await (await plannerSurface.$('button=Vorbereiten')).click()
    const queued = await plannerSurface.$('.planner-progress.state-queued')
    await queued.waitForDisplayed({ timeout: 5_000 })
    const beforeRestart = await client.execute(async () => {
      const preparation = (await window.saltMarcher.sessionPlanner.read())
        .preparation
      if (!preparation) throw new Error('Queued preparation is missing')
      return {
        operationId: preparation.operationId,
        status: preparation.status
      }
    })
    expect(beforeRestart.status).toBe('queued')

    await client.reloadSession()
    await (
      await client.$('h1=Session · Preset E2E')
    ).waitForExist({
      timeout: 30_000
    })
    await (await client.$('button[aria-label="Session-Planer"]')).click()
    plannerSurface = await client.$('section[aria-label="Session-Planer"]')
    await plannerSurface.waitForDisplayed({ timeout: 15_000 })
    await client.execute(() => {
      const root = document.documentElement
      const record = () => {
        const progress =
          document.querySelector<HTMLElement>('.planner-progress')
        if (!progress) return
        const history = JSON.parse(
          root.dataset['plannerStageHistory'] ?? '[]'
        ) as string[]
        const stage = [...progress.classList].find((entry) =>
          entry.startsWith('state-')
        )
        if (stage && history.at(-1) !== stage)
          root.dataset['plannerStageHistory'] = JSON.stringify([
            ...history,
            stage
          ])
      }
      root.dataset['plannerStageHistory'] = '[]'
      record()
      new MutationObserver(record).observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
        childList: true,
        subtree: true
      })
    })
    await client.waitUntil(
      async () => {
        try {
          return await client
            .$('.session-planner .planner-progress.state-ready')
            .isDisplayed()
        } catch {
          return false
        }
      },
      {
        timeout: 45_000,
        interval: 250,
        timeoutMsg: 'Planner did not finish after the Electron restart.'
      }
    )

    const afterRestart = await client.execute(async (operationId) => {
      const api = window.saltMarcher
      const found = await api.sessionPlanner.preparationReceipt({ operationId })
      if (!found.receipt)
        throw new Error('Planner receipt missing after restart')
      const workspace = await api.sessionPlanner.read()
      return {
        status: found.receipt.status,
        runId: found.receipt.runId,
        encounterBatchFingerprint: found.receipt.encounterBatchFingerprint,
        committedPlannerRevision: found.receipt.committedPlannerRevision,
        sceneCount: workspace.session.scenes.length,
        artifacts: workspace.session.scenes.map((scene) => ({
          id: scene.id,
          encounterPlanId: scene.encounterPlanId,
          rewards: scene.generatedRewards.map((reward) => ({
            runId: reward.runId,
            generatedTreasureId: reward.generatedTreasureId
          }))
        })),
        stages: JSON.parse(
          document.documentElement.dataset['plannerStageHistory'] ?? '[]'
        ) as string[]
      }
    }, beforeRestart.operationId)

    expect(setup.custom.mobThreshold).toBe(7)
    expect(setup.activePresetId).toBe(setup.custom.id)
    expect(setup.assignment?.assignedPresetId).toBe(setup.custom.id)
    expect(setup.scene.id).toBe(setup.custom.id)
    expect(setup.scene.revision).toBe(setup.custom.revision)
    expect(setup.scene.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(afterRestart.status).toBe('succeeded')
    expect(afterRestart.runId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(afterRestart.encounterBatchFingerprint).toMatch(/^[0-9a-f]{64}$/)
    expect(afterRestart.committedPlannerRevision).toBeGreaterThan(0)
    expect(afterRestart.sceneCount).toBeGreaterThan(0)
    const observedStages = [
      ...new Set(['state-queued', ...afterRestart.stages])
    ]
    const durableOrder = [
      'state-queued',
      'state-generating',
      'state-resolving-encounters',
      'state-saving',
      'state-ready'
    ]
    expect(observedStages[0]).toBe('state-queued')
    expect(observedStages.at(-1)).toBe('state-ready')
    expect(observedStages.map((stage) => durableOrder.indexOf(stage))).toEqual(
      [...observedStages]
        .map((stage) => durableOrder.indexOf(stage))
        .toSorted((left, right) => left - right)
    )
    expect(observedStages.every((stage) => durableOrder.includes(stage))).toBe(
      true
    )

    await clickWhenInteractable(
      client,
      async () =>
        await (
          await client.$('section[aria-label="Session-Planer"]')
        ).$('button=Vorbereiten')
    )
    let confirmation = await client.$('.planner-confirm-dialog')
    await confirmation.waitForDisplayed({ timeout: 5_000 })
    await expectAccessible(client)
    expect(
      await client.execute(() => {
        const dialog = document.querySelector('.planner-confirm-dialog')
        return Boolean(
          dialog &&
          document.activeElement instanceof HTMLElement &&
          dialog.contains(document.activeElement)
        )
      })
    ).toBe(true)
    await client.keys('Escape')
    await (
      await client.$('.planner-confirm-dialog')
    ).waitForExist({ reverse: true, timeout: 5_000 })

    await clickWhenInteractable(
      client,
      async () =>
        await (
          await client.$('section[aria-label="Session-Planer"]')
        ).$('button=Vorbereiten')
    )
    confirmation = await client.$('.planner-confirm-dialog')
    await confirmation.waitForDisplayed({ timeout: 5_000 })
    await clickWhenInteractable(
      client,
      async () =>
        await (
          await client.$('.planner-confirm-dialog')
        ).$('button=Ersetzen und vorbereiten')
    )
    await (
      await plannerSurface.$('.planner-progress.state-generating')
    ).waitForDisplayed({ timeout: 10_000 })
    const interruptedOperation = await client.execute(async () => {
      const preparation = (await window.saltMarcher.sessionPlanner.read())
        .preparation
      if (!preparation) throw new Error('Active preparation is missing')
      return preparation.operationId
    })
    const utilityTerminated = await client.execute(async () => {
      const e2eWindow = window as typeof window & {
        __saltMarcherE2e?: Readonly<{
          terminateUtility: () => Promise<boolean>
        }>
      }
      return (await e2eWindow.__saltMarcherE2e?.terminateUtility()) ?? false
    })
    expect(utilityTerminated).toBe(true)
    await client.setTimeout({ script: 5_000 })
    try {
      await client.waitUntil(
        async () => {
          try {
            return (
              (await client.execute(async () =>
                window.saltMarcher.runtime.coreStatus()
              )) !== 'ready'
            )
          } catch {
            return false
          }
        },
        {
          timeout: 10_000,
          interval: 100,
          timeoutMsg: 'Utility did not enter its restart transition.'
        }
      )
      await client.waitUntil(
        async () => {
          try {
            return (
              (await client.execute(async () =>
                window.saltMarcher.runtime.coreStatus()
              )) === 'ready'
            )
          } catch {
            return false
          }
        },
        {
          timeout: 45_000,
          interval: 250,
          timeoutMsg: 'Utility did not become ready after the restart.'
        }
      )
      await client.waitUntil(
        async () => {
          try {
            const proof = await client.execute(async (operationId) => {
              const receipt =
                await window.saltMarcher.sessionPlanner.preparationReceipt({
                  operationId
                })
              if (receipt.receipt?.status !== 'succeeded') return null
              const workspace = await window.saltMarcher.sessionPlanner.read()
              return {
                status: receipt.receipt.status,
                artifacts: workspace.session.scenes.map((scene) => ({
                  id: scene.id,
                  encounterPlanId: scene.encounterPlanId,
                  rewards: scene.generatedRewards.map((reward) => ({
                    runId: reward.runId,
                    generatedTreasureId: reward.generatedTreasureId
                  }))
                }))
              }
            }, interruptedOperation)
            return proof !== null
          } catch {
            return false
          }
        },
        {
          timeout: 45_000,
          interval: 250,
          timeoutMsg: 'Planner did not recover after the Utility restart.'
        }
      )
    } finally {
      await client.setTimeout({ script: 30_000 })
    }
    const resumed = await client.execute(async (operationId) => {
      const receipt =
        await window.saltMarcher.sessionPlanner.preparationReceipt({
          operationId
        })
      const workspace = await window.saltMarcher.sessionPlanner.read()
      return {
        status: receipt.receipt?.status ?? null,
        artifacts: workspace.session.scenes.map((scene) => ({
          id: scene.id,
          encounterPlanId: scene.encounterPlanId,
          rewards: scene.generatedRewards.map((reward) => ({
            runId: reward.runId,
            generatedTreasureId: reward.generatedTreasureId
          }))
        }))
      }
    }, interruptedOperation)
    expect(resumed.status).toBe('succeeded')
    expect(resumed.artifacts).toEqual(afterRestart.artifacts)
    await (
      await client.$('section[aria-label="Session-Planer"]')
    ).waitForDisplayed({ timeout: 10_000 })
  })
})
