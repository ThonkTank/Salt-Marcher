import { assertCandidateReady } from './candidate-delivery.js'

const state = assertCandidateReady()
console.info(
  JSON.stringify({
    component: 'candidate-delivery',
    event: 'candidate-verified',
    ...state
  })
)
