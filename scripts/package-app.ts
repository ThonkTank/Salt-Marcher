import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildChannelSchema } from '../src/shared/contracts/build-info.js'

const channelIndex = process.argv.indexOf('--channel')
if (channelIndex === -1)
  throw new Error('Usage: package-app.ts --channel <channel>')
const channel = buildChannelSchema.parse(process.argv[channelIndex + 1])
const workspaceRoot = process.cwd()

run([
  'pnpm',
  'exec',
  'tsx',
  'scripts/assert-built-workspace.ts',
  '--channel',
  channel
])
rmSync(resolve(workspaceRoot, 'release', channel), {
  recursive: true,
  force: true
})
run([
  'pnpm',
  'exec',
  'electron-builder',
  '--config',
  `electron-builder.${channel}.yml`,
  '--publish',
  'never'
])
if (channel === 'local')
  run(['pnpm', 'exec', 'tsx', 'scripts/write-local-artifact-manifest.ts'])

function run(arguments_: readonly string[]): void {
  const result = spawnSync('corepack', arguments_, {
    cwd: workspaceRoot,
    stdio: 'inherit'
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(`${arguments_.join(' ')} failed with ${result.status}`)
}
