import { z } from 'zod'
import { worldLocationSnapshotSchema } from './world-location.js'
import {
  builtinLocationSymbolIdSchema,
  locationSymbolViewBoxSchema
} from './location-symbol.js'
import {
  MAX_HEX_BRUSH_RADIUS,
  MAX_HEX_STROKE_POINTS
} from '../hex/axial-geometry.js'

export const axialCoordinateSchema = z
  .object({ q: z.number().int().safe(), r: z.number().int().safe() })
  .strict()

export const hexTerrainIdSchema = z.enum([
  'grassland',
  'desert',
  'forest',
  'swamp',
  'mountain',
  'water'
])

export const hexTerrainDefinitionSchema = z
  .object({
    id: hexTerrainIdSchema,
    label: z.string().min(1),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    passable: z.boolean(),
    travelCost: z.number().positive()
  })
  .strict()

export const hexTerrainCatalogSchema = z
  .object({
    version: z.literal('saltmarcher-v1'),
    terrains: z.array(hexTerrainDefinitionSchema).length(6)
  })
  .strict()

export const hexMapSummarySchema = z
  .object({
    id: z.uuid(),
    displayName: z.string().min(1).max(100),
    metadataRevision: z.number().int().nonnegative(),
    contentRevision: z.number().int().nonnegative(),
    position: z.number().int().nonnegative()
  })
  .strict()

export const hexMarkerSymbolSchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('builtin'), id: builtinLocationSymbolIdSchema })
    .strict(),
  z
    .object({
      kind: z.literal('custom'),
      id: z.uuid(),
      viewBox: locationSymbolViewBoxSchema,
      pathData: z.string().min(1).max(200_000),
      fillRule: z.enum(['nonzero', 'evenodd'])
    })
    .strict()
])

export const hexMarkerPresentationSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    title: z.string().min(1).max(100),
    symbol: hexMarkerSymbolSchema,
    symbolSize: z.number().int().min(24).max(80),
    labelCurve: z.number().int().min(-40).max(40),
    labelPosition: z.enum(['above', 'below', 'both'])
  })
  .strict()

export const hexLocationPlacementSchema = axialCoordinateSchema
  .extend({
    locationId: z.uuid(),
    displayName: z.string().min(1).max(100),
    marker: hexMarkerPresentationSchema
  })
  .strict()

export const hexTileSchema = axialCoordinateSchema
  .extend({
    id: z.string().min(1),
    label: z.string().min(1),
    terrainId: hexTerrainIdSchema,
    location: hexLocationPlacementSchema.nullable()
  })
  .strict()

export const hexMapCatalogSnapshotSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    maps: z.array(hexMapSummarySchema)
  })
  .strict()

export const hexChunkKeySchema = z
  .object({
    q: z.number().int().safe(),
    r: z.number().int().safe()
  })
  .strict()

export const hexAuthoredTileSchema = axialCoordinateSchema
  .extend({ terrainId: hexTerrainIdSchema })
  .strict()

export const hexChunkSnapshotSchema = z
  .object({
    key: hexChunkKeySchema,
    revision: z.number().int().nonnegative(),
    authoredTiles: z.array(hexAuthoredTileSchema),
    locations: z.array(hexLocationPlacementSchema)
  })
  .strict()

export const hexChunkReadResultSchema = z
  .object({
    map: hexMapSummarySchema,
    chunks: z.array(hexChunkSnapshotSchema).max(64)
  })
  .strict()

export const hexEditorBootstrapSchema = z
  .object({
    catalog: hexMapCatalogSnapshotSchema,
    terrains: hexTerrainCatalogSchema,
    locations: worldLocationSnapshotSchema
  })
  .strict()

export const hexRuntimeOverlaySchema = z
  .object({
    sceneId: z.uuid(),
    label: z.string().min(1),
    token: axialCoordinateSchema.nullable(),
    route: z.array(axialCoordinateSchema),
    focused: z.boolean()
  })
  .strict()

export const hexRuntimeOverlayProjectionSchema = z
  .object({
    mapId: z.uuid(),
    overlays: z.array(hexRuntimeOverlaySchema)
  })
  .strict()

/** Renderer-local projection assembled from chunk snapshots. */
export const hexMapViewSchema = z
  .object({
    map: hexMapSummarySchema,
    center: axialCoordinateSchema,
    tiles: z.array(hexTileSchema)
  })
  .strict()

export const readHexChunksInputSchema = z
  .object({
    mapId: z.uuid(),
    keys: z.array(hexChunkKeySchema).min(1).max(64)
  })
  .strict()

export const createHexMapStoreInputSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    expectedCatalogRevision: z.number().int().nonnegative()
  })
  .strict()

export const createHexMapInputSchema = createHexMapStoreInputSchema
  .extend({ commandId: z.uuid() })
  .strict()

export const updateHexMapStoreInputSchema = z
  .object({
    mapId: z.uuid(),
    displayName: z.string().trim().min(1).max(100),
    expectedMetadataRevision: z.number().int().nonnegative()
  })
  .strict()

