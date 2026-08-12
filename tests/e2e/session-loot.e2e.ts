import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import {
  expectAccessible,
  expectElementGolden,
  setElectronWindowSize
} from './support/e2e-assertions.js'
import { waitForGmRendererReady } from './support/e2e-ready.js'

describe('Session Planner loot vertical slice', () => {
  it('generates, places, partially distributes, restarts, and completes the ledger', async () => {
    const client = browser as unknown as WdioBrowser
    await setElectronWindowSize(client, 1280, 800)
    const campaignName = await client.$('#campaign-name')
    await campaignName.waitForDisplayed({ timeout: 30_000 })
    await campaignName.setValue('Loot E2E')
    await (await client.$('button=Anlegen')).click()
    await (
      await client.$('h1=Session · Loot E2E')
    ).waitForExist({
      timeout: 10_000
    })

    const prepared = await client.execute(async () => {
      const api = window.saltMarcher
      let party = await api.party.read()
      for (const member of party.members)
        if (!member.active)
          party = await api.party.setMembership({
            id: member.id,
            active: true,
            expectedRevision: party.revision
          })

      let workspace = await api.sessionPlanner.read()
      workspace = await api.sessionPlanner.save({
        sessionId: workspace.session.id,
        expectedRevision: workspace.session.revision,
        participantIds: party.members.map((member) => member.id),
        adventureDayFraction: '0.6',
        encounterCount: 3,
        selectedSceneId: workspace.session.selectedSceneId,
        scenes: workspace.session.scenes.map((scene) => ({
          id: scene.id,
          titleKind: scene.titleKind,
          title: scene.title,
          notes: scene.notes,
          locationId: scene.locationId,
          encounterPlanId: scene.encounterPlanId,
          allocatedXp: scene.allocatedXp,
          position: scene.position,
          restAfter: scene.restAfter,
          manualLootNotes: scene.manualLootNotes,
          generatedRewards: scene.generatedRewards.map((reward) => ({
            runId: reward.runId,
            generatedTreasureId: reward.generatedTreasureId,
            rewardChannel: reward.rewardChannel,
            anchorEncounterNumber: reward.anchorEncounterNumber,
            treasureOrdinal: reward.treasureOrdinal,
            position: reward.position
          }))
        }))
      })
      const operationId = crypto.randomUUID()
      const preparationRequest = {
        operationId,
        sessionId: workspace.session.id,
        expectedRevision: workspace.session.revision,
        seed: 179_974,
        confirmedReplacement: false
      }
      let began = await api.sessionPlanner.startPreparation(preparationRequest)
      if (began.status === 'confirmation_required')
        began = await api.sessionPlanner.startPreparation({
          ...preparationRequest,
          confirmedReplacement: true
        })
      if (began.status !== 'accepted')
        throw new Error(`Preparation did not begin: ${began.status}`)
      let receipt = began.receipt
      for (let attempt = 0; attempt < 200; attempt += 1) {
        if (
          ['succeeded', 'invalid', 'stale', 'failed', 'canceled'].includes(
            receipt.status
          )
        )
          break
        await new Promise((resolve) => setTimeout(resolve, 25))
        const result = await api.sessionPlanner.preparationReceipt({
          operationId
        })
        if (!result.receipt) throw new Error('Preparation receipt disappeared.')
        receipt = result.receipt
      }
      if (receipt.status !== 'succeeded')
        throw new Error(`Session did not commit: ${receipt.status}`)
      const committedWorkspace = await api.sessionPlanner.read()

      const rewardChoice = committedWorkspace.session.scenes
        .flatMap((scene) =>
          scene.generatedRewards.map((reward) => ({ scene, reward }))
        )
        .find(
          ({ reward }) =>
            reward.generatedTreasure !== null &&
            reward.generatedTreasure.items.reduce(
              (total, item) => total + item.quantity,
              0
            ) >= 2
        )
      const rewardScene = rewardChoice?.scene
      const reward = rewardChoice?.reward
      if (!rewardScene || !reward?.generatedTreasure)
        throw new Error('Generated reward is missing from the planner.')

      workspace = await api.sessionPlanner.save({
        sessionId: committedWorkspace.session.id,
        expectedRevision: committedWorkspace.session.revision,
        participantIds: committedWorkspace.session.participantIds,
        adventureDayFraction: committedWorkspace.session.adventureDayFraction,
        encounterCount: committedWorkspace.session.encounterCount,
        selectedSceneId: rewardScene.id,
        scenes: committedWorkspace.session.scenes.map((scene) => ({
          id: scene.id,
          titleKind: scene.titleKind,
          title: scene.title,
          notes: scene.notes,
          locationId: scene.locationId,
          encounterPlanId: scene.encounterPlanId,
          allocatedXp: scene.allocatedXp,
          position: scene.position,
          restAfter: scene.restAfter,
          manualLootNotes: scene.manualLootNotes,
          generatedRewards: scene.generatedRewards.map((candidate) => ({
            runId: candidate.runId,
            generatedTreasureId: candidate.generatedTreasureId,
            rewardChannel: candidate.rewardChannel,
            anchorEncounterNumber: candidate.anchorEncounterNumber,
            treasureOrdinal: candidate.treasureOrdinal,
            position: candidate.position
          }))
        }))
      })
      const treasure = await api.loot.acceptGenerated({
        commandId: crypto.randomUUID(),
        runId: reward.runId,
        generatedTreasureId: reward.generatedTreasureId,
        label: 'E2E reward',
        anchor: { kind: 'unplaced' }
      })
      const partialItem =
        treasure.items.find((item) => item.quantity >= 2) ?? treasure.items[0]
      if (!partialItem)
        throw new Error('Deterministic E2E reward has no distributable item.')
      const partialQuantity =
        partialItem.quantity >= 2
          ? Math.max(1, Math.floor(partialItem.quantity / 2))
          : partialItem.quantity
      const partial = await api.loot.distribute({
        commandId: crypto.randomUUID(),
        treasureId: treasure.id,
        expectedTreasureRevision: treasure.revision,
        expectedPartyRevision: party.revision,
        items: [
          {
            itemId: partialItem.id,
            shares: [
              { characterId: party.members[0]!.id, quantity: partialQuantity }
            ]
          }
        ]
      })
      return {
        treasureId: treasure.id,
        treasureLabel: treasure.label,
        partialItemName: partialItem.name,
        characterId: party.members[0]!.id,
        partialRevision: partial.treasure.revision,
        runId: reward.runId,
        generatedTreasureId: reward.generatedTreasureId,
        encounterPlanCount: workspace.session.scenes.filter(
          (scene) => scene.encounterPlanId !== null
        ).length
      }
    })

    expect(prepared.encounterPlanCount).toBe(3)
    await (await client.$('button[aria-label="Session-Planer"]')).click()
    const planner = await client.$('.session-planner')
    await planner.waitForExist({ timeout: 15_000 })
    await expect(await client.$('.planner-reward-card')).toHaveText(
      expect.stringContaining('Einheiten offen')
    )
    await expectAccessible(client)
    await expectElementGolden(
      client,
      'session-loot-planner-light',
      '.session-planner'
    )
    await client.execute(() => {
      document.documentElement.dataset['theme'] = 'dark'
    })
    await expectElementGolden(
      client,
      'session-loot-planner-dark',
      '.session-planner'
    )

    await (await client.$('button[aria-label="Session"]')).click()
    await (await client.$('button=Nicht zugeordnete Beute öffnen')).click()
    const openTreasure = await client.$('.unplaced-loot-section')
    await openTreasure.waitForDisplayed({ timeout: 10_000 })
    await (await openTreasure.$('button=Verteilen')).click()
    const distributionDialog = await client.$('.loot-distribution-dialog')
    await distributionDialog.waitForDisplayed({ timeout: 10_000 })
    await expectAccessible(client)
    expect(
      await client.execute(() => {
        const dialog = document.querySelector('.loot-distribution-dialog')
        return Boolean(
          dialog &&
          document.activeElement instanceof HTMLElement &&
          dialog.contains(document.activeElement)
        )
      })
    ).toBe(true)
    await client.keys('Escape')
    await distributionDialog.waitForExist({ reverse: true, timeout: 5_000 })

    await client.reloadSession()
    await waitForGmRendererReady(client)
    await (
      await client.$('h1=Session · Loot E2E')
    ).waitForExist({
      timeout: 20_000
    })

    const completed = await client.execute(async (proof) => {
      const api = window.saltMarcher
      const party = await api.party.read()
      const treasure = await api.loot.read({ treasureId: proof.treasureId })
      if (treasure.revision !== proof.partialRevision)
        throw new Error('Treasure revision was not restored after restart.')
      const remaining = treasure.items.flatMap((item) => {
        const quantity = item.quantity - item.allocatedQuantity
        return quantity === 0
          ? []
          : [
              {
                itemId: item.id,
                shares: [{ characterId: proof.characterId, quantity }]
              }
            ]
      })
      const distribution = await api.loot.distribute({
        commandId: crypto.randomUUID(),
        treasureId: treasure.id,
        expectedTreasureRevision: treasure.revision,
        expectedPartyRevision: party.revision,
        items: remaining
      })
      const ledger = await api.loot.ledger({
        characterId: proof.characterId
      })
      return {
        state: distribution.treasure.distributionState,
        allocated: distribution.treasure.items.every(
          (item) => item.allocatedQuantity === item.quantity
        ),
        entryCount: ledger.entries.length,
        itemNames: ledger.entries.map((entry) => entry.itemName),
        provenance: ledger.entries.map((entry) => entry.rewardProvenance)
      }
    }, prepared)
    expect(completed.state).toBe('complete')
    expect(completed.allocated).toBe(true)
    expect(completed.entryCount).toBeGreaterThan(1)
    expect(completed.itemNames).toContain(prepared.partialItemName)
    expect(
      completed.provenance.every(
        (entry) =>
          typeof entry === 'object' &&
          entry !== null &&
          entry.runId === prepared.runId &&
          entry.generatedTreasureId === prepared.generatedTreasureId
      )
    ).toBe(true)

    await (await client.$('button[aria-label="Session"]')).click()
    await (
      await client.$('h1=Session · Loot E2E')
    ).waitForExist({
      timeout: 15_000
    })
    const lootButtons = await client.$$('button=Beute')
    expect(lootButtons.length).toBeGreaterThan(0)
    await lootButtons[0]!.click()
    const ledgerDialog = await client.$('.character-loot-dialog')
    await ledgerDialog.waitForDisplayed({ timeout: 10_000 })
    await client.waitUntil(
      async () =>
        (await ledgerDialog.getText()).includes(prepared.partialItemName),
      {
        timeout: 10_000,
        timeoutMsg: 'Character Loot ledger did not finish loading.'
      }
    )
    expect(await ledgerDialog.getText()).toContain(prepared.partialItemName)
    expect(await ledgerDialog.getText()).toContain(prepared.treasureLabel)

    await (
      await ledgerDialog.$('button[aria-label="Dialog schließen"]')
    ).click()
  })
})
