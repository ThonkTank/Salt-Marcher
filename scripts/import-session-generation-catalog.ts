import { createHash } from 'node:crypto'
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { expectedCatalogHeaders } from '../src/core/session-generation/catalog.js'

const arguments_ = process.argv.slice(2)
const sourceRoot = requiredArgument('--source-dir')
const catalogVersion = requiredArgument('--catalog-version')
const sourceUrl = requiredArgument('--source-url')
const destinationRoot = resolve('resources/sessiongeneration', catalogVersion)
const source = resolve(sourceRoot)
const files = readdirSync(source)
  .filter((file) => file.endsWith('.tsv'))
  .toSorted(compareText)
if (files.length === 0)
  throw new Error('No TSV files found in source directory.')
const expectedFiles = Object.keys(expectedCatalogHeaders).toSorted(compareText)
if (
  files.length !== expectedFiles.length ||
  files.some((file, index) => file !== expectedFiles[index])
)
  throw new Error(
    'Source catalog table set does not match the expected snapshot schema.'
  )

mkdirSync(destinationRoot, { recursive: true })
const tables = files.map((file) => {
  const content = readFileSync(join(source, file), 'utf8')
  const lines = content.replace(/\r/g, '').trimEnd().split('\n')
  const columns = lines[0]?.split('\t').length ?? 0
  const rows = Math.max(0, lines.length - 1)
  const expectedHeader = expectedCatalogHeaders[file]
  const header = lines[0]?.split('\t') ?? []
  if (
    expectedHeader === undefined ||
    columns !== expectedHeader.length ||
    header.some((value, index) => value !== expectedHeader[index]) ||
    rows === 0
  )
    throw new Error(`Invalid catalog table header or shape: ${file}`)
  copyFileSync(join(source, file), join(destinationRoot, file))
  return {
    columns,
    file,
    name: basename(file, '.tsv'),
    rows,
    sha256: sha256(content)
  }
})

const canonical = tables
  .map(
    (entry) =>
      `${entry.file}\t${entry.rows}\t${entry.columns}\t${entry.sha256}\n`
  )
  .join('')
const manifest = {
  catalogVersion,
  catalogContentHash: sha256(canonical),
  sourceSha256: sha256(
    files.map((file) => readFileSync(join(source, file))).join('')
  ),
  sourceUrl,
  tables
}
writeFileSync(
  join(destinationRoot, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8'
)
console.log(
  `Imported ${tables.length} session-generation tables into ${destinationRoot}.`
)

function requiredArgument(name: string): string {
  const index = arguments_.indexOf(name)
  const value = index >= 0 ? arguments_[index + 1] : undefined
  if (!value || value.startsWith('--'))
    throw new Error(`Missing argument ${name}`)
  return value
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}
