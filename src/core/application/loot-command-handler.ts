import {
  acceptGeneratedTreasureInputSchema,
  createTreasureInputSchema,
  moveTreasureInputSchema,
  treasureSchema,
  updateTreasureInputSchema,
  type AcceptGeneratedTreasureInput,
  type CreateTreasureInput,
  type MoveTreasureInput,
  type ParsedCreateTreasureInput,
  type ParsedUpdateTreasureInput,
  type Treasure,
  type TreasureAnchor,
  type UpdateTreasureInput
} from '../../shared/contracts/loot.js'
import type {
  GeneratedRun,
  GeneratedTreasure
} from '../../shared/contracts/session-generation.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { fingerprintExcluding } from '../fingerprint.js'
import type { LootOperationType } from '../loot/loot-operation-journal.js'

type TreasureCommandType = Extract<
  LootOperationType,
  'create' | 'update' | 'move' | 'accept_generated'
>

export type LootCommandContext = Readonly<{
  treasures: Readonly<{
    require(id: string): Treasure
    findByGenerated(runId: string, generatedTreasureId: string): Treasure | null
    createManual(input: ParsedCreateTreasureInput, now: string): Treasure
    update(input: ParsedUpdateTreasureInput, now: string): Treasure
    move(input: MoveTreasureInput, now: string): Treasure
    acceptGenerated(
      run: GeneratedRun,
      generated: GeneratedTreasure,
      label: string,
      anchor: TreasureAnchor,
      now: string
    ): Treasure
  }>
  generatedRuns: Readonly<{ read(runId: string): GeneratedRun | null }>
  journal: Readonly<{
    read(input: {
      commandId: string
      operationType: TreasureCommandType
      requestFingerprint: string
      targetId?: string
      schema: typeof treasureSchema
    }): Readonly<{ targetId: string; result: Treasure }> | null
    record(input: {
      commandId: string
      operationType: TreasureCommandType
      requestFingerprint: string
      targetId: string
      schema: typeof treasureSchema
      result: Treasure
    }): void
  }>
  projections: Readonly<{ bumpRevision(): void }>
  normalizeAnchor(anchor: TreasureAnchor): TreasureAnchor
  now(): string
}>

export class LootCommandHandler {
  constructor(
    private readonly context: () => LootCommandContext,
    private readonly transact: <T>(work: () => T) => T
  ) {}

  read(treasureId: string): Treasure {
    return this.context().treasures.require(treasureId)
  }

  create(input: CreateTreasureInput): Treasure {
    const parsed = createTreasureInputSchema.parse(input)
    return this.transact(() => {
      const context = this.context()
      const requestFingerprint = commandFingerprint(parsed)
      const receipt = readReceipt(
        context,
        parsed.commandId,
        'create',
        requestFingerprint
      )
      if (receipt) return receipt
      const result = context.treasures.createManual(
        {
          ...parsed,
          anchor: context.normalizeAnchor(parsed.anchor)
        },
        context.now()
      )
      context.projections.bumpRevision()
      recordReceipt(
        context,
        parsed.commandId,
        'create',
        requestFingerprint,
        result
      )
      return result
    })
  }

  update(input: UpdateTreasureInput): Treasure {
    const parsed = updateTreasureInputSchema.parse(input)
    return this.transact(() => {
      const context = this.context()
      const requestFingerprint = commandFingerprint(parsed)
      const receipt = readReceipt(
        context,
        parsed.commandId,
        'update',
        requestFingerprint,
        parsed.treasureId
      )
      if (receipt) return receipt
      const result = context.treasures.update(
        {
          ...parsed,
          anchor: context.normalizeAnchor(parsed.anchor)
        },
        context.now()
      )
      context.projections.bumpRevision()
      recordReceipt(
        context,
        parsed.commandId,
        'update',
        requestFingerprint,
        result
      )
      return result
    })
  }

  move(input: MoveTreasureInput): Treasure {
    const parsed = moveTreasureInputSchema.parse(input)
    return this.transact(() => {
      const context = this.context()
      const requestFingerprint = commandFingerprint(parsed)
      const receipt = readReceipt(
        context,
        parsed.commandId,
        'move',
        requestFingerprint,
        parsed.treasureId
      )
      if (receipt) return receipt
      const result = context.treasures.move(
        { ...parsed, anchor: context.normalizeAnchor(parsed.anchor) },
        context.now()
      )
      context.projections.bumpRevision()
      recordReceipt(
        context,
        parsed.commandId,
        'move',
        requestFingerprint,
        result
      )
      return result
    })
  }

  acceptGenerated(input: AcceptGeneratedTreasureInput): Treasure {
    const parsed = acceptGeneratedTreasureInputSchema.parse(input)
    return this.transact(() => {
      const context = this.context()
      const requestFingerprint = commandFingerprint(parsed)
      const receipt = readReceipt(
        context,
        parsed.commandId,
        'accept_generated',
        requestFingerprint
      )
      if (receipt) return receipt
      const run = context.generatedRuns.read(parsed.runId)
      if (!run) throw new CapabilityError('not_found', false)
      const generated = run.treasures.find(
        (treasure) => treasure.id === parsed.generatedTreasureId
      )
      if (!generated) throw new CapabilityError('not_found', false)
      const existed = context.treasures.findByGenerated(run.id, generated.id)
      const result = context.treasures.acceptGenerated(
        run,
        generated,
        parsed.label,
        context.normalizeAnchor(parsed.anchor),
        context.now()
      )
      if (!existed) context.projections.bumpRevision()
      recordReceipt(
        context,
        parsed.commandId,
        'accept_generated',
        requestFingerprint,
        result
      )
      return result
    })
  }
}

function commandFingerprint(input: { readonly commandId: string }): string {
  return fingerprintExcluding(input, ['commandId'])
}

function readReceipt(
  context: LootCommandContext,
  commandId: string,
  operationType: TreasureCommandType,
  requestFingerprint: string,
  targetId?: string
): Treasure | null {
  return (
    context.journal.read({
      commandId,
      operationType,
      requestFingerprint,
      ...(targetId === undefined ? {} : { targetId }),
      schema: treasureSchema
    })?.result ?? null
  )
}

function recordReceipt(
  context: LootCommandContext,
  commandId: string,
  operationType: TreasureCommandType,
  requestFingerprint: string,
  result: Treasure
): void {
  context.journal.record({
    commandId,
    operationType,
    requestFingerprint,
    targetId: result.id,
    schema: treasureSchema,
    result
  })
}
