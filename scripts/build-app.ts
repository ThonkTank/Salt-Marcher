import { spawnSync } from 'node:child_process'
import { buildChannelSchema } from '../src/shared/contracts/build-info.js'

const channelIndex = process.argv.indexOf('--channel')
if (channelIndex === -1)
  throw new Error('Usage: build-app.ts --channel <channel>')
const channel = buildChannelSchema.parse(process.argv[channelIndex + 1])

run(['pnpm', 'exec', 'tsx', 'scripts/prepare-build-output.ts'])
run(['pnpm', 'exec', 'electron-vite', 'build'])
run(['pnpm', 'exec', 'tsx', 'scripts/build-passive-preload.ts'])
run([
  'pnpm',
  'exec',
  'tsx',
  'scripts/write-build-info.ts',
  '--channel',
  channel
])
run(['pnpm', 'exec', 'tsx', 'scripts/write-build-receipt.ts'])

function run(arguments_: readonly string[]): void {
  const result = spawnSync('corepack', arguments_, {
    cwd: process.cwd(),
    stdio: 'inherit'
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(`${arguments_.join(' ')} failed with ${result.status}`)
}
