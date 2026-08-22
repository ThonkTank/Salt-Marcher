import Database from 'better-sqlite3'

const [source, destination] = process.argv.slice(2)
if (!source || !destination)
  throw new Error('SQLite online backup requires source and destination paths')

const database = new Database(source, { readonly: true, fileMustExist: true })
try {
  await database.backup(destination)
} finally {
  database.close()
}
