import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync('.github/workflows/check.yml', 'utf8')
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>
}

describe('CI platform partitions', () => {
  it('runs portable checks on every supported host', () => {
    expect(workflow).toContain(
      'matrix: { os: [ubuntu-latest, windows-2022, macos-latest] }'
    )
    expect(workflow).toContain('run: pnpm check:portable')
    expect(packageJson.scripts['test:unit:portable']).toContain(
      '--exclude tests/unit/local-app-installation.test.ts'
    )
    expect(packageJson.scripts['test:unit:portable']).toContain(
      '--exclude tests/unit/local-profile-lock.test.ts'
    )
  })

  it('keeps proc, profile, AppImage, and packaged installation checks Linux-only', () => {
    expect(packageJson.scripts['test:unit:linux']).toContain(
      'scripts/require-platform.ts linux'
    )
    expect(packageJson.scripts['test:unit:linux']).toContain(
      'tests/unit/local-app-installation.test.ts'
    )
    expect(packageJson.scripts['test:unit:linux']).toContain(
      'tests/unit/local-profile-lock.test.ts'
    )
    const linuxJob = workflow.slice(
      workflow.indexOf('  linux-runtime:'),
      workflow.indexOf('  e2e:')
    )
    expect(linuxJob).toContain('runs-on: ubuntu-latest')
    expect(linuxJob).toContain('pnpm test:packaged-smoke')
    expect(linuxJob).toContain('pnpm test:packaged-qualification-smoke')
  })

  it('shards isolated E2E fixtures and retains complete failure evidence', () => {
    for (const path of [
      '.tmp/e2e-runs',
      '.tmp/visual-diffs',
      '.tmp/wdio-user-data'
    ])
      expect(workflow).toContain(path)
    expect(workflow).toContain('if-no-files-found: error')
    expect(workflow).toContain('--suite workspaces --suite create')
  })
})
