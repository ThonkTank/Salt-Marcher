import { passiveProjectionSchema } from '../passive-display.js'
import { none, read, utilityOperationFragment } from './registry.js'

export const passiveProjectionOperationDefinitions = utilityOperationFragment({
  'projection.read': read('projection:read', none, passiveProjectionSchema, [
    'passive'
  ])
})
