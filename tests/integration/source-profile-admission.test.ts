import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileMaintenance } from '../../src/core/maintenance/profile-maintenance.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import {
  preparedMaintenance,
  acceptMaintenance
} from '../support/release-maintenance.js'
import { installMaintenanceLauncher } from '../../src/shared/maintenance/launcher.js'
import { inventory } from '../../src/shared/maintenance/files.js'
import { withQualifiedSourceProfile } from '../../src/main/local-profile/source-profile-admission.js'
const mocks = vi.hoisted(() => ({ protocol: vi.fn() }))
vi.mock('../../src/shared/maintenance/appimage-launcher.js', () => ({
  readAppImageProfileProtocol: mocks.protocol
}))
let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'salt-source-admission-'))
  mocks.protocol.mockReset()
  mocks.protocol.mockReturnValue({
    formatVersion: 1,
    locking: 'canonical-profile-v1',
    scope: 'complete-profile',
    browserStorage: 'outside-profile'
  })
})
afterEach(() => rmSync(root, { recursive: true, force: true }))
async function installation(commit = true) {
  const maintenance = new ProfileMaintenance(root, '0.3.0', 'profile')
  const store = new CampaignStore(maintenance.data)
  store.create('Source')
  store.close()
  const coordinator = await preparedMaintenance(maintenance)
  if (commit) acceptMaintenance(maintenance, coordinator)
  const program = coordinator.read()!.next
  const image = join(
    root,
    'deployments',
    program.deployment,
    'SaltMarcher.AppImage'
  )
  installMaintenanceLauncher(
    root,
    { path: image, sha256: program.sha256 },
    Buffer.from('// fixture launcher')
  )
  return { image, profile: join(root, 'profile') }
}
describe('source installation admission', () => {
  it('admits a verified completed installation without changing the source profile', async () => {
    const { profile } = await installation()
    const before = inventory(profile)
    const result = await withQualifiedSourceProfile(
      root,
      join(root, 'destination'),
      (selected) => Promise.resolve(selected)
    )
    expect(result).toBe(profile)
    expect(mocks.protocol).toHaveBeenCalledTimes(2)
    expect(inventory(profile)).toEqual(before)
  })
  it.each(['pending', 'changed-image', 'missing-protocol'])(
    'rejects %s before invoking the exporter',
    async (kind) => {
      const { image } = await installation(kind !== 'pending')
      if (kind === 'changed-image') writeFileSync(image, 'changed')
      if (kind === 'missing-protocol')
        mocks.protocol.mockImplementation(() => {
          throw new Error('unsupported')
        })
      const exporter = vi.fn(() => Promise.resolve())
      await expect(
        withQualifiedSourceProfile(root, join(root, 'destination'), exporter)
      ).rejects.toThrow('geprüfte Sicherung')
      expect(exporter).not.toHaveBeenCalled()
    }
  )
})
