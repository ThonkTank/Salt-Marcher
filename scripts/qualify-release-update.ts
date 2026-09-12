import assert from 'node:assert/strict'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { assertHistoricalTestIsolation } from './qualification/historical-test-isolation.js'
import { canonicalProfilePath } from '../src/shared/maintenance/profile-path.js'
import { readUpdateArtifact } from './qualification/update-artifact.js'
import { inspectReleaseFile } from './release/bundle.js'
import { verifyComparisonFiles } from './release/comparison-fixture.js'
import {
  releaseRequestSchema,
  assertRequestedTarget
} from './release/request.js'
import { releaseQualificationSchema } from './release/qualification.js'
import {
  assembleQualification,
  type QualificationCase
} from './release/assemble-qualification.js'
import {
  comparisonDirectory,
  qualificationCasePlan
} from './release/qualification-case-plan.js'
import { verifyQualificationRunners } from './release/qualification-runners.js'
import { retainRuntimeLogs } from './release/retain-runtime-logs.js'
import { runQualificationChild } from './release/run-qualification-child.js'
import {
  verifyFirstInstallUiEvidence,
  verifyUpdateUiEvidence
} from './release/ui-evidence.js'

// Fail before reading profiles or starting any Electron executable on the host.
assertHistoricalTestIsolation()
const { values } = parseArgs({
  options: {
    request: { type: 'string' },
    target: { type: 'string' },
    comparisons: { type: 'string' },
    work: { type: 'string' },
    output: { type: 'string' },
    workflow: { type: 'string' },
    'recovery-case': { type: 'string' }
  }
})
const required = (name: keyof typeof values) =>
  z.string().min(1).parse(values[name])
const read = (path: string, limit = 4 * 1024 * 1024) =>
  inspectReleaseFile(path, limit, true).content
const requestBytes = read(resolve(required('request')))
const request = releaseRequestSchema.parse(
  JSON.parse(requestBytes.toString('utf8'))
)
const targetDirectory = resolve(required('target'))
const manifestBytes = read(join(targetDirectory, 'release-manifest.json'))
const manifest = assertRequestedTarget(
  request,
  JSON.parse(manifestBytes.toString('utf8'))
)
const target = readUpdateArtifact(targetDirectory)
assert.equal(target.kind, 'release')
assert.deepEqual(target.manifest, manifest)
// This is a transported identity, not an in-guest authentication of GitHub.
const workflow = releaseQualificationSchema.shape.workflow.parse(
  JSON.parse(read(resolve(required('workflow'))).toString('utf8'))
)
assert.equal(workflow.commit, request.target.commit)
const runners = dirname(fileURLToPath(import.meta.url))
verifyQualificationRunners(runners, workflow.commit)
const comparisonRoot = resolve(required('comparisons'))
const recoveryId = required('recovery-case')
const plan = qualificationCasePlan(request, recoveryId)
const prepared = plan.map((item) => {
  const baselineDirectory = comparisonDirectory(
    comparisonRoot,
    item.comparison.baseline
  )
  verifyComparisonFiles(baselineDirectory, item.comparison.baseline)
  const baseline = readUpdateArtifact(baselineDirectory)
  const intermediate = item.comparison.intermediate.map((stand) => {
    const directory = comparisonDirectory(comparisonRoot, stand)
    verifyComparisonFiles(directory, stand)
    return readUpdateArtifact(directory)
  })
  return { ...item, baselineDirectory, baseline, intermediate }
})
const work = resolve(required('work')),
  output = resolve(required('output'))
assert.equal(canonicalProfilePath(work), work)
assert.equal(canonicalProfilePath(output), output)
assert(
  !existsSync(work) && !existsSync(output),
  'Qualification work/output must be new'
)
mkdirSync(work, { recursive: true })
const cases: QualificationCase[] = []
try {
  const firstRoot = join(work, 'first-installation')
  mkdirSync(firstRoot)
  await runQualificationChild(
    join(runners, 'first-install.mjs'),
    ['--target', targetDirectory, '--home', join(firstRoot, 'home')],
    join(work, 'first-installation.log')
  )
  const firstInstallation = read(
    join(firstRoot, 'home/first-install-evidence.json'),
    64 * 1024 * 1024
  )
  verifyFirstInstallUiEvidence(
    JSON.parse(firstInstallation.toString('utf8')),
    target
  )
  writeFileSync(join(work, 'first-installation.json'), firstInstallation, {
    flag: 'wx'
  })
  retainRuntimeLogs(firstRoot, join(work, 'runtime-logs/first-installation'))
  rmSync(firstRoot, { recursive: true })
  for (const item of prepared) {
    const caseRoot = join(work, `case-${item.comparison.id}`)
    mkdirSync(caseRoot)
    const home = join(caseRoot, 'home')
    const args = [
      '--baseline',
      item.baselineDirectory,
      '--target',
      targetDirectory,
      '--home',
      home,
      '--installed-launcher',
      '--party-history-scenario',
      item.scenario,
      '--restore-protected-history'
    ]
    if (item.recovery)
      args.push('--activation-crash', 'new-data-moved', '--accepted-crash')
    await runQualificationChild(
      join(runners, 'ui-update.mjs'),
      args,
      join(work, `case-${item.comparison.id}.log`)
    )
    const report = read(join(home, 'ui-update-evidence.json'), 64 * 1024 * 1024)
    verifyUpdateUiEvidence(
      JSON.parse(report.toString('utf8')),
      item.baseline,
      target,
      item.comparison,
      item.recovery
    )
    assert.deepEqual(readUpdateArtifact(item.baselineDirectory), item.baseline)
    assert.deepEqual(readUpdateArtifact(targetDirectory), target)
    writeFileSync(join(work, `comparison-${item.comparison.id}.json`), report, {
      flag: 'wx'
    })
    cases.push({
      id: item.comparison.id,
      baseline: item.baseline,
      intermediate: item.intermediate,
      report
    })
    // Only this successful, fully read-back synthetic case; failed cases remain intact.
    retainRuntimeLogs(
      caseRoot,
      join(work, `runtime-logs/case-${item.comparison.id}`)
    )
    rmSync(caseRoot, { recursive: true })
  }
  verifyQualificationRunners(runners, workflow.commit)
  const assembled = assembleQualification({
    request: requestBytes,
    manifest: manifestBytes,
    target,
    workflow,
    completedAt: new Date().toISOString(),
    firstInstallation,
    recoveryComparisonId: recoveryId,
    cases
  })
  mkdirSync(output, { recursive: true })
  for (const [name, bytes] of assembled.files)
    writeFileSync(join(output, name), bytes, { flag: 'wx' })
  console.info(`Full UI release qualification passed: ${output}`)
} catch (error) {
  writeFileSync(
    join(work, 'qualification-failure.json'),
    JSON.stringify(
      { error: error instanceof Error ? error.stack : String(error) },
      null,
      2
    ),
    { flag: 'wx' }
  )
  throw error
}
