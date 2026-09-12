import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { qualificationInputFixture } from '../fixtures/release-qualification-input.js'
import { cleanupRuntimeFixtures } from '../fixtures/release-runtime.js'
import { assembleQualification } from '../../scripts/release/assemble-qualification.js'
import { receiveQualification } from '../../scripts/release/receive-qualification.js'
const roots: string[] = []
afterEach(() => {
  cleanupRuntimeFixtures()
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
function fixture() {
  const input = qualificationInputFixture(),
    assembled = assembleQualification(input)
  const root = mkdtempSync(join(tmpdir(), 'receive-qualification-'))
  roots.push(root)
  for (const [name, bytes] of assembled.files)
    writeFileSync(join(root, name), bytes)
  return { input, assembled, root }
}
it('accepts only exact guest files whose semantics reproduce the full qualification', () => {
  const v = fixture()
  expect(receiveQualification(v.root, v.input)).toEqual(v.assembled)
})
it.each([
  'missing',
  'extra',
  'modified-summary',
  'modified-recovery',
  'modified-request',
  'wrong-workflow',
  'symlink'
] as const)('rejects %s guest evidence', (field) => {
  const v = fixture()
  if (field === 'missing') rmSync(join(v.root, 'comparison-skip.json'))
  if (field === 'extra') writeFileSync(join(v.root, 'unverified.json'), '{}')
  if (field === 'modified-summary') {
    const changed = structuredClone(v.assembled.qualification)
    changed.comparisons[0]!.profile.before = 'f'.repeat(64)
    writeFileSync(
      join(v.root, 'update-qualification.json'),
      JSON.stringify(changed, null, 2) + '\n'
    )
  }
  if (field === 'modified-recovery')
    writeFileSync(join(v.root, 'recovery.json'), '{}')
  if (field === 'modified-request')
    writeFileSync(join(v.root, 'release-request.json'), '{}')
  if (field === 'wrong-workflow') v.input.workflow.runId++
  if (field === 'symlink') {
    rmSync(join(v.root, 'comparison-migration.json'))
    symlinkSync(
      join(v.root, 'recovery.json'),
      join(v.root, 'comparison-migration.json')
    )
  }
  expect(() => receiveQualification(v.root, v.input)).toThrow()
})
