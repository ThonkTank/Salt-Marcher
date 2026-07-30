import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const executable = packagedExecutable()

if (!existsSync(executable)) {
  throw new Error(`Packaged executable was not found: ${executable}`)
}

const child = spawn(
  executable,
  ['--smoke-test', ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
  { stdio: 'inherit' }
)
const timeout = setTimeout(() => {
  child.kill()
  throw new Error('Packaged application did not exit within 20 seconds')
}, 20_000)

child.once('error', (error) => {
  clearTimeout(timeout)
  throw error
})
child.once('exit', (code) => {
  clearTimeout(timeout)
  if (code !== 0) {
    throw new Error(
      `Packaged application exited with code ${code ?? 'unknown'}`
    )
  }
})

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
