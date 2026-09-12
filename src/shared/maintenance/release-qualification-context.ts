import { readFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { releaseQualificationMarkerSchema } from '../contracts/release-qualification.js'
import { canonicalProfilePath } from './profile-path.js'
import { assertHistoricalTestIsolation } from './qualification-isolation.js'

export function validateReleaseQualificationContext(
  env: NodeJS.ProcessEnv,
  marker: unknown,
  canonicalRoot: string
) {
  const root = env['XDG_DATA_HOME']
  if (
    env['SALT_MARCHER_E2E'] !== 'true' ||
    !root ||
    !isAbsolute(root) ||
    resolve(root) !== root ||
    canonicalRoot !== root
  )
    throw new Error(
      'Release qualification requires explicit E2E mode and canonical isolated XDG storage.'
    )
  const parsed = releaseQualificationMarkerSchema.parse(marker)
  if (
    parsed.root !== root ||
    parsed.runId !== env['SALT_MARCHER_RELEASE_TEST_RUN']
  )
    throw new Error(
      'Release qualification profile marker belongs to another run or directory.'
    )
  return {
    root,
    runId: parsed.runId,
    profile: join(root, 'salt-marcher/profile'),
    reports: join(root, 'release-qualification')
  }
}

export function releaseQualificationContext(env = process.env) {
  // Reject host execution before reading or locking any profile.
  assertHistoricalTestIsolation()
  const root = env['XDG_DATA_HOME']
  if (!root || !isAbsolute(root))
    throw new Error('Missing isolated XDG storage.')
  return validateReleaseQualificationContext(
    env,
    JSON.parse(
      readFileSync(join(root, '.salt-marcher-qualification.json'), 'utf8')
    ) as unknown,
    canonicalProfilePath(root)
  )
}
