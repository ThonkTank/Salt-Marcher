import { spawnSync } from 'node:child_process'
import {
  iterationIdentity,
  parseIterationArguments
} from './iteration-workflow.js'
import { electronViteEntry, runNodeCli, tsxEntry } from './package-cli.js'

const options = parseIterationArguments(process.argv.slice(2))
const identity = iterationIdentity(
  options.area,
  gitOutput(['rev-parse', 'HEAD']),
  gitOutput(['status', '--porcelain=v1', '--untracked-files=normal']).length > 0
)

console.info(`Checking ${options.area} iteration ${identity}`)
runNodeCli(tsxEntry, ['scripts/run-focused-check.ts', options.area])

if (!options.checkOnly) {
  console.info(
    `Starting SaltMarcher ${identity} with disposable development-data. ` +
      'Close the app to end the iteration session.'
  )
  runNodeCli(electronViteEntry, ['dev'], {
    SALT_MARCHER_ITERATION_ID: identity
  })
}

function gitOutput(arguments_: readonly string[]): string {
  const result = spawnSync('git', arguments_, {
    cwd: process.cwd(),
    encoding: 'utf8'
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(`git ${arguments_.join(' ')} failed with ${result.status}`)
  return result.stdout.trim()
}
