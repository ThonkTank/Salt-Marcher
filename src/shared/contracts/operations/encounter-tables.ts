import {
  createEncounterTableInputSchema,
  deleteEncounterTableInputSchema,
  encounterTableCommandReceiptInputSchema,
  encounterTableCommandReceiptSchema,
  encounterTableDeleteReceiptSchema,
  encounterTableMutationReceiptSchema,
  encounterTableSnapshotSchema,
  updateEncounterTableInputSchema
} from '../encounter-source.js'
import { none, read, write } from './registry.js'

export const encounterTablesOperationDefinitions = {
  'encounterTables.read': read(
    'encounter-tables:read',
    none,
    encounterTableSnapshotSchema
  ),
  'encounterTables.commandReceipt': read(
    'encounter-tables:command-receipt',
    encounterTableCommandReceiptInputSchema,
    encounterTableCommandReceiptSchema.nullable()
  ),
  'encounterTables.create': write(
    'encounter-tables:create',
    createEncounterTableInputSchema,
    encounterTableMutationReceiptSchema
  ),
  'encounterTables.update': write(
    'encounter-tables:update',
    updateEncounterTableInputSchema,
    encounterTableMutationReceiptSchema
  ),
  'encounterTables.delete': write(
    'encounter-tables:delete',
    deleteEncounterTableInputSchema,
    encounterTableDeleteReceiptSchema
  )
} as const
