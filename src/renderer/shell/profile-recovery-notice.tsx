import type { CoreProcessStatus } from '../../shared/contracts/runtime.js'

const recoveryMessages: Partial<Record<CoreProcessStatus, string>> = {
  'incompatible-data':
    'Dieses Datenformat kann mit dieser App-Version nicht geöffnet werden. Wähle eine passende Sicherung oder beginne ausdrücklich mit einem leeren Profil.',
  'corrupt-data':
    'Die Profildaten konnten nicht geprüft werden. Du kannst eine Sicherung wiederherstellen; der aktuelle Stand wird vorher erhalten.',
  'access-denied':
    'Auf die Profildaten kann nicht zugegriffen werden. Prüfe die Zugriffsrechte des Profilordners, bevor du erneut versuchst, ihn zu öffnen.',
  unavailable:
    'Der Datenprozess ist nicht verfügbar. Die Sicherungen bleiben unabhängig davon erreichbar.',
  'resource-missing':
    'Benötigte Programmdaten fehlen. Prüfe die Installation. Deine Sicherungen kannst du hier weiterhin einsehen.',
  'invalid-configuration':
    'Die App-Konfiguration verhindert den Datenstart. Prüfe die Installation. Deine Sicherungen bleiben erreichbar.'
}

export function ProfileRecoveryNotice({
  status,
  openRecovery
}: {
  status: CoreProcessStatus
  openRecovery: () => void
}) {
  const message = recoveryMessages[status]
  if (!message) return null
  return (
    <section role="alert" aria-label="Profilwiederherstellung">
      <h2>Das Profil ist nicht verfügbar</h2>
      <p>{message}</p>
      <button onClick={openRecovery}>
        Sicherungen und Wiederherstellung öffnen
      </button>
    </section>
  )
}
