import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { readCandidateState } from './candidate-delivery.js'
import {
  assertHandoffResourcePreflight,
  readHandoffResourceSnapshot
} from './handoff-preflight.js'
import { localInstallationPaths } from './local-app-installation.js'

const workspaceRoot = process.cwd()
const xdgDataHome =
  process.env['XDG_DATA_HOME'] ?? join(homedir(), '.local', 'share')
const installation = localInstallationPaths(xdgDataHome)
let candidate: unknown = null
let candidateError: string | null = null

try {
  candidate = readCandidateState()
} catch (error) {
  candidateError = error instanceof Error ? error.message : String(error)
}

const head = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: workspaceRoot,
  encoding: 'utf8'
}).trim()
const resources = readHandoffResourceSnapshot(
  workspaceRoot,
  installation.root,
  installation.campaignData
)
let resourceError: string | null = null
try {
  assertHandoffResourcePreflight(resources)
} catch (error) {
  resourceError = error instanceof Error ? error.message : String(error)
}

const statePath = resolve(
  workspaceRoot,
  '.tmp',
  'handoff-local-app',
  'states',
  `${head}.json`
)

console.info(
  JSON.stringify(
    {
      component: 'local-handoff',
      event: 'status',
      ready: candidateError === null && resourceError === null,
      head,
      candidate,
      candidateError,
      resources,
      resourceError,
      resume: {
        available: existsSync(statePath),
        statePath
      }
    },
    null,
    2
  )
)
