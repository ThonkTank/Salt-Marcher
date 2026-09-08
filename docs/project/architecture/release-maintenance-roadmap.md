# Release- und Wartungsroadmap

Quelle: vom Nutzer zur Umsetzung identifizierte Roadmap aus der Unterhaltung vom 8. September 2026. Der folgende Inhalt bleibt die kanonische Referenz; Ausführungsstatus steht separat in `../../roadmap-execution.md`.

Ich würde die Umsetzung in **sieben Phasen mit verbindlichen Abschlusskriterien** gliedern. Datensicherheit und Recovery bilden den kritischen Pfad. Tests entstehen jeweils mit der Implementierung; die spätere Releaseprüfung führt diese Nachweise zusammen.

Der Umfang bleibt Linux x86_64, bewusst ausgelöste Updates und unterstützte Electron-Daten.

| Phase | Ergebnis | Voraussetzung |
|---|---|---|
| 1. Verträge und Abnahme | Eindeutige Kompatibilitätszusagen und Prüfkriterien | Bestehender Stand |
| 2. Gemeinsame Wartung | Ein Transaktions- und Recovery-Ablauf | Phase 1 |
| 3. Sichere Datenwege | Belastbare Übernahme und Wiederherstellung | Phase 2 |
| 4. Durchgängige Bedienung | Vollständiger Speichern-/Verwerfen- und Updateablauf | Phase 2; Abschluss nach Phase 3 |
| 5. Artefaktqualifikation | Nachgewiesene Updates mit echten Schemawechseln | Phasen 3–4 |
| 6. Auslieferung und CI | Nachvollziehbare Freigabe und gezieltere Prüfungen | Nachweise aus Phase 5 |
| 7. Öffentlicher Release | Unverändertes, live abgenommenes Artefakt | Phase 6 |

**Phase 1 — Verträge, Grenzen und Abnahme festlegen**

Zunächst bereinigen wir die Entscheidungen, die sonst während der Umsetzung erneut auftauchen:

- Releaseversion festlegen; `0.3.0` bleibt der Vorschlag, ihre Verfügbarkeit wird vor Verwendung erneut geprüft.
- Datenformat-Kompatibilität und sichere Übernehmbarkeit einer Quelle getrennt dokumentieren.
- Unterstützte Altstände und deren Importwege benennen.
- Bestehende Wartungsabläufe, Journale und Garantien den künftigen Verantwortlichen zuordnen.
- Eine Abnahmematrix mit vorhandenen und fehlenden Nachweisen erstellen.
- Repräsentative Datenfixtures und Vergleichsstände auswählen.

**Abschlusskriterium:** Jede Kompatibilitätszusage besitzt einen konkreten Testfall. Ungeklärte Altprofile gelten ausdrücklich noch nicht als unterstützt.

**Phase 2 — Wartung und Recovery vereinheitlichen**

Wir führen den gemeinsamen Koordinator schrittweise ein:

1. Journalvertrag und Zustandsübergänge definieren, einschließlich dauerhaftem Abschluss vor Freigabe der Nutzung.
2. Bestehende Backup-, Migrations- und Prüfmodule anbinden.
3. Release-App und Local-Installer auf diesen Ablauf umstellen.
4. Alte Journale vor Beginn neuer Wartung sicher abarbeiten.
5. Die ersetzten Aktivierungs- und Rücksetzungsimplementierungen entfernen.

Main steuert Prozesse, Sperren und Programmaktivierung; Utility bearbeitet die Daten. SQL bleibt bei den Datenbankverantwortlichen. Wiederherstellungen verwenden das vorhandene AppImage.

**Abschlusskriterium:** Local und Release bestehen dieselben Unterbrechungstests. Journal und Dateizustand ergeben stets eine eindeutige Recovery-Entscheidung. Nach bestätigter Nutzung ist automatischer Datenrollback ausgeschlossen.

**Phase 3 — Profilübernahme und Wiederherstellung absichern**

- Eine gemeinsame Sperrimplementierung in Development, Local und Release verwenden.
- Profilpfade vor Sperrerwerb kanonisch auflösen.
- Für nicht kooperierende Altanwendungen nur nachweislich konsistente Backup-/Exportwege zulassen.
- Vollständigkeit und Unverändertheit der Quelle prüfen.
- Wiederherstellung mit vorgeschalteter Sicherung des aktuellen Stands abschließen.
- Recovery auch bei nicht startfähiger Kampagnendatenbank zugänglich machen.

**Abschlusskriterium:** Parallelstart, Pfad-Aliase und Übernahmefehler sind geprüft. Einstellungen, eigene Dateien sowie aktive, inaktive und wiederherstellbar gelöschte Kampagnen bleiben erhalten. Unsichere Quellen werden verständlich abgewiesen.

**Phase 4 — Wartung über die Oberfläche vollständig bedienbar machen**

