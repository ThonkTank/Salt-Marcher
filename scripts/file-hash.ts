import { createHash } from 'node:crypto'
import { closeSync, openSync, readSync } from 'node:fs'

export function sha256File(path: string): string {
  const hash = createHash('sha256')
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  const descriptor = openSync(path, 'r')
  try {
    for (;;) {
      const bytesRead = readSync(descriptor, buffer, 0, buffer.length, null)
      if (bytesRead === 0) break
      hash.update(buffer.subarray(0, bytesRead))
    }
    return hash.digest('hex')
  } finally {
    closeSync(descriptor)
  }
}
