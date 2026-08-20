import { liveSessionSnapshotSchema } from '../live-session.js'
import { none, read, utilityOperationFragment } from './registry.js'

export const sessionOperationDefinitions = utilityOperationFragment({
  'session.read': read('session:read', none, liveSessionSnapshotSchema)
})