- Eine kleine gemeinsame Schnittstelle für offene Editoränderungen einführen.
- „Speichern und fortfahren“, „Verwerfen und fortfahren“ und „Abbrechen“ zentral anbieten.
- Speicherfehler dem betroffenen Bereich zuordnen und Wartung verhindern.
- Neue Änderungen während der Klärung verhindern.
- Updateprüfung, Download und Installation als getrennte Aktionen durchgängig integrieren.
- Fehleranzeigen mit einer konkreten nächsten Aktion versehen.

**Abschlusskriterium:** UI-Tests bestehen für mehrere offene Editoren, teilweise erfolgreiches Speichern, Speicherfehler, Verwerfen und Abbrechen. Offlinebetrieb beeinträchtigt die normale Arbeit nicht.

Diese Phase kann nach Stabilisierung der Wartungsschnittstelle teilweise parallel zu Phase 3 laufen.

**Phase 5 — Den vollständigen Weg mit echten Artefakten qualifizieren**

Wir ergänzen die bisherige Transportprüfung um belastbare Migrationsnachweise:

- Unterschiedlich gebaute AppImages mit tatsächlich unterschiedlichen Schema-Versionen.
- Updates ohne Schemaänderung, mit Schemaänderung und über einen Zwischenstand hinweg.
- Abbrüche innerhalb einer Migration sowie an Aktivierungs- und Recovery-Grenzen.
- WAL-Daten, Platzmangel, Zugriffsfehler, parallele Starts und beschädigte Downloads.
- Fehlende Migrationen und neuere Datenformate.
- Wiederherstellung einschließlich vorheriger Sicherung und Erhalt späterer Arbeit.

Leere, bestehende und beschädigte Profile bleiben getrennte Fälle. Verglichen werden konkrete Inhalte und fortsetzbare Spielstände.

**Abschlusskriterium:** Der automatisierte Ablauf „prüfen → herunterladen → installieren → neu starten → weiterarbeiten → wiederherstellen“ besteht mit echten AppImages und echten Schemaübergängen.

**Phase 6 — Releaseprozess und Prüfauswahl fertigstellen**

Zwei getrennte Arbeitspakete vermeiden, dass Sicherheitsfreigabe und CI-Optimierung vermischt werden.

**Releaseprozess:**

- Fest codierte Erstversions-Sonderfälle durch explizite Vergleichsartefakte ersetzen.
- Zielcommit, Version und Vergleichsstände im Abnahmeauftrag festhalten.
- Das Release-AppImage einmal bauen und dieselben Bytes prüfen, als Entwurf ablegen und später veröffentlichen.
- Die manuelle GitHub-Freigaberegel tatsächlich einrichten und überprüfen.
- Datenvertrag, Betriebsanleitung und Release-Abnahme auf den fertigen Zustand bringen.

**Entwicklungsablauf:**

- Schnelle lokale Prüfungen und Umgebungschecks bereits ab Phase 1 nutzen.
- Prüfungen auf unveränderlichen Checkouts ausführen.
- Gezielte CI-Auswahl anhand ausdrücklich zugeordneter Risiken einführen.
- Unbekannte Änderungen vollständig prüfen.
- Workflowregeln und `AGENTS.md` gemeinsam aktualisieren.

**Abschlusskriterium:** Der Releaseentwurf enthält überprüfbare Herkunft und vollständige Nachweise. Die CI-Auswahl überspringt keine erforderlichen Prüfungen; öffentliche Releases behalten die vollständige relevante Abnahme.

Die CI-Optimierung kann separat ausgeliefert werden. Bis zu ihrer nachgewiesenen Korrektheit gelten die bisherigen vollständigen Prüfungen.

**Phase 7 — Mit vorhandenen Daten live abnehmen und veröffentlichen**

- Eine Kopie deiner vorhandenen Kampagnendaten verwenden.
- Das endgültige Artefakt installieren und den vollständigen Updateweg durchlaufen.
- Kampagne öffnen, Änderungen speichern, aktualisieren, weiterarbeiten und Wiederherstellung prüfen.
- Livetest mit Commit und Artefakthash dokumentieren.
- Genau dieses Artefakt nach manueller Freigabe veröffentlichen.

Änderungen nach der Abnahme erzeugen ein neues Artefakt und benötigen erneute passende Prüfungen.

**Abschlusskriterium:** Der öffentliche Download entspricht den geprüften Bytes. Installation, Migration, Update und Wiederherstellung sind automatisiert sowie im dokumentierten Livetest nachgewiesen.

Als Fortschrittsmaß verwenden wir durchgehend die getrennten Zustände **implementiert, automatisiert geprüft, lokal übergeben, live abgenommen und veröffentlicht**. So bleibt sichtbar, welche Sicherheit bereits belegt ist und was bis zum Alltagsrelease noch fehlt.
