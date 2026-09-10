import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import {
  historicalSourceSchema,
  inspectHistoricalSource,
  readHistoricalSchemaVersions
} from '../../scripts/qualification/historical-release-sources.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
const owner =
  'export const databaseSchemaVersions = Object.freeze({ installation: 37, campaign: 34 })'

it.each(['main', '52a0cc2', '--help'])(
  'rejects an unpinned source %s',
  (commit) => {
    expect(() =>
      historicalSourceSchema.parse({
        id: 'a',
        commit,
        schemaVersions: { installation: 37, campaign: 34 }
      })
    ).toThrow()
  }
)

it('reads actual owner literals without accepting misleading comments', () => {
  expect(
    readHistoricalSchemaVersions(
      '// installation: 999, campaign: 999\n' + owner
    )
  ).toEqual({ installation: 37, campaign: 34 })
})

it.each([
  owner.replace('37', 'process.exit()'),
  owner.replace('37', 'nextVersion'),
  owner.replace('campaign: 34', 'campaign: 34, campaign: 35'),
  owner.replace('campaign: 34', 'other: 34'),
  owner.replace('Object.freeze', 'untrusted.freeze'),
  owner + '\n' + owner
])('rejects ambiguous or executable owner declarations', (source) => {
  expect(() => readHistoricalSchemaVersions(source)).toThrow()
})

it('inspects immutable git content despite a changed checkout and rejects false schema claims', () => {
  const root = mkdtempSync(join(tmpdir(), 'salt-history-source-'))
  roots.push(root)
  const git = (args: string[]) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim()
  git(['init'])
  mkdirSync(join(root, 'src/core/persistence/sqlite'), { recursive: true })
  const path = join(root, 'src/core/persistence/sqlite/database.ts')
  writeFileSync(path, owner)
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ version: '0.1.0', packageManager: 'pnpm@10.15.1' })
  )
  writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n')
  git(['add', '.'])
  git([
    '-c',
    'user.name=Qualification',
    '-c',
    'user.email=qualification@example.invalid',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-m',
    'original'
  ])
  const commit = git(['rev-parse', 'HEAD'])
  writeFileSync(path, owner.replace('37', '99'))
  const source = {
    id: 'a',
    commit,
    schemaVersions: { installation: 37, campaign: 34 }
  }
  const result = inspectHistoricalSource(root, source)
  expect(result).toMatchObject({
    commit,
    evidence: 'source-inspection-only',
    schemaVersions: source.schemaVersions,
    packageVersion: '0.1.0'
  })
  expect(result.tree).toBe(git(['rev-parse', 'HEAD^{tree}']))
  expect(result.files).toHaveLength(3)
  expect(() =>
    inspectHistoricalSource(root, {
      ...source,
      schemaVersions: { installation: 99, campaign: 34 }
    })
  ).toThrow('different schema versions')
  expect(() =>
    inspectHistoricalSource(root, { ...source, commit: '0'.repeat(40) })
  ).toThrow()
})
