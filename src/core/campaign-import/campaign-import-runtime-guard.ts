export type CampaignImportExecutionAuthority =
  | Readonly<{ kind: 'installed-utility' }>
  | Readonly<{ kind: 'deployment-receipt'; deploymentSha: string }>

/**
 * Filesystem maintenance callers must pass this guard before constructing a
 * CampaignStore. Normal product calls already execute inside the installed,
 * schema-compatible Utility process.
 */
export function assertCampaignImportExecutionAuthority(
  authority: CampaignImportExecutionAuthority,
  runtimeDeploymentSha: string
): void {
  if (authority.kind === 'installed-utility') return
  if (
    !/^[0-9a-f]{40}$/.test(authority.deploymentSha) ||
    authority.deploymentSha !== runtimeDeploymentSha
  )
    throw new Error('Campaign import deployment receipt does not match runtime')
}

export function openAuthorizedCampaignImportRuntime<T>(
  authority: CampaignImportExecutionAuthority,
  runtimeDeploymentSha: string,
  openProfile: () => T
): T {
  assertCampaignImportExecutionAuthority(authority, runtimeDeploymentSha)
  return openProfile()
}
