import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { fixedSqliteDatabaseAccess } from '../../src/core/persistence/sqlite/database-access.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import type {
  RunningScene,
  SceneGroup
} from '../../src/shared/contracts/scene.js'
import type { CurrentFormatRootFixture } from './current-format-root-fixture.js'
import {
  assertCurrentFormatRootReadback,
  readCurrentFormatRootFixture,
  type CurrentFormatRootCampaignReadback,
  type CurrentFormatRootReadback
} from './current-format-root-readback.js'
import type {
  CurrentFormatLiveCampaign,
  CurrentFormatLiveFixture
} from './current-format-live-fixture.js'
import type { CurrentFormatLiveMaterializationReceipt } from './current-format-live-materializer.js'

export type CurrentFormatLiveCampaignReadback = Readonly<{
  role: 'A' | 'B'
  campaignId: string
  session: LiveSessionSnapshot
  semanticProjection: unknown
  semanticSha256: string
}>

export type CurrentFormatLiveReadback = Readonly<{
  fixtureIdentity: string
  qualificationClaim: string
  root: CurrentFormatRootReadback
  campaigns: readonly CurrentFormatLiveCampaignReadback[]
}>

export function readCurrentFormatLiveFixture(
  dataRoot: string,
  rootFixture: CurrentFormatRootFixture,
  liveFixture: CurrentFormatLiveFixture
): CurrentFormatLiveReadback {
  const root = readCurrentFormatRootFixture(dataRoot, rootFixture)
  const campaigns = new CampaignStore(dataRoot)
  try {
    const registry = campaigns.list()
    const readbacks = liveFixture.campaigns.map((configured) => {
      const rootCampaign = root.campaigns.find(
        ({ role }) => role === configured.role
      )
      if (!rootCampaign)
        throw new Error(
          `Current-format live Campaign ${configured.role} has no root readback.`
        )
      const session = campaigns.visitCampaignDatabase(
        rootCampaign.campaignId,
        (database) =>
          new LivePlayService(fixedSqliteDatabaseAccess(database)).readSession()
      )
      if (!session)
        throw new Error(
          `Current-format live Campaign ${configured.role} database is unavailable.`
        )
      const semanticProjection = semanticLiveProjection(
        configured,
        rootCampaign,
        session
      )
      return Object.freeze({
        role: configured.role,
        campaignId: rootCampaign.campaignId,
        session,
        semanticProjection,
        semanticSha256: semanticHash(semanticProjection)
      })
    })
    assert.deepStrictEqual(
      campaigns.list(),
      registry,
      'Independent live readback must not mutate Campaign registry state.'
    )
    return Object.freeze({
      fixtureIdentity: liveFixture.identity,
      qualificationClaim: liveFixture.qualificationClaim,
      root,
      campaigns: Object.freeze(readbacks)
    })
  } finally {
    campaigns.close()
  }
}

export function assertCurrentFormatLiveReadback(
  rootFixture: CurrentFormatRootFixture,
  liveFixture: CurrentFormatLiveFixture,
  readback: CurrentFormatLiveReadback
): void {
  assertCurrentFormatRootReadback(rootFixture, readback.root)
  assert.equal(readback.fixtureIdentity, liveFixture.identity)
  assert.equal(readback.qualificationClaim, liveFixture.qualificationClaim)
  assert.equal(readback.campaigns.length, liveFixture.campaigns.length)
  const campaignUuidSets: Set<string>[] = []
  for (const expected of liveFixture.campaigns) {
    const actual = readback.campaigns.find(({ role }) => role === expected.role)
    assert.ok(actual, `Missing live readback for Campaign ${expected.role}.`)
    assertCampaign(expected, actual)
    campaignUuidSets.push(collectUuids(actual.session))
  }
  for (const id of campaignUuidSets[0] ?? [])
    assert.ok(
      !(campaignUuidSets[1]?.has(id) ?? false),
      `Live identity ${id} leaked across Campaign A/B.`
    )
}

export function assertCurrentFormatLiveReceipt(
  receipt: CurrentFormatLiveMaterializationReceipt,
  readback: CurrentFormatLiveReadback
): void {
  assert.equal(receipt.fixtureIdentity, readback.fixtureIdentity)
  assert.equal(receipt.qualificationClaim, readback.qualificationClaim)
  for (const expected of receipt.campaigns) {
    const actual = readback.campaigns.find(({ role }) => role === expected.role)
    assert.ok(actual, `Missing receipt readback for Campaign ${expected.role}.`)
    assert.equal(actual.campaignId, expected.campaignId)
    assert.equal(actual.session.scene.focusedSceneId, expected.sceneId)
    assert.equal(actual.session.combat?.id, expected.combatId)
    assert.ok(
      actual.session.party.members.some(
        ({ id, active }) => id === expected.addedInactivePartyId && !active
      ),
      `Campaign ${expected.role} inactive Party receipt did not survive reopen.`
    )
    const focused = actual.session.scene.scenes.find(
      ({ id }) => id === expected.sceneId
    )
    assert.ok(focused)
    assert.deepStrictEqual(
      new Set(focused.groups.map(({ id }) => id)),
      new Set(expected.groupIds),
      `Campaign ${expected.role} Group receipts did not survive reopen.`
    )
  }
}

