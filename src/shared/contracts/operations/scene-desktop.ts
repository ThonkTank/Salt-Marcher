import {
  saveSceneDesktopInputSchema,
  sceneDesktopScopeSchema,
  sceneDesktopSnapshotSchema
} from '../scene-desktop.js'
import { read, utilityOperationFragment, write } from './registry.js'

export const sceneDesktopOperationDefinitions = utilityOperationFragment({
  'sceneDesktop.read': read(
    'sceneDesktop:read',
    sceneDesktopScopeSchema,
    sceneDesktopSnapshotSchema
  ),
  'sceneDesktop.save': write(
    'sceneDesktop:save',
    saveSceneDesktopInputSchema,
    sceneDesktopSnapshotSchema,
    ['gm'],
    null
  )
})
