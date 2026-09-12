import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, expect, it } from 'vitest'
import { retainRuntimeLogs } from '../../scripts/release/retain-runtime-logs.js'
const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
const id = '11111111-1111-4111-8111-111111111111'
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'retain-runtime-'))
  roots.push(root)
  const source = join(root, 'case'),
    destination = join(root, 'retained'),
    directory = join(source, 'home/release-qualification')
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, `${id}.json`), '{"runtime":"original"}')
  writeFileSync(join(directory, `${id}.log`), 'original log\n')
  return { source, destination, directory }
}
it('retains exact report/log bytes before disposable profile cleanup', () => {
  const v = fixture()
  retainRuntimeLogs(v.source, v.destination)
  rmSync(v.source, { recursive: true })
  expect(
    readFileSync(
      join(v.destination, 'home/release-qualification', `${id}.log`),
      'utf8'
    )
  ).toBe('original log\n')
  expect(
    readFileSync(
      join(v.destination, 'home/release-qualification', `${id}.json`),
      'utf8'
    )
  ).toBe('{"runtime":"original"}')
})
it.each([
  'missing-log',
  'orphan-log',
  'symlink',
  'too-large',
  'existing-output'
] as const)('rejects %s evidence', (field) => {
  const v = fixture()
  if (field === 'missing-log') rmSync(join(v.directory, `${id}.log`))
  if (field === 'orphan-log')
    writeFileSync(join(v.directory, 'extra.log'), 'orphan')
  if (field === 'symlink') {
    rmSync(join(v.directory, `${id}.log`))
    symlinkSync(join(v.directory, `${id}.json`), join(v.directory, `${id}.log`))
  }
  if (field === 'too-large')
    writeFileSync(
      join(v.directory, `${id}.log`),
      Buffer.alloc(8 * 1024 * 1024 + 1)
    )
  if (field === 'existing-output') mkdirSync(v.destination)
  expect(() => retainRuntimeLogs(v.source, v.destination)).toThrow()
  expect(readFileSync(join(v.directory, `${id}.json`), 'utf8')).toBe(
    '{"runtime":"original"}'
  )
})
