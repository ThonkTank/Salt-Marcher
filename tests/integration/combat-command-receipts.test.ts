import { SceneStore } from '../../src/core/scene/scene-store.js'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { applySchemaMigrations } from '../../src/core/persistence/sqlite/schema-migrations.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { seedExampleParty } from '../../src/core/party/party-example-seed.js'
import { readCampaignRules } from '../../src/core/application/campaign-rules-service.js'
import { createEncounterHandlers } from '../../src/utility/composition/live-play.js'
import { activeCampaignDatabase } from '../support/campaign-store-test-access.js'
import {
  combatCommandSchema,
  type CombatCommand
} from '../../src/shared/contracts/combat-command.js'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'salt-combat-command-'))
  const campaigns = new CampaignStore(root)
  campaigns.create('Combat receipts')
  const db = activeCampaignDatabase(campaigns)
  seedExampleParty(db)
  const play = new LivePlayService(campaigns.activeCampaignPersistence())
  const member = play.readParty().members[0]!
  play.setMembership(member.id, true, play.readParty().revision)
  for (const name of ['First wolves', 'Reinforcement']) {
    const snapshot = play.readSession()
    play.saveSceneGroup(
      snapshot.scene.focusedSceneId,
      null,
      name,
      '',
      'hostile',
      [{ creatureId: 'wolf', quantity: 2 }],
      snapshot.scene.revision,
      null
    )
  }
  return { root, campaigns, db, play, member }
}
const kinds = combatCommandSchema.shape.command.options.map(
  (option) => option.shape.kind.value
)
function request(
  h: ReturnType<typeof fixture>,
  kind: CombatCommand['command']['kind']
): CombatCommand {
  const initial = h.play.readSession()
  const sceneId = initial.scene.focusedSceneId
  const groups = initial.scene.scenes[0]!.groups
  if (kind !== 'prepare') {
    h.play.prepareCombat(sceneId, initial.scene.revision, [groups[0]!.id])
    if (
      kind !== 'rollInitiative' &&
      kind !== 'confirmInitiative' &&
      kind !== 'saveInitiative'
    ) {
      const combat = h.play.readSession().combat!
      h.play.confirmInitiative(
        combat.revision,
        combat.initiativeRows.map((entry, i) => ({
          id: entry.id,
          initiative: 10 + i
        }))
      )
    }
    if (kind === 'retreatTurn')
      h.play.advanceTurn(h.play.readSession().combat!.revision)
    if (kind === 'undo') {
      const combat = h.play.readSession().combat!
      h.play.changeHp(
        combat.revision,
        combat.cards.find((card) => !card.playerCharacter)!.id,
        1,
        false
      )
    }
    if (
      ['updateResolution', 'awardXp', 'complete', 'finishResolution'].includes(
        kind
      )
    )
      h.play.endCombat(h.play.readSession().combat!.revision)
  }
  if (kind === 'awardXp') {
    const combat = h.play.readSession().combat!
    h.play.updateResolution(
      combat.revision,
      combat.resolution!.enemies.map((enemy) => enemy.id),
      'manual',
      1
    )
    expect(
      h.play.readSession().combat!.resolution!.perPlayerXp
    ).toBeGreaterThan(0)
  }
  const current = h.play.readSession()
  const combat = current.combat
  const revision = { expectedRevision: combat?.revision ?? 0 }
  const cardId = combat?.cards.find((card) => !card.playerCharacter)?.id ?? ''
  const commands: Record<
    CombatCommand['command']['kind'],
    CombatCommand['command']
  > = {
    saveInitiative: {
      kind: 'saveInitiative',
      input: {
        ...revision,
        values:
          combat?.initiativeRows.map((row) => ({
            id: row.id,
            initiative: 18
          })) ?? []
      }
    },
    finishResolution: {
      kind: 'finishResolution',
      input: {
        ...revision,
        selectedEnemyIds:
          combat?.resolution?.enemies.map((enemy) => enemy.id) ?? [],
        mode: 'manual',
        xpFraction: 1,
        expectedCampaignRulesRevision: readCampaignRules(h.db).revision
      }
    },
    prepare: {
      kind: 'prepare',
      input: {
        sceneId,
        expectedSceneRevision: current.scene.revision,
        groupIds: [groups[0]!.id]
      }
    },
    joinGroup: {
      kind: 'joinGroup',
      input: {
        sceneId,
        groupId: groups[1]!.id,
        expectedGroupRevision: groups[1]!.revision,
        expectedCombatRevision: combat?.revision ?? 0
      }
    },
    rollInitiative: { kind: 'rollInitiative', input: revision },
    confirmInitiative: {
      kind: 'confirmInitiative',
      input: {
        ...revision,
        values:
          combat?.initiativeRows.map((entry) => ({
            id: entry.id,
            initiative: 15
          })) ?? []
      }
    },
    advanceTurn: { kind: 'advanceTurn', input: revision },
    retreatTurn: { kind: 'retreatTurn', input: revision },
    adjustInitiative: {
      kind: 'adjustInitiative',
      input: { ...revision, id: cardId, initiative: 17 }
    },
    changeHp: {
      kind: 'changeHp',
      input: { ...revision, cardId, amount: 1, healing: false }
    },
    toggleCondition: {
      kind: 'toggleCondition',
      input: { ...revision, cardId, condition: 'poisoned', active: true }
    },
    setConcentration: {
      kind: 'setConcentration',
      input: { ...revision, cardId, concentrating: true }
    },
    setExhaustion: {
      kind: 'setExhaustion',
      input: { ...revision, cardId, exhaustionLevel: 2 }
    },
    undo: { kind: 'undo', input: revision },
    end: { kind: 'end', input: revision },
    moveToPhase: {
      kind: 'moveToPhase',
      input: { ...revision, target: 'initiative' }
    },
    updateResolution: {
      kind: 'updateResolution',
      input: {
        ...revision,
        selectedEnemyIds:
          combat?.resolution?.enemies.map((enemy) => enemy.id) ?? [],
        mode: 'manual',
        xpFraction: 0.5
      }
    },
    awardXp: {
      kind: 'awardXp',
      input: {
        ...revision,
        expectedCampaignRulesRevision: readCampaignRules(h.db).revision
      }
    },
    complete: { kind: 'complete', input: revision }
  }
  return { commandId: randomUUID(), sceneId, command: commands[kind] }
}
it.each(kinds)(
  'atomically journals %s, then reads/replays after later work and restart',
  (kind) => {
    const h = fixture()
    try {
      const input = request(h, kind)
      const before = h.play.readSession()
      const handlers = createEncounterHandlers(h.play, () =>
        h.campaigns.activeCampaignId()
      )
      for (const operation of [
        'combat.executeCommand',
        'combat.commandStatus'
      ] as const)
        expect(() =>
          handlers[operation]({ ...input, campaignId: randomUUID() })
        ).toThrow('stale')
      h.db.pragma('query_only = ON')
      expect(h.play.combatCommandStatus(input).receipt).toBeNull()
      h.db.pragma('query_only = OFF')
      h.db.exec(
        "CREATE TEMP TRIGGER fail_receipt BEFORE INSERT ON combat_command_receipt BEGIN SELECT RAISE(ABORT, 'receipt interrupted'); END"
      )
      expect(() => h.play.executeCombatCommand(input)).toThrow(
        'receipt interrupted'
      )
      expect(h.play.readSession()).toEqual(before)
      expect(h.play.combatCommandStatus(input).receipt).toBeNull()
      h.db.exec('DROP TRIGGER fail_receipt')
      const receipt = h.play.executeCombatCommand(input)
      expect(h.play.readSession()).not.toEqual(before)
      expect(() =>
        h.play.executeCombatCommand({
          ...input,
          command: { kind: 'end', input: { expectedRevision: 999 } }
        })
      ).toThrow('idempotency_conflict')
      const otherScene = new SceneStore(h.db).createFromScene(
        input.sceneId,
        'Other scene'
      )
      h.play.focusScene(otherScene, h.play.readSession().scene.revision)
      h.play.adjustPartyXp(h.member.id, 23, h.play.readParty().revision)
      const later = h.play.readSession()
      expect(h.play.executeCombatCommand(input)).toEqual(receipt)
      expect(h.play.readSession()).toEqual(later)
      expect(() =>
        h.play.executeCombatCommand({ ...input, sceneId: randomUUID() })
      ).toThrow('idempotency_conflict')
      h.db.pragma('query_only = ON')
      expect(h.play.combatCommandStatus(input)).toEqual({
        receipt,
        snapshot: later
      })
      h.db.pragma('query_only = OFF')
      h.campaigns.close()
      const reopened = new CampaignStore(h.root)
      try {
        const restarted = new LivePlayService(
          reopened.activeCampaignPersistence()
        )
        expect(restarted.executeCombatCommand(input)).toEqual(receipt)
        expect(restarted.combatCommandStatus(input)).toEqual({
          receipt,
          snapshot: later
        })
      } finally {
        reopened.close()
      }
    } finally {
      h.campaigns.close()
      rmSync(h.root, { recursive: true, force: true })
    }
  }
)
it('rejects a different original scene before any write', () => {
  const h = fixture()
  try {
    const input = request(h, 'prepare')
    const before = h.play.readSession()
    expect(() =>
      h.play.executeCombatCommand({ ...input, sceneId: randomUUID() })
    ).toThrow('stale')
    expect(h.play.readSession()).toEqual(before)
    expect(h.play.combatCommandStatus(input).receipt).toBeNull()
  } finally {
    h.campaigns.close()
    rmSync(h.root, { recursive: true, force: true })
  }
})
it('rolls back an interrupted 39-to-40 migration and retries without changing live data', () => {
  const h = fixture()
  try {
    const before = h.play.readSession()
    h.db.exec(
      "DROP TABLE combat_command_receipt; DELETE FROM campaign_schema_migration WHERE migration_id = 'campaign-39-to-40-combat-receipts'; PRAGMA user_version = 39;"
    )
    h.db.exec(
      "CREATE TEMP TRIGGER fail_migration BEFORE INSERT ON campaign_schema_migration WHEN NEW.migration_id = 'campaign-39-to-40-combat-receipts' BEGIN SELECT RAISE(ABORT, 'migration interrupted'); END"
    )
    expect(() =>
      applySchemaMigrations(h.db, { role: 'campaign', path: h.root })
    ).toThrow('migration interrupted')
    expect(h.db.pragma('user_version', { simple: true })).toBe(39)
    expect(
      h.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE name = 'combat_command_receipt'"
        )
        .get()
    ).toBeUndefined()
    expect(h.play.readSession()).toEqual(before)
    h.db.exec('DROP TRIGGER fail_migration')
    applySchemaMigrations(h.db, { role: 'campaign', path: h.root })
    expect(h.db.pragma('user_version', { simple: true })).toBe(42)
    expect(h.play.readSession()).toEqual(before)
    expect(
      h.db.prepare('SELECT COUNT(*) AS count FROM combat_command_receipt').get()
    ).toEqual({ count: 0 })
  } finally {
    h.campaigns.close()
    rmSync(h.root, { recursive: true, force: true })
  }
})

