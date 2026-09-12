import { expect, it, vi } from 'vitest'
import {
  historicalUiFeed,
  historicalUiFetch
} from '../../scripts/qualification/historical-runtime/ui-feed.js'

const enabled = {
  SALT_MARCHER_HISTORICAL_UI: 'true',
  XDG_DATA_HOME: '/isolated/profile',
  SALT_MARCHER_HISTORICAL_UI_FEED: 'http://127.0.0.1:12345'
}

it('leaves ordinary starts without a test adapter', () => {
  expect(historicalUiFeed({})).toBeNull()
  expect(
    historicalUiFeed({ ...enabled, SALT_MARCHER_HISTORICAL_UI: 'false' })
  ).toBeNull()
})
it.each([
  { XDG_DATA_HOME: 'relative' },
  { SALT_MARCHER_RELEASE_QUALIFICATION: 'true' },
  ...[
    'https://127.0.0.1:12345',
    'http://example.org:12345',
    'http://user@127.0.0.1:12345',
    'http://127.0.0.1:12345/path',
    'http://127.0.0.1:12345?query',
    'http://127.0.0.1'
  ].map((SALT_MARCHER_HISTORICAL_UI_FEED) => ({
    SALT_MARCHER_HISTORICAL_UI_FEED
  }))
])('rejects unsafe or ambiguous UI configuration %j', (overrides) => {
  expect(() => historicalUiFeed({ ...enabled, ...overrides })).toThrow()
})
it('redirects only GitHub HTTPS requests and preserves request options', async () => {
  const feed = historicalUiFeed(enabled)!
  const original = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'))
  const fetch = historicalUiFetch(feed, original)
  const controller = new AbortController()
  await fetch(
    'https://api.github.com/repos/owner/repo/releases/latest?test=1',
    { signal: controller.signal }
  )
  expect(original.mock.calls[0]![0]).toEqual(
    new URL('http://127.0.0.1:12345/repos/owner/repo/releases/latest?test=1')
  )
  expect(original.mock.calls[0]![1]?.signal).toBe(controller.signal)
  const request = new Request(
    'https://github.com/owner/repo/releases/download/v1/asset',
    { headers: { Accept: 'application/octet-stream' } }
  )
  await fetch(request)
  const redirected = original.mock.calls[1]![0] as Request
  expect(redirected.url).toBe(
    'http://127.0.0.1:12345/owner/repo/releases/download/v1/asset'
  )
  expect(redirected.headers.get('Accept')).toBe('application/octet-stream')
  for (const url of [
    'https://example.org/file',
    'https://github.com.evil.test/file',
    'http://github.com/file'
  ]) {
    await fetch(url)
    expect(original).toHaveBeenLastCalledWith(url, undefined)
  }
})
