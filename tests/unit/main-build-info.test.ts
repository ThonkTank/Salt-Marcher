import { describe, expect, it, vi } from 'vitest'
import type { BuildInfo } from '../../src/shared/contracts/build-info.js'

vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => '/application' }
}))

import { windowTitleForBuild } from '../../src/main/application-lifecycle/build-info.js'

describe('main build identity', () => {
  it('keeps the local app-build fingerprint visible in the window title', () => {
    const build: BuildInfo = {
      channel: 'local',
      commit: 'a'.repeat(40),
      dirty: true,
      workspaceFingerprint: '0123456789abcdef'.repeat(4),
      appBuildInputFingerprint: 'f'.repeat(64),
      builtAt: '2026-08-15T12:00:00.000Z',
      schemaVersions: { installation: 28, campaign: 28 },
      migrationRegistryVersion: 1,
      toolchain: {
        node: 'v22.19.0',
        pnpm: '10.15.1',
        electron: '43.2.0',
        electronVite: '5.0.0',
        electronBuilder: '26.15.3',
        platform: 'linux',
        arch: 'x64'
      }
    }

    expect(windowTitleForBuild(build)).toBe(
      `SaltMarcher Local · ${'f'.repeat(12)}`
    )
    expect(windowTitleForBuild({ ...build, channel: 'release' })).toBe(
      'SaltMarcher'
    )
  })
})
