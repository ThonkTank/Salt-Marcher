import { z } from 'zod'
import { axialCoordinateSchema } from './hex.js'
import { referenceTargetSchema } from './reference.js'

export const desktopBoundsSchema = z
  .object({
    x: z.number().int().min(0).max(100_000),
    y: z.number().int().min(0).max(100_000),
    width: z.number().int().min(240).max(100_000),
    height: z.number().int().min(160).max(100_000)
  })
  .strict()
  .readonly()

const windowShape = {
  bounds: desktopBoundsSchema,
  minimized: z.boolean(),
  maximized: z.boolean(),
  snap: z.enum(['left', 'right']).nullable()
}
const scrollSchema = z.number().int().min(0).max(10_000_000)
export const desktopReferenceEntrySchema = z
  .object({
    target: referenceTargetSchema,
    title: z.string().min(1).max(300),
    scrollTop: scrollSchema
  })
  .strict()
  .readonly()

const overviewSchema = z
  .object({
    ...windowShape,
    id: z.literal('overview'),
    kind: z.literal('overview')
  })
  .strict()

const previousWindowSchema = z
  .discriminatedUnion('kind', [
    overviewSchema,
    z
      .object({
        ...windowShape,
        id: z.literal('search'),
        kind: z.literal('search'),
        query: z.string().max(300),
        scrollTop: scrollSchema
      })
      .strict(),
    z
      .object({
        ...windowShape,
        id: z.literal('reader'),
        kind: z.literal('reader'),
        entries: z
          .array(desktopReferenceEntrySchema)
          .min(1)
          .max(100)
          .readonly(),
        index: z.number().int().min(0).max(99)
      })
      .strict(),
    z
      .object({
        ...windowShape,
        id: z.uuid(),
        kind: z.literal('reference'),
        entry: desktopReferenceEntrySchema
      })
      .strict()
  ])
  .superRefine((window, context) => {
    if (window.kind === 'reader' && window.index >= window.entries.length)
      context.addIssue({ code: 'custom', message: 'Invalid history position' })
  })
  .readonly()

export const desktopMapViewSchema = z
  .object({
    mapId: z.uuid().nullable(),
    selected: axialCoordinateSchema.nullable(),
    cameras: z
      .array(
        z
          .object({
            mapId: z.uuid(),
            x: z.number().finite().min(-100_000_000).max(100_000_000),
            y: z.number().finite().min(-100_000_000).max(100_000_000),
            scale: z.number().positive().max(100)
          })
          .strict()
          .readonly()
      )
      .max(100)
      .readonly()
  })
  .strict()
  .readonly()

const version3WindowSchema = z.union([
  previousWindowSchema,
  z
    .object({
      ...windowShape,
      id: z.literal('map'),
      kind: z.literal('map'),
      controlsOpen: z.boolean()
    })
    .strict()
    .readonly(),
  z
    .object({
      ...windowShape,
      id: z.literal('combat'),
      kind: z.literal('combat')
    })
    .strict()
    .readonly(),
  z
    .object({ ...windowShape, id: z.literal('loot'), kind: z.literal('loot') })
    .strict()
    .readonly()
])

const characterComparisonSchema = z
  .object({
    language: z.string().max(100),
    passive: z.enum([
      'passivePerception',
      'passiveInsight',
      'passiveInvestigation'
    ]),
    minimum: z.number().int().min(0).max(99).nullable()
  })
  .strict()
  .readonly()

const version4WindowSchema = z.union([
  version3WindowSchema,
  z
    .object({
      ...windowShape,
      id: z.literal('characters'),
      kind: z.literal('characters'),
      comparison: characterComparisonSchema
    })
    .strict()
    .readonly()
])

const version5WindowSchema = z.union([
  version4WindowSchema.refine((window) => window.kind !== 'overview'),
  z
    .object({
      ...windowShape,
      id: z.literal('party'),
      kind: z.literal('party')
    })
    .strict()
    .readonly(),
  z
    .object({
      ...windowShape,
      id: z.literal('groups'),
      kind: z.literal('groups')
    })
    .strict()
    .readonly()
])

export const sceneDesktopWindowSchema = z.union([
  previousWindowSchema.transform((window, context) => {
    if (window.kind === 'overview') {
      context.addIssue({
        code: 'custom',
        message: 'Overview was replaced by Party'
      })
      return z.NEVER
    }
    return window
  }),
  version3WindowSchema.options[1],
  version3WindowSchema.options[2],
  version3WindowSchema.options[3],
  version5WindowSchema.options[1],
  version5WindowSchema.options[2]
])

// Array order is the back-to-front order. Empty is a deliberately closed desktop.
export const sceneDesktopStateSchema = z
  .object({
    schemaVersion: z.literal(6),
    mapView: desktopMapViewSchema,
    combatSelection: z.array(z.uuid()).max(1000).readonly(),
    windows: z.array(sceneDesktopWindowSchema).max(33).readonly()
  })
  .strict()
  .superRefine((state, context) => {
    if (
      new Set(state.windows.map((window) => window.id)).size !==
      state.windows.length
    )
      context.addIssue({ code: 'custom', message: 'Duplicate window IDs' })
  })
  .readonly()

const legacyDesktopStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    windows: z.array(overviewSchema).max(1)
  })
  .strict()

/** Explicit document upgrade; storage revision and preferred geometry are retained. */
export function readStoredDesktopState(value: unknown): SceneDesktopState {
  const old = z
    .union([
      legacyDesktopStateSchema,
      z
        .object({
          schemaVersion: z.literal(5),
          windows: z.array(version5WindowSchema).max(33),
          mapView: desktopMapViewSchema,
          combatSelection: z.array(z.uuid()).max(1000)
        })
        .strict(),
      z
        .object({
          schemaVersion: z.literal(4),
          windows: z.array(version4WindowSchema).max(32),
          mapView: desktopMapViewSchema,
          combatSelection: z.array(z.uuid()).max(1000)
        })
        .strict(),
      z
        .object({
          schemaVersion: z.literal(3),
          windows: z.array(version3WindowSchema).max(32),
          mapView: desktopMapViewSchema,
          combatSelection: z.array(z.uuid()).max(1000)
        })
        .strict(),
      z
        .object({
          schemaVersion: z.literal(2),
          windows: z.array(previousWindowSchema).max(32)
        })
        .strict()
    ])
    .safeParse(value)
  return sceneDesktopStateSchema.parse(
    old.success
      ? {
          ...old.data,
          schemaVersion: 6,
          windows: mergePartyWindows(
            old.data.windows.flatMap((window) =>
              window.kind === 'overview'
                ? [
                    { ...window, id: 'party', kind: 'party' },
                    {
                      ...window,
                      id: 'groups',
                      kind: 'groups',
                      maximized: false,
                      snap: null,
                      bounds: {
                        ...window.bounds,
                        x: Math.min(100000, window.bounds.x + 40),
                        y: Math.min(100000, window.bounds.y + 40)
                      }
                    }
                  ]
                : [window]
            )
          ),
          mapView:
            'mapView' in old.data
              ? old.data.mapView
              : { mapId: null, selected: null, cameras: [] },
          combatSelection:
            'combatSelection' in old.data ? old.data.combatSelection : []
        }
      : value
  )
}

function mergePartyWindows(
  windows: readonly z.infer<typeof version5WindowSchema>[]
) {
  const party = windows.find((window) => window.kind === 'party')
  const characters = windows.find((window) => window.kind === 'characters')
  if (!characters) return windows
  const front = Math.max(
    party ? windows.indexOf(party) : -1,
    windows.indexOf(characters)
  )
  const base = party ?? characters
  const merged = {
    id: 'party' as const,
    kind: 'party' as const,
    bounds: base.bounds,
    snap: base.snap,
    maximized: base.maximized,
    minimized: characters.minimized && (party?.minimized ?? true)
  }
  return windows.flatMap<z.infer<typeof version5WindowSchema>>(
    (window, index) =>
      index === front
        ? [merged]
        : window.kind === 'party' || window.kind === 'characters'
          ? []
          : [window]
  )
}

const scopeShape = { campaignId: z.uuid(), sceneId: z.uuid() }

export const sceneDesktopScopeSchema = z.object(scopeShape).strict().readonly()

function validateReferenceScope(
  value: { campaignId: string; state: SceneDesktopState | null },
  context: z.RefinementCtx
): void {
  for (const window of value.state?.windows ?? []) {
    const entries =
      window.kind === 'reader'
        ? window.entries
        : window.kind === 'reference'
          ? [window.entry]
          : []
    if (
      entries.some(
        (entry) =>
          entry.target.scope === 'campaign' &&
          entry.target.campaignId !== value.campaignId
      )
    )
      context.addIssue({
        code: 'custom',
        message: 'Reference belongs to another campaign'
      })
  }
}

export const sceneDesktopSnapshotSchema = z
  .object({
    ...scopeShape,
    revision: z.number().int().nonnegative().safe(),
    state: sceneDesktopStateSchema.nullable()
  })
  .strict()
  .superRefine(validateReferenceScope)
  .readonly()

export const saveSceneDesktopInputSchema = z
  .object({
    ...scopeShape,
    expectedRevision: z.number().int().nonnegative().safe(),
    state: sceneDesktopStateSchema
  })
  .strict()
  .superRefine(validateReferenceScope)
  .readonly()

export type DesktopReferenceEntry = z.infer<typeof desktopReferenceEntrySchema>
export type DesktopBounds = z.infer<typeof desktopBoundsSchema>
export type SceneDesktopWindow = z.infer<typeof sceneDesktopWindowSchema>
export type SceneDesktopState = z.infer<typeof sceneDesktopStateSchema>
export type SceneDesktopScope = z.infer<typeof sceneDesktopScopeSchema>
export type SceneDesktopSnapshot = z.infer<typeof sceneDesktopSnapshotSchema>
export type SaveSceneDesktopInput = z.infer<typeof saveSceneDesktopInputSchema>

export type DesktopMapView = z.infer<typeof desktopMapViewSchema>
