import { passiveProjectionSchema } from '../passive-display.js'
import { none, read } from './registry.js'

export const passiveProjectionOperationDefinitions = {
  'projection.read': read('projection:read', none, passiveProjectionSchema, [
    'passive'
  ])
} as const
