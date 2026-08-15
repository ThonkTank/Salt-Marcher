import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { buildChannelSchema } from '../src/shared/contracts/build-info.js'

const channelIndex = process.argv.indexOf('--channel')
if (channelIndex === -1)
  throw new Error('Usage: packaged-smoke.ts --channel <channel>')
const channel = buildChannelSchema.parse(process.argv[channelIndex + 1])
const qualification = process.argv.includes('--qualification')
const executable = packagedExecutable(channel)

if (!existsSync(executable))
  throw new Error(`Packaged executable was not found: ${executable}`)

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
    {
      encoding: 'utf8',
      timeout: 30_000,
      env:
        process.platform === 'linux'
          ? { ...process.env, APPIMAGE_EXTRACT_AND_RUN: '1' }
          : process.env
    }
  )
  if (result.error) throw result.error
  if (result.status !== 0) {
    process.stdout.write(result.stdout)
    process.stderr.write(result.stderr)
    throw new Error(
      `Packaged application exited with code ${result.status ?? 'unknown'}`
    )
  }
  console.info(
    JSON.stringify({
      component: 'packaged-smoke',
      event: 'actual-package-passed',
      channel,
      executable: basename(executable)
    })
  )
} finally {
  rmSync(userData, { recursive: true, force: true })
}

function packagedExecutable(channel: string): string {
  const output = resolve('release', channel)
  if (process.platform === 'linux') {
    const artifacts = readdirSync(output)
      .filter((entry) => entry.endsWith('.AppImage'))
      .sort()
    if (artifacts.length !== 1)
      throw new Error(
        `Expected exactly one AppImage in ${output}, found ${artifacts.length}`
      )
    return join(output, artifacts[0]!)
  }
  if (process.platform === 'win32') {
    const name =
      channel === 'development' ? 'SaltMarcher Development' : 'SaltMarcher'
    return join(output, 'win-unpacked', `${name}.exe`)
  }
  const macDirectory = readdirSync(output, { withFileTypes: true }).find(
    (entry) => entry.isDirectory() && entry.name.startsWith('mac')
  )?.name
  if (macDirectory === undefined)
    throw new Error('electron-builder did not produce a macOS app directory')
  const name =
    channel === 'development' ? 'SaltMarcher Development' : 'SaltMarcher'
  return join(output, macDirectory, `${name}.app`, 'Contents', 'MacOS', name)
}
