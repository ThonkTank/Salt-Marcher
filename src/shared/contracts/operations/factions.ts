import {
  createWorldFactionInputSchema,
  deleteWorldFactionInputSchema,
  updateWorldFactionInputSchema,
  worldFactionCommandReceiptInputSchema,
  worldFactionCommandReceiptSchema,
  worldFactionDeleteReceiptSchema,
  worldFactionMutationReceiptSchema,
  worldFactionSnapshotSchema
} from '../encounter-source.js'
import { none, read, write } from './registry.js'

export const factionsOperationDefinitions = {
  'factions.read': read('factions:read', none, worldFactionSnapshotSchema),
  'factions.commandReceipt': read(
    'factions:command-receipt',
    worldFactionCommandReceiptInputSchema,
    worldFactionCommandReceiptSchema.nullable()
  ),
  'factions.create': write(
    'factions:create',
    createWorldFactionInputSchema,
    worldFactionMutationReceiptSchema
  ),
  'factions.update': write(
    'factions:update',
    updateWorldFactionInputSchema,
    worldFactionMutationReceiptSchema
  ),
  'factions.delete': write(
    'factions:delete',
    deleteWorldFactionInputSchema,
    worldFactionDeleteReceiptSchema
  )
} as const
