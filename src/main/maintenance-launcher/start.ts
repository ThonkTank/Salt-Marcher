import { withLaunchReservation } from '../local-profile/launch-reservation.js'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readlinkSync,
  rmdirSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { sha256 } from '../../shared/maintenance/files.js'
import { MaintenanceCoordinator } from '../../shared/maintenance/coordinator.js'
import { acquireProfileLock } from '../local-profile/local-profile-lock.js'

/** No SQLite or normal app bootstrap may run before this admission gate. */
export function admitDesktopStart(root: string): string {
  const lock = acquireProfileLock(join(root, 'runtime.lock'), 'installer')
  try {
    const coordinator = new MaintenanceCoordinator(root)
    coordinator.rollback()
    const state = coordinator.read()
    if (!state)
      throw new Error('Der Wartungsbeleg fehlt. Bitte Installation prüfen.')
    const expected = state.phase === 'committed' ? state.next : state.previous
    if (!expected)
      throw new Error(
        'Keine bestätigte Installation vorhanden. Bitte Installation erneut ausführen.'
      )
    const current = join(root, 'current')
    if (!lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink())
      throw new Error(
        'Keine bestätigte Installation vorhanden. Bitte Installation erneut ausführen.'
      )
    const deployment = resolve(root, readlinkSync(current))
    if (deployment !== join(root, 'deployments', basename(deployment)))
      throw new Error(
        'Der Programmstartpunkt liegt außerhalb der Installation.'
      )
    const executable = join(deployment, 'SaltMarcher.AppImage')
    if (!existsSync(executable))
      throw new Error(
        'Die installierte Programmdatei fehlt. Bitte Installation prüfen.'
      )
    if (
      basename(deployment) !== expected.deployment ||
      sha256(executable) !== expected.sha256
    )
      throw new Error(
        'Die installierte Programmversion stimmt nicht mit dem Wartungsbeleg überein.'
      )
    return executable
  } finally {
    lock.release()
  }
}

export function launchDesktop(
  root: string,
  arguments_: readonly string[]
): number {
  return withLaunchReservation(root, () =>
    launchReservedDesktop(root, arguments_)
  )
}

function launchReservedDesktop(
  root: string,
  arguments_: readonly string[]
): number {
  const executable = admitDesktopStart(root)
  const environment = { ...process.env }
  for (const key of ['ELECTRON_RUN_AS_NODE', 'APPIMAGE', 'APPDIR', 'OWD'])
    delete environment[key]
  // AppImage runtimes may share a content-addressed extraction cache. A child
  // running the same image must not remove its interpreter's active cache.
  const temporary = mkdtempSync(join(tmpdir(), 'salt-desktop-'))
  environment['TMPDIR'] = temporary
  try {
    const result = spawnSync(
      executable,
      [`--user-data-dir=${join(root, 'profile')}`, ...arguments_],
      {
        stdio: 'inherit',
        env: environment
      }
    )
    if (result.error)
      throw new Error(
        'Das installierte Programm konnte nicht gestartet werden.',
        { cause: result.error }
      )
    // Never interpret a later runtime failure as permission to roll back user work.
    return result.status ?? 1
  } finally {
    try {
      rmdirSync(temporary)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOTEMPTY' && code !== 'ENOENT')
        console.warn(
          'Das temporäre Laufzeitverzeichnis konnte nicht entfernt werden.',
          error
        )
    }
  }
}
