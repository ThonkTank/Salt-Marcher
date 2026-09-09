import { dialog, shell } from 'electron'
import { join } from 'node:path'

/** Keep the caller's profile lease; never replace an unresolved journal. */
export async function recoverWithDialog<T>(
  recover: () => T,
  installationRoot: string,
  interactive = true
): Promise<T | null> {
  for (;;) {
    try {
      return recover()
    } catch (error) {
      if (!interactive) throw error
      const cause =
        error instanceof Error ? error.message : 'Unbekannter Wartungsfehler.'
      let detail = `${cause}\n\nDie Wartung konnte nicht sicher abgeschlossen werden. Die normale Nutzung bleibt gesperrt. Du kannst den Wiederherstellungsversuch wiederholen oder vorhandene Sicherungen im Dateimanager ansehen.`
      for (;;) {
        const choice = await dialog.showMessageBox({
          type: 'error',
          title: 'SaltMarcher – Wiederherstellung',
          message: 'SaltMarcher kann dieses Profil noch nicht öffnen.',
          detail,
          buttons: ['Erneut versuchen', 'Sicherungen anzeigen', 'Beenden'],
          defaultId: 0,
          cancelId: 2,
          noLink: true
        })
        if (choice.response === 0) break
        if (choice.response !== 1) return null
        let failed: boolean
        try {
          failed = Boolean(
            await shell.openPath(join(installationRoot, 'backups'))
          )
        } catch {
          failed = true
        }
        if (failed) {
          detail = `${cause}\n\nDer Sicherungsordner konnte nicht geöffnet werden. Prüfe, ob der Installationsordner zugänglich ist, und versuche es erneut.`
        }
      }
    }
  }
}
