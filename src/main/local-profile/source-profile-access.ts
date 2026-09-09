import { isAbsolute, join, relative, sep } from 'node:path'
import { canonicalProfilePath } from '../../shared/maintenance/profile-path.js'
import { acquireLaunchReservation } from './launch-reservation.js'
import { acquireProfileAccess } from './profile-access.js'

function overlaps(left: string, right: string): boolean {
  const path = relative(left, right)
  return path === '' || (!isAbsolute(path) && path.split(sep)[0] !== '..')
}

/** Only call after qualifying the source application's shared-lock protocol. */
export async function withSourceProfileAccess<T>(
  installationRoot: string,
  targetProfile: string,
  exportProfile: (profile: string) => Promise<T>
): Promise<T> {
  const root = canonicalProfilePath(installationRoot)
  const source = canonicalProfilePath(join(root, 'profile'))
  const target = canonicalProfilePath(targetProfile)
  if (overlaps(source, target) || overlaps(target, source))
    throw new Error(
      'Quelle und Ziel müssen getrennte Profile sein. Bitte ein anderes Profil auswählen.'
    )
  const reservation = acquireLaunchReservation(root)
  try {
    const access = acquireProfileAccess(source, 'installer', root)
    try {
      return await exportProfile(access.profile)
    } finally {
      access.release()
    }
  } finally {
    reservation.release()
  }
}
