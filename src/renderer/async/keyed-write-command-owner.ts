import { capabilityErrorCode } from '../../shared/errors/capability-error.js'
import type {
  FifoCommandExecution,
  ReceiptReconciliationExecution,
  RendererAuthorityKey
} from './renderer-execution-contract.js'
import {
  AsyncCommandCoordinator,
  type AsyncCommandOutcome
} from './async-command-coordinator.js'

type AsyncOperation = (...arguments_: never[]) => Promise<unknown>

type ExecutableFifoCommand<
  Operation extends AsyncOperation,
  Scope extends string
> = FifoCommandExecution<Operation, Scope> &
  Readonly<{
    authority: RendererAuthorityKey<Scope>
    operation: Operation
  }>

type ExecutableReceiptReconciliation<
  Command extends AsyncOperation,
  ReceiptRead extends AsyncOperation,
  Scope extends string
> = ReceiptReconciliationExecution<Command, ReceiptRead, Scope> &
  Readonly<{
    authority: RendererAuthorityKey<Scope>
    command: Command
    receiptRead: ReceiptRead
  }>

export type KeyedWriteCommandOutcome<Value> =
  | Readonly<{
      status: 'success'
      value: Value
      source: 'transport' | 'receipt'
    }>
  | Readonly<{
      status: 'stale'
      reason: 'superseded' | 'aborted'
    }>
  | Readonly<{ status: 'failure'; cause: unknown }>
  | Readonly<{
      status: 'blocked'
      pendingCommandId: string
    }>
  | Readonly<{
      status: 'reconciliation-pending'
      commandId: string
      cause: unknown
      retry: () => Promise<KeyedWriteCommandOutcome<Value>>
    }>

type CommandSettlement<Value> =
  | Readonly<{
      status: 'accepted'
      value: Value
      source: 'transport' | 'receipt'
    }>
  | Readonly<{
      status: 'reconciliation-pending'
      commandId: string
      cause: unknown
    }>

type ReconciledCommandOptions<
  Command extends AsyncOperation,
  ReceiptRead extends AsyncOperation,
  Scope extends string
> = Readonly<{
  execution: ExecutableReceiptReconciliation<Command, ReceiptRead, Scope>
  executeAtTransport: (
    command: Command
  ) => Promise<Awaited<ReturnType<Command>>>
  readReceipt: (
    receiptRead: ReceiptRead,
    commandId: string
  ) => Promise<Awaited<ReturnType<ReceiptRead>>>
  recoverReceipt: (
    receipt: Awaited<ReturnType<ReceiptRead>>
  ) => Awaited<ReturnType<Command>> | null
  accept: (value: Awaited<ReturnType<Command>>) => unknown
}>

class PendingAuthorityError extends Error {
  public readonly pendingCommandId: string

  public constructor(pendingCommandId: string) {
    super('The write authority has a pending receipt reconciliation.')
    this.name = 'PendingAuthorityError'
    this.pendingCommandId = pendingCommandId
  }
}

/**
 * Owns transient FIFO and receipt-reconciliation state. Domain projections
 * remain in the injected application adapter and are accepted before the next
 * same-authority transport starts.
 */
export class KeyedWriteCommandOwner {
  readonly #coordinator: AsyncCommandCoordinator
  readonly #pending = new Map<string, string>()
  #disposed = false

  public constructor(coordinator: AsyncCommandCoordinator) {
    this.#coordinator = coordinator
  }

  public pendingCommandId(authority: RendererAuthorityKey): string | null {
    return this.#pending.get(authorityKey(authority)) ?? null
  }

  public async run<Operation extends AsyncOperation, Scope extends string>(
    execution: ExecutableFifoCommand<Operation, Scope>,
    executeAtTransport: (
      operation: Operation
    ) => Promise<Awaited<ReturnType<Operation>>>,
    accept: (value: Awaited<ReturnType<Operation>>) => unknown
  ): Promise<KeyedWriteCommandOutcome<Awaited<ReturnType<Operation>>>> {
    if (this.#disposed) return abortedOutcome
    const key = authorityKey(execution.authority)
    const coordinated = await this.#coordinator.run<
      CommandSettlement<Awaited<ReturnType<Operation>>>
    >({
      ...execution.authority,
      mode: 'queue',
      execute: async () => {
        const pendingCommandId = this.#pending.get(key)
        if (pendingCommandId) throw new PendingAuthorityError(pendingCommandId)
        return Object.freeze({
          status: 'accepted',
          value: await executeAtTransport(execution.operation),
          source: 'transport'
        })
      },
      accept: async (settlement) => {
        if (settlement.status === 'accepted') await accept(settlement.value)
      }
    })
    return projectOutcome(coordinated)
  }

  public async runReconciled<
    Command extends AsyncOperation,
    ReceiptRead extends AsyncOperation,
    Scope extends string
  >(
    options: ReconciledCommandOptions<Command, ReceiptRead, Scope>
  ): Promise<KeyedWriteCommandOutcome<Awaited<ReturnType<Command>>>> {
    if (this.#disposed) return abortedOutcome
    const key = authorityKey(options.execution.authority)
    const commandId = options.execution.commandId
    let unknownOutcomeCause: unknown = Object.freeze({
      code: 'outcome_unknown'
    })
    const retry = (): Promise<
      KeyedWriteCommandOutcome<Awaited<ReturnType<Command>>>
    > =>
      this.#retryReconciliation(
        options,
        key,
        commandId,
        unknownOutcomeCause,
        retry
      )
    const coordinated = await this.#coordinateReconciled(
      options,
      key,
      async () => {
        const pendingCommandId = this.#pending.get(key)
        if (pendingCommandId) throw new PendingAuthorityError(pendingCommandId)
        try {
          const value = await options.executeAtTransport(
            options.execution.command
          )
          return Object.freeze({
            status: 'accepted',
            value,
            source: 'transport'
          })
        } catch (cause) {
          if (capabilityErrorCode(cause) !== 'outcome_unknown') throw cause
          unknownOutcomeCause = cause
          return this.#readReceipt(options, cause)
        }
      }
    )
    return projectOutcome(coordinated, retry)
  }

