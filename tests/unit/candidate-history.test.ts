import { afterEach, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  assertCandidateHistory,
  readCandidateHistory
} from '../../scripts/candidate-history.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

it('rejects new merges and stale candidates while accepting existing Main merges', () => {
  const root = mkdtempSync(join(tmpdir(), 'salt-candidate-history-'))
  roots.push(root)
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim()
  git('init', '--initial-branch=main')
  git('config', 'user.name', 'Qualification fixture')
  git('config', 'user.email', 'fixture@example.invalid')
  git('config', 'commit.gpgsign', 'false')
  const hooks = join(root, 'empty-hooks')
  mkdirSync(hooks)
  git('config', 'core.hooksPath', hooks)
  const commit = (name: string) => {
    writeFileSync(join(root, name), name)
    git('add', name)
    git('commit', '-m', name)
    return git('rev-parse', 'HEAD')
  }
  const initial = commit('initial')
  git('switch', '-c', 'topic')
  commit('topic')
  git('switch', 'main')
  const main = commit('main-change')
  git('merge', '--no-ff', 'topic', '-m', 'integration merge')
  const merged = git('rev-parse', 'HEAD')
  const rejected = readCandidateHistory(main, merged, root)
  expect(rejected).toEqual({ mainIsAncestor: true, mergeCommits: [merged] })
  expect(() => assertCandidateHistory(rejected)).toThrow(/linear history/)

  const next = commit('linear-change')
  const accepted = readCandidateHistory(merged, next, root)
  expect(accepted).toEqual({ mainIsAncestor: true, mergeCommits: [] })
  expect(() => assertCandidateHistory(accepted)).not.toThrow()
  git('switch', '-c', 'stale', initial)
  const stale = commit('stale-change')
  expect(() =>
    assertCandidateHistory(readCandidateHistory(merged, stale, root))
  ).toThrow(/current remote main/)
})

it('rejects unresolved or option-shaped revisions before invoking Git', () => {
  expect(() => readCandidateHistory('--all', 'a'.repeat(40))).toThrow()
  expect(() => readCandidateHistory('a'.repeat(40), 'main')).toThrow()
})
