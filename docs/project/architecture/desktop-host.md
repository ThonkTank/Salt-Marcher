# Desktop-Host nach Fähigkeiten

Status: Current; technische Prüfungen und Produktabnahme bleiben getrennt.
Owner: project
Last Reviewed: 2026-10-26
Source of Truth: Zusammensetzung in `desktop/main.ts`, benannte Anschlüsse in `desktop/*-host.ts`.

## Besitzer und Grenzen

Main startet Update-Runtime und kanonischen Store-Worker, erstellt das geschützte
GM-Fenster und verbindet die Hostfähigkeiten ausdrücklich. Es gibt keine dynamische
Serviceverwaltung und keinen allgemeinen Store-Dispatch im Renderer. Öffentliche
Preload-Kanäle, Payloads, Archive und fachliche Fehler bleiben unverändert.

| Anschluss | Eigene Arbeit und Freigabe |
| --- | --- |
| `campaign-host.ts` | Katalogaktionen, Löschsperre, Kampagnentransfer und dessen Tickets/Abbruchsignal, Dungeonvorschau, Mappen- und Chronikexport; entfernt Progress-Abonnement und verbleibendes Staging nach Ende angenommener Aufträge. |
| `atlas-host.ts` | Atlas-, Raum-, Zeichnungs- und Stadtaufträge, Graph-Lesebarriere, Regions-/Raumworker und Referenzvorschaucache; schließt die bestehenden Leser einschließlich ihres tatsächlichen Endes. |
| `media-host.ts` | Audioübertragung und deren Abbruch-/Busy-Zustand, geschützte App-/Medienressourcen; gibt Handler und Protokollregistrierung frei. |
| `player-host.ts` | Passives Fenster, eigener Frame-Kanal, Sessionrechte, explizite Bildfreigabe und GM-Aktionen; beendet Fenster, Handler und Ressourcenregistrierung. Eine stillgelegte Playersession bleibt gegen Requests gesperrt. |
| `updates-host.ts` | Benannte Updateaktionen und automatischer Prüftimer; erhält vorhandenen UpdateService, Runtime und Schließübergang. |
| `preparation-host.ts`, `runtime-host.ts`, `catalog-host.ts`, `workspace-host.ts` | Explizite Weiterleitung ihrer bisherigen Fachkanäle; Runtime behält den vorhandenen CommitTracker. |

Kampagnendateien und Audioübertragung fragen die Busy-Grenze des jeweils anderen
Besitzers ab. Kampagnenlöschung wartet auf Backup und Regionsleser. Atlas erhält
ausschließlich den benannten Zugriff auf eine vorhandene Dungeonvorschau. Diese
Übergaben erweitern weder Rendererrechte noch Speicheroperationen.

## IPC und Schließen

`HostIpc` prüft für jeden GM-Aufruf WebContents-Identität, Hauptframe und exakte
App-URL. Fachliche Argumentprüfung bleibt am jeweiligen Anschluss bzw. im Store.
Der passive `player:frame`-Kanal hat weiterhin seine eigene Fenster-/Frame-/URL-
Prüfung. Er erhält keinen GM-Anschluss. Fehler werden wie zuvor als `Result`
zurückgegeben; nicht bestätigte Writes werden nicht automatisch wiederholt.

Ein Handler-Scope besitzt nur seine IPC-Registrierungen. Das ist keine
Serviceverwaltung. Der gemeinsame Transport hält angenommene Nicht-Update-
Aufträge bis einschließlich Spielersynchronisation fest. Beim Schließen sperrt
Main neue Aufträge, wartet auf diese Menge und startet den geordneten Store-Exit.
Danach wartet es auf Backup und die bestehenden Leser, gibt die benannten
Fähigkeiten frei und wartet auf die Store-Endbestätigung. Erst dann erfolgen
Update-Handoff, Freigabe der Runtime und Quit. Ein unerwartetes Workerende bleibt
ausdrücklich ungeklärt. Updateinstallation gehört nicht zu ihrem eigenen Drain.

## Prüfwege

`tests/shared/desktop-host-capabilities.test.mjs` lädt den tatsächlichen
Main-Einstieg mit kontrollierten Electron-/Store-Anschlüssen. Es gleicht alle
registrierten Kanäle mit den beiden Preloads ab und prüft fremde Absender,
Unterframes, URLs, Argumentfehler, normale Fehlerantworten, Löschkonkurrenz,
angenommene Aufträge beim Schließen, Store-Exit und Update-Handoff. Es prüft auch,
dass Handler und Ressourcen freigegeben werden und Playersessions gesperrt bleiben.

Die echten Worker-/Receipt-/Backupprüfungen bleiben in
`tests/catalog/desktop-store-worker.test.mjs` und
`tests/shared/desktop-backup-worker.test.mjs`; die passiven Fenstergrenzen in
`tests/runtime/desktop-player-visual-host.test.mjs`. Native Abläufe verwenden
`tools/test-desktop-baseline.mjs`, `tools/test-desktop-campaign-transfer-visit.mjs`,
`tools/test-desktop-audio-copy.mjs` und `tools/test-desktop-updates.mjs`.
Ein lokaler Prüfstand ist keine Owner-Abnahme oder veröffentlichte Installation.
