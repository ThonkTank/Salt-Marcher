import { createHash } from 'node:crypto'
import { crc32, inflateRawSync } from 'node:zlib'
import {
  ciRiskSelectionSchema,
  type CiRiskSelection
} from './ci-risk-selection.js'

/** Deliberately accepts only the single, small receipt ZIP emitted by this workflow. */
export function readSelectionArchive(
  archive: Buffer,
  expected: Readonly<{ size_in_bytes: number; digest: string }>
): CiRiskSelection {
  const fail = (message: string): never => {
    throw new Error(`Invalid CI selection archive: ${message}`)
  }
  if (
    archive.length < 22 ||
    archive.length > 2 * 1024 * 1024 ||
    archive.length !== expected.size_in_bytes
  )
    fail('download size')
  if (
    `sha256:${createHash('sha256').update(archive).digest('hex')}` !==
    expected.digest
  )
    fail('download digest')
  const end = archive.length - 22
  if (
    archive.readUInt32LE(end) !== 0x06054b50 ||
    archive.readUInt32LE(end + 4) !== 0 ||
    archive.readUInt16LE(end + 8) !== 1 ||
    archive.readUInt16LE(end + 10) !== 1 ||
    archive.readUInt16LE(end + 20) !== 0
  )
    fail('one-entry ZIP directory required')
  const centralSize = archive.readUInt32LE(end + 12)
  const central = archive.readUInt32LE(end + 16)
  if (
    centralSize < 46 ||
    central + centralSize !== end ||
    central < 30 ||
    archive.readUInt32LE(central) !== 0x02014b50
  )
    fail('central directory bounds')
  const flags = archive.readUInt16LE(central + 8)
  const method = archive.readUInt16LE(central + 10)
  const crc = archive.readUInt32LE(central + 16)
  const compressedSize = archive.readUInt32LE(central + 20)
  const size = archive.readUInt32LE(central + 24)
  const nameSize = archive.readUInt16LE(central + 28)
  const extraSize = archive.readUInt16LE(central + 30)
  const commentSize = archive.readUInt16LE(central + 32)
  const unixType = (archive.readUInt32LE(central + 38) >>> 16) & 0xf000
  if (
    archive.readUInt16LE(central + 34) !== 0 ||
    archive.readUInt32LE(central + 42) !== 0 ||
    (unixType !== 0 && unixType !== 0x8000) ||
    (flags & ~(8 | 2048)) !== 0 ||
    ![0, 8].includes(method) ||
    size === 0 ||
    size > 1024 * 1024 ||
    compressedSize > 2 * 1024 * 1024 ||
    46 + nameSize + extraSize + commentSize !== centralSize
  )
    fail('unsupported entry or size')
  const name = archive.subarray(central + 46, central + 46 + nameSize)
  if (!name.equals(Buffer.from('ci-risk-selection.json')))
    fail('foreign entry name')
  if (
    archive.readUInt32LE(0) !== 0x04034b50 ||
    archive.readUInt16LE(6) !== flags ||
    archive.readUInt16LE(8) !== method ||
    archive.readUInt16LE(26) !== nameSize
  )
    fail('local header disagrees')
  const dataStart = 30 + nameSize + archive.readUInt16LE(28)
  const dataEnd = dataStart + compressedSize
  if (
    dataStart > central ||
    dataEnd > central ||
    !archive.subarray(30, 30 + nameSize).equals(name)
  )
    fail('entry bounds')
  if ((flags & 8) !== 0) {
    if (
      dataEnd + 16 !== central ||
      archive.readUInt32LE(dataEnd) !== 0x08074b50 ||
      archive.readUInt32LE(dataEnd + 4) !== crc ||
      archive.readUInt32LE(dataEnd + 8) !== compressedSize ||
      archive.readUInt32LE(dataEnd + 12) !== size
    )
      fail('data descriptor')
  } else if (
    dataEnd !== central ||
    archive.readUInt32LE(14) !== crc ||
    archive.readUInt32LE(18) !== compressedSize ||
    archive.readUInt32LE(22) !== size
  )
    fail('local sizes')
  const compressed = archive.subarray(dataStart, dataEnd)
  const json =
    method === 8
      ? inflateRawSync(compressed, { maxOutputLength: 1024 * 1024 })
      : compressed
  if (json.length !== size || crc32(json) !== crc) fail('uncompressed bytes')
  return ciRiskSelectionSchema.parse(JSON.parse(json.toString('utf8')))
}
