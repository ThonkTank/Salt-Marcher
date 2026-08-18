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
import { read, write } from './registry.js'

const sceneId = z.object({ sceneId: z.uuid() }).strict()

export const hexTravelOperationDefinitions = {
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
} as const
