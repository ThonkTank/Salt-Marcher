# Unabhängige Codeprüfung: fünf Integritäts- und Recoverykorrekturen

24.10.2026. Analysebasis: `b1b9a865cd85aa1753f20b0732e3f32e4136842e`.
Phase 1 war ausschließlich lesend. Erst der getrennte Phase-2-Auftrag autorisierte
Korrekturen und Regressionen. Grundlage waren aktueller Repositorycode,
Fachverträge und gezielte Tests; keine Memorydateien, Chat-Historien oder früheren
Reviewberichte. Die lokale Qualifikation und die spätere Main-/Releasequalifikation bleiben
getrennte Nachweise; eine Installation ins Nutzerprofil oder Owner-Abnahme wird
nicht beansprucht.

## Ausgangsbefunde und Reparaturen

| Priorität | Reproduzierbarer Ausgangsbefund | Reparatur und verbleibende Grenzen |
| --- | --- | --- |
| P1 | Ein untypisiertes und ein Familienpaar mit denselben Beschriftungen konnten erfolgreich gespeichert werden. Danach sperrte der Dokumentleser beide NPC-Notizen wegen doppelter `targetId + label`; History und Erfolgsbeleg existierten trotzdem, ein zugeordneter Entwurf wurde verbraucht. | `storage/world-relation-pair.ts` behält die kanonische Paaridentität unabhängig von `familyKind`. Beide neuen Dokumente werden vor dem ersten Write geprüft, auch bei History. Abgelehnte Kollisionen ändern weder Notizen noch Revisionen, History, Belege oder Entwürfe. Bereits zuvor ungültig gespeicherte Duplikate werden nicht automatisch verändert. |
| P1 | Papierkorb eines familiär verbundenen NPCs gelang, machte die Kampagne aber für validierte Backups und Exporte ungültig. | Soft-Delete erhält beide Kanten. Die Integritätsprüfung erlaubt archivierte vorhandene NPCs als Endpunkte und prüft auch deren Gegenrichtungen. Einzeln/beidseitig archivieren, Restore, Backup, Snapshotexport und unabhängige Kopie sind verlustfrei getestet. Fehlende Gegenrichtungen bleiben auch im Papierkorb Fehler. |
| P2 | Entfernen der erzeugten NPC-Notiz eines offenen Kampfteilnehmers ließ Notiz-, Schadens- und Abschlussaktionen mit der irreführenden Aufforderung zum Aktualisieren scheitern. | `storage/mask-health.ts` prüft vor dem Papierkorb vorbereitete/laufende Kämpfe. Entfernung wird ohne Schreibfolgen abgewiesen, bis der Teilnehmer entfernt oder der Kampf beendet ist. Fertige Kampfhistorie bleibt auch nach späterem Papierkorb/Restore unverändert. Keine automatische Reparatur früher bereits gestrandeter Kämpfe. |
| P2 | Normale Party-Heilung löschte bei Toten den Todeszustand; normaler Schaden ließ bei 0 HP stabilisierte Figuren stabil. | `progression.ts` besitzt gemeinsame reguläre Schadens-/Heilungsübergänge für Party und Kampf. Temporäre HP, Stabilisierung, Fehlschläge, massiver Schaden und Konzentrationsende bei 0 HP bleiben konsistent. Normale Heilung von Toten wird abgewiesen; ausdrückliche `set`-Korrektur und Wiederbelebung bleiben getrennt. API-Grenzen und maskenlokale Konzentrations-/Wurfanzeigen bleiben bei ihren Besitzern. |
| P2 | Nach Transportfehler und anschließend abgelehnter Wiederholung blieb der Atlasauftrag in `pending`; neue Änderungen und Flush blieben gesperrt. | Separater `atlas:reconcile-commit`-IPC liest den transaktionalen Beleg und prüft Kampagne, Befehl und Fingerprint. `AtlasWriteActivity` verfolgt noch laufende Autorenaufträge einschließlich asynchroner Terrainvorbereitung. Status ist angewendet, sicher nicht angewendet oder unbekannt. Nur die ersten beiden lösen Pending; Nichtanwendung erhält die Eingaben. Recovery schreibt/replayed nichts. Statusfehler, falscher Fingerprint und laufende Aufträge bleiben gesperrt. |

Der Atlas-Statusweg läuft durch dieselbe eingeschränkte Preload-/Main-Grenze wie
die bestehenden Aufträge. Ein beliebiges `ok:false` beweist keine Nichtanwendung:
Main kann auch nach Commit bei einer anschließenden Darstellung scheitern. Deshalb
leitet die Recovery ihren Ausgang ausschließlich aus Beleg und laufenden Aufträgen
ab. Sie benötigt weder die vollständige Atlasdarstellung noch eine erneute
Terrainberechnung. Der Pending-Zustand bleibt wie bisher flüchtig; dies ist keine
neue persistente Entwurfs- oder Crash-Recoveryarchitektur und kein Atlas-M0–M8-Umbau.

## Automatisierte Nachweise

Vorbereitung mit Node **22.22.0**: `node build.mjs --test`; nach der abschließenden
Historyvalidierung wurden die Testassets aktualisiert.

