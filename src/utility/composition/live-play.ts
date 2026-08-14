import type { CoreHandlers } from '../../shared/contracts/core-protocol.js'
import type { LivePlayService } from '../../core/encounter/live-combat.js'

type PartyHandlerName =
  | 'party.read'
  | 'party.setMembership'
  | 'party.create'
  | 'party.update'
  | 'party.delete'
  | 'party.adjustXp'
  | 'party.rest'
  | 'party.calculateAdventuringDay'

type SessionHandlerName =
  | 'session.read'
  | 'scene.focus'
  | 'scene.setLocation'
  | 'scene.saveGroup'
  | 'scene.deleteGroup'
  | 'scene.setGroupArchived'
  | 'scene.assignPartyMember'
  | 'scene.evaluateGroupDraft'
  | 'scene.generateGroupDraft'

type EncounterHandlerName =
  | 'encounter.evaluate'
  | 'combat.prepare'
  | 'combat.joinGroup'
  | 'combat.rollInitiative'
  | 'combat.confirmInitiative'
  | 'combat.advanceTurn'
  | 'combat.retreatTurn'
  | 'combat.adjustInitiative'
  | 'combat.changeHp'
  | 'combat.toggleCondition'
  | 'combat.setConcentration'
  | 'combat.setExhaustion'
  | 'combat.undo'
  | 'combat.end'
  | 'combat.moveToPhase'
  | 'combat.updateResolution'
  | 'combat.awardXp'
  | 'combat.complete'

export function createPartyHandlers(
  play: LivePlayService
): Pick<CoreHandlers, PartyHandlerName> {
  return {
    'party.read': () => play.readParty(),
    'party.setMembership': (input) =>
      play.setMembership(input.id, input.active, input.expectedRevision),
    'party.create': (input) =>
      play.createPartyCharacter(input.character, input.expectedRevision),
    'party.update': (input) =>
      play.updatePartyCharacter(
        input.id,
        input.character,
        input.expectedRevision
      ),
    'party.delete': (input) =>
      play.deletePartyCharacter(input.id, input.expectedRevision),
    'party.adjustXp': (input) =>
      play.adjustPartyXp(input.id, input.delta, input.expectedRevision),
    'party.rest': (input) => play.restParty(input.type, input.expectedRevision),
    'party.calculateAdventuringDay': (input) =>
      play.calculateAdventuringDay(input.rows, input.totalXp)
  }
}

export function createSessionHandlers(
  play: LivePlayService
): Pick<CoreHandlers, SessionHandlerName> {
  return {
    'session.read': () => play.readSession(),
    'scene.focus': (input) =>
      play.focusScene(input.sceneId, input.expectedRevision),
    'scene.setLocation': (input) =>
      play.setSceneLocation(
        input.sceneId,
        input.locationId,
        input.expectedRevision
      ),
    'scene.saveGroup': (input) =>
      play.saveSceneGroup(
        input.sceneId,
        input.groupId,
        input.name,
        input.note,
        input.disposition,
        input.entries,
        input.expectedRevision,
        input.expectedGroupRevision
      ),
    'scene.deleteGroup': (input) =>
      play.deleteSceneGroup(
        input.sceneId,
        input.groupId,
        input.expectedGroupRevision
      ),
    'scene.setGroupArchived': (input) =>
      play.setSceneGroupArchived(
        input.sceneId,
        input.groupId,
        input.archived,
        input.expectedGroupRevision
      ),
    'scene.assignPartyMember': (input) =>
      play.assignScenePartyMember(
        input.sceneId,
        input.partyMemberId,
        input.assigned,
        input.expectedRevision
      ),
    'scene.evaluateGroupDraft': (input) =>
      play.evaluateGroupDraft(
        input.sceneId,
        input.entries,
        input.expectedRevision
      ),
    'scene.generateGroupDraft': (input) =>
      play.generateGroupDraft(
        input.sceneId,
        input.entries,
        input.mode,
        input.filters,
        input.tuning,
        input.seed,
        input.expectedRevision
      )
  }
}

export function createEncounterHandlers(
  play: LivePlayService
): Pick<CoreHandlers, EncounterHandlerName> {
  return {
    'encounter.evaluate': (input) =>
      play.evaluateEncounter(
        input.sceneId,
        input.groupIds,
        input.expectedRevision
      ),
    'combat.prepare': (input) =>
      play.prepareCombat(
        input.sceneId,
        input.expectedSceneRevision,
        input.groupIds
      ),
    'combat.joinGroup': (input) =>
      play.joinCombatGroup(
        input.sceneId,
        input.groupId,
        input.expectedGroupRevision,
        input.expectedCombatRevision
      ),
    'combat.rollInitiative': (input) =>
      play.rollInitiative(input.expectedRevision),
    'combat.confirmInitiative': (input) =>
      play.confirmInitiative(input.expectedRevision, input.values),
    'combat.advanceTurn': (input) => play.advanceTurn(input.expectedRevision),
    'combat.retreatTurn': (input) => play.retreatTurn(input.expectedRevision),
    'combat.adjustInitiative': (input) =>
      play.adjustInitiative(input.expectedRevision, input.id, input.initiative),
    'combat.changeHp': (input) =>
      play.changeHp(
        input.expectedRevision,
        input.cardId,
        input.amount,
        input.healing
      ),
    'combat.toggleCondition': (input) =>
      play.toggleCombatCondition(
        input.expectedRevision,
        input.cardId,
        input.condition,
        input.active
      ),
    'combat.setConcentration': (input) =>
      play.setCombatConcentration(
        input.expectedRevision,
        input.cardId,
        input.concentrating
      ),
    'combat.setExhaustion': (input) =>
      play.setCombatExhaustion(
        input.expectedRevision,
        input.cardId,
        input.exhaustionLevel
      ),
    'combat.undo': (input) => play.undoCombat(input.expectedRevision),
    'combat.end': (input) => play.endCombat(input.expectedRevision),
    'combat.moveToPhase': (input) =>
      play.moveCombatToPhase(input.expectedRevision, input.target),
    'combat.updateResolution': (input) =>
      play.updateResolution(
        input.expectedRevision,
        input.selectedEnemyIds,
        input.mode,
        input.xpFraction
      ),
    'combat.awardXp': (input) =>
      play.awardXp(input.expectedRevision, input.expectedCampaignRulesRevision),
    'combat.complete': (input) => play.completeCombat(input.expectedRevision)
  }
}
