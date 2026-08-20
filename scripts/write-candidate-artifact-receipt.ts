import { randomUUID } from 'node:crypto'
import {
  closeSync,
  fsyncSync,
  openSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import {
  candidateArtifactReceiptFile,
  createCandidateArtifactReceipt
} from './candidate-artifact.js'
import { shaSchema } from './delivery-contract.js'

const workspaceRoot = process.cwd()
const environment = z
  .object({
    repository: z.string().min(1),
    workflowName: z.string().min(1),
    workflowRunId: z.coerce.number().int().positive(),
    workflowRunAttempt: z.coerce.number().int().positive(),
    applicationSha: shaSchema
  })
  .parse({
    repository: process.env['GITHUB_REPOSITORY'],
    workflowName: process.env['GITHUB_WORKFLOW'],
    workflowRunId: process.env['GITHUB_RUN_ID'],
    workflowRunAttempt: process.env['GITHUB_RUN_ATTEMPT'],
    applicationSha: process.env['SALT_MARCHER_CHECKED_SHA']
  })
const root = resolve(workspaceRoot, 'release', 'local')
const receipt = createCandidateArtifactReceipt({ root, ...environment })
const target = resolve(root, candidateArtifactReceiptFile)
const temporary = `${target}.${randomUUID()}.next`
const descriptor = openSync(temporary, 'wx', 0o600)
try {
  writeFileSync(descriptor, `${JSON.stringify(receipt, null, 2)}\n`)
  fsyncSync(descriptor)
} finally {
  closeSync(descriptor)
}
renameSync(temporary, target)
console.info(
  JSON.stringify({
    component: 'candidate-artifact',
    event: 'receipt-written',
    artifactName: receipt.artifactName,
    applicationSha: receipt.applicationSha,
    artifactSha256: receipt.artifactSha256
  })
)
