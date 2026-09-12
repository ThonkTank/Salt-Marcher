import {
  mkdtempSync,
  copyFileSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  appendFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { qualificationInputFixture } from '../fixtures/release-qualification-input.js'
import { cleanupRuntimeFixtures } from '../fixtures/release-runtime.js'
import { assembleQualification } from '../../scripts/release/assemble-qualification.js'
import { verifyQualifiedReference } from '../../scripts/release/qualified-reference.js'
const roots: string[] = []
afterEach(() => {
  cleanupRuntimeFixtures()
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
function fixture() {
  const input = qualificationInputFixture(),
    assembled = assembleQualification(input)
  const root = mkdtempSync(join(tmpdir(), 'qualified-reference-'))
  roots.push(root)
  const release = join(root, 'release'),
    reference = join(root, 'reference')
  for (const directory of [release, reference]) {
    mkdirSync(directory)
    for (const [name, bytes] of assembled.files)
      writeFileSync(join(directory, name), bytes)
    copyFileSync(
      input.target.executable,
      join(directory, input.target.manifest.artifact.name)
    )
  }
  return { input, release, reference, assembled }
}
it('accepts the unchanged qualified bundle', () => {
  const v = fixture()
  expect(
    verifyQualifiedReference(v.release, v.reference, v.input.workflow)
  ).toEqual(v.assembled.qualification)
})
it.each([
  'modified-qualification',
  'image',
  'reference-image',
  'workflow'
] as const)('rejects %s divergence', (field) => {
  const v = fixture()
  if (field === 'modified-qualification')
    appendFileSync(join(v.release, 'update-qualification.json'), '\n')
  if (field === 'image')
    writeFileSync(
      join(v.release, v.input.target.manifest.artifact.name),
      'changed'
    )
  if (field === 'reference-image')
    writeFileSync(
      join(v.reference, v.input.target.manifest.artifact.name),
      'changed'
    )
  if (field === 'workflow') v.input.workflow.runId++
  expect(() =>
    verifyQualifiedReference(v.release, v.reference, v.input.workflow)
  ).toThrow()
})
