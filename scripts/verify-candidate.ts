import { assertCandidateReady } from './candidate-delivery.js'
import { readWorkspaceInputFingerprints } from './build-identity.js'

const state = assertCandidateReady()
const inputFingerprints = readWorkspaceInputFingerprints()
console.info(
  JSON.stringify({
    component: 'candidate-delivery',
    event: 'candidate-verified',
    ...state,
    inputFingerprints
  })
)
