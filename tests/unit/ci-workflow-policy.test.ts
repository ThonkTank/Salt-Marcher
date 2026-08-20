import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync('.github/workflows/check.yml', 'utf8')
const mainPushVerification = readFileSync('scripts/verify-main-push.ts', 'utf8')
const handoff = readFileSync('scripts/handoff-local-app.ts', 'utf8')
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>
}

describe('CI platform partitions', () => {
  it('runs portable checks once and keeps native SQLite/runtime checks per OS', () => {
    expect(workflow.match(/pnpm check:portable:fast/g)).toHaveLength(1)
    expect(workflow).toContain('name: Native · ${{ matrix.os }}')
    expect(workflow).toContain('- os: windows-2022')
    expect(workflow).toContain('- os: macos-latest')
    expect(workflow).toContain('run: pnpm check:native')
    expect(workflow).toContain(
      "native-${{ runner.os }}-${{ runner.arch }}-node22-pnpm10-${{ hashFiles('pnpm-lock.yaml') }}"
    )
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
      workflow.indexOf('  linux-build:'),
      workflow.indexOf('  linux-package:')
    )
    expect(linuxJob).toContain('runs-on: ubuntu-latest')
    expect(linuxJob).toContain('pnpm check:linux')
    const packageJob = workflow.slice(
      workflow.indexOf('  linux-package:'),
      workflow.indexOf('  e2e:')
    )
    expect(packageJob).toContain('pnpm package:development:built')
    expect(packageJob).toContain('pnpm test:packaged-smoke:built')
    expect(packageJob).toContain('pnpm build:local')
    expect(packageJob).toContain('pnpm package:local:built')
    expect(packageJob).toContain('pnpm test:packaged-local-smoke:built')
    expect(packageJob).toContain('pnpm candidate-artifact:write')
    expect(packageJob).not.toContain('GITHUB_SHA:')
    expect(packageJob).toContain(
      'name: salt-marcher-local-${{ env.SALT_MARCHER_CHECKED_SHA }}-attempt-${{ github.run_attempt }}'
    )
    expect(packageJob).toContain('compression-level: 0')
    expect(workflow).toContain('name: Linux qualification · packaged harness')
    expect(workflow).toContain('pnpm test:packaged-qualification-smoke')
  })

  it('hands off the exact CI Local artifact without rebuilding it locally', () => {
    expect(handoff).toContain("'gh'")
    expect(handoff).toContain("'download'")
    expect(handoff).toContain('candidateArtifactName(')
    expect(handoff).toContain('verifyCandidateArtifactDirectory')
    expect(handoff).not.toContain("run('checked', ['pnpm', 'check'])")
    expect(handoff).not.toContain("run('packaged', ['pnpm', 'package:local'])")
    expect(handoff).toContain("'test:packaged-local-smoke:built'")
    expect(handoff).toContain("installationDefinition('backup-created')")
    expect(handoff).toContain("phase: 'installed-runtime-verified'")
  })

  it('builds Linux once and validates the same receipt in every consumer', () => {
    const linuxBuild = workflow.slice(
      workflow.indexOf('  linux-build:'),
      workflow.indexOf('  linux-package:')
    )
    expect(linuxBuild.match(/^\s+- run: pnpm build$/gm)).toHaveLength(1)
    expect(linuxBuild).toContain('include-hidden-files: true')
    const consumers = workflow.slice(workflow.indexOf('  linux-package:'))
    expect(consumers).not.toMatch(/^\s+- run: pnpm build$/m)
    expect(workflow).toContain(
      'SALT_MARCHER_CHECKED_SHA: ${{ github.event.pull_request.head.sha || github.sha }}'
    )
    expect(workflow).toContain(
      'name: linux-app-${{ env.SALT_MARCHER_CHECKED_SHA }}-attempt-${{ github.run_attempt }}'
    )
    expect(
      workflow.match(/ref: ['"]?\$\{\{ env\.SALT_MARCHER_CHECKED_SHA \}\}/g)
    ).toHaveLength(9)
    expect(workflow.match(/actions\/download-artifact@v4/g)).toHaveLength(4)
    expect(
      workflow.match(/assert-built-workspace\.ts --channel development/g)
    ).toHaveLength(5)
  })

  it('shards isolated functional and visual E2E while retaining evidence', () => {
    for (const path of [
      '.tmp/e2e-runs',
      '.tmp/visual-diffs',
      '.tmp/wdio-user-data'
    ])
      expect(workflow).toContain(path)
    expect(workflow).toContain('if-no-files-found: error')
    expect(workflow).toContain('--suite workspaces --suite campaignCreate')
    expect(workflow).toContain('name: Linux Visual · goldens')
    expect(workflow).toContain('pnpm test:visual:built')
  })

  it('runs only candidate attestation after the exact SHA reaches main', () => {
    const postPromotion = workflow.slice(workflow.indexOf('  post-promotion:'))
    expect(postPromotion).toContain("if: github.event_name == 'push'")
    expect(postPromotion).toContain('pnpm delivery:verify-main-push')
    expect(postPromotion).not.toContain('pnpm build')
    expect(postPromotion).not.toContain('pnpm test')
    expect(mainPushVerification).toContain('delivery:verify-post-promotion')
    expect(mainPushVerification).not.toContain('evidence')
    expect(Object.keys(packageJson.scripts)).not.toContain(
      'delivery:verify-evidence'
    )
    expect(Object.keys(packageJson.scripts)).not.toContain(
      'quality-reset:generate-evidence'
    )
  })
})
