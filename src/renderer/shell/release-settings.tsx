import { DraftResolutionDialog } from './draft-resolution-dialog.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftResolution
} from './maintenance-draft-coordinator.js'
import type { CoreProcessStatus } from '../../shared/contracts/runtime.js'
import { ProfileRecoveryNotice } from './profile-recovery-notice.js'
import { hasMaintenanceDrafts } from './maintenance-drafts.js'
import { useEffect, useRef, useState } from 'react'
import { useCapabilityApi } from '../capabilities/use-capability-api.js'
import type { ReleaseStatus } from '../../shared/contracts/release.js'
import { ModalDialog } from './modal-dialog.js'
import './release-settings.css'
export function ReleaseSettings({
  onReady
}: {
  onReady: (ready: boolean) => void
}) {
  const api = useCapabilityApi()
  const [status, setStatus] = useState<ReleaseStatus | null>(null)
  const [open, setOpen] = useState(false)
  const [coreStatus, setCoreStatus] = useState<CoreProcessStatus>('starting')
  const [backups, setBackups] = useState<
    Awaited<ReturnType<typeof api.backups.list>>
  >([])
  const [profiles, setProfiles] = useState<
    Awaited<ReturnType<typeof api.updates.profiles>>
  >([])
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<{
    text: string
    run: () => Promise<ReleaseStatus>
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const resolution = useRef<MaintenanceDraftResolution | null>(null)
  const resolving = useRef(false)
  const mounted = useRef(true)
  const [needsDrafts, setNeedsDrafts] = useState(false)
  const [draftErrors, setDraftErrors] = useState<
    readonly { id: string; text: string }[]
  >([])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (!resolving.current) {
        resolution.current?.release()
        resolution.current = null
      }
    }
  }, [])
  function requestMaintenance(value: {
    text: string
    run: () => Promise<ReleaseStatus>
  }) {
    if (
      resolution.current ||
      busy ||
      status?.phase === 'checking' ||
      status?.phase === 'downloading' ||
      status?.phase === 'maintenance'
    )
      return
    resolution.current = maintenanceDraftCoordinator.begin()
    setNeedsDrafts(hasMaintenanceDrafts())
    setDraftErrors([])
    setConfirmation(value)
  }
  function cancelMaintenance() {
    if (resolving.current) return
    resolution.current?.release()
    resolution.current = null
    setConfirmation(null)
    setDraftErrors([])
  }
  async function confirmMaintenance(choice?: 'save' | 'discard') {
    if (!confirmation || !resolution.current || resolving.current) return
    if (hasMaintenanceDrafts() && !choice) {
      setNeedsDrafts(true)
      return
    }
    resolving.current = true
    setBusy(true)
    setDraftErrors([])
    try {
      const failures = await resolution.current.resolve(choice ?? 'check')
      if (failures.length) {
        setNeedsDrafts(hasMaintenanceDrafts())
        setDraftErrors(
          failures.map((failure) => ({
            id: failure.id,
            text: `${failure.label}: ${failure.message}`
          }))
        )
        return
      }
      if (!mounted.current) return
      const next = await confirmation.run()
      setStatus(next)
      setConfirmation(null)
      if (next.phase !== 'maintenance') {
        resolution.current.release()
        resolution.current = null
      }
    } catch {
      setDraftErrors([
        {
          id: 'maintenance',
          text: 'Der Vorgang konnte nicht abgeschlossen werden. Bitte erneut versuchen oder abbrechen.'
        }
      ])
    } finally {
      resolving.current = false
      if (!mounted.current) {
        resolution.current?.release()
        resolution.current = null
      } else setBusy(false)
    }
  }
  useEffect(() => {
    let active = true
    const accept = (value: CoreProcessStatus) => {
      if (active) setCoreStatus(value)
    }
    void api.runtime
      .coreStatus()
      .then(accept)
      .catch(() => accept('unavailable'))
    const unsubscribe = api.runtime.onCoreStatus(accept)
    return () => {
      active = false
      unsubscribe()
    }
  }, [api])
  useEffect(() => {
    let active = true
    void api.updates
      .status()
      .then((value) => {
        if (active) {
          setStatus(value)
          onReady(!value.enabled || value.installed)
          if (value.enabled && !value.installed) setOpen(true)
        }
      })
      .catch(() => {
        if (active) onReady(true)
      })
    const unsubscribe = api.updates.onStatus((value) => {
      if (active) setStatus(value)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [api, onReady])
  useEffect(() => {
    if (!open) return
    let active = true
    void api.updates
      .profiles()
      .then((value) => {
        if (active) setProfiles(value)
      })
      .catch(() => {})
    void api.backups
      .list()
      .then((value) => {
        if (active) setBackups(value)
      })
      .catch(() => {
        if (active) setError('Sicherungen konnten nicht gelesen werden.')
      })
    return () => {
      active = false
    }
  }, [api, open])
  if (!status?.enabled) return null
  async function run(action: () => Promise<ReleaseStatus>) {
    if (
      resolution.current ||
      busy ||
      status?.phase === 'checking' ||
      status?.phase === 'downloading' ||
      status?.phase === 'maintenance'
    )
      return
    setBusy(true)
    setError('')
    try {
      setStatus(await action())
    } catch {
      setError(
        'Der Vorgang konnte nicht abgeschlossen werden. Bitte erneut versuchen.'
      )
    } finally {
      setBusy(false)
    }
  }
  const maintenance = status.phase === 'maintenance'
  const actionBusy =
    busy ||
    maintenance ||
    status.phase === 'checking' ||
    status.phase === 'downloading'
  const closeBlocked = maintenance || confirmation !== null
  return (
    <>
      <ProfileRecoveryNotice
        status={coreStatus}
        openRecovery={() => setOpen(true)}
      />
      <button
        className="release-settings-trigger"
        onClick={() => setOpen(true)}
      >
        Einstellungen{status.availableVersion ? ' · Update verfügbar' : ''}
      </button>
      {open && (
        <ModalDialog
          className="release-settings"
          ariaLabel="Einstellungen: Updates und Sicherungen"
          onClose={() => setOpen(false)}
          busy={closeBlocked}
        >
          <h2>Updates</h2>
          <p>Installierte Version: {status.currentVersion}</p>
          {!status.installed && (
            <button
              disabled={actionBusy}
              onClick={() =>
                requestMaintenance({
                  text: 'SaltMarcher auf diesem Rechner installieren und neu starten?',
                  run: () => api.updates.setup({ confirmed: true })
                })
              }
            >
              Auf diesem Rechner installieren
            </button>
          )}
          <button
            disabled={actionBusy}
            onClick={() => void run(() => api.updates.check())}
          >
            Jetzt prüfen
          </button>
          {status.availableVersion && (
            <>
              <h3>Version {status.availableVersion}</h3>
              <p className="release-notes">{status.notes}</p>
              <button
                disabled={actionBusy}
                onClick={() => void run(() => api.updates.download())}
              >
                Herunterladen
              </button>
            </>
          )}
          {status.phase === 'downloading' && (
            <progress
              aria-label="Downloadfortschritt"
              max={1}
              value={status.progress}
            />
          )}
          {status.phase === 'downloaded' && (
            <button
              disabled={actionBusy}
              onClick={() =>
                requestMaintenance({
                  text: 'Speichere offene Änderungen vor dem Neustart. Jetzt sichern, installieren und neu starten?',
                  run: () => api.updates.install({ confirmed: true })
                })
              }
            >
              Installieren und neu starten
            </button>
          )}
          <p role="status">{status.message}</p>
          {error && <p role="alert">{error}</p>}
          <button
            disabled={actionBusy}
            onClick={() =>
              requestMaintenance({
                text: 'Ein vollständiges Profil auswählen? Der aktuelle Stand wird vor der Übernahme gesichert.',
                run: () =>
                  api.updates.importProfile({
                    confirmed: true,
                    mode: 'profile'
                  })
              })
            }
          >
            Profilordner übernehmen
          </button>
          <h2>Sicherung eines vorhandenen Profils übernehmen</h2>
          {profiles
            .filter((profile) => profile.id === 'local')
            .map((profile) => (
              <button
                key={`direct-${profile.id}`}
                disabled={actionBusy}
                onClick={() =>
                  requestMaintenance({
                    text: `Das vollständige Profil von ${profile.label} auswählen? Der aktuelle Stand wird vorher gesichert.`,
                    run: () =>
                      api.updates.importProfile({
                        confirmed: true,
                        id: profile.id,
                        mode: 'profile'
                      })
                  })
                }
              >
                Profil von {profile.label} übernehmen
              </button>
            ))}
          {profiles.map((profile) => (
            <button
              key={profile.id}
              disabled={actionBusy}
              onClick={() =>
                requestMaintenance({
                  text: 'Eine geprüfte Sicherung dieses Profils auswählen und übernehmen? Der aktuelle Stand wird vorher gesichert.',
                  run: () =>
                    api.updates.importProfile({
                      confirmed: true,
                      id: profile.id
                    })
                })
              }
            >
              Sicherung von {profile.label} auswählen
            </button>
          ))}
          <button
            disabled={actionBusy}
            onClick={() =>
              requestMaintenance({
                text: 'Mit einem leeren Profil neu anfangen? Das bisherige Profil wird vorher vollständig gesichert.',
                run: () => api.updates.newProfile({ confirmed: true })
              })
            }
          >
            Mit leerem Profil anfangen
          </button>
          <h2>Sicherungen</h2>
          <p>
            Eine Wiederherstellung ersetzt das gesamte Profil. Der aktuelle
            Stand wird zuvor gesichert.
          </p>
          {backups.length === 0 && <p>Noch keine Sicherungen vorhanden.</p>}
          <ul>
            {backups.map((backup) => (
              <li key={backup.id}>
                {new Date(backup.createdAt).toLocaleString('de-DE')} · Version{' '}
                {backup.version} · {(backup.bytes / 1024 / 1024).toFixed(1)} MB
                · {backup.valid ? 'Geprüft' : 'Beschädigt'} ·{' '}
                {backup.scope === 'profile'
                  ? 'Vollständiges Profil'
                  : 'Ältere Kampagnendatensicherung'}{' '}
                <button
                  disabled={actionBusy || !backup.valid}
                  onClick={() =>
                    requestMaintenance({
                      text:
                        backup.scope === 'profile'
                          ? 'Das gesamte Profil auf diese Sicherung zurücksetzen? Aktuelle Daten werden vorher gesichert.'
                          : 'Diese ältere Sicherung enthält nur Kampagnendaten. Sie ersetzt das Profil; zusätzliche Dateien des aktuellen Profils bleiben in der vorher erstellten Sicherung erhalten. Fortfahren?',
                      run: () =>
                        api.backups.restore({ id: backup.id, confirmed: true })
                    })
                  }
                >
                  Wiederherstellen
                </button>
              </li>
            ))}
          </ul>
          <button
            disabled={actionBusy}
            onClick={() =>
              requestMaintenance({
                text: 'Eine geprüfte SaltMarcher-Sicherung übernehmen? Der aktuelle Stand wird vorher gesichert; die Quelle bleibt erhalten.',
                run: () => api.updates.importProfile({ confirmed: true })
              })
            }
          >
            Sicherungsordner auswählen
          </button>
          <button disabled={closeBlocked} onClick={() => setOpen(false)}>
            Schließen
          </button>
        </ModalDialog>
      )}
      {confirmation && (
        <DraftResolutionDialog
          title="Neustart bestätigen"
          text={confirmation.text}
          errors={draftErrors}
          draftLabels={maintenanceDraftCoordinator.dirtyLabels()}
          needsDrafts={needsDrafts}
          busy={busy}
          cancel={cancelMaintenance}
          confirm={(choice) => void confirmMaintenance(choice)}
        />
      )}
    </>
  )
}
