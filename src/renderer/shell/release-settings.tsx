import { hasMaintenanceDrafts } from './maintenance-drafts.js'
import { useEffect, useState } from 'react'
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
      .catch(() => {})
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
    if (confirmation && hasMaintenanceDrafts()) {
      setError(
        'Bitte offene Änderungen zuerst im jeweiligen Editor speichern oder verwerfen. Danach kannst du den Neustart bestätigen.'
      )
      setConfirmation(null)
      return
    }
    setBusy(true)
    setError('')
    setConfirmation(null)
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
  return (
    <>
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
          busy={busy || maintenance}
        >
          <h2>Updates</h2>
          <p>Installierte Version: {status.currentVersion}</p>
          {!status.installed && (
            <button
              disabled={busy}
              onClick={() =>
                setConfirmation({
                  text: 'SaltMarcher auf diesem Rechner installieren und neu starten?',
                  run: () => api.updates.setup({ confirmed: true })
                })
              }
            >
              Auf diesem Rechner installieren
            </button>
          )}
          <button
            disabled={busy || maintenance}
            onClick={() => void run(() => api.updates.check())}
          >
            Jetzt prüfen
          </button>
          {status.availableVersion && (
            <>
              <h3>Version {status.availableVersion}</h3>
              <p className="release-notes">{status.notes}</p>
              <button
                disabled={busy || maintenance}
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
              disabled={busy}
              onClick={() =>
                setConfirmation({
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
          <h2>Vorhandene Profile</h2>
          {profiles.map((profile) => (
            <button
              key={profile.id}
              disabled={busy || maintenance}
              onClick={() =>
                setConfirmation({
                  text: 'Bitte die Quell-App vollständig schließen. Dieses Profil übernehmen? Der aktuelle Stand wird vorher gesichert.',
                  run: () =>
                    api.updates.importProfile({
                      confirmed: true,
                      id: profile.id
                    })
                })
              }
            >
              {profile.label} übernehmen
            </button>
          ))}
          <button
            disabled={busy || maintenance}
            onClick={() =>
              setConfirmation({
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
                · {backup.valid ? 'Geprüft' : 'Beschädigt'}{' '}
                <button
                  disabled={busy || maintenance || !backup.valid}
                  onClick={() =>
                    setConfirmation({
                      text: 'Das gesamte Profil auf diese Sicherung zurücksetzen? Aktuelle Daten werden vorher gesichert.',
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
            disabled={busy || maintenance}
            onClick={() =>
              setConfirmation({
                text: 'Ein vorhandenes Electron-Profil übernehmen? Das aktuelle Profil wird vorher gesichert; die Quelle bleibt erhalten.',
                run: () => api.updates.importProfile({ confirmed: true })
              })
            }
          >
            Vorhandenes Profil übernehmen
          </button>
          <button disabled={busy || maintenance} onClick={() => setOpen(false)}>
            Schließen
          </button>
        </ModalDialog>
      )}
      {confirmation && (
        <ModalDialog
          className="release-settings"
          ariaLabel="Neustart bestätigen"
          role="alertdialog"
          onClose={() => setConfirmation(null)}
        >
          <p>{confirmation.text}</p>
          <button onClick={() => setConfirmation(null)}>Zurück</button>
          <button onClick={() => void run(confirmation.run)}>Bestätigen</button>
        </ModalDialog>
      )}
    </>
  )
}
