import { app } from 'electron'
import { dirname, join } from 'node:path'

export function outputPath(...segments: string[]): string {
  const appPath = app.getAppPath()
  const outputRoot = appPath.endsWith('.asar')
    ? join(appPath, 'out')
    : dirname(appPath)
  return join(outputRoot, ...segments)
}
