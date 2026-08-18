import {
  assertEvidenceCommitState,
  readEvidenceCommitState
} from './evidence-commit.js'

const applicationSha = process.argv[2]
if (!applicationSha || !/^[0-9a-f]{40}$/.test(applicationSha))
  throw new Error('Usage: verify-evidence-commit.ts <application-sha>')

const state = readEvidenceCommitState(applicationSha)
assertEvidenceCommitState(state)
console.info(
  JSON.stringify({
    component: 'evidence-commit',
    event: 'verified',
    ...state
  })
)
