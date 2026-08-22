import { assertCandidateReady, promoteCandidate } from './candidate-delivery.js'

const state = assertCandidateReady()
promoteCandidate(state)
console.info(
  JSON.stringify({
    component: 'candidate-delivery',
    event: 'candidate-promoted',
    sha: state.head,
    previousMain: state.remoteMain,
    check: state.candidate?.workflow.url,
    requiredJobs: state.candidate?.workflow.jobs,
    artifact: state.candidate?.artifact
  })
)
