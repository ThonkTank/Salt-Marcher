import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { profileAccessPaths } from '../../src/shared/maintenance/profile-path.js'
import { assertHistoricalTestIsolation } from './historical-test-isolation.js'
import { trackIsolatedProcess } from './historical-ui-driver.js'

export async function rejectHistoricalParallelStart(
  home: string,
  mode: 'starter' | 'alias' | 'appimage',
  label: string
) {
  assertHistoricalTestIsolation()
  const root = join(home, 'salt-marcher')
  const locks = [
    profileAccessPaths(join(root, 'profile')).lock,
    join(root, 'runtime.lock')
  ]
  const before = locks.map((path) => readFileSync(path, 'utf8'))
  const temporary = join(home, `parallel-${label}-${mode}`)
  mkdirSync(temporary)
  const alias = join(temporary, 'installation-alias')
  if (mode === 'alias') symlinkSync(root, alias)
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    XDG_DATA_HOME: home,
    TMPDIR: temporary,
    APPIMAGE_EXTRACT_AND_RUN: '1'
  }
  delete env['ELECTRON_RUN_AS_NODE']
  const child = spawn(
    join(
      mode === 'alias' ? alias : root,
      mode === 'appimage' ? 'current/SaltMarcher.AppImage' : 'start'
    ),
    ['--no-sandbox'],
    { env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  if (child.pid) trackIsolatedProcess(home, child.pid)
  let output = ''
  for (const stream of [child.stdout, child.stderr])
    stream.setEncoding('utf8').on('data', (chunk: string) => {
      output = (output + chunk).slice(-64 * 1024)
    })
  let timedOut = false
  let rejectTimeout: ((error: Error) => void) | undefined
  const deadline = setTimeout(() => {
    timedOut = true
    child.kill('SIGKILL')
    rejectTimeout?.(new Error('Parallel start exceeded its 20-second deadline'))
  }, 20_000)
  try {
    const exit = await new Promise<{
      code: number | null
      signal: NodeJS.Signals | null
    }>((resolve, reject) => {
      rejectTimeout = reject
      child.once('error', reject)
      child.once('close', (code, signal) => resolve({ code, signal }))
    })
    assert(
      !timedOut,
      'Parallel start timed out instead of refusing the busy profile'
    )
    assert.equal(exit.code, 1, output)
    assert.equal(exit.signal, null, output)
    assert.match(
      output,
      /SaltMarcher profile is locked by (application|installer)/
    )
    assert.deepEqual(
      locks.map((path) => readFileSync(path, 'utf8')),
      before
    )
    return { label, mode, pid: child.pid, exit, output, locks: before }
  } finally {
    clearTimeout(deadline)
    if (mode === 'alias') rmSync(alias)
  }
}
