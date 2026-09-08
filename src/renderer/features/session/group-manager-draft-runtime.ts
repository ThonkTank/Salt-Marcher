import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'
import type { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import { groupDraftEntries, newGroupDraftKey } from './group-draft.js'
import {
  groupManagerAnyDirty,
  groupDraftSessionDirty,
  groupManagerLootDirty,
  groupManagerReducer,
  type GroupManagerAction,
  type GroupManagerState
} from './group-manager-state.js'
import { createGroupManagerCommands } from './use-group-manager-commands.js'
import type { GroupManagerPorts } from './use-group-manager-capability-ports.js'

/** Synchronous editor state and confirmed partial saves, never database access. */
export class GroupManagerDraftRuntime {
  #current: Readonly<{
    state: GroupManagerState
    snapshot: LiveSessionSnapshot
    pending: boolean
    uncertain: boolean
  }>
  #reconcile: (() => Promise<LiveSessionSnapshot | null>) | undefined
  readonly #listeners = new Set<() => void>()
  readonly #operations = new Set<Promise<unknown>>()

  constructor(state: GroupManagerState, snapshot: LiveSessionSnapshot) {
    this.#current = { state, snapshot, pending: false, uncertain: false }
  }

  readonly snapshot = () => this.#current
  readonly subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
  readonly dispatch = (action: GroupManagerAction): void => {
    this.#current = {
      ...this.#current,
      state: groupManagerReducer(this.#current.state, action)
    }
    this.#publish()
  }
  readonly acceptSnapshot = (snapshot: LiveSessionSnapshot): void => {
    if (snapshot.revision < this.#current.snapshot.revision) return
    this.#current = { ...this.#current, snapshot }
    this.#publish()
  }
  readonly failed = (
    cause: unknown,
    reconcile?: () => Promise<LiveSessionSnapshot | null>
  ): void => {
    if (capabilityErrorCode(cause) !== 'outcome_unknown') return
    this.#reconcile = reconcile
    this.#current = { ...this.#current, uncertain: true }
    this.#publish()
  }
  readonly canReconcile = (): boolean => Boolean(this.#reconcile)

  async reconcileUnknown(): Promise<boolean> {
    if (!this.#current.uncertain) return true
    if (!this.#reconcile) return false
    const snapshot = await this.#reconcile()
    if (!snapshot) return false
    this.acceptSnapshot(snapshot)
    this.#reconcile = undefined
    this.#current = { ...this.#current, uncertain: false }
    this.#publish()
    return true
  }
  readonly isDirty = (): boolean =>
    this.#current.pending ||
    this.#current.uncertain ||
    groupManagerAnyDirty(this.#current.state)

  run<Value>(operation: () => Promise<Value>): Promise<Value> {
    const result = Promise.resolve().then(operation)
    this.#operations.add(result)
    this.#current = { ...this.#current, pending: true }
    this.#publish()
    return result.finally(() => {
      this.#operations.delete(result)
      this.#current = { ...this.#current, pending: this.#operations.size > 0 }
      this.#publish()
    })
  }

  async #drain(coordinator: AsyncCommandCoordinator): Promise<void> {
    while (this.#operations.size)
      await Promise.allSettled([...this.#operations])
    await coordinator.whenIdle(['group-manager.command', 'group-manager.loot'])
    if (this.#current.uncertain && !(await this.reconcileUnknown()))
      throw new Error(
        'Der Ausgang eines Gruppen-Speicherauftrags ist unbekannt. Wartung bleibt gesperrt; den gespeicherten Kampagnenstand zuerst prüfen.'
      )
  }

  async saveAll(
    ports: GroupManagerPorts,
    coordinator: AsyncCommandCoordinator,
    lootChanged: () => void
  ): Promise<boolean> {
    await this.#drain(coordinator)
    const keys = Object.keys(this.#current.state.sessions)
    for (const key of keys) {
      const { state, snapshot } = this.#current
      const session = state.sessions[key]
      if (!session || !groupDraftSessionDirty(session)) continue
      const focused = snapshot.scene.scenes.find(
        (scene) => scene.id === snapshot.scene.focusedSceneId
      )
      if (!focused)
        throw new Error(
          'Die Szene ist nicht mehr verfügbar. Bitte die Gruppenverwaltung erneut öffnen.'
        )
      const selectedPersistedGroup = focused.groups.find(
        (group) => group.id === key
      )
      if (
        session.externalConflict ||
        (key !== newGroupDraftKey &&
          selectedPersistedGroup?.revision !== session.sourceRevision)
      )
        throw new Error(
          `Gruppe „${session.group.name || 'Ohne Namen'}“ wurde außerhalb dieses Editors geändert. Bitte den Entwurf prüfen.`
        )
      const commands = createGroupManagerCommands(
        {
          state: { ...state, activeKey: key },
          snapshot,
          focused,
          session,
          group: session.group,
          entries: groupDraftEntries(
            session.group.quantities,
            session.group.deadQuantities
          ),
          selectedPersistedGroup,
          rewardGroupId:
            key === newGroupDraftKey ? state.prospectiveGroupId : key,
          canGenerate: false,
          ports,
          dispatch: this.dispatch,
          saved: this.acceptSnapshot,
          failed: this.failed,
          lootChanged
        },
        coordinator
      )
      const saved = groupManagerLootDirty(session.loot)
        ? await commands.commitLoot()
        : await commands.save()
      if (!saved) {
        const current = this.#current.state.sessions[key]
        const detail = current?.loot.error || current?.group.message
        throw new Error(
          `Gruppe „${session.group.name || 'Ohne Namen'}“ konnte nicht gespeichert werden. ${detail || ''} Bitte Eingaben prüfen und erneut versuchen.`
        )
      }
    }
    return !this.isDirty()
  }

  async discardAll(coordinator: AsyncCommandCoordinator): Promise<boolean> {
    await this.#drain(coordinator)
    this.#current = {
      ...this.#current,
      state: {
        ...this.#current.state,
        sessions: {},
        activeKey: null,
        pendingIntent: null
      }
    }
    this.#publish()
    return true
  }

  #publish(): void {
    for (const listener of this.#listeners) listener()
  }
}
