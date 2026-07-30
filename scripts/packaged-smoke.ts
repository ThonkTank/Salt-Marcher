import { existsSync } from 'node:fs'
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
    case 'darwin':
      return join(
        'release',
        'mac',
        'SaltMarcher.app',
        'Contents',
        'MacOS',
        'SaltMarcher'
      )
    case 'win32':
      return join('release', 'win-unpacked', 'SaltMarcher.exe')
    default:
      return join('release', 'linux-unpacked', 'salt-marcher')
  }
}
