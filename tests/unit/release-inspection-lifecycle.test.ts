import { EventEmitter } from 'node:events'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  fork: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  app: {
    setPath: vi.fn(),
    whenReady: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn().mockReturnValue('0.3.0'),
    quit: vi.fn()
  }
}))
vi.mock('electron', () => ({
  app: mocks.app,
  utilityProcess: { fork: mocks.fork }
}))
vi.mock(
  '../../src/shared/maintenance/release-qualification-context.js',
  () => ({ releaseQualificationContext: mocks.context })
)
vi.mock('../../src/main/local-profile/profile-access.js', () => ({
  acquireProfileAccess: mocks.acquire
}))
vi.mock('../../src/main/application-lifecycle/runtime-paths.js', () => ({
  outputPath: () => '/test/release-inspection.js'
}))
vi.mock('../../src/main/application-lifecycle/build-info.js', () => ({
  loadBuildInfo: () => ({
    channel: 'release',
    dirty: false,
    commit: 'a'.repeat(40)
  })
}))
import { runReleaseInspection } from '../../src/main/release/inspection-entry.js'
const originalArgv = [...process.argv]
const roots: string[] = []
afterEach(() => {
  process.argv = [...originalArgv]
  vi.useRealTimers()
  vi.clearAllMocks()
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
async function begin() {
  const root = mkdtempSync(join(tmpdir(), 'inspection-lifecycle-'))
  roots.push(root)
  const requestId = '11111111-1111-4111-8111-111111111111'
  mocks.context.mockReturnValue({
    root,
    profile: join(root, 'profile'),
    reports: join(root, 'reports')
  })
  mocks.acquire.mockReturnValue({ release: mocks.release })
  const worker = Object.assign(new EventEmitter(), {
    kill: vi.fn(),
    postMessage: vi.fn()
  })
  mocks.fork.mockReturnValue(worker)
  process.argv = [
    ...originalArgv,
    '--release-profile-inspection',
    'identity',
    requestId
  ]
  const result = runReleaseInspection().then(
    () => ({ ok: true as const }),
    (error: unknown) => ({ ok: false as const, error })
  )
  await Promise.resolve()
  await Promise.resolve()
  expect(mocks.fork).toHaveBeenCalledOnce()
  worker.emit('spawn')
  return { root, requestId, worker, result }
}
it('holds the profile lock after the response until the Utility process actually exits', async () => {
  const value = await begin()
  value.worker.emit('message', {
    ok: true,
    requestId: value.requestId,
    result: { schemaVersions: { installation: 43, campaign: 43 } }
  })
  expect(value.worker.kill).toHaveBeenCalledOnce()
  expect(mocks.release).not.toHaveBeenCalled()
  expect(
    existsSync(join(value.root, 'reports', value.requestId + '.json'))
  ).toBe(false)
  value.worker.emit('exit', 0)
  expect(await value.result).toEqual({ ok: true })
  expect(mocks.release).toHaveBeenCalledOnce()
  expect(
    existsSync(join(value.root, 'reports', value.requestId + '.json'))
  ).toBe(true)
})
it('rejects an unrelated response and still holds the lock until exit', async () => {
  const value = await begin()
  value.worker.emit('message', {
    ok: true,
    requestId: '22222222-2222-4222-8222-222222222222',
    result: {}
  })
  expect(mocks.release).not.toHaveBeenCalled()
  value.worker.emit('exit', 0)
  expect(await value.result).toMatchObject({ ok: false })
  expect(mocks.release).toHaveBeenCalledOnce()
  expect(
    existsSync(join(value.root, 'reports', value.requestId + '.json'))
  ).toBe(false)
})
it('fails on an exit without evidence', async () => {
  const value = await begin()
  value.worker.emit('exit', 1)
  expect(await value.result).toMatchObject({ ok: false })
  expect(mocks.release).toHaveBeenCalledOnce()
})
it('terminates a timed-out worker without releasing the profile before its exit', async () => {
  vi.useFakeTimers()
  const value = await begin()
  await vi.advanceTimersByTimeAsync(120_000)
  expect(value.worker.kill).toHaveBeenCalledOnce()
  expect(mocks.release).not.toHaveBeenCalled()
  value.worker.emit('exit', 1)
  expect(await value.result).toMatchObject({ ok: false })
  expect(mocks.release).toHaveBeenCalledOnce()
})
