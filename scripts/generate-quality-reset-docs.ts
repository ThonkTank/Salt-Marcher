import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { finalEvidenceSchema } from './delivery-contract.js'
import { atomicWrite } from './safe-file-write.js'
import {
  renderFinalReport,
  renderLiveStatus
} from './quality-reset-documents.js'
import { readFollowupLedger } from './quality-reset-ledger.js'

const root = process.cwd()
const evidencePath = resolve(
  root,
  'docs/project/quality-reset/final-evidence.json'
)
if (!existsSync(evidencePath))
  throw new Error(
    'final-evidence.json is missing; no complete report can be generated.'
  )
const evidence = finalEvidenceSchema.parse(
  JSON.parse(readFileSync(evidencePath, 'utf8'))
)
const ledger = readFollowupLedger(root)
const outputs = new Map([
  [
    resolve(root, 'docs/project/quality-reset/live-status.md'),
    renderLiveStatus(evidence, ledger)
  ],
  [
    resolve(root, 'docs/project/quality-reset/final-report.md'),
    renderFinalReport(evidence, ledger)
  ]
])
const check = process.argv.includes('--check')
for (const [path, expected] of outputs) {
  if (check) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== expected)
      throw new Error(`${path} differs from generated final evidence.`)
  } else atomicWrite(path, expected)
}
