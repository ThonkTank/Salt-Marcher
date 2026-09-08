import { z } from 'zod'

const storedName = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/)
export const maintenanceProgramSchema = z
  .object({
    deployment: storedName,
    version: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/)
  })
  .strict()
export type MaintenanceProgram = z.infer<typeof maintenanceProgramSchema>

const forwardPhase = z.enum([
  'prepared',
  'data-moving',
  'data-ready',
  'program-moving',
  'awaiting-start'
])
export const maintenanceJournalSchema = z
  .object({
    formatVersion: z.literal(2),
    id: z.uuid(),
    operation: z.enum(['install', 'update', 'import', 'restore']),
    phase: z.enum([
      ...forwardPhase.options,
      'committed',
      'rollback-started',
      'rollback-preserving',
      'rollback-restoring',
      'rollback-program',
      'rolled-back'
    ]),
    rollbackFrom: forwardPhase.nullable(),
    hadData: z.boolean(),
    backup: storedName.nullable(),
    integration: z
      .array(
        z
          .object({
            target: z.string().min(1),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            mode: z.number().int().min(0).max(0o777),
            previous: z.discriminatedUnion('kind', [
              z.object({ kind: z.literal('missing') }).strict(),
              z
                .object({
                  kind: z.literal('file'),
                  sha256: z.string().regex(/^[a-f0-9]{64}$/),
                  mode: z.number().int().min(0).max(0o777)
                })
                .strict(),
              z
                .object({ kind: z.literal('link'), target: z.string().min(1) })
                .strict()
            ])
          })
          .strict()
      )
      .default([]),
    previous: maintenanceProgramSchema.nullable(),
    next: maintenanceProgramSchema
  })
  .strict()
  .superRefine((value, context) => {
    const rollingBack =
      value.phase.startsWith('rollback-') || value.phase === 'rolled-back'
    if (rollingBack !== (value.rollbackFrom !== null))
      context.addIssue({
        code: 'custom',
        message: 'Rollback state must retain its original activation phase'
      })
  })
export type MaintenanceJournal = z.infer<typeof maintenanceJournalSchema>

export const profilePreparationSchema = z
  .object({ id: z.uuid(), backup: z.uuid().nullable() })
  .strict()

export const maintenanceWorkerRequestSchema = z.discriminatedUnion(
  'operation',
  [
    z
      .object({
        root: z.string().min(1),
        version: z.string().min(1),
        operation: z.literal('list')
      })
      .strict(),
    z
      .object({
        root: z.string().min(1),
        version: z.string().min(1),
        operation: z.literal('validate')
      })
      .strict(),
    z
      .object({
        root: z.string().min(1),
        version: z.string().min(1),
        operation: z.literal('prepare'),
        transactionId: z.uuid(),
        source: z.string().optional()
      })
      .strict(),
    z
      .object({
        root: z.string().min(1),
        version: z.string().min(1),
        operation: z.literal('import-backup'),
        transactionId: z.uuid(),
        backupDirectory: z.string().min(1)
      })
      .strict(),
    z
      .object({
        root: z.string().min(1),
        version: z.string().min(1),
        operation: z.literal('restore'),
        transactionId: z.uuid(),
        id: z.uuid()
      })
      .strict()
  ]
)
export type MaintenanceWorkerRequest = z.infer<
  typeof maintenanceWorkerRequestSchema
>
