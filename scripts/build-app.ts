import { buildChannelSchema } from '../src/shared/contracts/build-info.js'
import { electronViteEntry, runNodeCli, tsxEntry } from './package-cli.js'

const channelIndex = process.argv.indexOf('--channel')
if (channelIndex === -1)
  throw new Error('Usage: build-app.ts --channel <channel>')
const channel = buildChannelSchema.parse(process.argv[channelIndex + 1])

runNodeCli(tsxEntry, ['scripts/prepare-build-output.ts'])
runNodeCli(electronViteEntry, ['build'])
runNodeCli(tsxEntry, ['scripts/build-passive-preload.ts'])
runNodeCli(tsxEntry, ['scripts/write-build-info.ts', '--channel', channel])
runNodeCli(tsxEntry, ['scripts/write-build-receipt.ts'])
