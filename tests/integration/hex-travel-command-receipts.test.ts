import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { HexMapService, HexMapStore } from '../../src/core/hex/hex-map-store.js'
import {
  HexTravelService,
  HexTravelStore
} from '../../src/core/hex/hex-travel.js'
import { HexTravelCommandService } from '../../src/core/hex/hex-travel-command-service.js'
import { HexMapEditingCommandHandler } from '../../src/core/application/hex-map-editing.js'
import { CampaignUnitOfWork } from '../../src/core/application/campaign-unit-of-work.js'
import { HexEditJournalStore } from '../../src/core/hex/hex-edit-journal-store.js'
import { WorldLocationStore } from '../../src/core/worldplanner/location-store.js'
import { PartyStore } from '../../src/core/party/party-store.js'
import { SceneStore } from '../../src/core/scene/scene-store.js'
import { seedExampleParty } from '../../src/core/party/party-example-seed.js'
import { applySchemaMigrations } from '../../src/core/persistence/sqlite/schema-migrations.js'
import { createTravelHandlers } from '../../src/utility/composition/travel.js'
import type { HexTravelCommand } from '../../src/shared/contracts/hex-travel-command.js'
import { activeCampaignDatabase } from '../support/campaign-store-test-access.js'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'salt-travel-receipts-'))
  const campaigns = new CampaignStore(root)
  cleanups.push(() => {
    campaigns.close()
    rmSync(root, { recursive: true, force: true })
  })
  campaigns.create('Travel commands')
  const db = activeCampaignDatabase(campaigns)
  seedExampleParty(db)
  const access = campaigns.activeCampaignPersistence()
  const play = new LivePlayService(access)
  const travel = new HexTravelService(access, () => 1000)
  const commands = new HexTravelCommandService(access, travel, play)
  const maps = new HexMapService(access)
  const map = maps.create('Plan', maps.catalog().revision)
  const editing = new HexMapEditingCommandHandler(() => {
    const locations = new WorldLocationStore(db)
    const mapStore = new HexMapStore(db, locations)
    const party = new PartyStore(db)
    const scenes = new SceneStore(db, () => locations.read().locations)
    return {
      unitOfWork: new CampaignUnitOfWork(db),
      maps: mapStore,
      party,
      travel: new HexTravelStore(db, mapStore, party, scenes, () => 1000),
      journal: new HexEditJournalStore(db)
    }
  })
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
  let session = play.readSession()
  const sceneId = session.scene.focusedSceneId
  session = play.setSceneRoster({
    sceneId,
    memberIds: [session.party.members[0]!.id],
    expectedRevision: session.scene.revision,
    expectedPartyRevision: session.party.revision
  })
  travel.position({
    sceneId,
    mapId: map.id,
    coordinate: { q: 0, r: 0 },
    expectedSceneRevision: session.scene.revision
  })
  const plan = {
    mapId: map.id,
    waypoints: [{ q: 1, r: 0 }],
    multiplier: 1 as const
  }
  const save = (): HexTravelCommand => ({
    commandId: randomUUID(),
    command: {
      kind: 'save-plan',
      input: {
        sceneId,
        expectedPlanRevision: commands.readPlan(sceneId).revision,
        expectedSceneRevision: play.readSession().scene.revision,
        plan
      }
    }
  })
  return { root, campaigns, db, play, travel, commands, sceneId, plan, save }
}

