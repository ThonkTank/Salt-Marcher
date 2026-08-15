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

export function windowTitleForBuild(buildInfo: BuildInfo | undefined): string {
  return buildInfo?.channel === 'local'
    ? `SaltMarcher Local · ${shortBuildFingerprint(buildInfo)}`
    : 'SaltMarcher'
}
