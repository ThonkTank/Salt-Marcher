import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  unlinkSync,
  symlinkSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { bytes, fixture } from '../fixtures/release-qualification.js'
import { digestReleaseDocument } from '../../scripts/release/qualification.js'
import { verifyReleaseBundle } from '../../scripts/release/bundle.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
function bundle() {
  const directory = mkdtempSync(join(tmpdir(), 'release-bundle-'))
  roots.push(directory)
  const value = fixture()
  const image = Buffer.from('test image bytes, not an executable')
  value.manifest.artifact.bytes = image.length
  value.manifest.artifact.sha256 = digestReleaseDocument(image)
  value.qualification.targetManifestSha256 = digestReleaseDocument(
    bytes(value.manifest)
  )
  writeFileSync(join(directory, value.manifest.artifact.name), image)
  for (const file of [
    value.qualification.firstInstallation,
    value.qualification.recovery.evidence,
    ...value.qualification.comparisons.map((comparison) => comparison.evidence)
  ]) {
    const content = bytes({ case: file.name, fixture: true })
    file.bytes = content.length
    file.sha256 = digestReleaseDocument(content)
    writeFileSync(join(directory, file.name), content)
  }
  writeFileSync(join(directory, 'release-request.json'), bytes(value.requested))
  writeFileSync(join(directory, 'release-manifest.json'), bytes(value.manifest))
  writeFileSync(
    join(directory, 'update-qualification.json'),
    bytes(value.qualification)
  )
  return { ...value, directory }
}

it('verifies all exact files and the independently supplied workflow identity', () => {
  const value = bundle()
  expect(
    verifyReleaseBundle(value.directory, value.qualification.workflow)
  ).toEqual(value.qualification)
})
it('rejects a substituted AppImage even when its size stays the same', () => {
  const value = bundle()
  writeFileSync(
    join(value.directory, value.manifest.artifact.name),
    Buffer.alloc(value.manifest.artifact.bytes, 1)
  )
  expect(() =>
    verifyReleaseBundle(value.directory, value.qualification.workflow)
  ).toThrow(/differs/)
})
it.each(['first-installation.json', 'recovery.json', 'release-request.json'])(
  'rejects a missing file %s',
  (name) => {
    const value = bundle()
    unlinkSync(join(value.directory, name))
    expect(() =>
      verifyReleaseBundle(value.directory, value.qualification.workflow)
    ).toThrow()
  }
)
it('rejects modified comparison evidence', () => {
  const value = bundle()
  writeFileSync(
    join(value.directory, value.qualification.comparisons[0]!.evidence.name),
    '{}'
  )
  expect(() =>
    verifyReleaseBundle(value.directory, value.qualification.workflow)
  ).toThrow(/differs/)
})
it('rejects a symlink even if it resolves to the correct bytes', () => {
  const value = bundle()
  const file = join(value.directory, 'release-request.json')
  writeFileSync(join(value.directory, 'other.json'), bytes(value.requested))
  unlinkSync(file)
  symlinkSync('other.json', file)
  expect(() =>
    verifyReleaseBundle(value.directory, value.qualification.workflow)
  ).toThrow()
})
it('rejects another run or attempt', () => {
  const value = bundle()
  for (const changed of [{ runId: 999 }, { attempt: 2 }])
    expect(() =>
      verifyReleaseBundle(value.directory, {
        ...value.qualification.workflow,
        ...changed
      })
    ).toThrow(/another qualification workflow/)
})
it('bounds control document reads before parsing', () => {
  const value = bundle()
  writeFileSync(
    join(value.directory, 'release-request.json'),
    Buffer.alloc(4 * 1024 * 1024 + 1, 32)
  )
  expect(() =>
    verifyReleaseBundle(value.directory, value.qualification.workflow)
  ).toThrow(/bounded regular file/)
})
