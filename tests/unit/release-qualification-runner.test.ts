import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { request } from '../fixtures/release-request.js'
import { releaseRequestSchema } from '../../scripts/release/request.js'
import { digestReleaseDocument } from '../../scripts/release/qualification.js'
import {
  comparisonDirectory,
  qualificationCasePlan
} from '../../scripts/release/qualification-case-plan.js'
import {
  qualificationRunnerNames,
  verifyQualificationRunners
} from '../../scripts/release/qualification-runners.js'
import { runQualificationChild } from '../../scripts/release/run-qualification-child.js'
const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
function directory() {
  const root = mkdtempSync(join(tmpdir(), 'qualification-runner-'))
  roots.push(root)
  return root
}
function runners() {
  const root = directory(),
    commit = 'a'.repeat(40)
  const files = qualificationRunnerNames.map((name) => {
    const bytes = Buffer.from(`inert ${name}`)
    writeFileSync(join(root, name), bytes)
    return { name, bytes: bytes.length, sha256: digestReleaseDocument(bytes) }
  })
  const manifest = { formatVersion: 1, sourceCommit: commit, files }
  writeFileSync(
    join(root, 'qualification-runners.json'),
    JSON.stringify(manifest)
  )
  return { root, commit, manifest }
}
it('binds every runner to an immutable commit and its actual bytes', () => {
  const v = runners()
  expect(verifyQualificationRunners(v.root, v.commit)).toEqual(v.manifest)
})
it.each(['commit', 'bytes', 'duplicate', 'symlink'] as const)(
  'rejects %s runner substitution',
  (field) => {
    const v = runners()
    if (field === 'commit') v.commit = 'b'.repeat(40)
    if (field === 'bytes')
      writeFileSync(join(v.root, 'ui-update.mjs'), 'changed')
    if (field === 'duplicate') {
      v.manifest.files[1] = v.manifest.files[0]!
      writeFileSync(
        join(v.root, 'qualification-runners.json'),
        JSON.stringify(v.manifest)
      )
    }
    if (field === 'symlink') {
      rmSync(join(v.root, 'ui-update.mjs'))
      symlinkSync(
        join(v.root, 'first-install.mjs'),
        join(v.root, 'ui-update.mjs')
      )
    }
    expect(() => verifyQualificationRunners(v.root, v.commit)).toThrow()
  }
)
it('selects explicit schema scenarios and exactly the requested migration recovery', () => {
  const value = releaseRequestSchema.parse(request())
  const plan = qualificationCasePlan(value, 'migration')
  expect(plan.map((p) => p.scenario)).toEqual([
    'same-schema',
    'from-candidate-42',
    'from-41'
  ])
  expect(plan.filter((p) => p.recovery).map((p) => p.comparison.id)).toEqual([
    'migration'
  ])
  const baseline = value.comparisons[0]!.baseline
  expect(comparisonDirectory('/cache', baseline)).toBe(
    join('/cache', digestReleaseDocument(Buffer.from(JSON.stringify(baseline))))
  )
})
it('fails closed for unsupported format expectations, wrong recovery selection and published baselines without a fixture input', () => {
  const value = releaseRequestSchema.parse(request())
  expect(() => qualificationCasePlan(value, 'same')).toThrow(/migration case/)
  expect(() =>
    qualificationCasePlan(
      {
        ...value,
        target: {
          ...value.target,
          schemaVersions: { installation: 44, campaign: 44 }
        }
      },
      'migration'
    )
  ).toThrow(/fixture expectation/)
  value.comparisons[0]!.baseline.source = {
    kind: 'published-release',
    tag: 'v0.0.170'
  }
  expect(() => qualificationCasePlan(value, 'migration')).toThrow(
    /qualified profile fixture/
  )
})
it('runs an inert Node child and rejects its failed exit', async () => {
  const root = directory(),
    good = join(root, 'good.mjs'),
    bad = join(root, 'bad.mjs')
  writeFileSync(good, 'process.stdout.write("inert child done")')
  writeFileSync(bad, 'process.exit(7)')
  await expect(
    runQualificationChild(good, [], join(root, 'good.log'))
  ).resolves.toBeUndefined()
  await expect(
    runQualificationChild(bad, [], join(root, 'bad.log'))
  ).rejects.toThrow(/exit=7/)
})
it('rejects and stops remaining children in its own process group', async () => {
  const root = directory(),
    entry = join(root, 'orphan.mjs')
  writeFileSync(
    entry,
    'import {spawn} from "node:child_process";const child=spawn(process.execPath,["-e","setTimeout(()=>{},1000)"],{stdio:"ignore"});child.once("spawn",()=>process.exit(0));'
  )
  await expect(
    runQualificationChild(entry, [], join(root, 'orphan.log'))
  ).rejects.toThrow(/left processes running/)
})
