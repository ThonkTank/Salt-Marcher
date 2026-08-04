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

export function resourcePath(...segments: string[]): string {
  if (app.isPackaged) return join(process.resourcesPath, ...segments)
  const appPath = app.getAppPath()
  const roots = [appPath, join(appPath, '..', '..')]
  const root = roots.find((candidate) =>
    existsSync(join(candidate, 'resources'))
  )
  return join(root ?? appPath, 'resources', ...segments)
}
