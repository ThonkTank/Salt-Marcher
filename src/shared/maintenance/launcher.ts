import { createHash, randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { sha256, syncPath } from './files.js'

/** Immutable helper bytes, executed by a retained AppImage's built-in Node mode. */
export function installMaintenanceLauncher(
  root: string,
  runtime: { path: string; sha256: string },
  bundle: Buffer
): void {
  if (sha256(runtime.path) !== runtime.sha256)
    throw new Error('Die Starthelfer-Laufzeit wurde verändert.')
  const hash = createHash('sha256').update(bundle).digest('hex')
  const directory = join(root, 'launchers')
  mkdirSync(directory, { recursive: true })
  const helper = join(directory, `${hash}.cjs`)
  if (existsSync(helper)) {
    if (!readFileSync(helper).equals(bundle))
      throw new Error('Der gespeicherte Starthelfer wurde verändert.')
  } else {
    const temporary = `${helper}.${randomUUID()}.tmp`
    writeFileSync(temporary, bundle, { flag: 'wx', mode: 0o600 })
    syncPath(temporary)
    renameSync(temporary, helper)
    syncPath(directory)
  }
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
  const script = `#!/bin/sh
salt_runtime_hash=$(sha256sum -- ${quote(runtime.path)}) || exit 1
salt_helper_hash=$(sha256sum -- ${quote(helper)}) || exit 1
case "$salt_runtime_hash" in
  ${quote(runtime.sha256)}' '*) ;;
  *) printf '%s\\n' 'Die Starthelfer-Laufzeit wurde verändert. Bitte Installation prüfen.' >&2; exit 1 ;;
esac
case "$salt_helper_hash" in
  ${quote(hash)}' '*) ;;
  *) printf '%s\\n' 'Der Starthelfer wurde verändert. Bitte Installation prüfen.' >&2; exit 1 ;;
esac
exec env ELECTRON_RUN_AS_NODE=1 APPIMAGE_EXTRACT_AND_RUN=1 ${quote(runtime.path)} ${quote(helper)} ${quote(root)} "$@"
`
  const target = join(root, 'start')
  const temporary = `${target}.${randomUUID()}.tmp`
  writeFileSync(temporary, script, { flag: 'wx', mode: 0o700 })
  syncPath(temporary)
  renameSync(temporary, target)
  syncPath(root)
}