  public dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.#pending.clear()
    this.#coordinator.cancelAll()
  }

  async #retryReconciliation<
    Command extends AsyncOperation,
    ReceiptRead extends AsyncOperation,
    Scope extends string
  >(
    options: ReconciledCommandOptions<Command, ReceiptRead, Scope>,
    key: string,
    commandId: string,
    originalCause: unknown,
    retry: () => Promise<KeyedWriteCommandOutcome<Awaited<ReturnType<Command>>>>
  ): Promise<KeyedWriteCommandOutcome<Awaited<ReturnType<Command>>>> {
    if (this.#disposed) return abortedOutcome
    const coordinated = await this.#coordinateReconciled(
      options,
      key,
      async () => {
        const pendingCommandId = this.#pending.get(key)
        if (pendingCommandId !== commandId)
          throw new PendingAuthorityError(pendingCommandId ?? commandId)
        try {
          return await this.#readReceipt(options, originalCause)
        } catch (cause) {
          if (this.#pending.get(key) === commandId) this.#pending.delete(key)
          throw cause
        }
      }
    )
    return projectOutcome(coordinated, retry)
  }

  async #coordinateReconciled<
    Command extends AsyncOperation,
    ReceiptRead extends AsyncOperation,
    Scope extends string
  >(
    options: ReconciledCommandOptions<Command, ReceiptRead, Scope>,
    key: string,
    execute: () => Promise<CommandSettlement<Awaited<ReturnType<Command>>>>
  ): Promise<
    AsyncCommandOutcome<CommandSettlement<Awaited<ReturnType<Command>>>>
  > {
    return this.#coordinator.run({
      ...options.execution.authority,
      mode: 'queue',
      execute,
      accept: async (settlement) => {
        switch (settlement.status) {
          case 'accepted':
            await options.accept(settlement.value)
            if (settlement.source === 'receipt') this.#pending.delete(key)
            return
          case 'reconciliation-pending':
            this.#pending.set(key, settlement.commandId)
            return
        }
      }
    })
  }

  async #readReceipt<
    Command extends AsyncOperation,
    ReceiptRead extends AsyncOperation,
    Scope extends string
  >(
    options: ReconciledCommandOptions<Command, ReceiptRead, Scope>,
    originalCause: unknown
  ): Promise<CommandSettlement<Awaited<ReturnType<Command>>>> {
    let receipt: Awaited<ReturnType<ReceiptRead>>
    try {
      receipt = await options.readReceipt(
        options.execution.receiptRead,
        options.execution.commandId
      )
    } catch (cause) {
      return Object.freeze({
        status: 'reconciliation-pending',
        commandId: options.execution.commandId,
        cause
      })
    }
    const recovered = options.recoverReceipt(receipt)
    if (recovered === null) throw originalCause
    return Object.freeze({
      status: 'accepted',
      value: recovered,
      source: 'receipt'
    })
  }
}

function projectOutcome<Value>(
  outcome: AsyncCommandOutcome<CommandSettlement<Value>>,
  retry?: () => Promise<KeyedWriteCommandOutcome<Value>>
): KeyedWriteCommandOutcome<Value> {
  if (outcome.status === 'stale')
    return Object.freeze({ status: 'stale', reason: outcome.reason })
  if (outcome.status === 'failure')
    return outcome.cause instanceof PendingAuthorityError
      ? Object.freeze({
          status: 'blocked',
          pendingCommandId: outcome.cause.pendingCommandId
        })
      : Object.freeze({ status: 'failure', cause: outcome.cause })
  switch (outcome.value.status) {
    case 'accepted':
      return Object.freeze({
        status: 'success',
        value: outcome.value.value,
        source: outcome.value.source
      })
    case 'reconciliation-pending':
      if (!retry)
        return Object.freeze({
          status: 'failure',
          cause: outcome.value.cause
        })
      return Object.freeze({
        status: 'reconciliation-pending',
        commandId: outcome.value.commandId,
        cause: outcome.value.cause,
        retry
      })
  }
}

function authorityKey(authority: RendererAuthorityKey): string {
  return JSON.stringify([authority.scope, authority.entityKey])
}

const abortedOutcome = Object.freeze({
  status: 'stale',
  reason: 'aborted'
}) satisfies KeyedWriteCommandOutcome<never>
