import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildChannelSchema,
  buildInfoSchema
} from '../src/shared/contracts/build-info.js'
import { databaseSchemaVersions } from '../src/core/persistence/sqlite/database.js'
import { migrationRegistryVersion } from '../src/core/persistence/sqlite/schema-migrations.js'
import { readBuildToolchain, readWorkspaceIdentity } from './build-identity.js'

const workspaceRoot = process.cwd()
const identity = readWorkspaceIdentity(workspaceRoot)
const channelIndex = process.argv.indexOf('--channel')
if (channelIndex === -1) throw new Error('Build channel must be explicit')
const channel = buildChannelSchema.parse(process.argv[channelIndex + 1])
const buildInfo = buildInfoSchema.parse({
  channel,
  ...identity,
  builtAt: new Date().toISOString(),
  schemaVersions: databaseSchemaVersions,
  migrationRegistryVersion,
  toolchain: readBuildToolchain(workspaceRoot)
})
const outputDirectory = resolve(workspaceRoot, 'out')
const target = resolve(outputDirectory, 'build-info.json')
const temporary = `${target}.next`
mkdirSync(outputDirectory, { recursive: true })
writeFileSync(temporary, `${JSON.stringify(buildInfo, null, 2)}\n`, 'utf8')
renameSync(temporary, target)
console.info(
  JSON.stringify({
    component: 'build-identity',
    event: 'written',
    ...buildInfo
  })
)
