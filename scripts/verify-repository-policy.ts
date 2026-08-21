import { verifyLiveRepositoryPolicy } from './repository-policy.js'

const evidence = verifyLiveRepositoryPolicy()
console.info(
  JSON.stringify({
    component: 'repository-policy',
    event: 'policy-verified',
    ...evidence
  })
)
