import {
  adjustInitiativeInputSchema,
  awardCombatXpInputSchema,
  changeHpInputSchema,
  combatCommandResultSchema,
  combatRevisionInputSchema,
  confirmInitiativeInputSchema,
  joinCombatGroupInputSchema,
  moveCombatPhaseInputSchema,
  prepareCombatInputSchema,
  setConcentrationInputSchema,
  setExhaustionInputSchema,
  toggleConditionInputSchema,
  updateResolutionInputSchema
} from '../live-session.js'
import { write } from './registry.js'

export const combatOperationDefinitions = {
  'combat.prepare': write(
    'combat:prepare',
    prepareCombatInputSchema,
    combatCommandResultSchema
  ),
  'combat.joinGroup': write(
    'combat:joinGroup',
    joinCombatGroupInputSchema,
    combatCommandResultSchema
  ),
  'combat.rollInitiative': write(
    'combat:rollInitiative',
    combatRevisionInputSchema,
    combatCommandResultSchema
  ),
  'combat.confirmInitiative': write(
    'combat:confirmInitiative',
    confirmInitiativeInputSchema,
    combatCommandResultSchema
  ),
  'combat.advanceTurn': write(
    'combat:advanceTurn',
    combatRevisionInputSchema,
    combatCommandResultSchema
  ),
  'combat.retreatTurn': write(
    'combat:retreatTurn',
    combatRevisionInputSchema,
    combatCommandResultSchema
  ),
  'combat.adjustInitiative': write(
    'combat:adjustInitiative',
    adjustInitiativeInputSchema,
    combatCommandResultSchema
  ),
  'combat.changeHp': write(
    'combat:changeHp',
    changeHpInputSchema,
    combatCommandResultSchema
  ),
  'combat.toggleCondition': write(
    'combat:toggleCondition',
    toggleConditionInputSchema,
    combatCommandResultSchema
  ),
  'combat.setConcentration': write(
    'combat:setConcentration',
    setConcentrationInputSchema,
    combatCommandResultSchema
  ),
  'combat.setExhaustion': write(
    'combat:setExhaustion',
    setExhaustionInputSchema,
    combatCommandResultSchema
  ),
  'combat.undo': write(
    'combat:undo',
    combatRevisionInputSchema,
    combatCommandResultSchema
  ),
  'combat.end': write(
    'combat:end',
    combatRevisionInputSchema,
    combatCommandResultSchema
  ),
  'combat.moveToPhase': write(
    'combat:moveToPhase',
    moveCombatPhaseInputSchema,
    combatCommandResultSchema
  ),
  'combat.updateResolution': write(
    'combat:updateResolution',
    updateResolutionInputSchema,
    combatCommandResultSchema
  ),
  'combat.awardXp': write(
    'combat:awardXp',
    awardCombatXpInputSchema,
    combatCommandResultSchema
  ),
  'combat.complete': write(
    'combat:complete',
    combatRevisionInputSchema,
    combatCommandResultSchema
  )
} as const
