import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { applySchemaMigrations } from '../../src/core/persistence/sqlite/schema-migrations.js'
import {
  partyCharacterDraftSchema,
  partyCharacterCommandReceiptSchema,
  type PartyCharacterCommand
} from '../../src/shared/contracts/party.js'
import { seedExampleParty } from '../../src/core/party/party-example-seed.js'
import { activeCampaignDatabase } from '../support/campaign-store-test-access.js'
import { createPartyHandlers } from '../../src/utility/composition/live-play.js'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'salt-character-receipt-'))
  const campaigns = new CampaignStore(root)
  campaigns.create('Character receipts')
  const db = activeCampaignDatabase(campaigns)
  seedExampleParty(db)
  const play = new LivePlayService(campaigns.activeCampaignPersistence())
  const member = play.readParty().members[0]!
  play.setMembership(member.id, true, play.readParty().revision)
  let session = play.readSession()
  play.saveSceneGroup(
    session.scene.focusedSceneId,
    null,
    'Wölfe',
    '',
    'hostile',
    [{ creatureId: 'wolf', quantity: 2 }],
    session.scene.revision,
    null
  )
  session = play.readSession()
  play.prepareCombat(session.scene.focusedSceneId, session.scene.revision, [
    session.scene.scenes[0]!.groups[0]!.id
  ])
  return { root, campaigns, db, play, member }
}
const draft = partyCharacterDraftSchema.parse({
  name: 'Neuer Name',
  playerName: 'Spieler',
  level: 3,
  passivePerception: 12,
  armorClass: 15
})

describe('atomic Party character commands and read-only recovery', () => {
  it.each(['create', 'update', 'delete'] as const)(
    'persists %s with scene/combat effects and a receipt that survives later deletion and restart',
    (kind) => {
      const h = fixture()
      try {
        const before = h.play.readSession()
        expect(
          before.combat?.initiativeRows.some((row) => row.kind === 'party')
        ).toBe(true)
        const common = { expectedRevision: before.party.revision }
        const input: PartyCharacterCommand = {
          commandId: randomUUID(),
          command:
            kind === 'create'
              ? { kind, input: { ...common, character: draft } }
              : kind === 'update'
                ? {
                    kind,
                    input: { ...common, id: h.member.id, character: draft }
                  }
                : { kind, input: { ...common, id: h.member.id } }
        }
        const handlers = createPartyHandlers(h.play, () =>
          h.campaigns.activeCampaignId()
        )
        const other = { ...input, campaignId: randomUUID() }
        expect(() => handlers['party.executeCharacterCommand'](other)).toThrow(
          'stale'
        )
        expect(() => handlers['party.characterCommandStatus'](other)).toThrow(
          'stale'
        )
        h.db.pragma('query_only = ON')
        expect(h.play.partyCharacterCommandStatus(input)).toEqual({
          receipt: null,
          party: before.party
        })
        h.db.pragma('query_only = OFF')
        h.db.exec(
          "CREATE TEMP TRIGGER fail_receipt BEFORE INSERT ON party_character_command_receipt BEGIN SELECT RAISE(ABORT, 'receipt interrupted'); END"
        )
        expect(() => h.play.executePartyCharacterCommand(input)).toThrow(
          'receipt interrupted'
        )
        expect(h.play.readSession()).toEqual(before)
        expect(h.play.partyCharacterCommandStatus(input).receipt).toBeNull()
        h.db.exec('DROP TRIGGER fail_receipt')
        const result = partyCharacterCommandReceiptSchema.parse(
          handlers['party.executeCharacterCommand']({
            ...input,
            campaignId: h.campaigns.activeCampaignId()
          })
        )
        expect(result.party.revision).toBe(before.party.revision + 1)
        if (kind === 'create') {
          expect(
            before.party.members.some(
              (member) => member.id === result.characterId
            )
          ).toBe(false)
          expect(
            result.party.members.find(
              (member) => member.id === result.characterId
            )
          ).toMatchObject(draft)
        } else {
          expect(result.characterId).toBe(h.member.id)
          if (kind === 'delete') {
            expect(
              result.party.members.some((member) => member.id === h.member.id)
            ).toBe(false)
            expect(
              h.play.readSession().scene.scenes[0]!.partyMemberIds
            ).not.toContain(h.member.id)
          } else
            expect(
              h.play
                .readSession()
                .combat?.initiativeRows.some((row) => row.label === draft.name)
            ).toBe(true)
        }
        const afterCommand = h.play.readSession()
        expect(h.play.executePartyCharacterCommand(input)).toEqual(result)
        expect(h.play.readSession()).toEqual(afterCommand)
        if (kind !== 'delete')
          h.play.deletePartyCharacter(
            result.characterId,
            h.play.readParty().revision
          )
        h.play.createPartyCharacter(
          { ...draft, name: 'Spätere Arbeit' },
          h.play.readParty().revision
        )
        const later = h.play.readSession()
        h.db.pragma('query_only = ON')
        expect(
          handlers['party.characterCommandStatus']({
            ...input,
            campaignId: h.campaigns.activeCampaignId()
          })
        ).toEqual({ receipt: result, party: later.party })
        const conflict = {
          ...input,
          command: {
            ...input.command,
            input: {
              ...input.command.input,
              expectedRevision: common.expectedRevision + 1
            }
          }
        } as PartyCharacterCommand
        expect(() => h.play.partyCharacterCommandStatus(conflict)).toThrow(
          'idempotency_conflict'
        )
        expect(h.play.readSession()).toEqual(later)
        h.db.pragma('query_only = OFF')
        h.campaigns.close()
        const reopened = new CampaignStore(h.root)
        try {
          const play = new LivePlayService(reopened.activeCampaignPersistence())
          expect(play.partyCharacterCommandStatus(input)).toEqual({
            receipt: result,
            party: later.party
          })
          expect(play.executePartyCharacterCommand(input)).toEqual(result)
          expect(play.readSession()).toEqual(later)
        } finally {
          reopened.close()
        }
      } finally {
        h.campaigns.close()
        rmSync(h.root, { recursive: true, force: true })
      }
    }
  )
  it('migrates schema 37 without changing Party/Scene/Combat and rolls back interrupted DDL', () => {
    const h = fixture()
    try {
      const before = h.play.readSession()
      h.db.exec('DROP TABLE party_character_command_receipt')
      h.db.pragma('user_version = 37')
      h.db.exec(
        "CREATE TEMP TRIGGER fail_migration BEFORE INSERT ON campaign_schema_migration WHEN NEW.migration_id = 'campaign-37-to-38-party-character-receipts' BEGIN SELECT RAISE(ABORT, 'migration interrupted'); END"
      )
      expect(() =>
        applySchemaMigrations(h.db, { path: h.root, role: 'campaign' })
      ).toThrow('migration interrupted')
      expect(h.db.pragma('user_version', { simple: true })).toBe(37)
      expect(
        h.db
          .prepare(
            "SELECT name FROM sqlite_master WHERE name = 'party_character_command_receipt'"
          )
          .get()
      ).toBeUndefined()
      expect(h.play.readSession()).toEqual(before)
      h.db.exec('DROP TRIGGER fail_migration')
      applySchemaMigrations(h.db, { path: h.root, role: 'campaign' })
      expect(h.db.pragma('user_version', { simple: true })).toBe(40)
      expect(
        h.db
          .prepare('SELECT COUNT(*) FROM party_character_command_receipt')
          .pluck()
          .get()
      ).toBe(0)
      expect(h.play.readSession()).toEqual(before)
    } finally {
      h.campaigns.close()
      rmSync(h.root, { recursive: true, force: true })
    }
  })
})

