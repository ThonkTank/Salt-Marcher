import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  assembleQualification,
  type QualificationCase
} from './assemble-qualification.js'
import { inspectReleaseFile } from './bundle.js'
import { releaseRequestSchema } from './request.js'
import { releaseQualificationSchema } from './qualification.js'

type Expected = Omit<
  Parameters<typeof assembleQualification>[0],
  'cases' | 'firstInstallation' | 'completedAt'
> & {
  cases: Omit<QualificationCase, 'report'>[]
}

/** Recompute the guest result before accepting its files; never trust guest-provided summary digests. */
export function receiveQualification(directory: string, expected: Expected) {
  const read = (name: string, limit = 64 * 1024 * 1024) =>
    inspectReleaseFile(join(directory, name), limit, true).content
  assert(expected.request.byteLength <= 4 * 1024 * 1024)
  const request = releaseRequestSchema.parse(
    JSON.parse(Buffer.from(expected.request).toString('utf8'))
  )
  const rawQualification = read('update-qualification.json', 4 * 1024 * 1024)
  const guest = releaseQualificationSchema.parse(
    JSON.parse(rawQualification.toString('utf8'))
  )
  assert.deepEqual(
    guest.workflow,
    expected.workflow,
    'Guest report belongs to another workflow'
  )
  assert.equal(expected.cases.length, request.comparisons.length)
  const cases = new Map(expected.cases.map((value) => [value.id, value]))
  assert.equal(cases.size, expected.cases.length)
  const assembled = assembleQualification({
    ...expected,
    completedAt: guest.completedAt,
    firstInstallation: read('first-installation.json'),
    cases: request.comparisons.map((comparison) => {
      const value = cases.get(comparison.id)
      assert(value, 'Missing expected comparison artifact')
      return { ...value, report: read(`comparison-${comparison.id}.json`) }
    })
  })
  assert.deepEqual(
    readdirSync(directory).sort(),
    [...assembled.files.keys()].sort(),
    'Unexpected or missing guest release files'
  )
  for (const [name, bytes] of assembled.files)
    assert(
      read(name).equals(bytes),
      `Guest file differs from recomputed qualification: ${name}`
    )
  return assembled
}
