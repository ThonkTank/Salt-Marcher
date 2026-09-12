import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  rmSync,
  statfsSync,
  statSync,
  symlinkSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { assertHistoricalTestIsolation } from './historical-test-isolation.js'

function checkedVolume(volume: string, home: string) {
  assertHistoricalTestIsolation()
  const path = resolve(volume)
  const fs = statfsSync(path)
  assert.equal(fs.type, 0xef53, 'Space test requires its own ext4 volume')
  assert(
    fs.blocks * fs.bsize <= 3 * 1024 ** 3,
    'Space test volume exceeds 3 GiB'
  )
  assert.notEqual(statSync(path).dev, statSync('/').dev)
  assert.notEqual(statSync(path).dev, statSync(home).dev)
  return { path, available: fs.bavail * fs.bsize }
}
export function moveHistoricalInstallationToVolume(
  root: string,
  volume: string
) {
  const { path } = checkedVolume(volume, dirname(root))
  const destination = join(path, 'salt-marcher')
  assert(!existsSync(destination), 'Space test destination must be new')
  cpSync(root, destination, {
    recursive: true,
    force: false,
    errorOnExist: true
  })
  rmSync(root, { recursive: true })
  symlinkSync(destination, root)
}
export function constrainHistoricalSpace(
  volume: string,
  home: string,
  artifactBytes: number,
  exhausted = false
) {
  const before = checkedVolume(volume, home)
  const path = join(before.path, 'qualification-reserved-space')
  assert(!existsSync(path), 'Space reservation must be new')
  const remaining = exhausted ? 1024 ** 2 : artifactBytes + 32 * 1024 ** 2
  const reserve = before.available - remaining
  assert(reserve > 0 && reserve < 3 * 1024 ** 3)
  try {
    execFileSync('fallocate', ['--length', String(reserve), '--', path], {
      timeout: 20_000
    })
    const after = checkedVolume(volume, home)
    if (exhausted) assert(after.available <= 1024 ** 2)
    else {
      assert(after.available > artifactBytes + 16 * 1024 ** 2)
      assert(after.available < artifactBytes + 48 * 1024 ** 2)
    }
    return {
      before: before.available,
      after: after.available,
      artifactBytes,
      release: () => rmSync(path)
    }
  } catch (error) {
    rmSync(path, { force: true })
    throw error
  }
}
