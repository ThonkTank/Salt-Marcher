import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'

export function treeBytes(root: string): number {
  if (!existsSync(root)) return 0
  const stats = lstatSync(root)
  if (stats.isSymbolicLink())
    throw new Error(`Symbolic links are not owned storage: ${root}`)
  if (stats.isFile()) return stats.size
  if (!stats.isDirectory())
    throw new Error(`Unsupported owned storage entry: ${root}`)
  return readdirSync(root).reduce(
    (total, name) => total + treeBytes(join(root, name)),
    0
  )
}

export function directDirectoryNames(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root).sort((left, right) =>
    left.localeCompare(right, 'en')
  )
}

export function syncDirectory(path: string): void {
  const descriptor = openSync(path, 'r')
  try {
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}

export function atomicWrite(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.next`
  const descriptor = openSync(temporary, 'wx', 0o600)
  try {
    writeFileSync(descriptor, content)
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
  renameSync(temporary, path)
  syncDirectory(dirname(path))
}

export function fileBytes(path: string): number {
  return statSync(path).size
}
