import { app } from 'electron'
import { dirname, join } from 'node:path'

export function outputPath(...segments: string[]): string {
  const entryPoint = process.argv[1]
  const outputRoot = app.isPackaged
    ? join(app.getAppPath(), 'out')
    : entryPoint === undefined
      ? join(process.cwd(), 'out')
      : dirname(dirname(entryPoint))
  return join(outputRoot, ...segments)
}
