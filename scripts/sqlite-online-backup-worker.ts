import { onlineBackupDatabase } from '../src/core/maintenance/profile-snapshot.js'
const [source, destination] = process.argv.slice(2)
if (!source || !destination)
  throw new Error('SQLite online backup requires source and destination paths')
await onlineBackupDatabase(source, destination)
