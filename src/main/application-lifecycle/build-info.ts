import { readFileSync } from 'node:fs'
import { app } from 'electron'
import {
  buildInfoSchema,
  shortBuildFingerprint,
  type BuildInfo
} from '../../shared/contracts/build-info.js'
import { outputPath } from './runtime-paths.js'

export function loadBuildInfo(): BuildInfo | undefined {
  try {
    return buildInfoSchema.parse(
      JSON.parse(readFileSync(outputPath('build-info.json'), 'utf8'))
    )
  } catch (error) {
    if (app.isPackaged) throw error
    return undefined
  }
}

export function windowTitleForBuild(
  buildInfo: BuildInfo | undefined,
  iterationIdentity = process.env['SALT_MARCHER_ITERATION_ID']
): string {
  if (buildInfo?.channel === 'local')
    return `SaltMarcher Local · ${shortBuildFingerprint(buildInfo)}`
  if (
    buildInfo === undefined &&
    iterationIdentity !== undefined &&
    /^[a-z][a-z0-9-]{0,31}@[0-9a-f]{12}(?:\+dirty)?$/.test(iterationIdentity)
  )
    return `SaltMarcher Iteration · ${iterationIdentity}`
  return 'SaltMarcher'
}
