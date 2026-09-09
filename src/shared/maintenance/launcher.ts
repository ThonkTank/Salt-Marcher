import { createHash, randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { durableJson, sha256, syncPath } from './files.js'

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
salt_work=$(mktemp -d "\${TMPDIR:-/tmp}/salt-launcher.XXXXXXXX") || exit 1
salt_child=''
salt_cleanup() {
  if [ -n "$salt_child" ]; then
    kill -TERM "-$salt_child" 2>/dev/null || kill -TERM "$salt_child" 2>/dev/null || :
    wait "$salt_child" 2>/dev/null || :
  fi
  rm -rf -- "$salt_work"
}
trap salt_cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
(cd "$salt_work" && exec setsid --wait env -u ELECTRON_RUN_AS_NODE -u APPIMAGE_EXTRACT_AND_RUN ${quote(runtime.path)} --appimage-extract >/dev/null) &
salt_child=$!
wait "$salt_child"
salt_extract_result=$?
salt_child=''
[ "$salt_extract_result" -eq 0 ] || exit 1
salt_runtime_after=$(sha256sum -- ${quote(runtime.path)}) || exit 1
[ "$salt_runtime_after" = "$salt_runtime_hash" ] || exit 1
salt_binary="$salt_work/squashfs-root/salt-marcher"
[ -d "$salt_work/squashfs-root" ] && [ ! -L "$salt_work/squashfs-root" ] || exit 1
[ -f "$salt_binary" ] && [ ! -L "$salt_binary" ] && [ -x "$salt_binary" ] || exit 1
setsid --wait env -u APPIMAGE -u APPDIR ELECTRON_RUN_AS_NODE=1 APPIMAGE_EXTRACT_AND_RUN=1 "$salt_binary" ${quote(helper)} ${quote(root)} "$@" &
salt_child=$!
wait "$salt_child"
salt_result=$?
salt_child=''
exit "$salt_result"
`
  const target = join(root, 'start')
  const temporary = `${target}.${randomUUID()}.tmp`
  writeFileSync(temporary, script, { flag: 'wx', mode: 0o700 })
  syncPath(temporary)
  renameSync(temporary, target)
  syncPath(root)
  durableJson(join(root, 'launcher-manifest.json'), {
    formatVersion: 1,
    runtime,
    helperSha256: hash,
    launcherSha256: sha256(target)
  })
}

/** Provenance evidence only; the maintenance journal alone owns recovery. */
export function validateMaintenanceLauncher(root: string): void {
  const hash = z.string().regex(/^[a-f0-9]{64}$/)
  const manifest = z
    .object({
      formatVersion: z.literal(1),
      runtime: z.object({ path: z.string().min(1), sha256: hash }).strict(),
      helperSha256: hash,
      launcherSha256: hash
    })
    .strict()
    .parse(
      JSON.parse(readFileSync(join(root, 'launcher-manifest.json'), 'utf8'))
    )
  if (
    sha256(join(root, 'start')) !== manifest.launcherSha256 ||
    sha256(join(root, 'launchers', `${manifest.helperSha256}.cjs`)) !==
      manifest.helperSha256 ||
    sha256(manifest.runtime.path) !== manifest.runtime.sha256
  )
    throw new Error(
      'Der installierte Starthelfer stimmt nicht mit seinem Nachweis überein.'
    )
}
