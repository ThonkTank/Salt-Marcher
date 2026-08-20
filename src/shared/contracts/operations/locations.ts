import {
  deleteWorldLocationInputSchema,
  saveWorldLocationInputSchema,
  updateWorldLocationMapPresentationInputSchema,
  worldLocationDeleteReceiptSchema,
  worldLocationMapPresentationSchema,
  worldLocationPlacementCommandSchema,
  worldLocationPlacementCommitResultSchema,
  worldLocationSaveReceiptInputSchema,
  worldLocationSaveReceiptSchema,
  worldLocationSnapshotSchema,
  worldLocationTagSearchInputSchema,
  worldLocationTagSuggestionsSchema
} from '../world-location.js'
import { none, read, utilityOperationFragment, write } from './registry.js'

export const locationsOperationDefinitions = utilityOperationFragment({
  'locations.read': read('locations:read', none, worldLocationSnapshotSchema),
  'locations.suggestTags': read(
    'locations:suggest-tags',
    worldLocationTagSearchInputSchema,
    worldLocationTagSuggestionsSchema
  ),
  'locations.save': write(
    'locations:save',
    saveWorldLocationInputSchema,
    worldLocationSaveReceiptSchema
  ),
  'locations.saveReceipt': read(
    'locations:save-receipt',
    worldLocationSaveReceiptInputSchema,
    worldLocationSaveReceiptSchema.nullable()
  ),
  'locations.commitPlacement': write(
    'locations:commit-placement',
    worldLocationPlacementCommandSchema,
    worldLocationPlacementCommitResultSchema
  ),
  'locations.updateMapPresentation': write(
    'locations:update-map-presentation',
    updateWorldLocationMapPresentationInputSchema,
    worldLocationMapPresentationSchema
  ),
  'locations.delete': write(
    'locations:delete',
    deleteWorldLocationInputSchema,
    worldLocationDeleteReceiptSchema
  )
})
