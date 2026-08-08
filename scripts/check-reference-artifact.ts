import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'
import { z } from 'zod'

const expectedCommit = '3f5593ea004c4f5a2af95603087ce4de72689d9f'
const expectedArchiveSha256 =
  '200d84ced9b85049ebd975d497463a10b5b31560f8d86424fd98ae4780eb84c4'
const root = resolve('resources/reference')
const databasePath = resolve(root, 'srd-5.1.sqlite')
const creaturePath = resolve('src/core/creatures/srd-5.1.generated.json')
const manifestSchema = z
  .object({
    catalogId: z.literal('srd-5.1'),
    catalogVersion: z.string().min(1),
    upstreamCommit: z.literal(expectedCommit),
    archiveSha256: z.literal(expectedArchiveSha256),
    databaseSha256: z.string().regex(/^[a-f0-9]{64}$/),
    documents: z.number().int().positive(),
    terms: z.number().int().positive(),
    creatures: z.number().int().positive(),
    creatureJsonSha256: z.string().regex(/^[a-f0-9]{64}$/),
    license: z.literal('CC-BY-4.0'),
    attribution: z.string().min(40),
    officialSource: z.literal(
      'https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf'
    )
  })
  .passthrough()

const manifest = manifestSchema.parse(
  JSON.parse(await readFile(resolve(root, 'srd-5.1.manifest.json'), 'utf8'))
)
const databaseBuffer = await readFile(databasePath)
const actualHash = createHash('sha256').update(databaseBuffer).digest('hex')
if (actualHash !== manifest.databaseSha256)
  throw new Error(
    `Reference catalog hash mismatch: expected ${manifest.databaseSha256}, received ${actualHash}`
  )

const creatureBuffer = await readFile(creaturePath)
const creatureHash = createHash('sha256').update(creatureBuffer).digest('hex')
if (creatureHash !== manifest.creatureJsonSha256)
  throw new Error(
    `Creature catalog hash mismatch: expected ${manifest.creatureJsonSha256}, received ${creatureHash}`
  )
const creatureArtifact = z
  .object({
    manifest: z.object({
      upstreamCommit: z.literal(expectedCommit),
      archiveSha256: z.literal(expectedArchiveSha256)
    }),
    creatures: z.array(z.object({ id: z.string().min(1) }).passthrough())
  })
  .parse(JSON.parse(creatureBuffer.toString('utf8')))
if (creatureArtifact.creatures.length !== manifest.creatures)
  throw new Error('Creature count does not match the reference manifest')
const goldenCreatureIds = z
  .array(z.string())
  .parse(
    JSON.parse(
      await readFile(
        resolve('resources/catalog/srd-5.1.creature-ids.json'),
        'utf8'
      )
    )
  )
assertSameIds(
  creatureArtifact.creatures.map((creature) => creature.id).toSorted(),
  goldenCreatureIds,
  'creature'
)

const referenceReport = z
  .object({
    targetCollisions: z.array(z.unknown()).length(0),
    addedDefinitionIds: z.array(z.string()).length(0),
    removedDefinitionIds: z.array(z.string()).length(0),
    incompleteDocuments: z.array(z.string()).length(0)
  })
  .parse(
    JSON.parse(
      await readFile(resolve(root, 'srd-5.1.import-report.json'), 'utf8')
    )
  )
const creatureReport = z
  .object({
    addedCreatureIds: z.array(z.string()).length(0),
    removedCreatureIds: z.array(z.string()).length(0),
    missingBiomeEnrichment: z.array(z.string()).length(0),
    orphanedBiomeEnrichment: z.array(z.string()).length(0),
    incompleteCreatures: z.array(z.string()).length(0),
    partIdCollisions: z.array(z.unknown()).length(0)
  })
  .parse(
    JSON.parse(
      await readFile(
        resolve('resources/catalog/srd-5.1.creature-import-report.json'),
        'utf8'
      )
    )
  )
void referenceReport
void creatureReport

const database = new Database(databasePath, {
  fileMustExist: true,
  readonly: true
})
try {
  const integrity = database.pragma('integrity_check', {
    simple: true
  }) as string
  if (integrity !== 'ok')
    throw new Error(`Reference catalog integrity failed: ${integrity}`)
  const count = (table: 'reference_document' | 'reference_term') =>
    (
      database
        .prepare(
          `SELECT COUNT(DISTINCT ${table === 'reference_document' ? 'target_key' : 'normalized_term'}) AS value FROM ${table}`
        )
        .get() as {
        value: number
      }
    ).value
  if (count('reference_document') !== manifest.documents)
    throw new Error('Reference document count does not match the manifest')
  if (count('reference_term') !== manifest.terms)
    throw new Error('Reference term count does not match the manifest')
  const definitionIds = (
    database
      .prepare(
        'SELECT target_key AS id FROM reference_document ORDER BY target_key'
      )
      .all() as { id: string }[]
  ).map((row) => row.id)
  const goldenDefinitionIds = z
    .array(z.string())
    .parse(
      JSON.parse(
        await readFile(resolve(root, 'srd-5.1.definition-ids.json'), 'utf8')
      )
    )
  assertSameIds(definitionIds, goldenDefinitionIds, 'definition')
} finally {
  database.close()
}

function assertSameIds(
  actual: readonly string[],
  expected: readonly string[],
  label: string
): void {
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  )
    throw new Error(`Generated ${label} IDs differ from their Golden Master`)
}
