import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { SceneStore } from '../../src/core/scene/scene-store.js'
import { WorldLocationStore } from '../../src/core/worldplanner/location-store.js'
import { seedExampleParty } from '../../src/core/party/party-example-seed.js'
import { createSessionHandlers } from '../../src/utility/composition/live-play.js'
import { activeCampaignDatabase } from '../support/campaign-store-test-access.js'
import type { SceneCommand } from '../../src/shared/contracts/scene-command.js'

function fixture(kind: 'focus' | 'set-location') {
  const root = mkdtempSync(join(tmpdir(), 'salt-scene-command-'))
  const campaigns = new CampaignStore(root)
  campaigns.create('Scene commands')
  const db = activeCampaignDatabase(campaigns)
  seedExampleParty(db)
  const play = new LivePlayService(campaigns.activeCampaignPersistence())
  const locations = new WorldLocationStore(db)
  locations.create(
    {
      displayName: 'Receipt location',
      tags: ['Ort'],
      readAloud: '',
      notes: '',
      factionIds: [],
      encounterTableIds: []
    },
    locations.read().revision
  )
  const locationId = locations.read().locations[0]!.id
  const sourceSceneId = play.readSession().scene.focusedSceneId
  const destinationId = new SceneStore(db).createFromScene(
    sourceSceneId,
    'Destination'
  )
  const expectedRevision = play.readSession().scene.revision
  const input: SceneCommand = {
    commandId: randomUUID(),
    command:
      kind === 'focus'
        ? {
            kind,
            input: { sceneId: destinationId, sourceSceneId, expectedRevision }
          }
        : {
            kind,
            input: { sceneId: sourceSceneId, locationId, expectedRevision }
          }
  }
  return {
    root,
    campaigns,
    db,
    play,
    input,
    sourceSceneId,
    destinationId,
    locationId
  }
}

it.each(['focus', 'set-location'] as const)(
  'atomically records %s and retains the original outcome after later work and restart',
  (kind) => {
    const h = fixture(kind)
    try {
      const before = h.play.readSession()
      const handlers = createSessionHandlers(h.play, () =>
        h.campaigns.activeCampaignId()
      )
      for (const operation of [
        'scene.executeCommand',
        'scene.commandStatus'
      ] as const) {
        expect(() =>
          handlers[operation]({ ...h.input, campaignId: randomUUID() })
        ).toThrow('stale')
      }
      h.db.pragma('query_only = ON')
      expect(h.play.sceneCommandStatus(h.input).receipt).toBeNull()
      h.db.pragma('query_only = OFF')
      h.db.exec(
        "CREATE TEMP TRIGGER fail_receipt BEFORE INSERT ON scene_party_command_receipt BEGIN SELECT RAISE(ABORT, 'receipt interrupted'); END"
      )
      expect(() => h.play.executeSceneCommand(h.input)).toThrow(
        'receipt interrupted'
      )
      expect(h.play.readSession()).toEqual(before)
      expect(h.play.sceneCommandStatus(h.input).receipt).toBeNull()
      h.db.exec('DROP TRIGGER fail_receipt')
      const receipt = h.play.executeSceneCommand(h.input)
      if (kind === 'focus')
        expect(receipt.snapshot.scene.focusedSceneId).toBe(h.destinationId)
      else
        expect(
          receipt.snapshot.scene.scenes.find(
            (scene) => scene.id === h.sourceSceneId
          )!.locationId
        ).toBe(h.locationId)
      h.play.focusScene(h.destinationId, h.play.readSession().scene.revision)
      h.play.setSceneLocation(
        h.sourceSceneId,
        null,
        h.play.readSession().scene.revision
      )
      const member = h.play.readParty().members[0]!
      h.play.adjustPartyXp(member.id, 21, h.play.readParty().revision)
      const later = h.play.readSession()
      h.db.pragma('query_only = ON')
      expect(h.play.sceneCommandStatus(h.input)).toEqual({
        receipt,
        snapshot: later
      })
      expect(h.play.executeSceneCommand(h.input)).toEqual(receipt)
      h.db.pragma('query_only = OFF')
      expect(h.play.readSession()).toEqual(later)
      expect(() =>
        h.play.executeSceneCommand({
          ...h.input,
          command: {
            kind: 'set-location',
            input: {
              sceneId: h.destinationId,
              locationId: null,
              expectedRevision: 999
            }
          }
        })
      ).toThrow('idempotency_conflict')
      h.campaigns.close()
      const reopened = new CampaignStore(h.root)
      try {
        const restarted = new LivePlayService(
          reopened.activeCampaignPersistence()
        )
        expect(restarted.executeSceneCommand(h.input)).toEqual(receipt)
        expect(restarted.sceneCommandStatus(h.input)).toEqual({
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

it.each(['focus', 'set-location'] as const)(
  'rejects a new %s after the original scene lost focus',
  (kind) => {
    const h = fixture(kind)
    try {
      h.play.focusScene(h.destinationId, h.play.readSession().scene.revision)
      const before = h.play.readSession()
      const input = {
        ...h.input,
        command: {
          ...h.input.command,
          input: {
            ...h.input.command.input,
            expectedRevision: before.scene.revision
          }
        }
      } as SceneCommand
      expect(() => h.play.executeSceneCommand(input)).toThrow('stale')
      expect(h.play.readSession()).toEqual(before)
      expect(h.play.sceneCommandStatus(input).receipt).toBeNull()
    } finally {
      h.campaigns.close()
      rmSync(h.root, { recursive: true, force: true })
    }
  }
)
