import { z } from 'zod'
import {
  composeOperationDefinitions,
  registerOperations
} from './operations/registry.js'
import { runtimeOperationDefinitions } from './operations/runtime.js'
import { campaignOperationDefinitions } from './operations/campaign.js'
import { campaignImportOperationDefinitions } from './operations/campaign-import.js'
import { settingsOperationDefinitions } from './operations/settings.js'
import { campaignRulesOperationDefinitions } from './operations/campaign-rules.js'
import { generatorPresetsOperationDefinitions } from './operations/generator-presets.js'
import { passiveProjectionOperationDefinitions } from './operations/passive-projection.js'
import { partyOperationDefinitions } from './operations/party.js'
import { creaturesOperationDefinitions } from './operations/creatures.js'
import { referencesOperationDefinitions } from './operations/references.js'
import { locationsOperationDefinitions } from './operations/locations.js'
import { locationSymbolsOperationDefinitions } from './operations/location-symbols.js'
import { biomesOperationDefinitions } from './operations/biomes.js'
import { encounterTablesOperationDefinitions } from './operations/encounter-tables.js'
import { factionsOperationDefinitions } from './operations/factions.js'
import { npcsOperationDefinitions } from './operations/npcs.js'
import { sessionOperationDefinitions } from './operations/session.js'
import { encounterPlansOperationDefinitions } from './operations/encounter-plans.js'
import { sessionPlannerOperationDefinitions } from './operations/session-planner.js'
import { lootOperationDefinitions } from './operations/loot.js'
import { sceneOperationDefinitions } from './operations/scene.js'
import { encounterOperationDefinitions } from './operations/encounter.js'
import { combatOperationDefinitions } from './operations/combat.js'
import { hexOperationDefinitions } from './operations/hex.js'
import { hexTravelOperationDefinitions } from './operations/hex-travel.js'
import { coreLifecycleOperationDefinitions } from './operations/core-lifecycle.js'

export type {
  OperationDefinition,
  OperationDiagnostics,
  OperationHandlerOwner,
  OperationMode,
  TravelReconciliationReason,
  WindowRole
} from './operations/registry.js'

export const coreOperationFragments = [
  campaignOperationDefinitions,
  campaignImportOperationDefinitions,
  settingsOperationDefinitions,
  campaignRulesOperationDefinitions,
  generatorPresetsOperationDefinitions,
  passiveProjectionOperationDefinitions,
  partyOperationDefinitions,
  creaturesOperationDefinitions,
  referencesOperationDefinitions,
  locationsOperationDefinitions,
  locationSymbolsOperationDefinitions,
  biomesOperationDefinitions,
  encounterTablesOperationDefinitions,
  factionsOperationDefinitions,
  npcsOperationDefinitions,
  sessionOperationDefinitions,
  encounterPlansOperationDefinitions,
  sessionPlannerOperationDefinitions,
  lootOperationDefinitions,
  sceneOperationDefinitions,
  encounterOperationDefinitions,
  combatOperationDefinitions,
  hexOperationDefinitions,
  hexTravelOperationDefinitions,
  coreLifecycleOperationDefinitions
] as const

export const mainOperationFragments = [runtimeOperationDefinitions] as const

export const coreOperations = registerOperations(
  composeOperationDefinitions(...coreOperationFragments),
  'utility'
)

export const mainOperations = registerOperations(
  composeOperationDefinitions(...mainOperationFragments),
  'main'
)

export type CoreOperationKind = keyof typeof coreOperations
export type MainOperationKind = keyof typeof mainOperations
export type CoreOperationInput<K extends CoreOperationKind> = z.output<
  (typeof coreOperations)[K]['input']
>
export type CoreOperationOutput<K extends CoreOperationKind> = z.output<
  (typeof coreOperations)[K]['output']
>
export type MainOperationInput<K extends MainOperationKind> = z.output<
  (typeof mainOperations)[K]['input']
>
export type MainOperationOutput<K extends MainOperationKind> = z.output<
  (typeof mainOperations)[K]['output']
>

export function isCoreOperationKind(value: string): value is CoreOperationKind {
  return Object.hasOwn(coreOperations, value)
}

export function operationForChannel(
  channel: string
):
  | readonly [CoreOperationKind, (typeof coreOperations)[CoreOperationKind]]
  | null {
  for (const [kind, definition] of Object.entries(coreOperations))
    if (definition.channel === channel)
      return [kind as CoreOperationKind, definition] as const
  return null
}

export function mainOperationForChannel(
  channel: string
):
  | readonly [MainOperationKind, (typeof mainOperations)[MainOperationKind]]
  | null {
  for (const [kind, definition] of Object.entries(mainOperations))
    if (definition.channel === channel)
      return [kind as MainOperationKind, definition] as const
  return null
}
