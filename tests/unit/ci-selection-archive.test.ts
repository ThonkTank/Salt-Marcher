import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { deflateRawSync } from 'node:zlib'
import { expect, it } from 'vitest'
import { z } from 'zod'
import { readSelectionArchive } from '../../scripts/ci-selection-archive.js'

const original = z
  .object({ size_in_bytes: z.number(), digest: z.string(), base64: z.string() })
  .parse(
    JSON.parse(readFileSync('tests/fixtures/ci-selection-archive.json', 'utf8'))
  )
const bytes = () => Buffer.from(original.base64, 'base64')
const metadata = (archive: Buffer) => ({
  size_in_bytes: archive.length,
  digest: `sha256:${createHash('sha256').update(archive).digest('hex')}`
})

it('reads the unchanged original GitHub selection ZIP without extracting it', () => {
  expect(readSelectionArchive(bytes(), original)).toMatchObject({
    baseSha: '4aa710b407ff6f4980b8da4fe7bf913fbee45370',
    headSha: 'a176137082240a26e7e2a828bc6d9de55bf4e49e',
    mode: 'full',
    requiresLocalArtifact: true
  })
})

it('rejects bytes differing from the run-scoped size or digest', () => {
  expect(() =>
    readSelectionArchive(bytes(), { ...original, size_in_bytes: 1 })
  ).toThrow(/size/)
  const altered = bytes()
  altered[60] = 0
  expect(() => readSelectionArchive(altered, original)).toThrow(/digest/)
})

it.each([
  'foreign-name',
  'symlink',
  'oversized',
  'duplicate',
  'crc',
  'descriptor'
] as const)(
  'rejects %s even when the archive digest matches its metadata',
  (kind) => {
    const archive = bytes()
    const end = archive.length - 22
    const central = archive.readUInt32LE(end + 16)
    if (kind === 'foreign-name') archive[central + 46] = 120
    if (kind === 'symlink')
      archive.writeUInt32LE((0xa1ff << 16) >>> 0, central + 38)
    if (kind === 'oversized')
      archive.writeUInt32LE(1024 * 1024 + 1, central + 24)
    if (kind === 'duplicate') archive.writeUInt16LE(2, end + 10)
    if (kind === 'crc') {
      archive.writeUInt32LE(0, central + 16)
      archive.writeUInt32LE(0, central - 12)
    }
    if (kind === 'descriptor') archive.writeUInt32LE(0, central - 16)
    expect(() => readSelectionArchive(archive, metadata(archive))).toThrow()
  }
)

it('caps decompression independently of dishonest uncompressed-size fields', () => {
  const originalBytes = bytes()
  const centralOffset = originalBytes.readUInt32LE(originalBytes.length - 6)
  const prefix = originalBytes.subarray(0, 52)
  const compressed = deflateRawSync(Buffer.alloc(1024 * 1024 + 1, 32))
  const descriptor = Buffer.from(
    originalBytes.subarray(centralOffset - 16, centralOffset)
  )
  const directory = Buffer.from(
    originalBytes.subarray(centralOffset, originalBytes.length - 22)
  )
  const end = Buffer.from(originalBytes.subarray(-22))
  descriptor.writeUInt32LE(compressed.length, 8)
  directory.writeUInt32LE(compressed.length, 20)
  end.writeUInt32LE(prefix.length + compressed.length + descriptor.length, 16)
  const archive = Buffer.concat([
    prefix,
    compressed,
    descriptor,
    directory,
    end
  ])
  expect(() => readSelectionArchive(archive, metadata(archive))).toThrow()
})
