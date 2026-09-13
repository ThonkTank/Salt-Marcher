import type Database from 'better-sqlite3'
import { performance } from 'node:perf_hooks'
import { PartyHistoryOwner } from '../../src/core/party/party-history-owner.js'
import { ScenePartyHistoryOwner } from '../../src/core/scene/scene-party-history-owner.js'
import { PartyCombatHistoryOwner } from '../../src/core/encounter/party-combat-history-owner.js'
import { PartyTravelHistoryOwner } from '../../src/core/hex/party-travel-history-owner.js'
import { PartyLootHistoryOwner } from '../../src/core/loot/party-loot-history-owner.js'
import { PartyHistoryStore } from '../../src/core/party/party-history-store.js'
import { PartyHistoryIndex } from '../../src/core/party/party-history-index.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'

type Callable = (this: unknown, ...args: unknown[]) => unknown
export type Phase = { ms: number; reads: number; writes: number; rows: number }
export type Measurement = { totalMs: number; phases: Record<string, Phase> }

/** Process-local instrumentation. Never modifies application files or installed data. */
export class HistoryProfiler {
  readonly sqlShapes = new Set<string>()
  private current: Record<string, Phase> | null = null
  private phase = 'other'
  private tick = 0
  private readonly restore: (() => void)[] = []

  private bucket() {
    return (this.current![this.phase] ??= {
      ms: 0,
      reads: 0,
      writes: 0,
      rows: 0
    })
  }
  private flush() {
    const now = performance.now()
    this.bucket().ms += now - this.tick
    this.tick = now
  }
  within<T>(phase: string, work: () => T): T {
    if (!this.current) return work()
    this.flush()
    const previous = this.phase
    this.phase = phase
    try {
      return work()
    } finally {
      this.flush()
      this.phase = previous
    }
  }
  measure(work: () => unknown): Measurement {
    this.current = {}
    this.phase = 'other'
    this.tick = performance.now()
    const start = this.tick
    try {
      work()
      this.flush()
      return { totalMs: performance.now() - start, phases: this.current }
    } finally {
      this.current = null
    }
  }
  private patch(
    target: object,
    name: string,
    wrap: (original: Callable) => Callable
  ) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name)
    const original = Reflect.get(target, name) as Callable
    if (typeof original !== 'function')
      throw new Error(`Missing measured method ${name}`)
    Object.defineProperty(target, name, {
      configurable: true,
      writable: true,
      value: wrap(original)
    })
    this.restore.push(() => {
      if (descriptor) Object.defineProperty(target, name, descriptor)
      else Reflect.deleteProperty(target, name)
    })
  }
  installOwners() {
    const within = this.within.bind(this)
    for (const [owner, label] of [
      [PartyHistoryOwner.prototype, 'party'],
      [ScenePartyHistoryOwner.prototype, 'scene'],
      [PartyCombatHistoryOwner.prototype, 'combat'],
      [PartyTravelHistoryOwner.prototype, 'travel']
    ] as const) {
      for (const [method, phase] of [
        ['capture', 'capture'],
        ['changes', 'compare']
      ] as const)
        this.patch(
          owner,
          method,
          (original) =>
            function (...args) {
              return within(`${phase}.${label}`, () =>
                Reflect.apply(original, this, args)
              )
            }
        )
    }
    const methods: [object, string, string][] = [
      [PartyLootHistoryOwner.prototype, 'changes', 'compare.loot'],
      ...['append', 'record', 'complete'].map(
        (name): [object, string, string] => [
          PartyHistoryStore.prototype,
          name,
          'persist'
        ]
      ),
      [PartyHistoryIndex.prototype, 'complete', 'persist'],
      ...['entries', 'pending', 'receipt'].map(
        (name): [object, string, string] => [
          PartyHistoryStore.prototype,
          name,
          'history-read'
        ]
      ),
      [LivePlayService.prototype, 'executePartyCharacterCommand', 'domain'],
      [LivePlayService.prototype, 'executeScenePartyCommand', 'domain']
    ]
    for (const [owner, method, phase] of methods)
      this.patch(
        owner,
        method,
        (original) =>
          function (...args) {
            return within(phase, () => Reflect.apply(original, this, args))
          }
      )
  }
  installDatabase(db: Database.Database, label: string) {
    const within = this.within.bind(this)
    const measuring = () => this.current !== null
    const currentPhase = () => this.phase
    const record = (key: PropertyKey, sql: string, result: unknown) => {
      if (!this.current) return
      if (key === 'iterate')
        throw new Error('Uncounted iterator in measured action')
      if (key !== 'all' && key !== 'get' && key !== 'run') return
      this.sqlShapes.add(`${label}: ${sql}`)
      const bucket = this.bucket()
      if (key === 'run') bucket.writes++
      else {
        bucket.reads++
        bucket.rows +=
          key === 'all'
            ? (result as unknown[]).length
            : result === undefined
              ? 0
              : 1
      }
    }
    this.patch(
      db,
      'prepare',
      (original) =>
        function (...args) {
          const statement = Reflect.apply(
            original,
            this,
            args
          ) as Database.Statement
          const sql = String(args[0]).replace(/\s+/g, ' ').trim()
          const proxy: Database.Statement = new Proxy(statement, {
            get(target, key) {
              const value: unknown = Reflect.get(target, key, target)
              if (typeof value !== 'function') return value
              return (...values: unknown[]) => {
                const result: unknown = Reflect.apply(value, target, values)
                record(key, sql, result)
                return result === target ? proxy : result
              }
            }
          })
          return proxy
        }
    )
    this.patch(
      db,
      'exec',
      (original) =>
        function (...args) {
          if (measuring()) throw new Error('Uncounted exec in measured action')
          return Reflect.apply(original, this, args)
        }
    )
    this.patch(
      db,
      'pragma',
      (original) =>
        function (...args) {
          if (measuring())
            throw new Error('Uncounted pragma in measured action')
          return Reflect.apply(original, this, args)
        }
    )
    this.patch(
      db,
      'transaction',
      (original) =>
        function (...args) {
          const callback = args[0] as Callable
          const parents: string[] = []
          const transaction = Reflect.apply(original, this, [
            function (this: unknown, ...values: unknown[]) {
              return within(parents.at(-1) ?? 'other', () =>
                Reflect.apply(callback, this, values)
              )
            }
          ]) as Callable
          const invoke = (
            target: Callable,
            receiver: unknown,
            values: unknown[]
          ) => {
            parents.push(currentPhase())
            try {
              return within('transaction-boundary', () =>
                Reflect.apply(target, receiver, values)
              )
            } finally {
              parents.pop()
            }
          }
          const wrapTransaction = (target: Callable): Callable =>
            function (...values) {
              return invoke(target, this, values)
            }
          const wrapped = wrapTransaction(transaction)
          for (const key of [
            'database',
            'default',
            'deferred',
            'immediate',
            'exclusive'
          ]) {
            const descriptor = Object.getOwnPropertyDescriptor(transaction, key)
            if (!descriptor) continue
            const value: unknown = descriptor.value
            Object.defineProperty(wrapped, key, {
              ...descriptor,
              value:
                typeof value === 'function'
                  ? value === transaction
                    ? wrapped
                    : wrapTransaction(value as Callable)
                  : value
            })
          }
          return wrapped
        }
    )
  }
  close() {
    for (const restore of this.restore.reverse()) restore()
    this.restore.length = 0
  }
}
