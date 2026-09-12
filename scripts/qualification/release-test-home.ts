import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { releaseQualificationMarkerSchema } from '../../src/shared/contracts/release-qualification.js'
import { canonicalProfilePath } from '../../src/shared/maintenance/profile-path.js'

/** Call only inside the guarded qualification harness; this creates no campaign data. */
export function prepareReleaseTestHome(dataHome: string) {
  const root = resolve(dataHome)
  if (canonicalProfilePath(root) !== root)
    throw new Error('Qualification root must not be an alias.')
  mkdirSync(root, { recursive: true })
  const path = join(root, '.salt-marcher-qualification.json')
  const marker = existsSync(path)
    ? releaseQualificationMarkerSchema.parse(
        JSON.parse(readFileSync(path, 'utf8'))
      )
    : releaseQualificationMarkerSchema.parse({
        formatVersion: 1,
        runId: randomUUID(),
        root
      })
  if (marker.root !== root)
    throw new Error('Qualification marker belongs to another root.')
  if (!existsSync(path))
    writeFileSync(path, JSON.stringify(marker), { flag: 'wx' })
  return {
    root,
    runId: marker.runId,
    environment: {
      XDG_DATA_HOME: root,
      SALT_MARCHER_E2E: 'true',
      SALT_MARCHER_RELEASE_TEST_RUN: marker.runId
    }
  }
}
