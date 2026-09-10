import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { Parser } from 'tar'

const digest = (bytes: Buffer) =>
  createHash('sha256').update(bytes).digest('hex')
const limit = 64 * 1024 * 1024

export async function decodeVmEvidence(serial: string) {
  assert(
    Buffer.byteLength(serial) <= limit,
    'Serial evidence exceeds size limit'
  )
  const starts = serial.match(/QUALIFICATION_EXPORT_BEGIN/g) ?? []
  const ends = serial.match(/QUALIFICATION_EXPORT_END/g) ?? []
  assert(
    starts.length > 0 && starts.length === ends.length,
    'Incomplete evidence export'
  )
  const blocks = [
    ...serial.matchAll(
      /QUALIFICATION_EXPORT_BEGIN([\s\S]*?)QUALIFICATION_EXPORT_END/g
    )
  ]
  assert.equal(blocks.length, starts.length, 'Malformed evidence markers')
  const exports = []
  for (const block of blocks) {
    const encoded = block[1]!
      .split(/\r?\n/)
      .map((line) =>
        line.replace(/^\[\s*[\d.]+\]\s+cloud-init\[\d+\]:\s*/, '').trim()
      )
      .filter((line) => /^[A-Za-z0-9+/]+={0,2}$/.test(line))
      .join('')
    const archive = Buffer.from(encoded, 'base64')
    assert.equal(archive.toString('base64'), encoded, 'Invalid base64 evidence')
    const raw = gunzipSync(archive, { maxOutputLength: limit })
    const reports = new Map<string, Buffer>()
    await new Promise<void>((resolve, reject) => {
      const parser = new Parser({
        strict: true,
        onReadEntry(entry) {
          if (
            entry.type !== 'File' ||
            !/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*\.json$/.test(entry.path) ||
            entry.path
              .split('/')
              .some((part) => part === '.' || part === '..') ||
            reports.has(entry.path)
          ) {
            reject(new Error('Unsafe or duplicate evidence entry'))
            entry.resume()
            return
          }
          const parts: Buffer[] = []
          reports.set(entry.path, Buffer.alloc(0))
          entry.on('data', (chunk: Buffer) => parts.push(chunk))
          entry.on('end', () => {
            try {
              const bytes = Buffer.concat(parts)
              const value: unknown = JSON.parse(bytes.toString('utf8'))
              assert(
                value !== null &&
                  typeof value === 'object' &&
                  !Array.isArray(value),
                'Report must be a JSON object'
              )
              reports.set(entry.path, bytes)
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)))
            }
          })
          entry.on('error', reject)
        }
      })
      parser.on('error', reject)
      parser.on('end', resolve)
      parser.end(raw)
    })
    assert(reports.size > 0, 'Empty evidence export')
    exports.push({ archive, reports })
  }
  return exports
}

/** Archives transport-valid reports; their acceptance invariants still require review. */
export async function archiveVmEvidence(
  runDirectory: string,
  destination: string
) {
  const source = realpathSync(runDirectory)
  const output = join(
    realpathSync(dirname(resolve(destination))),
    resolve(destination).split(sep).at(-1)!
  )
  const fromSource = relative(source, output)
  assert(
    fromSource.startsWith(`..${sep}`),
    'Evidence destination must be outside the VM directory'
  )
  assert(!existsSync(output), 'Evidence destination already exists')
  const exitText = readFileSync(join(source, 'exit-code'), 'utf8').trim()
  assert(/^\d+$/.test(exitText), 'Missing terminal VM exit code')
  const serial = readFileSync(join(source, 'serial.log'), 'utf8')
  const exports = await decodeVmEvidence(serial)
  const files: { path: string; bytes: number; sha256: string }[] = []
  mkdirSync(output)
  const write = (path: string, bytes: Buffer) => {
    mkdirSync(dirname(join(output, path)), { recursive: true })
    writeFileSync(join(output, path), bytes, { flag: 'wx' })
    files.push({ path, bytes: bytes.length, sha256: digest(bytes) })
  }
  for (const [index, item] of exports.entries()) {
    write(`export-${index}/original.tar.gz`, item.archive)
    for (const [path, bytes] of item.reports)
      write(`export-${index}/reports/${path}`, bytes)
  }
  const manifest = {
    formatVersion: 1,
    evidence: 'transport-integrity-only-semantic-acceptance-not-verified',
    source,
    vmExitCode: Number(exitText),
    testExitCodes: [...serial.matchAll(/QUALIFICATION_TEST_EXIT=(\d+)/g)].map(
      (match) => Number(match[1])
    ),
    serialSha256: digest(Buffer.from(serial)),
    files
  }
  writeFileSync(
    join(output, 'archive-manifest.json'),
    JSON.stringify(manifest, null, 2),
    { flag: 'wx' }
  )
  return manifest
}