it('saves initiative values without starting combat', () => {
  const h = fixture()
  try {
    const input = request(h, 'saveInitiative')
    const before = h.play.readSession().combat!
    const result = h.play.executeCombatCommand(input)
    expect(result.combat?.phase).toBe('initiative')
    expect(result.combat?.cards).toEqual(before.cards)
    expect(result.combat?.initiativeRows.map((row) => row.initiative)).toEqual(
      before.initiativeRows.map(() => 18)
    )
    expect(h.play.readSession().combat).toEqual(result.combat)
  } finally {
    h.campaigns.close()
    rmSync(h.root, { recursive: true, force: true })
  }
})

it.each([false, true])(
  'finishes resolution with a complete receipt and no duplicate XP (already awarded: %s)',
  (alreadyAwarded) => {
    const h = fixture()
    try {
      const input = request(h, 'finishResolution')
      if (input.command.kind !== 'finishResolution') throw new Error('fixture')
      const before = h.play.readParty()
      if (alreadyAwarded) {
        const values = input.command.input
        h.play.updateResolution(
          values.expectedRevision,
          values.selectedEnemyIds,
          values.mode,
          values.xpFraction
        )
        h.play.awardXp(
          h.play.readSession().combat!.revision,
          values.expectedCampaignRulesRevision
        )
        input.command.input.expectedRevision =
          h.play.readSession().combat!.revision
      }
      const beforeFinish = h.play.readParty()
      const result = h.play.executeCombatCommand(input)
      const after = h.play.readParty()
      expect(result.combat).toBeNull()
      expect(h.play.readSession().combat).toBeNull()
      expect(
        after.members.find((member) => member.id === h.member.id)!.xp
      ).toBeGreaterThan(
        before.members.find((member) => member.id === h.member.id)!.xp
      )
      if (alreadyAwarded) {
        expect(after).toEqual(beforeFinish)
        expect(result.party).toBeNull()
      } else {
        expect(result.party).toEqual(after)
      }
      expect(h.play.executeCombatCommand(input)).toEqual(result)
      expect(h.play.readParty()).toEqual(after)
    } finally {
      h.campaigns.close()
      rmSync(h.root, { recursive: true, force: true })
    }
  }
)