it.each(['add', 'subtract', 'set'] as const)(
  'journals %s XP atomically and retains the original outcome after later work and restart',
  (mode) => {
    const h = fixture()
    try {
      h.play.setPartyXp(h.member.id, 1300, h.play.readParty().revision)
      const before = h.play.readSession()
      const common = {
        id: h.member.id,
        expectedRevision: before.party.revision
      }
      const input: PartyCharacterCommand = {
        commandId: randomUUID(),
        command:
          mode === 'set'
            ? { kind: 'set-xp', input: { ...common, amount: 1125 } }
            : {
                kind: 'adjust-xp',
                input: { ...common, delta: mode === 'add' ? 25 : -25 }
              }
      }
      const handlers = createPartyHandlers(h.play, () =>
        h.campaigns.activeCampaignId()
      )
      const request = { ...input, campaignId: h.campaigns.activeCampaignId() }
      h.db.pragma('query_only = ON')
      expect(handlers['party.characterCommandStatus'](request)).toEqual({
        receipt: null,
        party: before.party
      })
      h.db.pragma('query_only = OFF')
      h.db.exec(
        "CREATE TEMP TRIGGER fail_xp_receipt BEFORE INSERT ON party_character_command_receipt BEGIN SELECT RAISE(ABORT, 'XP receipt interrupted'); END"
      )
      expect(() => handlers['party.executeCharacterCommand'](request)).toThrow(
        'XP receipt interrupted'
      )
      expect(h.play.readSession()).toEqual(before)
      expect(h.play.partyCharacterCommandStatus(input).receipt).toBeNull()
      h.db.exec('DROP TRIGGER fail_xp_receipt')
      const receipt = partyCharacterCommandReceiptSchema.parse(
        handlers['party.executeCharacterCommand'](request)
      )
      expect(receipt.characterId).toBe(h.member.id)
      expect(receipt.party.revision).toBe(before.party.revision + 1)
      expect(
        receipt.party.members.find((member) => member.id === h.member.id)?.xp
      ).toBe(mode === 'set' ? 1125 : mode === 'add' ? 1325 : 1275)
      const committed = h.play.readSession()
      expect(h.play.executePartyCharacterCommand(input)).toEqual(receipt)
      expect(h.play.readSession()).toEqual(committed)
      h.play.setPartyXp(h.member.id, 1777, h.play.readParty().revision)
      const later = h.play.readSession()
      const altered = {
        ...input,
        command:
          input.command.kind === 'set-xp'
            ? {
                ...input.command,
                input: { ...input.command.input, amount: 1126 }
              }
            : { ...input.command, input: { ...input.command.input, delta: 26 } }
      } as PartyCharacterCommand
      h.db.pragma('query_only = ON')
      expect(h.play.partyCharacterCommandStatus(input)).toEqual({
        receipt,
        party: later.party
      })
      expect(() => h.play.partyCharacterCommandStatus(altered)).toThrow(
        'idempotency_conflict'
      )
      expect(h.play.readSession()).toEqual(later)
      h.db.pragma('query_only = OFF')
      h.campaigns.close()
      const reopened = new CampaignStore(h.root)
      try {
        const play = new LivePlayService(reopened.activeCampaignPersistence())
        expect(play.executePartyCharacterCommand(input)).toEqual(receipt)
        expect(play.readSession()).toEqual(later)
        expect(() => play.executePartyCharacterCommand(altered)).toThrow(
          'idempotency_conflict'
        )
      } finally {
        reopened.close()
      }
    } finally {
      h.campaigns.close()
      rmSync(h.root, { recursive: true, force: true })
    }
  }
)
