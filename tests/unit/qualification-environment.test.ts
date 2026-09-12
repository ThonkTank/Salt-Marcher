import { createServer, type Server } from 'node:http'
import {
  mkdtempSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { digestReleaseDocument } from '../../scripts/release/qualification.js'
import {
  acquireEnvironmentFile,
  verifyEnvironmentFile
} from '../../scripts/release/qualification-environment.js'
const roots: string[] = [],
  servers: Server[] = []
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
async function fixture(
  mode: 'normal' | 'oversized' | 'truncated' | 'redirect' = 'normal'
) {
  const root = mkdtempSync(join(tmpdir(), 'qualification-env-'))
  roots.push(root)
  const bytes = Buffer.from('bounded environment bytes')
  const server = createServer((_request, response) => {
    if (mode === 'redirect') {
      response.writeHead(302, { location: '/unexpected' })
      response.end()
      return
    }
    if (mode === 'normal') response.setHeader('content-length', bytes.length)
    if (mode === 'oversized') {
      response.write(bytes)
      response.end(bytes)
      return
    }
    response.end(mode === 'truncated' ? bytes.subarray(0, 3) : bytes)
  })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('No test address')
  return {
    root,
    path: join(root, 'environment.bin'),
    bytes,
    expected: {
      url: `http://127.0.0.1:${address.port}/file`,
      bytes: bytes.length,
      sha256: digestReleaseDocument(bytes)
    }
  }
}
it('downloads exact bounded bytes once and reuses only a verified cache file', async () => {
  const v = await fixture()
  await acquireEnvironmentFile(v.path, v.expected)
  expect(readFileSync(v.path)).toEqual(v.bytes)
  await acquireEnvironmentFile(v.path, {
    ...v.expected,
    url: 'https://invalid.invalid/'
  })
  expect(readdirSync(v.root)).toEqual(['environment.bin'])
})
it.each(['oversized', 'truncated', 'redirect'] as const)(
  'rejects %s downloads without leaving a usable cache entry',
  async (mode) => {
    const v = await fixture(mode)
    await expect(acquireEnvironmentFile(v.path, v.expected)).rejects.toThrow()
    expect(existsSync(v.path)).toBe(false)
    expect(readdirSync(v.root)).toEqual([])
  }
)
it('rejects a wrong digest and preserves an invalid pre-existing cache file', async () => {
  const v = await fixture()
  await expect(
    acquireEnvironmentFile(v.path, { ...v.expected, sha256: 'a'.repeat(64) })
  ).rejects.toThrow()
  expect(readdirSync(v.root)).toEqual([])
  writeFileSync(v.path, 'previous invalid cache')
  await expect(acquireEnvironmentFile(v.path, v.expected)).rejects.toThrow()
  expect(readFileSync(v.path, 'utf8')).toBe('previous invalid cache')
})
it('rejects symlinked environment files', async () => {
  const v = await fixture()
  writeFileSync(join(v.root, 'original'), v.bytes)
  symlinkSync(join(v.root, 'original'), v.path)
  expect(() => verifyEnvironmentFile(v.path, v.expected)).toThrow()
})
