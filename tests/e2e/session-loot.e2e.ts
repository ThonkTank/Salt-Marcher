import { browser, expect } from '@wdio/globals'
import type {
  Browser as WdioBrowser,
  Element as WdioElement
} from 'webdriverio'
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
    const groupProof = await client.execute(async () => {
      const api = window.saltMarcher
      let live = await api.session.read()
      const sceneId = live.scene.focusedSceneId
      for (const member of live.party.members.filter((entry) => entry.active)) {
        const scene = live.scene.scenes.find((entry) => entry.id === sceneId)!
        if (!scene.partyMemberIds.includes(member.id))
          live = await api.scene.assignPartyMember({
            sceneId,
            partyMemberId: member.id,
            assigned: true,
            expectedRevision: live.scene.revision
          })
      }
      await api.scene.saveGroup({
        sceneId,
        groupId: null,
        name: 'E2E Gruppenbeute',
        note: '',
        disposition: 'hostile',
        entries: [{ creatureId: 'wolf', quantity: 3 }],
        expectedRevision: live.scene.revision,
        expectedGroupRevision: null
      })
      live = await api.session.read()
      const group = live.scene.scenes
        .find((entry) => entry.id === sceneId)!
        .groups.find((entry) => entry.name === 'E2E Gruppenbeute')!
      const baseRules = await api.campaignRules.read()
      const request = {
        sceneId,
        groupId: group.id,
        expectedSceneRevision: live.scene.revision,
        expectedGroupRevision: group.revision,
        entries: group.entries.map((entry) => ({
          creatureId: entry.creatureId,
          quantity: entry.aliveQuantity,
          deadQuantity: entry.deadQuantity
        })),
        expectedPartyRevision: live.party.revision,
        expectedCampaignRulesRevision: baseRules.revision,
        seed: 9_001
      }
      const base = await api.loot.generateForGroupDraft(request)
      const adjustedRules = await api.campaignRules.update({
        commandId: crypto.randomUUID(),
        expectedRevision: baseRules.revision,
        rewardXpBasis: 'adjusted'
      })
      let staleProtected = false
      try {
        await api.loot.generateForGroupDraft({ ...request, seed: 9_002 })
      } catch (cause) {
        staleProtected =
          (cause as { code?: unknown }).code === 'stale' ||
          (cause instanceof Error && cause.message.includes('stale'))
      }
      const adjusted = await api.loot.generateForGroupDraft({
        ...request,
        expectedCampaignRulesRevision: adjustedRules.revision,
        seed: 9_002
      })
      const generated = adjusted.run.treasures[0]!
      let treasure = await api.loot.acceptGenerated({
        commandId: crypto.randomUUID(),
        runId: adjusted.run.id,
        generatedTreasureId: generated.id,
        label: 'E2E Gruppenfund',
        anchor: {
          kind: 'group',
          sceneId,
          groupId: group.id,
          lastKnownLabel: group.name
        }
      })
      treasure = await api.loot.update({
        commandId: crypto.randomUUID(),
        treasureId: treasure.id,
        expectedRevision: treasure.revision,
        label: 'E2E Gruppenfund bearbeitet',
        anchor: treasure.anchor,
        containers: treasure.containers.map((container) => ({
          id: container.id,
          catalogContainerId: container.catalogContainerId,
          name: container.name,
          capacity: container.capacity
        })),
        items: treasure.items.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unitValueCp: item.unitValueCp,
          stackable: item.stackable,
          containerId: item.containerId
        }))
      })
      treasure = await api.loot.move({
        commandId: crypto.randomUUID(),
        treasureId: treasure.id,
        expectedRevision: treasure.revision,
        anchor: { kind: 'unplaced' }
      })
      const recipient = live.party.members.find((member) => member.active)!
      const distributed = await api.loot.distribute({
        commandId: crypto.randomUUID(),
        treasureId: treasure.id,
        expectedTreasureRevision: treasure.revision,
        expectedPartyRevision: live.party.revision,
        items: treasure.items.map((item) => ({
          itemId: item.id,
          shares: [{ characterId: recipient.id, quantity: item.quantity }]
        }))
      })
      const ledger = await api.loot.ledger({ characterId: recipient.id })
      return {
        groupName: group.name,
        baseBasis: base.run.input.rewardXpBasis,
        baseRewardXp: base.run.input.rewardXp,
        adjustedBasis: adjusted.run.input.rewardXpBasis,
        adjustedRewardXp: adjusted.run.input.rewardXp,
        adjustedXp: adjusted.run.input.adjustedXp,
        staleProtected,
        label: distributed.treasure.label,
        anchorKind: distributed.treasure.anchor.kind,
        distributionState: distributed.treasure.distributionState,
        ledgerContainsGroupReward: ledger.entries.some(
          (entry) => entry.rewardProvenance?.runId === adjusted.run.id
        )
      }
    })
    expect(groupProof).toMatchObject({
      baseBasis: 'base',
      adjustedBasis: 'adjusted',
      staleProtected: true,
      label: 'E2E Gruppenfund bearbeitet',
      anchorKind: 'unplaced',
      distributionState: 'complete',
      ledgerContainsGroupReward: true
    })
    expect(groupProof.adjustedRewardXp).toBe(groupProof.adjustedXp)
    expect(groupProof.adjustedRewardXp).toBeGreaterThanOrEqual(
      groupProof.baseRewardXp
    )

    await client.refresh()
    await waitForGmRendererReady(client)
    await (await client.$('button=Gruppen managen')).click()
    const groupDialog = await client.$(
      'section[aria-labelledby="group-builder-title"]'
    )
    await groupDialog.waitForDisplayed({ timeout: 10_000 })
    await (
      await groupDialog.$('select[aria-label="Gruppe auswählen"]')
    ).selectByVisibleText(groupProof.groupName)
    const openGenerator = await groupDialog.$('button=Loot erzeugen')
    await client.waitUntil(() => openGenerator.isEnabled(), {
      timeout: 10_000,
      timeoutMsg: 'Group Loot generator did not become available.'
    })
    await openGenerator.click()
    const groupLootPanel = await groupDialog.$('.group-loot-inline-panel')
    await (
      await groupLootPanel.$('.generated-loot-results')
    ).waitForDisplayed({ timeout: 15_000 })
    expect(await groupLootPanel.getText()).toContain('Angepasste XP')
    const budgetBefore = Number(
      await (
        await groupLootPanel.$('.group-loot-budget-meter')
      ).getAttribute('aria-valuenow')
    )
    await (await groupDialog.$('[role="tab"]=Loot')).click()
    const lootCatalog = await groupDialog.$('.loot-catalog-pane')
    await lootCatalog.waitForDisplayed({ timeout: 10_000 })
    const lootSearch = await lootCatalog.$('input[type="search"]')
    await lootSearch.setValue('Abacus')
    const addAbacus = await lootCatalog.$(
      'button[aria-label="Abacus hinzufügen"]'
    )
    await addAbacus.waitForClickable({ timeout: 10_000 })
    await addAbacus.click()
    await lootSearch.setValue('Bead of Nourishment')
    const addMagic = await lootCatalog.$(
      'button[aria-label="Bead of Nourishment hinzufügen"]'
    )
    await addMagic.waitForClickable({ timeout: 10_000 })
    await addMagic.click()
    await lootSearch.setValue('Pouch')
    const addContainer = await lootCatalog.$(
      'button[aria-label="Pouch hinzufügen"]'
    )
    await addContainer.waitForClickable({ timeout: 10_000 })
    await addContainer.click()

    const itemRows = await groupLootPanel.$$('.treasure-item-editor-row')
    let abacusRow: WdioElement | undefined
    for (const row of itemRows)
      if (
        (await (await row.$('input[aria-label="Gegenstand"]')).getValue()) ===
        'Abacus'
      )
        abacusRow = row
    expect(abacusRow).toBeDefined()
    if (abacusRow === undefined) throw new Error('Catalog Abacus row missing')
    await (
      await abacusRow.$('input[aria-label="Gegenstand"]')
    ).setValue('E2E Reise-Abakus')
    await (await abacusRow.$('input[aria-label="Teilbar"]')).click()
    await (await abacusRow.$('input[aria-label="Menge"]')).setValue('2')
    await (
      await abacusRow.$('input[aria-label="Wert in Kupfermünzen"]')
    ).setValue('321')

    const containerRows = await groupLootPanel.$$(
      '.treasure-container-editor-row'
    )
    let catalogContainer: WdioElement | undefined
    for (const row of containerRows)
      if (
        (await (await row.$('input[aria-label="Behälter"]')).getValue()) ===
        'Pouch'
      )
        catalogContainer = row
    expect(catalogContainer).toBeDefined()
    if (catalogContainer === undefined)
      throw new Error('Catalog Pouch row missing')
    await (
      await catalogContainer.$('input[aria-label="Behälter"]')
    ).setValue('E2E Lootkiste')
    await (
      await catalogContainer.$('input[aria-label="Kapazität"]')
    ).setValue('99')
    await client.waitUntil(
      async () =>
        (
          await (await abacusRow.$('select[aria-label="Behälter"]')).getText()
        ).includes('E2E Lootkiste'),
      {
        timeout: 10_000,
        timeoutMsg: 'Renamed catalog container did not reach item assignments'
      }
    )
    await (
      await abacusRow.$('select[aria-label="Behälter"]')
    ).selectByVisibleText('E2E Lootkiste')

    const budgetAfter = Number(
      await (
        await groupLootPanel.$('.group-loot-budget-meter')
      ).getAttribute('aria-valuenow')
    )
    expect(budgetAfter).not.toBe(budgetBefore)
    expect(await groupLootPanel.getText()).toContain('Magie Ist/Soll')
    await (await groupLootPanel.$('button=Loot neu würfeln')).click()
    const discardDialog = await client.$('.discard-changes-dialog')
    await discardDialog.waitForDisplayed({ timeout: 5_000 })
    expect(await discardDialog.getText()).toContain(
      'Eigene Loot-Änderungen verwerfen?'
    )
    await (await discardDialog.$('button=Abbrechen')).click()
    await discardDialog.waitForExist({ reverse: true, timeout: 5_000 })
    expect(
      await (await abacusRow.$('input[aria-label="Gegenstand"]')).getValue()
    ).toBe('E2E Reise-Abakus')
    await expectAccessible(client)
    await expectElementGolden(
      client,
      'group-loot-preview-light',
      '.group-loot-inline-panel',
      false
    )
    await client.execute(() => {
      document.documentElement.dataset['theme'] = 'dark'
    })
    await expectElementGolden(
      client,
      'group-loot-preview-dark',
      '.group-loot-inline-panel',
      false
    )
    await (await groupLootPanel.$('button=Gruppe & Loot übernehmen')).click()
    await groupDialog.waitForExist({ reverse: true, timeout: 10_000 })
    await client.reloadSession()
    await waitForGmRendererReady(client)
    const committedGroupLoot = await client.execute(async (proof) => {
      const api = window.saltMarcher
      const live = await api.session.read()
      const scene = live.scene.scenes.find(
        (candidate) => candidate.id === live.scene.focusedSceneId
      )!
      const group = scene.groups.find(
        (candidate) => candidate.name === proof.groupName
      )!
      const projection = await api.loot.scene({ sceneId: scene.id })
      const treasures =
        projection.groupTreasures.find(
          (candidate) => candidate.groupId === group.id
        )?.treasures ?? []
      return {
        count: treasures.length,
        editedItem: treasures
          .flatMap((treasure) => treasure.items)
          .find((item) => item.name === 'E2E Reise-Abakus'),
        editedContainer: treasures
          .flatMap((treasure) => treasure.containers)
          .find((container) => container.name === 'E2E Lootkiste'),
        catalogMagic: treasures
          .flatMap((treasure) => treasure.items)
          .find(
            (item) =>
              item.catalogItemId === 'magic:arcana:common:bead-of-nourishment'
          )
      }
    }, groupProof)
    expect(committedGroupLoot.count).toBe(1)
    expect(committedGroupLoot.editedItem).toMatchObject({
      quantity: 2,
      unitValueCp: 321,
      stackable: true,
      magic: false
    })
    expect(committedGroupLoot.editedContainer).toMatchObject({ capacity: 99 })
    expect(committedGroupLoot.editedItem?.containerId).toBe(
      committedGroupLoot.editedContainer?.id
    )
    expect(committedGroupLoot.catalogMagic).toMatchObject({
      magic: true,
      rarity: 'Common',
      curseName: null
    })
  })
})
