import { z } from 'zod'
import {
  applyHexBrushStrokeInputSchema,
  createHexMapInputSchema,
  hexBiomeCatalogSchema,
  hexBrushStrokeResultSchema,
  hexChunkReadResultSchema,
  hexCommandIdInputSchema,
  hexEditorBootstrapSchema,
  hexHistoryStateSchema,
  hexLocationPlacementReferenceSchema,
  hexMapCatalogSnapshotSchema,
  hexMapIdInputSchema,
  hexRuntimeOverlayProjectionSchema,
  mutateHexHistoryInputSchema,
  readHexChunksInputSchema,
  replaceMapBiomePlaceholderInputSchema,
  replaceMapBiomePlaceholderResultSchema,
  updateHexMapInputSchema
} from '../hex.js'
import { none, read, utilityOperationFragment, write } from './registry.js'

const locationId = z.object({ locationId: z.uuid() }).strict()

export const hexOperationDefinitions = utilityOperationFragment({
  'hex.biomeCatalog': read('hex:biomeCatalog', none, hexBiomeCatalogSchema),
  'hex.editorBootstrap': read(
    'hex:editorBootstrap',
    none,
    hexEditorBootstrapSchema
  ),
  'hex.catalog': read('hex:catalog', none, hexMapCatalogSnapshotSchema),
  'hex.locateLocation': read(
    'hex:locateLocation',
    locationId,
    hexLocationPlacementReferenceSchema
  ),
  'hex.readChunks': read(
    'hex:readChunks',
    readHexChunksInputSchema,
    hexChunkReadResultSchema
  ),
  'hex.replaceBiomePlaceholder': write(
    'hex:replaceBiomePlaceholder',
    replaceMapBiomePlaceholderInputSchema,
    replaceMapBiomePlaceholderResultSchema
  ),
  'hex.create': write(
    'hex:create',
    createHexMapInputSchema,
    hexBrushStrokeResultSchema
  ),
  'hex.update': write(
    'hex:update',
    updateHexMapInputSchema,
    hexBrushStrokeResultSchema
  ),
  'hex.applyBrushStroke': write(
    'hex:applyBrushStroke',
    applyHexBrushStrokeInputSchema,
    hexBrushStrokeResultSchema
  ),
  'hex.history': read(
    'hex:history',
    hexMapIdInputSchema,
    hexHistoryStateSchema
  ),
  'hex.undo': write(
    'hex:undo',
    mutateHexHistoryInputSchema,
    hexBrushStrokeResultSchema
  ),
  'hex.redo': write(
    'hex:redo',
    mutateHexHistoryInputSchema,
    hexBrushStrokeResultSchema
  ),
  'hex.commandReceipt': read(
    'hex:commandReceipt',
    hexCommandIdInputSchema,
    hexBrushStrokeResultSchema.nullable()
  ),
  'hex.runtimeOverlays': read(
    'hex:runtimeOverlays',
    hexMapIdInputSchema,
    hexRuntimeOverlayProjectionSchema
  )
})
