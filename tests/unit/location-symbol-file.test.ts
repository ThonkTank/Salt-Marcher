import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readLocationSymbolFile } from '../../src/main/application-lifecycle/location-symbol-file.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function root(): string {
  const value = mkdtempSync(join(tmpdir(), 'salt-marcher-svg-file-'))
  roots.push(value)
  return value
}

describe('bounded location symbol file selection', () => {
  it('returns only the bounded source and base name of an SVG file', async () => {
    const directory = root()
    const file = join(directory, 'zeichen.svg')
    const source = '<svg viewBox="0 0 1 1"><path d="M0 0Z"/></svg>'
    writeFileSync(file, source)
    await expect(readLocationSymbolFile(file)).resolves.toEqual({
      status: 'selected',
      fileName: 'zeichen.svg',
      source
    })
  })

  it('rejects wrong types, directories, oversized and unreadable paths', async () => {
    const directory = root()
    const text = join(directory, 'zeichen.txt')
    const nested = join(directory, 'ordner.svg')
    const oversized = join(directory, 'gross.svg')
    writeFileSync(text, '<svg/>')
    mkdirSync(nested)
    writeFileSync(oversized, 'x'.repeat(262_145))
    await expect(readLocationSymbolFile(text)).resolves.toMatchObject({
      status: 'rejected',
      reason: 'not_svg'
    })
    await expect(readLocationSymbolFile(nested)).resolves.toMatchObject({
      status: 'rejected',
      reason: 'not_svg'
    })
    await expect(readLocationSymbolFile(oversized)).resolves.toMatchObject({
      status: 'rejected',
      reason: 'too_large'
    })
    await expect(
      readLocationSymbolFile(join(directory, 'fehlt.svg'))
    ).resolves.toMatchObject({ status: 'rejected', reason: 'read_failed' })
  })
})
