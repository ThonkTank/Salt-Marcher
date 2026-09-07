import { createHash, randomUUID } from 'node:crypto'
import {
  closeSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  readdirSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, relative } from 'node:path'

export function syncPath(path: string): void {
  const fd = openSync(path, 'r')
  try {
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
}
export function durableJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  writeFileSync(temporary, `${JSON.stringify(value)}\n`, {
    mode: 0o600,
    flag: 'wx'
  })
  syncPath(temporary)
  renameSync(temporary, path)
  syncPath(dirname(path))
}
export function sha256(path: string): string {
  const fd = openSync(path, 'r')
  const hash = createHash('sha256')
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  try {
    for (;;) {
      const bytes = readSync(fd, buffer, 0, buffer.length, null)
      if (bytes === 0) break
      hash.update(buffer.subarray(0, bytes))
    }
    return hash.digest('hex')
  } finally {
    closeSync(fd)
  }
}
export function inventory(
  root: string
): Array<{ path: string; bytes: number; sha256: string }> {
  const files: Array<{ path: string; bytes: number; sha256: string }> = []
  function visit(path: string) {
    const stat = lstatSync(path)
    if (stat.isSymbolicLink())
      throw new Error('Verknüpfungen sind in Profildaten nicht erlaubt.')
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) visit(join(path, name))
    } else if (stat.isFile())
      files.push({
        path: relative(root, path),
        bytes: stat.size,
        sha256: sha256(path)
      })
    else throw new Error('Unbekannter Dateityp im Profil.')
  }
  visit(root)
  return files
}
export function syncTree(root: string): void {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) syncTree(path)
    else syncPath(path)
  }
  syncPath(root)
}
