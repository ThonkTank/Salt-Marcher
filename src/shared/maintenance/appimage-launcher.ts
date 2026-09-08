import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { sha256 } from './files.js'

const marker = 'SALT_MARCHER_LAUNCHER_V2:'
/** Read only from the verified artifact, including its packaged extraResources. */
export function readAppImageLauncher(
  appImage: string,
  expectedHash: string
): Buffer {
  if (sha256(appImage) !== expectedHash)
    throw new Error('Das Ziel-AppImage wurde verändert.')
  const script = `const fs=require('node:fs');const path=require('node:path');const data=fs.readFileSync(path.join(path.dirname(process.execPath),'resources','maintenance','start.cjs'));process.stdout.write('\\n${marker}'+data.toString('base64')+'\\n')`
  const temporary = mkdtempSync(join(tmpdir(), 'salt-helper-read-'))
  const result = (() => {
    try {
      return spawnSync(appImage, ['-e', script], {
        encoding: 'utf8',
        timeout: 30_000,
        maxBuffer: 16 * 1024 * 1024,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          APPIMAGE_EXTRACT_AND_RUN: '1',
          TMPDIR: temporary
        }
      })
    } finally {
      rmSync(temporary, { recursive: true, force: true })
    }
  })()
  if (result.error || result.status !== 0)
    throw new Error(
      'Der Starthelfer konnte nicht aus dem Ziel-AppImage gelesen werden.',
      { cause: result.error }
    )
  if (sha256(appImage) !== expectedHash)
    throw new Error('Das Ziel-AppImage wurde während der Prüfung verändert.')
  const records = result.stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith(marker))
  const encoded = records[0]?.slice(marker.length)
  if (
    records.length !== 1 ||
    !encoded ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
  )
    throw new Error('Das Ziel-AppImage enthält keinen gültigen Starthelfer.')
  const bundle = Buffer.from(encoded, 'base64')
  if (
    bundle.length === 0 ||
    bundle.length > 2 * 1024 * 1024 ||
    bundle.toString('base64') !== encoded
  )
    throw new Error('Das Ziel-AppImage enthält einen ungültigen Starthelfer.')
  return bundle
}
