import { withSourceProfileAccess } from './source-profile-access.js'
import { lstatSync, readlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { MaintenanceCoordinator } from '../../shared/maintenance/coordinator.js'
import { canonicalProfilePath } from '../../shared/maintenance/profile-path.js'
import { readAppImageProfileProtocol } from '../../shared/maintenance/appimage-launcher.js'
import { validateMaintenanceLauncher } from '../../shared/maintenance/launcher.js'
import { sha256 } from '../../shared/maintenance/files.js'

/** Caller must hold source runtime and launch leases; never repairs the source. */
export function qualifySourceProfile(installationRoot: string): string {
  try {
    const root = canonicalProfilePath(installationRoot)
    const state = new MaintenanceCoordinator(root).read()
    if (
      !state ||
      (state.phase !== 'committed' && state.phase !== 'rolled-back')
    )
      throw new Error('Die Quellinstallation hat keine abgeschlossene Wartung.')
    const program = state.phase === 'committed' ? state.next : state.previous
    if (!program) throw new Error('Die bestätigte Quellversion fehlt.')
    const current = join(root, 'current')
    if (
      !lstatSync(current).isSymbolicLink() ||
      resolve(root, readlinkSync(current)) !==
        join(root, 'deployments', program.deployment)
    )
      throw new Error(
        'Der Quellstartpunkt stimmt nicht mit der bestätigten Version überein.'
      )
    const image = join(
      root,
      'deployments',
      program.deployment,
      'SaltMarcher.AppImage'
    )
    if (sha256(image) !== program.sha256)
      throw new Error('Die Quellprogrammdatei wurde verändert.')
    validateMaintenanceLauncher(root)
    readAppImageProfileProtocol(image, program.sha256)
    const profile = join(root, 'profile')
    if (!lstatSync(profile).isDirectory())
      throw new Error('Das Quellprofil fehlt.')
    return canonicalProfilePath(profile)
  } catch (cause) {
    throw new Error(
      'Diese Quelle ist nicht für eine direkte Profilübernahme qualifiziert. Bitte eine geprüfte Sicherung aus der Quellinstallation auswählen; offene Wartung zuerst dort abschließen.',
      { cause }
    )
  }
}

/** Admission and export share one lease lifetime, including final provenance check. */
export function withQualifiedSourceProfile<T>(
  installationRoot: string,
  targetProfile: string,
  exportProfile: (profile: string) => Promise<T>
): Promise<T> {
  return withSourceProfileAccess(installationRoot, targetProfile, async () => {
    const profile = qualifySourceProfile(installationRoot)
    const result = await exportProfile(profile)
    qualifySourceProfile(installationRoot)
    return result
  })
}
