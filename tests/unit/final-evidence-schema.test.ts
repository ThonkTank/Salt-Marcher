import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  finalEvidenceSchema,
  handoffSteps,
  readRequiredJobManifest
} from '../../scripts/delivery-contract.js'

describe('final evidence schema', () => {
  it('keeps the checked-in JSON schema aligned with the executable contract', () => {
    const jsonSchema = JSON.parse(
      readFileSync(
        'docs/project/quality-reset/final-evidence.schema.json',
        'utf8'
      )
    ) as {
      required: string[]
      $defs: { handoffStep: { properties: { name: { enum: string[] } } } }
    }
    expect(jsonSchema.required).toEqual([
      'schemaVersion',
      'status',
      'application',
      'candidate',
      'handoff',
      'artifact',
      'installation',
      'main',
      'ledger',
      'reproduction'
    ])
    expect(jsonSchema.$defs.handoffStep.properties.name.enum).toEqual(
      handoffSteps
    )
    expect(finalEvidenceSchema.parse(evidence()).status).toBe('complete')
  })

  it('cannot report complete with an open ledger or a failed domain readback', () => {
    expect(() =>
      finalEvidenceSchema.parse({
        ...evidence(),
        ledger: { ...evidence().ledger, open: 1 }
      })
    ).toThrow()
    expect(() =>
      finalEvidenceSchema.parse({
        ...evidence(),
        installation: {
          ...evidence().installation,
          domainReadbacks: [
            {
              name: 'campaign-count',
              expected: 1,
              actual: 0,
              passed: false
            }
          ]
        }
      })
    ).toThrow()
  })
})

function evidence() {
  const hash = 'a'.repeat(64)
  const sha = 'b'.repeat(40)
  const timestamp = '2026-08-18T12:00:00.000Z'
  const workflow = {
    runId: 1,
    url: 'https://github.example/actions/runs/1',
    attempt: 1,
    headSha: sha,
    requiredJobManifestVersion: 1,
    jobs: readRequiredJobManifest().jobs.map((job) => ({
      ...job,
      conclusion: 'success' as const
    }))
  }
  return {
    schemaVersion: 1,
    status: 'complete',
    application: {
      sha,
      workspaceFingerprint: hash,
      appBuildInputFingerprint: hash,
      dirty: false,
      toolchain: {
        node: 'v22.0.0',
        pnpm: '10.15.1',
        electron: '43.2.0',
        electronVite: '5.0.0',
        electronBuilder: '26.15.3',
        platform: 'linux',
        arch: 'x64'
      },
      versions: {
        installationSchema: 1,
        campaignSchema: 1,
        migrationRegistry: 1,
        encounterEngine: 1,
        rewardEngine: 1,
        config: 1,
        catalogVersion: 1,
        catalogHash: hash
      }
    },
    candidate: workflow,
    handoff: {
      invocationId: '00000000-0000-4000-8000-000000000001',
      mode: 'fresh',
      freshInvocationCountForApplicationSha: 1,
      exactlyOnce: true,
      startedAt: timestamp,
      completedAt: timestamp,
      steps: handoffSteps.map((name) => ({
        name,
        status: 'completed',
        startedAt: timestamp,
        durationMs: 1,
        outputHash: hash
      }))
    },
    artifact: {
      path: 'SaltMarcher.AppImage',
      sha256: hash,
      manifestSha256: hash,
      outputHash: hash
    },
    installation: {
      artifactSha256: hash,
      manifestSha256: hash,
      utilityReady: true,
      generation: 1,
      backup: {
        path: 'backups/1',
        manifestSha256: hash,
        fileCount: 1,
        databaseCount: 1
      },
      quickChecks: [
        { path: 'installation.sqlite', role: 'installation', result: 'ok' }
      ],
      domainReadbacks: [
        { name: 'campaign-count', expected: 1, actual: 1, passed: true }
      ]
    },
    main: workflow,
    ledger: {
      path: 'followup-requirements-ledger.yaml',
      sha256: hash,
      total: 1,
      verified: 1,
      notApplicable: 0,
      open: 0,
      inProgress: 0,
      blocked: 0
    },
    reproduction: { commands: ['pnpm check:delivery'] }
  }
}
