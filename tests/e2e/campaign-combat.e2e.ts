import { runCampaignCombatScenario } from './support/campaign-walking-scenarios.js'

describe('campaign session combat', () => {
  it(
    'builds a scene party, browses monsters and starts a scene group combat',
    runCampaignCombatScenario
  )
})
