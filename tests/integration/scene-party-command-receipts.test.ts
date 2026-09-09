import { HexMapService, HexMapStore } from '../../src/core/hex/hex-map-store.js'
import {
  HexTravelService,
  HexTravelStore
} from '../../src/core/hex/hex-travel.js'
import { HexMapEditingCommandHandler } from '../../src/core/application/hex-map-editing.js'
import { WorldLocationStore } from '../../src/core/worldplanner/location-store.js'
import { PartyStore } from '../../src/core/party/party-store.js'
import { SceneStore } from '../../src/core/scene/scene-store.js'
import { CampaignUnitOfWork } from '../../src/core/application/campaign-unit-of-work.js'
import { HexEditJournalStore } from '../../src/core/hex/hex-edit-journal-store.js'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { applySchemaMigrations } from '../../src/core/persistence/sqlite/schema-migrations.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { seedExampleParty } from '../../src/core/party/party-example-seed.js'
import { activeCampaignDatabase } from '../support/campaign-store-test-access.js'
import { createSessionHandlers } from '../../src/utility/composition/live-play.js'
import {
  scenePartyCommandReceiptSchema,
  type ScenePartyCommand
} from '../../src/shared/contracts/scene-party-command.js'

function fixture(combat = true) {
  const root = mkdtempSync(join(tmpdir(), 'salt-scene-party-command-'))
  const campaigns = new CampaignStore(root)
  campaigns.create('Scene Party')
  const db = activeCampaignDatabase(campaigns)
  seedExampleParty(db)
  const play = new LivePlayService(campaigns.activeCampaignPersistence())
  const members = play.readParty().members.slice(0, 2)
  for (const member of members)
    play.setMembership(member.id, true, play.readParty().revision)
  if (combat) {
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
  }
  db.exec(
    'UPDATE player_characters SET xp_since_short_rest = 250, xp_since_long_rest = 500'
  )
  return { root, campaigns, db, play, members }
}

