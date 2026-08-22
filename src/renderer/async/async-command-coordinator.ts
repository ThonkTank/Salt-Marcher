export type AsyncCommandMode = 'latest-only' | 'queue'

export type AsyncCommandScope = Readonly<{
  scope: string
  entityKey?: string | null
}>

export type AsyncCommandRequestToken = Readonly<{
  scope: string
  entityKey: string | null
  requestId: number
}>

export type AsyncCommandState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'pending'; token: AsyncCommandRequestToken }>
  | Readonly<{ status: 'success'; token: AsyncCommandRequestToken }>
  | Readonly<{
      status: 'stale'
      token: AsyncCommandRequestToken
      reason: 'superseded' | 'aborted'
    }>
  | Readonly<{
      status: 'failure'
      token: AsyncCommandRequestToken
      cause: unknown
    }>

export type AsyncCommandOutcome<Value> =
  | Readonly<{
      status: 'success'
      token: AsyncCommandRequestToken
      value: Value
    }>
  | Readonly<{
      status: 'stale'
      token: AsyncCommandRequestToken
      reason: 'superseded' | 'aborted'
    }>
  | Readonly<{
      status: 'failure'
      token: AsyncCommandRequestToken
      cause: unknown
    }>

export type AsyncCommandExecution = Readonly<{
  token: AsyncCommandRequestToken
  signal: AbortSignal
}>

export type AsyncCommand<Value> = AsyncCommandScope &
  Readonly<{
    mode: AsyncCommandMode
    signal?: AbortSignal
    execute: (execution: AsyncCommandExecution) => Promise<Value>
    accept?: (value: Value, execution: AsyncCommandExecution) => unknown
  }>

type Slot = {
  sequence: number
  current: AsyncCommandRequestToken | null
  latestController: AbortController | null
  activeControllers: Set<AbortController>
  queue: Promise<void>
}

const idleState: AsyncCommandState = Object.freeze({ status: 'idle' })

/**
 * Owns renderer-local async ordering without retaining domain state. Instances
 * belong to a hook/controller; this module intentionally exports no singleton.
 */
export class AsyncCommandCoordinator {
  readonly #slots = new Map<string, Slot>()
  readonly #states = new Map<string, AsyncCommandState>()
  readonly #listeners = new Set<() => void>()
  #revision = 0
  #lifecycle = 0

  public readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  public readonly snapshot = (): number => this.#revision

  public state(target: AsyncCommandScope): AsyncCommandState {
    return this.#states.get(scopeKey(target)) ?? idleState
  }

  public run<Value>(
    command: AsyncCommand<Value>
  ): Promise<AsyncCommandOutcome<Value>> {
    const key = scopeKey(command)
    const slot = this.#slot(key)
    const token = Object.freeze({
      scope: command.scope,
      entityKey: command.entityKey ?? null,
      requestId: ++slot.sequence
    })
    const lifecycle = this.#lifecycle

    if (command.mode === 'latest-only') {
      slot.latestController?.abort('superseded')
      slot.current = token
      return this.#execute(key, slot, token, lifecycle, command, true)
    }

    const outcome = slot.queue.then(() => {
      if (lifecycle !== this.#lifecycle)
        return staleOutcome<Value>(token, 'aborted')
      if (command.signal?.aborted) return staleOutcome<Value>(token, 'aborted')
      slot.current = token
      return this.#execute(key, slot, token, lifecycle, command, false)
    })
    slot.queue = outcome.then(
      () => undefined,
      () => undefined
    )
    return outcome
  }

  public cancelAll(): void {
    this.#lifecycle += 1
    for (const [key, slot] of this.#slots) this.#cancelSlot(key, slot)
  }

  async #execute<Value>(
    key: string,
    slot: Slot,
    token: AsyncCommandRequestToken,
    lifecycle: number,
    command: AsyncCommand<Value>,
    latestOnly: boolean
  ): Promise<AsyncCommandOutcome<Value>> {
    const controller = new AbortController()
    const execution = Object.freeze({ token, signal: controller.signal })
    if (latestOnly) slot.latestController = controller
    slot.activeControllers.add(controller)
    const abort = () => controller.abort(command.signal?.reason)
    if (command.signal?.aborted) abort()
    else command.signal?.addEventListener('abort', abort, { once: true })

    if (this.#isCurrent(slot, token, lifecycle))
      this.#setState(key, Object.freeze({ status: 'pending', token }))

    try {
      const value = await command.execute(execution)
      if (!this.#isCurrent(slot, token, lifecycle) || controller.signal.aborted)
        return this.#stale(key, slot, token, lifecycle, controller)
      await command.accept?.(value, execution)
      if (!this.#isCurrent(slot, token, lifecycle) || controller.signal.aborted)
        return this.#stale(key, slot, token, lifecycle, controller)
      const outcome: AsyncCommandOutcome<Value> = Object.freeze({
        status: 'success',
        token,
        value
      })
      this.#setState(
        key,
        Object.freeze({ status: 'success', token }) satisfies AsyncCommandState
      )
      return outcome
    } catch (cause) {
      if (!this.#isCurrent(slot, token, lifecycle) || controller.signal.aborted)
        return this.#stale(key, slot, token, lifecycle, controller)
      const outcome: AsyncCommandOutcome<Value> = Object.freeze({
        status: 'failure',
        token,
        cause
      })
      this.#setState(
        key,
        Object.freeze({
          status: 'failure',
          token,
          cause
        }) satisfies AsyncCommandState
      )
      return outcome
    } finally {
      command.signal?.removeEventListener('abort', abort)
      slot.activeControllers.delete(controller)
      if (slot.latestController === controller) slot.latestController = null
    }
  }

  #stale<Value>(
    key: string,
    slot: Slot,
    token: AsyncCommandRequestToken,
    lifecycle: number,
    controller: AbortController
  ): AsyncCommandOutcome<Value> {
    const reason = controller.signal.aborted ? 'aborted' : 'superseded'
    const outcome = staleOutcome<Value>(token, reason)
    if (this.#isCurrent(slot, token, lifecycle))
      this.#setState(key, Object.freeze({ status: 'stale', token, reason }))
    return outcome
  }

  #isCurrent(
    slot: Slot,
    token: AsyncCommandRequestToken,
    lifecycle: number
  ): boolean {
    return lifecycle === this.#lifecycle && slot.current === token
  }

  #cancelSlot(key: string, slot: Slot): void {
    for (const controller of slot.activeControllers) controller.abort('aborted')
    const state = this.#states.get(key)
    if (state?.status === 'pending')
      this.#setState(
        key,
        Object.freeze({
          status: 'stale',
          token: state.token,
          reason: 'aborted'
        })
      )
    slot.current = null
    slot.latestController = null
  }

  #slot(key: string): Slot {
    const existing = this.#slots.get(key)
    if (existing) return existing
    const slot: Slot = {
      sequence: 0,
      current: null,
      latestController: null,
      activeControllers: new Set(),
      queue: Promise.resolve()
    }
    this.#slots.set(key, slot)
    return slot
  }

  #setState(key: string, state: AsyncCommandState): void {
    this.#states.set(key, state)
    this.#revision += 1
    for (const listener of this.#listeners) listener()
  }
}

function scopeKey(target: AsyncCommandScope): string {
  return JSON.stringify([target.scope, target.entityKey ?? null])
}

function staleOutcome<Value>(
  token: AsyncCommandRequestToken,
  reason: 'superseded' | 'aborted'
): AsyncCommandOutcome<Value> {
  return Object.freeze({ status: 'stale', token, reason })
}
