import { runCampaignPseudoLocaleScenario } from './support/campaign-walking-scenarios.js'

describe('campaign pseudo locale', () => {
  it(
    'survives the pseudo locale without accessibility regressions',
    runCampaignPseudoLocaleScenario
  )
})
