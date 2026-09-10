import { afterEach, expect, it } from 'vitest'
import { Header } from 'tar'
import { gzipSync } from 'node:zlib'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  archiveVmEvidence,
  decodeVmEvidence
} from '../../scripts/qualification/vm-evidence.js'

const roots: string[] = []
afterEach(() => {
  for (const path of roots.splice(0))
    rmSync(path, { recursive: true, force: true })
})
function archive(
  path = 'home/ui-update-evidence.json',
  duplicate = false,
  link = false
) {
  const data = Buffer.from('{"formatVersion":1,"coverage":"fixture"}')
  const header = new Header({
    path,
    size: link ? 0 : data.length,
    type: link ? 'SymbolicLink' : 'File',
    ...(link ? { linkpath: '/etc/passwd' } : {})
  })
  header.encode()
  const entry = link
    ? header.block!
    : Buffer.concat([header.block!, data, Buffer.alloc(512 - data.length)])
  return gzipSync(
    Buffer.concat([entry, ...(duplicate ? [entry] : []), Buffer.alloc(1024)])
  )
}
function serial(bytes = archive()) {
  return `QUALIFICATION_TEST_EXIT=0\nQUALIFICATION_EXPORT_BEGIN\n${bytes.toString('base64')}\nQUALIFICATION_EXPORT_END\n`
}
it('preserves valid reports and original export outside the disposable run', async () => {
  const root = mkdtempSync(join(tmpdir(), 'vm-evidence-'))
  roots.push(root)
  const run = join(root, 'run')
  mkdirSync(run)
  writeFileSync(join(run, 'exit-code'), '0\n')
  writeFileSync(join(run, 'serial.log'), serial())
  const output = join(root, 'retained')
  const manifest = await archiveVmEvidence(run, output)
  expect(manifest.testExitCodes).toEqual([0])
  expect(manifest.evidence).toContain('semantic-acceptance-not-verified')
  expect(manifest.files).toHaveLength(2)
  expect(readFileSync(join(output, 'export-0/original.tar.gz'))).toEqual(
    archive()
  )
  expect(readFileSync(join(run, 'serial.log'), 'utf8')).toEqual(serial())
  await expect(archiveVmEvidence(run, output)).rejects.toThrow('already exists')
  await expect(archiveVmEvidence(run, join(run, 'bad'))).rejects.toThrow(
    'outside'
  )
})
it('rejects missing completion markers', async () => {
  await expect(
    decodeVmEvidence(serial().replace('QUALIFICATION_EXPORT_END', ''))
  ).rejects.toThrow('Incomplete')
})
it('rejects a gzip checksum mismatch', async () => {
  const bytes = archive()
  bytes[bytes.length - 8] = bytes[bytes.length - 8]! ^ 1
  await expect(decodeVmEvidence(serial(bytes))).rejects.toThrow()
})
it.each(['../escape.json', '/absolute.json', 'home/../escape.json'])(
  'rejects unsafe report path %s',
  async (path) => {
    await expect(decodeVmEvidence(serial(archive(path)))).rejects.toThrow(
      'Unsafe'
    )
  }
)
it('rejects duplicate report paths and symlinks', async () => {
  await expect(
    decodeVmEvidence(serial(archive('report.json', true)))
  ).rejects.toThrow('duplicate')
  await expect(
    decodeVmEvidence(serial(archive('report.json', false, true)))
  ).rejects.toThrow('Unsafe')
})
