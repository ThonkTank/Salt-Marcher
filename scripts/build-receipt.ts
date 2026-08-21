import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import {
  buildInfoSchema,
  buildReceiptSchema,
  type BuildOutputFile,
  type BuildReceipt
} from '../src/shared/contracts/build-info.js'
import { localPersistenceFormatVersions } from '../src/shared/contracts/local-persistence-format-versions.js'
import { sha256File } from './file-hash.js'

const receiptName = 'build-receipt.json'

export function createBuildReceipt(outputRoot: string): BuildReceipt {
  const build = buildInfoSchema.parse(
    JSON.parse(readFileSync(join(outputRoot, 'build-info.json'), 'utf8'))
  )
  const files = Object.freeze(collectOutputFiles(outputRoot))
  return buildReceiptSchema.parse({
    formatVersion: localPersistenceFormatVersions.buildReceipt,
    build,
    outputHash: hashOutputEntries(files),
    files
  })
}

export function verifyBuildReceipt(outputRoot: string): BuildReceipt {
  const receipt = buildReceiptSchema.parse(
    JSON.parse(readFileSync(join(outputRoot, receiptName), 'utf8'))
  )
  const actual = createBuildReceipt(outputRoot)
  if (JSON.stringify(actual) !== JSON.stringify(receipt))
    throw new Error('Build receipt does not match the built output')
  return receipt
}

function collectOutputFiles(root: string): BuildOutputFile[] {
  return treeFiles(root)
    .filter((path) => relative(root, path) !== receiptName)
    .map((path) => ({
      path: relative(root, path).split(sep).join('/'),
      bytes: statSync(path).size,
      sha256: sha256File(path)
    }))
    .sort((left, right) => left.path.localeCompare(right.path, 'en'))
}

function hashOutputEntries(files: readonly BuildOutputFile[]): string {
  return createHash('sha256').update(JSON.stringify(files)).digest('hex')
}

function treeFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    const stats = lstatSync(path)
    if (stats.isSymbolicLink())
      throw new Error(`Build output must not contain symbolic links: ${path}`)
    if (stats.isDirectory()) files.push(...treeFiles(path))
    else if (stats.isFile()) files.push(path)
    else throw new Error(`Unsupported build output entry: ${path}`)
  }
  return files
}
