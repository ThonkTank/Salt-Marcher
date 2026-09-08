import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'

/** Tracks whole user actions, including continuations between IPC requests. */
export class PlannerMaintenanceRuntime {
  readonly #operations = new Set<Promise<unknown>>()
  readonly #listeners = new Set<() => void>()
  #uncertain = false
  #revision = 0
  readonly subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
  readonly snapshot = () => this.#revision
  readonly pending = () => this.#operations.size > 0
  readonly uncertain = () => this.#uncertain
  readonly failed = (cause: unknown): void => {
    if (capabilityErrorCode(cause) !== 'outcome_unknown') return
    this.#uncertain = true
    this.#publish()
  }
  run<T>(operation: () => Promise<T>): Promise<T> {
    const result = Promise.resolve().then(operation)
    this.#operations.add(result)
    this.#publish()
    return result.finally(() => {
      this.#operations.delete(result)
      this.#publish()
    })
  }
  async drain(): Promise<void> {
    while (this.#operations.size)
      await Promise.allSettled([...this.#operations])
    if (this.#uncertain)
      throw new Error(
        'Der Ausgang eines Planungsauftrags ist unbekannt. Bitte die Wartung abbrechen und den gespeicherten Sitzungsstand prüfen.'
      )
  }
  #publish(): void {
    this.#revision += 1
    for (const listener of this.#listeners) listener()
  }
}
