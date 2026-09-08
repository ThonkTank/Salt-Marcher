export function installedProfileReadbacks(
  readyCampaignCount: number,
  activeCampaignId: string | null,
  activeCampaignExists: boolean
) {
  const empty = readyCampaignCount === 0
  return [
    {
      name: 'installation.readyCampaignCount',
      expected: 'a nonnegative campaign count; a new profile may be empty',
      actual: readyCampaignCount,
      passed:
        Number.isSafeInteger(readyCampaignCount) && readyCampaignCount >= 0
    },
    {
      name: 'installation.activeCampaign',
      expected: empty
        ? 'no active campaign in an empty profile'
        : 'existing ready campaign',
      actual: activeCampaignId,
      passed: empty
        ? activeCampaignId === null
        : activeCampaignId !== null && activeCampaignExists
    }
  ]
}
