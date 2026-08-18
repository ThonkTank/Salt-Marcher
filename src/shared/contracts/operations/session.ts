import { liveSessionSnapshotSchema } from '../live-session.js'
import { none, read } from './registry.js'

export const sessionOperationDefinitions = {
  'session.read': read('session:read', none, liveSessionSnapshotSchema)
} as const
