import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const executable = packagedExecutable()
const qualification = process.argv.includes('--qualification')

if (!existsSync(executable)) {
  throw new Error(`Packaged executable was not found: ${executable}`)
}

const userData = mkdtempSync(join(tmpdir(), 'salt-marcher-packaged-smoke-'))
try {
  const result = spawnSync(
    executable,
    [
      '--smoke-test',
      '--session-generation-smoke',
      ...(qualification ? ['--m1-qualification'] : []),
      ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
      `--user-data-dir=${userData}`
    ],
    { stdio: 'inherit', timeout: 20_000 }
  )
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(
      `Packaged application exited with code ${result.status ?? 'unknown'}`
    )
} finally {
  rmSync(userData, { recursive: true, force: true })
}

function packagedExecutable(): string {
  switch (process.platform) {
    case 'darwin': {
      const macDirectory = readdirSync('release', { withFileTypes: true }).find(
        (entry) => entry.isDirectory() && entry.name.startsWith('mac')
      )?.name
      if (macDirectory === undefined) {
        throw new Error(
          'electron-builder did not produce a macOS app directory'
        )
      }
      return join(
        'release',
        macDirectory,
        'SaltMarcher.app',
        'Contents',
        'MacOS',
        'SaltMarcher'
      )
    }
    case 'win32':
      return join('release', 'win-unpacked', 'SaltMarcher.exe')
    default:
      return join('release', 'linux-unpacked', 'salt-marcher')
  }
}