it.each([
  'save-plan',
  'position',
  'start',
  'pause',
  'resume',
  'abort',
  'set-multiplier'
] as const)(
  'rolls back %s with its receipt and replays its original outcome after later work and restart',
  (kind) => {
    const h = fixture()
    if (['pause', 'resume', 'abort', 'set-multiplier'].includes(kind)) {
      h.travel.start({
        sceneId: h.sceneId,
        ...h.plan,
        expectedRevision: h.travel.read(h.sceneId).revision
      })
    }
    if (kind === 'resume')
      h.travel.pause({
        sceneId: h.sceneId,
        expectedRevision: h.travel.read(h.sceneId).revision
      })
    const revision = h.travel.read(h.sceneId).revision
    let command: HexTravelCommand
    if (kind === 'save-plan') command = h.save()
    else if (kind === 'position')
      command = {
        commandId: randomUUID(),
        command: {
          kind,
          input: {
            sceneId: h.sceneId,
            mapId: h.plan.mapId,
            coordinate: { q: 1, r: 0 },
            expectedSceneRevision: h.play.readSession().scene.revision
          }
        }
      }
    else if (kind === 'start')
      command = {
        commandId: randomUUID(),
        command: {
          kind,
          input: {
            sceneId: h.sceneId,
            ...h.plan,
            expectedRevision: revision,
            expectedSceneRevision: h.play.readSession().scene.revision
          }
        }
      }
    else if (kind === 'set-multiplier')
      command = {
        commandId: randomUUID(),
        command: {
          kind,
          input: {
            sceneId: h.sceneId,
            multiplier: 5,
            expectedRevision: revision
          }
        }
      }
    else
      command = {
        commandId: randomUUID(),
        command: {
          kind,
          input: { sceneId: h.sceneId, expectedRevision: revision }
        }
      }
    const before = h.commands.status(command)
    const handlers = createTravelHandlers({
      commands: h.commands,
      travel: h.travel,
      play: h.play,
      activeCampaignId: () => h.campaigns.activeCampaignId(),
      publishChange: () => {}
    })
    for (const operation of [
      'hexTravel.executeCommand',
      'hexTravel.commandStatus'
    ] as const) {
      expect(() =>
        handlers[operation]({ ...command, campaignId: randomUUID() })
      ).toThrow('stale')
    }
    h.db.exec(
      "CREATE TEMP TRIGGER fail_receipt BEFORE INSERT ON hex_travel_command_receipt BEGIN SELECT RAISE(ABORT, 'receipt interrupted'); END"
    )
    expect(() => h.commands.execute(command)).toThrow('receipt interrupted')
    expect(h.commands.status(command)).toEqual(before)
    h.db.exec('DROP TRIGGER fail_receipt')
    const receipt = h.commands.execute(command)
    if (kind === 'save-plan') {
      expect(receipt.context).toEqual(before.context)
      expect(receipt.routePlan).toEqual({
        sceneId: h.sceneId,
        revision: 1,
        plan: h.plan
      })
    } else if (kind === 'position')
      expect(receipt.context.travel.current).toEqual({ q: 1, r: 0 })
    else if (kind === 'set-multiplier')
      expect(receipt.context.travel.multiplier).toBe(5)
    else
      expect(receipt.context.travel.status).toBe(
        kind === 'pause'
          ? 'paused'
          : kind === 'abort'
            ? 'aborted'
            : 'travelling'
      )
    const member = h.play.readParty().members[0]!
    h.play.adjustPartyXp(member.id, 21, h.play.readParty().revision)
    const scene = new SceneStore(h.db)
    const nextScene = scene.createFromScene(h.sceneId, 'Later scene')
    h.play.focusScene(nextScene, h.play.readSession().scene.revision)
    const later = h.commands.status(command)
    expect(later.receipt).toEqual(receipt)
    expect(later.context.session.party).not.toEqual(
      receipt.context.session.party
    )
    h.db.pragma('query_only = ON')
    expect(h.commands.status(command)).toEqual(later)
    expect(h.commands.execute(command)).toEqual(receipt)
    h.db.pragma('query_only = OFF')
    expect(() =>
      h.commands.execute({ ...command, commandId: randomUUID() })
    ).toThrow('stale')
    h.campaigns.close()
    const reopened = new CampaignStore(h.root)
    try {
      const access = reopened.activeCampaignPersistence()
      const service = new HexTravelCommandService(
        access,
        new HexTravelService(access, () => 1000),
        new LivePlayService(access)
      )
      expect(service.status(command)).toEqual(later)
      expect(service.execute(command)).toEqual(receipt)
    } finally {
      reopened.close()
    }
  }
)

