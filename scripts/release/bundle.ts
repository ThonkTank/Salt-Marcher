import { createHash } from 'node:crypto'
import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import {
  verifyQualificationDocuments,
  type ReleaseQualification
} from './qualification.js'

/** The caller obtains this identity from live CI, never from the bundle itself. */
export function verifyReleaseBundle(
  directory: string,
  expectedWorkflow: ReleaseQualification['workflow']
): ReleaseQualification {
  const request = readControl(directory, 'release-request.json')
  const manifest = readControl(directory, 'release-manifest.json')
  const report = readControl(directory, 'update-qualification.json')
  const qualification = verifyQualificationDocuments(request, manifest, report)
  if (!isDeepStrictEqual(qualification.workflow, expectedWorkflow))
    throw new Error('Release bundle belongs to another qualification workflow.')
  for (const file of [
    qualification.target.artifact,
    qualification.firstInstallation,
    qualification.recovery.evidence,
    ...qualification.comparisons.map((comparison) => comparison.evidence)
  ]) {
    const actual = inspectReleaseFile(
      join(directory, file.name),
      file.bytes,
      false
    )
    if (actual.bytes !== file.bytes || actual.sha256 !== file.sha256)
      throw new Error(
        `Release file differs from its qualification: ${file.name}`
      )
  }
  return qualification
}

function readControl(directory: string, name: string): Buffer {
  return inspectReleaseFile(join(directory, name), 4 * 1024 * 1024, true)
    .content
}

/** Read/hash the same descriptor, bounded even if a file grows during verification. */
export function inspectReleaseFile(
  path: string,
  limit: number,
  retain: boolean
) {
  const descriptor = openSync(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
  )
  try {
    const stat = fstatSync(descriptor)
    if (!stat.isFile() || stat.size > limit)
      throw new Error(`Release file is not a bounded regular file: ${path}`)
    const hash = createHash('sha256')
    const chunks: Buffer[] = []
    const buffer = Buffer.allocUnsafe(Math.min(limit + 1, 1024 * 1024))
    let bytes = 0
    for (;;) {
      const count = readSync(
        descriptor,
        buffer,
        0,
        Math.min(buffer.length, limit - bytes + 1),
        null
      )
      if (count === 0) break
      bytes += count
      if (bytes > limit)
        throw new Error(`Release file exceeds its size limit: ${path}`)
      hash.update(buffer.subarray(0, count))
      if (retain) chunks.push(Buffer.from(buffer.subarray(0, count)))
    }
    if (bytes !== stat.size)
      throw new Error(`Release file changed during verification: ${path}`)
    return { bytes, sha256: hash.digest('hex'), content: Buffer.concat(chunks) }
  } finally {
    closeSync(descriptor)
  }
}
