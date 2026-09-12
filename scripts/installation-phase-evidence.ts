import type { HandoffPhaseEvidence } from './delivery-contract.js'
import type {
  LocalInstallationResult,
  LocalInstallationTarget
} from './local-installation/contract.js'

/** Later installation steps must not change an earlier phase's proof. */
export function installationPhaseEvidence(
  installed: LocalInstallationResult,
  target: LocalInstallationTarget
): Pick<
  HandoffPhaseEvidence,
  | 'sourceDataHash'
  | 'backupManifestSha256'
  | 'deploymentManifestSha256'
  | 'installedSha256'
> {
  return {
    sourceDataHash: installed.sourceDataHash,
    backupManifestSha256: installed.backupManifestSha256 ?? null,
    deploymentManifestSha256:
      target === 'backup-created'
        ? null
        : (installed.deploymentManifestSha256 ?? null),
    installedSha256:
      target === 'activated' ? (installed.installedSha256 ?? null) : null
  }
}
