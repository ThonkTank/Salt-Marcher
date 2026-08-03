import { z } from 'zod'

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

export const hexLocationPlacementSchema = axialCoordinateSchema
  .extend({
    locationId: z.uuid(),
    displayName: z.string().min(1).max(100)
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

export const hexTerrainOverrideSchema = axialCoordinateSchema
  .extend({ terrainId: hexTerrainIdSchema })
  .strict()

export const hexChunkSnapshotSchema = z
  .object({
    key: hexChunkKeySchema,
    revision: z.number().int().nonnegative(),
    terrainOverrides: z.array(hexTerrainOverrideSchema),
    locations: z.array(hexLocationPlacementSchema)
  })
  .strict()

export const hexChunkReadResultSchema = z
  .object({
    map: hexMapSummarySchema,
    chunks: z.array(hexChunkSnapshotSchema).max(64)
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

export const createHexMapInputSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    expectedCatalogRevision: z.number().int().nonnegative()
  })
  .strict()

export const updateHexMapInputSchema = z
  .object({
    mapId: z.uuid(),
    displayName: z.string().trim().min(1).max(100),
    expectedMetadataRevision: z.number().int().nonnegative()
  })
  .strict()

export const paintHexTerrainInputSchema = z
  .object({
    mapId: z.uuid(),
    coordinate: axialCoordinateSchema,
    terrainId: hexTerrainIdSchema,
    expectedChunkRevision: z.number().int().nonnegative()
  })
  .strict()

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

export const hexLocationPlacementReferenceSchema = z
  .object({
    mapId: z.uuid(),
    coordinate: axialCoordinateSchema,
    contentRevision: z.number().int().nonnegative()
  })
  .strict()
  .nullable()

export const hexTravelStatusSchema = z.enum([
  'unpositioned',
  'ready',
  'travelling',
  'paused',
  'blocked',
  'completed',
  'aborted'
])

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
export type HexChunkKey = Readonly<z.infer<typeof hexChunkKeySchema>>
export type HexChunkSnapshot = Readonly<z.infer<typeof hexChunkSnapshotSchema>>
export type HexChunkReadResult = Readonly<
  z.infer<typeof hexChunkReadResultSchema>
>
export type HexMapView = Readonly<z.infer<typeof hexMapViewSchema>>
export type HexLocationPlacementReference = Readonly<
  z.infer<typeof hexLocationPlacementReferenceSchema>
>
export type HexTravelSnapshot = Readonly<
  z.infer<typeof hexTravelSnapshotSchema>
>
export type HexRouteEvaluation = Readonly<
  z.infer<typeof hexRouteEvaluationSchema>
>
