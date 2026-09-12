import assert from 'node:assert/strict'
import { createWriteStream, existsSync, renameSync, rmSync } from 'node:fs'
import { Transform } from 'node:stream'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { randomUUID } from 'node:crypto'
import { inspectReleaseFile } from './bundle.js'

export const qualificationEnvironment = {
  formatVersion: 1,
  base: {
    name: 'noble-server-cloudimg-amd64.img',
    url: 'https://cloud-images.ubuntu.com/noble/20260911/noble-server-cloudimg-amd64.img',
    bytes: 625256960,
    sha256: '612b2c0cc1bc413a6cb8c38fd611794caf0f2b436c50013d8b3794db12ad7354'
  },
  node: {
    name: 'node-v22.23.2-linux-x64.tar.xz',
    directory: 'node-v22.23.2-linux-x64',
    url: 'https://nodejs.org/dist/v22.23.2/node-v22.23.2-linux-x64.tar.xz',
    bytes: 31058332,
    sha256: 'd60acfe00a2932254bb0ad20e01b0d74397a0875595de719654b214f4b03f307'
  }
} as const

export function verifyEnvironmentFile(
  path: string,
  expected: { bytes: number; sha256: string }
) {
  const actual = inspectReleaseFile(path, expected.bytes, false)
  assert.equal(
    actual.bytes,
    expected.bytes,
    'Incomplete qualification environment file'
  )
  assert.equal(
    actual.sha256,
    expected.sha256,
    'Qualification environment bytes changed'
  )
}

export async function acquireEnvironmentFile(
  path: string,
  expected: { url: string; bytes: number; sha256: string }
) {
  if (existsSync(path)) {
    verifyEnvironmentFile(path, expected)
    return
  }
  const temporary = `${path}.${randomUUID()}.download`
  try {
    const response = await fetch(expected.url, {
      redirect: 'error',
      signal: AbortSignal.timeout(300_000)
    })
    assert(
      response.ok && response.body,
      'Qualification environment download failed'
    )
    const length = response.headers.get('content-length')
    if (length !== null)
      assert.equal(
        Number(length),
        expected.bytes,
        'Unexpected environment download size'
      )
    let received = 0
    const bound = new Transform({
      transform(chunk: Buffer, _encoding, next) {
        received += chunk.length
        next(
          received > expected.bytes
            ? new Error('Environment download exceeds bounds')
            : null,
          chunk
        )
      }
    })
    const body = response.body
    async function* chunks() {
      const reader = body.getReader()
      try {
        for (;;) {
          const next = await reader.read()
          if (next.done) return
          yield next.value
        }
      } finally {
        await reader.cancel()
        reader.releaseLock()
      }
    }
    await pipeline(
      Readable.from(chunks()),
      bound,
      createWriteStream(temporary, { flags: 'wx' })
    )
    verifyEnvironmentFile(temporary, expected)
    assert(
      !existsSync(path),
      'Environment destination appeared during download'
    )
    renameSync(temporary, path)
  } finally {
    rmSync(temporary, { force: true })
  }
}
