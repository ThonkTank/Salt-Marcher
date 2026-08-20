import {
  createWorldNpcInputSchema,
  deleteWorldNpcInputSchema,
  updateWorldNpcInputSchema,
  worldNpcCommandReceiptInputSchema,
  worldNpcCommandReceiptSchema,
  worldNpcDeleteReceiptSchema,
  worldNpcDetailInputSchema,
  worldNpcDetailProjectionSchema,
  worldNpcMutationReceiptSchema,
  worldNpcPageSchema,
  worldNpcSearchInputSchema
} from '../world-npc.js'
import { read, utilityOperationFragment, write } from './registry.js'

export const npcsOperationDefinitions = utilityOperationFragment({
  'npcs.search': read(
    'npcs:search',
    worldNpcSearchInputSchema,
    worldNpcPageSchema
  ),
  'npcs.detail': read(
    'npcs:detail',
    worldNpcDetailInputSchema,
    worldNpcDetailProjectionSchema
  ),
  'npcs.commandReceipt': read(
    'npcs:command-receipt',
    worldNpcCommandReceiptInputSchema,
    worldNpcCommandReceiptSchema.nullable()
  ),
  'npcs.create': write(
    'npcs:create',
    createWorldNpcInputSchema,
    worldNpcMutationReceiptSchema
  ),
  'npcs.update': write(
    'npcs:update',
    updateWorldNpcInputSchema,
    worldNpcMutationReceiptSchema
  ),
  'npcs.delete': write(
    'npcs:delete',
    deleteWorldNpcInputSchema,
    worldNpcDeleteReceiptSchema
  )
})
