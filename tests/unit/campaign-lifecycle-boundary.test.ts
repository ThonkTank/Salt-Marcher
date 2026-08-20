import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { campaignLifecycleBoundaryViolations } from '../../scripts/architecture/campaign-lifecycle-boundary.js'

const paths = [
  'src/core/application/campaign-lifecycle-coordinator.ts',
  'src/core/campaign-import/campaign-import-service.ts',
  'src/core/persistence/sqlite/campaign-filesystem.ts',
  'src/core/persistence/sqlite/campaign-store.ts'
] as const

describe('Campaign lifecycle architecture boundary', () => {
  it('keeps one coordinator and resource-free import orchestration', () => {
    expect(campaignLifecycleBoundaryViolations(actualSources())).toEqual([])
  })

  it('detects a second lifecycle owner in the import service', () => {
    const sources = actualSources()
    const path = 'src/core/campaign-import/campaign-import-service.ts'
    sources[path] += '\nnew CampaignLifecycleCoordinator({} as never)\n'

    expect(campaignLifecycleBoundaryViolations(sources)).toContainEqual(
      expect.objectContaining({ path, code: 'duplicate_coordinator_owner' })
    )
  })

  it('detects direct lifecycle-resource ownership in the import service', () => {
    const sources = actualSources()
    const path = 'src/core/campaign-import/campaign-import-service.ts'
    sources[path] += "\nimport './persistence/sqlite/campaign-filesystem.js'\n"

    expect(campaignLifecycleBoundaryViolations(sources)).toContainEqual(
      expect.objectContaining({ path, code: 'import_owns_lifecycle_resource' })
    )
  })
})

function actualSources(): Record<string, string> {
  return Object.fromEntries(
    paths.map((path) => [path, readFileSync(path, 'utf8')])
  )
}
