import { z } from 'zod'
import { ProfileTransaction } from '../../core/maintenance/profile-transaction.js'
const requestSchema = z
  .object({
    root: z.string(),
    version: z.string(),
    operation: z.enum([
      'list',
      'prepare',
      'activate',
      'commit',
      'rollback',
      'restore'
    ]),
    source: z.string().optional(),
    id: z.string().optional()
  })
  .strict()
process.parentPort?.on('message', (event) => {
  void handle(event.data)
})
async function handle(raw: unknown): Promise<void> {
  try {
    const input = requestSchema.parse(raw)
    const transaction = new ProfileTransaction(input.root, input.version)
    let result: unknown = null
    if (input.operation === 'list') result = transaction.backups()
    if (input.operation === 'prepare') await transaction.prepare(input.source)
    if (input.operation === 'restore')
      await transaction.prepare(
        transaction.backupSource(z.uuid().parse(input.id))
      )
    if (input.operation === 'activate') transaction.activate()
    if (input.operation === 'commit') transaction.commit()
    if (input.operation === 'rollback') transaction.rollback()
    process.parentPort?.postMessage({ ok: true, result })
  } catch (error) {
    process.parentPort?.postMessage({
      ok: false,
      message:
        error instanceof Error ? error.message : 'Wartung fehlgeschlagen.'
    })
  }
}
