import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { cpus, platform, release, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { execFileSync } from 'node:child_process'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { PartyActionService } from '../../src/core/application/party-action-service.js'
import { PartyCombatHistoryOwner } from '../../src/core/encounter/party-combat-history-owner.js'
import { PartyTravelHistoryOwner } from '../../src/core/hex/party-travel-history-owner.js'
import { partyHistoryPayloadSchema } from '../../src/core/party/party-history-store.js'
import {
  activeCampaignDatabase,
  installationDatabase
} from '../support/campaign-store-test-access.js'
import {
  historyCases,
  seedHistoryFixture,
  type HistoryCase
} from './party-history-fixture.js'
import { HistoryProfiler, type Measurement } from './party-history-profiler.js'

type Action = 'xp' | 'quick-fields' | 'rest' | 'move'
const actions: Action[] = ['xp', 'quick-fields', 'rest', 'move']
const args = process.argv.slice(2)
const argument = (name: string) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const selected = argument('--case')
const warm = Number(argument('--warm') ?? 7)
assert(Number.isSafeInteger(warm) && warm >= 1)
const cases = selected
  ? historyCases.filter((row) => row.name === selected)
  : historyCases
assert(cases.length > 0, 'Unknown measurement case')
const output = resolve(
  argument('--output') ?? '.tmp/party-history-measurement.json'
)
const sqlShapes = new Set<string>()
const sources = Object.fromEntries(
  [
    'party-history-measure.ts',
    'party-history-fixture.ts',
    'party-history-profiler.ts'
  ].map((name) => [
    name,
    createHash('sha256')
      .update(readFileSync(new URL(name, import.meta.url)))
      .digest('hex')
  ])
)

function runSeries(size: HistoryCase, action: Action, instrumented: boolean) {
  const root = mkdtempSync(join(tmpdir(), 'salt-history-measure-'))
  const seedStart = performance.now()
  const ids = seedHistoryFixture(root, size)
  const seedMs = performance.now() - seedStart
  const openStart = performance.now()
  const campaigns = new CampaignStore(root)
  const play = new LivePlayService(campaigns.activeCampaignPersistence())
  const service = new PartyActionService(
    campaigns.activeCampaignPersistence(),
    campaigns.installationPersistenceAccess(),
    () => ids.campaignId,
    play
  )
  const openMs = performance.now() - openStart
  const db = activeCampaignDatabase(campaigns)
  const profiler = instrumented ? new HistoryProfiler() : null
  const foreignDigest = () =>
    createHash('sha256')
      .update(
        JSON.stringify({
          combat: new PartyCombatHistoryOwner(db)
            .capture()
            .filter((row) => row.sceneId !== ids.sourceId),
          travel: new PartyTravelHistoryOwner(db)
            .capture()
            .filter((row) => row.scene_id !== ids.sourceId)
        })
      )
      .digest('hex')
  try {
    // Validation/input reads are outside the measured action; no OS-cache-cold claim.
    const foreign = foreignDigest()
    profiler?.installOwners()
    profiler?.installDatabase(db, 'campaign')
    profiler?.installDatabase(installationDatabase(campaigns), 'installation')
    const samples = []
    for (let index = 0; index <= warm; index++) {
      const before = play.readSession()
      const member = before.party.members.find(
        (row) => row.id === ids.memberId
      )!
      const commandId = randomUUID()
      const settingsRevision = campaigns.readSettings().revision
      const work = () => {
        if (action === 'xp')
          return service.executeCharacter({
            commandId,
            command: {
              kind: 'adjust-xp',
              input: {
                id: ids.memberId,
                delta: 25,
                expectedRevision: before.party.revision
              }
            }
          })
        if (action === 'quick-fields')
          return service.quickFields({
            campaignId: ids.campaignId,
            commandId,
            fields: ['level'],
            expectedRevision: settingsRevision
          })
        if (action === 'rest')
          return service.executeScene({
            commandId,
            command: {
              kind: 'rest-selected',
              input: {
                sceneId: ids.sourceId,
                memberIds: [ids.memberId],
                type: 'short',
                expectedRevision: before.party.revision,
                expectedSceneRevision: before.scene.revision
              }
            }
          })
        return service.executeScene({
          commandId,
          command: {
            kind: 'move-roster',
            input: {
              sceneId: ids.sourceId,
              memberIds: [ids.memberId],
              expectedRevision: before.scene.revision,
              expectedPartyRevision: before.party.revision,
              target: { kind: 'new' }
            }
          }
        })
      }
      const start = performance.now()
      const timing: Measurement = profiler
        ? profiler.measure(work)
        : (() => {
            work()
            return { totalMs: performance.now() - start, phases: {} }
          })()
      const stored = db
        .prepare(
          'SELECT payload_json, length(CAST(payload_json AS BLOB)) AS bytes FROM party_action_history WHERE id = ?'
        )
        .get(commandId) as { payload_json: string; bytes: number }
      assert(stored)
      const payload = partyHistoryPayloadSchema.parse(
        JSON.parse(stored.payload_json)
      )
      const receipt = db
        .prepare(
          'SELECT length(CAST(result_json AS BLOB)) AS bytes FROM party_action_receipt WHERE command_id = ?'
        )
        .get(commandId) as { bytes: number }
      assert(
        payload.combat.every((row) => row.sceneId === ids.sourceId),
        'Unrelated combat entered history'
      )
      assert(
        payload.travel.every((row) => row.before.scene_id === ids.sourceId),
        'Unrelated journey entered history'
      )
      if (action === 'quick-fields') {
        assert.equal(payload.party.length, 0)
        assert.deepEqual(payload.preferences?.after, ['level'])
      } else if (action === 'move') {
        assert.equal(payload.scene.created.length, 1)
        assert.equal(payload.scene.assignments.length, 1)
        if (size.actors > 0) {
          assert.equal(payload.combat.length, 1)
          assert.equal(payload.travel.length, 1)
        }
      } else {
        assert.equal(payload.party.length, 1)
        assert.equal(
          payload.party[0]!.after.xp,
          member.xp + (action === 'xp' ? 25 : 0)
        )
        if (action === 'rest')
          assert.equal(payload.party[0]!.after.xpSinceShortRest, 0)
      }
      samples.push({
        sample: index === 0 ? 'first' : 'repeated',
        index,
        ...timing,
        payloadBytes: stored.bytes,
        receiptBytes: receipt.bytes,
        changed: {
          party: payload.party.length,
          assignments: payload.scene.assignments.length,
          created: payload.scene.created.length,
          combat: payload.combat.length,
          travel: payload.travel.length
        }
      })
      service.undoRedo({
        campaignId: ids.campaignId,
        commandId: randomUUID(),
        direction: 'undo',
        stepId: commandId
      })
      assert.deepEqual(
        play.readParty().members.find((row) => row.id === ids.memberId),
        member
      )
      assert.equal(
        play.readSession().scene.scenes.length,
        before.scene.scenes.length
      )
      assert.equal(
        foreignDigest(),
        foreign,
        'Unrelated persisted states changed'
      )
    }
    for (const sql of profiler?.sqlShapes ?? []) sqlShapes.add(sql)
    return { case: size.name, action, instrumented, seedMs, openMs, samples }
  } finally {
    profiler?.close()
    campaigns.close()
    rmSync(root, { recursive: true, force: true })
  }
}

function schemaProbe() {
  const root = mkdtempSync(join(tmpdir(), 'salt-history-schema-'))
  const ids = seedHistoryFixture(root, historyCases[0])
  const campaigns = new CampaignStore(root)
  try {
    const db = activeCampaignDatabase(campaigns)
    db.exec(
      'ALTER TABLE scene_running_scene ADD COLUMN measurement_unrelated_note TEXT'
    )
    const play = new LivePlayService(campaigns.activeCampaignPersistence())
    const service = new PartyActionService(
      campaigns.activeCampaignPersistence(),
      campaigns.installationPersistenceAccess(),
      () => ids.campaignId,
      play
    )
    let failure = ''
    try {
      service.quickFields({
        campaignId: ids.campaignId,
        commandId: randomUUID(),
        expectedRevision: campaigns.readSettings().revision,
        fields: ['level']
      })
    } catch (error) {
      failure = String(error)
    }
    assert(
      failure.includes('measurement_unrelated_note'),
      'Expected strict unrelated scene-row failure'
    )
    assert.deepEqual(
      db.prepare('SELECT count(*) AS count FROM party_action_history').get(),
      { count: 0 }
    )
    return {
      action: 'quick-fields',
      unrelatedColumn: 'scene_running_scene.measurement_unrelated_note',
      expectedFailure: failure,
      historyRows: 0
    }
  } finally {
    campaigns.close()
    rmSync(root, { recursive: true, force: true })
  }
}

const results: ReturnType<typeof runSeries>[] = []
for (const size of cases)
  for (const action of actions)
    for (const instrumented of [true, false]) {
      const series = runSeries(size, action, instrumented)
      results.push(series)
      console.info(
        JSON.stringify({
          case: size.name,
          action,
          instrumented,
          firstMs: series.samples[0]!.totalMs,
          repeatedMs: series.samples.slice(1).map((sample) => sample.totalMs)
        })
      )
    }
writeFileSync(
  output,
  JSON.stringify(
    {
      version: 1,
      sources,
      recordedAt: new Date().toISOString(),
      baseline: execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8'
      }).trim(),
      environment: {
        node: process.version,
        platform: platform(),
        release: release(),
        cpu: cpus()[0]?.model,
        logicalCpus: cpus().length
      },
      warmRepeats: warm,
      cases,
      results,
      sqlShapes: [...sqlShapes].sort(),
      schemaProbe: schemaProbe()
    },
    null,
    2
  ) + '\n'
)
console.info(`Measurement saved: ${output}`)
