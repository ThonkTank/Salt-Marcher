import { z } from 'zod'
import {
  adjustInitiativeInputSchema,
  changeHpInputSchema,
  combatRevisionInputSchema,
  confirmInitiativeInputSchema,
  prepareCombatInputSchema,
  updateResolutionInputSchema
} from './live-session.js'
import {
  adjustPartyXpInputSchema,
  adventuringDayInputSchema,
  createPartyCharacterInputSchema,
  deletePartyCharacterInputSchema,
  restPartyInputSchema,
  setMembershipInputSchema,
  updatePartyCharacterInputSchema
} from './party.js'
import { creatureCatalogQuerySchema } from './encounter.js'
import {
  assignScenePartyInputSchema,
  deleteSceneGroupInputSchema,
  evaluateEncounterSelectionInputSchema,
  evaluateSceneGroupDraftInputSchema,
  focusSceneInputSchema,
  saveSceneGroupInputSchema,
  sceneGroupDraftGenerationRequestSchema,
  setSceneLocationInputSchema
} from './scene.js'
import {
  createWorldLocationInputSchema,
  deleteWorldLocationInputSchema,
  updateWorldLocationInputSchema
} from './world-location.js'
import {
  createEncounterTableInputSchema,
  createWorldFactionInputSchema,
  deleteEncounterTableInputSchema,
  deleteWorldFactionInputSchema,
  updateEncounterTableInputSchema,
  updateWorldFactionInputSchema
} from './encounter-source.js'
import {
  createHexMapInputSchema,
  evaluateHexRouteInputSchema,
  mutateHexTravelInputSchema,
  paintHexTerrainInputSchema,
  placeHexLocationInputSchema,
  positionHexPartyInputSchema,
  removeHexLocationInputSchema,
  setHexTravelMultiplierInputSchema,
  startHexTravelInputSchema,
  updateHexMapInputSchema
} from './hex.js'

const id = z.uuid()
const simple = <const K extends string>(kind: K) =>
  z.object({ requestId: id, kind: z.literal(kind) }).strict()

export const coreRequestSchema = z.discriminatedUnion('kind', [
  simple('campaign.list'),
  simple('core.shutdown'),
  z
    .object({
      requestId: id,
      kind: z.literal('campaign.create'),
      input: z.object({ name: z.string().trim().min(1).max(100) }).strict()
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('campaign.activate'),
      input: z.object({ id }).strict()
    })
    .strict(),
  simple('party.read'),
  z
    .object({
      requestId: id,
      kind: z.literal('party.setMembership'),
      input: setMembershipInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('party.create'),
      input: createPartyCharacterInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('party.update'),
      input: updatePartyCharacterInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('party.delete'),
      input: deletePartyCharacterInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('party.adjustXp'),
      input: adjustPartyXpInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('party.rest'),
      input: restPartyInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('party.calculateAdventuringDay'),
      input: adventuringDayInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('creatures.search'),
      input: creatureCatalogQuerySchema
    })
    .strict(),
  simple('creatures.filterOptions'),
  z
    .object({
      requestId: id,
      kind: z.literal('creatures.detail'),
      input: z.object({ id: z.string().min(1) }).strict()
    })
    .strict(),
  simple('locations.read'),
  z
    .object({
      requestId: id,
      kind: z.literal('locations.create'),
      input: createWorldLocationInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('locations.update'),
      input: updateWorldLocationInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('locations.delete'),
      input: deleteWorldLocationInputSchema
    })
    .strict(),
  simple('encounterTables.read'),
  z
    .object({
      requestId: id,
      kind: z.literal('encounterTables.create'),
      input: createEncounterTableInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('encounterTables.update'),
      input: updateEncounterTableInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('encounterTables.delete'),
      input: deleteEncounterTableInputSchema
    })
    .strict(),
  simple('factions.read'),
  z
    .object({
      requestId: id,
      kind: z.literal('factions.create'),
      input: createWorldFactionInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('factions.update'),
      input: updateWorldFactionInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('factions.delete'),
      input: deleteWorldFactionInputSchema
    })
    .strict(),
  simple('session.read'),
  z
    .object({
      requestId: id,
      kind: z.literal('scene.focus'),
      input: focusSceneInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('scene.setLocation'),
      input: setSceneLocationInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('scene.saveGroup'),
      input: saveSceneGroupInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('scene.deleteGroup'),
      input: deleteSceneGroupInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('scene.assignPartyMember'),
      input: assignScenePartyInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('scene.evaluateGroupDraft'),
      input: evaluateSceneGroupDraftInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('scene.generateGroupDraft'),
      input: sceneGroupDraftGenerationRequestSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('encounter.evaluate'),
      input: evaluateEncounterSelectionInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('combat.prepare'),
      input: prepareCombatInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('combat.rollInitiative'),
      input: combatRevisionInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('combat.confirmInitiative'),
      input: confirmInitiativeInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('combat.advanceTurn'),
      input: combatRevisionInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('combat.adjustInitiative'),
      input: adjustInitiativeInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('combat.changeHp'),
      input: changeHpInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('combat.end'),
      input: combatRevisionInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('combat.updateResolution'),
      input: updateResolutionInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('combat.awardXp'),
      input: combatRevisionInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('combat.complete'),
      input: combatRevisionInputSchema
    })
    .strict(),
  simple('hex.terrainCatalog'),
  simple('hex.catalog'),
  z
    .object({
      requestId: id,
      kind: z.literal('hex.read'),
      input: z.object({ mapId: z.uuid() }).strict()
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('hex.create'),
      input: createHexMapInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('hex.update'),
      input: updateHexMapInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('hex.paint'),
      input: paintHexTerrainInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('hex.placeLocation'),
      input: placeHexLocationInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('hex.removeLocation'),
      input: removeHexLocationInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('hexTravel.read'),
      input: z.object({ sceneId: z.uuid() }).strict()
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('hexTravel.evaluate'),
      input: evaluateHexRouteInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('hexTravel.position'),
      input: positionHexPartyInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('hexTravel.start'),
      input: startHexTravelInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('hexTravel.pause'),
      input: mutateHexTravelInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('hexTravel.resume'),
      input: mutateHexTravelInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('hexTravel.abort'),
      input: mutateHexTravelInputSchema
    })
    .strict(),
  z
    .object({
      requestId: id,
      kind: z.literal('hexTravel.setMultiplier'),
      input: setHexTravelMultiplierInputSchema
    })
    .strict()
])

export const coreResultSchema = z.discriminatedUnion('ok', [
  z
    .object({ requestId: id, ok: z.literal(true), payload: z.unknown() })
    .strict(),
  z
    .object({
      requestId: id,
      ok: z.literal(false),
      error: z
        .object({
          code: z.enum([
            'validation_failed',
            'stale',
            'not_found',
            'read_only',
            'timeout',
            'outcome_unknown',
            'core_unavailable',
            'protocol_violation',
            'internal'
          ]),
          retryable: z.boolean()
        })
        .strict()
    })
    .strict()
])

export type CoreRequest = z.infer<typeof coreRequestSchema>