it('keeps a clear tombstone and rejects stale, changed-identity and invalid route saves', () => {
  const h = fixture()
  const original = h.save()
  h.commands.execute(original)
  const clear = h.save()
  if (clear.command.kind !== 'save-plan') throw new Error('save fixture')
  clear.command.input.plan = null
  h.commands.execute(clear)
  expect(h.commands.readPlan(h.sceneId)).toEqual({
    sceneId: h.sceneId,
    revision: 2,
    plan: null
  })
  expect(() =>
    h.commands.execute({ ...original, commandId: randomUUID() })
  ).toThrow('stale')
  expect(() =>
    h.commands.execute({ ...clear, commandId: original.commandId })
  ).toThrow('idempotency_conflict')
  const invalid = h.save()
  if (invalid.command.kind !== 'save-plan') throw new Error('save fixture')
  invalid.command.input.plan = { ...h.plan, waypoints: [{ q: 500, r: 500 }] }
  expect(() => h.commands.execute(invalid)).toThrow('validation_failed')
  expect(h.commands.readPlan(h.sceneId).revision).toBe(2)
})

it('migrates 40 to 41 atomically while preserving the complete session and journey', () => {
  const h = fixture()
  h.travel.start({
    sceneId: h.sceneId,
    ...h.plan,
    expectedRevision: h.travel.read(h.sceneId).revision
  })
  const before = {
    session: h.play.readSession(),
    travel: h.travel.read(h.sceneId)
  }
  h.db.exec(
    'DROP TABLE hex_route_plan; DROP TABLE hex_travel_command_receipt; PRAGMA user_version = 40;'
  )
  h.db.exec(
    "CREATE TEMP TRIGGER fail_migration BEFORE INSERT ON campaign_schema_migration WHEN NEW.migration_id = 'campaign-40-to-41-hex-route-plans-and-receipts' BEGIN SELECT RAISE(ABORT, 'migration interrupted'); END"
  )
  expect(() =>
    applySchemaMigrations(h.db, { role: 'campaign', path: h.root })
  ).toThrow('migration interrupted')
  expect(h.db.pragma('user_version', { simple: true })).toBe(40)
  expect(
    h.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE name IN ('hex_route_plan', 'hex_travel_command_receipt')"
      )
      .all()
  ).toEqual([])
  h.db.exec('DROP TRIGGER fail_migration')
  applySchemaMigrations(h.db, { role: 'campaign', path: h.root })
  expect(h.db.pragma('user_version', { simple: true })).toBe(41)
  expect({
    session: h.play.readSession(),
    travel: h.travel.read(h.sceneId)
  }).toEqual(before)
  expect(h.commands.readPlan(h.sceneId)).toEqual({
    sceneId: h.sceneId,
    revision: 0,
    plan: null
  })
  expect(h.db.pragma('foreign_key_check')).toEqual([])
})

it('rejects a queued start after manual positioning resets the journey revision', () => {
  const h = fixture()
  const originalTravelRevision = h.travel.read(h.sceneId).revision
  const input: HexTravelCommand = {
    commandId: randomUUID(),
    command: {
      kind: 'start',
      input: {
        sceneId: h.sceneId,
        ...h.plan,
        expectedRevision: originalTravelRevision,
        expectedSceneRevision: h.play.readSession().scene.revision
      }
    }
  }
  h.travel.position({
    sceneId: h.sceneId,
    mapId: h.plan.mapId,
    coordinate: { q: 1, r: 0 },
    expectedSceneRevision: h.play.readSession().scene.revision
  })
  expect(h.travel.read(h.sceneId).revision).toBe(originalTravelRevision)
  const before = {
    session: h.play.readSession(),
    travel: h.travel.read(h.sceneId)
  }
  expect(() => h.commands.execute(input)).toThrow('stale')
  expect(h.commands.status(input).receipt).toBeNull()
  expect({
    session: h.play.readSession(),
    travel: h.travel.read(h.sceneId)
  }).toEqual(before)
})
