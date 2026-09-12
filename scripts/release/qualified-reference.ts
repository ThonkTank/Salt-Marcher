import assert from 'node:assert/strict'
import { join } from 'node:path'
import { inspectReleaseFile, verifyReleaseBundle } from './bundle.js'
import type { ReleaseQualification } from './qualification.js'

/** The reference directory must be freshly downloaded from the authenticated qualification artifact. */
export function verifyQualifiedReference(
  directory: string,
  reference: string,
  workflow: ReleaseQualification['workflow']
) {
  const qualification = verifyReleaseBundle(directory, workflow)
  verifyReleaseBundle(reference, workflow)
  for (const name of [
    'release-request.json',
    'release-manifest.json',
    'update-qualification.json'
  ]) {
    const original = inspectReleaseFile(
      join(reference, name),
      4 * 1024 * 1024,
      true
    ).content
    const actual = inspectReleaseFile(
      join(directory, name),
      4 * 1024 * 1024,
      true
    ).content
    assert(
      actual.equals(original),
      `Release differs from the original CI artifact: ${name}`
    )
  }
  // Identical control bytes bind identical hashes for every AppImage and evidence file, verified above.
  return qualification
}
