import type {
  ReadProjectionExecution,
  RendererAuthorityKey
} from './renderer-execution-contract.js'
import type { AsyncCommandOutcome } from './async-command-coordinator.js'
import { AsyncCommandCoordinator } from './async-command-coordinator.js'

type AsyncReadOperation<Value> = (...arguments_: never[]) => Promise<Value>

type ExecutableReadProjection<
  Operation extends AsyncReadOperation<Value>,
  Scope extends string,
  Value
> = ReadProjectionExecution<Operation, Scope> &
  Readonly<{
    authority: RendererAuthorityKey<Scope>
    operation: Operation
  }>

export type ReadProjectionSnapshot<Value> = Readonly<{
  status: 'idle' | 'pending' | 'ready' | 'failure'
  value: Value | null
  revision: number | null
  cause: unknown
}>

export type ReadProjectionOutcome<Value> =
  | Readonly<{ status: 'cached' | 'accepted'; value: Value }>
  | Readonly<{
      status: 'stale'
      reason: 'superseded' | 'aborted' | 'older-revision'
    }>
  | Readonly<{ status: 'failure'; cause: unknown }>

type ProjectionEntry<Value> = {
  snapshot: ReadProjectionSnapshot<Value>
  inFlight: Promise<ReadProjectionOutcome<Value>> | null
  listeners: Set<() => void>
}

const idleSnapshot = Object.freeze({
  status: 'idle',
  value: null,
  revision: null,
  cause: null
}) satisfies ReadProjectionSnapshot<never>

/**
 * Owns immutable renderer read projections while delegating request ordering,
 * cancellation and acceptance tokens to the shared async coordinator.
 */
export class KeyedReadProjectionOwner<Value> {
  readonly #entries = new Map<string, ProjectionEntry<Value>>()
  readonly #coordinator: AsyncCommandCoordinator
  readonly #revisionOf: (value: Value) => number
  #disposed = false

  public constructor(
    coordinator: AsyncCommandCoordinator,
    revisionOf: (value: Value) => number
  ) {
    this.#coordinator = coordinator
    this.#revisionOf = revisionOf
  }

  public subscribe(
    authority: RendererAuthorityKey,
    listener: () => void
  ): () => void {
    if (this.#disposed) return () => undefined
    const entry = this.#entry(authority)
    entry.listeners.add(listener)
    return () => entry.listeners.delete(listener)
  }

  public snapshot(
    authority: RendererAuthorityKey
  ): ReadProjectionSnapshot<Value> {
    if (this.#disposed) return idleSnapshot
    return this.#entry(authority).snapshot
  }

  public current(authority: RendererAuthorityKey): Value | null {
    if (this.#disposed) return null
    return this.#entry(authority).snapshot.value
  }

  public ensure<
    Operation extends AsyncReadOperation<Value>,
    Scope extends string
  >(
    execution: ExecutableReadProjection<Operation, Scope, Value>,
    ...arguments_: Parameters<Operation>
  ): Promise<ReadProjectionOutcome<Value>> {
    if (this.#disposed) return Promise.resolve(abortedOutcome)
    const entry = this.#entry(execution.authority)
    if (entry.snapshot.status === 'ready' && entry.snapshot.value !== null)
      return Promise.resolve(
        Object.freeze({ status: 'cached', value: entry.snapshot.value })
      )
    if (entry.inFlight) return entry.inFlight
    return this.#start(entry, execution, arguments_)
  }

  public invalidate<
    Operation extends AsyncReadOperation<Value>,
    Scope extends string
  >(
    execution: ExecutableReadProjection<Operation, Scope, Value>,
    ...arguments_: Parameters<Operation>
  ): Promise<ReadProjectionOutcome<Value>> {
    if (this.#disposed) return Promise.resolve(abortedOutcome)
    return this.#start(this.#entry(execution.authority), execution, arguments_)
  }

  public publish(authority: RendererAuthorityKey, value: Value): boolean {
    if (this.#disposed) return false
    const entry = this.#entry(authority)
    const revision = this.#revisionOf(value)
    if (entry.snapshot.revision !== null && revision < entry.snapshot.revision)
      return false
    this.#setSnapshot(
      entry,
      Object.freeze({
        status: 'ready',
        value,
        revision,
        cause: null
      })
    )
    return true
  }

  public dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.#coordinator.cancelAll()
    for (const entry of this.#entries.values()) {
      entry.inFlight = null
      entry.listeners.clear()
    }
    this.#entries.clear()
  }

  #start<Operation extends AsyncReadOperation<Value>, Scope extends string>(
    entry: ProjectionEntry<Value>,
    execution: ExecutableReadProjection<Operation, Scope, Value>,
    arguments_: Parameters<Operation>
  ): Promise<ReadProjectionOutcome<Value>> {
    this.#setSnapshot(
      entry,
      Object.freeze({
        status: 'pending',
        value: entry.snapshot.value,
        revision: entry.snapshot.revision,
        cause: null
      })
    )
    let accepted = false
    const coordinated = this.#coordinator.run({
      ...execution.authority,
      mode: 'latest-only',
      execute: () => execution.operation(...arguments_),
      accept: (value) => {
        accepted = this.publish(execution.authority, value)
      }
    })
    const outcome = coordinated.then((result) =>
      this.#projectOutcome(entry, result, accepted)
    )
    entry.inFlight = outcome
    void outcome.then(
      () => {
        if (entry.inFlight === outcome) entry.inFlight = null
      },
      () => {
        if (entry.inFlight === outcome) entry.inFlight = null
      }
    )
    return outcome
  }

  #projectOutcome(
    entry: ProjectionEntry<Value>,
    result: AsyncCommandOutcome<Value>,
    accepted: boolean
  ): ReadProjectionOutcome<Value> {
    if (result.status === 'success') {
      if (accepted)
        return Object.freeze({ status: 'accepted', value: result.value })
      if (entry.snapshot.value !== null && entry.snapshot.revision !== null)
        this.#setSnapshot(
          entry,
          Object.freeze({
            status: 'ready',
            value: entry.snapshot.value,
            revision: entry.snapshot.revision,
            cause: null
          })
        )
      return Object.freeze({ status: 'stale', reason: 'older-revision' })
    }
    if (result.status === 'stale')
      return Object.freeze({ status: 'stale', reason: result.reason })
    this.#setSnapshot(
      entry,
      Object.freeze({
        status: 'failure',
        value: entry.snapshot.value,
        revision: entry.snapshot.revision,
        cause: result.cause
      })
    )
    return Object.freeze({ status: 'failure', cause: result.cause })
  }

  #entry(authority: RendererAuthorityKey): ProjectionEntry<Value> {
    const key = authorityKey(authority)
    const existing = this.#entries.get(key)
    if (existing) return existing
    const entry: ProjectionEntry<Value> = {
      snapshot: idleSnapshot,
      inFlight: null,
      listeners: new Set()
    }
    this.#entries.set(key, entry)
    return entry
  }

  #setSnapshot(
    entry: ProjectionEntry<Value>,
    snapshot: ReadProjectionSnapshot<Value>
  ): void {
    entry.snapshot = snapshot
    for (const listener of entry.listeners) listener()
  }
}

function authorityKey(authority: RendererAuthorityKey): string {
  return JSON.stringify([authority.scope, authority.entityKey])
}

const abortedOutcome = Object.freeze({
  status: 'stale',
  reason: 'aborted'
}) satisfies ReadProjectionOutcome<never>
