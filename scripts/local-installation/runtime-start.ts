import { join } from 'node:path'
import { acquireProfileAccess } from '../../src/main/local-profile/profile-access.js'
import { MaintenanceCoordinator } from '../../src/shared/maintenance/coordinator.js'

/** The child acquires its own lock; the parent never holds it across launch. */
export function verifyLocalRuntimeStartup<T>(
  root: string,
  artifactSha256: string,
  launch: (completionArguments: readonly string[]) => T
): T {
  const coordinator = new MaintenanceCoordinator(root)
  const locked = <R>(operation: () => R): R => {
    const lock = acquireProfileAccess(join(root, 'profile'), 'installer', root)
    try {
      return operation()
    } finally {
      lock.release()
    }
  }
  const pending = locked(() => {
    const state = coordinator.read()
    if (!state || state.phase === 'committed' || state.phase === 'rolled-back')
      return null
    if (
      state.phase !== 'awaiting-start' ||
      state.next.sha256 !== artifactSha256
    )
      throw new Error(
        'Local maintenance must be recovered before runtime verification'
      )
    return state.id
  })
  try {
    const result = launch(pending ? ['--maintenance-complete', pending] : [])
    if (pending)
      locked(() => {
        const state = coordinator.read()
        if (state?.id !== pending || state.phase !== 'committed')
          throw new Error(
            'Installed runtime did not durably accept its maintenance transaction'
          )
      })
    return result
  } catch (error) {
    if (pending)
      locked(() => {
        if (coordinator.read()?.id === pending) coordinator.rollback()
      })
    throw error
  }
}
