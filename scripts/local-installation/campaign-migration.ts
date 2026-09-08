import {
  CorruptDataError,
  IncompatibleDataError
} from '../../src/core/persistence/sqlite/database.js'
import {
  preflightPersistence,
  type PersistencePreflight
} from '../../src/core/persistence/sqlite/persistence-preflight.js'
import { type SchemaMigration } from '../../src/core/persistence/sqlite/schema-migrations.js'
import {
  LocalInstallationError,
  type LocalInstallationPaths
} from './contract.js'

export function readPersistencePreflight(
  paths: LocalInstallationPaths,
  migrations?: readonly SchemaMigration[]
): PersistencePreflight {
  try {
    return preflightPersistence(paths.campaignData, migrations)
  } catch (error) {
    if (error instanceof IncompatibleDataError)
      throw new LocalInstallationError(
        'migration-missing',
        `No tested migration exists from schema ${String(error.actualVersion)} to ${error.expectedVersion}`,
        { cause: error }
      )
    if (error instanceof CorruptDataError)
      throw new LocalInstallationError(
        'data-corrupt',
        `Campaign database failed SQLite quick_check: ${error.dataPath}`,
        { cause: error }
      )
    throw error
  }
}
