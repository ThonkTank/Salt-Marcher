import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
export function releaseRoot(): string {
  return resolve(
    process.env['XDG_DATA_HOME'] || join(homedir(), '.local', 'share'),
    'salt-marcher'
  )
}
