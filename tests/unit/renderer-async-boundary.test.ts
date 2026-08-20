import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rendererAsyncBoundaryViolations } from '../../scripts/architecture/renderer-async-boundary.js'

const migratedOwners = [
  'src/renderer/features/session/use-session-mutation-controller.ts',
  'src/renderer/features/session/use-group-manager-controller.ts',
  'src/renderer/features/session/use-group-manager-commands.ts',
  'src/renderer/features/session/use-group-manager-queries.ts',
  'src/renderer/features/session/group-manager-state.ts'
] as const

describe('renderer async boundary', () => {
  it('keeps request infrastructure out of migrated domain controllers and state', () => {
    const sources = Object.fromEntries(
      migratedOwners.map((path) => [path, readFileSync(path, 'utf8')])
    )
    expect(rendererAsyncBoundaryViolations(sources)).toEqual([])

    expect(sources[migratedOwners[0]]).toContain(
      "from '../shared/use-async-command-coordinator.js'"
    )
    for (const path of migratedOwners.slice(2, 4))
      expect(sources[path]).toContain('useAsyncCommandCoordinator')
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
})
