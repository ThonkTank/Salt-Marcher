/** Returned by dialog owners, including while the lazy editor is loading. */
export interface MaintenanceDraftHandle {
  readonly id: string
  isOpen(): boolean
}

export interface MaintenanceDraft {
  readonly label: string
  /** Child editors whose results must be settled before this owner. */
  readonly dependsOn?: readonly string[]
  isDirty(): boolean
  /** Finish only writes already requested by automatic persistence. */
  settleBackgroundWrites?(): Promise<void>
  /** Resolve true only when the owning editor confirmed successful persistence. */
  save?(): Promise<boolean>
  discard?(): Promise<boolean>
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
  private locked = false

  register(id: string, draft: MaintenanceDraft): () => void {
    if (this.drafts.has(id)) throw new Error('Editor ist bereits registriert.')
    this.drafts.set(id, draft)
    return () => {
      if (this.drafts.get(id) === draft) this.drafts.delete(id)
    }
  }
  hasDirty(): boolean {
    return [...this.drafts.values()].some((draft) => draft.isDirty())
  }
  async settleBackgroundWrites(): Promise<void> {
    if (this.locked) return
    await Promise.allSettled(
      [...this.drafts.values()].map((draft) =>
        Promise.resolve().then(() => draft.settleBackgroundWrites?.())
      )
    )
  }
  dirtyLabels(): readonly string[] {
    return [...this.drafts.values()]
      .filter((draft) => draft.isDirty())
      .map((draft) => draft.label)
  }
  isLocked = (): boolean => this.locked
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  private publish(): void {
    for (const listener of this.listeners) listener()
  }

  begin(): MaintenanceDraftResolution {
    if (this.locked) throw new Error('Eine Wartungsklärung läuft bereits.')
    this.locked = true
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
          for (const id of snapshot.keys()) await resolveDraft(id)
          for (const [id, draft] of this.drafts) {
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
        this.locked = false
        this.publish()
      }
    }
  }
}

export const maintenanceDraftCoordinator = new MaintenanceDraftCoordinator()