export const updateHexMapInputSchema = updateHexMapStoreInputSchema
  .extend({ commandId: z.uuid() })
  .strict()

export const hexTravelStatusSchema = z.enum([
  'unpositioned',
  'ready',
  'travelling',
  'paused',
  'blocked',
  'completed',
  'aborted'
])

export const hexBrushModeSchema = z.enum(['paint', 'erase'])

export const applyHexBrushStrokeInputSchema = z
  .object({
    commandId: z.uuid(),
    mapId: z.uuid(),
    mode: hexBrushModeSchema,
    terrainId: hexTerrainIdSchema.nullable(),
    path: z.array(axialCoordinateSchema).min(1).max(MAX_HEX_STROKE_POINTS),
    radius: z.number().int().min(0).max(MAX_HEX_BRUSH_RADIUS),
    expectedContentRevision: z.number().int().nonnegative(),
    confirmationToken: z.string().min(1).nullable()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.mode === 'paint' && value.terrainId === null)
      context.addIssue({
        code: 'custom',
        message: 'Paint strokes require terrain.',
        path: ['terrainId']
      })
    if (value.mode === 'erase' && value.terrainId !== null)
      context.addIssue({
        code: 'custom',
        message: 'Erase strokes cannot carry terrain.',
        path: ['terrainId']
      })
  })

export const hexEraseImpactSchema = z
  .object({
    locations: z.array(
      axialCoordinateSchema
        .extend({ locationId: z.uuid(), displayName: z.string().min(1) })
        .strict()
    ),
    journeys: z.array(
      z
        .object({
          sceneId: z.uuid(),
          status: hexTravelStatusSchema
        })
        .strict()
    ),
    partyMembers: z.array(
      axialCoordinateSchema
        .extend({ memberId: z.uuid(), displayName: z.string().min(1) })
        .strict()
    )
  })
  .strict()

export const hexChangedChunkSchema = z
  .object({
    mapId: z.uuid(),
    key: hexChunkKeySchema,
    revision: z.number().int().nonnegative()
  })
  .strict()

export const hexHistoryStateSchema = z
  .object({
    canUndo: z.boolean(),
    canRedo: z.boolean(),
    undoLabel: z.string().nullable(),
    redoLabel: z.string().nullable()
  })
  .strict()

export const hexMutationWarningSchema = z.discriminatedUnion('code', [
  z
    .object({
      code: z.literal('deleted_location_skipped'),
      locationId: z.uuid()
    })
    .strict()
])

export const hexBrushStrokeResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('confirmation_required'),
      commandId: z.uuid(),
      confirmationToken: z.string().min(1),
      impact: hexEraseImpactSchema
    })
    .strict(),
  z
    .object({
      status: z.literal('applied'),
      commandId: z.uuid(),
      catalogRevision: z.number().int().nonnegative(),
      maps: z.array(hexMapSummarySchema).min(1),
      changedChunks: z.array(hexChangedChunkSchema),
      history: hexHistoryStateSchema,
      changed: z.boolean(),
      affectedTileCount: z.number().int().nonnegative(),
      impact: hexEraseImpactSchema,
      warnings: z.array(hexMutationWarningSchema)
    })
    .strict(),
  z
    .object({
      status: z.literal('rejected'),
      commandId: z.uuid(),
      reason: z.enum([
        'stroke_too_large',
        'location_occupied',
        'location_not_placed',
        'tile_missing',
        'history_conflict',
        'history_empty'
      ])
    })
    .strict()
])

export const mutateHexHistoryInputSchema = z
  .object({
    commandId: z.uuid(),
    mapId: z.uuid(),
    expectedContentRevision: z.number().int().nonnegative(),
    confirmationToken: z.string().min(1).nullable()
  })
  .strict()

export const hexCommandIdInputSchema = z
  .object({ commandId: z.uuid() })
  .strict()

export const hexMapIdInputSchema = z.object({ mapId: z.uuid() }).strict()
export const hexEditorBootstrapInputSchema = z.object({}).strict()

export const hexChangeNoticeSchema = z
  .object({
    campaignId: z.uuid(),
    commandId: z.uuid(),
    mapIds: z.array(z.uuid()).min(1),
    changedChunks: z.array(hexChangedChunkSchema)
  })
  .strict()
  .readonly()

export const placeHexLocationInputSchema = z
  .object({
    mapId: z.uuid(),
    locationId: z.uuid(),
    coordinate: axialCoordinateSchema,
    expectedContentRevision: z.number().int().nonnegative()
  })
  .strict()

export const removeHexLocationInputSchema = z
  .object({
    mapId: z.uuid(),
    locationId: z.uuid(),
    expectedContentRevision: z.number().int().nonnegative()
  })
  .strict()

export const editHexLocationInputSchema = placeHexLocationInputSchema
  .extend({ commandId: z.uuid() })
  .strict()

export const unplaceHexLocationInputSchema = removeHexLocationInputSchema
  .extend({ commandId: z.uuid() })
  .strict()

