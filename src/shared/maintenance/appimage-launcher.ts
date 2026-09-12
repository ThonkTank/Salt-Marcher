import { profileAccessProtocolSchema } from '../contracts/profile-access.js'
import { lstatSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { sha256 } from './files.js'

/** Read only from the verified artifact, including its packaged extraResources. */
export function readAppImageLauncher(
  appImage: string,
  expectedHash: string
): Buffer {
  return readAppImageMaintenanceResource(appImage, expectedHash, 'start.cjs')
}

export function readAppImageProfileProtocol(
  appImage: string,
  expectedHash: string
) {
  const bytes = readAppImageMaintenanceResource(
    appImage,
    expectedHash,
    'profile-access.json'
  )
  return profileAccessProtocolSchema.parse(JSON.parse(bytes.toString('utf8')))
}

function readAppImageMaintenanceResource(
  appImage: string,
  expectedHash: string,
  resource: 'start.cjs' | 'profile-access.json'
): Buffer {
  if (sha256(appImage) !== expectedHash)
    throw new Error('Das Ziel-AppImage wurde verändert.')
  const executable = resolve(appImage)
  const temporary = mkdtempSync(join(tmpdir(), 'salt-helper-read-'))
  try {
    const environment: NodeJS.ProcessEnv = { ...process.env, TMPDIR: temporary }
    delete environment['ELECTRON_RUN_AS_NODE']
    delete environment['APPIMAGE_EXTRACT_AND_RUN']
    const result = spawnSync(
      executable,
      ['--appimage-extract', `resources/maintenance/${resource}`],
      {
        cwd: temporary,
        encoding: 'utf8',
        timeout: 30_000,
        maxBuffer: 16 * 1024 * 1024,
        env: environment
      }
    )
    if (result.error || result.status !== 0)
      throw new Error(
        'Der Starthelfer konnte nicht aus dem Ziel-AppImage gelesen werden.',
        { cause: result.error }
      )
    if (sha256(executable) !== expectedHash)
      throw new Error('Das Ziel-AppImage wurde während der Prüfung verändert.')
    let extracted = temporary
    const parts = ['squashfs-root', 'resources', 'maintenance', resource]
    for (const [index, part] of parts.entries()) {
      extracted = join(extracted, part)
      const stat = lstatSync(extracted, { throwIfNoEntry: false })
      const isResource = index === parts.length - 1
      if (
        !stat ||
        (isResource
          ? !stat.isFile() || stat.size === 0 || stat.size > 2 * 1024 * 1024
          : !stat.isDirectory())
      )
        throw new Error(
          'Das Ziel-AppImage enthält keinen gültigen Starthelfer.'
        )
    }
    return readFileSync(extracted)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}
