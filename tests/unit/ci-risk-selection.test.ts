import { execFileSync } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ciRiskGroups,
  ciRiskPolicyPath,
  readCiRiskSelection,
  verifyCiRiskSelection
} from '../../scripts/ci-risk-selection.js'

const policy = readFileSync(ciRiskPolicyPath)
const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function repository(withPolicy = true) {
  const root = mkdtempSync(join(tmpdir(), 'salt-ci-risk-'))
  roots.push(root)
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim()
  git('init', '--initial-branch=main')
  git('config', 'user.name', 'Risk selection fixture')
  git('config', 'user.email', 'fixture@example.invalid')
  git('config', 'commit.gpgsign', 'false')
  git('config', 'core.autocrlf', 'false')
  git('config', 'core.hooksPath', join(root, '.git', 'no-hooks'))
  const write = (path: string, content: string | Buffer = 'fixture\n') => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  const commit = () => {
    git('add', '-A')
    git('commit', '--allow-empty', '-m', 'fixture')
    return git('rev-parse', 'HEAD')
  }
  write('README.md')
  if (withPolicy) write(ciRiskPolicyPath, policy)
  const baseSha = commit()
  return {
    root,
    git,
    write,
    commit,
    baseSha,
    select: (headSha: string, forceFull = false) =>
      readCiRiskSelection({
        workspaceRoot: root,
        baseSha,
        headSha,
        forceFull
      })
  }
}

