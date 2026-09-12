import { writeSync } from 'node:fs'
import { CampaignRegistryRepository } from '../../src/core/persistence/sqlite/campaign-registry-repository.js'
import { InstallationDatabaseOwner } from '../../src/core/persistence/sqlite/installation-database-owner.js'

const original = Object.getOwnPropertyDescriptor(
  CampaignRegistryRepository.prototype,
  'initialize'
)!.value as CampaignRegistryRepository['initialize']
CampaignRegistryRepository.prototype.initialize = function () {
  original.call(this)
  writeSync(1, 'REGISTRY_CREATED\n')
  process.kill(process.pid, 'SIGKILL')
  throw new Error('SIGKILL did not terminate bootstrap')
}
new InstallationDatabaseOwner(process.argv[2]!)
throw new Error('Bootstrap interruption was not reached')
