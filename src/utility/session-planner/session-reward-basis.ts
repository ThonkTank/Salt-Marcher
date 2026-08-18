import type Database from 'better-sqlite3'
import { CharacterLootStore } from '../../core/loot/character-loot-store.js'
import { ItemDefinitionResolver } from '../../core/loot/item-definition-resolver.js'
import { PartyStore } from '../../core/party/party-store.js'
import type { PartyLevelProgression } from '../../core/party/party-roster-domain.js'
import { SessionPlannerStore } from '../../core/session-planner/session-planner-store.js'
import { projectRewardMembers } from '../../core/session-generation/reward-budget-stage.js'
import {
  assembleRewardParty,
  type RewardPartySnapshot
} from '../../core/session-generation/reward-party.js'
import type { PersistedSessionGeneratedRun } from '../../shared/contracts/session-generation.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'

/** Resolves and revalidates the raw participant/ledger basis for preparation. */
export class SessionRewardBasis {
  constructor(
    private readonly db: Database.Database,
    private readonly definitionResolver: (
      db: Database.Database
    ) => ItemDefinitionResolver,
    private readonly progression?: PartyLevelProgression
  ) {}

  snapshot(sessionId: string): RewardPartySnapshot {
    const session = new SessionPlannerStore(this.db).require(sessionId)
    const party = new PartyStore(this.db, this.progression).read()
    const members = session.participantIds.map((id) => {
      const member = party.members.find((entry) => entry.id === id)
      if (!member) throw new CapabilityError('stale', true)
      return member
    })
    const balances = new Map(
      new CharacterLootStore(this.db, this.definitionResolver(this.db))
        .rewardBalances(members.map((member) => member.id))
        .map((balance) => [balance.characterId, balance])
    )
    return assembleRewardParty(
      members.map((member) => {
        const balance = balances.get(member.id)
        if (!balance) throw new Error('missing_character_reward_balance')
        return {
          characterId: member.id,
          level: member.level,
          currentXp: member.xp,
          ledgerRevision: balance.ledgerRevision,
          currentNonMagicCp: balance.currentNonMagicCp,
          currentMagic: balance.currentMagic
        }
      })
    )
  }

  isCurrent(run: PersistedSessionGeneratedRun, sessionId: string): boolean {
    if (!run.rewardBasis) return true
    let current: RewardPartySnapshot
    try {
      current = this.snapshot(sessionId)
    } catch {
      return false
    }
    if (
      current.ledgerParty.length !== run.rewardBasis.members.length ||
      JSON.stringify(current.party) !== JSON.stringify(run.input.party)
    )
      return false
    const expectedMembers = projectRewardMembers(
      current.ledgerParty,
      run.session.sessionXpTarget
    )
    return run.rewardBasis.members.every((basis) => {
      const expected = expectedMembers.find(
        (candidate) => candidate.characterId === basis.characterId
      )
      return JSON.stringify(expected) === JSON.stringify(basis)
    })
  }
}
