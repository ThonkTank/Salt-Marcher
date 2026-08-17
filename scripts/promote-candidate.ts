import { assertCandidateReady, promoteCandidate } from './candidate-delivery.js'

const state = assertCandidateReady()
promoteCandidate(state)
console.info(
  JSON.stringify({
    component: 'candidate-delivery',
    event: 'candidate-promoted',
    sha: state.head,
    previousMain: state.remoteMain,
    check: state.successfulCheckUrl
  })
)
