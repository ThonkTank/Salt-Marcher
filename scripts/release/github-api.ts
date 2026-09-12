import { spawnSync } from 'node:child_process'
import { releaseRepository } from '../../src/shared/contracts/release.js'

export type ReleaseGithubApi = (
  method: 'GET' | 'POST' | 'PUT',
  endpoint: string,
  input?: unknown
) => { status: number; body: unknown }

/** Credentials remain in gh's process environment, never in release documents. */
export const releaseGithubApi: ReleaseGithubApi = (method, endpoint, input) => {
  if (!endpoint.startsWith(`repos/${releaseRepository}/`))
    throw new Error('Release API request escaped its configured repository.')
  const result = spawnSync(
    'gh',
    [
      'api',
      '--hostname',
      'github.com',
      '--include',
      '--method',
      method,
      '-H',
      'Accept: application/vnd.github+json',
      '-H',
      'X-GitHub-Api-Version: 2026-03-10',
      endpoint,
      ...(input === undefined ? [] : ['--input', '-'])
    ],
    {
      encoding: 'utf8',
      input: input === undefined ? undefined : JSON.stringify(input),
      timeout: 30_000,
      maxBuffer: 4 * 1024 * 1024
    }
  )
  if (result.error) throw result.error
  const response = parseReleaseGithubResponse(result.stdout)
  if (response.status >= 200 && response.status < 300 && result.status !== 0)
    throw new Error('GitHub client failed after receiving a response.')
  return response
}

export function parseReleaseGithubResponse(output: string): {
  status: number
  body: unknown
} {
  const normalized = output.replace(/\r\n/g, '\n')
  const end = normalized.indexOf('\n\n')
  const status = /^HTTP\/[0-9.]+ (\d{3})\b/.exec(normalized)?.[1]
  if (!status || end < 0)
    throw new Error('GitHub returned no complete HTTP response.')
  return {
    status: Number(status),
    body: JSON.parse(normalized.slice(end + 2)) as unknown
  }
}
