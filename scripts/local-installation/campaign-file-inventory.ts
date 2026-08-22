import { createHash } from 'node:crypto'
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readSync,
  readdirSync,
  statSync,
  writeSync
} from 'node:fs'
import { join, relative, sep } from 'node:path'
import { sha256File } from '../file-hash.js'
import { LocalInstallationError } from './contract.js'

export interface FileHash {
  readonly path: string
  readonly bytes: number
  readonly sha256: string
}

export function hashTree(root: string): FileHash[] {
  return treeFiles(root).map((path) => ({
    path: relative(root, path).split(sep).join('/'),
    bytes: statSync(path).size,
    sha256: sha256File(path)
  }))
}

export function hashTreeOrEmpty(root: string): FileHash[] {
  return existsSync(root) ? hashTree(root) : []
}

export function durableCampaignFileInventory(
  files: readonly FileHash[]
): FileHash[] {
  return files.filter(
    ({ path, bytes }) =>
      !path.endsWith('-shm') && !(path.endsWith('-wal') && bytes === 0)
  )
}

export function hashFileInventory(files: readonly FileHash[]): string {
  return createHash('sha256').update(JSON.stringify(files)).digest('hex')
}

/** Copies and hashes each source byte in the same pass; verification rereads only the backup. */
export function copyTreeWithHashes(
  sourceRoot: string,
  targetRoot: string
): FileHash[] {
  mkdirSync(targetRoot, { recursive: false })
  const hashes: FileHash[] = []
  copyDirectory(sourceRoot, targetRoot, sourceRoot, hashes)
  syncPath(targetRoot)
  return hashes.sort((left, right) => left.path.localeCompare(right.path, 'en'))
}

export function directoryHasEntries(path: string): boolean {
  return existsSync(path) && readdirSync(path).length > 0
}

function copyDirectory(
  sourceDirectory: string,
  targetDirectory: string,
  sourceRoot: string,
  hashes: FileHash[]
): void {
  for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
    const source = join(sourceDirectory, entry.name)
    const target = join(targetDirectory, entry.name)
    if (entry.isSymbolicLink())
      throw new LocalInstallationError(
        'data-corrupt',
        `Campaign data must not contain symbolic links: ${source}`
      )
    if (entry.isDirectory()) {
      mkdirSync(target)
      copyDirectory(source, target, sourceRoot, hashes)
      syncPath(target)
      continue
    }
    if (!entry.isFile())
      throw new LocalInstallationError(
        'data-corrupt',
        `Unsupported campaign data entry: ${source}`
      )
    hashes.push(copyFileWithHash(source, target, sourceRoot))
  }
}

function copyFileWithHash(
  source: string,
  target: string,
  sourceRoot: string
): FileHash {
  const before = statSync(source)
  const input = openSync(source, 'r')
  const output = openSync(target, 'wx', before.mode & 0o777)
  const digest = createHash('sha256')
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  let bytes = 0
  try {
    for (;;) {
      const count = readSync(input, buffer, 0, buffer.length, null)
      if (count === 0) break
      digest.update(buffer.subarray(0, count))
      let written = 0
      while (written < count)
        written += writeSync(output, buffer, written, count - written)
      bytes += count
    }
    fsyncSync(output)
  } finally {
    closeSync(output)
    closeSync(input)
  }
  const after = statSync(source)
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
    throw new Error(`Campaign data changed while it was copied: ${source}`)
  return {
    path: relative(sourceRoot, source).split(sep).join('/'),
    bytes,
    sha256: digest.digest('hex')
  }
}

function treeFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isSymbolicLink())
      throw new LocalInstallationError(
        'data-corrupt',
        `Campaign data must not contain symbolic links: ${path}`
      )
    if (entry.isDirectory()) files.push(...treeFiles(path))
    else if (entry.isFile()) files.push(path)
    else
      throw new LocalInstallationError(
        'data-corrupt',
        `Unsupported campaign data entry: ${path}`
      )
  }
  return files.sort((left, right) => left.localeCompare(right, 'en'))
}

function syncPath(path: string): void {
  const descriptor = openSync(path, 'r')
  try {
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}
