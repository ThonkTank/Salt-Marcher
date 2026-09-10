import { readFileSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import { maintenanceJournalSchema } from '../../../src/shared/contracts/maintenance.js'
import { MaintenanceCoordinator } from '../../../src/shared/maintenance/coordinator.js'

const [root, action, boundary] = process.argv.slice(2)
if (!root || !action) throw new Error('Missing isolated maintenance request')
const coordinator = new MaintenanceCoordinator(root, (at) => {
  if (at !== boundary) return
  writeSync(1, `BOUNDARY:${at}\n`)
  process.kill(process.pid, 'SIGKILL')
  throw new Error('SIGKILL did not terminate the process')
})
if (action === 'activate') {
  coordinator.begin(
    maintenanceJournalSchema.parse(
      JSON.parse(readFileSync(join(root, 'input.json'), 'utf8'))
    )
  )
  coordinator.activate()
} else if (action === 'rollback') coordinator.rollback()
else if (action === 'commit') coordinator.commit(coordinator.read()!.id)
else throw new Error('Unknown isolated maintenance action')
