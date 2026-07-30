import {
  closeSync,
  fsyncSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  statfsSync,
  writeFileSync,
  writeSync
} from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { arch, availableParallelism, freemem, platform, release } from 'node:os'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { performance } from 'node:perf_hooks'
import {
  rpHCalibrationPasses,
  type RpHCalibration
} from '../src/shared/qualification/render-evidence.js'

const MEBIBYTE = 1024 * 1024
const GIBIBYTE = 1024 * MEBIBYTE
const fileBytes = 64 * MEBIBYTE
const blockBytes = 4096
let splitMixState = 23072026n

const args = new Map<string, string>()
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (key === undefined || value === undefined || !key.startsWith('--')) usage()
  args.set(key.slice(2), value)
}
const output = args.get('output')
if (output === undefined) usage()

const calibrationDirectory = mkdtempSync(join(tmpdir(), 'salt-marcher-rp-h-'))
try {
  const calibration: Omit<RpHCalibration, 'passes'> = {
    implementationRevision: createHash('sha256')
      .update(readFileSync(new URL(import.meta.url)))
      .digest('hex'),
    operatingSystem: `${platform()} ${release()}`,
    architecture: arch(),
    powerMode: args.get('power-mode') ?? 'unknown',
    freeSpaceGiB: freeSpaceGiB(calibrationDirectory),
    logicalCpuCores: availableParallelism(),
    memoryAvailableGiB: freemem() / GIBIBYTE,
    dedicatedGpu: booleanArgument('dedicated-gpu'),
    serverClassHardware: booleanArgument('server-class-hardware'),
    cpu: {
      scheduling: cpuProbe('scheduling', 100_000),
      spatial: cpuProbe('spatial', 2_000_000)
    },
    storage: storageProbe(calibrationDirectory)
  }
  const evidence = {
    ...calibration,
    passes: rpHCalibrationPasses(calibration as RpHCalibration)
  }
  writeFileSync(resolve(output), `${JSON.stringify(evidence, null, 2)}\n`)
  console.log(
    `RP-H calibration ${evidence.passes ? 'passed' : 'failed'}: ${output}`
  )
} finally {
  rmSync(calibrationDirectory, { recursive: true, force: true })
}

function usage(): never {
  console.error(
    'Usage: pnpm qualify:rp-h --output <calibration.json> [--power-mode <mode>] [--dedicated-gpu true|false] [--server-class-hardware true|false] [--filesystem <name>] [--storage-device <name>] [--cache-state <state>]'
  )
  process.exit(1)
}

function booleanArgument(name: string): boolean {
  const value = args.get(name)
  if (value === 'true') return true
  if (value === 'false') return false
  // Hardware class cannot be inferred portably. Unknown is deliberately
  // conservative: it prevents a pass until the operator records the fact.
  return true
}

function freeSpaceGiB(path: string): number {
  const stats = statfsSync(path)
  return (Number(stats.bavail) * Number(stats.bsize)) / GIBIBYTE
}

function cpuProbe(
  kind: 'scheduling' | 'spatial',
  records: number
): {
  records: number
  elapsedMs: number
  sha256: string
} {
  const started = performance.now()
  const child = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', cpuProbeProgram(kind, records)],
    { encoding: 'utf8' }
  )
  if (child.status !== 0) throw new Error(child.stderr || 'CPU probe failed')
  return {
    records,
    elapsedMs: performance.now() - started,
    sha256: child.stdout.trim()
  }
}

function cpuProbeProgram(
  kind: 'scheduling' | 'spatial',
  records: number
): string {
  const line =
    kind === 'scheduling'
      ? '`${index},scene=${index % 10},period=${Math.floor(index / 10)}\\n`'
      : '`${index},q=${index % 2000},r=${Math.floor(index / 2000)}\\n`'
  return `import { createHash } from 'node:crypto'; const hash = createHash('sha256'); for (let index = 1; index <= ${records}; index += 1) hash.update(${line}); process.stdout.write(hash.digest('hex'));`
}

function storageProbe(directory: string): RpHCalibration['storage'] {
  const path = join(directory, 'storage-calibration.bin')
  const sequential = deterministicBuffer(fileBytes)
  const descriptor = openSync(path, 'w+')
  try {
    const writeStarted = performance.now()
    writeAll(descriptor, sequential, 0)
    fsyncSync(descriptor)
    const sequentialWriteBytesPerSecond =
      (fileBytes * 1000) / (performance.now() - writeStarted)
    const readBuffer = Buffer.allocUnsafe(fileBytes)
    const readStarted = performance.now()
    readAll(descriptor, readBuffer, 0)
    const sequentialReadBytesPerSecond =
      (fileBytes * 1000) / (performance.now() - readStarted)
    const offsets = nonOverlappingOffsets(200, fileBytes / blockBytes)
    const block = deterministicBuffer(blockBytes)
    const durableRandomWriteMs = offsets.map((offset) => {
      const started = performance.now()
      writeAll(descriptor, block, offset * blockBytes)
      fsyncSync(descriptor)
      return performance.now() - started
    })
    const randomReadMs = Array.from({ length: 1000 }, () => {
      const started = performance.now()
      readAll(
        descriptor,
        block,
        Number(nextRandom() % BigInt(fileBytes / blockBytes)) * blockBytes
      )
      return performance.now() - started
    })
    return {
      filesystem: args.get('filesystem') ?? 'unknown',
      storageDevice: args.get('storage-device') ?? 'unknown',
      cacheState: args.get('cache-state') ?? 'unknown',
      fileBytes,
      randomAlgorithm: 'splitmix64-v1',
      randomSeed: 23072026,
      sequentialWriteBytesPerSecond,
      sequentialReadBytesPerSecond,
      durableRandomWriteMs,
      randomReadMs
    }
  } finally {
    closeSync(descriptor)
  }
}

function writeAll(descriptor: number, buffer: Buffer, position: number): void {
  let written = 0
  while (written < buffer.length) {
    const count = writeSync(
      descriptor,
      buffer,
      written,
      buffer.length - written,
      position + written
    )
    if (count === 0)
      throw new Error('Storage calibration write made no progress')
    written += count
  }
}

function readAll(descriptor: number, buffer: Buffer, position: number): void {
  let read = 0
  while (read < buffer.length) {
    const count = readSync(
      descriptor,
      buffer,
      read,
      buffer.length - read,
      position + read
    )
    if (count === 0) throw new Error('Storage calibration read ended early')
    read += count
  }
}

function nextRandom(): bigint {
  splitMixState = BigInt.asUintN(64, splitMixState + 0x9e3779b97f4a7c15n)
  let value = splitMixState
  value = BigInt.asUintN(64, (value ^ (value >> 30n)) * 0xbf58476d1ce4e5b9n)
  value = BigInt.asUintN(64, (value ^ (value >> 27n)) * 0x94d049bb133111ebn)
  return BigInt.asUintN(64, value ^ (value >> 31n))
}

function nonOverlappingOffsets(count: number, blocks: number): number[] {
  const selected = new Set<number>()
  while (selected.size < count)
    selected.add(Number(nextRandom() % BigInt(blocks)))
  return [...selected]
}

function deterministicBuffer(length: number): Buffer {
  const digest = createHash('sha256')
    .update('salt-marcher-rp-h-calibration')
    .digest()
  const output = Buffer.allocUnsafe(length)
  for (let offset = 0; offset < output.length; offset += digest.length)
    digest.copy(
      output,
      offset,
      0,
      Math.min(digest.length, output.length - offset)
    )
  return output
}
