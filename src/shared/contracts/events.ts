import type { z } from 'zod'
import { biomeChangeNoticeSchema } from './biome.js'
import { encounterTableChangeNoticeSchema } from './encounter-source.js'
import { hexChangeNoticeSchema } from './hex.js'
import { locationSymbolChangeNoticeSchema } from './location-symbol.js'
import { lootChangeNoticeSchema } from './loot.js'
import { referenceIndexChangeNoticeSchema } from './reference.js'
import { coreProcessStatusSchema } from './runtime.js'
import { sessionChangeNoticeSchema } from './session-change.js'
import { sessionPreparationChangeNoticeSchema } from './session-planner.js'
import { worldLocationChangeNoticeSchema } from './world-location.js'
import type { WindowRole } from './operations.js'

export type EventDefinition<Payload extends z.ZodType = z.ZodType> = Readonly<{
  channel: string
  payload: Payload
  roles: readonly WindowRole[]
  namespace: string
  method: string
}>

const definitions = {
  'references.onCampaignIndexChanged': {
    channel: 'references:index-changed',
    payload: referenceIndexChangeNoticeSchema,
    roles: ['gm']
  },
  'locations.onChanged': {
    channel: 'locations:changed',
    payload: worldLocationChangeNoticeSchema,
    roles: ['gm']
  },
  'locationSymbols.onChanged': {
    channel: 'location-symbols:changed',
    payload: locationSymbolChangeNoticeSchema,
    roles: ['gm']
  },
  'biomes.onChanged': {
    channel: 'biomes:changed',
    payload: biomeChangeNoticeSchema,
    roles: ['gm']
  },
  'encounterTables.onChanged': {
    channel: 'encounter-tables:changed',
    payload: encounterTableChangeNoticeSchema,
    roles: ['gm']
  },
  'hex.onChanged': {
    channel: 'hex:changed',
    payload: hexChangeNoticeSchema,
    roles: ['gm']
  },
  'session.onChanged': {
    channel: 'session:changed',
    payload: sessionChangeNoticeSchema,
    roles: ['gm']
  },
  'sessionPlanner.onPreparationChanged': {
    channel: 'session-planner:preparation-changed',
    payload: sessionPreparationChangeNoticeSchema,
    roles: ['gm']
  },
  'loot.onChanged': {
    channel: 'loot:changed',
    payload: lootChangeNoticeSchema,
    roles: ['gm']
  },
  'runtime.onCoreStatus': {
    channel: 'runtime:core-status-changed',
    payload: coreProcessStatusSchema,
    roles: ['gm', 'qualification']
  }
} as const

export const capabilityEvents = registerEvents(definitions)

function registerEvents<
  const Definitions extends Readonly<
    Record<
      string,
      Readonly<{
        channel: string
        payload: z.ZodType
        roles: readonly WindowRole[]
      }>
    >
  >
>(
  events: Definitions
): {
  readonly [Kind in keyof Definitions]: Definitions[Kind] &
    Readonly<{ namespace: string; method: string }>
} {
  return Object.fromEntries(
    Object.entries(events).map(([kind, definition]) => {
      const separator = kind.indexOf('.')
      if (separator < 1 || separator === kind.length - 1)
        throw new Error(`invalid_event_kind:${kind}`)
      return [
        kind,
        {
          ...definition,
          namespace: kind.slice(0, separator),
          method: kind.slice(separator + 1)
        }
      ]
    })
  ) as {
    readonly [Kind in keyof Definitions]: Definitions[Kind] &
      Readonly<{ namespace: string; method: string }>
  }
}

export type CapabilityEventKind = keyof typeof capabilityEvents
export type CapabilityEventPayload<K extends CapabilityEventKind> = z.output<
  (typeof capabilityEvents)[K]['payload']
>
