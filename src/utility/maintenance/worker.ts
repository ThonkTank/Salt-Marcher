import { ProfileMaintenance } from '../../core/maintenance/profile-maintenance.js'
import { maintenanceWorkerRequestSchema } from '../../shared/contracts/maintenance.js'
process.parentPort?.on('message', (event) => {
  void handle(event.data)
})
async function handle(raw: unknown): Promise<void> {
  try {
    const input = maintenanceWorkerRequestSchema.parse(raw)
    const transaction = new ProfileMaintenance(
      input.root,
      input.version,
      'profile'
    )
    let result: unknown = null
    if (input.operation === 'list') result = transaction.backups()
    if (input.operation === 'prepare')
      result = await transaction.prepare(input.transactionId, input.source)
    if (input.operation === 'import-backup')
      result = await transaction.importBackup(
        input.transactionId,
        input.backupDirectory
      )
    if (input.operation === 'restore')
      result = await transaction.prepare(
        input.transactionId,
        transaction.backupSource(input.id)
      )
    if (input.operation === 'validate') transaction.validate()
    process.parentPort?.postMessage({ ok: true, result })
  } catch (error) {
    process.parentPort?.postMessage({
      ok: false,
      message:
        error instanceof Error ? error.message : 'Wartung fehlgeschlagen.'
    })
  }
}
