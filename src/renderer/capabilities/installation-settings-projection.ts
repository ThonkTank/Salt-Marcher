import type { SaltMarcherApi } from '../../shared/contracts/capability-api.js'
import type { InstallationSettings } from '../../shared/contracts/settings.js'
import { AsyncCommandCoordinator } from '../async/async-command-coordinator.js'
import { KeyedReadProjectionOwner } from '../async/keyed-read-projection-owner.js'
import type { ReadProjectionExecution } from '../async/renderer-execution-contract.js'

export const installationSettingsAuthority = Object.freeze({
  scope: 'installation.settings',
  entityKey: null
})

export class InstallationSettingsProjection {
  readonly #owner: KeyedReadProjectionOwner<InstallationSettings>
  readonly #execution: ReadProjectionExecution<
    SaltMarcherApi['settings']['read'],
    'installation.settings'
  >

  public constructor(api: SaltMarcherApi) {
    const operation: SaltMarcherApi['settings']['read'] = () =>
      api.settings.read()
    this.#owner = new KeyedReadProjectionOwner(
      new AsyncCommandCoordinator(),
      (settings) => settings.revision
    )
    this.#execution = Object.freeze({
      kind: 'read-projection',
      authority: installationSettingsAuthority,
      operation
    })
  }

  public readonly subscribe = (listener: () => void): (() => void) =>
    this.#owner.subscribe(installationSettingsAuthority, listener)

  public readonly snapshot = () =>
    this.#owner.snapshot(installationSettingsAuthority)

  public readonly current = (): InstallationSettings | null =>
    this.#owner.current(installationSettingsAuthority)

  public readonly load = () => this.#owner.ensure(this.#execution)

  public readonly refresh = async (): Promise<InstallationSettings> => {
    let outcome = await this.#owner.invalidate(this.#execution)
    if (outcome.status === 'stale')
      outcome = await this.#owner.ensure(this.#execution)
    if (outcome.status === 'accepted' || outcome.status === 'cached')
      return outcome.value
    if (outcome.status === 'failure') throw outcome.cause
    throw new Error('Installation settings projection remained stale')
  }

  public readonly publish = (settings: InstallationSettings): boolean =>
    this.#owner.publish(installationSettingsAuthority, settings)

  public readonly dispose = (): void => this.#owner.dispose()
}
