import { app } from 'electron'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
/** AppImage extract-and-run instances must not remove each other's runtime tree. */
export function relaunchRelease(execPath: string, args: string[]): void {
  process.env['TMPDIR'] = mkdtempSync(join(tmpdir(), 'salt-release-launch-'))
  app.relaunch({ execPath, args })
}