describe('immutable CI risk selection', () => {
  it.each(['not json', '{"schemaVersion":2}'])(
    'uses full checks for unsupported base policy %s',
    (bytes) => {
      const repo = repository()
      repo.write(ciRiskPolicyPath, bytes)
      const baseSha = repo.commit()
      repo.write('docs/releases/new.md')
      const selected = readCiRiskSelection({
        workspaceRoot: repo.root,
        baseSha,
        headSha: repo.commit()
      })
      expect(selected.mode).toBe('full')
      expect(selected.reasons).toContain('unsupported-base-policy')
    }
  )

  it('treats a control character in an otherwise selected Git path as structural risk', () => {
    const repo = repository()
    repo.write('docs/releases/tab\tname.md')
    expect(repo.select(repo.commit()).mode).toBe('full')
  })

  it('preserves the fingerprint rejection of unsupported multiline Git paths', () => {
    const repo = repository()
    repo.write('docs/releases/line\nbreak.md')
    const headSha = repo.commit()
    expect(() => repo.select(headSha)).toThrow(/Unsupported Git tree entry/)
  })
  it('proposes portable checks for explicit documentation and portable tests', () => {
    const repo = repository()
    repo.write('docs/roadmap-execution.md')
    repo.write('docs/releases/0.3.0.md')
    repo.write('tests/unit/new-contract.test.ts')
    const selected = repo.select(repo.commit())
    expect(selected.mode).toBe('selected')
    expect(selected.requiredGroups).toEqual(['portable'])
    expect(selected.requiresLocalArtifact).toBe(false)
    expect(selected.baseAppFingerprint).toBe(selected.headAppFingerprint)
  })

  it('retains Linux artifact and all UI checks for renderer changes', () => {
    const repo = repository()
    repo.write('src/renderer/update.tsx', 'export const view = 1\n')
    repo.write('tests/unit/update.test.ts')
    const selected = repo.select(repo.commit())
    expect(selected.mode).toBe('selected')
    expect(selected.requiredGroups).toEqual(
      ciRiskGroups.filter((g) => g !== 'native')
    )
    expect(selected.requiresLocalArtifact).toBe(true)
    expect(selected.baseAppFingerprint).not.toBe(selected.headAppFingerprint)
  })

  it.each([
    'src/main/update.ts',
    'src/shared/contracts/update.ts',
    'resources/icon.png',
    '.github/workflows/check.yml',
    'scripts/ci-risk-selection.ts',
    'AGENTS.md',
    'docs/project/requirements/updates.md',
    'tests/unit/local-profile-lock.test.ts',
    'tests/fixtures/release-ui.ts',
    'unknown.txt',
    'src/renderer/binary.wasm'
  ])('requires the full set for unmapped risk %s', (path) => {
    const repo = repository()
    repo.write(path)
    expect(repo.select(repo.commit()).requiredGroups).toEqual(ciRiskGroups)
  })

  it('does not let a renderer change conceal an unrelated unmapped change', () => {
    const repo = repository()
    repo.write('src/renderer/view.tsx')
    repo.write('src/utility/storage.ts')
    expect(repo.select(repo.commit()).mode).toBe('full')
  })

  it('uses full checks when bootstrapping policy or changing its bytes', () => {
    const bootstrap = repository(false)
    bootstrap.write(ciRiskPolicyPath, policy)
    expect(bootstrap.select(bootstrap.commit()).reasons).toContain(
      'missing-or-changed-base-policy'
    )
    const changed = repository()
    changed.write(ciRiskPolicyPath, Buffer.concat([policy, Buffer.from('\n')]))
    const selected = changed.select(changed.commit())
    expect(selected.mode).toBe('full')
    expect(selected.reasons).toContain('missing-or-changed-base-policy')
  })

  it('requires full checks for deletions and renames, including otherwise safe paths', () => {
    const repo = repository()
    repo.write('docs/releases/original.md')
    const baseSha = repo.commit()
    repo.git('mv', 'docs/releases/original.md', 'docs/releases/renamed.md')
    const selected = readCiRiskSelection({
      workspaceRoot: repo.root,
      baseSha,
      headSha: repo.commit()
    })
    expect(selected.mode).toBe('full')
    expect(selected.reasons).toContain(
      'structural-change:docs/releases/original.md'
    )
  })

  it('rejects any edited receipt field when recomputing immutable evidence', () => {
    const repo = repository()
    repo.write('src/renderer/update.tsx')
    const headSha = repo.commit()
    const input = { workspaceRoot: repo.root, baseSha: repo.baseSha, headSha }
    const selected = repo.select(headSha)
    expect(verifyCiRiskSelection(selected, input)).toEqual(selected)
    for (const patch of [
      { requiredGroups: ['portable'] },
      { requiresLocalArtifact: false },
      { baseSha: headSha },
      { headSha: repo.baseSha },
      { policySha256: 'a'.repeat(64) },
      { diffSha256: 'b'.repeat(64) },
      { baseAppFingerprint: 'c'.repeat(64) },
      { headAppFingerprint: 'd'.repeat(64) },
      { reasons: ['forged'] },
      { mode: 'full' }
    ])
      expect(() =>
        verifyCiRiskSelection({ ...selected, ...patch }, input)
      ).toThrow(/immutable Git evidence/)
  })

  it('ignores uncommitted policy and application edits when resolving a pinned pair', () => {
    const repo = repository()
    repo.write('docs/roadmap-execution.md')
    const headSha = repo.commit()
    const original = repo.select(headSha)
    repo.write(ciRiskPolicyPath, 'invalid local policy')
    repo.write('src/main/dirty.ts')
    expect(repo.select(headSha)).toEqual(original)
  })

  it('forces full qualification even for otherwise selected changes', () => {
    const repo = repository()
    repo.write('docs/releases/0.3.0.md')
    const headSha = repo.commit()
    expect(repo.select(headSha, true).requiredGroups).toEqual(ciRiskGroups)
    expect(repo.select(headSha, true).reasons).toContain(
      'explicit-full-qualification'
    )
  })

  it('requires full checks when there is no change evidence', () => {
    const repo = repository()
    expect(repo.select(repo.baseSha).reasons).toContain('empty-comparison')
  })

  it('rejects a base that is not an ancestor rather than selecting an unrelated diff', () => {
    const repo = repository()
    repo.write('docs/releases/new.md')
    const future = repo.commit()
    expect(() =>
      readCiRiskSelection({
        workspaceRoot: repo.root,
        baseSha: future,
        headSha: repo.baseSha
      })
    ).toThrow(/current remote main/)
  })
})