export const hexLocationPlacementReferenceSchema = z
  .object({
    mapId: z.uuid(),
    coordinate: axialCoordinateSchema,
    contentRevision: z.number().int().nonnegative()
  })
  .strict()
  .nullable()

export const hexTravelSnapshotSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    sceneId: z.uuid(),
    status: hexTravelStatusSchema,
    mapId: z.uuid().nullable(),
    mapName: z.string(),
    current: axialCoordinateSchema.nullable(),
    currentLabel: z.string(),
    locationId: z.uuid().nullable(),
    locationName: z.string(),
    path: z.array(axialCoordinateSchema),
    currentIndex: z.number().int().nonnegative(),
    segmentStartedAt: z.number().int().nonnegative().nullable(),
    segmentEndsAt: z.number().int().nonnegative().nullable(),
    progress: z.number().min(0).max(1),
    remainingGameSeconds: z.number().int().nonnegative(),
    gameTimeSeconds: z.number().int().nonnegative(),
    effectiveSpeedFeet: z.number().int().nonnegative(),
    assumedSpeedMemberNames: z.array(z.string()),
    multiplier: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(5),
      z.literal(10)
    ]),
    hint: z.string()
  })
  .strict()

export const evaluateHexRouteInputSchema = z
  .object({
    sceneId: z.uuid(),
    mapId: z.uuid(),
    waypoints: z.array(axialCoordinateSchema).max(200)
  })
  .strict()

export const hexRouteEvaluationSchema = z
  .object({
    canStart: z.boolean(),
    message: z.string(),
    path: z.array(axialCoordinateSchema),
    totalGameSeconds: z.number().int().nonnegative(),
    effectiveSpeedFeet: z.number().int().nonnegative(),
    assumedSpeedMemberNames: z.array(z.string())
  })
  .strict()

export const positionHexPartyInputSchema = z
  .object({
    sceneId: z.uuid(),
    mapId: z.uuid(),
    coordinate: axialCoordinateSchema,
    expectedSceneRevision: z.number().int().nonnegative()
  })
  .strict()

export const startHexTravelInputSchema = z
  .object({
    sceneId: z.uuid(),
    mapId: z.uuid(),
    waypoints: z.array(axialCoordinateSchema).min(1).max(200),
    multiplier: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(5),
      z.literal(10)
    ]),
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()

export const mutateHexTravelInputSchema = z
  .object({
    sceneId: z.uuid(),
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()

export const setHexTravelMultiplierInputSchema = mutateHexTravelInputSchema
  .extend({
    multiplier: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(5),
      z.literal(10)
    ])
  })
  .strict()

export type AxialCoordinate = Readonly<z.infer<typeof axialCoordinateSchema>>
export type HexTerrainId = z.infer<typeof hexTerrainIdSchema>
export type HexTerrainDefinition = Readonly<
  z.infer<typeof hexTerrainDefinitionSchema>
>
export type HexTerrainCatalog = Readonly<
  z.infer<typeof hexTerrainCatalogSchema>
>
export type HexMapCatalogSnapshot = Readonly<
  z.infer<typeof hexMapCatalogSnapshotSchema>
>
export type HexMapSummary = Readonly<z.infer<typeof hexMapSummarySchema>>
export type HexMarkerPresentation = Readonly<
  z.infer<typeof hexMarkerPresentationSchema>
>
export type HexChunkKey = Readonly<z.infer<typeof hexChunkKeySchema>>
export type HexChunkSnapshot = Readonly<z.infer<typeof hexChunkSnapshotSchema>>
export type HexChunkReadResult = Readonly<
  z.infer<typeof hexChunkReadResultSchema>
>
export type HexMapView = Readonly<z.infer<typeof hexMapViewSchema>>
export type HexEditorBootstrap = Readonly<
  z.infer<typeof hexEditorBootstrapSchema>
>
export type HexRuntimeOverlayProjection = Readonly<
  z.infer<typeof hexRuntimeOverlayProjectionSchema>
>
export type HexBrushMode = z.infer<typeof hexBrushModeSchema>
export type ApplyHexBrushStrokeInput = Readonly<
  z.infer<typeof applyHexBrushStrokeInputSchema>
>
export type HexEraseImpact = Readonly<z.infer<typeof hexEraseImpactSchema>>
export type HexChangedChunk = Readonly<z.infer<typeof hexChangedChunkSchema>>
export type HexBrushStrokeResult = Readonly<
  z.infer<typeof hexBrushStrokeResultSchema>
>
export type HexHistoryState = Readonly<z.infer<typeof hexHistoryStateSchema>>
export type HexChangeNotice = Readonly<z.infer<typeof hexChangeNoticeSchema>>
export type HexLocationPlacementReference = Readonly<
  z.infer<typeof hexLocationPlacementReferenceSchema>
>
export type HexTravelSnapshot = Readonly<
  z.infer<typeof hexTravelSnapshotSchema>
>
export type HexRouteEvaluation = Readonly<
  z.infer<typeof hexRouteEvaluationSchema>
>
