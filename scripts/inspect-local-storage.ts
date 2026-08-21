import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { localInstallationPaths } from './local-app-installation.js'
import { inspectLocalStorage } from './local-storage/inspection.js'

const rawArguments = process.argv.slice(2)
const arguments_ =
  rawArguments[0] === '--' ? rawArguments.slice(1) : rawArguments
if (
  arguments_.length > 1 ||
  (arguments_.length === 1 && arguments_[0] !== '--json')
)
  throw new Error('Usage: local-storage:inspect -- [--json]')

const workspaceRoot = process.cwd()
const paths = localInstallationPaths(
  process.env['XDG_DATA_HOME'] ?? join(homedir(), '.local', 'share')
)
const inspection = inspectLocalStorage({
  paths,
  iconSourcePath: resolve(
    workspaceRoot,
    'resources',
    'icons',
    'salt-marcher.png'
  )
})

console.info(
  JSON.stringify(inspection, null, arguments_[0] === '--json' ? 2 : 0)
)
