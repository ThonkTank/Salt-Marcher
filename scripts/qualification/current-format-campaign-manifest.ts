import { z } from 'zod'

const stateClassSchema = z.enum(['durable-truth', 'reconciliation'])
const campaignOwnerDispositionSchema = z.enum([
  'switch-oracle',
  'fixture-load',
  'reconciliation-journey',
  'initialize-only'
])

const campaignOwnerSchema = z
  .object({
    registration: z.string().regex(/^[a-z][a-z0-9-]+$/),
    authority: z.string().min(1),
    stateClass: stateClassSchema,
    disposition: campaignOwnerDispositionSchema,
    fixturePlan: z.string().min(1),
    oraclePlan: z.string().min(1)
  })
  .strict()

const installationDependencySchema = z
  .object({
    authority: z.string().min(1),
    disposition: z.enum([
      'switch-authority',
      'shared-dependency',
      'shared-view-state'
    ]),
    fixturePlan: z.string().min(1),
    oraclePlan: z.string().min(1)
  })
  .strict()

const absentProfileClassSchema = z
  .object({
    profileClass: z.string().min(1),
    currentStatus: z.literal('not-representable'),
    evidence: z.string().min(1),
    owningProgramMilestone: z.enum(['M2', 'M3', 'M4', 'M5', 'M6']),
    qualificationPhase: z.literal('FR7B')
  })
  .strict()

export const currentFormatCampaignManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    identity: z
      .object({
        name: z.literal('frontend-robustness-current-format-v1'),
        campaignDatabaseSchemaVersion: z.number().int().positive(),
        qualificationClaim: z.literal(
          'preliminary-current-format-reference-not-rp-r-or-rp-l'
        )
      })
      .strict(),
    campaignOwners: z.array(campaignOwnerSchema).min(1),
    installationDependencies: z.array(installationDependencySchema).min(1),
    absentTechnicalProfileClasses: z.array(absentProfileClassSchema).min(1)
  })
  .strict()
  .superRefine((manifest, context) => {
    unique(
      manifest.campaignOwners.map(({ registration }) => registration),
      ['campaignOwners'],
      context
    )
    unique(
      manifest.installationDependencies.map(({ authority }) => authority),
      ['installationDependencies'],
      context
    )
    unique(
      manifest.absentTechnicalProfileClasses.map(
        ({ profileClass }) => profileClass
      ),
      ['absentTechnicalProfileClasses'],
      context
    )
    for (const disposition of [
      'switch-oracle',
      'reconciliation-journey',
      'initialize-only'
    ] as const)
      if (
        !manifest.campaignOwners.some(
          (owner) => owner.disposition === disposition
        )
      )
        context.addIssue({
          code: 'custom',
          path: ['campaignOwners'],
          message: `Campaign owners need a ${disposition} disposition.`
        })
  })

export type CurrentFormatCampaignManifest = Readonly<
  z.infer<typeof currentFormatCampaignManifestSchema>
>

export function validateCurrentFormatCampaignManifest(
  raw: unknown,
  project: Readonly<{
    campaignDatabaseSchemaVersion: number
    campaignSchemaRegistrations: readonly string[]
  }>
): CurrentFormatCampaignManifest {
  const manifest = currentFormatCampaignManifestSchema.parse(raw)
  if (
    manifest.identity.campaignDatabaseSchemaVersion !==
    project.campaignDatabaseSchemaVersion
  )
    throw new Error(
      `Current-format manifest targets Campaign schema ${manifest.identity.campaignDatabaseSchemaVersion}; project uses ${project.campaignDatabaseSchemaVersion}.`
    )
  const registrations = manifest.campaignOwners.map(
    ({ registration }) => registration
  )
  if (
    registrations.length !== project.campaignSchemaRegistrations.length ||
    registrations.some(
      (registration, index) =>
        registration !== project.campaignSchemaRegistrations[index]
    )
  )
    throw new Error(
      `Current-format manifest owner order ${JSON.stringify(registrations)} does not match Campaign bootstrap ${JSON.stringify(project.campaignSchemaRegistrations)}.`
    )
  return manifest
}

function unique(
  values: readonly string[],
  path: readonly (string | number)[],
  context: z.RefinementCtx
): void {
  if (new Set(values).size === values.length) return
  context.addIssue({
    code: 'custom',
    path: [...path],
    message: 'Manifest identities must be unique.'
  })
}
