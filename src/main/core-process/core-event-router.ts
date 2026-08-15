import type { CoreEvent } from '../../shared/contracts/core-protocol.js'

type CoreEventKind = CoreEvent['kind']
type CoreEventFor<K extends CoreEventKind> = Extract<CoreEvent, { kind: K }>
type CoreEventNotice<K extends CoreEventKind> = CoreEventFor<K>['notice']

export class CoreEventRouter {
  readonly #listeners = new Map<
    CoreEventKind,
    Set<(event: CoreEvent) => void>
  >()

  on<K extends CoreEventKind>(
    kind: K,
    listener: (notice: CoreEventNotice<K>) => void
  ): () => void {
    const listeners = this.#listeners.get(kind) ?? new Set()
    const wrapped = ((event: CoreEventFor<K>) =>
      listener(
        (event as unknown as { notice: CoreEventNotice<K> }).notice
      )) as unknown as (event: CoreEvent) => void
    listeners.add(wrapped)
    this.#listeners.set(kind, listeners)
    return () => listeners.delete(wrapped)
  }

  dispatch(event: CoreEvent): void {
    for (const listener of this.#listeners.get(event.kind) ?? [])
      listener(event)
  }
}
