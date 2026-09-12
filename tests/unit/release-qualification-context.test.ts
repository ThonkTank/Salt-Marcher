import { expect, it, vi } from 'vitest'
import { validateReleaseQualificationContext } from '../../src/shared/maintenance/release-qualification-context.js'
import {
  qualificationFeed,
  qualificationFetch
} from '../../src/shared/maintenance/qualification-feed.js'
import { releaseInspectionRequestSchema } from '../../src/shared/contracts/release-qualification.js'

const root = '/tmp/release-test'
const runId = '11111111-1111-4111-8111-111111111111'
const env = {
  XDG_DATA_HOME: root,
  SALT_MARCHER_E2E: 'true',
  SALT_MARCHER_RELEASE_TEST_RUN: runId
}
const marker = { formatVersion: 1, runId, root }
it('binds an explicitly marked profile to its run and canonical directory', () => {
  expect(validateReleaseQualificationContext(env, marker, root)).toMatchObject({
    root,
    runId,
    profile: root + '/salt-marcher/profile'
  })
})
it.each([
  { SALT_MARCHER_E2E: 'false' },
  { SALT_MARCHER_RELEASE_TEST_RUN: 'other' },
  { XDG_DATA_HOME: 'relative' },
  { XDG_DATA_HOME: root + '/..' }
])('rejects an unqualified environment %j', (override) => {
  expect(() =>
    validateReleaseQualificationContext({ ...env, ...override }, marker, root)
  ).toThrow()
})
it('rejects aliases and markers from other runs or roots', () => {
  expect(() =>
    validateReleaseQualificationContext(env, marker, '/tmp/other')
  ).toThrow()
  expect(() =>
    validateReleaseQualificationContext(
      env,
      { ...marker, root: '/tmp/other' },
      root
    )
  ).toThrow()
  expect(() =>
    validateReleaseQualificationContext(
      env,
      { ...marker, runId: '22222222-2222-4222-8222-222222222222' },
      root
    )
  ).toThrow()
})
it.each(['seed', 'migrate', 'restore', 'advance'])(
  'does not expose the mutating operation %s through inspection',
  (operation) => {
    expect(() =>
      releaseInspectionRequestSchema.parse({
        requestId: runId,
        profile: root,
        operation
      })
    ).toThrow()
  }
)
it.each([
  'https://127.0.0.1:8000/',
  'http://localhost:8000/',
  'http://127.0.0.1/',
  'http://user@127.0.0.1:8000/',
  'http://127.0.0.1:8000/path',
  'http://127.0.0.1:8000/?q=1',
  'http://127.0.0.1:8000/#fragment'
])('rejects a non-origin loopback feed %s', (value) => {
  expect(() => qualificationFeed(value)).toThrow()
})
it('maps only GitHub HTTPS transport and preserves the request query and headers', async () => {
  const original = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
  const mapped = qualificationFetch(
    qualificationFeed('http://127.0.0.1:8000/'),
    original
  )
  await mapped(
    new Request(
      'https://api.github.com/repos/ThonkTank/Salt-Marcher/releases?per_page=1',
      { headers: { Accept: 'application/json' } }
    )
  )
  const forwarded = original.mock.calls[0]![0] as Request
  expect(forwarded.url).toBe(
    'http://127.0.0.1:8000/repos/ThonkTank/Salt-Marcher/releases?per_page=1'
  )
  expect(forwarded.headers.get('Accept')).toBe('application/json')
  await mapped('https://example.com/data')
  expect(original.mock.calls[1]![0]).toBe('https://example.com/data')
})
