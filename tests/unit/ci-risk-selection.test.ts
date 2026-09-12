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
import { verifySelectedWorkflowJobs } from '../../scripts/ci-selected-jobs.js'
import {
  readRequiredJobManifest,
  sameWorkflowQualification,
  workflowEvidenceSchema
} from '../../scripts/delivery-contract.js'
import {
  exactShaAggregateNeeds,
  verifyExactShaAggregate
} from '../../scripts/exact-sha-aggregate-contract.js'
import { assertSelectionMainBase } from '../../scripts/ci-selection-artifact.js'

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
  it('requires all three delivery partitions and permits only verified unrelated skips', () => {
    const repo = repository()
    repo.write('docs/releases/0.3.0.md')
    const headSha = repo.commit()
    const selection = repo.select(headSha)
    const needs = Object.fromEntries(
      exactShaAggregateNeeds.map((name) => [
        name,
        {
          result: [
            'candidate-preflight',
            'portable',
            'linux-build',
            'linux-package'
          ].includes(name)
            ? 'success'
            : 'skipped'
        }
      ])
    )
    const input = {
      checkedOutSha: headSha,
      checkedSha: headSha,
      pullRequestHeadSha: headSha,
      needs,
      selection,
      selectionContext: {
        workspaceRoot: repo.root,
        baseSha: repo.baseSha,
        mainSha: repo.baseSha,
        forceFull: false
      }
    }
    expect(() => verifyExactShaAggregate(input)).not.toThrow()
    for (const name of [
      'candidate-preflight',
      'portable',
      'linux-build',
      'linux-package'
    ]) {
      expect(() =>
        verifyExactShaAggregate({
          ...input,
          needs: { ...needs, [name]: { result: 'skipped' } }
        })
      ).toThrow(/not successful/)
    }
    for (const result of ['failure', 'cancelled']) {
      expect(() =>
        verifyExactShaAggregate({
          ...input,
          needs: { ...needs, native: { result } }
        })
      ).toThrow(/not successful/)
    }
    expect(() =>
      verifyExactShaAggregate({
        ...input,
        selection: { ...selection, requiredGroups: ['portable'] }
      })
    ).toThrow(/immutable Git evidence/)
    expect(() =>
      verifyExactShaAggregate({
        ...input,
        selectionContext: { ...input.selectionContext, forceFull: true }
      })
    ).toThrow(/immutable Git evidence/)
  })

  it('binds workflow evidence to selection and refuses reduced public release qualification', () => {
    const repo = repository()
    repo.write('docs/releases/0.3.0.md')
    const headSha = repo.commit()
    const manifest = readRequiredJobManifest()
    const selectedNames = [
      'Candidate · history and risk preflight',
      'Portable · static and app',
      'Linux build · reusable app',
      'Linux package · profile and AppImage',
      'Candidate · exact-SHA aggregate'
    ]
    const selection = repo.select(headSha)
    const run = {
      databaseId: 1,
      headSha,
      status: 'completed',
      conclusion: 'success',
      url: 'https://github.example/check/1',
      attempt: 1,
      jobs: manifest.jobs.map(({ name }) => ({
        name,
        status: 'completed',
        conclusion: selectedNames.includes(name) ? 'success' : 'skipped'
      }))
    }
    const input = {
      manifest,
      run,
      selection,
      workspaceRoot: repo.root,
      baseSha: repo.baseSha,
      headSha,
      forceFull: false
    }
    const evidence = verifySelectedWorkflowJobs(input)
    expect(evidence.jobs.map((job) => job.name)).toEqual(selectedNames)
    expect(evidence.selection).toEqual(selection)
    expect(() => workflowEvidenceSchema.parse(evidence)).not.toThrow()
    expect(() =>
      verifySelectedWorkflowJobs({ ...input, requireFull: true })
    ).toThrow(/Public release requires full/)
    expect(() =>
      verifySelectedWorkflowJobs({
        ...input,
        run: {
          ...run,
          jobs: run.jobs.filter(
            (job) => job.name !== 'Linux package · profile and AppImage'
          )
        }
      })
    ).toThrow(/missing/)
    expect(() =>
      verifySelectedWorkflowJobs({
        ...input,
        manifest: {
          ...manifest,
          jobs: [
            ...manifest.jobs,
            { name: 'Unknown new gate', platformRole: 'unknown' }
          ]
        }
      })
    ).toThrow(/explicit CI risk mapping/)
    expect(
      sameWorkflowQualification(evidence, {
        ...evidence,
        selection: { ...selection, diffSha256: '0'.repeat(64) }
      })
    ).toBe(false)
    const legacy = { ...evidence }
    delete legacy.selection
    expect(() => workflowEvidenceSchema.parse(legacy)).not.toThrow()
    expect(sameWorkflowQualification(evidence, legacy)).toBe(false)

    const full = verifySelectedWorkflowJobs({
      ...input,
      run: {
        ...run,
        jobs: run.jobs.map((job) => ({ ...job, conclusion: 'success' }))
      },
      selection: repo.select(headSha, true),
      forceFull: true,
      requireFull: true
    })
    expect(full.jobs).toHaveLength(manifest.jobs.length)
  })

  it('rejects a candidate-only base even when it is an ancestor of the candidate head', () => {
    const repo = repository()
    repo.write('src/main/change.ts')
    const intermediate = repo.commit()
    repo.write('docs/releases/new.md')
    const headSha = repo.commit()
    const selection = readCiRiskSelection({
      workspaceRoot: repo.root,
      baseSha: intermediate,
      headSha
    })
    expect(() =>
      assertSelectionMainBase(selection, repo.baseSha, repo.root)
    ).toThrow(/authenticated Main history/)
  })
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
    expect(selected.requiredGroups).toEqual([
      'portable',
      'linux-build',
      'linux-package'
    ])
    expect(selected.requiresLocalArtifact).toBe(true)
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
