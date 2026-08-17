import { electronViteEntry, runNodeCli, tsxEntry } from './package-cli.js'

runNodeCli(tsxEntry, ['scripts/prepare-build-output.ts'])
runNodeCli(electronViteEntry, ['build'], {
  SALT_MARCHER_BUILD_TARGET: 'qualification'
})
runNodeCli(tsxEntry, ['scripts/build-passive-preload.ts'])
runNodeCli(tsxEntry, ['scripts/write-build-info.ts', '--channel', 'release'])
runNodeCli(tsxEntry, ['scripts/write-build-receipt.ts'])
