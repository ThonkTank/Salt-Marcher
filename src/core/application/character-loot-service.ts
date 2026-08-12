import {
  characterLootLedgerSchema,
  correctCharacterLootInputSchema,
  type CharacterLootLedger,
  type CorrectCharacterLootInput
} from '../../shared/contracts/loot.js'
import type { PartySnapshot } from '../../shared/contracts/party.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { fingerprintExcluding } from '../fingerprint.js'

export type CharacterLootContext = Readonly<{
  party: Readonly<{ read(): PartySnapshot }>
  ledger: Readonly<{
    ledger(characterId: string): CharacterLootLedger
    correct(
      input: CorrectCharacterLootInput,
      receivedAt: string
    ): CharacterLootLedger
  }>
  journal: Readonly<{
    read(input: {
      commandId: string
      operationType: 'correct_ledger'
      requestFingerprint: string
      targetId: string
      schema: typeof characterLootLedgerSchema
    }): Readonly<{
      targetId: string
      result: CharacterLootLedger
    }> | null
    record(input: {
      commandId: string
      operationType: 'correct_ledger'
      requestFingerprint: string
      targetId: string
      schema: typeof characterLootLedgerSchema
      result: CharacterLootLedger
    }): void
  }>
  now(): string
}>

export class CharacterLootService {
  constructor(
    private readonly context: () => CharacterLootContext,
    private readonly transact: <T>(work: () => T) => T
  ) {}

  read(characterId: string): CharacterLootLedger {
    const context = this.context()
    this.requireCharacter(context, characterId)
    return characterLootLedgerSchema.parse(context.ledger.ledger(characterId))
  }

  correct(input: CorrectCharacterLootInput): CharacterLootLedger {
    const parsed = correctCharacterLootInputSchema.parse(input)
    return this.transact(() => {
      const context = this.context()
      const requestFingerprint = fingerprintExcluding(parsed, ['commandId'])
      const receipt = context.journal.read({
        commandId: parsed.commandId,
        operationType: 'correct_ledger',
        requestFingerprint,
        targetId: parsed.characterId,
        schema: characterLootLedgerSchema
      })
      if (receipt) return receipt.result
      this.requireCharacter(context, parsed.characterId)
      const result = context.ledger.correct(parsed, context.now())
      context.journal.record({
        commandId: parsed.commandId,
        operationType: 'correct_ledger',
        requestFingerprint,
        targetId: parsed.characterId,
        schema: characterLootLedgerSchema,
        result
      })
      return result
    })
  }

  private requireCharacter(
    context: CharacterLootContext,
    characterId: string
  ): void {
    if (
      !context.party.read().members.some((member) => member.id === characterId)
    )
      throw new CapabilityError('not_found', false)
  }
}
