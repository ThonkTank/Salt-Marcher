import {
  campaignScenePartyCommandSchema,
  scenePartyCommandReceiptSchema,
  scenePartyCommandStatusSchema
} from '../scene-party-command.js'
import { z } from 'zod'
import {
  liveSessionSnapshotSchema,
  sceneGroupCommandResultSchema
} from '../live-session.js'
import {
  assignScenePartyInputSchema,
  setSceneRosterInputSchema,
  moveSceneRosterInputSchema,
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
  'scene.executePartyCommand': write(
    'scene:execute-party-command',
    campaignScenePartyCommandSchema,
    scenePartyCommandReceiptSchema
  ),
  'scene.partyCommandStatus': read(
    'scene:party-command-status',
    campaignScenePartyCommandSchema,
    scenePartyCommandStatusSchema
  ),
  'scene.setRoster': write(
    'scene:setRoster',
    setSceneRosterInputSchema,
    liveSessionSnapshotSchema
  ),
  'scene.moveRoster': write(
    'scene:moveRoster',
    moveSceneRosterInputSchema,
    liveSessionSnapshotSchema
  ),
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
  'scene.groupSaveReceipt': read(
    'scene:group-save-receipt',
    saveSceneGroupInputSchema.extend({ campaignId: z.uuid() }),
    sceneGroupCommandResultSchema.nullable()
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
