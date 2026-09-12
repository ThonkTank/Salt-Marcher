import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { inspectReleaseFile } from './bundle.js'

/** Preserve only bounded inspection pairs, never recursively copy profiles or AppImage extraction trees. */
export function retainRuntimeLogs(caseRoot: string, destination: string) {
  assert(!existsSync(destination), 'Runtime evidence destination must be new')
  const files = new Map<string, Buffer>()
  let total = 0
  for (const home of readdirSync(caseRoot, { withFileTypes: true })) {
    if (!home.isDirectory()) continue
    assert(
      /^[a-zA-Z0-9_-]+$/.test(home.name),
      'Unexpected qualification home name'
    )
    const directory = join(caseRoot, home.name, 'release-qualification')
    if (!existsSync(directory)) continue
    const names = readdirSync(directory)
    const reports = names.filter((name) => name.endsWith('.json'))
    const logs = names.filter((name) => name.endsWith('.log'))
    assert.equal(
      reports.length,
      logs.length,
      'Incomplete runtime report/log pairs'
    )
    for (const name of reports) {
      assert(
        /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.json$/.test(name),
        'Invalid runtime report name'
      )
      const id = name.slice(0, -5)
      assert(logs.includes(`${id}.log`), 'Missing runtime log')
      for (const filename of [name, `${id}.log`]) {
        const bytes = inspectReleaseFile(
          join(directory, filename),
          8 * 1024 * 1024,
          true
        ).content
        total += bytes.length
        assert(total <= 32 * 1024 * 1024, 'Runtime evidence exceeds case limit')
        files.set(`${home.name}/release-qualification/${filename}`, bytes)
      }
    }
  }
  assert(files.size > 0, 'No release runtime inspection evidence')
  mkdirSync(destination, { recursive: true })
  for (const [name, bytes] of files) {
    const path = join(destination, name)
    mkdirSync(join(destination, name.slice(0, name.lastIndexOf('/'))), {
      recursive: true
    })
    writeFileSync(path, bytes, { flag: 'wx' })
    assert(
      inspectReleaseFile(path, bytes.length, true).content.equals(bytes),
      'Retained runtime evidence changed'
    )
  }
}
