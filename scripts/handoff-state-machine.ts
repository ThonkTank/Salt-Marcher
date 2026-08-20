import {
  continueHandoffReceipt,
  handoffPhases,
  handoffReceiptSchema,
  hashHandoffValue,
  type HandoffPhaseEvidence,
  type HandoffPhaseName,
  type HandoffReceipt
} from './delivery-contract.js'

export interface HandoffPhaseDefinition {
  readonly phase: HandoffPhaseName
  readonly execute: () => void
  readonly collect: () => HandoffPhaseEvidence
}

export interface HandoffStateMachineOptions {
  readonly receipt: HandoffReceipt
  readonly definitions: readonly HandoffPhaseDefinition[]
  readonly persist: (receipt: HandoffReceipt) => void
  readonly now?: () => Date
  /** Test-only abrupt-termination seam after a durable phase boundary. */
  readonly afterPhasePersistedForTest?: (phase: HandoffPhaseName) => void
}

export class HandoffCrashForTest extends Error {
  override readonly name = 'HandoffCrashForTest'
}

export function runHandoffStateMachine(
  options: HandoffStateMachineOptions
): HandoffReceipt {
  const now = options.now ?? (() => new Date())
  assertDefinitions(options.definitions)
  let receipt = handoffReceiptSchema.parse(options.receipt)

  for (const definition of options.definitions) {
    const phase = definition.phase
    const index = handoffPhases.indexOf(phase)
    const inputHash =
      index === 0
        ? hashHandoffValue(receipt.identity)
        : receipt.phases[index - 1]?.outputHash
    if (inputHash === null || inputHash === undefined)
      throw new Error(`Handoff predecessor is not complete: ${phase}`)

    const record = receipt.phases[index]!
    if (phaseIsReusable(record, inputHash, definition)) {
      console.info(
        JSON.stringify({
          component: 'local-handoff',
          event: 'phase-reused',
          phase
        })
      )
      continue
    }

    receipt = resetFrom(receipt, phase, now().toISOString())
    const started = now()
    receipt = updatePhase(receipt, phase, {
      status: 'running',
      startedAt: started.toISOString(),
      durationMs: null,
      inputHash,
      outputHash: null,
      evidence: null,
      error: null
    })
    options.persist(receipt)
    console.info(
      JSON.stringify({
        component: 'local-handoff',
        event: 'phase-started',
        phase
      })
    )
    try {
      definition.execute()
      const evidence = definition.collect()
      const outputHash = hashHandoffValue({ phase, inputHash, evidence })
      receipt = updatePhase(receipt, phase, {
        status: 'completed',
        startedAt: started.toISOString(),
        durationMs: Math.max(0, now().getTime() - started.getTime()),
        inputHash,
        outputHash,
        evidence,
        error: null
      })
      options.persist(receipt)
    } catch (error) {
      if (error instanceof HandoffCrashForTest) throw error
      receipt = updatePhase(receipt, phase, {
        status: 'failed',
        startedAt: started.toISOString(),
        durationMs: Math.max(0, now().getTime() - started.getTime()),
        inputHash,
        outputHash: null,
        evidence: null,
        error: error instanceof Error ? error.message : String(error)
      })
      receipt = handoffReceiptSchema.parse({
        ...receipt,
        status: 'failed',
        updatedAt: now().toISOString(),
        completedAt: null
      })
      options.persist(receipt)
      throw error
    }
    options.afterPhasePersistedForTest?.(phase)
  }

  const completedAt = now().toISOString()
  receipt = handoffReceiptSchema.parse({
    ...receipt,
    status: 'complete',
    updatedAt: completedAt,
    completedAt
  })
  options.persist(receipt)
  return receipt
}

export function attachHandoffAttempt(
  receipt: HandoffReceipt,
  attemptId: string,
  timestamp: string
): HandoffReceipt {
  return continueHandoffReceipt(receipt, attemptId, timestamp)
}

function phaseIsReusable(
  record: HandoffReceipt['phases'][number],
  inputHash: string,
  definition: HandoffPhaseDefinition
): boolean {
  if (
    record.status !== 'completed' ||
    record.inputHash !== inputHash ||
    record.outputHash === null ||
    record.evidence === null
  )
    return false
  try {
    const evidence = definition.collect()
    return (
      JSON.stringify(evidence) === JSON.stringify(record.evidence) &&
      record.outputHash ===
        hashHandoffValue({ phase: record.phase, inputHash, evidence })
    )
  } catch {
    return false
  }
}

function resetFrom(
  receipt: HandoffReceipt,
  phase: HandoffPhaseName,
  timestamp: string
): HandoffReceipt {
  const index = handoffPhases.indexOf(phase)
  return handoffReceiptSchema.parse({
    ...receipt,
    status: 'running',
    updatedAt: timestamp,
    completedAt: null,
    phases: receipt.phases.map((record) =>
      handoffPhases.indexOf(record.phase) < index
        ? record
        : {
            phase: record.phase,
            status: 'pending',
            startedAt: null,
            durationMs: null,
            inputHash: null,
            outputHash: null,
            evidence: null,
            error: null
          }
    )
  })
}

function updatePhase(
  receipt: HandoffReceipt,
  phase: HandoffPhaseName,
  update: Omit<HandoffReceipt['phases'][number], 'phase'>
): HandoffReceipt {
  return handoffReceiptSchema.parse({
    ...receipt,
    phases: receipt.phases.map((record) =>
      record.phase === phase ? { phase, ...update } : record
    )
  })
}

function assertDefinitions(
  definitions: readonly HandoffPhaseDefinition[]
): void {
  const actual = definitions.map(({ phase }) => phase)
  if (JSON.stringify(actual) !== JSON.stringify(handoffPhases))
    throw new Error('Handoff phase definitions must be complete and ordered')
}
