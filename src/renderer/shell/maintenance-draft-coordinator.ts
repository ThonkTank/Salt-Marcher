/** Returned by dialog owners, including while the lazy editor is loading. */
export interface MaintenanceDraftHandle {
  readonly id: string
  isOpen(): boolean
}

export interface MaintenanceDraft {
  readonly label: string
  /** Action and lifetime concerns used by targeted transitions. */
  readonly concerns?: readonly MaintenanceDraftConcern[]
  /** Child editors whose results must be settled before this owner. */
  readonly dependsOn?: readonly string[]
  isDirty(): boolean
  /** Finish only writes already requested by automatic persistence. */
  settleBackgroundWrites?(): Promise<void>
  /** Resolve true only when the owning editor confirmed successful persistence. */
  save?(): Promise<boolean>
  discard?(): Promise<boolean>
}
export type MaintenanceDraftConcern =
  `${'workspace' | 'scene' | 'window' | 'party' | 'travel-route' | 'travel-command' | 'combat' | 'groups' | 'character' | 'group'}:${string}`
export type MaintenanceDraftSelection =
  | Readonly<{ kind: 'all' }>
  | Readonly<{ kind: 'ids'; ids: readonly string[] }>
  | Readonly<{
      kind: 'concerns'
      concerns: readonly MaintenanceDraftConcern[]
    }>

export const allMaintenanceDrafts: MaintenanceDraftSelection = { kind: 'all' }
export const draftConcern = {
  workspace: (workspaceId: string) => `workspace:${workspaceId}` as const,
  scene: (sceneId: string) => `scene:${sceneId}` as const,
  window: (windowId: string) => `window:${windowId}` as const,
  party: (sceneId: string) => `party:${sceneId}` as const,
  travelRoute: (sceneId: string) => `travel-route:${sceneId}` as const,
  travelCommand: (sceneId: string) => `travel-command:${sceneId}` as const,
  combat: (sceneId: string) => `combat:${sceneId}` as const,
  groups: (sceneId: string) => `groups:${sceneId}` as const,
  character: (characterId: string) => `character:${characterId}` as const,
  group: (groupId: string) => `group:${groupId}` as const
}
export interface DraftResolutionFailure {
  readonly id: string
  readonly label: string
  readonly message: string
}
export interface MaintenanceDraftResolution {
  resolve(
    choice: 'save' | 'discard' | 'check'
  ): Promise<readonly DraftResolutionFailure[]>
  release(): void
}

/** Owns coordination only; every editor retains its draft and persistence logic. */
export class MaintenanceDraftCoordinator {
  private readonly drafts = new Map<string, MaintenanceDraft>()
  private readonly listeners = new Set<() => void>()
  private globallyLocked = false
  private readonly lockedDrafts = new Set<string>()
  private activeSelection: MaintenanceDraftSelection | null = null

  register(id: string, draft: MaintenanceDraft): () => void {
    if (this.drafts.has(id)) throw new Error('Editor ist bereits registriert.')
    this.drafts.set(id, draft)
    if (this.activeSelection && !this.globallyLocked) {
      const selected = this.selected(this.activeSelection).some(
        ([selectedId]) => selectedId === id
      )
      const required = [...this.lockedDrafts].some((lockedId) =>
        (this.drafts.get(lockedId)?.dependsOn ?? []).includes(id)
      )
      if (selected || required) {
        this.lockDraft(id)
        this.publish()
      }
    }
    return () => {
      if (this.drafts.get(id) === draft) this.drafts.delete(id)
    }
  }
  private selected(
    selection: MaintenanceDraftSelection = allMaintenanceDrafts
  ): readonly [string, MaintenanceDraft][] {
    if (selection.kind === 'all') return [...this.drafts]
    if (selection.kind === 'ids')
      return selection.ids.flatMap((id) => {
        const draft = this.drafts.get(id)
        return draft ? ([[id, draft]] as const) : []
      })
    const concerns = new Set(selection.concerns)
    return [...this.drafts].filter(([, draft]) =>
      (draft.concerns ?? []).some((concern) => concerns.has(concern))
    )
  }
  hasDirty(
    selection: MaintenanceDraftSelection = allMaintenanceDrafts
  ): boolean {
    return this.selected(selection).some(([, draft]) => draft.isDirty())
  }
  async settleBackgroundWrites(
    selection: MaintenanceDraftSelection = allMaintenanceDrafts
  ): Promise<void> {
    if (this.isCoordinating()) return
    await Promise.allSettled(
      this.selected(selection).map(([, draft]) =>
        Promise.resolve().then(() => draft.settleBackgroundWrites?.())
      )
    )
  }
  dirtyLabels(
    selection: MaintenanceDraftSelection = allMaintenanceDrafts
  ): readonly string[] {
    return this.selected(selection)
      .filter(([, draft]) => draft.isDirty())
      .map(([, draft]) => draft.label)
  }
  /** Application-wide editing barrier used by quit and maintenance. */
  isLocked = (): boolean => this.globallyLocked
  isCoordinating = (): boolean => this.activeSelection !== null
  isDraftLocked = (id: string): boolean =>
    this.globallyLocked || this.lockedDrafts.has(id)
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  private publish(): void {
    for (const listener of this.listeners) listener()
  }
  private lockDraft(id: string): void {
    if (this.lockedDrafts.has(id)) return
    const draft = this.drafts.get(id)
    if (!draft) return
    this.lockedDrafts.add(id)
    for (const child of draft.dependsOn ?? []) this.lockDraft(child)
  }

