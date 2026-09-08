export interface MaintenanceDraft {
  readonly label: string
  isDirty(): boolean
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
    choice: 'save' | 'discard'
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
          for (const [id, draft] of [...this.drafts]) {
            try {
              if (!draft.isDirty()) continue
              if (this.drafts.get(id) !== draft)
                throw new Error(
                  'Der Editor wurde während der Klärung geschlossen. Bitte den Bereich prüfen.'
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
            } catch (error) {
              failures.push({
                id,
                label: draft.label,
                message:
                  error instanceof Error
                    ? error.message
                    : 'Der Vorgang ist fehlgeschlagen. Bitte erneut versuchen.'
              })
            }
          }
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
