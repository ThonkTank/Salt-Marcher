import { partySnapshotSchema } from '../live-session.js'
import {
  adjustPartyXpInputSchema,
  adventuringDayCalculationSchema,
  adventuringDayInputSchema,
  createPartyCharacterInputSchema,
  deletePartyCharacterInputSchema,
  restPartyInputSchema,
  setMembershipInputSchema,
  updatePartyCharacterInputSchema
} from '../party.js'
import { none, read, utilityOperationFragment, write } from './registry.js'

export const partyOperationDefinitions = utilityOperationFragment({
  'party.read': read('party:read', none, partySnapshotSchema),
  'party.setMembership': write(
    'party:setMembership',
    setMembershipInputSchema,
    partySnapshotSchema
  ),
  'party.create': write(
    'party:create',
    createPartyCharacterInputSchema,
    partySnapshotSchema
  ),
  'party.update': write(
    'party:update',
    updatePartyCharacterInputSchema,
    partySnapshotSchema
  ),
  'party.delete': write(
    'party:delete',
    deletePartyCharacterInputSchema,
    partySnapshotSchema
  ),
  'party.adjustXp': write(
    'party:adjustXp',
    adjustPartyXpInputSchema,
    partySnapshotSchema
  ),
  'party.rest': write('party:rest', restPartyInputSchema, partySnapshotSchema),
  'party.calculateAdventuringDay': read(
    'party:calculateAdventuringDay',
    adventuringDayInputSchema,
    adventuringDayCalculationSchema
  )
})
