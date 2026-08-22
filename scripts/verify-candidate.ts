import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import {
  acquireCandidateArtifact,
  type CandidateArtifactExpectation
} from './candidate-artifact.js'
import { assertCandidateReady } from './candidate-delivery.js'
import {
  readWorkspaceIdentity,
  readWorkspaceInputFingerprints
} from './build-identity.js'
import { readRequiredJobManifest } from './delivery-contract.js'

const state = assertCandidateReady()
const workspaceRoot = process.cwd()
const workspace = readWorkspaceIdentity(workspaceRoot)
const inputFingerprints = readWorkspaceInputFingerprints()
const candidate = state.candidate!
const expectation: CandidateArtifactExpectation = {
  repository: candidate.artifact.repository,
  workflowName: readRequiredJobManifest().workflowName,
  workflowRunId: candidate.artifact.workflowRunId,
  workflowRunAttempt: candidate.artifact.workflowRunAttempt,
  applicationSha: workspace.commit,
  workspaceFingerprint: workspace.workspaceFingerprint,
  appBuildInputFingerprint: workspace.appBuildInputFingerprint
}
const artifact = acquireCandidateArtifact({
  destinationRoot: resolve(workspaceRoot, 'release', 'local'),
  expected: expectation,
  download: (destination) =>
    execFileSync(
      'gh',
      [
        'run',
        'download',
        String(candidate.artifact.workflowRunId),
        '--name',
        candidate.artifact.artifactName,
        '--dir',
        destination
      ],
      { cwd: workspaceRoot, stdio: 'inherit' }
    )
})
console.info(
  JSON.stringify({
    component: 'candidate-delivery',
    event: 'candidate-verified',
    ...state,
    inputFingerprints,
    artifactReceipt: artifact.receiptPath,
    artifactSha256: artifact.receipt.artifactSha256
  })
)
