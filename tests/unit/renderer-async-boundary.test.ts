import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rendererAsyncBoundaryViolations } from '../../scripts/architecture/renderer-async-boundary.js'
import { rendererPromiseQueueViolations } from '../../scripts/architecture/renderer-async-boundary.js'

const sessionDirectory = 'src/renderer/features/session'
const migratedOwners = readdirSync(sessionDirectory)
  .filter(
    (name) =>
      name === 'group-manager-state.ts' ||
      name === 'use-session-mutation-controller.ts' ||
      name.startsWith('use-group-manager-')
  )
  .map((name) => `${sessionDirectory}/${name}`)

describe('renderer async boundary', () => {
  it('keeps request infrastructure out of migrated domain controllers and state', () => {
    const sources = Object.fromEntries(
      migratedOwners.map((path) => [path, readFileSync(path, 'utf8')])
    )
    expect(rendererAsyncBoundaryViolations(sources)).toEqual([])
  })

  it('rejects representative parallel token, sequence and action inventories', () => {
    expect(
      rendererAsyncBoundaryViolations({
        'manual.ts': `
          const token = crypto.randomUUID()
          const latestSnapshotRequest = useRef(0)
          const perEntity = useRef(new Map<string, number>())
          dispatch({ kind: 'request-began' })
        `
      }).map(({ mechanism }) => mechanism)
    ).toEqual([
      'token',
      'latestSnapshotRequest',
      'useRef-request-sequence',
      'useRef-request-sequence',
      'request-began'
    ])
  })

  it('keeps Promise-tail queues behind the shared coordinator', () => {
    const rendererSources = Object.fromEntries(
      rendererFiles().map((path) => [path, readFileSync(path, 'utf8')])
    )
    expect(rendererPromiseQueueViolations(rendererSources)).toEqual([])
    expect(
      rendererPromiseQueueViolations({
        'parallel-queue.ts': `
          const writeQueue = useRef<Promise<void>>(Promise.resolve())
        `
      })
    ).toEqual([{ path: 'parallel-queue.ts', line: 2 }])
  })
})

function rendererFiles(directory = 'src/renderer'): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = `${directory}/${name}`
    return name.includes('.')
      ? /\.[cm]?[jt]sx?$/.test(name)
        ? [path]
        : []
      : rendererFiles(path)
  })
}
