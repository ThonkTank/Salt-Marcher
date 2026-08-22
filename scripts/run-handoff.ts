import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseHandoffArguments } from './handoff-arguments.js'
import { runHandoffDryRun } from './handoff-dry-run.js'
import { localInstallationPaths } from './local-app-installation.js'

const workspaceRoot = process.cwd()
const parsed = parseHandoffArguments(process.argv.slice(2))
if (parsed.mode === 'dry-run') {
  const live = localInstallationPaths(
    process.env['XDG_DATA_HOME'] ?? join(homedir(), '.local', 'share')
  )
  const result = runHandoffDryRun({
    workspaceRoot,
    sourceCampaignData: parsed.source ?? live.campaignData
  })
  console.info(
    JSON.stringify({
      component: 'local-handoff-dry-run',
      event: 'passed',
      ...result
    })
  )
} else {
  const arguments_ = [
    '--import',
    'tsx',
    resolve(workspaceRoot, 'scripts', 'handoff-local-app.ts'),
    ...(parsed.resume ? ['--resume'] : [])
  ]
  const result = spawnSync(process.execPath, arguments_, {
    cwd: workspaceRoot,
    env: process.env,
    stdio: 'inherit'
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(`Canonical handoff failed with ${result.status}`)
}
