import {
  liveSessionSnapshotSchema,
  sceneGroupCommandResultSchema
} from '../live-session.js'
import {
  assignScenePartyInputSchema,
  deleteSceneGroupInputSchema,
  evaluateSceneGroupDraftInputSchema,
  focusSceneInputSchema,
  saveSceneGroupInputSchema,
  sceneGroupDraftEvaluationSchema,
  sceneGroupDraftGenerationRequestSchema,
  sceneGroupDraftGenerationSchema,
  setSceneGroupArchivedInputSchema,
  setSceneLocationInputSchema
} from '../scene.js'
import { read, utilityOperationFragment, write } from './registry.js'

export const sceneOperationDefinitions = utilityOperationFragment({
  'scene.focus': write(
    'scene:focus',
    focusSceneInputSchema,
    liveSessionSnapshotSchema
  ),
  'scene.setLocation': write(
    'scene:setLocation',
    setSceneLocationInputSchema,
    liveSessionSnapshotSchema
  ),
  'scene.saveGroup': write(
    'scene:saveGroup',
    saveSceneGroupInputSchema,
    sceneGroupCommandResultSchema
  ),
  'scene.deleteGroup': write(
    'scene:deleteGroup',
    deleteSceneGroupInputSchema,
    sceneGroupCommandResultSchema
  ),
  'scene.setGroupArchived': write(
    'scene:setGroupArchived',
    setSceneGroupArchivedInputSchema,
    sceneGroupCommandResultSchema
  ),
  'scene.assignPartyMember': write(
    'scene:assignPartyMember',
    assignScenePartyInputSchema,
    liveSessionSnapshotSchema
  ),
  'scene.evaluateGroupDraft': read(
    'scene:evaluateGroupDraft',
    evaluateSceneGroupDraftInputSchema,
    sceneGroupDraftEvaluationSchema
  ),
  'scene.generateGroupDraft': read(
    'scene:generateGroupDraft',
    sceneGroupDraftGenerationRequestSchema,
    sceneGroupDraftGenerationSchema
  )
})
