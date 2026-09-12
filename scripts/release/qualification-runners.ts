import assert from 'node:assert/strict'
import { join } from 'node:path'
import { z } from 'zod'
import { inspectReleaseFile } from './bundle.js'

export const qualificationRunnerNames = [
  'qualify-release-update.mjs',
  'ui-update.mjs',
  'first-install.mjs'
] as const
export const qualificationRunnersSchema = z
  .object({
    formatVersion: z.literal(1),
    sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
    files: z
      .array(
        z
          .object({
            name: z.enum(qualificationRunnerNames),
            bytes: z
              .number()
              .int()
              .positive()
              .max(64 * 1024 * 1024),
            sha256: z.string().regex(/^[a-f0-9]{64}$/)
          })
          .strict()
      )
      .length(3)
  })
  .strict()
export function verifyQualificationRunners(directory: string, commit: string) {
  const manifest = qualificationRunnersSchema.parse(
    JSON.parse(
      inspectReleaseFile(
        join(directory, 'qualification-runners.json'),
        1024 * 1024,
        true
      ).content.toString('utf8')
    )
  )
  assert.equal(
    manifest.sourceCommit,
    commit,
    'Qualification runners belong to another source commit'
  )
  assert.equal(
    new Set(manifest.files.map((file) => file.name)).size,
    3,
    'Duplicate qualification runner'
  )
  for (const file of manifest.files) {
    const actual = inspectReleaseFile(
      join(directory, file.name),
      file.bytes,
      false
    )
    assert.equal(actual.bytes, file.bytes)
    assert.equal(
      actual.sha256,
      file.sha256,
      'Qualification runner bytes changed'
    )
  }
  return manifest
}
