import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  checkRelease,
  downloadRelease
} from '../../src/main/release/github-release.js'
import type { ReleaseManifest } from '../../src/shared/contracts/release.js'
const roots: string[] = []
afterEach(() => {
  vi.unstubAllGlobals()
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
describe('release transport', () => {
  it('ignores legacy releases without an Electron manifest', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          tag_name: 'v9.0.0',
          draft: false,
          prerelease: false,
          body: 'old Java release',
          assets: []
        })
      )
    )
    expect(await checkRelease('0.2.0')).toBeNull()
  })
  it('reports offline checks without modifying installation data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(checkRelease('0.2.0')).rejects.toThrow('offline')
  })
  it('rejects a corrupt download and removes the partial file', async () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-download-'))
    roots.push(root)
    const manifest: ReleaseManifest = {
      formatVersion: 1,
      repository: 'ThonkTank/Salt-Marcher',
      version: '0.3.0',
      commit: 'a'.repeat(40),
      platform: 'linux',
      arch: 'x64',
      schemaVersions: { installation: 39, campaign: 34 },
      artifact: {
        name: 'SaltMarcher-0.3.0-x64.AppImage',
        bytes: 3,
        sha256: '0'.repeat(64)
      }
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad')))
    await expect(
      downloadRelease(
        {
          manifest,
          url: 'https://github.com/ThonkTank/Salt-Marcher/releases/download/v0.3.0/SaltMarcher-0.3.0-x64.AppImage',
          notes: ''
        },
        root,
        () => {}
      )
    ).rejects.toThrow('beschädigt')
    expect(existsSync(join(root, manifest.artifact.name))).toBe(false)
    expect(readdirSync(root)).toEqual([])
  })
})

describe('invalid release metadata', () => {
  const invalidMessage =
    'Die Updateinformationen sind ungültig oder passen nicht zu dieser Linux-App. Bitte später erneut prüfen.'
  const release = {
    tag_name: 'v0.3.0',
    draft: false,
    prerelease: false,
    body: '',
    assets: [
      {
        name: 'release-manifest.json',
        browser_download_url:
          'https://github.com/ThonkTank/Salt-Marcher/releases/download/v0.3.0/release-manifest.json'
      }
    ]
  }
  const manifest = {
    formatVersion: 1,
    repository: 'ThonkTank/Salt-Marcher',
    version: '0.3.0',
    commit: 'a'.repeat(40),
    platform: 'linux',
    arch: 'x64',
    schemaVersions: { installation: 42, campaign: 42 },
    artifact: {
      name: 'SaltMarcher-0.3.0-x64.AppImage',
      bytes: 123,
      sha256: 'b'.repeat(64)
    }
  }
  it.each([
    { arch: 'arm64' },
    { repository: 'untrusted/project' },
    { formatVersion: 2 }
  ])(
    'explains an incompatible manifest %j before requesting a binary',
    async (patch) => {
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(Response.json(release))
        .mockResolvedValueOnce(Response.json({ ...manifest, ...patch }))
      vi.stubGlobal('fetch', fetch)
      await expect(checkRelease('0.2.0')).rejects.toMatchObject({
        message: invalidMessage,
        cause: expect.any(Error) as unknown
      })
      expect(fetch).toHaveBeenCalledTimes(2)
    }
  )
  it('explains malformed manifest JSON without a download', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(release))
      .mockResolvedValueOnce(new Response('not-json'))
    vi.stubGlobal('fetch', fetch)
    await expect(checkRelease('0.2.0')).rejects.toMatchObject({
      message: invalidMessage,
      cause: expect.any(SyntaxError) as unknown
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('explains a malformed API result before requesting any asset', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ assets: 'broken' }))
    vi.stubGlobal('fetch', fetch)
    await expect(checkRelease('0.2.0')).rejects.toThrow(invalidMessage)
    expect(fetch).toHaveBeenCalledOnce()
  })
})
