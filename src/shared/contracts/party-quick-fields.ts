import { z } from 'zod'
export const partyQuickFieldSchema = z.enum([
  'characterClass',
  'level',
  'species',
  'playerName',
  'armorClass',
  'movementSpeedFeet',
  'passivePerception',
  'passiveInsight',
  'passiveInvestigation',
  'languages'
])
export type PartyQuickField = z.infer<typeof partyQuickFieldSchema>