  begin(
    selection: MaintenanceDraftSelection = allMaintenanceDrafts
  ): MaintenanceDraftResolution {
    if (this.isCoordinating())
      throw new Error('Eine Wartungsklärung läuft bereits.')
    const initialRoots = this.selected(selection).map(([id]) => id)
    this.activeSelection = selection
    if (selection.kind === 'all') this.globallyLocked = true
    else for (const id of initialRoots) this.lockDraft(id)
    this.publish()
    let released = false
    let resolving = false
    return {
      resolve: async (choice) => {
        if (released || resolving)
          throw new Error('Diese Wartungsklärung ist nicht verfügbar.')
        resolving = true
        const failures: DraftResolutionFailure[] = []
        try {
          const snapshot = new Map(this.drafts)
          const roots = this.selected(selection).map(([id]) => id)
          const initiallyDirty = new Set(
            [...snapshot]
              .filter(([, draft]) => {
                try {
                  return draft.isDirty()
                } catch {
                  return true
                }
              })
              .map(([id]) => id)
          )
          const states = new Map<string, 'visiting' | 'succeeded' | 'failed'>()
          const resolveDraft = async (id: string): Promise<boolean> => {
            if (states.get(id) === 'succeeded') return true
            if (states.get(id) === 'failed') return false
            const draft = snapshot.get(id)!
            try {
              if (states.get(id) === 'visiting')
                throw new Error(
                  'Die Editor-Abhängigkeiten enthalten einen Kreis. Bitte Wartung abbrechen und die Bereiche prüfen.'
                )
              states.set(id, 'visiting')
              const dependencies = [...(draft.dependsOn ?? [])]
              let childrenResolved = true
              for (const child of dependencies) {
                if (!snapshot.has(child))
                  throw new Error(
                    'Ein abhängiger Editor ist nicht verfügbar. Bitte Wartung abbrechen und den Bereich erneut öffnen.'
                  )
                if (!(await resolveDraft(child))) childrenResolved = false
              }
              if (!childrenResolved)
                throw new Error(
                  'Ein abhängiger Editor konnte nicht geklärt werden. Bitte dessen Fehler zuerst beheben.'
                )
              if (
                (draft.dependsOn ?? []).some(
                  (child) => !dependencies.includes(child)
                )
              )
                throw new Error(
                  'Ein neuer abhängiger Editor ist hinzugekommen. Bitte erneut prüfen.'
                )
              if (
                this.drafts.get(id) !== draft &&
                !initiallyDirty.has(id) &&
                !draft.isDirty()
              ) {
                states.set(id, 'succeeded')
                return true
              }
              if (this.drafts.get(id) !== draft)
                throw new Error(
                  'Der Editor wurde während der Klärung geschlossen. Bitte den Bereich prüfen.'
                )
              if (draft.isDirty()) {
                if (choice === 'check')
                  throw new Error(
                    'Dieser Bereich enthält offene Änderungen. Bitte Speichern oder Verwerfen wählen.'
                  )
                const operation =
                  choice === 'save'
                    ? draft.save?.bind(draft)
                    : draft.discard?.bind(draft)
                if (!operation)
                  throw new Error(
                    'Bitte Änderungen in diesem Bereich zuerst speichern oder verwerfen.'
                  )
                if (!(await operation()))
                  throw new Error(
                    choice === 'save'
                      ? 'Speichern wurde nicht bestätigt. Bitte Eingaben oder Verbindung prüfen.'
                      : 'Verwerfen wurde nicht bestätigt. Bitte den Bereich prüfen.'
                  )
                if (this.drafts.get(id) === draft && draft.isDirty())
                  throw new Error(
                    'Dieser Bereich enthält weiterhin offene Änderungen. Bitte erneut prüfen.'
                  )
              }
              states.set(id, 'succeeded')
              return true
            } catch (error) {
              states.set(id, 'failed')
              if (!failures.some((failure) => failure.id === id))
                failures.push({
                  id,
                  label: draft.label,
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Der Vorgang ist fehlgeschlagen. Bitte erneut versuchen.'
                })
              return false
            }
          }
          for (const id of roots) await resolveDraft(id)
          for (const [id, draft] of this.drafts) {
            if (
              selection.kind !== 'all' &&
              !this.selected(selection).some(
                ([selectedId]) => selectedId === id
              ) &&
              !this.lockedDrafts.has(id)
            )
              continue
            if (failures.some((failure) => failure.id === id)) continue
            try {
              if (!draft.isDirty()) continue
              failures.push({
                id,
                label: draft.label,
                message:
                  'Dieser Bereich enthält weiterhin offene Änderungen. Bitte erneut prüfen.'
              })
            } catch (error) {
              failures.push({
                id,
                label: draft.label,
                message:
                  error instanceof Error
                    ? error.message
                    : 'Der Änderungsstand konnte nicht geprüft werden.'
              })
            }
          }
          return failures
        } finally {
          resolving = false
        }
      },
      release: () => {
        if (resolving)
          throw new Error(
            'Laufende Speichervorgänge müssen zuerst abgeschlossen werden.'
          )
        if (released) return
        released = true
        this.activeSelection = null
        this.globallyLocked = false
        this.lockedDrafts.clear()
        this.publish()
      }
    }
  }
}

export const maintenanceDraftCoordinator = new MaintenanceDraftCoordinator()
