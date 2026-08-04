import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { z } from 'zod'

const databasePath = resolve('resources/reference/srd-5.1.sqlite')
const definitionIdsPath = resolve(
  'resources/reference/srd-5.1.definition-ids.json'
)
const creaturePath = resolve('src/core/creatures/srd-5.1.generated.json')
const creatureIdsPath = resolve('resources/catalog/srd-5.1.creature-ids.json')

const database = new Database(databasePath, {
  fileMustExist: true,
  readonly: true
})
const definitionIds = (
  database
    .prepare(
      'SELECT target_key AS targetKey FROM reference_document ORDER BY target_key'
    )
    .all() as { targetKey: string }[]
).map((row) => row.targetKey)
database.close()

const creatureDocument = z
  .object({
    creatures: z.array(z.object({ id: z.string().min(1) }).passthrough())
  })
  .parse(JSON.parse(await readFile(creaturePath, 'utf8')))
const creatureIds = creatureDocument.creatures
  .map((creature) => creature.id)
  .toSorted()

for (const [path, ids] of [
  [definitionIdsPath, definitionIds],
  [creatureIdsPath, creatureIds]
] as const) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(ids, null, 2)}\n`, 'utf8')
}