- `tests/desktop-review-integrity.test.mjs`: 16 Fälle zu beidseitigen/einseitigen
  typisierten/untypisierten Kollisionen, unveränderten DB-Bytes und persistentem
  Entwurf, Familien-Papierkorb/Restore/Backup/Export/Kopie/Fresh-Lesen, kaputter
  archivierter Gegenrichtung, vorbereiteten/laufenden/abgeschlossenen Kämpfen und
  Party-/Kampfgesundheit einschließlich expliziter GM-Korrektur.
- `tests/desktop-atlas-commit-recovery.test.mjs`: 6 Fälle mit realem Store und
  Controller. Antwortverlust vor/nach Commit, definitive Nichtanwendung,
  asynchrone Vorbereitung, parallele gleichnamige Aufträge, Status-/Transportfehler,
  Fingerprint-/Tokenbindung und Recovery ohne Darstellung oder Wiederholung.
- Bestehende Regressionen: `tests/desktop-dungeon-authoring.test.mjs`,
  `tests/desktop-combat-hit.test.mjs`, `tests/desktop-combat-area.test.mjs`.
  Der Flächenschadentest prüft zusätzlich 800.000 Basisschaden mit Verdopplung;
  der kritische Treffer prüft den zweiten Fehlschlag einschließlich `deathLast`.
- Gezielte vorhandene Kernfälle mit
  `node --test --test-reporter=dot --test-name-pattern='(pair|family|death|health)' .build/tests.cjs`:
  **40 bestanden**. Der einzelne kompakte Recoveryfall in
  `tests/desktop-atlas-regions.test.mjs` bestand ebenfalls mit lesendem Abgleich.

Abschließender gemeinsamer Lauf der fünf genannten Desktop-Node-Dateien:
`node --test --test-reporter=spec tests/desktop-review-integrity.test.mjs tests/desktop-atlas-commit-recovery.test.mjs tests/desktop-dungeon-authoring.test.mjs tests/desktop-combat-hit.test.mjs tests/desktop-combat-area.test.mjs`.
**68/68 bestanden**, keine übersprungenen Fälle (16,56 s).
`git diff --check` ist ebenfalls ohne Befund.

## Prüfgrenzen und Übergabe

Die Dateinamen `desktop-*.test.mjs` bezeichnen hier Node-/DOM-/Storage-Tests,
keinen gestarteten Electron-Host. Transportverlust und parallele Vorbereitung
wurden kontrolliert injiziert; ein physischer Prozessabsturz wurde nicht nachgestellt.
Datenbankkopien und normales neues Öffnen wurden mit temporären Testdaten geprüft.

Repositorycheck, beide Typechecks und Desktopbuild bestanden. Die native Probe
[`tools/test-desktop-review-integrity.mjs`](../../../tools/test-desktop-review-integrity.mjs)
prüft die echte Ablehnung des doppelten Paars samt erhaltenen Eingaben und
anschließender Auftragsklärung, Familie im Papierkorb mit gültigem Backup,
Restore, blockierte offene Kampfbindung und beide Party-HP-Fehler. Fresh-Lesen
prüft unveränderte Prosa, Beziehungen und Gesundheit. Zusätzlich wird der neue
Atlas-Belegweg über die echte Preload-/Main-Grenze vor und nach einem Commit sowie
mit abweichender Nutzlast geprüft; Transportverlust bleibt eine separate
kontrollierte Controllerprobe.

[Native Original-Worktree-Evidenz](native-original.json.gz): drei regulär beendete
Electron-Prozesse, verschwundene PIDs, unveränderte Runtimeartefakte und keine
Rendererfehler auf dem Wayland-Host. Die Screenshots wurden gesichtet. Die ersten
Probeversionen mussten den vorhandenen Navigations-/Entwurfsklärungsablauf noch
korrekt bedienen; deren abgebrochene Durchläufe zählen nicht als Erfolg.

Die native Evidenz nennt den ursprünglichen HEAD und Dirty-Status sowie genaue
Runtimehashes. Die gesonderte Integrationskopie übernimmt ausschließlich diese
Reviewkorrekturen; die 33 zusätzlichen Atlas-Branchcommits werden nicht geliefert.

## Main-basierte Lieferprüfung

Die Korrekturen wurden allein auf `origin/main` (`21d250123`) übertragen.
Dort bestanden erneut [68 gezielte Fälle](integration-tests.log.gz), beide
Typechecks, Repositorycheck und Desktopbuild. Die
[native Integrationsprobe](native-integration.json.gz) besteht ebenfalls mit
allen sieben Fach-/IPC-Assertions und drei regulären Prozessenden. Ihre Quelle
ist `aabbb8557` mit vorbereitetem Versionsbump 0.189.0; Runtimehashes stehen im
Beleg. In der frischen Kopie wurde der zunächst fehlende Electron-Runtime über
`npm run desktop:runtime` installiert, bevor die Probe erfolgreich lief.

Die Capability-Links wurden nach tatsächlichem Testinhalt für Beziehungen,
Partygesundheit, offene NPC-Kampfbindungen und Atlas-Belegklärung eingetragen
und mit `--geprueft` dokumentiert. Ein Link behauptet keine vollständige Abnahme
des gesamten jeweiligen Ablaufs. Candidate-CI und signierter Release bleiben
gesonderte GitHub-Nachweise.
