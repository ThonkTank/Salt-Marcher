import {
  campaignHexTravelCommandSchema,
  hexTravelCommandReceiptSchema,
  hexTravelCommandStatusSchema,
  hexTravelCommandStateSchema,
  hexRoutePlanSnapshotSchema
} from '../hex-travel-command.js'
import { z } from 'zod'
import {
  evaluateHexRouteInputSchema,
  hexRouteEvaluationSchema,
  mutateHexTravelInputSchema,
  positionHexPartyInputSchema,
  setHexTravelMultiplierInputSchema,
  startHexTravelInputSchema
} from '../hex.js'
import { hexTravelContextResultSchema } from '../live-session.js'
import { read, utilityOperationFragment, write } from './registry.js'

const sceneId = z.object({ sceneId: z.uuid() }).strict()

export const hexTravelOperationDefinitions = utilityOperationFragment({
  'hexTravel.executeCommand': write(
    'hex-travel:execute-command',
    campaignHexTravelCommandSchema,
    hexTravelCommandReceiptSchema
  ),
  'hexTravel.commandStatus': read(
    'hex-travel:command-status',
    campaignHexTravelCommandSchema,
    hexTravelCommandStatusSchema
  ),
  'hexTravel.readState': read(
    'hex-travel:read-state',
    sceneId.extend({ campaignId: z.uuid() }),
    hexTravelCommandStateSchema
  ),
  'hexTravel.readPlan': read(
    'hex-travel:read-plan',
    sceneId.extend({ campaignId: z.uuid() }),
    hexRoutePlanSnapshotSchema
  ),
  'hexTravel.read': read(
    'hex-travel:read',
    sceneId,
    hexTravelContextResultSchema
  ),
  'hexTravel.evaluate': read(
    'hex-travel:evaluate',
    evaluateHexRouteInputSchema,
    hexRouteEvaluationSchema
  ),
  'hexTravel.position': write(
    'hex-travel:position',
    positionHexPartyInputSchema,
    hexTravelContextResultSchema
  ),
  'hexTravel.start': write(
    'hex-travel:start',
    startHexTravelInputSchema,
    hexTravelContextResultSchema
  ),
  'hexTravel.pause': write(
    'hex-travel:pause',
    mutateHexTravelInputSchema,
    hexTravelContextResultSchema
  ),
  'hexTravel.resume': write(
    'hex-travel:resume',
    mutateHexTravelInputSchema,
    hexTravelContextResultSchema
  ),
  'hexTravel.abort': write(
    'hex-travel:abort',
    mutateHexTravelInputSchema,
    hexTravelContextResultSchema
  ),
  'hexTravel.setMultiplier': write(
    'hex-travel:setMultiplier',
    setHexTravelMultiplierInputSchema,
    hexTravelContextResultSchema
  )
})
