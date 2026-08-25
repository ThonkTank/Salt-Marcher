import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createDefaultCampaignSchemaBootstrapper } from '../../src/core/persistence/sqlite/campaign-schema-bootstrapper.js'
import { databaseSchemaVersions } from '../../src/core/persistence/sqlite/database.js'
import {
  currentFormatCampaignManifestSchema,
  validateCurrentFormatCampaignManifest
} from '../../scripts/qualification/current-format-campaign-manifest.js'

const manifestPath =
  'docs/project/evidence/frontend-robustness-current-format-manifest.v1.json'
const raw = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown
const project = {
  campaignDatabaseSchemaVersion: databaseSchemaVersions.campaign,
  campaignSchemaRegistrations: createDefaultCampaignSchemaBootstrapper().names()
}

describe('FR2F1 current-format Campaign qualification manifest', () => {
  it('covers every current Campaign owner in bootstrap order and forbids RP claims', () => {
    const manifest = validateCurrentFormatCampaignManifest(raw, project)

    expect(manifest.identity.qualificationClaim).toBe(
      'preliminary-current-format-reference-not-rp-r-or-rp-l'
    )
    expect(
      manifest.campaignOwners.map(({ registration }) => registration)
    ).toEqual(project.campaignSchemaRegistrations)
    expect(
      manifest.absentTechnicalProfileClasses.map(
        ({ currentStatus }) => currentStatus
      )
    ).toEqual(
      Array(manifest.absentTechnicalProfileClasses.length).fill(
        'not-representable'
      )
    )
  })

  it('fails closed on schema, owner, identity, and claim drift', () => {
    expect(() =>
      validateCurrentFormatCampaignManifest(raw, {
        ...project,
        campaignDatabaseSchemaVersion: project.campaignDatabaseSchemaVersion + 1
      })
    ).toThrow('project uses')
    expect(() =>
      validateCurrentFormatCampaignManifest(raw, {
        ...project,
        campaignSchemaRegistrations: [
          ...project.campaignSchemaRegistrations,
          'future-owner'
        ]
      })
    ).toThrow('does not match Campaign bootstrap')

    const parsed = currentFormatCampaignManifestSchema.parse(raw)
    expect(() =>
      currentFormatCampaignManifestSchema.parse({
        ...parsed,
        identity: { ...parsed.identity, qualificationClaim: 'rp-r-passed' }
      })
    ).toThrow()
    expect(() =>
      currentFormatCampaignManifestSchema.parse({
        ...parsed,
        campaignOwners: [parsed.campaignOwners[0], parsed.campaignOwners[0]]
      })
    ).toThrow('Manifest identities must be unique')
  })
})
