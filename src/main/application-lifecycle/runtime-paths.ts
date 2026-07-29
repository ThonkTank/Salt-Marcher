import { app } from 'electron'
import { join } from 'node:path'

export function outputPath(...segments: string[]): string {
  return join(
    app.isPackaged ? app.getAppPath() : process.cwd(),
    'out',
    ...segments
  )
}
