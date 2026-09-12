import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync
} from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, expect, it } from 'vitest'
import { inspectReleaseFile } from '../../scripts/release/bundle.js'
import { qualificationEnvironment } from '../../scripts/release/qualification-environment.js'
import { verifyPreparedEnvironment } from '../../scripts/release/prepared-environment.js'
const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'prepared-environment-'))
  roots.push(root)
  const put = (name: string, value: string) => {
    const path = join(root, name)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, value)
    return inspectReleaseFile(path, 4 * 1024 * 1024, false)
  }
  const evidence = {
    formatVersion: 1,
    coverage: 'guest-bootstrap-only-no-application-test',
    hostBootId: '11111111-1111-4111-8111-111111111111',
    guestBootId: '22222222-2222-4222-8222-222222222222',
    kernel: 'inert unit fixture',
    packages: ['libgtk-3-0t64', 'libnss3', 'xvfb', 'xdotool', 'dbus-x11']
      .map((name) => `${name}\ttest`)
      .join('\n')
  }
  const report = put(
    'bootstrap-evidence/export-0/reports/bootstrap-evidence.json',
    JSON.stringify(evidence)
  )
  const tar = put(
    'bootstrap-evidence/export-0/original.tar.gz',
    'inert archive fixture'
  )
  const serial = put('bootstrap-run/serial.log', 'inert serial fixture')
  const prepared = put(
    'prepared-guest.qcow2',
    'inert disk fixture; never executed'
  )
  const bootstrap = put('bootstrap.yaml', '# inert bootstrap fixture')
  const receipt = {
    formatVersion: 1,
    environment: structuredClone(qualificationEnvironment),
    engine: 'podman',
    toolImageId: 'a'.repeat(64),
    bootstrapSha256: bootstrap.sha256,
    prepared: {
      name: 'prepared-guest.qcow2',
      bytes: prepared.bytes,
      sha256: prepared.sha256
    },
    evidence,
    archive: {
      formatVersion: 1,
      evidence: 'transport-integrity-only-semantic-acceptance-not-verified',
      source: '/inert/source',
      vmExitCode: 0,
      testExitCodes: [0],
      serialSha256: serial.sha256,
      files: [
        {
          path: 'export-0/reports/bootstrap-evidence.json',
          bytes: report.bytes,
          sha256: report.sha256
        },
        {
          path: 'export-0/original.tar.gz',
          bytes: tar.bytes,
          sha256: tar.sha256
        }
      ]
    }
  }
  const save = () => {
    put('prepared-environment.json', JSON.stringify(receipt))
    put(
      'bootstrap-evidence/archive-manifest.json',
      JSON.stringify(receipt.archive)
    )
  }
  save()
  return { root, receipt, put, save, bootstrap: join(root, 'bootstrap.yaml') }
}
it('binds prepared bytes, pinned environment, bootstrap source and archived evidence', () => {
  const v = fixture()
  expect(verifyPreparedEnvironment(v.root, v.bootstrap)).toEqual(v.receipt)
})
it.each([
  'disk',
  'serial',
  'bootstrap',
  'archive',
  'same-kernel',
  'missing-package',
  'traversal',
  'duplicate',
  'failed-vm',
  'symlink'
] as const)('rejects %s preparation evidence', (field) => {
  const v = fixture()
  if (field === 'disk') v.put('prepared-guest.qcow2', 'changed')
  if (field === 'serial') v.put('bootstrap-run/serial.log', 'changed')
  if (field === 'bootstrap') v.put('bootstrap.yaml', 'changed')
  if (field === 'archive')
    v.put('bootstrap-evidence/export-0/original.tar.gz', 'changed')
  if (field === 'same-kernel')
    v.receipt.evidence.guestBootId = v.receipt.evidence.hostBootId
  if (field === 'missing-package') v.receipt.evidence.packages = 'xvfb\tonly'
  if (field === 'traversal')
    v.receipt.archive.files[0]!.path = 'export-0/../outside.json'
  if (field === 'duplicate')
    v.receipt.archive.files.push(v.receipt.archive.files[0]!)
  if (field === 'failed-vm') v.receipt.archive.vmExitCode = 1
  if (field === 'symlink') {
    rmSync(join(v.root, 'prepared-guest.qcow2'))
    symlinkSync(v.bootstrap, join(v.root, 'prepared-guest.qcow2'))
  }
  v.save()
  expect(() => verifyPreparedEnvironment(v.root, v.bootstrap)).toThrow()
})
