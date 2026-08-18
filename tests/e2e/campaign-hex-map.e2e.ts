import { runCampaignHexMapScenario } from './support/campaign-walking-scenarios.js'

describe('campaign hex map', () => {
  it(
    'keeps a newly created hex map inside the workspace',
    runCampaignHexMapScenario
  )
})
