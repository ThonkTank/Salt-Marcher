import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { HistoricalProcessTracker } from '../../scripts/qualification/historical-process-tracker.js'
const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'salt-proc-'))
  roots.push(root)
  const put = (
    pid: number,
    parent: number,
    started: number,
    env = '',
    state = 'S'
  ) => {
    const path = join(root, String(pid))
    mkdirSync(path, { recursive: true })
    const fields = [
      state,
      String(parent),
      ...Array<string>(17).fill('0'),
      String(started)
    ]
    writeFileSync(
      join(path, 'stat'),
      `${pid} (name with ) spaces) ${fields.join(' ')}`
    )
    writeFileSync(join(path, 'environ'), env)
  }
  return { root, put, tracker: new HistoricalProcessTracker(root) }
}
it('retains an explicitly owned launcher and descendants without environment markers', () => {
  const { put, tracker } = fixture()
  put(10, 1, 100)
  tracker.track(10)
  put(11, 10, 101)
  expect(tracker.scan('/test')).toEqual([10, 11])
  put(10, 1, 100, '', 'Z')
  put(11, 1, 101)
  expect(tracker.scan('/test')).toEqual([11])
})
it('retains an observed marker after its environment disappears', () => {
  const { put, tracker } = fixture()
  put(20, 1, 200, 'XDG_DATA_HOME=/test\0')
  put(21, 20, 201)
  expect(tracker.scan('/test')).toEqual([20, 21])
  put(20, 1, 200)
  expect(tracker.scan('/test')).toEqual([20, 21])
})
it('does not adopt reused PIDs or their unrelated children', () => {
  const { put, tracker } = fixture()
  put(30, 1, 300)
  tracker.track(30)
  put(30, 1, 400)
  put(31, 30, 401)
  expect(tracker.scan('/test')).toEqual([])
})
it('requires an exact marker and excludes terminated processes', () => {
  const { put, tracker } = fixture()
  put(40, 1, 400, 'XDG_DATA_HOME=/test-other\0')
  put(41, 1, 401, 'XDG_DATA_HOME=/test\0', 'Z')
  expect(tracker.scan('/test')).toEqual([])
})
