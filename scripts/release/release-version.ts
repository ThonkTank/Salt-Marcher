import assert from 'node:assert/strict'
import { z } from 'zod'
import {
  releaseRepository,
  releaseVersionSchema
} from '../../src/shared/contracts/release.js'
import { releaseGithubApi, type ReleaseGithubApi } from './github-api.js'

const releaseSchema = z
  .object({
    id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    tag_name: z.string().min(1),
    draft: z.boolean(),
    prerelease: z.boolean(),
    target_commitish: z.string().min(1)
  })
  .passthrough()

/** The public tag endpoint does not find unpublished drafts. */
export function readReleaseVersion(
  version: string,
  api: ReleaseGithubApi = releaseGithubApi
) {
  const tag = `v${releaseVersionSchema.parse(version)}`
  const seen = new Set<number>()
  let found: z.infer<typeof releaseSchema> | null = null
  for (let page = 1; page <= 100; page++) {
    const response = api(
      'GET',
      `repos/${releaseRepository}/releases?per_page=100&page=${page}`
    )
    assert.equal(response.status, 200, 'Cannot enumerate release versions')
    const releases = z.array(releaseSchema).max(100).parse(response.body)
    for (const release of releases) {
      assert(!seen.has(release.id), 'Release listing contains duplicate IDs')
      seen.add(release.id)
      if (release.tag_name !== tag) continue
      assert.equal(found, null, 'Release version is ambiguous')
      found = release
    }
    if (releases.length < 100) return found
  }
  throw new Error('Release version listing exceeds its page limit')
}

export function assertReleaseVersionAvailable(
  version: string,
  api: ReleaseGithubApi = releaseGithubApi
): void {
  assert.equal(
    readReleaseVersion(version, api),
    null,
    'Release version is already reserved'
  )
  const response = api(
    'GET',
    `repos/${releaseRepository}/git/ref/tags/${encodeURIComponent(`v${releaseVersionSchema.parse(version)}`)}`
  )
  assert.equal(
    response.status,
    404,
    'Git tag is already reserved or could not be checked'
  )
}
