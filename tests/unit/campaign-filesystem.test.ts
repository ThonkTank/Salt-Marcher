import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CampaignFilesystem } from '../../src/core/persistence/sqlite/campaign-filesystem.js'
import { createDefaultCampaignSchemaBootstrapper } from '../../src/core/persistence/sqlite/campaign-schema-bootstrapper.js'
import {
  hasImport,
  readTypeScriptModule
} from '../architecture/support/typescript-module.js'

const roots: string[] = []
const campaignId = '018f1f9c-4f5e-8a12-9234-123456789abc'

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('CampaignFilesystem', () => {
  it('owns creation, trash, restore, and deletion directory roles', () => {
    const filesystem = fixture()
    filesystem.createStagedCampaign(campaignId)
    expect(
      filesystem.isValidCampaignStore(filesystem.stagedCampaignPath(campaignId))
    ).toBe(true)

    filesystem.promoteStagedCreation(campaignId)
    expect(existsSync(filesystem.campaignPath(campaignId))).toBe(true)
    filesystem.moveCampaignToTrash(campaignId)
    expect(existsSync(filesystem.campaignPath(campaignId))).toBe(false)
    filesystem.restoreCampaignFromTrash(campaignId)
    expect(existsSync(filesystem.campaignPath(campaignId))).toBe(true)
    filesystem.moveCampaignToTrash(campaignId)
    filesystem.stageTrashForDeletion(campaignId)
    filesystem.finishDeletion(campaignId)
    expect(existsSync(filesystem.campaignPath(campaignId))).toBe(false)
  })

  it('keeps filesystem and aggregate schema mechanics out of CampaignStore', () => {
    const module = readTypeScriptModule(
      'src/core/persistence/sqlite/campaign-store.ts'
    )
    expect(module.identifiers.has('CampaignFilesystem')).toBe(true)
    expect(module.identifiers.has('InstallationDatabaseOwner')).toBe(true)
    expect(hasImport(module, 'node:fs')).toBe(false)
    for (const name of ['renameSync', 'rmSync', 'copyFileSync'])
      expect(module.identifiers.has(name)).toBe(false)
    expect(
      [...module.identifiers].filter(
        (name) => name.startsWith('initialize') && name.endsWith('Schema')
      )
    ).toEqual([])
  })
})

function fixture(): CampaignFilesystem {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-filesystem-'))
  roots.push(root)
  return new CampaignFilesystem(root, createDefaultCampaignSchemaBootstrapper())
}
