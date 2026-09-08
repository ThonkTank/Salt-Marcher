import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import {
  canonicalProfilePath,
  prepareProfileDirectory
} from '../../shared/maintenance/profile-path.js'
import { acquireProfileAccess, type ProfileAccess } from './profile-access.js'

interface BrowserProfileHost {
  setPath(name: 'userData' | 'sessionData', path: string): void
}

export function browserRuntimePath(requestedProfile: string): string {
  const profile = canonicalProfilePath(requestedProfile)
  const identity = createHash('sha256').update(profile).digest('hex')
  return join(dirname(profile), '.salt-marcher-runtime', identity)
}

/** The logical profile is exclusively owned; Chromium writes to a sibling tree. */
export function openApplicationProfile(
  requestedProfile: string,
  host: BrowserProfileHost,
  legacyRoot?: string
): ProfileAccess {
  const profile = canonicalProfilePath(requestedProfile)
  const access = acquireProfileAccess(profile, 'application', legacyRoot)
  try {
    const runtime = prepareProfileDirectory(browserRuntimePath(profile))
    host.setPath('userData', runtime)
    host.setPath('sessionData', runtime)
    return access
  } catch (error) {
    access.release()
    throw error
  }
}