it.each(['set-roster', 'move-new', 'move-existing', 'short', 'long'] as const)(
  'commits %s once and recovers the original result without losing later work',
  (mode) => {
    const h = fixture()
    try {
      const sourceId = h.play.readSession().scene.focusedSceneId
      if (mode === 'move-existing') {
        const current = h.play.readSession()
        h.play.moveSceneRoster({
          sceneId: sourceId,
          memberIds: [h.members[1]!.id],
          expectedRevision: current.scene.revision,
          expectedPartyRevision: current.party.revision,
          target: { kind: 'new', title: 'Existing destination' }
        })
      }
      const before = h.play.readSession()
      const memberIds = [h.members[0]!.id]
      const roster = {
        sceneId: sourceId,
        memberIds,
        expectedRevision: before.scene.revision,
        expectedPartyRevision: before.party.revision
      }
      const command: ScenePartyCommand['command'] =
        mode === 'set-roster'
          ? { kind: 'set-roster', input: roster }
          : mode === 'move-new' || mode === 'move-existing'
            ? {
                kind: 'move-roster',
                input: {
                  ...roster,
                  target:
                    mode === 'move-new'
                      ? { kind: 'new', title: 'Only one new scene' }
                      : {
                          kind: 'existing',
                          sceneId: before.scene.scenes.find(
                            (scene) => scene.id !== sourceId
                          )!.id
                        }
                }
              }
            : {
                kind: 'rest-selected',
                input: {
                  sceneId: sourceId,
                  memberIds,
                  type: mode,
                  expectedRevision: before.party.revision,
                  expectedSceneRevision: before.scene.revision
                }
              }
      const input: ScenePartyCommand = { commandId: randomUUID(), command }
      const handlers = createSessionHandlers(h.play, () =>
        h.campaigns.activeCampaignId()
      )
      const request = { ...input, campaignId: h.campaigns.activeCampaignId() }
      for (const kind of [
        'scene.executePartyCommand',
        'scene.partyCommandStatus'
      ] as const)
        expect(() =>
          handlers[kind]({ ...request, campaignId: randomUUID() })
        ).toThrow('stale')
      h.db.pragma('query_only = ON')
      expect(handlers['scene.partyCommandStatus'](request)).toEqual({
        receipt: null,
        snapshot: before
      })
      h.db.pragma('query_only = OFF')
      h.db.exec(
        "CREATE TEMP TRIGGER fail_receipt BEFORE INSERT ON scene_party_command_receipt BEGIN SELECT RAISE(ABORT, 'receipt interrupted'); END"
      )
      expect(() => handlers['scene.executePartyCommand'](request)).toThrow(
        'receipt interrupted'
      )
      expect(h.play.readSession()).toEqual(before)
      expect(h.play.scenePartyCommandStatus(input).receipt).toBeNull()
      h.db.exec('DROP TRIGGER fail_receipt')
      const receipt = scenePartyCommandReceiptSchema.parse(
        handlers['scene.executePartyCommand'](request)
      )
      const committed = h.play.readSession()
      expect(receipt.snapshot).toEqual(committed)
      if (mode === 'set-roster')
        expect(
          committed.scene.scenes.find((scene) => scene.id === sourceId)
            ?.partyMemberIds
        ).toEqual(memberIds)
      if (mode === 'move-new')
        expect(committed.scene.scenes).toHaveLength(
          before.scene.scenes.length + 1
        )
      if (mode.startsWith('move-')) {
        expect(
          committed.scene.scenes.find((scene) => scene.id === sourceId)
            ?.partyMemberIds
        ).not.toContain(memberIds[0])
        expect(
          committed.scene.scenes.find((scene) => scene.id !== sourceId)
            ?.partyMemberIds
        ).toContain(memberIds[0])
      }
      if (mode === 'short' || mode === 'long') {
        expect(
          committed.party.members.find((member) => member.id === memberIds[0])
        ).toMatchObject({
          xpSinceShortRest: 0,
          xpSinceLongRest: mode === 'short' ? 500 : 0
        })
        expect(
          committed.party.members.find(
            (member) => member.id === h.members[1]!.id
          )
        ).toMatchObject({ xpSinceShortRest: 250, xpSinceLongRest: 500 })
      }
      expect(h.play.executeScenePartyCommand(input)).toEqual(receipt)
      expect(h.play.readSession()).toEqual(committed)
      h.play.setPartyXp(h.members[0]!.id, 2000, h.play.readParty().revision)
      const later = h.play.readSession()
      const altered = {
        ...input,
        command: {
          ...input.command,
          input: {
            ...input.command.input,
            expectedRevision: input.command.input.expectedRevision + 1
          }
        }
      } as ScenePartyCommand
      h.db.pragma('query_only = ON')
      expect(handlers['scene.partyCommandStatus'](request)).toEqual({
        receipt,
        snapshot: later
      })
      expect(() => h.play.scenePartyCommandStatus(altered)).toThrow(
        'idempotency_conflict'
      )
      expect(h.play.readSession()).toEqual(later)
      h.db.pragma('query_only = OFF')
      h.campaigns.close()
      const reopened = new CampaignStore(h.root)
      try {
        const play = new LivePlayService(reopened.activeCampaignPersistence())
        expect(play.executeScenePartyCommand(input)).toEqual(receipt)
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

it('migrates 38 to 39 atomically without changing the campaign contents', () => {
  const h = fixture()
  try {
    const before = h.play.readSession()
    h.db.exec('DROP TABLE scene_party_command_receipt')
    h.db.pragma('user_version = 38')
    h.db.exec(
      "CREATE TEMP TRIGGER fail_migration BEFORE INSERT ON campaign_schema_migration WHEN NEW.migration_id = 'campaign-38-to-39-scene-party-receipts' BEGIN SELECT RAISE(ABORT, 'migration interrupted'); END"
    )
    expect(() =>
      applySchemaMigrations(h.db, { role: 'campaign', path: h.root })
    ).toThrow('migration interrupted')
    expect(h.db.pragma('user_version', { simple: true })).toBe(38)
    expect(
      h.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE name = 'scene_party_command_receipt'"
        )
        .get()
    ).toBeUndefined()
    expect(h.play.readSession()).toEqual(before)
    h.db.exec('DROP TRIGGER fail_migration')
    applySchemaMigrations(h.db, { role: 'campaign', path: h.root })
    expect(h.db.pragma('user_version', { simple: true })).toBe(42)
    expect(h.play.readSession()).toEqual(before)
    expect(
      h.db
        .prepare('SELECT COUNT(*) FROM scene_party_command_receipt')
        .pluck()
        .get()
    ).toBe(0)
  } finally {
    h.campaigns.close()
    rmSync(h.root, { recursive: true, force: true })
  }
})

it('rolls back a roster-triggered travel pause when recording its receipt fails', () => {
  const h = fixture(false)
  try {
    const persistence = h.campaigns.activeCampaignPersistence()
    const maps = new HexMapService(persistence)
    const travel = new HexTravelService(persistence, () => 1000)
    const locations = new WorldLocationStore(h.db)
    const mapStore = new HexMapStore(h.db, locations)
    const party = new PartyStore(h.db)
    const scenes = new SceneStore(h.db, () => locations.read().locations)
    const editing = new HexMapEditingCommandHandler(() => ({
      unitOfWork: new CampaignUnitOfWork(h.db),
      maps: mapStore,
      party,
      travel: new HexTravelStore(h.db, mapStore, party, scenes, () => 1000),
      journal: new HexEditJournalStore(h.db)
    }))
    const map = maps.create('Receipt route', maps.catalog().revision)
    editing.applyBrushStroke({
      commandId: randomUUID(),
      mapId: map.id,
      mode: 'paint',
      biomeId: 'grassland',
      path: [
        { q: 0, r: 0 },
        { q: 1, r: 0 }
      ],
      radius: 0,
      expectedContentRevision: 0,
      confirmationToken: null
    })
    let session = h.play.readSession()
    const sceneId = session.scene.focusedSceneId
    travel.position({
      sceneId,
      mapId: map.id,
      coordinate: { q: 0, r: 0 },
      expectedSceneRevision: session.scene.revision
    })
    travel.start({
      sceneId,
      mapId: map.id,
      waypoints: [{ q: 1, r: 0 }],
      multiplier: 1,
      expectedRevision: travel.read(sceneId).revision
    })
    session = h.play.readSession()
    const journey = travel.read(sceneId)
    expect(journey.status).toBe('travelling')
    const input: ScenePartyCommand = {
      commandId: randomUUID(),
      command: {
        kind: 'set-roster',
        input: {
          sceneId,
          memberIds: [],
          expectedRevision: session.scene.revision,
          expectedPartyRevision: session.party.revision
        }
      }
    }
    h.db.exec(
      "CREATE TEMP TRIGGER fail_receipt BEFORE INSERT ON scene_party_command_receipt BEGIN SELECT RAISE(ABORT, 'pause receipt interrupted'); END"
    )
    expect(() => h.play.executeScenePartyCommand(input)).toThrow(
      'pause receipt interrupted'
    )
    expect(h.play.readSession()).toEqual(session)
    expect(travel.read(sceneId)).toEqual(journey)
    h.db.exec('DROP TRIGGER fail_receipt')
    const receipt = h.play.executeScenePartyCommand(input)
    expect(travel.read(sceneId)).toMatchObject({
      status: 'paused',
      hintCode: 'party-changed'
    })
    const paused = travel.read(sceneId)
    expect(h.play.executeScenePartyCommand(input)).toEqual(receipt)
    expect(travel.read(sceneId)).toEqual(paused)
  } finally {
    h.campaigns.close()
    rmSync(h.root, { recursive: true, force: true })
  }
})
