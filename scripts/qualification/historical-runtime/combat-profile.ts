import type Database from 'better-sqlite3'
import { LivePlayService } from '@historical/live-play'
import { fixedSqliteDatabaseAccess } from '@historical/database-access'
import { WorldLocationStore } from '@historical/locations'

function play(database: Database.Database) {
  return new LivePlayService(fixedSqliteDatabaseAccess(database))
}

export function seedHistoricalCombat(database: Database.Database) {
  const service = play(database)
  let session = service.readSession()
  const sceneId = session.scene.focusedSceneId
  const memberId = session.party.members[0]!.id
  session = service.assignScenePartyMember(
    sceneId,
    memberId,
    true,
    session.scene.revision
  )
  service.saveSceneGroup(
    sceneId,
    null,
    'Wölfe an der Salzfurt',
    'Streift im Dünengras westlich der Furt.',
    'hostile',
    [{ creatureId: 'wolf', quantity: 2 }],
    session.scene.revision,
    null
  )
  session = service.readSession()
  const group = session.scene.scenes.find(({ id }) => id === sceneId)!
    .groups[0]!
  service.prepareCombat(sceneId, session.scene.revision, [group.id])
  session = service.readSession()
  if (!session.combat)
    throw new Error('Historical fixture did not prepare combat')
  service.confirmInitiative(
    session.combat.revision,
    session.combat.initiativeRows.map((row, position) => ({
      id: row.id,
      initiative: 20 - position
    }))
  )
  session = service.readSession()
  const monster = session.combat!.cards.find((card) => !card.playerCharacter)
  if (!monster) throw new Error('Historical fixture has no monster card')
  service.toggleCombatCondition(
    session.combat!.revision,
    monster.id,
    'poisoned',
    true
  )
  session = service.readSession()
  service.changeHp(session.combat!.revision, monster.id, 2, false)
  session = service.readSession()
  service.advanceTurn(session.combat!.revision)
}

export function readHistoricalCombat(database: Database.Database) {
  return {
    locations: new WorldLocationStore(database).read(),
    session: play(database).readSession()
  }
}

export function advanceHistoricalCombat(database: Database.Database) {
  const service = play(database)
  const combat = service.readSession().combat
  if (!combat || combat.phase !== 'combat')
    throw new Error('Historical fixture must contain running combat')
  service.advanceTurn(combat.revision)
}

export function finishHistoricalCombat(database: Database.Database) {
  const service = play(database)
  const combat = service.readSession().combat
  if (!combat || combat.phase !== 'combat')
    throw new Error('Expected running combat before journey continuation')
  service.endCombat(combat.revision)
  const resolution = service.readSession().combat
  if (!resolution || resolution.phase !== 'resolution')
    throw new Error('Expected combat resolution')
  service.completeCombat(resolution.revision)
}
