import { expect, it } from 'vitest'
import {
  assertReleaseVersionAvailable,
  readReleaseVersion
} from '../../scripts/release/release-version.js'
import type { ReleaseGithubApi } from '../../scripts/release/github-api.js'

function release(id = 1, tag = 'v0.3.0') {
  return {
    id,
    tag_name: tag,
    draft: true,
    prerelease: false,
    target_commitish: 'a'.repeat(40),
    assets: [{ name: 'release-manifest.json', size: 123, state: 'uploaded' }]
  }
}
function server(pages: unknown[], tagStatus = 404) {
  const calls: string[] = []
  const api: ReleaseGithubApi = (method, endpoint) => {
    expect(method).toBe('GET')
    calls.push(endpoint)
    const page =
      /^repos\/ThonkTank\/Salt-Marcher\/releases\?per_page=100&page=(\d+)$/.exec(
        endpoint
      )
    if (page) return { status: 200, body: pages[Number(page[1]) - 1] }
    expect(endpoint).toBe('repos/ThonkTank/Salt-Marcher/git/ref/tags/v0.3.0')
    return { status: tagStatus, body: {} }
  }
  return { api, calls }
}
const fullPage = () =>
  Array.from({ length: 100 }, (_, index) => release(index + 1, `v0.0.${index}`))

it('finds an unpublished draft without requiring a public tag and preserves its assets', () => {
  const draft = release()
  const state = server([[draft]])
  expect(readReleaseVersion('0.3.0', state.api)).toEqual(draft)
  expect(state.calls).toEqual([
    'repos/ThonkTank/Salt-Marcher/releases?per_page=100&page=1'
  ])
})
it('finds the exact version on later pages and exhausts the listing', () => {
  const draft = release(101)
  const state = server([fullPage(), [draft, release(102, 'v0.3.1')]])
  expect(readReleaseVersion('0.3.0', state.api)).toEqual(draft)
  expect(state.calls).toHaveLength(2)
})
it.each([
  { draft: true, prerelease: false },
  { draft: false, prerelease: false },
  { draft: false, prerelease: true }
])('reserves an existing version with flags %j', (flags) => {
  const state = server([[{ ...release(), ...flags }]])
  expect(() => assertReleaseVersionAvailable('0.3.0', state.api)).toThrow(
    /reserved/
  )
  expect(state.calls).toHaveLength(1)
})
it('accepts absence only after both a complete release listing and a missing Git tag', () => {
  const state = server([fullPage(), []])
  expect(readReleaseVersion('0.3.0', state.api)).toBeNull()
  assertReleaseVersionAvailable('0.3.0', state.api)
  expect(state.calls.at(-1)).toContain('/git/ref/tags/v0.3.0')
})
it.each([200, 401, 403, 500])(
  'rejects a reserved or unreadable Git tag (HTTP %s)',
  (status) => {
    expect(() =>
      assertReleaseVersionAvailable('0.3.0', server([[]], status).api)
    ).toThrow(/Git tag/)
  }
)
it('rejects two distinct releases using the same version', () => {
  expect(() =>
    readReleaseVersion('0.3.0', server([[release(), release(2)]]).api)
  ).toThrow(/ambiguous/)
})
it('rejects repeated IDs across pages instead of interpreting a moving listing as absence', () => {
  expect(() =>
    readReleaseVersion(
      '0.3.0',
      server([fullPage(), [release(1, 'v9.0.0')]]).api
    )
  ).toThrow(/duplicate IDs/)
})
it.each([401, 403, 404, 500])(
  'rejects incomplete listing after a match (HTTP %s)',
  (status) => {
    const first = fullPage()
    first[0] = release()
    let calls = 0
    const api: ReleaseGithubApi = () =>
      ++calls === 1 ? { status: 200, body: first } : { status, body: {} }
    expect(() => readReleaseVersion('0.3.0', api)).toThrow(/Cannot enumerate/)
    expect(calls).toBe(2)
  }
)
it.each([
  { body: null },
  { body: { message: 'partial result' } },
  { body: [{ ...release(), id: Number.MAX_SAFE_INTEGER + 1 }] },
  { body: [{ ...release(), draft: undefined }] },
  { body: [...fullPage(), release(101)] }
])('rejects malformed or oversized release listings', ({ body }) => {
  expect(() => readReleaseVersion('0.3.0', server([body]).api)).toThrow()
})
it('bounds pagination and never returns an unproven absence at the limit', () => {
  let calls = 0
  const api: ReleaseGithubApi = () => {
    const base = calls++ * 100
    return {
      status: 200,
      body: Array.from({ length: 100 }, (_, i) =>
        release(base + i + 1, 'other')
      )
    }
  }
  expect(() => readReleaseVersion('0.3.0', api)).toThrow(/page limit/)
  expect(calls).toBe(100)
})
it('rejects invalid version input before making an API request', () => {
  const state = server([[]])
  expect(() => readReleaseVersion('../other', state.api)).toThrow()
  expect(state.calls).toEqual([])
})
