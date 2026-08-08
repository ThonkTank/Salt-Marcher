import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import Database from 'better-sqlite3'

const dataRoot = resolve(requiredArgument('--data-root'))
if (!existsSync(dataRoot))
  throw new Error(`Development data root does not exist: ${dataRoot}`)

const output = resolve(
  argument('--output') ?? `${dataRoot}/diagnostic-export-v19.json`
)
const databasePaths = sqliteFiles(dataRoot)
if (databasePaths.length === 0)
  throw new Error(`No SQLite databases found below: ${dataRoot}`)
if (databasePaths.includes(output))
  throw new Error(
    `Refusing to overwrite an exported SQLite database: ${output}`
  )
const diagnostic = {
  format: 'salt-marcher-development-diagnostic',
  exportedAt: new Date().toISOString(),
  supportedMigrationContract: false,
  dataRoot,
  databases: databasePaths.map((path) => ({
    path: relative(dataRoot, path),
    ...readDatabase(path)
  }))
}

mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(diagnostic, null, 2)}\n`, 'utf8')
console.log(`Diagnostic development-data export written to ${output}`)

function readDatabase(path: string) {
  let database: Database.Database | undefined
  try {
    database = new Database(path, { readonly: true, fileMustExist: true })
    return { database: databaseDump(database) }
  } catch (cause) {
    return {
      error: cause instanceof Error ? cause.message : 'Unknown SQLite error'
    }
  } finally {
    database?.close()
  }
}

function databaseDump(database: Database.Database) {
  const tables = database
    .prepare(
      `SELECT name, sql
       FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`
    )
    .all() as Array<{ name: string; sql: string }>
  return {
    userVersion: database.pragma('user_version', { simple: true }) as number,
    tables: tables.map((table) => ({
      name: table.name,
      sql: table.sql,
      rows: database
        .prepare(`SELECT * FROM ${quoteIdentifier(table.name)}`)
        .all()
    }))
  }
}

function sqliteFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return sqliteFiles(path)
      return entry.isFile() && entry.name.endsWith('.sqlite') ? [path] : []
    })
    .sort((left, right) => left.localeCompare(right))
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function requiredArgument(name: string): string {
  const value = argument(name)
  if (!value)
    throw new Error(
      `Missing ${name}=PATH. The diagnostic exporter never guesses a user-data directory.`
    )
  return value
}

function argument(name: string): string | undefined {
  const prefix = `${name}=`
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length)
}
