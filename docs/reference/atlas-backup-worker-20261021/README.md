# Automatische Sicherungsprüfung ohne blockierten Hauptprozess

Die große gemischte Welt aus [der vorherigen Prüfung](../atlas-landscape-write-cost-20261021/README.md) wurde in isolierte native Profile kopiert. Der erste Versuch zeichnete den Pinselzug und seinen Abschluss auf: Die automatische Wiederherstellungskopie lief gleichzeitig und prüfte die gesamte Datenbank synchron im Electron-Hauptprozess. Von 96,28 s Profilzeit lagen 65,25 s in `validateDatabase` (einschließlich fachlicher Prüfungen und SQLite-Integrität); insgesamt 70,69 s in `backup`. Der Renderer war überwiegend inaktiv.

## Änderung und unveränderte Schutzgrenzen

`stored-records.ts` enthält die bisherigen zustandsfreien Payloadleser. `snapshot-validation.ts` bündelt dieselbe vollständige fachliche und strukturelle Prüfung. Store, Export/Import und Hintergrundprüfung nutzen diese Funktionen gemeinsam; es wird kein zweiter Store geöffnet oder migriert.

Die automatische Sicherung übergibt nur ihren privaten, bereits konsistent kopierten Kandidaten an `BackupValidationService`. Ein Readonly-Worker prüft ihn. Erst nach erfolgreicher Antwort **und tatsächlichem Workerende** darf der Store die Datei synchronisieren und umbenennen. Löschungs-/Aktivierungsepochen, bisherige sichere Datei und Aufräumen der Kandidatenseiten bleiben erhalten. Beim Schließen wird die laufende Prüfung beendet und ihr Ende abgewartet; ein unvollständiger Kandidat wird verworfen. Der kanonische Writer bleibt im Hauptprozess.

## Native Gegenprobe

[Vorher](before.json), [nachher](after.json), [Atlas nach Abschluss](after.png). Beide Prozesse endeten normal mit Code 0 und verschwanden; keine Rendererfehler. Gleicher gemischter Ausgangsbestand, dieselbe normale Hauptkarte, derselbe 2.500-Meilen-Pinsel. Keine parallelen eigenen Builds oder Tests während der nativen Läufe.

| Beobachtung | Vorher | Nachher |
| --- | ---: | ---: |
| Pinselbeginn bis Loslassbestätigung, bei etwa vier Sekunden geplanter Geste | 37,19 s | 4,75 s |
| Pinselbeginn bis wieder freigegebenes Werkzeug | 92,80 s | 18,28 s |
| Zoom senden bis nächste Zustandsantwort | 5,88 s | 5,63 s |
| Hauptprozessprofil insgesamt | 96,28 s | 21,66 s |
| `executeAtlasCommit` einschließlich Unteraufrufen | 8,89 s | 8,98 s |

Die Sicherungsprüfung ist im zweiten Hauptprozessprofil nicht mehr enthalten. Der native Lauf prüft ihren parallelen Betrieb und den normalen Abschluss; die vollständige Veröffentlichung und Fehlergrenzen prüft zusätzlich die Workerregression. Bei normalem Schließen darf eine noch laufende Sicherungsprüfung abgebrochen werden.

**Keine vollständige Leistungsabnahme:** Weiterhin rund 23 s bis zur ersten Terrainbereitschaft, Sekunden für Kameraabfragen während der Commitlast und rund neun Sekunden synchrone Commit-/Historyarbeit. Die volle Welt ist noch nicht unmittelbar bedienbar. Profiling beeinflusst Laufzeiten; Werte sind einzelne Diagnoseversuche auf dem lokalen Host, keine p95- oder Pentium-Qualifikation. Die Kartengestaltung wurde hier nicht verbessert.

Reproduktion nach Aufbau einer synthetischen gemischten Welt mit `tools/test-desktop-world-navigation.mjs`: `BACKUP_PROBE_SOURCE` auf deren behaltene `workbench.sqlite` setzen und `python3 tools/ui-session.py timeout --signal=TERM 240s node tools/measure-desktop-backup-impact.mjs` ausführen. Das Werkzeug erstellt eine SQLite-Sicherung in einem eigenen Profil; nie eine aktive Nutzerdatenbank als Quelle wählen.

73 betroffene Tests bestanden: Hintergrundprüfung, beschädigte Kandidaten, Workerfehler/fehlende Antwort, tatsächliches Ende vor Veröffentlichung, Schließen, überholte Sicherung, Pläne, Terrain-History, Export/Import, Raumhistory, Zeichnungsentwürfe und NPC-Integrität. Beide Typprüfungen, Desktop-Build und Repositoryprüfung bestanden. Ein erster neuer Testlauf verwendete einen veralteten gemeinsamen Store-Build und einen ungeeigneten Vergleich großer Binärpuffer; der Prozess wurde mit SIGKILL beendet. Nach erneuter Testvorbereitung und korrigiertem Bytevergleich bestand der vollständige betroffene Satz. Dieser abgebrochene Lauf ist kein Produktnachweis.
