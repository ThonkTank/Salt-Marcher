import { app } from 'electron'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function outputPath(...segments: string[]): string {
  const appPath = app.getAppPath()
  const outputRoot = appPath.endsWith('.asar')
    ? join(appPath, 'out')
    : existsSync(join(appPath, 'out'))
      ? join(appPath, 'out')
      : dirname(appPath)
  return join(outputRoot, ...segments)
}