function assertCampaign(
  expected: CurrentFormatLiveCampaign,
  actual: CurrentFormatLiveCampaignReadback
): void {
  const session = actual.session
  const focused: RunningScene | undefined = session.scene.scenes.find(
    ({ id }) => id === session.scene.focusedSceneId
  )
  assert.ok(focused, `Campaign ${expected.role} has no focused Scene.`)
  assert.equal(session.party.revision, expected.expected.partyRevision)
  assert.equal(session.scene.revision, expected.expected.sceneRevision)
  assert.equal(session.revision, expected.expected.sceneRevision)
  assert.equal(
    session.party.members.filter(({ active }) => active).length,
    expected.expected.activePartyCount
  )
  assert.equal(
    session.party.members.filter(({ active }) => !active).length,
    expected.expected.inactivePartyCount
  )
  assert.equal(focused.locationName, expected.expected.focusedLocationName)
  assert.equal(focused.groups.length, expected.expected.groupCount)
  assert.equal(
    focused.groups.filter(({ archived }) => archived).length,
    expected.expected.archivedGroupCount
  )
  assert.ok(session.combat, `Campaign ${expected.role} has no Combat.`)
  assert.equal(session.combat.phase, expected.expected.combatPhase)
  assert.equal(session.combat.revision, expected.expected.combatRevision)
  assert.equal(session.combat.cards.length, 0)
  assert.equal(session.combat.resolution, null)
  assert.equal(
    actual.semanticSha256,
    expected.expected.semanticSha256,
    `Campaign ${expected.role} complete semantic LiveSessionSnapshot hash drifted; actual ${actual.semanticSha256}.`
  )
}

function semanticLiveProjection(
  configured: CurrentFormatLiveCampaign,
  root: CurrentFormatRootCampaignReadback,
  session: LiveSessionSnapshot
): unknown {
  const identities = new Map<string, string>()
  for (const mapping of root.mappings)
    if (mapping.kind === 'party' || mapping.kind === 'locations')
      identities.set(mapping.internalId, mapping.externalKey)

  const addedParty = session.party.members.filter(
    ({ name }) =>
      name === configured.materialization.addedInactiveParty.draft.name
  )
  assert.equal(
    addedParty.length,
    1,
    `Campaign ${configured.role} inactive Party sentinel is not singular.`
  )
  identities.set(
    addedParty[0]!.id,
    configured.materialization.addedInactiveParty.semanticKey
  )

  const focused = session.scene.scenes.find(
    ({ id }) => id === session.scene.focusedSceneId
  )
  assert.ok(focused, `Campaign ${configured.role} focused Scene is missing.`)
  assert.equal(
    session.scene.scenes.length,
    1,
    `Campaign ${configured.role} invented an unsupported additional Scene.`
  )
  identities.set(focused.id, 'scene:default')

  for (const expectedGroup of configured.materialization.groups) {
    const groups: readonly SceneGroup[] = focused.groups.filter(
      ({ name }) => name === expectedGroup.name
    )
    assert.equal(
      groups.length,
      1,
      `Campaign ${configured.role} Group ${expectedGroup.semanticKey} is not singular.`
    )
    const group = groups[0]!
    identities.set(group.id, expectedGroup.semanticKey)
    assert.equal(group.entries.length, expectedGroup.entries.length)
    for (const expectedEntry of expectedGroup.entries) {
      const entries: readonly SceneGroup['entries'][number][] =
        group.entries.filter(
          ({ creatureId }) => creatureId === expectedEntry.creatureId
        )
      assert.equal(
        entries.length,
        1,
        `Campaign ${configured.role} Group ${expectedGroup.semanticKey} entry ${expectedEntry.creatureId} is not singular.`
      )
      const entry = entries[0]!
      const entryKey = `${expectedGroup.semanticKey}/entry:${expectedEntry.creatureId}`
      identities.set(entry.id, entryKey)
      entry.members.forEach((member, index) =>
        identities.set(member.id, `${entryKey}/member:${index}`)
      )
    }
  }
  if (session.combat) identities.set(session.combat.id, 'combat:focused')

  const projected = replaceSemanticIds(session, identities)
  assertNoRawUuid(projected, configured.role)
  return projected
}

function replaceSemanticIds(
  value: unknown,
  identities: ReadonlyMap<string, string>
): unknown {
  if (Array.isArray(value))
    return value.map((entry) => replaceSemanticIds(entry, identities))
  if (typeof value === 'object' && value !== null)
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        replaceSemanticIds(entry, identities)
      ])
    )
  if (typeof value !== 'string') return value
  let projected = value
  for (const [id, semanticKey] of [...identities].sort(
    ([left], [right]) => right.length - left.length
  ))
    projected = projected.replaceAll(id, semanticKey)
  return projected
}

function assertNoRawUuid(value: unknown, role: 'A' | 'B'): void {
  const serialized = JSON.stringify(value)
  const match = serialized.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
  )
  if (match)
    throw new Error(
      `Campaign ${role} semantic projection left raw identity ${match[0]}.`
    )
}

function semanticHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex')
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)])
  )
}

function collectUuids(value: unknown): Set<string> {
  const matches = JSON.stringify(value).match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi
  )
  return new Set(matches ?? [])
}
