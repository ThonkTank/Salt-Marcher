import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { GeneratedEncounterPlanService } from '../../src/core/encounter/generated-plan-service.js'
import { PartyStore } from '../../src/core/party/party-store.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { GeneratedRunStore } from '../../src/core/session-generation/generated-run-store.js'
import { SessionPlannerStore } from '../../src/core/session-planner/session-planner-store.js'
import { systemGeneratorPresetId } from '../../src/shared/contracts/generator-presets.js'
import type { SaveSessionPlanInput } from '../../src/shared/contracts/session-planner.js'
import { defaultGeneratorConfig } from '../../src/shared/generator/system-generator-preset.js'
import { BundledEncounterCatalogProvider } from '../../src/utility/session-generation/catalog-provider.js'
import { SessionGenerationService } from '../../src/utility/session-generation/session-generation-service.js'
import { sha256EncounterEntropy } from '../../src/utility/session-generation/sha256-entropy.js'
import { SessionPlannerService } from '../../src/utility/session-planner/session-planner-service.js'

const roots: string[] = []
const stores: CampaignStore[] = []

afterEach(() => {
  for (const store of stores.splice(0)) store.close()
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('Session Planner vertical slice', () => {
  it('keeps the durable preparation journal schema frozen and relational', () => {
    const harness = createHarness()
    const db = harness.campaigns.activeCampaignDatabase()
    expect(columns(db, 'session_preparation_operation')).toEqual([
      'id',
      'request_fingerprint',
      'session_id',
      'expected_session_revision',
      'seed',
      'adventure_day_fraction',
      'encounter_count',
      'status',
      'run_id',
      'encounter_batch_fingerprint',
      'cancel_requested',
      'failure_stage',
      'failure_code',
      'failure_retryable',
      'committed_planner_revision',
      'created_at',
      'updated_at'
    ])
    expect(columns(db, 'session_preparation_party_level')).toEqual([
      'preparation_id',
      'level',
      'member_count'
    ])
    expect(columns(db, 'session_preparation_failure_parameter')).toEqual([
      'preparation_id',
      'parameter_key',
      'value_kind',
      'string_value',
      'number_value',
      'boolean_value'
    ])
    expect(columns(db, 'session_preparation_scene')).toEqual([
      'id',
      'preparation_id',
      'title_kind',
      'title',
      'notes',
      'location_id',
      'encounter_plan_id',
      'allocated_xp',
      'position',
      'rest_after'
    ])
    expect(columns(db, 'session_preparation_generated_reward')).toEqual([
      'preparation_id',
      'scene_id',
      'generation_run_id',
      'generated_treasure_id',
      'reward_channel',
      'anchor_encounter_number',
      'treasure_ordinal',
      'position'
    ])
    for (const table of [
      'session_preparation_operation',
      'session_preparation_party_level',
      'session_preparation_failure_parameter',
      'session_preparation_scene',
      'session_preparation_generated_reward'
    ])
      expect(columns(db, table).some((column) => /json/i.test(column))).toBe(
        false
      )
  })

  it('atomically saves a dirty source before switching the current pointer', () => {
    const harness = createHarness()
    const source = harness.planner.read()
    const target = harness.planner.create({ name: 'Ziel-Sitzung' })
    harness.planner.open({ sessionId: source.session.id })
    const sceneId = randomUUID()
    const sourceDraft = {
      ...draft(source),
      selectedSceneId: sceneId,
      scenes: [manualScene(sceneId, 'Vor dem Wechsel gespeichert')]
    }
    const switched = harness.planner.switch({
      targetSessionId: target.session.id,
      source: sourceDraft
    })
    expect(switched.currentSessionId).toBe(target.session.id)
    expect(switched.session.id).toBe(target.session.id)
    expect(
      new SessionPlannerStore(
        harness.campaigns.activeCampaignDatabase()
      ).require(source.session.id)
    ).toMatchObject({
      revision: source.session.revision + 1,
      scenes: [{ id: sceneId, title: 'Vor dem Wechsel gespeichert' }]
    })
  })

  it('persists manual planning and rehydrates it after a campaign restart', () => {
    const harness = createHarness()
    const initial = harness.planner.read()
    const firstSceneId = randomUUID()
    const secondSceneId = randomUUID()
    const noteId = randomUUID()
    const saved = harness.planner.save({
      ...draft(initial),
      participantIds: harness.memberIds,
      adventureDayFraction: '0.6',
      encounterCount: 3,
      selectedSceneId: secondSceneId,
      scenes: [
        {
          id: firstSceneId,
          title: 'Ankunft',
          notes: 'Nebel am Kai',
          locationId: null,
          encounterPlanId: null,
          allocatedXp: 0,
          position: 0,
          restAfter: 'short',
          manualLootNotes: [
            { id: noteId, text: 'Schlüssel im Treibgut', position: 0 }
          ],
          generatedRewards: []
        },
        {
          id: secondSceneId,
          title: 'Leuchtturm',
          notes: '',
          locationId: null,
          encounterPlanId: null,
          allocatedXp: 0,
          position: 1,
          restAfter: null,
          manualLootNotes: [],
          generatedRewards: []
        }
      ]
    })
    expect(saved.session.revision).toBe(1)

    harness.campaigns.close()
    stores.splice(stores.indexOf(harness.campaigns), 1)
    const reopenedCampaigns = new CampaignStore(harness.root)
    stores.push(reopenedCampaigns)
    const reopened = services(reopenedCampaigns).planner.read()

    expect(reopened.session).toMatchObject({
      id: initial.session.id,
      revision: 1,
      participantIds: harness.memberIds,
      adventureDayFraction: '0.6',
      encounterCount: 3,
      selectedSceneId: secondSceneId
    })
    expect(reopened.session.scenes).toMatchObject([
      {
        id: firstSceneId,
        restAfter: 'short',
        manualLootNotes: [
          { id: noteId, text: 'Schlüssel im Treibgut', position: 0 }
        ]
      },
      { id: secondSceneId, restAfter: null }
    ])
  })

  it('prepares one complete editable session and stores normalized immutable owners', () => {
    const harness = createHarness()
    const authored = saveGenerationInput(harness)
    const operationId = randomUUID()

    expect(
      harness.planner.startPreparation({
        operationId,
        sessionId: authored.session.id,
        expectedRevision: authored.session.revision,
        seed: 179_974,
        confirmedReplacement: false
      })
    ).toMatchObject({ status: 'accepted', receipt: { status: 'queued' } })
    harness.planner.runPreparationWorker(operationId)
    expect(
      harness.planner.preparationReceipt({ operationId }).receipt
    ).toMatchObject({ status: 'succeeded', committedPlannerRevision: 2 })

    const workspace = harness.planner.read()
    const encounterScenes = workspace.session.scenes.filter(
      (scene) => scene.encounterPlanId !== null
    )
    expect(encounterScenes).toHaveLength(3)
    expect(
      encounterScenes.every((scene) => scene.encounter?.status === 'ready')
    ).toBe(true)
    expect(
      workspace.session.scenes
        .flatMap((scene) => scene.generatedRewards)
        .every(
          (reward) =>
            reward.status === 'ready' && reward.generatedTreasure !== null
        )
    ).toBe(true)

    const db = harness.campaigns.activeCampaignDatabase()
    const runRow = db
      .prepare('SELECT id FROM session_generation_run')
      .get() as { id: string }
    const run = new GeneratedRunStore(db).read(runRow.id)!
    if (run.runKind !== 'session') throw new Error('Expected session run')
    const immutableRun = structuredClone(run)
    expect(
      workspace.session.scenes.flatMap((scene) => scene.generatedRewards)
    ).toHaveLength(run.treasures.length)
    expect(tableCount(db, 'session_generation_encounter')).toBe(
      run.encounters.length
    )
    expect(tableCount(db, 'session_generation_treasure')).toBe(
      run.treasures.length
    )
    expect(tableCount(db, 'session_generation_item')).toBe(
      run.treasures.flatMap((treasure) => treasure.items).length
    )
    expect(tableCount(db, 'saved_encounter_plans')).toBe(3)
    expect(
      columns(db, 'session_generation_run').some(
        (column) => column === 'run_json'
      )
    ).toBe(false)

    const duplicate = harness.generation.generate({
      party: [
        { level: 3, count: 2 },
        { level: 4, count: 2 }
      ],
      adventureDayFraction: '0.6',
      encounterCount: 3,
      seed: 179_974
    })
    expect(duplicate.status).toBe('success')
    if (duplicate.status === 'success')
      expect(duplicate.run.id).not.toBe(run.id)
    expect(tableCount(db, 'session_generation_run')).toBe(2)

    harness.campaigns.close()
    stores.splice(stores.indexOf(harness.campaigns), 1)
    const reopenedCampaigns = new CampaignStore(harness.root)
    stores.push(reopenedCampaigns)
    const reopenedDb = reopenedCampaigns.activeCampaignDatabase()
    expect(new GeneratedRunStore(reopenedDb).read(run.id)).toEqual(immutableRun)
    expect(
      services(reopenedCampaigns)
        .planner.read()
        .session.scenes.flatMap((scene) => scene.generatedRewards)
    ).toEqual(
      workspace.session.scenes.flatMap((scene) => scene.generatedRewards)
    )
  })

  it('resumes a durable preparation across utility service restarts', () => {
    const harness = createHarness()
    const authored = saveGenerationInput(harness)
    const operationId = randomUUID()
    expect(
      harness.planner.startPreparation({
        operationId,
        sessionId: authored.session.id,
        expectedRevision: authored.session.revision,
        seed: 42_424,
        confirmedReplacement: false
      })
    ).toMatchObject({ status: 'accepted', receipt: { status: 'queued' } })
    const queuedPreparation = harness.planner.read().preparation
    expect(queuedPreparation).toMatchObject({
      operationId,
      sessionId: authored.session.id,
      status: 'queued',
      seed: 42_424,
      runId: null,
      encounterBatchFingerprint: null,
      cancelRequested: false,
      committedPlannerRevision: null,
      failure: null
    })
    expect(typeof queuedPreparation?.updatedAt).toBe('string')

    const afterRestart = services(harness.campaigns).planner
    afterRestart.recoverPendingPreparations()
    afterRestart.runPreparationWorker(operationId)
    expect(
      afterRestart.preparationReceipt({ operationId }).receipt
    ).toMatchObject({
      status: 'succeeded'
    })
    expect(
      harness.campaigns
        .activeCampaignDatabase()
        .prepare(
          'SELECT status FROM session_preparation_operation WHERE id = ?'
        )
        .get(operationId)
    ).toEqual({ status: 'succeeded' })
  })

  it('reuses semantic artifacts across consecutive replacement preparations', () => {
    const harness = createHarness()
    const authored = saveGenerationInput(harness)
    const firstOperationId = randomUUID()
    expect(
      harness.planner.startPreparation({
        operationId: firstOperationId,
        sessionId: authored.session.id,
        expectedRevision: authored.session.revision,
        seed: 179_974,
        confirmedReplacement: false
      }).status
    ).toBe('accepted')
    harness.planner.runPreparationWorker(firstOperationId)
    const first = harness.planner.read()
    const firstArtifacts = first.session.scenes.map((scene) => ({
      id: scene.id,
      encounterPlanId: scene.encounterPlanId,
      rewards: scene.generatedRewards.map((reward) => ({
        runId: reward.runId,
        generatedTreasureId: reward.generatedTreasureId
      }))
    }))

    const secondOperationId = randomUUID()
    expect(
      harness.planner.startPreparation({
        operationId: secondOperationId,
        sessionId: first.session.id,
        expectedRevision: first.session.revision,
        seed: 179_974,
        confirmedReplacement: true
      }).status
    ).toBe('accepted')
    harness.planner.runPreparationWorker(secondOperationId)
    expect(
      harness.planner.preparationReceipt({ operationId: secondOperationId })
        .receipt
    ).toMatchObject({ status: 'succeeded' })
    expect(
      harness.planner.read().session.scenes.map((scene) => ({
        id: scene.id,
        encounterPlanId: scene.encounterPlanId,
        rewards: scene.generatedRewards.map((reward) => ({
          runId: reward.runId,
          generatedTreasureId: reward.generatedTreasureId
        }))
      }))
    ).toEqual(firstArtifacts)

    const db = harness.campaigns.activeCampaignDatabase()
    expect(tableCount(db, 'session_generation_run')).toBe(1)
    expect(tableCount(db, 'generated_encounter_plan_batches')).toBe(1)
    expect(tableCount(db, 'saved_encounter_plans')).toBe(3)
    expect(tableCount(db, 'session_preparation_scene')).toBe(
      firstArtifacts.length * 2
    )
  })

  it.each([
    'before_generation',
    'after_run_commit',
    'after_encounter_commit',
    'before_planner_commit',
    'after_planner_commit'
  ] as const)('recovers exactly once at the %s boundary', (boundary) => {
    const harness = createHarness()
    const authored = saveGenerationInput(harness)
    const operationId = randomUUID()
    const interrupted = services(harness.campaigns, (phase) => {
      if (phase === boundary) throw new Error(`interrupt:${phase}`)
    }).planner
    expect(
      interrupted.startPreparation({
        operationId,
        sessionId: authored.session.id,
        expectedRevision: authored.session.revision,
        seed: 91_000,
        confirmedReplacement: false
      }).status
    ).toBe('accepted')
    if (boundary === 'after_planner_commit')
      expect(() => interrupted.runPreparationWorker(operationId)).not.toThrow()
    else
      expect(() => interrupted.runPreparationWorker(operationId)).toThrow(
        `interrupt:${boundary}`
      )

    const resumed = services(harness.campaigns).planner
    resumed.runPreparationWorker(operationId)
    expect(resumed.preparationReceipt({ operationId }).receipt).toMatchObject({
      status: 'succeeded'
    })
    const db = harness.campaigns.activeCampaignDatabase()
    expect(tableCount(db, 'session_generation_run')).toBe(1)
    expect(tableCount(db, 'generated_encounter_plan_batches')).toBe(1)
    expect(tableCount(db, 'saved_encounter_plans')).toBe(3)
    const sceneIds = resumed.read().session.scenes.map((scene) => scene.id)
    expect(new Set(sceneIds).size).toBe(sceneIds.length)
  })

  it('keeps authored truth when final preparation compare-and-swap is stale', () => {
    const harness = createHarness()
    const authored = saveGenerationInput(harness)
    const operationId = randomUUID()
    expect(
      harness.planner.startPreparation({
        operationId,
        sessionId: authored.session.id,
        expectedRevision: authored.session.revision,
        seed: 680,
        confirmedReplacement: false
      }).status
    ).toBe('accepted')

    const sceneId = randomUUID()
    const concurrent = harness.planner.save({
      ...draft(authored),
      selectedSceneId: sceneId,
      scenes: [manualScene(sceneId, 'Zeitgleich ergänzt')]
    })
    harness.planner.runPreparationWorker(operationId)
    expect(
      harness.planner.preparationReceipt({ operationId }).receipt
    ).toMatchObject({
      status: 'stale',
      failure: { stage: 'saving', code: 'session_revision_changed' }
    })
    expect(harness.planner.read().session).toMatchObject({
      revision: concurrent.session.revision,
      scenes: [{ id: sceneId, title: 'Zeitgleich ergänzt' }]
    })
    expect(
      tableCount(
        harness.campaigns.activeCampaignDatabase(),
        'saved_encounter_plans'
      )
    ).toBe(3)
  })

  it('rejects a generated reward when participant XP changes before preparation', () => {
    const harness = createHarness()
    const authored = saveGenerationInput(harness)
    const operationId = randomUUID()
    let changed = false
    const planner = services(harness.campaigns, (phase) => {
      if (phase !== 'after_run_commit' || changed) return
      changed = true
      const party = new PartyStore(harness.campaigns.activeCampaignDatabase())
      const snapshot = party.read()
      party.adjustXp(harness.memberIds[0]!, 1, snapshot.revision)
    }).planner

    expect(
      planner.startPreparation({
        operationId,
        sessionId: authored.session.id,
        expectedRevision: authored.session.revision,
        seed: 681,
        confirmedReplacement: false
      }).status
    ).toBe('accepted')
    planner.runPreparationWorker(operationId)

    expect(planner.preparationReceipt({ operationId }).receipt).toMatchObject({
      status: 'stale',
      failure: { stage: 'validation', code: 'reward_basis_changed' }
    })
    expect(
      tableCount(
        harness.campaigns.activeCampaignDatabase(),
        'saved_encounter_plans'
      )
    ).toBe(0)
  })

  it('cancels before the final planner write without compensating foreign artifacts', () => {
    const harness = createHarness()
    const authored = saveGenerationInput(harness)
    const operationId = randomUUID()
    expect(
      harness.planner.startPreparation({
        operationId,
        sessionId: authored.session.id,
        expectedRevision: authored.session.revision,
        seed: 1_800,
        confirmedReplacement: false
      }).status
    ).toBe('accepted')
    expect(harness.planner.cancelPreparation({ operationId })).toMatchObject({
      receipt: { status: 'canceled', cancelRequested: true }
    })
    harness.planner.runPreparationWorker(operationId)
    expect(harness.planner.read().session.scenes).toEqual([])
    const db = harness.campaigns.activeCampaignDatabase()
    expect(tableCount(db, 'session_generation_run')).toBe(0)
    expect(tableCount(db, 'saved_encounter_plans')).toBe(0)
  })

  it('requires explicit replacement confirmation and binds an operation to one request', () => {
    const harness = createHarness()
    const initial = saveGenerationInput(harness)
    const sceneId = randomUUID()
    const authored = harness.planner.save({
      ...draft(initial),
      selectedSceneId: sceneId,
      scenes: [manualScene(sceneId, 'Bestehende Szene')]
    })
    const operationId = randomUUID()
    const request = {
      operationId,
      sessionId: authored.session.id,
      expectedRevision: authored.session.revision,
      seed: 8_001,
      confirmedReplacement: false
    }
    expect(harness.planner.startPreparation(request)).toEqual({
      status: 'confirmation_required',
      operationId,
      code: 'planner_replace_existing',
      parameters: { sceneCount: 1 }
    })
    const accepted = harness.planner.startPreparation({
      ...request,
      confirmedReplacement: true
    })
    expect(accepted).toMatchObject({
      status: 'accepted',
      receipt: { operationId, status: 'queued' }
    })
    expect(
      harness.planner.startPreparation({
        ...request,
        confirmedReplacement: true
      })
    ).toEqual(accepted)
    try {
      harness.planner.startPreparation({
        ...request,
        seed: request.seed + 1,
        confirmedReplacement: true
      })
      throw new Error('Expected idempotency conflict')
    } catch (cause) {
      expect(cause).toMatchObject({ code: 'idempotency_conflict' })
    }
  })

  it('records a late cancel request but lets an already-started final commit win', () => {
    const harness = createHarness()
    const authored = saveGenerationInput(harness)
    const operationId = randomUUID()
    const interrupted = services(harness.campaigns, (phase) => {
      if (phase === 'before_planner_commit')
        throw new Error('pause-before-commit')
    }).planner
    expect(
      interrupted.startPreparation({
        operationId,
        sessionId: authored.session.id,
        expectedRevision: authored.session.revision,
        seed: 8_002,
        confirmedReplacement: false
      }).status
    ).toBe('accepted')
    expect(() => interrupted.runPreparationWorker(operationId)).toThrow(
      'pause-before-commit'
    )
    expect(interrupted.cancelPreparation({ operationId })).toMatchObject({
      receipt: { status: 'saving', cancelRequested: true }
    })

    const resumed = services(harness.campaigns).planner
    resumed.runPreparationWorker(operationId)
    expect(resumed.preparationReceipt({ operationId }).receipt).toMatchObject({
      status: 'succeeded',
      cancelRequested: true,
      committedPlannerRevision: 2
    })
    expect(resumed.read().session.scenes.length).toBeGreaterThan(0)
  })

  it('keeps the warmed complete preparation p95 below two seconds', () => {
    const harness = createHarness()
    saveGenerationInput(harness)
    const durations: number[] = []
    for (let seed = 10_000; seed < 10_020; seed += 1) {
      const target = harness.planner.read().session
      const operationId = randomUUID()
      const startedAt = performance.now()
      expect(
        harness.planner.startPreparation({
          operationId,
          sessionId: target.id,
          expectedRevision: target.revision,
          seed,
          confirmedReplacement: target.scenes.length > 0
        }).status
      ).toBe('accepted')
      harness.planner.runPreparationWorker(operationId)
      expect(
        harness.planner.preparationReceipt({ operationId }).receipt?.status
      ).toBe('succeeded')
      durations.push(performance.now() - startedAt)
    }
    const ordered = durations.toSorted((left, right) => left - right)
    const p95 = ordered[Math.ceil(ordered.length * 0.95) - 1]!
    expect(p95).toBeLessThan(2_000)
  }, 15_000)
})

function createHarness() {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-planner-'))
  roots.push(root)
  const campaigns = new CampaignStore(root)
  stores.push(campaigns)
  campaigns.create('Planner test')
  const party = new PartyStore(campaigns.activeCampaignDatabase())
  let snapshot = party.read()
  for (const [position, member] of snapshot.members.entries()) {
    const level = position < 2 ? 3 : 4
    snapshot = party.update(
      member.id,
      {
        name: member.name,
        playerName: member.playerName,
        level,
        passivePerception: member.passivePerception,
        armorClass: member.armorClass,
        movementSpeedFeet: member.movementSpeedFeet
      },
      snapshot.revision
    )
    snapshot = party.setMembership(member.id, true, snapshot.revision)
  }
  const serviceSet = services(campaigns)
  return {
    root,
    campaigns,
    ...serviceSet,
    memberIds: snapshot.members.map((member) => member.id)
  }
}

function services(
  campaigns: CampaignStore,
  phaseBoundary: ConstructorParameters<typeof SessionPlannerService>[5] = () =>
    undefined
) {
  const activeDatabase = () => campaigns.activeCampaignDatabase()
  const generation = new SessionGenerationService(
    new BundledEncounterCatalogProvider(
      join(process.cwd(), 'resources/sessiongeneration/catalog-2026-07-16')
    ),
    sha256EncounterEntropy,
    () => ({
      id: systemGeneratorPresetId,
      revision: 0,
      config: defaultGeneratorConfig
    }),
    activeDatabase,
    () => new Date('2026-08-09T10:00:00.000Z')
  )
  const encounterPlans = new GeneratedEncounterPlanService(activeDatabase)
  return {
    generation,
    encounterPlans,
    planner: new SessionPlannerService(
      activeDatabase,
      generation,
      encounterPlans,
      () => undefined,
      () => undefined,
      phaseBoundary
    )
  }
}

function saveGenerationInput(harness: ReturnType<typeof createHarness>) {
  const current = harness.planner.read()
  return harness.planner.save({
    ...draft(current),
    participantIds: harness.memberIds,
    adventureDayFraction: '0.6',
    encounterCount: 3
  })
}

function draft(
  workspace: ReturnType<SessionPlannerService['read']>
): SaveSessionPlanInput {
  return {
    sessionId: workspace.session.id,
    expectedRevision: workspace.session.revision,
    participantIds: [...workspace.session.participantIds],
    adventureDayFraction: workspace.session.adventureDayFraction,
    encounterCount: workspace.session.encounterCount,
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
      manualLootNotes: scene.manualLootNotes.map((note) => ({ ...note })),
      generatedRewards: scene.generatedRewards.map((reward) => ({
        runId: reward.runId,
        generatedTreasureId: reward.generatedTreasureId,
        rewardChannel: reward.rewardChannel,
        anchorEncounterNumber: reward.anchorEncounterNumber,
        treasureOrdinal: reward.treasureOrdinal,
        position: reward.position
      }))
    }))
  }
}

function manualScene(id: string, title: string) {
  return {
    id,
    titleKind: 'authored',
    title,
    notes: '',
    locationId: null,
    encounterPlanId: null,
    allocatedXp: 0,
    position: 0,
    restAfter: null,
    manualLootNotes: [],
    generatedRewards: []
  } as const
}

function tableCount(
  db: ReturnType<CampaignStore['activeCampaignDatabase']>,
  table: string
): number {
  return (
    db.prepare(`SELECT COUNT(*) AS value FROM ${table}`).get() as {
      value: number
    }
  ).value
}

function columns(
  db: ReturnType<CampaignStore['activeCampaignDatabase']>,
  table: string
): string[] {
  return (
    db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
      name: string
    }>
  ).map((entry) => entry.name)
}
