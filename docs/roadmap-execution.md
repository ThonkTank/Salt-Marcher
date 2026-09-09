# Ausführung der Release- und Wartungsroadmap

Kanonisch: [Roadmap](project/architecture/release-maintenance-roadmap.md).
Ergänzende Detailanforderungen: [Zielzustand](project/architecture/release-maintenance-target.md).

## Ausgangspunkt — 2026-09-08

- Aktueller und entfernter main: `4bd78927b80079142597d4b8c310cfd580ed74c2`, nach `git fetch origin` bestätigt.
- Sauberer Ausgangsarbeitsbaum; neuer Kandidat `candidate/unified-maintenance-roadmap`.
- AGENTS.md gelesen. Vollständige bestehende CI- und Handoff-Regeln bleiben verbindlich.
- Vorhandene Implementierung zählt nicht ohne Prüfung als erfüllte Roadmapphase.

| Phase | Status    |
| ----- | --------- |
| 1     | abgeschlossen |
| 2     | abgeschlossen |
| 3     | abgeschlossen |
| 4     | in Arbeit |
| 5–7   | offen |

## Phase 1 — Plan, vor Änderungen

Ergebnis: verbindliche Version und zweigeteilter Datenvertrag, nachvollziehbare
Zuständigkeiten und vollständige Abnahmematrix mit konkreten Nachweislücken.

Komponenten: Dokumentation unter docs/project/architecture und docs/project/contract;
Release-Dokumentation. Keine Änderung des Wartungsverhaltens in dieser Phase.

Reihenfolge:

1. Originalroadmap und ergänzenden Zielzustand unverändert sichern.
2. Version/Tag und aktuelle Schema-/Fixturestände prüfen.
3. Datenformat und sichere Quellübernahme getrennt festlegen; unbekannte Altstände
   nicht als unterstützt zusagen.
4. Journalbesitzer und zu ersetzende Abläufe zuordnen.
5. Abnahmematrix mit vorhandenen Tests, fehlenden Tests und Vergleichsständen festhalten.
6. Dokumentformatierung, Referenzen und relevante vorhandene Basistests prüfen;
   Gesamtabschluss der Dokumentänderungen zusätzlich mit pnpm check nach AGENTS.md.
7. Separates Audit gegen diesen Plan und die kanonische Phase 1 dokumentieren.

Abnahme: Jede Zusage hat einen identifizierbaren Testfall; vorhandene Tests und
zukünftig nötige Nachweise werden unterschieden. Entscheidungen stimmen mit den
Quellen überein. Keine Behauptung erfolgreicher öffentlicher Freigabe.

### Erhobene Evidenz

GitHub API: matching-refs/tags/v0.3.0 liefert []; releases/tags/v0.3.0 liefert 404.
0.3.0 wird als Ziel gewählt; erneute Prüfung vor Tag-/Release-Erstellung bleibt nötig.
Fixture tests/fixtures/release-0.2.0/manifest.json nennt Installation 39/Kampagne 34.
release-baseline.test.ts prüft diesen aktuellen Stand und vorhandene Pfadauflösung,
keinen realen historischen AppImage-Schemawechsel.
controller.ts importProfile prüft SingletonLock und eine abgeleitete runtime.lock;
das belegt noch keine gemeinsame Sperre aller angebotenen Altanwendungen.

### Validation round 1

Command: pnpm exec vitest run tests/integration/release-baseline.test.ts
tests/integration/release-maintenance.test.ts tests/integration/release-recovery.test.ts
tests/unit/installed-profile-readbacks.test.ts --maxWorkers=2.
Result: 4 files, 24 tests passed (2026-09-08). These are baseline evidence only.

Audit against Phase 1 plan: canonical source and detailed target persisted;
compatibility split, owner mapping, fixture selection and M01–M23 matrix recorded.
Audit against roadmap: initial discrepancy was stale public-first-release wording
in docs/releases/0.2.0.md and release-process.md. Corrective plan: retain historical
notes, label their status accurately, point to 0.3.0 target and explain that package
version is updated alongside Phase 6 baseline tooling. Those corrections are applied.
No runtime behavior or publication status is inferred from the documentation.

Remaining validation before closing Phase 1: full pnpm check required by AGENTS.md;
check internal links and original source fidelity. No later phase started.

## Phase 1 — Abschlussaudit, 2026-09-08

`pnpm check` auf unverändertem Commit `8e8b335a2b83a6a78a495254986ca32ec05b9abd`
ist mit Exit 0 beendet. Local-check run `7e053beb-475d-4a29-973a-86543fa81266`
meldet alle fünf Phasen completed: 91 Architektur-, 823 portable Unit-,
241 Integrations- und 34 Linux-Tests; Build, Smoke und Bundlebudget; alle
18 funktionalen und 7 visuellen Suiten. Gesamtdauer rund 39 Minuten 41 Sekunden.
Logs: work/roadmap-phase1-check.log im übergeordneten Aufgabenordner.
GitHub Check [34210249425](https://github.com/ThonkTank/Salt-Marcher/actions/runs/34210249425)
ist ebenfalls vollständig erfolgreich. PR: #661 (Entwurf).

Interne Markdown-Referenzen geprüft; gespeicherter Zielzustand ist bytegleich mit
dem Nutzeranhang. Separates Audit gegen Phase-1-Plan: bestanden. Audit gegen
kanonische Roadmap Phase 1: bestanden; jede Zusage hat M01–M23 als konkreten
Abnahmefall, bestehende Evidenz wird von noch nötiger Qualifikation getrennt.
Kein Laufzeitverhalten wurde geändert oder als neu qualifiziert ausgegeben.

Historische Vergleichsstände anhand ihrer database.ts verbindlich ausgewählt:

- A: `52a0cc28cdb332406a4d03e0a14cc005eb7a0ff0`, Installation 37 / Kampagne 34.
- B: `6e84a12c1c83cd6437680ae70529cdc9723c353b`, Installation 38 / Kampagne 34.
- C: `c583e05506e10d8446a4e210fa0603e3be53d63a`, Installation 39 / Kampagne 34.

37→38 ergänzt Registry-Revision, 38→39 Befehlsbelege. Verpackung und
AppImage-Harness dieser historischen Stände bleiben Phase 5; keine erfundenen
Produktionsmigrationen. Ergänzend bleibt Kampagne 30→31 ein fachlicher Prüffall.

Die Codeprüfung bestätigt M04/M05 zusätzlich: Local campaign-migration.ts entfernt
seinen Rollbackstand bereits bei data-promoted; Local recovery.ts entscheidet
Programmabschluss separat anhand Symlink und Ersetzungsdateien. Release verwendet
Datenjournal v1 und Aktivierungsjournal v1 samt eingebettetem Launcher-Fallback.
Diese bisherigen Entscheidungsstellen sind in Phase 2 vollständig abzulösen.

## Phase 2 — Plan vor Implementierung

Ergebnis: ein versionierter, maßgeblicher Wartungszustand bindet alte/neue
Programmversion, Profil, Sicherung und Freigabe. Local und Release verwenden
identische Zustandsübergänge. Alte Journale werden vor neuen Transaktionen
abgearbeitet. Nach dauerhaftem Commit keine automatische Rücksetzung.

Betroffene Komponenten: shared/maintenance (Koordinator und Journalvertrag),
core/maintenance (Utility-Datenarbeit), main/release (Prozess-/Programm-Adapter),
utility/maintenance (validierte Arbeitsaufträge), scripts/local-installation und
local-app-installation (Local-Adapter), Lifecycle/Launcher und passende Tests.
SQL bleibt bei den existierenden Datenbankverantwortlichen.

Implementierungsreihenfolge:

1. Strikten gemeinsamen Journalvertrag und Dateisystem-Koordinator einführen:
   vorbereitete Daten und Programmidentität, dauerhafte Absichten vor jedem Move,
   idempotente Recovery auch nach Unterbrechung der Recovery selbst.
2. Profil-Sicherung/Migration von Aktivierungsentscheidungen lösen; Utility liefert
   validierte Arbeitskopie/Sicherungsmetadaten, Koordinator besitzt Veröffentlichung.
3. Release-Prozesse, Startprüfung und Launcher auf eine Entscheidungsquelle umstellen;
   Wiederherstellung verwendet das bestehende Deployment.
4. Local-Installer/Handoff auf denselben Koordinator umstellen, vorheriges Paar bis
   erfolgreicher Zielruntime-Prüfung erhalten; Provenienzbelege getrennt lassen.
5. Eng begrenzte Legacy-Journalübernahme implementieren und alte aktive
   Orchestrierungs-/Recovery-Wege entfernen.
6. Gemeinsame Fehlerfallmatrix für Local und Release, echte Profil-/Recovery-Tests,
   Typen/Lint/Build und betroffene Installer-/Handoff-Tests ausführen.
7. Separates Audit gegen Plan und Roadmap, dokumentierte Korrekturrunden bei Lücken.

Abnahme: M04/M05/M06/M12, inklusive vor/nach jedem Aktivierungsschritt,
Unterbrechungen beim Zurücksetzen, erster Installation ohne vorheriges Paar,
festgeschriebener späterer Änderungen, alter Journale und unveränderter
Deploymentidentität bei Wiederherstellung. Gemeinsame Backup-/Prüfgarantien bleiben.
Der endgültige genaue CI-/AppImage-Handoff und die Main-Promotion erfolgen nach
der zusammenhängenden Implementierung gemäß AGENTS.md; Phasenprüfungen ersetzen
keine spätere öffentliche Release-Abnahme.

### Phase 2 — Implementierungsrunde 1

Gemeinsamer Journalvertrag v2 und MaintenanceCoordinator hinzugefügt. Ein Journal
bindet Datenbewegung, Programmzeiger, vorheriges Deployment, Sicherungs-ID und
Transaktionskennung. Vor jedem Daten-/Programmübergang steht eine dauerhafte
Absicht. Rücksetzung besitzt eigene Zustände für Erhalt des fehlgeschlagenen
Datenstands, Wiederherstellung und Programmwechsel. Committed bleibt terminal;
spätere Änderungen werden nicht automatisch zurückgesetzt. Keine alte
Daten-/Programmversion wird dabei automatisch gelöscht.

Validierung: pnpm exec vitest run tests/unit/maintenance-coordinator.test.ts
--maxWorkers=2: 44 Tests bestanden. Beide Kanalvarianten durchlaufen dieselbe
Fehlermatrix; Unterbrechungen bei Aktivierung und Recovery, leere Erstinstallation,
Commit-Abbruch, falsches Token und veränderte Programmbytes sind abgedeckt.
Diese Tests qualifizieren den gemeinsamen Koordinator, noch nicht die Adapter.

Zwischenaudit gegen Plan: Schritt 1 als Grundlage vorhanden. Schritte 2–5
(Utility/Release/Local/Legacy-Anbindung) weiterhin offen. Phase 2 ist nicht
abgeschlossen; bisherige Laufzeitabläufe sind noch aktiv. Vollständige Integration
und ihre Tests sind Voraussetzung für den Phasenabschluss.

### Phase 2 — Korrekturrunde 1, Plan vor Änderung

Lint findet nach Umstellung der Recovery auf synchrone Journal-/Dateiarbeit einen
unnötigen await im Controller. Korrektur: alle Aufrufer von recoverRelease,
completeRelease und rollbackRelease im Controller/Lifecycle auf die tatsächliche
synchrone Schnittstelle anpassen. Bestehende asynchrone Core-Bereitschafts- und
Schließbarrieren bleiben erhalten. Danach betroffene Lint-/Typprüfungen wiederholen.

### Phase 2 — Korrekturrunde 2, Plan vor Änderung

Der Launcher-Test liest sein Manifest untypisiert mit JSON.parse; Lint lehnt
unsichere Zugriffe ab. Korrektur: denselben strikten Release-Manifestparser wie
Produktion verwenden; anschließend Lint, Typen und Release-Tests erneut prüfen.
Keine Änderung der erwarteten Sicherheitsgrenzen oder Abschwächung der Prüfung.

### Phase 2 — Implementierungsrunde 2 und Zwischenaudit

Release-Anbindung umgesetzt: ProfileMaintenance erzeugt Sicherung und geprüfte
Arbeitskopie, aktiviert aber keine Live-Daten. Main bindet diese Vorbereitung an
das gemeinsame Journal, aktiviert mit MaintenanceCoordinator und bestätigt erst
nach Zielruntime-Bereitschaft. Utility-Aufträge und Vorbereitungsergebnisse sind
an beiden Grenzen strikt validiert und tragen die Transaktionskennung.

Die frühere aktive ProfileTransaction und beginActivation wurden entfernt.
Legacy-Datenjournal v1 und activation.json werden ausschließlich durch die
begrenzte Übernahme gelesen/archiviert; danach entscheidet Journal v2 allein.
Bereits bestätigte Legacy-Daten werden nicht zurückgesetzt. Der stabile Launcher
liest den Rückfall aus dem maßgeblichen Journal und führt nach committed keinen
Fallback aus. Restore verwendet currentProgram statt ein weiteres Deployment
anzulegen. Speicherbedarf berücksichtigt aktuellen und eingehenden Datenstand.

Validierung: 155 Tests in 14 Dateien bestanden (Architektur, Koordinator,
Release-Vertrag/Transport/Launcher/Baseline/Profil/Recovery/Controller).
Korrekturrunden 1 und 2: betroffener ESLint-Lauf und beide TypeScript-Projekte
erfolgreich. Development-Build erfolgreich; kein Release-/Handoff-Nachweis.
Controller-Test verwendet echten Profilspeicher mit simuliertem Zielprozess;
er ersetzt ausdrücklich keinen Zwei-AppImage-Test.

Audit gegen Phase-2-Plan: Release-Anbindung und Legacy-Release-Übernahme vorhanden;
Local-Adapter, Legacy-Local-Journalübernahme und gemeinsame Startfreigabe dort noch
offen. Die 44 kanalparametrisierten Koordinatortests allein beweisen noch keine
Local-Installer-Anbindung. Phase 2 bleibt offen.

Konkrete Local-Anbindungspunkte aus der Codeprüfung:
- local-app-installation.ts: Backup-/Deployment-Provenienz darf weiterbestehen,
  Daten-/Programm-Recovery muss an den gemeinsamen Koordinator übergehen.
- installed-runtime-verification.ts: bisheriger Smoke-Aufruf braucht die passende
  Wartungskennung für Startbestätigung; normale Nutzung darf vorher nicht starten.
- application-lifecycle/application.ts: Local muss pending Wartung ebenfalls vor
  Core-Zugriff wiederherstellen oder unter passender Kennung prüfen.
- Alte Local install-journal-v2-Phasen vor Umstellung kontrolliert abarbeiten;
  aktuelle Daten niemals allein aufgrund alter Provenienzbelege zurücksetzen.

Zusätzliche Validierung Runde 2: pnpm test:smoke:built unter Xvfb erfolgreich,
Core erreicht ready und beendet mit Code 0. Beleg im Aufgabenordner
work/roadmap-phase2-release-smoke.log. Dieser Development-Smoke bestätigt den
Buildstart, nicht die noch ausstehende AppImage-Update-Abnahme.

### Phase 2 — Local-Anbindung, konkreter Rundenplan vor Änderungen

Local-Handoff-Belege bleiben Nachweise für Artifact-/Backup-Identität, aber
verlieren Daten-/Programm-Recovery-Autorität. Local verwendet die kanonische
Profilsicherung und dieselbe Prüfung der Arbeitskopie. Das Local-Artefaktmanifest
enthält keine Semver-Appversion; seine verfügbare Versionsidentität ist der
Build-Commit, der ausdrücklich als Local-Commit angezeigt/gespeichert wird.

Reihenfolge: kanonische Backup-Payload plus separater Handoff-Beleg;
gemeinsame geprüfte Arbeitskopie; Aktivierung über MaintenanceCoordinator;
Local-Startbarriere mit Token aus installiertem Verifier; Legacy-Local-Übernahme.
Bestehende Backupformate bleiben lesbar. Tests müssen echte fachlich lesbare
Profile verwenden, sobald fachlicher Readback Teil ihrer Abnahme ist; minimale
SQLite-Dateien dürfen nicht als erfolgreiche App-Profile durchgehen.

### Phase 2 — Korrekturrunde 3, Plan vor Änderung

Local-Backup-Test: 42 Tests bestanden, WAL-Checkpoint-Wiederverwendung fehlgeschlagen.
Der kanonische Manifestvergleich erfasst zusätzliche SQLite-Nebendateien, die das
lesende Öffnen einer WAL-markierten Sicherung erzeugt. Statt Neben-/WAL-Daten pauschal
vom Hashvergleich auszunehmen, fertige Online-Backup-Zieldateien im gemeinsamen
Snapshotmodul auf journal_mode=DELETE abschließen. Nur die Sicherung wird geändert;
Quelle bleibt bytegleich. Danach WAL-Wiederverwendung und Release-Profiltests prüfen.

### Phase 2 — Korrekturrunde 4, Plan vor Änderung

Beim Audit der Startadapter ist die Entscheidung über Token/Startprüfung noch
zwischen Local und Release dupliziert. Zudem darf ein zwischen Startprüfung und
Bestätigung fehlendes Journal nicht als erfolgreicher Abschluss gelten.
Korrektur: gemeinsame recoverForStart/completeStart-Regel im Koordinator;
Adapter liefern nur Laufzeitidentität und Token. Fehlendes Journal bei Abschluss
wird abgewiesen. Aktuelle bereits bestätigte Daten werden weiterhin niemals
zurückgesetzt. Gemeinsame und kanalbezogene Starttests ergänzen.

### Phase 2 — Local-Datenmodule und Startbarriere, Zwischenstand

Local backupCampaignData delegiert die Datenaufnahme jetzt an ProfileMaintenance
über einen kleinen Node-Helfer des Entwickler-Installers. Kanonische Sicherung:
UUID-Verzeichnis mit manifest.json und data/. Der zusätzliche backup-manifest.json
bleibt ausschließlich ein Handoff-Nachweis außerhalb der gesicherten Nutzdaten.
Legacy-Payload-Verzeichnisse werden anhand ihres bisherigen Layouts erkannt.
Die kanonische Sicherung wird bei der Checkpoint-Prüfung ebenfalls validiert.

Die Local-Arbeitskopie verwendet migratePreparedProfile einschließlich fachlichem
Readback; die betroffenen Test-Installationsdaten enthalten jetzt echte Registry
und Einstellungen plus eine Sentinel-Tabelle. Künstliche Versionsüberschreibungen
bleiben ausdrücklich Fehlerfixtures, kein historischer Migrationsnachweis.

Local-Start und installierter Verifier sind für Journal v2 angebunden: Token,
Build-Commit und bei gepackter Laufzeit tatsächliche AppImage-Bytes müssen passen.
Core-Verbindungen öffnen erst nach der gemeinsamen Startentscheidung. Local und
Release benutzen recoverForStart/completeStart des Koordinators. Ein fehlendes
Journal während der Bestätigung wird abgewiesen. Der Local-Neustart behält seinen
expliziten Profilpfad bei.

Validierung: 43 betroffene Backup-/Release-Tests nach WAL-Korrektur bestanden;
zusätzlicher kanonischer Payload-Test bestanden. Nach fachlicher Local-Anbindung
32 Installer-Tests bestanden. Gemeinsame Start-/Recovery-Gruppe: 65 Tests bestanden.
Korrekturrunden 3 und 4 sind dadurch fachlich bestätigt; statische Prüfung folgt.

Weiterhin offen und nächster kritischer Schritt: local-app-installation.ts muss
Daten-/Programmaktivierung selbst über MaintenanceCoordinator ausführen; der
bisherige Local-Producer und dessen aktive Recovery sind noch vorhanden. Die neue
Startbarriere allein ist deshalb kein Beleg einer fertig umgestellten Local-
Installation. Desktop-/Symbolintegration muss beim Rückwechsel ebenfalls auf das
vorherige Deployment zeigen. Legacy-Local-Journale sind vor der neuen Veröffentlichung
zu übernehmen. Phase 2 bleibt offen; keine neue Handoff-/Release-Abnahme behauptet.

Statische Prüfung dieses Local-Zwischenstands: ESLint und beide TypeScript-Projekte
bestanden. GitHub Check 34216053831 für den vorherigen gepushten Release-Zwischenstand
33a6ca7c3ea63f8c0cd18ff0cf910ddd3fd85a71 ist vollständig erfolgreich; diese Remote-
Evidenz gilt ausdrücklich nicht für die anschließenden uncommitteten Local-Änderungen.

### Phase 2 — Local-Aktivierung: Integrationsdateien

Entscheidung vor Umsetzung: Desktop-Datei und Symbol werden als kleine
Integrationsdateien im selben Wartungsjournal geführt. Ihre alte und neue Fassung
wird vor Veröffentlichung gesichert; Programmzeiger und Profildaten bleiben unter
derselben Recovery-Entscheidung. Damit entfällt die aktive replaceAtomically-Saga,
ohne die sichtbare Local-Buildkennung oder bestehende Desktop-Pfade zu ändern.
Zielpfade werden auf applications/ und icons/ unter dem Installations-Datenverzeichnis
begrenzt. Alte Integrationsdateien bleiben bis zur bestätigten Startprüfung erhalten.

### Phase 2 — Korrekturrunde 5, Plan vor Änderung

Die Typprüfung der Local-Aktivierung meldet einen ungenutzten renameSync-Import.
Beim Integrationsaudit fehlen darüber hinaus der Nachweis unveränderter Desktop-
Dateien vor Abschluss und die Abweisung fremder Änderungen beim Rücksetzen.
Den Import entfernen, beim Rollback ausschließlich die erfasste alte oder eigene
neue Fassung zulassen und vor Commit Hash und Modus der Integration prüfen.
Gezielte Tests decken Unterbrechungen beider Integrationsdateien, wiederholten
Rollback, fremde Änderungen sowie fehlgeschlagene Startbestätigung ab. Diese
Prüfung ersetzt weder die Local-Adaptertests noch die spätere AppImage-Abnahme.

Korrekturrunde 5: 53 Koordinator-Tests bestanden, darunter neun neue Fälle zur
Desktop-Integration. Nächster Adapter-Schritt: bestehende Installer-Tests müssen
abgeschlossene Startprüfung ausdrücklich modellieren, bevor sie spätere Nutzdaten
schreiben. Absturztests werden auf die tatsächlich produzierten gemeinsamen
Journalgrenzen umgestellt; erfolgreiche Kopien vergleichen Inhalte statt SQLite-
Dateiheader. Bytegleicher Erhalt bei fehlgeschlagener Aktivierung bleibt Pflicht.

Local-Adapterprüfung: 29/32 Tests bestanden. Drei Erwartungen stammen vom ersetzten
Ablauf: Erstinstallation ohne vorbereitete Datenbank, bytegleiche SQLite-Header
nach erfolgreicher Online-Kopie und Fehlerauslösung beim sechsten alten Rename.
Korrekturplan: Erstinstallation auf initialisiertes leeres Schema prüfen, erfolgreiche
Updates auf erhaltene Sentinel-/Notizinhalte prüfen und Rename-Fehler am konkreten
Desktop-Ziel auslösen. Der fehlgeschlagene Updatefall behält die Bytegleichheits-
prüfung des ursprünglichen Datenstands bei.

### Phase 2 — Entfernung ersetzter Producer, Plan vor Änderung

Referenzsuche ergibt keine Aufrufer mehr für replaceAtomically und
migrateCampaignData. Beide alten Aktivierungsproducer werden entfernt. Die
verbleibenden Legacy-Leser werden noch nicht als sicher abgenommen: deren
Datenlöschung und unvollständige Übergangserkennung benötigen eine separate
Übernahmeprüfung. Der Desktop-Adapter liefert künftig nur Integrationsdateien;
der gemeinsame Koordinator besitzt allein den Programmzeiger.

Korrektur der Erstinstallations-Testannahme: migratePreparedProfile akzeptiert einen
leeren Profilordner; erst der echte Core-Start initialisiert die Datenbank. Der
Installer-Test prüft deshalb den leeren vorbereiteten Ordner und die noch ausstehende
Startprüfung, statt eine im Installer erzeugte Datenbank zu behaupten. Der zweite
Lauf bestand ansonsten 31/32 Fälle, einschließlich bytegleichem Fehler-Rollback.

### Phase 2 — Startfehler vor Electron, Plan vor Änderung

Der installierte Verifier gibt das Wartungstoken bereits weiter, behandelt aber
Fehler vor dem Start des Electron-Main-Prozesses noch ohne Recovery. Ein kleiner
Local-Prozessadapter soll vor dem Start unter Profilsperre die Transaktion erfassen,
die Sperre für den Appstart freigeben und nach Prozessende den dauerhaften Abschluss
prüfen. Bei Fehler wird unter erneut erworbener Sperre nur dieselbe unbestätigte
Transaktion zurückgesetzt. Bestätigte Arbeit oder eine andere Transaktion bleiben
unangetastet. Tests: Startfehler, Exit ohne Bestätigung, erfolgreicher Abschluss,
Fehler nach Abschluss und paralleler Besitzer der Profilsperre.

Startfehler-Adapter: alle neun Local-Starttests bestanden, darunter fünf neue externe
Verifier-Fälle. Release-Regression: 29 Tests in drei Integrationsdateien bestanden.
Typprüfung bestanden. ESLint meldet einen untypisierten vi.fn-Testcallback; diesen
auf die tatsächliche void-Launch-Signatur typisieren und Lint erneut prüfen.

### Phase 2 — Local-Aktivierung, Zwischenaudit

Implementiert: Local-Installer veröffentlicht Arbeitskopie, Programmzeiger, Desktop-
Eintrag und Symbol über MaintenanceCoordinator. Der vorherige Datenstand bleibt
bis zur bestätigten Startprüfung verfügbar. Local und Release teilen Startentscheidung
und dauerhaften Abschluss. Der externe Local-Verifier fängt Fehler vor Electron ab
und verlangt den nachgewiesenen Abschluss derselben Transaktion. Unbenutzte alte
Aktivierungsproducer sind entfernt; Desktop-Adapter liefert keine eigene Zeiger-
Aktivierung mehr.

Automatisierte Evidenz: 89 Tests in Koordinator/Local-Installer/Local-Start bestanden;
anschließend fünf zusätzliche Verifier-Fälle mit insgesamt neun Local-Starttests
bestanden. 29 Release-Integrations- und 91 Architekturtests bestanden. TypeScript
und ESLint bestanden nach Typisierung des Testcallbacks. Development-Build bestanden.
Die zuerst angegebene Unit-Datei release-recovery.test.ts existiert nicht; die
Release-Evidenz stammt ausdrücklich aus dem anschließend gelaufenen richtigen
Pfad tests/integration/release-recovery.test.ts, zusammen mit den beiden anderen
Release-Integrationsdateien.

Audit gegen aktuellen Umsetzungsplan: gekoppelte Local-Aktivierung und Startbarriere
belegt; Desktop-Unterbrechungen und unterbrochener Rollback geprüft. Quell-Bytegleichheit
im fehlgeschlagenen Update bleibt geprüft. Keine Gleichsetzung des leeren Installer-
Arbeitsordners mit einem tatsächlich startgeprüften App-Profil.

Audit gegen kanonische Phase 2: noch nicht bestanden. Alte Local-Journale werden
noch vom bisherigen Recovery-Leser bearbeitet; dessen Löschungen und Entscheidung
allein nach Datenlesbarkeit/Zeiger sind nicht der verlangte gemeinsame Ablauf.
Weiter offen: sichere Legacy-Übernahme mit Unterbrechungstests, vollständige Prüfung
des stabilen Local-Starts bei nicht ausführbarem Ziel und Wiederverwendungsprüfung
gegen den gemeinsamen Journalzustand. Der nächste Korrekturplan muss diese Lücken
schließen. Phase 2 bleibt in Arbeit; Phasen 3–7 sind unverändert offen. Kein neuer
Handoff, keine Live-Abnahme und keine Veröffentlichung erfolgt.

Development-Smoke unter Xvfb ebenfalls bestanden: Core ready, regulärer Exit 0.
Dieser Nachweis ist kein gepackter Local-Handoff.

### Phase 2 — Legacy-Local-Übernahme, Plan vor Änderung

Vorheriger Zielturn: Fortschritt; Commit 9a9e90710 enthält die geprüfte gemeinsame
Local-Aktivierung. Aktuelle Arbeitskopie sauber. Verbleibender alter Recovery-Leser
löscht Daten anhand Schema-Lesbarkeit und entscheidet Programmabschluss separat.

Ersetzung: abgeschlossene Altvorgänge erhalten spätere Arbeit unverändert. Für
unterbrochene Local-v2-Vorgänge Quellen und Pfade strikt prüfen; alte Programm-
identität aus aktuellem oder gesichertem Zeiger lesen. Beim alten Rename-vor-Journal-
Fenster die deterministische Rollbackdatei aus dem Stagingnamen berücksichtigen.
Vorhandenen Datenrollback oder geprüfte Vorgangssicherung in einen kanonischen
Rückweg kopieren, ohne die alten Belege zu entfernen. Desktop-Rückwege ebenfalls
kopieren. Erst danach das gemeinsame Journal dauerhaft schreiben; sämtliche
Live-Rücksetzung übernimmt MaintenanceCoordinator. Wiederholte Aufnahme muss
kopierte Belege validieren statt überschreiben. Fehlende oder widersprüchliche
Rückwege werden ohne Änderung der Live-Daten abgewiesen.

Backupvalidierung in reine Sicherungsprüfung und Live-Checkpoint-Prüfung teilen,
damit alte Sicherungen nach Datenpromotion prüfbar bleiben. Tests decken Daten-
und Desktop-Renamefenster, entfernten direkten Datenrollback, erneute Unterbrechung
nach Aufnahme, abgeschlossene spätere Arbeit und ungültige Pfade/fehlende Rückwege
ab. Legacy-v1-Provenienz ohne erforderliche Identitätsnachweise bleibt explizit
abgewiesen. Keine Unterstützung bislang unbekannter Altzustände behaupten.

Legacy-Aufnahmeprüfung: 11 neue Tests bestanden (32 bestehende Installer-Fälle im
gezielten Lauf übersprungen). Alte Rename-vor-Journal-Fenster, Sicherungsrückweg,
abgeschlossene Arbeit und fehlerhafte Pfade sind damit direkt geprüft.
Ergänzender Auditplan: terminale Altbelege ebenfalls vor späterem Überschreiben
archivieren; Aufnahme mit unterbrochener gemeinsamer Rücksetzung sowie Fortsetzung
über den öffentlichen Installer testen. Fehlenden alten Programmzeiger nach
Promotion explizit abweisen, statt eine Version aus den Deployments zu erraten.

Legacy-Runde: 125 Tests in vier Dateien bestanden, einschließlich aller bisherigen
Installer-Fälle und der neuen Aufnahme-/Fortsetzungsfälle. TypeScript bestanden;
ESLint meldet fünf überflüssige Non-null-Assertions in der Legacy-Testfixture.
Diese entfernen. Nächster Auditpunkt: inspectLocalAppInstallation darf einen
Aktivierungsbeleg nicht wiederverwenden, wenn das gemeinsame Journal bereits
zurückgesetzt wurde oder eine andere Programmidentität nennt. Die Lesefunktion
an diesen Zustand binden und mit manipuliertem Journal direkt prüfen.

### Phase 2 — Legacy-Local-Zwischenaudit

Implementierung gegen Rundenplan: alte Local-Recovery entfernt; v2-Altvorgänge werden
unter bestehender Profilsperre aufgenommen. Originaljournal, alter Datenrollback,
Sicherungen und Desktop-Rückwege bleiben erhalten. Kopierte Rückwege werden vor dem
gemeinsamen Journal synchronisiert; nach dessen Existenz entscheidet ausschließlich
MaintenanceCoordinator über Rücksetzung. Die vorherige Programmidentität wird aus
dem belegten Zeiger gelesen, nicht aus der Reihenfolge vorhandener Deployments.
Terminale Altvorgänge sichern ihren Beleg und behalten spätere Arbeit.

Validierung: 125 Tests in Local-Installer, Koordinator, Local-Start und Release-
Recovery bestanden. Zusätzlich direkter Test der widersprüchlichen Aktivierungs-
belege bestanden; übrige 46 Fälle bei diesem gezielten Zusatzlauf übersprungen.
91 Architekturtests, TypeScript und ESLint bestanden. Keine aktiven Referenzen
auf recoverCampaignMigrationArtifacts, recoverActivationState oder
campaignPersistenceIsReady verbleiben.

Audit gegen kanonische Phase 2: Legacy-Local-Aufnahme und Wiederverwendungsbarriere
sind implementiert und direkt geprüft. Abschluss weiterhin offen: der stabile
Local-Startpunkt und sein Verhalten bei nicht ausführbarem Ziel müssen noch gegen
die gemeinsame Recovery qualifiziert werden. Insbesondere darf ein alter Local-
Build ohne Kenntnis des neuen Journals nicht mit unbestätigten neuen Daten als
Fallback gestartet werden. Der externe Verifier schützt den Handoff-Start bereits;
das ist kein Beleg für diesen Desktop-Startfall. Danach steht das vollständige
Phase-2-Abschlussaudit einschließlich der Release-Legacy-Aufnahme an.

Remote Check 34219709769 für vorherigen Commit 9a9e90710 zum Auditzeitpunkt noch
in_progress: alle abgeschlossenen Prüfjobs erfolgreich; campaign-workspaces und
hex-npc-restart laufen. Dies ist keine Remote-Abnahme der uncommitteten Legacy-Runde.

### Phase 2 — Stabiler Starthelfer, Plan vor Änderung

Vorheriger Zielturn: Fortschritt (8838ed8ee, Legacy-Aufnahme und Belegprüfung).
Aktuelle Arbeitskopie sauber. Tatsächliches vorhandenes Local-AppImage mit
ELECTRON_RUN_AS_NODE=1 und APPIMAGE_EXTRACT_AND_RUN=1 read-only geprüft: Node
24.18.0 / Electron 43.2.0, Exit 0, keine normale App gestartet.

Der stabile Startpunkt soll einen separat gebündelten CJS-Starthelfer über den
mitgelieferten Node-Modus eines erhaltenen, geprüften AppImages ausführen. Dieser
Helfer benutzt denselben Koordinator und dieselbe Profilsperre vor jeder normalen
Appöffnung. Die alte App muss das neue Journal nicht selbst verstehen. Normale
Desktopstarts bestätigen keine Wartung: unbestätigte Vorgänge werden zuerst
zurückgesetzt; bestätigte spätere Arbeit bleibt erhalten. Fehlende Erstinstallation
oder blockierte Sperre führen zu einer verständlichen Abweisung.

Reihenfolge: eigenständigen Starthelfer und Bundle in den Build aufnehmen, mit
echtem vorhandenen AppImage-Interpreter auf isolierten Daten prüfen; anschließend
Local-/Release-Installer auf denselben Starter umstellen und den extrahierten
Helfer an geprüfte AppImage-Bytes binden. Der Helfer führt keinerlei SQL aus.
Sperre wird vor normalem Appstart freigegeben, ELECTRON_RUN_AS_NODE und die
Interpreter-AppImage-Umgebung werden nicht in die normale App vererbt.
Tests: nicht ausführbares Ziel, unterbrochene Zeiger-/Datenpromotion, Erstinstallation,
Parallelstart und Crash nach bestätigter Nutzung. Phase 2 schließt erst nach
Anbindung und deren eigenem Abschlussaudit.

### Phase 2 — Starthelfer, Zwischenaudit

Implementiert: eigener CJS-Starthelfer aus demselben Koordinator und Lockmodul;
Build- und Qualification-Build bündeln ihn ohne externe Pakete, AppImage-Packaging
nimmt ihn als Resource auf. Gemeinsamer Shell-Starter bindet Interpreter und
unveränderlichen Helfer an SHA-256 und prüft beide vor Ausführung. Der Helfer
setzt unbestätigte Vorgänge unter Sperre zurück, prüft den Programmzeiger samt
Hash und gibt die Sperre vor normalem Appstart frei. Spätere Programmfehler
verursachen keine weitere Rücksetzung.

Validierung: 17 Unit-Tests bestanden (14 Local-Startfälle, drei Launcherfälle),
91 Architekturtests bestanden; TypeScript, ESLint und vollständiger Development-
Build bestanden. Manuelle technische Probe mit echtem vorhandenem AppImage als
Node-Interpreter und synthetischem Programm-/Datenpaar: gemeinsamer Shell-Starter,
gebündelte Recovery, Rückkehr zum vorherigen Paar und bereinigte Kindprozess-
Umgebung erfolgreich. Keine echte Kampagne und keine zwei echten Zielprogramme
in dieser Probe; sie ersetzt nicht Phase 5 oder Live-Abnahme.

Die vorhandene Local-current-Verknüpfung zeigte zwischen den Proben auf ein anderes
Deployment. Daher die technische Probe auf den unveränderlichen alten Deployment-
Pfad bfad4ba546969a84bd2d1d0dd4433fa2179d90478feba87227bfa58781913a09 fixiert
und erneut erfolgreich geprüft. Interpreterhash:
8801d0ba2a6847d48745d4af9978adbd29fbec5c7761ab6f1b8f62ffc55c6c57.
Die vorhandene Installation wurde durch diese Proben nicht verändert.

Audit gegen Plan: Starthelfer und eigenständiger Laufzeitnachweis bestanden.
Audit gegen gesamte Phase 2: weiterhin offen, da Local-/Release-Installer den
neuen gemeinsamen Starter noch nicht installieren. Nächster Schritt ist die
Extraktion des Helfers aus dem geprüften Ziel-AppImage, dauerhafte Installation
vor Desktop-Aktivierung und Ablösung des alten Release-Shell-Fallbacks. Danach
Anbindungstests einschließlich unterbrochener Installation und Abschlussaudit.

### Phase 2 — Installeranbindung des Starthelfers, Plan vor Änderung

Vorheriger Zielturn: Fortschritt (ca90dd7d8, gebündelter und separat geprüfter
Starthelfer). Aktuelle Arbeitskopie sauber. Jetzt gemeinsame Extraktion aus dem
hashgeprüften Ziel-AppImage über dessen Node-Modus; keine Workspace-Kopie als
Produktionsquelle. Ausgabe gerahmt und begrenzt lesen, Programmhash vor und nach
dem Lesen prüfen. Local-Testartefakte aus Text haben dafür eine ausdrücklich
benannte Extraktions-Testnaht; echte AppImage-Qualifikation bleibt separat.

Beide Installer installieren denselben Starter mit einem erhaltenen unveränderlichen
AppImage als Interpreter, bevor normale Desktop-Aktivierung möglich ist. Local-
Desktop-Eintrag zeigt auf root/start. Release ersetzt seinen bisherigen Shell-
Fallback durch denselben Starter. Bestehende Journale und die normale Startprüfung
bleiben beim gemeinsamen Koordinator. Aktivierungs-/Wiederverwendungsprüfung muss
auch fehlende oder veränderte Starterbelege erkennen. Bei einem Fehler darf der
bisherige Datenstand nicht ersetzt werden. Nachweise: vollständige Local-Tests,
Release-Controller-/Launcher-Tests, echte Extraktion aus einem neu gebauten Test-
AppImage, dann Phase-2-Abschlussaudit.

### Phase 2 — Korrekturrunde: AppImage-Entpackverzeichnisse

Echte Installer-/Desktop-Probe: Zielhelfer bytegleich extrahiert; gemeinsamer
Rollback erfolgreich, vorherige echte App erreicht Core ready und regulären
Core-Exit 0. Gesamtstarter liefert dennoch 127 mit „Failed to clean up cache
directory“. Interpreter und normale App sind dasselbe alte AppImage und verwenden
beim verschachtelten Extract-and-run denselben temporären Cache.
Korrekturplan: dem normalen Kindprozess ein eigenes temporäres Verzeichnis geben,
nach dessen Ende ausschließlich dieses eigene Verzeichnis aufräumen. Danach das
Artefakt neu bauen und die identische Probe wiederholen; den bisherigen Lauf
nicht als bestanden zählen. Tests müssen zusätzlich Fehler nach bestätigter
Nutzung ohne Datenrollback und einen ersten erfolgreichen Start prüfen.

Echte Probe nach Korrektur bestanden: vorheriges Local-AppImage SHA
8801d0ba2a6847d48745d4af9978adbd29fbec5c7761ab6f1b8f62ffc55c6c57,
neu gebautes Test-AppImage SHA
2cbb42f80f37b2eee7fa2c6ee87613ed9a8722d7f5d7b6217e49f664850f7635.
Helfer bytegleich aus dem Ziel extrahiert. Isolierte Kampagne Starthelfer-Probe:
beschädigtes unbestätigtes Ziel → Desktop-Rollback → alte App ready; danach intaktes
Update → installierter Runtime-Verifier bestätigt → normaler Desktopstart; erst
anschließend beschädigtes Programm lässt bestätigte spätere Notizen unverändert.
Beide Artefakte tragen noch Paketversion 0.2.0; unterschiedliche Builds und echtes
Starterverhalten, kein behaupteter veröffentlichter Versions-/Schemawechsel.

Ergänzende Prüfplanung: Extraktionsgrenze direkt gegen falschen Hash, Prozessfehler,
mehrdeutige Ausgabe und Änderung während Ausführung testen. Starterbeleg-Reparatur
über den echten Local-Adapter prüfen. Diese neuen Tests verändern keine App-Build-
Eingaben des bereits geprüften technischen Artefakts.

### Phase 2 — Korrekturrunde: Übergang vom Starter zur alten App

Auditabweichung: Zwischen Freigabe der Profilsperre im Helfer und Erwerb durch die
normale App kann ein externer Local-Installer beginnen. Ein alter Local-Build
versteht das gemeinsame Journal noch nicht und darf nach diesem Fenster keinen
inzwischen aktivierten neuen Datenstand öffnen. Korrektur: eine Startreservierung
über dieselbe bestehende Sperrimplementierung hält den gesamten Desktop-Kindprozess;
Local-Installer erwerben sie vor der Profilsperre. Der normale App-Profilbesitz
bleibt unverändert. Dies verhindert externe Installation schon während der
Startübergabe. Kanalübergreifende kanonische Pfade bleiben ausdrücklich Phase 3.
Tests: blockierte Installation bei aktiver Startreservierung und garantierte
Freigabe nach fehlgeschlagenem Start. Keine neue Recovery-Entscheidungsquelle.

### Phase 2 — Korrekturrunde: Lebensdauer bei Relaunch und Extraktion

Audit: relaunchRelease legt sein Verzeichnis unter dem aktuellen TMPDIR an. Ein
rekursives Entfernen dieses Elternverzeichnisses durch den neuen Starter könnte
den bereits neu gestarteten Prozess beschädigen. Nach dem Kindprozess nur ein
leeres Verzeichnis entfernen; belegte Nachfolgerverzeichnisse erhalten. Außerdem
braucht readAppImageLauncher eigenes TMPDIR, insbesondere bei Restore aus dem
noch laufenden AppImage. Dafür einen eigenen, begrenzten Extraktionsprozess ohne
normale App starten und nur dessen Scratch nach Ende entfernen. Regressionstest
mit belegtem Relaunch-Verzeichnis und leerem Normalfall ergänzen.

Vollständige technische Probe mit Startreservierung und frischer Installation
bestanden (Testartefakt 516cf02a0daf27dca029a022f82c653681b0087b4a8339d7b5307de638bd1ede).
Zusatzprüfung: 24 Start-/Extraktionstests bestanden. TypeScript und 91 Architektur-
tests bestanden. ESLint beanstandet Throw im Cleanup-finally: eine nichtkritische
Temp-Bereinigung darf das Ergebnis der App nicht überschreiben. Unerwartete
Cleanupfehler nur protokollieren, erhaltene Verzeichnisse nicht rekursiv löschen;
Lint und Zielartefaktprobe nach dieser Korrektur erneut prüfen.

### Phase 2 — Abschlussaudit-Korrektur: mehrdeutiger Release-v1-Rollback

Historischer Producer 4bd7892/core/maintenance/profile-transaction.ts geprüft:
Nach Rückkehr alter Daten ist entweder die unaktivierte Arbeitskopie staged-ID
oder der erhaltene fehlgeschlagene Stand failed-ID vorhanden. Der aktuelle
v1-Adapter prüft bei rolling-back ohne previous-ID nur, ob Live-Daten existieren;
das reicht bei verlorenem vorherigem Stand nicht als Recovery-Nachweis.
Korrektur: bei hadData zusätzlich staged-ID oder failed-ID verlangen, sonst
Journal und Daten unverändert lassen und Prüfung verlangen. Den gültigen bisherigen
Test mit failed-ID beibehalten; mehrdeutigen Fall ohne beide Marker ergänzen.
Dies betrifft ausschließlich Legacy-Release-Aufnahme, nicht den in der technischen
AppImage-Probe ausgeführten Local-Startpfad.


## Phase 2 — Abschlussaudit, 2026-09-08

Gemeinsamer Abschlusslauf: 159 Tests in acht Koordinator-/Local-/Release-Dateien,
alle bestanden. TypeScript und ESLint bestanden. 91 Architekturtests bestanden.
Zuvor und nach Korrekturen: eigenständiger Helper-Build, vollständiger Local-Build
und AppImage-Paketierung erfolgreich. Abschließende technische Artefaktprobe mit
Zielhash 0995d1b717e29a8674c393febad4fa0c0236134d30f95dbd37980be5dfc03670
und vorherigem Hash 8801d0ba2a6847d48745d4af9978adbd29fbec5c7761ab6f1b8f62ffc55c6c57
bestanden, einschließlich leerer Erstinstallation und installierter Runtimeprüfung.
Der spätere Release-v1-Guard ist durch Release- und Abschlusstests belegt; diese
Release-only-Korrektur wird nicht dem vorherigen Local-Testartefakt zugeschrieben.

Audit gegen Phase-2-Plan:
1. Striktes gemeinsames Journal, dauerhafte Übergänge und Abschluss vor Freigabe:
   implementiert; gemeinsame Fehler-/Commit-/Rücksetzungstests bestanden.
2. Backup, Migration und fachlicher Readback bleiben gemeinsame Datenmodule;
   Aktivierung ist daraus entfernt, SQL verbleibt bei Datenbankverantwortlichen.
3. Beide Adapter und deren Startbarrieren benutzen den Koordinator. Wiederherstellung
   verwendet das vorhandene Release-Deployment; Test prüft Identität und Anzahl.
4. Local-Handoff-Belege behalten Provenienzfunktion, entscheiden nicht über Recovery;
   Belegwiederverwendung prüft gemeinsames Journal und Starteridentität.
5. Alte Producer entfernt. Local-/Release-Altjournale werden vor neuer Wartung
   aufgenommen, mehrdeutige alte Zustände ohne Live-Änderung abgewiesen.
6. Gemeinsame Unterbrechungstabelle und konkrete Adaptertests bestanden. Echter
   Starter mit zwei AppImages zusätzlich geprüft; keine Datenrollback-Automatik
   nach bestätigter Nutzung.

Separates Audit gegen kanonische Phase 2: bestanden im geforderten gemeinsamen
Wartungs-/Recovery-Umfang. Phasenstatus auf abgeschlossen gesetzt. Vollständige
historische Schema-Artefakte und alle physisch/packaged injizierten Fehlerfälle
bleiben ausdrücklich Phase 5, kanalübergreifende Profile/Pfad-Aliase Phase 3.
Die Abnahmematrix ist auf die jetzigen Besitzer und Belege aktualisiert.

Fortschrittsstatus: implementiert und gezielt automatisiert geprüft; nicht als
neuer kanonischer Local-Handoff, Main-Promotion, echter Nutzerdaten-Livetest oder
öffentliche Veröffentlichung ausgegeben. Diese Gesamtgates bleiben offen.
GitHub Check 34221766403 für den vorherigen ca90dd7d8-Zwischenstand ist erfolgreich;
auch das ist kein Remote-Nachweis für die jetzt folgenden Änderungen.

Nächste Phase: Phase 3 nach erneuter Bestandsaufnahme planen. Gemeinsame kanonische
Profilsperren einschließlich Startreservierung und dauerhaft angelegter Profil-
verzeichnisse, vollständige sichere Quelle/Übernahme, Restore sowie Recovery ohne
startfähige Kampagnendatenbank. Die ursprüngliche Roadmap bleibt unverändert.

## Phase 3 — Plan vor Umsetzung, 2026-09-08

Vorheriger Zielturn: Fortschritt; Phase 2 abgeschlossen auf a5daf8ea6. Aktuelle
Arbeitskopie sauber. Bestandsaufnahme: Main sperrt nur Local/Release, Development
nutzt noch automatischen Reset bei Inkompatibilität. Import prüft SingletonLock
und einen aus dem ungeprüften Pfad abgeleiteten Elternlock. ProfileMaintenance
sichert derzeit campaign-data; die Vollständigkeit des gesamten persistenten
Profils und Recovery ohne gestarteten Core sind deshalb eigenständige offene
Arbeitspakete, keine bereits erfüllten Garantien.

Ziel: M07–M11 sowie die Profilseite von M03 erfüllen. Reihenfolge:
1. Kanonische Profilpfade und dauerhafte Verzeichniserstellung; gemeinsame
   Profilzugriffsschicht für Linux Development, Local, Release, Installer,
   Starthelfer und Utility-Auftrag. Sperren liegen außerhalb austauschbarer
   Profile und sind pro kanonischem Profil getrennt. Bestehende Local-/Release-
   runtime.lock bleibt als Kompatibilitätssperre bestehen. Startreservierung
   ebenfalls kanonisch binden. Kein automatischer Reset bestehender Profile.
2. Persistente Profileigentümer/Dateien inventarisieren. Vollständigen Payload
   (Einstellungen, Kampagnen inkl. inaktiv/Trash, eigene Dateien, Spielzustand)
   von ausschließlich flüchtigen Laufzeitdateien unterscheiden; bestehende
   Backupformate lesbar halten. Aktivierungs-/Sperrgrenzen beim Profiltausch
   und späte Electron-Schreibvorgänge ausdrücklich prüfen.
3. Unterstützte Quelltypen anhand eines belegten Produzenten/Protokolls prüfen.
   Nicht kooperierende Altanwendungen nur über konsistente, validierte Sicherungen/
   Exporte zulassen. Kein stiller Direktordner-Fallback. Alias/Selbstimport,
   gleichzeitigen Start und Veränderung der Quelle abweisen bzw. verhindern.
4. Vollständige Wiederherstellung mit vorgeschalteter erhaltener Sicherung,
   Vorwärtsmigration und Ablehnung neuerer Datenstände durchführen.
5. Recovery-/Profilwahl auch bei fehlgeschlagenem Core-Start zugänglich machen;
   Renderer erhält nur validierte IDs und Statusdaten.
6. Repräsentative Inhalte vor/nach Import und Restore vergleichen, Prozesse über
   Profilaliase gegeneinander starten; relevante Checks und getrennte Audits
   gegen diesen Plan und die kanonische Phase 3. Erst danach Phase 3 schließen.

Erster Umsetzungsschritt: kanonische externe Profil-Lockpfade plus kompatible
Elternlocks. Keine Source-Marker als alleinigen Beweis sicherer Legacy-Übernahme
verwenden. Die Quellzulassung wird erst nach ihrer eigenen Prüfung erweitert.

### Phase 3 — Zwischenstand: gemeinsamer Profilzugriff

Kanonische Pfadauflösung umfasst bestehende Elternverzeichnisse, bevor ein neues
Profil angelegt wird. Neue Verzeichniseinträge werden unter Linux synchronisiert.
Die profilbezogene Sperre liegt außerhalb des austauschbaren Profilbaums;
Local-/Release-Elternlocks bleiben zusätzlich erhalten. Main erwirbt unter Linux
auch im Development-Kanal die gemeinsame Sperre vor app.whenReady; bestehende
Profile werden bei Inkompatibilität nicht mehr automatisch zurückgesetzt.
Local-Installer, Runtime-Verifier und Desktopstarter verwenden dieselbe
Zugriffsschicht. Die Startreservierung besitzt zusätzlich eine kanonische Identität.

Gezielte Prüfung: 72 Tests aus local-profile-lock, local-maintenance-start und
local-app-installation bestanden. Nach letzten Ergänzungen 24 Sperr-/Starttests
bestanden, darunter ein echter zweiter Node-Prozess über einen Symlink-Alias,
unabhängige Geschwisterprofile, Sperrerhalt beim Profiltausch und kompatibler
Altprozess mit Freigabe eines gescheiterten zusammengesetzten Sperrerwerbs.
TypeScript und scoped ESLint liefen zunächst erfolgreich; abschließender
TypeScript-/Architekturlauf wird separat festgehalten.

Zwischenaudit gegen Plan und Roadmap: dieser Schritt trägt zur gemeinsamen
Profilsperre bei, erfüllt Phase 3 aber noch nicht. Import-Quellzulassung und
Utility-Auftragsprüfung verwenden noch ihre bisherigen Elternlock-Prüfungen.
Vollständiger Profilpayload, Electron-Schreibgrenzen beim Austausch und Recovery-
Bedienung bleiben offen. Insbesondere ist ein bestandener Profiltausch-Sperrtest
kein Nachweis für einen vollständigen sicheren Electron-Profiltausch.
Kein Handoff und keine Veröffentlichung dieses Zwischenstands.

Abschließender TypeScript-/Architekturlauf erfolgreich beendet (Logs
roadmap-phase3-profile-access-typecheck.log und
roadmap-phase3-profile-access-architecture.log im Arbeitsverzeichnis).
Nächster Schritt: primäre kanonische Sperridentität im Utility-Auftrag prüfen,
Importquellen nach belegtem Kooperationsprotokoll zulassen und vollständige
persistente Profileigentümer inventarisieren. Phase 3 bleibt in Arbeit.

### Phase 3 — Utility-Auftragsprüfung, Plan vor Umsetzung

Vorheriger Zielturn war Fortschritt: kanonischer Zugriff implementiert und geprüft.
Der Wartungseinstieg vertraut noch einer unvalidierten PID im alten runtime.lock.
Jetzt dieselbe strikte Lockstruktur und Linux-Prozessidentität wie beim Sperrerwerb
verwenden. Zielwartung muss sowohl kanonische Profilsperre als auch kompatiblen
Elternlock dem lebenden auftraggebenden Anwendungsprozess zuordnen, bevor der
Utility-Auftrag startet. Fehlende, manipulierte, fremde und veraltete Sperren
werden nur gelesen und abgewiesen. Tests prüfen insbesondere eine noch existierende
PID mit abweichender Startidentität, damit PID-Wiederverwendung nicht genügt.

### Phase 3 — Quellunverändertheit, Plan vor Umsetzung

snapshotProfile liest die Quelle unter der vorausgesetzten exklusiven Sperre,
prüft bisher aber nicht nochmals deren vollständiges Dateiinventar. Vor Freigabe
der Arbeitskopie ein zweites Inventar mit dem ursprünglichen vergleichen; eine
Veränderung bricht die Vorbereitung ab. Ein Integrationstest verändert eine eigene
Datei während des asynchronen SQLite-Backups und verlangt Ablehnung. Ein normaler
Snapshot muss die Quelle bytegleich lassen und eigene Dateien erhalten. Dies
ersetzt ausdrücklich keine Quellzulassung und beweist bei unkooperierenden
Schreibern keine konsistente Quelle; deren sichere Backupwege bleiben offen.

### Phase 3 — Prüfergebnisse und Zwischenaudit

Utility-Zulassung: 11 Tests in local-profile-lock und
release-controller-maintenance bestanden. Nach ergänzendem Test für beide
Elternleases 10 direkte Lock-/Zulassungstests bestanden. Der Entrypoint benutzt
nun assertProfileAccessOwner vor maintenanceWorker; dieser prüft striktes Schema,
PID, Anwendungseigentümer und Boot-/Start-/Executable-Identität für beide Locks.
Fehlende und veränderte Lockdateien werden dabei nicht repariert oder überschrieben.

Quellinventar: 12 Release-Maintenance-Integrationstests bestanden. Neuer Test
ändert während des echten asynchronen SQLite-Backups eine eigene Datei; Snapshot
wird abgewiesen, aktuelle Quelldatei bleibt erhalten. Separater Erfolgstest prüft
unveränderte Quellbytes und eigene Datei im Ziel. Die Prüfung erfolgt vor Rückkehr
an den Vorbereitungsablauf; keine Aktivierung einer so abgewiesenen Arbeitskopie.

Audit gegen die beiden vorangestellten Teilpläne: erfüllt. Audit gegen die gesamte
kanonische Phase 3: weiterhin offen, insbesondere sichere Legacy-Quellzulassung,
vollständiger Profilpayload und bedienbare Recovery. Inventarvergleich ist nur
zusätzlicher Fehlernachweis unter der Sperrannahme, keine Zusage für unkooperierende
laufende Quellen. Keine Änderung der ursprünglichen Roadmap und kein Handoff.

TypeScript und scoped ESLint für diesen Stand ebenfalls bestanden
(roadmap-phase3-owner-typecheck.log, roadmap-phase3-owner-lint.log).
Vorheriger Zielturn und dieser Zielturn sind Fortschritt, kein wiederholter Blocker.
Nächster Arbeitsschritt bleibt Quellzulassung samt vollständigem Profilpayload;
der bisherige direkte Importordnerpfad ist noch kein qualifizierter Altprofilweg.

### Phase 3 — Sicherungsimport, Plan vor Umsetzung

Istbefund: importProfile akzeptiert beliebige installation.sqlite-Ordner und
vermutet Kooperation anhand eines abgeleiteten Elternlocks. Dieser Fallback erfüllt
keine sichere Altquellzulassung. Implementierung: bestehendes Sicherungsformat 1 als
gemeinsamen strikten Vertrag auslagern; externer Import akzeptiert nur manifestierte,
restorable Sicherungen mit vollständiger passender Datei-/Hashliste. Utility prüft
vor und nach Vorbereitung denselben Sicherungsstand. Zieldaten werden zuvor wie
bei Restore gesichert; Migration bleibt in der Zielversion. Main bietet die Wahl
eines Sicherungsordners an und reicht ihn als expliziten import-backup-Auftrag
weiter. Bekanntes Profil darf den Dialog zu dessen Sicherungen führen, aber keine
ungeprüfte Rohdatenübernahme auslösen. Defekte Manifeste, Hashabweichung, Rohordner,
neuere Datenformate und Quellenänderung bleiben ohne Zielaktivierung.

Dieser Schritt qualifiziert vorhandenes campaign-data-Sicherungsformat 1, nicht
bereits den späteren vollständigen Electron-Profilumfang. Direkte Übernahme
kooperierender Profile und vollständiger Payload bleiben bis zu eigenem Nachweis
offen. Prüfungen: echte fremde Sicherung importieren, aktuelle Zielarbeit sichern,
Quelle bytegleich, Rohordner/Manipulation ablehnen, Controller reicht explizite
Operation weiter. Originalroadmap unverändert.

### Phase 3 — Sicherungsimport: Korrekturrunde vor Abschlussprüfung

17 erste Integrationstests bestanden; erweiterter Lauf mit neuerem Datenformat,
Metadatenänderung und Architektur: 92 Tests bestanden. TypeScript bestanden.
ESLint findet in zwei neuen Testfällen untypisierte JSON-Manifeste. Korrekturplan:
auch in diesen mutierenden Fixtures den gemeinsamen profileBackupSchema-Vertrag
parsen, anschließend die betroffenen Tests und Lint erneut prüfen. Keine Änderung
der Produktionssemantik erforderlich.

### Phase 3 — Auditkorrektur: zulässige Linux-Dateinamen

Der neue Manifestvertrag darf bestehende Sicherungen eigener Dateien nicht enger
als das Linux-Dateisystem auslegen. Backslash ist unter Linux ein gültiges Zeichen
im Dateinamen, kein Pfadtrenner. Korrektur vor Commit: dieses Verbot entfernen;
relative Slash-Segmente, Ganzzahlgröße und SHA-256-Struktur bleiben validiert.
Die Hashliste wird gegen tatsächliches Inventar verglichen und nicht als beliebiger
Schreibpfad verwendet. Bestehende Integrationstests erneut ausführen.

### Phase 3 — Sicherungsimport: Audit und Candidate-Zwischenstand

Umsetzung gegen Teilplan geprüft: gemeinsam validierter Format-1-Sicherungsvertrag,
expliziter import-backup-Auftrag an die Zielversion, Manifest-/Inventarprüfung vor
und nach Vorbereitung, vorherige Sicherung der aktuellen Zieldaten und Aktivierung
nur über den bestehenden Koordinator. Die Oberfläche fordert jetzt ausdrücklich
einen Sicherungsordner an. Der unqualifizierte Rohdatenordner-Fallback ist entfernt.
Die Auswahl bekannter Profile führt lediglich zum Sicherungsdialog, nicht zu einer
impliziten Zusage direkter Profilübernahme.

Prüfungen: 92 Tests im kombinierten Import-/Controller-/Architekturlauf bestanden;
94 Tests im separaten Lock-/Local-Installer-/Start-/Release-Recovery-Lauf bestanden.
TypeScript bestanden. Scoped ESLint nach Korrektur der beiden Test-Manifeste
bestanden; betroffene 16 Integrationstests erneut bestanden. Der Backslash-Guard
wurde als unbegründete Linux-Dateinamenbeschränkung entfernt und separat nachgeprüft.
Dokumentation der Persistenzgrenzen auf die implementierte Phase-2-Zuständigkeit
und Phase-3-Teilschritte aktualisiert.

Separates Audit gegen gesamte Roadmap: Phase 3 bleibt offen. Format 1 enthält
campaign-data, nicht beliebige Dateien außerhalb davon. Vollständiger persistenter
Profilumfang, direkte Übernahme kooperierender Quellen, Erhalt leerer Ordner und
bedienbare Recovery ohne Core sind weiter erforderlich. Dieser Candidate ist kein
Alltagsrelease, kein abgeschlossener Phase-3-Nachweis und kein kanonischer Handoff.
Nächster Schritt: persistente Profildateien von Electron-Laufzeitdateien trennen,
vollständigen Backup-/Aktivierungspayload versionieren und Altformat 1 bewusst
weiter lesbar halten. Keine stillschweigende Verengung des finalen Profilumfangs.

### Phase 3 — Vollständiges Profil: Schreibgrenzen vor Payloadwechsel

Vorheriger Zielturn war Fortschritt; d6cb89a0c ist sauber auf dem Candidate gepusht.
Bestandsaufnahme: sämtliche App-Einstellungen und Domänendaten liegen unter dem
Core-Datenroot; Renderer verwendet kein localStorage/indexedDB zur Persistenz.
Electron verwendet userData/sessionData jedoch derzeit ebenfalls im Profilbaum.
Damit kann Main nach dem Schließen von SQLite weiter Chromium-Dateien schreiben.
Electron app-Dokumentation (https://www.electronjs.org/docs/latest/api/app#getpathname)
beschreibt sessionData als Cookies/Cache/Local Storage/Netzwerkzustand; Pfadwechsel
muss vor ready erfolgen. Nur sessionData auszulagern genügt nicht als Garantie für
sämtliche Electron-Dateien: auch userData wird vom logischen Profil getrennt.

Plan vor Umsetzung: logischen Profilpfad beim Start erfassen und kanonisch sperren.
Electron userData und sessionData in ein eindeutig profilbezogenes Geschwister-
Laufzeitverzeichnis außerhalb des tauschbaren Profilbaums setzen. Core, Recovery,
Runtime-Abnahme und Relaunch verwenden ausdrücklich den logischen Profilpfad;
keine spätere Ableitung aus Electron userData. Bestehende Profildateien bleiben
unverändert an Ort und Stelle. Wartungsmodus erhält einen eigenen temporären
Electron-Laufzeitordner vor ready. Danach den vollständigen Payload versionieren;
noch keine vorhandenen Nutzerdaten verschieben oder als entbehrlich löschen.

Prüfung dieses Schritts: Aliasidentität, vorhandene eigene Dateien unverändert,
Electron-Schreibpfade außerhalb des Profils, fehlgeschlagene Konfiguration gibt
Sperren frei, reale Electron-Probe mit Browser-Schreibvorgängen und Vergleich der
logischen Profildateien. Anschließend Typen/Lint/Architektur sowie passende Starts.

### Phase 3 — Vollständiger Snapshot, Plan vor Umsetzung

Die Laufzeittrennung ist durch echte Electron-Schreibvorgänge und normalen gebauten
App-Smoke belegt. Nächster Teil: ein vollständiger Profil-Snapshot als Utility-
Baustein, der den bestehenden SQLite-Online-Snapshot für campaign-data nutzt und
alle übrigen regulären Dateien sowie leere Verzeichnisse erhält. Gesamtes Quell-
Inventar einschließlich Verzeichnissen vor/nach Kopie vergleichen; Symlinks und
Spezialdateien bleiben ohne sichere Quellzulassung abgewiesen. Kein Ausschließen
unbekannter Dateien anhand vermuteter Cache-Namen. Bestehende Preferences und
eigene Dateien außerhalb campaign-data müssen im Test bytegleich erhalten bleiben.

Dieser Baustein wird im folgenden versionierten Backup-/Aktivierungsschritt
angebunden. Er allein ändert noch keine produktive Payloadgrenze. Die vorhandenen
Format-1-Sicherungen und Format-2-Journale müssen weiterhin lesbar bleiben; ältere
Programme dürfen bei Rückkehr nach einem fehlgeschlagenen neuen Update nicht an
unbekannten Journalfeldern scheitern. Dafür ist vor Anbindung ein expliziter
Kompatibilitätsübergang erforderlich, keine globale Umdeutung alter stage-Ordner.

### Phase 3 — Laufzeittrennung: Nachweise und Teilplanaudit

29 Sperr-/Starttests, TypeScript, scoped ESLint und 73 Architekturtests bestanden.
Eigenständige reale Electron-43.2-Probe mit dem aktuellen gebündelten Profilmodul:
Local Storage und Cookies geschrieben, Browserfenster geschlossen und Prozess
beendet. Dateimenge und Inhalte von own-file.txt und vorhandener Preferences im
logischen Profil nach Prozessende unverändert; Browserdateien ausschließlich im
separaten Laufzeitverzeichnis. Probe: roadmap-phase3-real-browser-boundary.log.
Zusätzlich vollständiger Development-Build und test:smoke:built erfolgreich;
Core erreicht ready und beendet sich geordnet. Buildfingerspur
f09668d577ae613c657571fc2149586ba3b54b0af347ec155f09824f09453257.
Das ist lokale technische Prüfung, kein CI-Artefakt-Handoff oder Release.

Audit gegen Schreibgrenzen-Teilplan: erfüllt im jetzigen Startpfad. Core und
Local-Recovery/Abnahme/Relaunch nutzen den erfassten logischen Pfad, nicht das neue
Electron-userData. Der Headless-Wartungsmodus konfiguriert eigenen temporären
Browserpfad. Keine bestehenden Dateien wurden zur Einführung verschoben/gelöscht.

Der nachfolgende vollständige Snapshot enthält beide bekannten Datenwurzeln
campaign-data und development-data separat und verwendet für beide den vorhandenen
SQLite-Online-Snapshot. Sie werden nicht zusammengeführt. Eigene Dateien daneben,
vorhandene Preferences und leere Verzeichnisse bleiben erhalten. Unterhalb der
Quelle liegende Ziele werden vor jedem Schreibzugriff abgewiesen. Anbindung an
Backupformat und Aktivierung bleibt offen; die zuvor genannte Buildfingerspur
wird diesem erst danach ergänzten Snapshotbaustein nicht zugeschrieben.

Vollständiger Snapshot: 18 Integrationstests bestanden, einschließlich beider
getrennt fortlesbarer Kampagnenwurzeln; TypeScript bestanden. Scoped ESLint für den
Snapshotbaustein und seine Testdatei zuvor bestanden. Phase 3 bleibt in Arbeit.
Nächster verbindlicher Schritt: Format-2-Backup mit vollständigem Profilpayload und
passender Koordinator-Journalversion integrieren. Alte Format-1-Backups müssen
bewusst auf den Zielumfang abgebildet werden; ältere Programme müssen nach
Rollback weiterhin ihren alten Profilstand starten können. Dieser Übergang muss
vor der produktiven Nutzung des vollständigen Snapshots getestet sein.

### Phase 3 — Vollständiger Payload: Integrationsplan vor Umsetzung

Vorheriger Zielturn war Fortschritt. Jetzt Backupformat 2 mit vollständigem Profil,
Datei- und Verzeichnisinventar ergänzen; Format 1 bleibt als campaign-data-Sicherung
lesbar. Eine gemeinsame ProfileMaintenance-Implementierung unterstützt während des
Adapterübergangs beide Layouts. Release-Utility verwendet das volle Layout;
Local-Adapter wird anschließend ebenfalls umgestellt, bevor Phase 3 schließen darf.
Keine Zusammenführung von Quellen: eine alte Format-1-Sicherung wird als Profil
mit campaign-data abgebildet. Der aktuelle vollständige Stand wird vorher gesichert;
die Oberfläche muss den begrenzten Umfang alter Sicherungen kenntlich machen.

Arbeitskopie und vorheriger Stand enthalten bei Journalformat 3 den Profilbaum;
Format 2 behält exakt die alte Bedeutung campaign-data. Koordinator muss beides
anhand der Journalversion unterscheiden. Vorbereitung meldet die zugehörige
Journalversion, Main darf sie nicht erraten. Bei vollständigem Rollback zuerst einen
dauerhaften Format-3-Abschlussbeleg als Historie ablegen, dann ausschließlich den
terminalen Zustand in ein altes Format-2-kompatibles Startjournal überführen.
Dieses enthält keine offene Datenaktion und erlaubt älteren Programmen den Start;
vor diesem terminalen Übergang bleibt ausschließlich das Format-3-Journal maßgebend.
Die Historie entscheidet niemals über Recovery. Keine Umdeutung offener alter Journale.

Prüfungen: volle Dateien/Leerordner durch Update, Restore und Rollback; alle
Unterbrechungsgrenzen des gemeinsamen Koordinators mit vollem Payload; altes
Journal/alte Sicherung weiterhin lesbar; kein Rollback späterer Arbeit. Release-
Controllertest muss genau den neuen Ziel-Utility-Payload und dessen Journalversion
verwenden. Typen/Lint/Architektur und bestehende Legacyprüfungen absichern.

### Phase 3 — Vollständiger Payload: erste Validierung und Korrekturplan

86 Tests aus voller Profilwartung, bisheriger Release-Wartung, Release-Controller
und gemeinsamem Koordinator bestanden. TypeScript findet eine exactOptionalPropertyTypes-
Abweichung zwischen Zod-Ergebnis und handgeschriebenem Promise-Rückgabetyp für
journalVersion. Korrektur: den gemeinsamen aus Zod abgeleiteten Preparation-Typ
exportieren und am Controller verwenden. Keine alternative Laufzeitsemantik oder
Aufweichung des Journalvertrags.

### Phase 3 — Vollständiger Release-Payload: Teilplanaudit

86 kombinierte Tests bestanden; anschließend 21 vollständige Profil-/Rollbacktests
mit sämtlichen Vorwärts- und Rücksetzungsgrenzen bestanden. 108 Architektur-,
Legacy-Release- und Local-Starttests bestanden. TypeScript nach Korrektur bestanden,
scoped ESLint bestanden. Eingefrorener Format-2-Reader aus d6cb89a0c prüft ausdrücklich,
dass offene Format-3-Journale abgewiesen und terminale Rückwege gelesen werden.
Dies ist Vertrags-/Prozesslogiknachweis; die erneute Prüfung mit echten alten und
neuen AppImages bleibt Pflicht der Artefaktqualifikation.

Audit gegen Integrations-Teilplan: Release-Utility verwendet volle Profile. Format-2-
Backups enthalten Dateien und leere Verzeichnisse; Format-3-Koordinator tauscht das
Profil als Einheit. Restore sichert vorher alle aktuellen Daten und führt Quellen
nicht zusammen. Alte Sicherungen bleiben lesbar und werden als Kampagnendatenumfang
gekennzeichnet. Nach bestätigter Nutzung verbleibt das Format-3-Journal committed;
es findet kein späterer automatischer Rollback statt. Offene Format-2-Journale
behalten ihre bisherige Bedeutung. Historienbelege sind kein Recovery-Eingang.

Separates Audit gegen gesamte Phase 3: weiterhin offen. Local-Installer verwendet
noch den alten Payload. Seine Handoff-Hashes müssen ihre bisherige Kampagnendaten-
Bedeutung behalten, während zusätzliche vollständige Sicherungsbelege alle Dateien
absichern. Bei Wiederaufnahme alter Backup-Checkpoints darf kein eigener Profilinhalt
verloren gehen; erforderlichenfalls neue vollständige Sicherung erzeugen und alte
behalten. Außerdem bleiben direkte kooperierende Quellen und Recovery-Oberfläche
offen. Beim externen Import muss nach der Ordnerauswahl der erkannte Sicherungsumfang
verständlich bestätigt werden; die bisherige generische Vorabfrage reicht für alte
Kampagnendatensicherungen noch nicht als fertiger UX-Nachweis.

Remote-Beleg gelesen: Check 34228010436 für d6cb89a0c erfolgreich; a5daf8ea6 ebenfalls
erfolgreich. Diese Ergebnisse werden den jetzigen uncommitteten Änderungen nicht
zugeschrieben. Noch kein neuer kanonischer Handoff, Main-Promotion oder Release.

### Phase 3 — Local vollständiger Payload, Plan vor Umsetzung

Local-Backupworker auf denselben vollständigen ProfileMaintenance-Modus umstellen.
Handoff sourceDataHash/campaignDataHash behalten Kampagnendatenbedeutung; ihr
backupPayload-Leser liefert bei Format 2 deshalb data/campaign-data. Ein separater
vollständiger Payload-Leser dient der Aktivierung. Der Handoff-Backupbeleg bindet
zusätzlich das vollständige Quellinventar; Wiederaufnahme prüft dessen Unverändertheit.
Alte gültige Backup-Checkpoints werden vor Aktivierung durch eine neue vollständige
Sicherung ergänzt; der alte Backupordner bleibt erhalten. Neue Aktivierungen nutzen
Journalformat 3, migrieren beide vorhandenen Datenwurzeln und erhalten eigene Dateien.
Prüfen: normale 49 Local-Installertests, eigene Dateien außerhalb campaign-data,
Unterbrechung/Rollback und Wiederaufnahme eines alten Backup-Checkpoints. Keine
Umdeutung bestehender Handoff-Hashes und keine Entfernung alter Sicherungen.

### Phase 3 — Local: Korrekturrunde für aktivierte Checkpoints

Erster Lauf: 46/49 Local-Tests bestanden. Drei Abweichungen: Reparatur erzeugt neue
Sicherung, Wiederholung nach Migration erzeugt neue Sicherung, Wiederaufnahme bei
awaiting-start beginnt irrtümlich neue Wartung. Ursache: voller Rohinventarvergleich
verwendet nach Aktivierung noch die unveränderte Vor-Migrations-Sicherung.

Korrekturplan: eigenständiger aktivierter Profil-Checkpoint als Handoff-Provenienz,
gebunden an lokale Transaktionskennung, Artefakt und Backupbeleg. Er enthält einen
Profilhash aus bestehenden SQLite-Snapshot-Hashes beider Datenwurzeln, sonstigen
Dateien und Verzeichnissen. Vor Aktivierung bleibt der vollständige Quellvergleich
maßgeblich; nach Aktivierung der passende Zielcheckpoint. Bei awaiting-start darf
dieser unter Sperre rekonstruiert werden, bevor normale Nutzung freigegeben ist.
Fehlender Beleg nach committed erlaubt keine solche Rekonstruktion. Die Datei
entscheidet nie über Rollback; allein das gemeinsame Wartungsjournal tut dies.
Damit bleiben bestehende Hashfelder und alte Handoff-Journalformate unverändert.

### Phase 3 — Local: Auditkorrektur vollständige Dauerhaftigkeit

Typen, Lint und 97 Architektur-/Release-Tests bestanden. Codeaudit findet eine
Lücke im neuen Local-Stage: die beiden Datenwurzeln werden synchronisiert, eigene
Dateien daneben nach cpSync noch nicht. Korrekturplan: gemeinsame Funktion
migratePreparedCompleteProfile für beide Adapter. Sie migriert/prüft vorhandene
Datenwurzeln und synchronisiert danach den gesamten Profilbaum einschließlich
zusätzlicher Dateien und Verzeichnisse. Local und Release rufen exakt diese
Funktion auf. Vor Journalbeginn muss dieser Schritt erfolgreich zurückkehren.

### Phase 3 — Local vollständiger Payload: Teilplanaudit

51 Local-Installertests bestanden. Darunter vollständige Sicherung eigener Dateien,
getrennte Development-Daten, Erhalt späterer Änderungen, Wiederaufnahme eines alten
Kampagnendaten-Checkpoints mit zusätzlicher vollständiger Sicherung und Dateierhalt
über alle bisherigen Installationsunterbrechungen. Die ursprünglichen drei Fehler
sind behoben; idempotente Wiederholung und Metadatenreparatur behalten ihre Sicherung.

Die anschließend erkannte fsync-Lücke ist durch den gemeinsamen vollständigen
Vorbereitungsschritt geschlossen. Danach 24 Release-/Profiltests und fünf gezielte
Local-Regressionsfälle erneut bestanden. TypeScript und scoped ESLint bestanden.
Zuvor 97 kombinierte Architektur-/Release-Tests bestanden. Die Aktivierungslogik
bleibt ausschließlich beim gemeinsamen Koordinator, auch für Local nun Format 3.
Der zusätzliche aktivierte Checkpoint ist Handoff-Provenienz und wird niemals als
Anweisung zur Recovery oder zum Zurücksetzen von Benutzerdaten ausgewertet.

Audit gegen Local-Teilplan: erfüllt im implementierten und gezielt geprüften Umfang.
Beide Adapter verwenden vollständigen Backup-/Profilpayload und dieselbe dauerhafte
Migration/Prüfung. Historische Sicherungen bleiben erhalten; Hashfelder und alte
Handoff-Journalbedeutung bleiben unverändert. Echte Artefaktprobe des neuen gesamten
Standes und endgültiger kanonischer Handoff bleiben offen.

Separates Audit gegen Phase 3: sichere direkte Profilzulassung und Recovery-
Oberfläche fehlen weiterhin. Für Recovery muss außerdem die Wartungsübersicht ohne
Anlegen eines fehlenden Live-Profilordners auskommen; der bisherige Konstruktor von
ProfileMaintenance erstellt ihn noch, was bei einem offenen Profil-Rollback stören
könnte. Dies ist vor der Recovery-Oberfläche zu korrigieren und zu testen. Beim
externen Import bleibt die Bestätigung des erkannten Sicherungsumfangs nach Auswahl
notwendig. Phase 3 wird daher nicht geschlossen.

### Phase 3 — Recovery vorbereiten, Plan vor Umsetzung

Vorheriger Zielturn war Fortschritt, 912dcaea1 sauber auf Candidate. Jetzt zuerst
lesende Sicherungsübersicht ohne Live-Dateisystemänderung: ProfileMaintenance-
Konstruktor erzeugt keine Verzeichnisse; backups() liefert für fehlendes Backup-
Verzeichnis leer. Schreibende Vorbereitung/Backup legen nur ihre benötigten Ordner
an. Test: zwischen Wegbewegen des alten Profils und Aktivierung darf das Auflisten
keinen leeren Live-Ordner erzeugen und damit Recovery blockieren.

Bestandsaufnahme zeigt außerdem: closeGracefully löst nach kill() auf, bevor das
Exit-Ereignis bestätigt ist. Besonders beim fehlgeschlagenen/startenden Core kann
Wartung dadurch vor Prozessende beginnen. Vor Recovery-Aktionen eine explizite
bestätigte Shutdown-Barriere ergänzen und verzögerten Exit testen; bloße kill()-
Anforderung gilt nicht als geschlossene Datenverbindung. Kein Wartungsbeginn nach
Zeitüberschreitung dieser Barriere. Die Oberflächenanbindung folgt auf diese beiden
abgesicherten Voraussetzungen.

### Phase 3 — Shutdown: Korrektur der Statuswahrheit

44 Tests der lesenden Sicherungs-/Recoveryänderung bestanden. Die neue Shutdown-
Barriere hält bereits bis Exit, aber zwei neue Tests zeigen: publicCoreStatus meldet
terminating/closed schon als closed. Korrekturplan: nur interner Zustand closed
wird öffentlich closed; closing/terminating bleiben recovering. Der Wartende prüft
zusätzlich den internen Zustand, sodass die Prozessbarriere nicht allein von der
Anzeigeprojektion abhängt. Danach Shutdown- und Architekturtests erneut prüfen.

### Phase 3 — Recovery-Zugang bei Core-Fehler, UI-Teilplan

Die globale ReleaseSettings-Komponente liegt bereits außerhalb der datenabhängigen
Workspace-Route. Dort den validierten Core-Status abonnieren und bei inkompatiblen,
beschädigten oder nicht zugänglichen Daten einen sichtbaren Recovery-Zugang mit
Ursache und nächster Aktion anbieten. Sicherungsübersicht/Restore bleiben Main-
Capabilities und benötigen keine erfolgreiche Campaign-Verbindung. Tests rendern
nur diese Oberfläche mit fehlgeschlagenem Core und prüfen Öffnen der Sicherungen
sowie bewusst bestätigte Wiederherstellung; keine Domain-API wird bereitgestellt.
Ein Controllertest ersetzt zusätzlich eine tatsächlich beschädigte Live-SQLite-Datei
über die vorhandene Sicherung und erhält die beschädigten aktuellen Bytes davor.
Fehler beim Journal vor dem Core-Start sind ein weiterer noch offener Startpfad.

### Phase 3 — Recovery: Korrektur des frühen normalen Profilstarts

UI-/Controllerlauf mit beschädigter Datenbank: 11 Tests bestanden; Shutdownlauf nach
Statuskorrektur 28 Tests bestanden. Weiteres Startpfadaudit: openApplicationProfile
legt den logischen Profilordner ebenfalls vor Journal-Recovery an. Bei unterbrochenem
rollback-restoring kann das den Wiederherstellungsordner belegen. Korrekturplan:
logischen Pfad nur kanonisch bestimmen und extern sperren; ausschließlich den
separaten Browser-Laufzeitordner anlegen. Erst Recovery beziehungsweise normaler
Core-Bootstrap dürfen das logische Profil erzeugen. Den unterbrochenen Restore mit
dieser tatsächlichen Startzugriffsschicht testen, nicht nur direkt am Koordinator.

### Phase 3 — Recovery: kleine Testkorrektur vor Abschlussprüfung

TypeScript bestanden. ESLint findet zwei Test-Doubles mit async ohne await.
Korrekturplan: explizite Promise.resolve/Promise.reject-Rückgaben verwenden;
Produktionscode bleibt dabei unverändert. Nach dem Startpfadfix erneut gezielte
Tests, Typen/Lint und realen gebauten App-Smoke ausführen.

### Phase 3 — Shutdown: abschließende Exit-Guard-Korrektur

66 Start-/Recovery-/UI-/Supervisor-Tests bestanden, Build erfolgreich. Audit des
App-Exit-Handlers: ein zweites quit während des ersten Shutdowns darf die Barriere
nicht umgehen. Den Guard in eine kleine getestete Lebenszyklusfunktion ziehen:
jede noch unbestätigte Quit-Anfrage verhindern, höchstens einen Stop auslösen und
erst nach dessen Erfolg Quit erlauben. Nach Fehlstart und Shutdown-Timeout bis zum
tatsächlichen Core-Ende beobachten, danach sauber freigeben und beenden; keine
verwaiste Main-Instanz nach späterem Exit und kein früheres Freigeben der Sperre.

### Phase 3 — Exit-Guard: Build-Korrektur

32 gezielte Tests bestanden. Der anschließende vollständige Build und Typecheck
finden eine fehlende Funktionsklammer in waitForCoreTermination; der isolierte
Quit-Guard-Test importiert diese Electron-Anbindung nicht. Korrekturplan: Funktion
syntaktisch schließen, betroffene Datei formatieren und danach Typecheck, Lint,
Build sowie Smoke des neu gebauten Programms prüfen. Phase 3 bleibt offen.

### Phase 3 — Recovery/Exit: Validierung und getrenntes Teilaudit

Aktueller Arbeitsstand auf 912dcaea1 mit uncommitteten Phase-3-Änderungen:

- `vitest run tests/unit/quit-barrier.test.ts tests/unit/core-process-supervisor.test.ts tests/unit/profile-recovery-ui.test.tsx --maxWorkers=2`: 32 Tests bestanden (exit-guard-tests.log).
- `pnpm typecheck`, `pnpm lint`, `pnpm build`: nach Klammerkorrektur jeweils Exit 0 (roadmap-phase3-exit-fixed-*.log unter work).
- `pnpm test:smoke:built` unter Xvfb/X11: Exit 0; tatsächlicher Utility-Lauf starting → ready → exited → closed. Development-Build, App-Fingerprint fb9844ad3cc69f96de5992a63e87ce78b13eb885db843e7e1266b9b1815c6de0, Schema 39/34. Kein AppImage-Handoff-Nachweis.
- `pnpm test:architecture`: 91 Tests in 9 Dateien bestanden.
- `git diff --check`: bestanden.

Audit gegen die aktuellen Recovery-/Shutdown-Teilpläne: lesende Übersicht erzeugt
kein Ersatzprofil, normaler Profilstart verhindert den fehlenden-Profil-Recoveryfall
nicht mehr, Core-Fehler haben einen datenunabhängigen Zugang zur Wiederherstellung,
und Quit sowie Wartung warten auf das bestätigte Utility-Ende. Die Syntaxkorrektur
ist durch vollständigen Build und Typprüfung bestätigt. Die kontrollierten
Shutdown-/UI-Tests und der reale normale Appstart decken unterschiedliche Grenzen
ab; daraus folgt kein Nachweis sämtlicher verpackter Fehlerpfade.

Audit gegen die kanonische Roadmap: Phase 3 weiterhin unvollständig. Offen sind
insbesondere die sichere direkte Übernahme nachweislich kooperierender Profile,
die Bestätigung des tatsächlich ausgewählten externen Sicherungsumfangs, der
Recovery-Zugang bei Fehlern vor Core-/Fensterstart und die vollständige fachliche
Erhaltungsabnahme für aktive/inaktive/gelöschte Kampagnen und fortsetzbares Spiel.
Phasen 4–7 bleiben offen. Keine Übergabe, Main-Promotion, Live-Abnahme oder
Veröffentlichung mit diesen lokalen Prüfergebnissen behauptet.

### Phase 3 — Externe Sicherung: konkreter Bestätigungsplan

Vorheriger Zielturn: Fortschritt mit Build-/Shutdown-Korrektur und Nachweisen.
Der Import bestätigt bislang vor der Ordnerauswahl einen unbekannten Umfang.
Nach Auswahl liest Main nur den strikt validierten Manifestvertrag und zeigt einen
nativen Bestätigungsdialog mit Version, Datum und vollständigem beziehungsweise
historischem Kampagnenumfang. Abbrechen darf Core, Backup und Aktivierung nicht
berühren. Datenprüfung/SQL bleiben im Utility-Prozess. Der bestätigte Manifesthash
wird durch den Wartungsauftrag bis importBackup getragen und vor Vorbereitung mit
dem tatsächlich geprüften Manifest verglichen. So kann ein Austausch nach dem
Dialog keinen anderen Sicherungsumfang aktivieren. Bestehende interne Aufrufer
bleiben ohne optionalen Bestätigungshash kompatibel.

Abnahme: vollständige und historische Sicherung erzeugen die passende Erklärung;
Abbrechen startet keine Wartung; Manifestwechsel nach Bestätigung wird verworfen;
regulär bestätigter Import bleibt auf dem gemeinsamen Wartungspfad. Danach Typen,
gezielte Tests und Audit gegen Plan sowie Phase 3.

### Phase 3 — Externe Sicherung: Fehlertext-Korrektur

50 gezielte Tests bestanden. Teilaudit findet eine Bedienlücke: fehlende oder
ungültige externe Manifeste würden rohe Dateisystem-/Zod-Fehler anzeigen. Vor der
Abnahme diesen Lese-/Vertragsfehler mit einer konkreten Aufforderung zum Auswählen
eines SaltMarcher-Sicherungsordners versehen. Test: beliebiger Profilordner wird
vor Dialogbestätigung und Core-Stopp verständlich abgewiesen.

### Phase 3 — Externe Sicherung: typisierte Testassertionen

51 Tests bestanden, Typecheck vor der Fehlertextkorrektur bestanden. ESLint meldet
unsichere any-Zuweisungen durch asymmetrische expect.stringContaining-Matcher in
Objektliteralen. Korrekturplan: Text separat mit toContain prüfen und den nativen
Dialogaufruf über einen typisierten Parameter erfassen. Anschließend gezieltes
Lint, Typprüfung und dieselben relevanten Importtests abschließen.

### Phase 3 — Externe Sicherung: Teilaudit

Planabgleich: Main zeigt nach Auswahl einen abbrechbaren nativen Dialog mit
Manifestdatum, Version und Formatumfang; historische Kampagnensicherungen erklären
den Ersatz des gesamten Profils und den Erhalt zusätzlicher aktueller Dateien in
der vorgeschalteten Sicherung. Main liest ausschließlich Metadaten. Der bestätigte
Hash wird im Zielprozessvertrag und Utility-Vertrag validiert und vor prepare mit
dem Hash der geprüften Manifestbytes verglichen. Vollständige Daten-/Hashprüfung
und Migration verbleiben in Utility. Abbruch und ungültiger Ordner berühren Core
und Daten nicht. Der Controller-Test führt die reale ProfileMaintenance aus,
ersetzt jedoch den Prozessstart und den nativen Dialog durch kontrollierte Doubles.

Nachweise: 51 Tests der drei betroffenen Integrationsdateien bestanden; nach der
reinen Assertionkorrektur erneut alle 9 Controllerfälle bestanden. Vollständiger
Lintlauf hatte ausschließlich drei unsichere Testmatcher gemeldet; gezieltes Lint
für Controller und korrigierte Tests besteht. `git diff --check` besteht.

Roadmapabgleich: Die Lücke der Bestätigung nach externer Sicherungsauswahl ist auf
Code-/Integrationsebene geschlossen. Dies ersetzt weder die noch ausstehende
verpackte UI-Abnahme noch die direkte Übernahme kooperierender Profile. Phase 3
bleibt offen; vor-Core-Recovery und umfassende fachliche Erhaltungsabnahme sind
weiter erforderlich. Der vorherige Development-Smoke stammt vor diesen Änderungen
und wird ausdrücklich nicht als Nachweis dieses neuen Dialogs verwendet.

Abschließender `pnpm typecheck` nach Fehlertext- und Assertionkorrektur: Exit 0
(roadmap-phase3-confirmation-final-types.log). Keine laufenden Prüfprozesse aus
diesem Teilschritt verbleiben.

### Phase 3 — Frühe Journalfehler: Recovery-Ansicht vor Core-Start

Vorheriger Zielturn war Fortschritt: Umfangsbestätigung und gebundener Import.
Bestandsaufnahme: recoverRelease/recoverLocalMaintenance laufen vor Core und
Fenster; ein Fehler führt bisher unmittelbar zum Prozessende. Ein nativer
Recovery-Dialog soll Ursache, erneuten Recovery-Versuch, explizites Öffnen des
Sicherungsverzeichnisses und Beenden anbieten. Dabei bleibt die erworbene
Profilsperre bestehen. Ein unaufgelöstes Journal darf durch diesen Pfad weder
überschrieben noch durch einen neuen Restore-Auftrag verdrängt werden. Nach
erfolgreichem Retry geht ausschließlich das reguläre Recovery-Ergebnis weiter.

Umsetzung: kleine testbare Dialogsteuerung ohne Core-/SQL-Abhängigkeit; Anbindung
um die bestehende frühe Recovery-Auswahl für Local und Release; bei Beenden den
vorhandenen bestätigten Quit-Ablauf verwenden. Tests prüfen Retry, Abbruch,
Sicherungsordner und dessen Zugriffsfehler. Das ist die frühe Diagnose-/Retryansicht;
Startpunktfehler vor Ausführung von Electron bleiben separat zu qualifizieren.

### Phase 3 — Frühe Recovery: unbeaufsichtigte Prüfläufe

Dialog-/Quit-Tests bestanden. Integrationsaudit: --smoke-test darf bei Journalfehler
nicht auf Benutzereingabe warten. Ergänzung vor Buildprüfung: explizite interaktive
Option an der Dialogsteuerung; Smoke-Aufruf reicht false durch, der Originalfehler
geht unverändert an den vorhandenen fehlgeschlagenen Start/Shutdown. Test deckt
unbeaufsichtigtes Fehlschlagen ohne Dialog ab.

### Phase 3 — Frühe Recovery: Fehlerbehandlung vereinfachen

8 Tests, Typecheck und Build bestanden. Lint beanstandet die innerhalb eines
Catch-Kontexts erzeugte Ausnahme für einen openPath-Fehlertext. Korrekturplan:
Rückgabefehler direkt als fehlgeschlagenes Öffnen behandeln, echte Promise-Fehler
ebenfalls in diesen Anzeigezustand überführen; keine künstliche Ausnahme werfen.

Lint-Nachkorrektur: Der neue Fehlerindikator wird in beiden try/catch-Zweigen
zugewiesen; seine Initialisierung ist überflüssig. Nur die Initialisierung entfernen
und gezieltes Lint erneut ausführen. Der Verhaltenslauf mit 8 Tests besteht weiter.

### Phase 3 — Frühe Recovery: Teilaudit und Candidate-Zwischenstand

Planabgleich: Der frühe Local-/Release-Recovery-Aufruf läuft jetzt durch einen
nativen Dialog, bevor Core und Hauptfenster erzeugt werden. Retry ruft denselben
Recovery-Pfad erneut auf; Beenden nutzt den bestehenden Quit-Guard; Sicherungen
öffnen geschieht nur nach Klick. Die Funktion gibt keine Profilsperre frei und
startet keine neue Wartung. Smoke-Modus leitet den Originalfehler ohne Dialog an
den vorhandenen fehlgeschlagenen Start weiter.

Nachweise: 8 Dialog-/Quit-Tests bestanden; Typecheck und Build bestanden; nach
Lintkorrekturen gezieltes Lint bestanden. Erneuter aktueller Build plus
`pnpm test:smoke:built` unter Xvfb bestanden (Exit 0). Development-App-Fingerprint
c81977fb9768648294d003cb69149439614e351c6f44f37b0a958c53b1529cfb,
Schema 39/34. Der normale reale Start prüft die Integration; Fehlerdialoge sind
bislang über kontrollierte Electron-Doubles geprüft. `git diff --check` bestanden.

Roadmapabgleich: Der bisherige unmittelbare Abbruch bei frühem Journalfehler hat
jetzt eine Diagnose-/Retryansicht. Unaufgelöste Journale werden nicht für einen
Restore überschrieben. Eine vollständige verpackte Recovery-Abnahme einschließlich
Fehler im stabilen Startpunkt steht aus. Die direkte Übernahme kooperierender
Profile und die breite fachliche Erhaltungsabnahme bleiben offen; Phase 3 wird
nicht geschlossen. Zusammenhängende Änderungen seit 912dcaea1 werden als
Candidate-Zwischenstand gespeichert, ohne Main-Promotion oder App-Handoff.

### Phase 3 — Fachliche Erhaltung: vollständiger Kampagnenfall

Vorheriger Zielturn war Fortschritt; Candidate 5b2e5e661 ist gespeichert. Die
bisherigen Vollprofiltests verwenden überwiegend eine einfache Kampagne und
Dateiinventare. Ergänzung: reale Domain-APIs erzeugen aktive, inaktive und
wiederherstellbar gelöschte Kampagnen mit Party-Daten, Einstellungen und einen
laufenden Kampf mit verändertem HP-/Zustandswert. Gemeinsame Vorbereitung,
Aktivierung und Commit müssen diese Inhalte exakt erhalten. Anschließend wird
der Kampf weitergeführt und eine Einstellung geändert; Restore stellt den alten
Stand wieder her, während die vorgeschaltete Sicherung die spätere Arbeit enthält.
Backups werden für fachliche Inspektion kopiert, niemals direkt schreibend geöffnet.

Abnahme: semantische Snapshots vor/nach Update und Restore vergleichen; aktiven
Kampf nach Wartung tatsächlich weiterführen; inaktive Kampagne öffnen und gelöschte
Kampagne ausdrücklich wiederherstellen. Eigene Dateien bleiben Bestandteil des
bestehenden Vollprofilfixtures. Dieser Domain-Test ersetzt keine echten
AppImage-/Schemawechselprüfungen aus Phase 5.

### Phase 3 — Fachlicher Nachweis und E2E-Startkorrektur

25 Vollprofiltests einschließlich neuem Domain-Fall bestanden; gezieltes Lint und
Typecheck bestanden. Semantisch erhalten: Registry, Einstellungen, Party-Daten,
laufender Kampf; echtes advanceTurn nach Update; zurückgeholte Trash-Kampagne;
spätere Settings/Kampfrunde in kopierter vorgeschalteter Sicherung nachgewiesen.

CI 34231804547 (912dcaea1) scheiterte in sämtlichen betrachteten GUI-Shards bereits
beim WebDriver-Sessionaufbau (DevToolsActivePort fehlt). Aktueller Lauf34235204923
für5b2e5e661 war bei Abfrage in_progress. Wahrscheinliche Regression der gemeinsamen
Profiltrennung: ChromeDriver erwartet DevToolsActivePort im CLI-user-data-dir,
während Main userData auf den Browserlaufzeitordner umstellt. Korrekturplan:
Browserpfadberechnung wiederverwenden; E2E startet Chromium direkt mit diesem Pfad
und reicht das logische Profil getrennt über einen ausschließlich im bestehenden
E2E-Modus beachteten Parameter. Normale Installation behält ihren Startvertrag.
Ein realer WebDriver-Lauf muss den Sessionaufbau und eine Campaign-Suite bestehen;
ein Unit- oder normaler Smoke-Test reicht dafür nicht.

### Phase 3 — Fachliche Erhaltung und WebDriver: Teilaudit

Fachlicher Plan: erfüllt auf Integrationsebene. 25 Vollprofiltests bestanden,
inklusive Einstellungen, aktive/inaktive/gelöschte Kampagnen, Party-Inhalte,
konkrete Kampfzustände und fortsetzbarer Runde. Vorgeschaltete Sicherung erhält
die spätere Runde und Einstellung; Inspektion erfolgte auf einer Kopie.
Typecheck und gezieltes Lint bestanden.

E2E-Korrekturplan: gemeinsame Browserpfadberechnung in App und WDIO; logischer
Testprofilpfad wird getrennt und nur im bestehenden E2E-Modus übernommen. Build,
Typecheck und Lint bestanden. Realer Xvfb-WebDriver-Lauf
`pnpm test:e2e:built -- --suite campaignCreate`: Exit 0, eine Suite/ein Test
bestanden (1m21.2s). ChromeDriver fand DevToolsActivePort im vorgesehenen
Browserverzeichnis; Kampagne anlegen und wechseln bestand vollständig.
Nachweis: roadmap-phase3-webdriver-profile-e2e.log und
.tmp/e2e-runs/functional-1788876073294-242942/summary.json.

Roadmapaudit: stärkerer fachlicher Erhaltungsnachweis, aber kein Ersatz für
historische Schemawechsel mit echten AppImages. Die direkte Übernahme sicher
kooperierender Quellen bleibt das zentrale offene Phase-3-Arbeitspaket. Vollständige
CI auf dem neuen Commit, alle GUI-Shards, Hand-off und Phasen4–7 bleiben offen.
Keine Produktionsdaten verändert; Candidate-Zwischenstand wird gespeichert.

### Phase 3 — Direkte Übernahme: gehaltene Quellsperren

Vorheriger Zielturn war Fortschritt (fachliche Datenprüfung/E2E-Korrektur).
Bestandsaufnahme: Die vorhandene Startreservierung ist synchron; ein asynchroner
Export darf sie nicht mit einem Promise verwenden, weil finally sie sofort
freigäbe. Vor der Quellzulassung einen expliziten erwerbbaren Reservierungsgriff
bereitstellen und die bestehende synchrone API darauf aufbauen. Die neue
asynchrone Quellzugriffsschicht hält Startreservierung, kanonische Profilsperre
und Legacy-Laufzeitsperre bis zum Ende des Exports. Quelle/Ziel werden kanonisch
aufgelöst; gleiche oder ineinanderliegende Profile werden abgewiesen.

Diese Zugriffsschicht ist keine Zulassung unbekannter Altprofile. Der spätere
öffentliche Import benötigt zusätzlich eine qualifizierte kooperierende
Programminstallation; Metadatenmarker allein sind kein solcher Nachweis.
Abnahme dieses Teils: paralleler Appstart und zweite Startreservierung bleiben
während eines noch offenen Promise blockiert, Aliase/nested-Ziele werden vor dem
Export abgewiesen, Fehler geben alle eigenen Sperren wieder frei. Bestehende
Startreservierungs-Tests bleiben unverändert gültig.

### Phase 3 — Quellsperren: Teilaudit

23 Tests in source-profile-access/local-maintenance-start bestanden. Gezieltes
Lint und vollständiger Typecheck bestanden; git diff --check bestanden. Der
asynchrone Export hält kanonische und Legacy-Startreservierungen sowie die
Quellprofilsperren bis Promise-Abschluss. Erfolgs-/Fehlerpfad, belegte Quelle und
überlappende/aliasierte Zielprofile sind geprüft. Bestehende synchrone Aufrufer
verwenden weiterhin denselben Wrapper; keine Timer oder Promise-Sonderbehandlung.

Planabgleich dieses Zugriffsteils: erfüllt. Roadmapabgleich: direkte Übernahme
noch nicht fertig; die neue Zugriffsfunktion ist bewusst noch nicht öffentlich
angebunden. Qualifizierte Quellzulassung, Übergabe an Utility und vollständiger
Importablauf fehlen weiterhin. Dies ist kein Nachweis für beliebige Altanwendungen.
Phase 3 bleibt offen.

CI-Beobachtung:34235819998 für e336918546321984a5fd65edc992a2803eceee3a ist
in_progress; Vorgängerlauf34235204923 ist cancelled. Kein grüner Exact-SHA-
Nachweis behauptet. Lokale Typ-/Lint-/Testprozesse dieses Teils sind beendet.

### Phase 3 — Quellzulassung: Vertrag im geprüften Programm

Die Quellsperrschicht allein erlaubt keine unbekannte Quelle. Konkreter Plan:
Ein versionierter Profilzugriffsvertrag wird als Ressource im AppImage ausgeliefert
(kanonische Sperren, vollständiges Profil, Browserdaten außerhalb). Die Zulassung
liest diesen Vertrag aus genau der per Journalhash geprüften Programmdatei, prüft
den installierten Starter samt dessen Bytes und akzeptiert nur terminale,
bestätigte Wartungszustände. Kein neuer Marker im Quellprofil und kein Ausführen
der normalen Quell-App. Die vorhandene AppImage-Ressourcenlesung im Node-Modus
wird um genau diese interne Ressource erweitert. Quellen ohne Vertrag oder mit
unaufgelöster Wartung erhalten den Sicherungs-/Exportweg als nächste Aktion.

Die Zulassungsprüfung muss unter den bereits eingeführten Quellsperren erneut
stattfinden; vor einer späteren Kopie reicht eine Prüfung vor Sperrerwerb nicht.
Tests decken fehlenden Vertrag, ausgetauschte Programmbytes und offene Journale
ab. Verpackter Nachweis bleibt Teil der AppImage-Qualifikation.

### Phase 3 — Quellzulassung: Teilaudit und echter Ressourcennachweis

35 Tests in vier Dateien bestanden; Typecheck und gezieltes Lint bestanden;
git diff --check bestanden. Der Wrapper hält die Quellsperren während Zulassung,
Export und erneuter Programmprüfung. Journalzustand, installierte Programmbytes
und Starterprovenienz werden real geprüft; Integrationstests ersetzen nur die
AppImage-Protokollextraktion. Fehlender Vertrag, offene Wartung und manipulierte
Programmbytes verhindern den Exportaufruf.

Zusätzlicher realer Nachweis: `pnpm package:local` Exit0; Ressourcenextraktion mit
readAppImageProfileProtocol aus release/local/SaltMarcher-Local-0.2.0.AppImage Exit0.
SHA256 6c765ddab73c4e8d49e2c8d3ada11d848f5913d157dd269ce8eb2fefbfb65676.
Der validierte Vertrag meldet formatVersion1, canonical-profile-v1,
complete-profile, outside-profile. Log:roadmap-phase3-source-protocol-real-artifact.log.
Dies ist ein lokales technisches Testartefakt aus uncommittetem Stand, keine
kanonische Übergabe und kein freigabefähiger öffentlicher Release.

Planabgleich: Quellzulassung und Vertragsverpackung implementiert/geprüft.
Roadmapabgleich: direkte Übernahme noch nicht vollständig angebunden; Utility-
Export, Importaktion und End-to-End-Abnahme bleiben erforderlich. Ein beliebiges
Altprofil wird durch diesen Vertrag nicht nachträglich qualifiziert. Phase3 bleibt
offen. Paketbau hat native Abhängigkeiten bearbeitet; vor weiteren Node-SQLite-
Tests die zur jeweiligen Runtime gehörende native Umgebung prüfen.

### Phase 3 — Direkte Übernahme: Utility-Export und Bedienung

Vorheriger Zielturn war Fortschritt: Quellzulassung einschließlich echter gepackter
Ressource geprüft. Nun die direkte Übernahme durchgängig verbinden: Main wählt das
Profil, bestätigt den vollständigen Ersatz und hält qualifizierte Quellsperren.
Utility exportiert das vollständige Profil in einen frischen Zielcacheordner mit
SQLite-Onlinebackup und Format2-Manifest; Speicherplatz wird vorher geprüft. Nach
Export und erneuter Quellprüfung werden deren Sperren freigegeben. Erst dann nutzt
Main import-backup samt Manifesthash und vorgeschalteter Zielsicherung. Die Quelle
wird nicht migriert. Fehler/Abbruch vor Export berühren das Zielprofil nicht.

Die bestehende Capability erhält einen optionalen Auswahlmodus; ohne Modus bleibt
sie Backup-Import-kompatibel. Renderer übergibt nur Modus/ID, keine Pfade. Ein
separater Profilordner-Button und eine direkte Local-Profilaktion ergänzen den
bestehenden Sicherungsweg. Der komplette Save/Discard-Dialog bleibt Phase4.
Abnahme: tatsächlicher Utility-Export mit unveränderter Quelle und vollständigem
Manifest; Controller benutzt qualifizierten Export und bestehenden Aktivierungspfad;
Typ-/Capability-Verträge und Ablehnungs-/Abbruchfälle prüfen.

### Phase 3 — Direkte Übernahme: Integrations-Teilaudit

26 Tests in Controller/Quellzulassung/Sperren/Recovery-UI bestanden. Nach Ergänzung
der neuen UI-Aktion nochmals 7 Recovery-UI-Tests bestanden. Typecheck, vollständiges
Lint, 91 Architekturtests, Build und tatsächlicher Development-Smoke unter Xvfb
bestanden. App-Fingerprint c87d055e1a74500e776088ae6193600ada89bc570a337f3a04e4c79dbcbac5e9,
Schema39/34; kein Handoff-Artefakt.

Planabgleich: direkte Ordnerauswahl und Local-Profilaktion sind über den strikt
validierten optionalen Modus angebunden; Renderer sieht keine Pfade. Main hält
Quellzugriff/Zulassung während Utility-Export und prüft die Programmherkunft erneut.
Export verwendet vollständigen Snapshot, Onlinebackup, Platzprüfung und Format2-
Manifest. Der bestätigte Exporthash wird im vorhandenen import-backup-Pfad geprüft;
Zielbackup, Migration und Aktivierung bleiben beim gemeinsamen Wartungsablauf.
Temporärer Export wird nach Übernahme oder Fehler entfernt. Im Controllertest
bleiben die Quellbytes unverändert, eigene Datei und Kampagne werden übernommen,
die vorgeschaltete Sicherung enthält das alte Zielprofil. Dialog, Prozessstart und
Quellzulassung sind dort Doubles; deren eigenständige Tests und der frühere echte
AppImage-Ressourcennachweis decken andere Grenzen ab.

Roadmapabgleich: direkte Übernahme ist jetzt implementiert und auf Komponenten- /
Integrationsebene geprüft. Vor Schließen von Phase3 ist ein Gesamtaudit einschließlich
Fehlerpfaden, Parallelstarts und vorhandener Erhaltungsnachweise erforderlich.
Ein vollständiger echter AppImage-Import/Updateweg bleibt Teil der Artefaktabnahme;
kein einzelner Test wird als Beleg für diesen kompletten Ablauf ausgegeben.
Phasen4–7, Canonical-Handoff und Veröffentlichung bleiben offen.

### Phase 3 — Gesamtaudit: verbleibende Nachweisgrenzen

Vorheriger Zielturn war Fortschritt; direkte Übernahme auf c5beb080a gespeichert.
Abgleich mit dem ursprünglichen Phase3-Plan: kanonische Sperren, vollständiger
Payload, qualifizierte Quelle, bestätigter Import und vorgeschalteter Restorebackup
sind implementiert. Fachliche Erhaltung wird semantisch geprüft. Für die neue
asynchrone Exportlebensdauer fehlt noch ein echter konkurrierender Prozess; der
ältere Mehrprozesstest prüft nur eine normale gehaltene App-Sperre.
Korrekturplan: während des offenen Export-Promise echte Development-/Local-/Release-
Zugriffe und Starter über einen Symlinkalias aus einem zweiten Node-Prozess
versuchen. Nur ProfileLockedError zählt als erwartete Ablehnung; nach Freigabe
muss derselbe Zugriff erfolgreich sein. Keine künstliche erfolgreiche Ablehnung
bei anderem Start-/Importfehler.

Weiter offen im Phasengesamtaudit: echter gestarteter Fehler-/Wiederherstellungsweg
über die Oberfläche (M11). Bisherige UI-Doubles und der Controller mit echter
beschädigter SQLite-Datei belegen jeweils ihre Grenze, nicht deren vollständige
Verkettung. Phase3 bleibt bis zur passenden Abnahme offen. Die spätere
Schema-/AppImage-Matrix aus Phase5 bleibt ebenfalls unverändert erforderlich.

### Phase 3 — Export-Parallelstart: Auditnachweis

19 Tests in source-profile-access/local-profile-lock bestanden, gezieltes Lint
und git diff --check bestanden. Tatsächlich gestartete Node-Zweitprozesse rufen
die reale Profilzugriffsschicht für Development, Local, Release und Starter über
einen Symlinkalias auf. Während des Export-Promise ist ausschließlich die
konkrete ProfileLockedError-Ablehnung zulässig; nach Abschluss erwirbt ein neuer
Release-Zugriff die Sperre erfolgreich. Damit ist diese Lücke aus dem Teilplan
geprüft. Das ist ein Prozess-/Sperrnachweis, kein vierfacher GUI-AppImage-Livetest.

Abnahmematrix M07–M11 auf den aktuellen Evidenzstand gebracht. Phase3 bleibt wegen
des realen Oberflächen-Recoverywegs offen; der nächste konkrete Arbeitsschritt
ist eine isolierte verpackte App mit beschädigter Kampagneninstallation, gültiger
Vollsicherung und UI-ausgelöstem Restore samt beobachtetem Neustart/Commit. Keine
Benutzerdaten dafür direkt verwenden und keine Test-Doubles als End-to-End-Beleg.

Remote-Beobachtung: Check34235819998 für e336918546321984a5fd65edc992a2803eceee3a
ist success. Damit besteht der vollständige ältere Candidate-Check einschließlich
der korrigierten WebDriver-Pfade. Check34237359906 fürc5beb080a6352dca8209089fba694482185190a1
ist in_progress; noch kein grüner Nachweis für diesen neueren Stand.

### Phase 3 — M11: verpackte Oberflächen-Recovery

Vorheriger Zielturn war Fortschritt: echte Export-Parallelstarts und Matrixaudit.
Umsetzung des offenen Nachweises als reproduzierbares Qualifikationsskript:
ein Release-AppImage wird in einer isolierten XDG-Installation bereitgestellt,
eine vollständige Sicherung erstellt und anschließend die aktuelle SQLite-
Installation beschädigt. Über Chromium-Debugging werden ausschließlich sichtbare
Schaltflächen der wirklichen Oberfläche angeklickt. Nach Bestätigung muss der
normale Controller eine vorgeschaltete Sicherung und Journalaktivierung ausführen;
der neu gestartete Prozess muss den Wartungsabschluss bestätigen. Verglichen
werden wiederhergestellte Inhalte und die erhaltenen beschädigten aktuellen Bytes.
Kein direkter Capability-Aufruf als Ersatz für den UI-Schritt. Debugging dient nur
der Teststeuerung; keine Änderung des normalen Produktpfads. Das Skript beendet
nur Prozesse aus seiner isolierten Installation und behält einen Ergebnisbeleg.

## Phase 3 — Abschlussaudit, 2026-09-08

### Nachweise des abschließenden Stands

- Gemeinsamer Lauf von 13 Phase3-relevanten Testdateien: 192 Tests bestanden,
  Exit0,101.62s (roadmap-phase3-completion-tests.log). Enthalten sind Local-
  Installer, Release-Controller, volle Profile, Sperren/echte Zweitprozesse,
  Quellzulassung, Recovery-UI und bestätigtes Core-Ende.
- Typecheck und gezieltes Lint des neuen Qualifikationsskripts sowie der
  Prozessprüfung bestanden. Der vorherige vollständige Lint-/Architekturlauf
  auf dem Implementierungsstand bestand; seitdem nur Test-/Nachweisänderungen.
- `pnpm package:release` und anschließend reale Oberflächenqualifikation unter
  Xvfb mit scripts/qualify-profile-recovery.ts bestanden.
- Test-AppImage SHA256:
  87952bee17d0df4087d7ee85dbeae8cf43f2a983e6b600f0bccfc9a5ac0afef1.
  Codecommit c5beb080a6352dca8209089fba694482185190a1, lokaler dirty Release-Build,
  App-Fingerprint c87d055e1a74500e776088ae6193600ada89bc570a337f3a04e4c79dbcbac5e9.
  Kein veröffentlichter oder kanonisch übergebener Build.
- Reale UI-Steuerung: sichtbare Schaltflächen per CDP-Mausereignissen anklicken;
  kein direkter Restore-Capabilityaufruf. Initialer Core meldet corrupt-data.
  Nach Bestätigung entsteht Restore afcc5f10-c32e-48ff-a12e-afbc808be79d;
  neu gestartete App erreicht committed. Originaldatei wiederhergestellt,
  späterer Inhalt und beschädigte SQLite-Bytes im vorgeschalteten Backup erhalten,
  Programmdeployment und AppImagehash unverändert. Alle isolierten Testprozesse
  beendet. Beleg /tmp/salt-ui-recovery-EtBwN9/result.json und application.log,
  Runnerlog work/roadmap-phase3-ui-recovery-real.log.

### Audit gegen den gespeicherten Phase3-Plan

1. Gemeinsame kanonische Sperren: alle Linux-Kanäle verwenden dieselbe
   Zugriffsschicht; Legacy- und Startreservierungen bleiben wirksam. Alias- und
   echte konkurrierende Prozesszugriffe während asynchronem Export sind geprüft.
2. Vollständiger Payload: Browserlaufzeit liegt außerhalb. Vollprofilformat2
   sichert beide bekannten Datenwurzeln, Einstellungen, eigene Dateien und leere
   Ordner; historische Sicherungen bleiben ausdrücklich als Kampagnenformat lesbar.
3. Quellzulassung: Vertrag stammt aus hashgeprüftem Programm, Starter und terminales
   Journal werden geprüft, Sperren umschließen Export und erneute Prüfung. Unklare
   Altanwendungen erhalten keinen stillen Direktimport-Fallback.
4. Restore: gemeinsamer Vorwärtsmigrationspfad mit vorgeschaltetem Vollbackup,
   neuere Formate werden abgewiesen, spätere akzeptierte Arbeit nicht automatisch
   zurückgesetzt. Echte beschädigte aktuelle Bytes bleiben erhalten.
5. Recovery/Profilwahl: Core-unabhängiger UI-Zugang und frühe native Journal-
   Diagnose vorhanden. Reale Release-App mit defekter Installation kann per UI
   wiederherstellen und neu starten; Renderer bleibt bei IDs/validierten Daten.
6. Fachliche Erhaltung: konkrete Einstellungen, Party-/Kampfzustände, inaktive und
   wiederherstellbare Trash-Kampagnen sowie spätere Arbeit semantisch geprüft.

Ergebnis gegen Phase3-Plan: bestanden, keine offene Anforderung dieses Plans.

### Separater Audit gegen die kanonische Roadmap

Die sechs Punkte und das Abschlusskriterium von Phase3 sind durch die oben
zugeordneten Implementierungen und Prüfungen erfüllt. Phase3 ist abgeschlossen.
Das bedeutet implementiert und automatisiert geprüft; es bedeutet weder lokale
kanonische Übergabe noch menschliche Live-Abnahme oder Veröffentlichung.

Die vollständige Speichern-/Verwerfen-/Abbrechen-Koordination gehört weiterhin zu
Phase4. Echte verschiedene Schema-AppImages, übersprungene Releases und die
vollständige Transport-/Fehlermatrix bleiben Phase5; CI-/Releasefreigabe Phase6;
Kopie vorhandener Benutzerdaten und manuelle Veröffentlichung Phase7. Der einzelne
M11-AppImagefall wird ausdrücklich nicht als Nachweis dieser späteren Phasen
verwendet. Das übergeordnete Ziel bleibt aktiv.

## Phase 4 — Plan vor Umsetzung, 2026-09-08

Phase3 ist abgeschlossen; vorheriger Zielturn war Fortschritt. Ausgangspunkt:
maintenance-drafts.ts enthält nur ein Set schmutziger React-IDs. Neun bestehende
Editorfamilien melden dort Änderungen, ohne Save-/Discard-Vertrag. Teilweise liegt
die Meldung in einem niedrigen Draft-Hook, während Speichern im übergeordneten
Controller lebt; die Registrierung muss deshalb zum tatsächlichen Verantwortlichen
wandern. Es genügt nicht, das vorhandene Set mit einem neuen Dialog zu umgeben.

1. Eine kleine gemeinsame Registrierung mit lesbarem Bereichsnamen, dirty-Abfrage,
   bestätigtem asynchronem Speichern und Verwerfen einführen. Ein Koordinator hält
   eine globale Bearbeitungssperre über Klärung/Wartungsbeginn. Teilerfolge bleiben
   erhalten, fehlgeschlagene Bereiche werden zugeordnet, parallele Klärungen
   verhindert. Neue Registrierungen sehen sofort die bestehende Sperre.
2. Jeden vorhandenen Guard mit den echten Owner-Operationen verbinden; zusätzlich
   nach nicht registrierten Drafts suchen. Mutationseingänge und UI müssen während
   der Sperre neue Benutzeränderungen verhindern; laufende Speichervorgänge werden
   berücksichtigt. Kein generischer DOM-Submit als Save-Ersatz.
3. Updates/Restore/Import/Neustart in ReleaseSettings verwenden dieselbe Klärung
   mit Speichern und fortfahren, Verwerfen und fortfahren, Abbrechen. Download und
   Prüfung bleiben getrennte nicht destruktive Aktionen. Fehler nennen Bereich
   und nächste Aktion; kein Wartungsbeginn bei fehlgeschlagenem Speichern.
4. Tests für mehrere Editoren, teilweise erfolgreiche Saves, fehlgeschlagene Saves,
   Verwerfen, Abbrechen und Mutationssperre. Offline-/Download-/Installationsfluss
   prüfen. Abschließend getrennte Plan-/Roadmapaudits und passende App-Prüfung.

Erster konkreter Teil: testbarer Koordinator, der noch fehlende Save-/Discard-
Handler ausdrücklich abweist. Die vorhandene Guard-API wird auf dessen Registry
umgestellt, bleibt bis zur Owner-Anbindung aber weiterhin nur ein Schutz gegen
Wartung mit offenen Änderungen. Diese Zwischenkompatibilität zählt nicht als
fertige Phase4-Bedienung.

### Phase 4 — Koordinator: Korrekturrunde vor Owner-Anbindung

12 erste Koordinator-/Recovery-UI-Tests bestanden. Audit findet eine Lücke: Die
Momentaufnahme der Registry übersieht während eines Save neu registrierte Drafts;
ein fälschlich bestätigter Save könnte außerdem weiterhin dirty bleiben.
Korrekturplan: nach der Runde alle aktuell registrierten Dirty-Zustände erneut
prüfen, verbleibende/neu entstandene Änderungen als Bereichsfehler melden und
Dirty-Abfragefehler ebenfalls zuordnen. Die Owner-Bestätigung allein ersetzt nicht
die Klärung ihres Dirty-Zustands. Tests für beide Fälle ergänzen; echte Adapter
müssen ihren geklärten Zustand vor Abschluss der Operation sichtbar machen.

### Phase 4 — Callback-Bindung

14 Tests und Typecheck bestanden. Lint fordert eine explizite Bindung der optionalen
Owner-Methoden bei deren Auswahl; .call erst am späteren Aufruf reicht der Regel
nicht. Save/Discard bei Auswahl mit bind(draft) binden und anschließend normal
aufrufen. Verhalten bleibt dasselbe; gezieltes Lint und Koordinatortests wiederholen.

### Phase 4 — Koordinator: Teilaudit

14 Koordinator-/Recovery-UI-Tests bestanden; Typecheck bestanden; gezieltes Lint
nach expliziter Callback-Bindung bestanden. Teilerfolge bleiben bestehen, Fehler
tragen Bereich/ID, Abbruch führt keine Owner-Operation aus, konkurrierende Klärung
und Freigabe während eines Save werden abgewiesen. Die Abschlussprüfung erfasst
weiterhin offene sowie während des Save hinzugekommene Drafts. Der bestehende
Guard verwendet nun dieselbe Registry; die bisherige Ablehnung unsaved Wartung
bleibt erhalten.

Planabgleich des ersten Teils: Koordinationsgrundlage implementiert/geprüft.
Roadmapabgleich: Phase4 bleibt in Arbeit. Reale Owner-Save-/Discard-Adapter,
Mutationssperren an sämtlichen Eingängen, die drei zentralen UI-Aktionen und der
vollständige Update-/Fehlerablauf sind noch anzubinden und zu prüfen. Der globale
Sperrzustand allein beweist noch keine verhinderte Editoränderung. Kein neuer
App-Handoff oder Phasenabschluss behauptet.

### Phase 4 — Erster Owner: NSC-Editor

Der NSC-Editor besitzt einen überschaubaren eigenständigen Save-Pfad und ist der
erste konkrete Adapter. Sein bisheriges Promise<void> unterscheidet einen vom
Async-Koordinator verworfenen Auftrag nicht von erfolgreichem Speichern. Vor
Anbindung den Owner auf ein ausdrückliches boolean-Ergebnis umstellen: stale=false,
erfolgreich persistiert/übernommen=true, Fehler weiterhin rejected. Bestehende
normalen Submit-Aufrufe verwenden denselben Save-Pfad.

Ein stabiler React-Registry-Hook delegiert an aktuelle Owner-Funktionen. Der NSC-
Adapter hält synchronen Draft-/Pending-Zustand, wartet vorhandenes Speichern ab,
setzt geklärt erst bei bestätigtem Erfolg und verwirft nur nach expliziter Wahl.
Alle NSC-Feldmutationen/normalen Submits/Schließen prüfen die globale Sperre direkt;
die Oberfläche zeigt denselben busy-Zustand. Tests: echter Editor registriert sich,
Save über Koordinator, fehlgeschlagener/unbestätigter Save, Verwerfen und während
der Sperre versuchte Eingaben. Weitere Editorfamilien bleiben danach offen.

### Phase 4 — NSC-Owner: Teilaudit

20 Tests in npc-maintenance-draft/npc-catalog/maintenance-draft-coordinator
bestanden. Vollständiger Typecheck und gezieltes Lint bestanden; git diff --check
bestand. Der echte NSC-Editor registriert seine eigenen Save-/Discard-Funktionen.
Save benutzt denselben Mutationspfad wie normales Submit, stale=false zählt nicht
als Erfolg. Pending-Save wird wiederverwendet, Fehler erhalten Dirty-Zustand.
Discard setzt den lokalen Draft zurück und schließt nur nach expliziter Auswahl.

Mutationsschutz ist zweifach: disabled fieldset/busy-Dialog und direkte Prüfung
vor Feldänderung, normalem Submit oder Schließen. Der Test versucht ein Change-
Ereignis trotz Sperre und bestätigt, dass der unveränderte Draft gespeichert wird.
Die synchrone Owner-Zustandsführung macht erfolgreiche Klärung sichtbar, ohne auf
einen zufälligen React-Effect-Zeitpunkt angewiesen zu sein.

Planabgleich dieses Owners: erfüllt. Roadmapabgleich: nur erste Editorfamilie
angebunden. Die übrigen Guards sind noch Übergangssperren ohne Save-/Discard-
Adapter; zentrale Dialogintegration, weitere Mutationseingänge und Phase4-
Gesamtabnahme fehlen. Kein Phasenabschluss und keine App-Übergabe behauptet.

### Phase 4 — Zentrale Dialoganbindung

Vorheriger Zielturn war Fortschritt (NSC-Owner). Nun ersetzt ReleaseSettings den
pauschalen Dirty-Abbruch durch eine gehaltene Koordinator-Sitzung. Sie beginnt
beim Öffnen einer Wartungsbestätigung. Bei Dirty-Zustand erscheinen Speichern und
fortfahren, Verwerfen und fortfahren sowie Abbrechen. Nicht bestätigte oder
verbleibende Änderungen zeigen Bereichsfehler und verhindern die Main-Aktion.
Ein nachträglich auftauchender Dirty-Zustand fordert die Auswahl erneut an.
Prüfen/Download starten keine Klärung. Abbruch/fehlgeschlagene oder abgebrochene
Wartungsaktion geben die Sperre frei; aktivierte Wartung hält sie bis Neustart.
Tests verwenden mehrere echte Registry-Teilnehmer neben der realen Dialogkomponente.
Noch nicht angebundene Owner bleiben ausdrücklich blockierende Übergangseinträge.

### Phase 4 — Dialog: eindeutige Fehlerzeilen

23 Dialog-/Owner-/Koordinatortests bestanden. Teilaudit: mehrere noch unbenannte
Übergangseditoren können denselben Fehlertext haben; Text als React-Key wäre dann
nicht eindeutig. Fehlerzeilen behalten deshalb die Registry-ID. Zusätzlich nennt
die Fehleransicht ausdrücklich Wiederholen oder Abbrechen zum Bearbeiten als
nächste Aktion. Danach Typen/Lint und Dialogtests prüfen.

### Phase 4 — Dialog: Teilaudit und nächster Owner

Der vorherige Installationsturn verifizierte nur den Skill, ohne Roadmap-Codefortschritt.
Aktueller Stand geprüft: 23 Dialog-/Owner-/Koordinatortests, Typecheck und gezieltes
Lint bestanden. Build und Built-Smoke abgeschlossen; dessen Log zeigt bereiten Core
und bestätigten Prozessabschluss. Planabgleich: zentrale Auswahl und Fehlerzuordnung
umgesetzt. Roadmapabgleich: weitere Owner und Gesamtbedienungsabnahme bleiben offen.

Nächster Teilplan: HexMapDialog registriert seine tatsächlichen Owner-Operationen.
Normales Submit und Wartungs-Save teilen ein Pending-Promise; bei schon persistierter
Karte wird ausschließlich UI-Reconciliation wiederholt. Draft-Status wird synchron
geführt, Eingaben und normale Aktionen prüfen die globale Sperre direkt. Explizites
Verwerfen wartet laufendes Speichern ab, entfernt aber keine bereits angelegte Karte.
Tests prüfen Mutationserfolg, Mutation-/Reconciliationfehler, Wiederholung ohne
Duplikat, Pending-Save, Verwerfen und gesperrte Eingaben. Verschachtelte Owner bleiben
als gesonderter Integrationsfall für den späteren Gesamtabschluss offen.

### Phase 4 — Hexkarten-Owner: Teilaudit

20 Hexkarten-/Koordinatortests bestanden; vollständiger Typecheck und gezieltes
Lint bestanden. Gemeinsame Regression aus Hexkarten, NSC, Wartungsdialog und
Koordinator: 44 Tests in sieben Dateien bestanden. Build und Built-Smoke bestanden.
Der Owner blockiert Feldänderungen/normalen Submit/Schließen synchron und sichtbar,
wartet bestehende Mutation ab und bestätigt erst nach erfolgreicher Reconciliation.
Der Wiederholungstest belegt genau einen Create-Aufruf bei zweimaliger Reconciliation.
Verwerfen wartet Pending-Arbeit ab und löscht keine bereits persistierte Karte.

Planabgleich Hexkarten: erfüllt. Roadmapabgleich: Phase4 weiter in Arbeit;
übrige Owner, verschachtelte Klärung, sämtliche Mutationseingänge und vollständiger
Offline-/Update-UI-Nachweis fehlen. Dieser lokale technische Build ist kein
kanonischer Handoff; die abschließenden Candidate-/Main-Gates bleiben erforderlich.

### Phase 4 — Befund zur nächsten Owner-Anbindung

WorldFactionEditor fordert über related-entity-dialog-stack einen eigenständigen
Begegnungstabellen-Editor an. Dessen Save-Callback verändert danach den Fraktions-
Draft. WorldLocationDialog kann wiederum Fraktion/Tabelle anlegen; Hexkartenanlage
ist ebenfalls Teil des Ortsdialogs. Eine reine Registry-Einfügereihenfolge ist
kein belastbarer Abhängigkeitsvertrag. Vor Abschluss dieser Familien eine explizite
Kind-vor-Eltern-Klärung im Dialog-/Owner-Vertrag ergänzen; die resultierenden
Owner-Callbacks müssen während der Sperre erlaubt bleiben, neue Nutzereingaben
hingegen gesperrt sein. Fehler im Kind verhindern vorzeitiges Speichern des Eltern-
Drafts. Tests benötigen reale verschachtelte Editoren, fehlgeschlagene Kind-Saves,
Wiederholung sowie Verwerfen ohne Verlust bereits persistierter Teilergebnisse.
Die bestehenden Übergangs-Guards bleiben bis dahin blockierend; kein vollständiger
Wartungsablauf mit allen Editoren wird behauptet.

### Phase 4 — Explizite Klärungsabhängigkeiten: Teilplan

Vorheriger Zielturn: Fortschritt, geprüfter Owner-/Dialogstand als 1e0400af5
committed/gepusht. Aktueller Worktree sauber; Check 34241844508 läuft für diesen SHA.
Die kanonische Phase4 bleibt unverändert in Arbeit.

Zuerst die kleine Registry-Schnittstelle um ausdrücklich benannte abhängige
Editor-IDs erweitern. Der Koordinator klärt sie vor ihrem Eltern-Owner, unabhängig
von Mount-/Registrierungsreihenfolge. Ein fehlerhaftes oder weiterhin schmutziges
Kind sperrt seine Eltern; unabhängige Editoren dürfen weiterhin erfolgreich sein.
Fehlende IDs, Zyklen und nachträglich hinzugekommene Abhängigkeiten brechen betroffene
Owner vor ihrem Save ab. Bestätigte Kind-Ergebnisse werden bei Wiederholung nicht
nochmals gespeichert. Save und Discard verwenden dieselbe Abhängigkeitsordnung.
Der React-Hook erhält optional eine vom Dialogbesitzer vorab bestimmte stabile ID.
Validierung: Reihenfolge, sauberer Eltern-Draft mit Dirty-Kind, Fehler/Retry,
weiterhin Dirty trotz Bestätigung, Zyklen, fehlende ID, spätere Abhängigkeit,
Discard-Reihenfolge und bestehende Dialog-/Ownerregression.
Danach die echten Dialogbesitzer mit diesen IDs verbinden; der Vertrag allein ist
noch kein Nachweis für funktionsfähige verschachtelte Produktdialoge.

### Phase 4 — Fraktion und reale Dialog-IDs: Umsetzungsplan

37 Koordinator-/Dialog-/Ownerregressionstests bestanden. Jetzt liefert der bestehende
Related-Dialog-Stack für jeden geöffneten Dialog einen stabilen Wartungshandle
(ID und synchroner Offen-Status), auch solange der Lazy-Editor noch lädt. Die ID
wird durch die Integrationskomponenten bis zur Registry weitergereicht. Fraktions-
Owner behalten den Tabellenhandle als Abhängigkeit, übernehmen bestätigte Tabellen-
Callbacks synchron in ihren Draft und sperren davon getrennt neue Benutzereingaben.
Save/Reconciliation/Pending-Semantik entspricht dem geprüften Hexkarten-Owner.
Der Tabelleneditor erhält zunächst seine explizite ID am Übergangs-Guard; solange
seine eigene Save-Anbindung fehlt, verhindert er ausdrücklich den Eltern-Save.

### Phase 4 — ID-Vertrag: Korrekturrunde

Erster Typecheck findet einen optionalen Getter mit explizitem undefined sowie
zwei ältere Test-Dialogbesitzer ohne Rückgabehandle. Getter liefert eine leere
Abhängigkeitsliste; Testbesitzer erhalten echte synchrone Offen-Handles entsprechend
dem neuen Vertrag. Optionale Wartungs-IDs werden nur bei Vorhandensein weitergereicht.
Zusätzlich normale Tabellenauswahl nach Persistenz direkt sperren, damit UI-Retry
keine nachträglichen Entwurfsänderungen zulässt. Danach Typen und bestehende
Fraktions-/Ortsdialogtests erneut prüfen.

### Phase 4 — Bestätigung ohne Dirty-Drafts: Korrekturplan

33 bestehende Fraktions-/Orts-/Koordinatortests sowie 21 Owner-/Koordinatortests
bestanden. Teilaudit findet: Die zentrale Bestätigung überspringt den Koordinator,
wenn beim Öffnen keine Änderungen erkannt wurden. Damit könnten noch ladende
Abhängigkeiten ungeprüft bleiben. Eine reine check-Klärung führt keine Owner-
Mutation aus, prüft aber den vollständigen Abhängigkeitsgraphen und spätere Dirty-
Zustände. Jede zentrale Bestätigung verwendet entweder die ausdrücklich gewählte
Save-/Discard-Operation oder check. Fehler verhindern Main und fordern bei Dirty-
Zustand erneut die ausdrückliche Auswahl. Tests belegen keine impliziten Saves und
Blockierung fehlender Abhängigkeiten auch bei sauberem Eltern-Draft.

### Phase 4 — Testadapter-Lint: Korrekturrunde

64 Tests bestanden, vollständiger Typecheck bestanden. Lint beanstandet zwei
Teststellen: einen unsicher typisierten Matcher als Objektwert und einen
Render-Factory-Callback, dessen Testhandle ein React-Ref erfasst. Matcher in direkte
Assertion zerlegen; stabilen Testhandle-Zustand als eigenes Objekt initialisieren,
das ausschließlich Ereignisse ändern. Produktcode benötigt dafür keine Ausnahme.
Danach Lint, betroffene Tests und den gebauten Startpfad prüfen.

### Phase 4 — Testhandle: zweite Korrekturrunde

Lint lehnt auch direkte Mutation des durch useState gehaltenen Testobjekts ab.
Stattdessen erzeugt der Test-Dialogbesitzer pro Öffnungsereignis einen Handle mit
gekapseltem Offen-Zustand und Close-/isOpen-Funktionen; React hält nur diesen
unveränderlichen Handle. Keine Lint-Ausnahme. Der Build-/Smoke-Lauf der vorherigen
Runde war erfolgreich, die wegen Lint nicht gestartete Testwiederholung wird jetzt
nachgeholt.

### Phase 4 — Abhängigkeiten und Fraktions-Owner: Teilaudit

Implementierungsplanabgleich: explizite dependsOn-IDs werden vor dem Eltern-Owner
geklärt. Fehlerhafte/weiterhin Dirty-Kinder verhindern dessen Mutation; unabhängige
Teilerfolge bleiben erhalten. Tests belegen Reihenfolge für Save/Discard, Retry ohne
erneuten erfolgreichen Kind-Save, Zyklen/fehlende IDs und später hinzugekommene
Abhängigkeiten. Die reine check-Klärung schreibt nichts; die reale Wartungsbestätigung
weist damit fehlende Kind-Editoren auch ohne Dirty-Felder vor Main ab.

Related-Dialog-Stack liefert stabile IDs und synchronen Offen-Status bis zu den
realen Integrations-/Editor-Komponenten. Fraktions-Owner verwendet diese Abhängigkeit,
führt erfolgreiche Kind-Callbacks synchron in seinen Draft ein und trennt das von
gesperrten Benutzermutationen. Normaler Save, Wartungs-Save und vorhandenes Pending
teilen einen Pfad; Reconciliation-Retry legt keine zweite Fraktion an. Sechs neue
Owner-Tests prüfen diese Fälle einschließlich noch ladendem Kind. Der Child-Registry-
Teil im Owner-Test ist kontrolliert; dies ersetzt ausdrücklich keinen Test des
vollständigen realen Tabellen-/Fraktions-/Ortsdialogstapels.

Validierung: 64 Tests in acht Dateien bestanden. Nach Testadapter-Korrekturen die
betroffenen 28 Tests erneut bestanden; gezieltes Lint nun ohne Fehler. Vollständiger
Typecheck des abschließenden Stands bestanden. 91 Architekturprüfungen bestanden.
Build/Built-Smoke bestanden (Core ready und bestätigt closed); git diff --check
bestand. Technischer Development-Build, kein kanonischer App-Handoff.

Roadmapabgleich: Phase4 bleibt in Arbeit. Begegnungstabelle trägt bereits ihre
explizite ID, verwendet aber noch den blockierenden Guard. Nächster Schritt ist
ihr vollständiger Owner-Adapter einschließlich Scope, Gewichte und vorhandener
Reconciliation-Semantik, gefolgt vom realen verschachtelten UI-Test und Orts-Owner.
Weitere Editorfamilien, vollständige Eingabesperre sowie Offline-/Update-Gesamtabnahme
bleiben offen. Phasen5–7 und abschließende Candidate-/Handoff-/Main-/Release-Gates
bleiben vollständig erforderlich.

### Phase 4 — Begegnungstabellen-Owner: Teilplan

Vorheriger Zielturn: Fortschritt, e09551b29 mit Abhängigkeiten/Fraktions-Owner
committed/gepusht. Worktree nun sauber; kanonische Phase4 weiterhin offen.
Begegnungstabelle ersetzt ihren Übergangs-Guard durch vollständige Save-/Discard-
Operationen. Draft und Anlage-Scope werden synchron geführt. Pending-Normalsave wird
abgewartet; Reconciliation-Retry verwendet die persistierte Receipt. Validierung
bleibt beim bestehenden Parser. Name, Beschreibung, Scope, Hinzufügen/Entfernen
und Gewichte prüfen die globale Sperre direkt und zeigen deaktivierte Bedienelemente.
Normales Schließen/Submit/Retry und lokaler Verwerfen-Dialog erhalten dieselben Guards.
Tests: vollständiger Draft samt Scope/Gewichten, fehlende Pflichtdaten, Savefehler,
Pending, Discard, Retry ohne Duplikat; anschließend reale Tabellen-/Fraktionsdialoge
über den vorhandenen Related-Dialog-Stack gemeinsam klären und Datenreihenfolge prüfen.

### Phase 4 — Tabellen-Testkorrekturen

Erste Prüfung: acht der neun neuen Owner-/Stack-Tests bestanden, darunter alle vier
realen verschachtelten Dialogfälle. Ein neuer Test verwendet geratenen statt realen
UI-Namen; auf die vorhandenen deutschen Labels umstellen. Bestehender Doppelclick-
Test erwartet den Save synchron im Click-Stack; der gemeinsame Pending-Pfad beginnt
nun im Microtask. Weiterhin zwei Klicks auslösen und genau einen Save prüfen, dessen
Start aber mit waitFor abwarten. Das Sicherheitskriterium bleibt unverändert.
Der neue disabled-Parameter des gemeinsamen Katalogtyps wird auch an dessen zweite
Add-Button-Variante durchgereicht, damit der gemeinsame Vertrag vollständig bleibt.

### Phase 4 — Tabellen-Mutationsschutz: Nachprüfung

25 Tests und vollständiger Typecheck bestanden. Lint findet einen unbenutzten
Testcallback-Parameter; entfernen. Der Audit erweitert den bisherigen direkten
Sperrtest für Name/Scope um Beschreibung, Gewichte, Entfernen und das Hinzufügen
einer noch nicht gewählten Kreatur. Jede dieser Bedienelemente muss deaktiviert
sein; ausgelöste Testereignisse dürfen den tatsächlich gespeicherten Draft nicht
verändern. Danach gemeinsame Owner-/Dialogregression, Lint und gebauter Startpfad.

### Phase 4 — Tabellen-Owner und echter Dialogstapel: Teilaudit

Planabgleich: Tabellen-Guard durch tatsächliche Owner-Operationen ersetzt. Parser,
Scope und gewichtete Einträge bleiben beim Tabellen-Owner; synchroner Draft-/Scope-
Zustand verhindert spätere Feldmutationen. Normaler Save und Wartungs-Save verwenden
dasselbe Pending-Promise. Erfolgreiche Persistenz mit fehlgeschlagener Reconciliation
wird ohne zweite Tabellenanlage wiederholt. Alle schreibenden Bedienelemente prüfen
die Sperre und sind sichtbar deaktiviert; direkte Testereignisse verändern die
an Save übergebenen Felder/Gewichte/Scope nicht.

Neun neue Tests enthalten vier Fälle mit echten WorldFactionDialog-,
RelatedEntityDialogStack-, IntegratedEncounterTableCreation- und EncounterTableDialog-
Komponenten. Sie belegen Kind-vor-Eltern-Save samt referenzierter Tabellen-ID,
Kindfehler ohne Eltern-Save, Elternfehler mit geschlossenem Kind und Retry ohne
zweite Kindanlage sowie explizites Verwerfen beider Dialoge ohne Persistenz.
Capability-Persistenz ist im UI-Test kontrolliert; dies ist kein AppImage-Update-
oder Datenmigrationstest und ersetzt die Artefaktqualifikation nicht.

Validierung: 25 Tabellen-/Parser-/Draft-Tests bestanden. Gemeinsame Regression mit
Koordinator, Fraktion, Wartungsdialog, NSC und Hexkarte: 67 Tests in sieben Dateien
bestanden. Vollständiger Typecheck, gezieltes Lint, Build, Built-Smoke und
git diff --check bestanden. Smoke belegt Core ready/closed. Kein kanonischer
Handoff und keine Veröffentlichung behauptet.

Roadmapabgleich: Phase4 weiter in Arbeit. Tabellen-/Fraktions-Unterbaum ist nun
real geprüft; Orts-Owner und seine Kartenplatzierung/Tags/Teilspeicherzustände sowie
weitere Editorfamilien und Offline-/Update-Gesamtabnahme bleiben offen. Ortsanbindung
muss insbesondere den bisherigen partially-saved-Retry verwenden, statt bereits
persistierte Ortsdaten erneut anzulegen, und eigene Hexkarten-Dialogabhängigkeiten
explizit erfassen. Phasen5–7 und abschließende Auslieferungsgates bleiben erforderlich.

### Phase 4 — Orts-Owner: Teilplan

Vorheriger Zielturn: Fortschritt, Tabellen-Owner/echter Fraktionsstapel als ddf7d1e0d
geprüft und gepusht. Aktueller Worktree sauber, Phase4 weiterhin offen.
Orts-Owner führt Text-/Referenz-Draft und Tag-Eingabe synchron. Ausstehender Tag wird
beim ausdrücklichen Save nach bestehenden Trim-/Längen-/Anzahl-/Duplikatregeln
übernommen; ungültige Eingaben bleiben offen. Formmutation und bestätigte Kind-
Übernahme erhalten getrennte Zugänge. Save wartet Pending ab, nutzt bei partially-
saved ausschließlich den vorhandenen Retry und bestätigt erst vollständigen Erfolg.
Related-Creation-Handles werden vom Ort als Abhängigkeiten gehalten. Kartenplatzierung
und eigener Hexkarten-Dialog erhalten danach denselben synchronen Zustands-/ID-Vertrag;
Save muss die tatsächlich aktuelle Platzierungsabsicht lesen. Verwerfen löscht keine
bereits persistierten Teilergebnisse. Tests prüfen Tags, Mutationenschutz, Child-IDs,
Pending, Teilfehler/Retry und später die vollständige Orts-/Kartenintegration.

### Phase 4 — Orts-Adapter: erste Korrekturrunde

Typecheck findet zwei alte Test-Dialogbesitzer ohne Wartungshandle. Sie erhalten
wie der echte Stack pro Öffnungsereignis einen synchronen Offen-Handle. Codeaudit:
React-Anzeigezustand darf nicht aus synchronen Refs gelesen werden; Dirty-Anzeige
bleibt aus State abgeleitet, synchrone Getter dienen ausschließlich Ereignissen/
Wartung. Vollständiger Save bekommt einen separaten React-Abschlusszustand.
Danach bestehende Ortsdialog-/Draft-Tests und neue Wartungs-Ownerfälle prüfen.

### Phase 4 — Kartenintegration und Testzeitpunkt

Sieben neue Orts-Ownertests bestanden. Bestehender Busy-Test benötigt wie Tabelle
waitFor auf den nun im Microtask startenden Save; Doppelclick bleibt genau einmal.
Kartenintegration hält Platzierung synchron und liest die Absicht erst im Save.
Eigene Kartenanlage erhält eine stabile Dialog-ID als Ortsabhängigkeit. Direkte
Platzierungsänderungen und neue Kartenanforderungen während der Wartung werden
abgewiesen; bestätigte Kartenanzeige-Callbacks bleiben erlaubt. Vollständige
Platzierungs-/Lade- und verschachtelte Ortsabnahme folgt zusätzlich zum Grundadapter.

### Phase 4 — Echter dreistufiger Dialogstapel: Prüfplan

25 Orts-/Kartenregressionstests, vollständiger Typecheck und gezieltes Lint bestanden.
Zusätzlich jetzt den echten Related-Stack mit WorldLocationDialog als Wurzel und
Lazy-Integrationen für Fraktion/Tabelle ausführen. Erfolgsfall muss Tabelle, dann
Fraktion mit Tabellen-ID, dann Ort mit Fraktions-ID persistieren. Fehler auf mittlerer
Ebene muss den Ort ungespeichert lassen und bei Retry die erfolgreiche Tabelle
nicht erneut anlegen. Explizites Verwerfen darf keine Ebene persistieren.

### Phase 4 — Ortsabschluss: Korrekturplan

19 neue Owner-/Stacktests bestanden, darunter der komplette dreistufige Dialogstapel.
Abschlussaudit findet einen bereits bestehenden doppelten Close nach erfolgreichem
Platzierungs-Retry: Integrationsadapter und Dialog schließen beide. Nur der Dialog
schließt nach bestätigtem Retry; Adapter liefert ausschließlich Ergebnis. Ein bereits
vollständig gespeicherter, noch gemounteter Ort soll beim normalen Schließen zudem
keine ungespeicherten Änderungen mehr behaupten. Danach gezielte Regression und Build.

### Phase 4 — Erfolgreich gespeicherten Ort schließen: Testabgleich

Gemeinsame Regression: 65 Tests bestanden, ein bestehender Test erwartet nach
bestätigtem vollständigem Save weiterhin einen Unsaved-Dialog. Diese Erwartung
widerspricht dem eben korrigierten Abschlusszustand. Test wartet den vollständigen
Busy-Abschluss ab und prüft danach genau einen Close ohne Unsaved-Warnung. Die
unveränderte Vollständigkeitsassertion des gespeicherten Drafts bleibt erhalten.

### Phase 4 — Orts-Owner und dreistufiger Stapel: Teilaudit

Planabgleich Grundadapter: Orts-Owner registriert Save/Discard und explizite
Child-Handles. Synchroner Draft schließt pending Tags sowie bestätigte Child-IDs
ein; Benutzeränderungen bleiben während Wartung/Pending/Teilspeicherung gesperrt.
Vollständiger Save bestätigt erst saved; partially-saved hält ausschließlich seinen
Retry bereit, ohne die Ortsanlage zu wiederholen. Verwerfen entfernt keine bereits
persistierten Teilergebnisse. Die Integration liest die aktuelle Platzierungsabsicht
im Save und gibt dem eigenen Hexkarten-Dialog eine Wartungs-ID. Ein bestätigter
Retry schließt nur noch einmal, vollständiger Save erzeugt keine falsche Unsaved-
Warnung mehr beim anschließenden Schließen.

Sieben Orts-Ownertests prüfen pending/ungültige Tags, direkte gesperrte Eingaben,
Savefehler, Pending-Normalsave, Teilfehler/Retry, Verwerfen und bestätigte Child-ID.
Drei weitere Tests verwenden den echten Ort/Fraktion/Tabelle-Dialogstapel: komplette
Save-Reihenfolge samt IDs, mittlerer Fehler/Retry ohne zweite Tabelle und Discard
ohne Persistenz. Zusätzliche echte Karteninteraktions-/Lade- und Ortsplatzierungs-
Wartungstests bleiben offen; vorhandene Kartenregression ist kein vollständiger
Nachweis hierfür.

Validierung des korrigierten Stands: 66 Tests in neun Dateien bestanden;
vollständiger Typecheck, gezieltes Lint, Build, Built-Smoke und git diff --check
bestanden. Smoke belegt Core ready und bestätigt closed. Entwicklungsartefakt,
kein kanonischer Handoff. Die früher fehlgeschlagenen Testläufe bleiben oben erhalten.

Roadmapabgleich: Phase4 in Arbeit. Weitere Draft-Owner (u.a. Session Planner,
Gruppenverwaltung, Generator-Einstellungen), vollständige Karteninteraktionssperren,
Offline-/Update-Gesamtabnahme und anschließende Phasen5–7 bleiben erforderlich.
Die bereits geprüften Teilbäume ersetzen keine Freigabe der gesamten Phase.

### Phase 4 — Generator-Inventar: automatische Belohnungsregel

Vorheriger Zielturn: Fortschritt, Orts-Owner als d8b982b05 committed/gepusht. Worktree
sauber. Drei bisherige Übergangs-Guards verbleiben: Generator-Einstellungen,
Gruppenverwaltung und Session Planner. Generator-Inventar findet zusätzlich den
separaten CampaignRewardRulesCard-Sofortsave, dessen Pending bisher unregistriert ist.
Vor Generatorabschluss diesen tatsächlichen Schreibpfad integrieren: laufende Befehle
abwarten, neue Eingaben direkt/sichtbar sperren, unklaren Command-Ausgang durch
Receipt-Prüfung auflösen. Discard rollt einen bereits ausgelösten Sofortsave nicht
zurück. Solange Receipt-Abgleich unklar ist, Wartung verhindern und eine erneute
Prüfung anbieten. Fehler beim Receipt-/Stale-Read dürfen nicht als unhandled rejection
entweichen. Tests prüfen Pending-Save/Discard, Sperre, Outcome-Unknown und Retry ohne
zweites Update sowie vorhandene normale Belohnungsregel-Semantik.

### Phase 4 — Generator-Preset: Teilplan

15 Belohnungsregel-/Generatorregressionstests bestanden. Preset-Owner führt den
bestehenden Reducer synchron, registriert Save/Discard und wartet sämtliche bereits
laufenden Preset-Mutationen ab (auch Zuweisen/Löschen). Reconciliation bleibt beim
Application-Port; unbekannte Ergebnisse werden nicht durch erneute Mutation ersetzt.
Stale-Konflikte verhindern automatisches Überschreiben. Ausstehende Rollenkombination
wird beim ausdrücklichen Save nach bestehenden Limits normalisiert übernommen.
Alle Benutzeraktionen erhalten direkte Sperren; die Belohnungsregel wird als Kind-
Abhängigkeit gehalten, bevor der gesamte Einstellungsdialog geschlossen werden darf.
Tests müssen reale Preset-Saves, Kombination, Konflikt, Pending und Discard abdecken.

### Phase 4 — Preset-Audit vor Owner-Tests

Bestehende 15 Tests, Typecheck und gezieltes Lint bestanden. Audit: Kombinationen-
Zwischenentwurf muss auch für normales Wechseln/Schließen als Dirty zählen, sonst
würde er auf ein anderes Preset übertragen. Bei bestätigtem Verwerfen/Reset wird
der Zwischenentwurf ausdrücklich geleert. Danach echte Ownerfälle ergänzen, darunter
Save unter Sperre, geschütztes Preset ohne Zuweisung, Kombination, Konflikt,
laufender Save und unklarer Ausgang mit Reconciliation ohne zweite Mutation.

### Phase 4 — Generator-Unterbaum: Integrationsprüfung

21 Tests bestanden (bestehende Generatorfälle plus sechs Preset-Owner- und sechs
Belohnungsregel-Fälle). Zusätzlich denselben echten Einstellungsdialog mit beiden
Ownern rendern: während eine Sofortregel noch schreibt, darf die Preset-Mutation
nicht beginnen; nach deren Abschluss wird das Preset genau einmal gespeichert.
Diese Prüfung belegt den tatsächlich weitergereichten Kind-ID-Vertrag.

### Phase 4 — Generator-Testport: Korrekturrunde

51 Tests in vier Dateien und gezieltes Lint bestanden. Typecheck findet den neuen
Integrations-Testport: nacktes vi.fn() ohne Implementierung ist auch als Konstruktor
typisiert und erfüllt commandReceipt nicht. Den Mock ausdrücklich mit dem vorhandenen
CampaignRewardRulesPort-Vertrag typisieren und null als nicht benötigte Receipt
liefern. Nach abgeschlossenem Build/Smoke Typprüfung erneut ausführen; Produktcode
bleibt hierfür unverändert.

### Phase 4 — Reconciliation nach Lesefehler: Korrekturplan

Codeaudit: Nach einem generischen Fehler der Preset-Reconciliation kann der Reducer
phase=error anzeigen, während der Application-Port den Command weiterhin als pending
hält. Die sichtbare/direct Eingabesperre und Retry-Anzeige müssen daher zusätzlich
den autoritativen reconciliationPending()-Zustand des Ports verwenden. Ein neuer
Testversuch lässt den ersten Receipt-Abgleich scheitern und prüft gesperrte Eingaben,
danach erfolgreichen Retry weiterhin ohne zweiten Create-Aufruf.

### Phase 4 — Generator-Preset und Belohnungsregel: Teilaudit

Planabgleich: Beide tatsächlichen Schreibpfade sind nun registrierte Owner. Die
Belohnungsregel wartet Sofortsave ab und löst outcome_unknown ausschließlich mit
seiner Command-ID auf; null/fehlgeschlagene Receipt blockiert weitere Wartung und
neue Eingaben. Discard wartet diese bereits ausgelöste Mutation ebenfalls ab, ohne
sie rückgängig zu machen. Preset-Owner nutzt synchronen Reducer/Pending-Pfad für
Save, Zuweisen, Löschen und Reconciliation. Stale-Konflikte erlauben kein implizites
Überschreiben. Pending-Rollenkombinationen werden normalisiert übernommen und bei
bestätigtem Verwerfen/Reset geleert. Belohnungsregel-ID ist eine echte Abhängigkeit
vor dem Schließen/Speichern des gesamten Presetdialogs.

Tests: sechs Belohnungsregel-Fälle prüfen Sperre, Pending-Save/Discard, unknown mit
gleicher Command-ID, Receipt-Ausfall/Retry und fehlgeschlagenen Stale-Read. Sieben
Preset-Owner-Fälle prüfen Save unter Sperre, Systemkopie ohne Zuweisung, Kombination,
Konflikt, normalen Pending-Save, Discard, Reconciliation ohne zweite Mutation sowie
den echten Dialog mit gleichzeitig laufender Belohnungsregel. Der abschließende
Reconciliation-Test enthält zusätzlich einen fehlgeschlagenen Receipt-Abgleich und
belegt die fortbestehende Sperre auch nach Abbrechen der Wartung.

Validierung: 51 Tests in vier Dateien bestanden; nach letzter Reconciliation-
Korrektur die sieben betroffenen Owner-Tests erneut bestanden. Vollständiger
Typecheck des abschließenden Stands, gezieltes Lint, erneuter Build/Built-Smoke und
git diff --check bestanden. Smoke belegt ready/closed. Früherer Typfehler und seine
Korrektur bleiben oben erhalten. Kein kanonischer Handoff/Release behauptet.

Roadmapabgleich: Phase4 bleibt offen. Übergangs-Guards verbleiben bei Gruppenverwaltung
und Session Planner. Zusätzlicher Gesamtaudit muss schreibende Wege ohne bisherigen
Guard sowie Karteninteraktionen erfassen und das Warten bei weiteren Preset-Befehlen
wie Zuweisen/Löschen prüfen. Offline-/Update-Gesamtabnahme und Phasen5–7 einschließlich
aller Handoff-/Veröffentlichungsgates bleiben erforderlich.

### Phase 4 — Gruppenverwaltung: Inventar und erste Vertragskorrektur

Vorheriger Zielturn: Fortschritt, Generator-Preset/Belohnungsregel als 21713b47a
committed/gepusht. Worktree sauber. GroupManagerState hält mehrere persistierende
Draft-Sessions, einschließlich Beuteentwürfen. Der View-Guard verwendet bisher nur
controller.dirty (aktive Session), obwohl controller.anyDirty bereits existiert.
Sofort auf alle Sessions umstellen, damit abgewählte Entwürfe Wartung weiterhin
verhindern. Dies ist weiterhin ein Übergangs-Guard, kein vollständiger Save-Owner.

Save liefert bisher Promise<void> sowohl bei fehlender Auswahl/Validierungsfehler
als auch bei erfolgreicher Mutation oder veraltetem Ergebnis. Rückgabe auf den
bestätigten LiveSessionSnapshot oder null umstellen; bestehende normale Publication
bleibt erhalten. Tests müssen bestätigten Snapshot, verdrängten Save, aktuellen
Fehler und abgewiesene Validierung unterscheiden. Das ist Voraussetzung für den
anschließenden Owner, der sämtliche Dirty-Sessions in Reihenfolge mit aktualisierten
Revisionsständen speichern und Beute über ihren tatsächlichen Commit-Pfad erhalten
muss. Ein Save nur der aktiven Gruppe erfüllt die Roadmap ausdrücklich nicht.

### Phase 4 — Gruppen-Mehrfachsave: konkretisierter nächster Schritt

11 Gruppen-Command-/State-Tests, vollständiger Typecheck und gezieltes Lint bestanden.
Read-only-Nachverfolgung bestätigt: use-session-workspace-controller.groupSaved
publiziert den Snapshot und schließt sofort den gesamten Dialog. Der Wartungs-Owner
muss deshalb die bestehenden Gruppen-/Beute-Commands mit zurückgestellter Publication
verwenden, alle Dirty-Sessions bearbeiten und den jeweils bestätigten Snapshot samt
Revisionsständen synchron fortschreiben. Erst danach darf die normale Publication/
Schließung erfolgen. Teilerfolge brauchen sofort aktualisierte lokale Baselines,
damit Retry nicht bereits gespeicherte Gruppen/Beute erneut schreibt. Generierung,
Beute-Commit und sämtliche laufenden Befehle müssen vorher vollständig auslaufen;
reines Prüfen von busy einer aktiven Session ist kein Nachweis dafür.

### Phase 4 — Gruppen-Vertragskorrektur: Teilaudit

Planabgleich dieses Schritts: Übergangs-Guard erfasst jetzt alle Draft-Sessions.
Save bestätigt nur einen tatsächlich veröffentlichten Snapshot; fehlende Auswahl,
Validierungsfehler, aktueller Fehler und verdrängtes Ergebnis liefern null.
Vier Command-Tests plus sieben State-Tests bestanden. Vollständiger Typecheck,
gezieltes Lint, Build/Built-Smoke und git diff --check bestanden. Smoke zeigt
ready/closed. Kein kanonischer Handoff.

Roadmapabgleich: Dies sind Grundlagen für den Gruppen-Owner; vollständiges Speichern/
Verwerfen sämtlicher Gruppen und Beute sowie deren Eingabesperren fehlen weiterhin.
Weitere Inventarstelle: createGroupLootDraftHistory setzt die frisch generierte Beute
sofort als baseline, loot-committed markiert bislang keinen separaten übernommenen
Zustand. Vor Wartungsabschluss prüfen, wie auch unveränderte generierte Vorschauen
und erfolgreich übernommene Beute unterschieden werden, damit weder offene Ergebnisse
verschwinden noch bestätigte Commits wiederholt werden. Der geplante Mehrfachsave
muss diese Semantik ausdrücklich testen. Phase4 und die folgenden Phasen bleiben offen.

### Phase 4 — Beuteübernahmestand: Umsetzungsplan

Der vorherige Turn prüfte lediglich den bereits installierten Skill; für das
Roadmapziel kein Implementierungsfortschritt. Aktueller Worktree sauber. Der
Gruppen-Mehrfachsave bleibt der nächste Integrationsschritt. Zuerst die dafür
notwendige Übernahmequittierung korrigieren: Die History-Baseline bezeichnet die
Generierung, nicht eine bestätigte persistierte Übernahme. Ein eigener nullable
committedSignature-Wert unterscheidet diese Zustände, ohne Undo-History umzudeuten.
Alle Gruppen-Dirty-Prüfungen verwenden den Vergleich zum bestätigten Stand.

Der bestehende Beutecommand quittiert Run-ID und Signatur des tatsächlich gesendeten
Entwurfs. Ein verzögertes Ergebnis darf weder einen neu generierten Run noch später
bearbeitete Felder als gespeichert markieren. Keine neue Persistenzimplementierung.
Tests: unveränderte generierte Beute, inaktive Session, externe Aktualisierung,
fehlgeschlagene Übernahme, bestätigte Übernahme, spätere Bearbeitung/Undo sowie
Quittierung eines ersetzten Runs. Anschließend Typecheck, gezieltes Lint und
Build/Smoke. Dies schließt Phase 4 nicht ab; Mehrfachsave, Command-Drain und
Reconciliation unbekannter Commit-Ausgänge bleiben Teil des Owner-Auftrags.

Beuteübernahmestand — erste Validierung: 17/18 Tests bestanden. Der neue
Replacement-Run-Test änderte nur die Run-ID, ließ aber Itemreferenzen am alten Run;
der vorhandene Presenter weist dieses ungültige Fixture korrekt ab. Korrekturrunde:
Fixture mit durchgängig parametrisierter Run-ID erzeugen; Szenario und Assertions
bleiben unverändert. Zusätzlich Command-Test für die tatsächlich ausgegebene
Run-/Entwurfsquittierung ergänzen, damit der Reducer-Nachweis nicht allein steht.

### Phase 4 — Beuteübernahmestand: Teilaudit

Planabgleich bestanden: Generierungsbaseline und persistierter Übernahmestand sind
getrennt. Alle Gruppen-Dirty-Prüfungen einschließlich View-Projektion erkennen auch
unveränderte generierte Ergebnisse. Bestätigungen enthalten Run-ID und die Signatur
des tatsächlich übergebenen Entwurfs. Ein anderer Run wird nicht quittiert; spätere
Bearbeitung bleibt dirty, Undo zurück zum quittierten Stand wird clean. Externe
Gruppenaktualisierung ersetzt offene Beute nicht still. 19 Tests in drei Dateien
bestanden, einschließlich des tatsächlichen Commands. Vollständiger Typecheck,
gezieltes ESLint, Build/Built-Smoke (ready/closed) und git diff --check bestanden.
Logs: work/roadmap-phase4-group-loot-state-{tests,types,lint,build,smoke}.log im
übergeordneten Arbeitsverzeichnis. Build war eine technische Development-Probe,
kein kanonischer Handoff.

Roadmapabgleich: Phase 4 bleibt offen. Dieser Stand macht offene Beute erkennbar,
implementiert jedoch noch keinen vollständigen Gruppen-Wartungsowner. Bestätigte
Teilsaves müssen dort die Gruppenbaselines und den Snapshot synchron fortschreiben,
bevor weitere Sessions gespeichert werden. Read-only-Inventar bestätigt zusätzlich:
GroupRewardCommitHandler besitzt ein persistiertes Command-Journal mit Fingerprint;
der Renderer erzeugt dagegen für jeden Aufruf eine neue Command-ID. Unbekannte
Ausgänge müssen vor Wiederholung über denselben Auftrag abgeglichen werden. Ein
neuer Commit mit neuer ID ist kein zulässiger Reconciliation-Ersatz. Der aktuelle
AsyncCommandCoordinator quittiert verdrängte Ergebnisse als stale, obwohl ein nicht
abbrechbarer IPC-Auftrag weiterlaufen kann; Owner-Drain darf deshalb nicht allein
auf aktuelle busy-/pending-Anzeigen vertrauen. Diese verbleibenden Anforderungen
werden im folgenden Gruppen-Owner-Schritt umgesetzt und geprüft. Kein Abschluss
von Phase 4, Handoff, Main-Promotion oder Release behauptet.

### Phase 4 — Tatsächliches Command-Ende: Umsetzungsplan

Vorheriger Zielturn: Fortschritt, 4c3fe837d sauber committed/gepusht. Worktree erneut
sauber geprüft. Gruppenbefehle verwenden latest-only; Abort und sichtbarer Slotstatus
beweisen kein Transportende. Den bestehenden AsyncCommandCoordinator um unabhängig
vom sichtbaren Ergebnis verfolgte laufende Aufträge und whenIdle erweitern. Erfasst
werden sofort gestartete und wartende Queue-Aufträge einschließlich accept-Phase,
auch nach cancelAll oder Verdrängung. Optionale Scope-Auswahl trennt Gruppenmutation
von Katalogabfragen. whenIdle prüft erneut nach jedem Durchlauf und erfasst während
des Wartens hinzugekommene Aufträge. Es blockiert selbst keine neuen Aufträge; die
Eingabesperre und anschließende Ergebnisprüfung bleiben Owner-Verantwortung.

Den Gruppen-Übergangs-Guard außerdem um tatsächlich laufende Command-/Loot-Scopes
ergänzen, damit ein bislang sauberer Editor mit laufender Generierung/Mutation
Wartung nicht passieren lässt. Die Anzeige busy berücksichtigt diese Aufträge über
alle Gruppen, nicht allein die aktive Session. Tests für verdrängten nicht abbrechbaren
Auftrag, cancelAll, wartende Queue, asynchrones accept, Scope-Isolation und Nachläufer.
Typecheck, gezieltes Lint und Build/Smoke; getrennte Plan-/Roadmapaudits. Vollständige
Gruppen-Save/Discard-Integration folgt weiterhin, mit Verarbeitung in accept bzw.
zusätzlicher Nachverfolgung vollständiger Controller-Promises; whenIdle allein
quittiert ausdrücklich keine Callbacks außerhalb des Coordinators.

Command-Ende — Korrekturrunde: 29 gezielte Tests bestanden. ESLint beanstandet zwei
neue Testcallbacks mit async ohne await. Durch Promise.resolve ersetzen; keine
Änderung der getesteten Reihenfolge. Wegen gemeinsamer Coordinator-Nutzung zusätzlich
bestehende Keyed-Owner-, Hex-, Planner-, Reise- und Session-Controller-Tests prüfen,
um neue Benachrichtigungen und Promise-Reihenfolge über den Gruppenfall hinaus
abzusichern.

### Phase 4 — Tatsächliches Command-Ende: Teilaudit

Planabgleich bestanden: AsyncCommandCoordinator verfolgt jeden gestarteten und
wartenden Auftrag unabhängig von sichtbaren Slots bis einschließlich accept-Ende.
hasPending und whenIdle erfassen auch superseded/cancelAll-Fälle und beim Warten
hinzugekommene Aufträge; Scope-Auswahl lässt reine Katalogabfragen getrennt. Der
Gruppen-View-Guard berücksichtigt offene Command-/Loot-Aufträge; busy bleibt auch
nach Erfolg eines neueren Saves true, solange ein älterer Auftrag noch läuft.
Inaktive Gruppen werden dabei erfasst. 78 Tests in 15 Dateien bestanden, einschließlich
bestehender Keyed-Owner-, Hex-, NPC-, Planner-, Reise- und Session-Verwendung.
Vollständiger Typecheck, korrigiertes gezieltes Lint, Build/Built-Smoke (ready/closed)
und git diff --check bestanden. Logs unter work/roadmap-phase4-group-drain-*.

Roadmapabgleich: Phase 4 bleibt offen. Der Gruppen-Guard verweigert jetzt auch bei
noch sauberem Draft mit laufendem Auftrag die Wartungsfreigabe. Ein vollständiger
Owner muss als Nächstes selbst awaiten, anschließend bestätigte Ergebnisse abgleichen
und sämtliche Sessions speichern/verwerfen. whenIdle ist Infrastruktur, kein
Speicherbeleg und keine Sperre für neue Eingaben. Callbacks nach run außerhalb von
accept sowie die generateRoster→generateLoot-Kette sind noch als vollständige
Controller-Operationen nachzuverfolgen. Unbekannte Beute-Commit-Ausgänge, sofortige
Baseline-Updates bei Teilerfolgen und zurückgestellte Dialogschließung bleiben
verbindlich. Kein kanonischer Handoff oder Release; technische Development-Probe.

### Phase 4 — Gruppen-Savequittierung: Umsetzungsplan

Vorheriger Turn ist Fortschritt (944fd055e), aktueller Worktree sauber. Für den
geplanten Mehrfachsave fehlt weiterhin eine bestätigte Baseline pro Session:
useGroupManagerCommands.save publiziert nur den Snapshot; der Reducer erfährt weder
die persistierte Gruppen-ID bei Neuanlage noch deren Revision. Zuerst diese
Quittierung im tatsächlichen Save- und Beute-Commit-Pfad ergänzen, unmittelbar vor
Publication. Sie enthält den abgeschickten Gruppenentwurf und die bestätigte Gruppe.

Bei unverändertem Entwurf die normalisierten persistierten Felder übernehmen; bei
zwischenzeitlicher Bearbeitung nur Baseline/Quellrevision aktualisieren, lokale
Änderungen erhalten. Neue Session von 'new' auf die zurückgelieferte Gruppen-ID
umhängen, sodass Wiederholung keine zweite Neuanlage auslöst. Beute und die Undo-
History bleiben erhalten; Beute-Commit quittiert zusätzlich den Gruppenstand.
Nicht bestätigte oder fehlerhafte Ergebnisse dürfen keine Baseline zurücksetzen.
Tests müssen reale Save-Rückgaben, Neuanlage, späteres Edit, inaktive Gruppen,
Teilerfolg und Beuteerhalt beweisen. Anschließend Typecheck/Lint/Build/Smoke sowie
getrennte Audits. Der vollständige Owner wird auf diese tatsächlich verdrahteten
Quittierungen aufgesetzt; dieser Schritt allein schließt Phase 4 nicht ab.

Gruppen-Savequittierung — Auditkorrektur vor Abschluss: Command- und Loot-Scope
können getrennt laufen. Eine verspätete Bestätigung mit älterer Gruppenrevision
darf deshalb auch im Reducer keine neuere Baseline/Quellrevision zurücksetzen.
Diesen monotonen Revisionsvergleich ergänzen und direkt testen. Die spätere
Owner-Integration muss zusätzlich den Gesamtsnapshot monoton fortschreiben und
neue User-Aufträge sperren.

Gruppen-Savequittierung — Validierungskorrektur: 40 Tests einschließlich Renderer-
Architektur und vollständiger Typecheck bestanden. ESLint beanstandet zwei neue
verschachtelte untypisierte Matcherwerte in erwarteten Action-Objekten. Die
Assertions auf den bestätigten Gruppenwert umstellen, ohne die Prüfanforderung zu
ändern; danach gezieltes Lint und betroffene Command-Tests wiederholen. App-Build
bereits erfolgreich, noch ohne abschließenden Built-Smoke.

### Phase 4 — Gruppen-Savequittierung: Teilaudit

Planabgleich bestanden: Gemeinsames acknowledgeGroupSave ist im echten Save- und
Beute-Commit-Pfad vor Publication verdrahtet. Quittiert werden zurückgelieferte
Gruppen-ID, Revision und normalisierte Baseline. Unveränderte Felder werden auf den
bestätigten normalisierten Stand gesetzt; spätere lokale Änderungen bleiben dirty.
Neuanlagen werden umgehängt, alte 'new'-Session entfernt, eine verbrauchte prospektive
Beute-Gruppen-ID ersetzt. Beute und History bleiben erhalten; Beutequittierung
adressiert nach dem Umhängen die bestätigte ID. Ältere Gruppenrevisionen ersetzen
keine neuere Baseline. Fehlgeschlagene Commands senden keine Savequittierung.

40 Tests in drei Dateien einschließlich Renderer-Architektur bestanden. Nach reiner
Matcher-Korrektur die sieben Command-Tests erneut bestanden. Vollständiger Typecheck,
gezieltes ESLint, Build/Built-Smoke (ready/closed) und git diff --check bestanden.
Nachweise unter work/roadmap-phase4-group-ack-*.log im übergeordneten Arbeitsverzeichnis.
Technische Development-Probe; kein kanonischer Handoff.

Roadmapabgleich: Phase 4 bleibt offen. Die für Teilsaves notwendige Quittierung ist
nun implementiert und wird tatsächlich verwendet, aber der Gruppen-Owner muss noch
alle Sessions sequenziell bearbeiten und den Gesamtsnapshot synchron aktualisieren.
Die bisherige sofortige Schließung durch props.saved darf während Wartung erst nach
allen Sessions erfolgen. Command-Drain inklusive außerhalb accept laufender
Controllerketten, Reconciliation unbekannter Commit-Ausgänge und vollständige
Eingabesperren sind weiterhin verpflichtend; keine Teilprüfung als vollständige
Mehrgruppenabnahme gewertet. Phasen 5–7 sowie Handoff/Release bleiben ausstehend.

### Phase 4 — Gruppen-Wartungsowner: Integrationsplan

Vorheriger Turn Fortschritt (e8bce4a24), aktueller Worktree sauber. Jetzt die bereits
vorhandenen Quittierungen und tatsächliche Command-Verfolgung zusammenführen:
ein renderer-lokaler Draft-Runtime hält Reducerstand und bestätigten Snapshot
synchron und verfolgt vollständige Controller-Promises (inklusive Generierungskette).
Der Hook verwendet dessen abonnierbaren Stand; SQL/Persistenz verbleiben unverändert.

Save wartet auf alle laufenden Controlleroperationen und speichert anschließend
jede offene Session über die vorhandenen Command-Fabriken, jeweils mit aktuellem
Snapshot und aktuellen Revisionen. Bestätigte Teilsaves bleiben sofort in Runtime
und Reducer erhalten; Publication/Schließung erfolgt unter Wartung erst nach allen
Sessions. Discard wartet ebenfalls und verwirft nur lokale Entwürfe, publiziert aber
bereits bestätigte Teilsaves. Direkte User-Einstiegspunkte und die Dialogoberfläche
werden während Wartung gesperrt. Übergangs-Guard durch echten benannten Owner ersetzen.

Unbekannte Mutationsergebnisse dürfen dabei nicht blind erneut ausgeführt werden.
Der Runtime merkt sie und verweigert Save/Discard mit konkreter Fehlermeldung; eine
vollständig bedienbare Receipt-Reconciliation bleibt eine explizite ausstehende
Korrekturrunde (scene.saveGroup besitzt derzeit keine Command-ID/Receipt-Capability,
loot.commitGroupReward nur das Utility-Journal). Damit keine unbekannte Neuanlage
wiederholt wird. Diese Zwischenbegrenzung ist kein Phase-4-Abschluss.

Tests mit echten Commands und Reducer: zwei Gruppen, Teilfehler/Retry ohne zweiten
Save der ersten Gruppe, aktuelle Revisionsfolge, unveränderte generierte Beute,
Discard ohne Rücknahme bereits gespeicherter Daten, laufende Generierung/Saves und
User-Eingabesperre. Typecheck, Lint, relevante Architekturtests sowie Build/Smoke.

Gruppen-Owner — Integrationskorrektur: ModalDialog rendert per Portal und setzt
untergeordnete Modal-Layer bereits inert. Ein inert-Wrapper außerhalb des Portals
wirkt nicht auf den Dialog; diesen Ansatz entfernen. Die vorhandene zentrale
Modal-Layer-Sperre plus direkte Command-/Dispatch-Guards verwenden. Für laufende
Aufträge außerdem bisher ungesperrte Header-Eingaben deaktivieren. Unbekannte
Ausgänge benötigen weiterhin die dokumentierte bedienbare Recovery-Korrekturrunde.

Gruppen-Owner — erste Validierung/Korrekturrunde: 43/45 Tests bestanden. Der neue
Mehrgruppen-Test erwartete den technischen Error-Text, während die bestehende
Capability-Übersetzung absichtlich „Unbekannter Fehler“ liefert; auf den benannten
betroffenen Gruppenbereich prüfen und die Fehlermeldung immer um eine nächste
Aktion ergänzen. Architekturprüfung verlangt noch useReducer direkt im Controller.
Die Eigentümerschaft ist jetzt ausdrücklich im synchronen GroupManagerDraftRuntime;
den Wächter auf genau diesen einzigen Reducer-Aufrufer umstellen und mit einem
zusätzlichen manipulierten zweiten Owner prüfen. Keine bloße Entfernung des Gates.

Gruppen-Owner — Auditkorrektur für Abbrechen nach Teilerfolg: 48 Tests bestehen.
Nach Abbrechen der Wartung kann der Nutzer den Gruppeneditor regulär schließen und
verbleibende Entwürfe verwerfen. Auch dann muss der bereits bestätigte Teilsnapshot
an den übergeordneten Workspace publiziert werden; sonst bleibt dessen Anzeige
bis zur nächsten Aktualisierung veraltet. Close-Adapter entsprechend ergänzen und
mit echtem Hook/zentraler Resolution testen. Prospektive ID außerdem nur bei
Runtime-Erzeugung statt bei jedem Controller-Render erzeugen.

Gruppen-Owner — Lintkorrektur: 49 Tests in vier Dateien bestanden. ESLint beanstandet
nur eine überflüssige Non-null-Assertion im neuen Testfixture; entfernen und Lint
sowie die Owner-Tests erneut prüfen. Keine Änderung am Anwendungsverhalten.

Gruppen-Owner — Typecheck-Korrekturrunde: Der vollständige Check meldet zwei reine
Testtypfehler: Recordzugriff mit Punktnotation und unvollständiger Loot-Port beim
Überschreiben eines Testadapters. Indexzugriff und typgerechtes Erweitern des
bestehenden Ports verwenden; danach vollständigen Typecheck erneut ausführen.

### Phase 4 — Gruppen-Wartungsowner: Integrationsaudit

Planabgleich: synchroner Runtime mit genau einem Reducer-Verantwortlichen ist in
den Controller eingebunden. Der echte benannte Wartungsowner ersetzt den View-
Übergangs-Guard. Vollständige normale Controlleroperationen werden verfolgt;
Save/Discard warten vor der Auflösung. Save verwendet die vorhandenen Command-
Fabriken für sämtliche Dirty-Sessions einschließlich unveränderter generierter
Beute, fortgeschriebener Snapshot/Revision und sofortiger Gruppenquittierung.
Teilerfolg bleibt erhalten; Retry speichert nur verbleibende Sessions. Publication
unter Wartung erfolgt erst nach vollständigem Erfolg. Discard verwirft nur lokale
Entwürfe und publiziert bestätigte Teilsaves. Nach Wartungsabbruch und regulärem
Schließen wird ein bestätigter Teilsnapshot ebenfalls publiziert. Direkte Mutatoren
und Command-Einstiege sind unter Wartung gesperrt; vorhandene Modal-Layer-Sperre
schützt die Portal-Oberfläche. Header-Felder berücksichtigen busy.

Validierung: neun neue Runtime-/Hooktests mit echtem Reducer und Commands; darunter
Mehrgruppen-Teilfehler/Retry, aktuelle Revisionsfolge, einmaliger Beutecommit,
Pending-Save ohne frühe Schließung, Verwerfen nach laufendem Auftrag, Cancel nach
Teilerfolg, direkte gesperrte Eingaben und unbekannter Ausgang ohne Wiederholung.
122 Tests in elf Dateien einschließlich vollständiger Architekturtests bestanden.
Vollständiger Typecheck, korrigiertes gezieltes Lint, Build/Built-Smoke (ready/closed)
und git diff --check bestanden. Logs work/roadmap-phase4-group-owner-*.
Die beiden dokumentierten Test-/Gate-Korrekturen sind abgeschlossen. Kein kanonischer
Handoff, technische Development-Probe.

Roadmapabgleich: Phase 4 bleibt offen. Gruppen-Save/Discard ist jetzt integriert;
fehlende bedienbare Reconciliation unbekannter Mutationsergebnisse bleibt eine
konkrete Abweichung. Aktuell verweigert der Owner bei outcome_unknown weitere
Save-/Discard-Versuche und verhindert damit blinde doppelte Neuanlagen; eine
read-only Receipt-/Projektionsprüfung mit sinnvoller nächster UI-Aktion muss folgen.
Weitere Grenzen: ausstehende Archivieren/Combat-Pending-Fälle und vollständige
Oberflächenabnahme; Session Planner verbleibt beim Übergangs-Guard. Der übergreifende
Writer-/Karten-/Offline-/Updateaudit sowie Phasen 5–7 und sämtliche kanonischen
Handoff-/Releasegates bleiben erforderlich. Keine vollständige Gruppen- oder
Phase-4-Abnahme aus den erfolgreichen Teilfällen abgeleitet.

### Phase 4 — Gruppenbeute-Receipt: Umsetzungsplan

Vorheriger Turn Fortschritt (ae8ef0e4b); Worktree sauber. Das vorhandene
LootOperationJournal speichert commit_group_reward mit Command-ID, Fingerprint,
Zielgruppe und validiertem Ergebnis. Eine read-only Operation
loot.groupRewardReceipt erhält den exakt ursprünglichen Auftrag und liefert nur
dessen passende Quittierung oder null. Abweichende Inhalte bei gleicher ID werden
als Idempotenzkonflikt zurückgewiesen. Utility liest beim vorhandenen Handler aus
seinem Journal; keine Migration und keine zweite Persistenzimplementierung.

Commit und Receipt-Lesen teilen dieselbe Zuordnung/Validierung. Integrationstest
prüft vor Commit/bei Rollback null, nach Commit dasselbe Ergebnis, unveränderte
Tabellenstände/Revisionen und SQLite query_only sowie Konflikt bei geändertem
Auftrag. Bridge/Registry/Typecheck prüfen die veröffentlichte read-Capability.
Diese Capability ist Voraussetzung für den folgenden Renderer-Abgleich; sie allein
hebt die aktuelle Unknown-Sperre noch nicht auf und schließt Phase 4 nicht ab.

### Phase 4 — Gruppenbeute-Receipt: Teilaudit

Planabgleich bestanden: Die neue read-only Capability loot.groupRewardReceipt ist
Zod-validiert und nur für das Hauptfenster (gm) verfügbar. Utility liest beim
bestehenden GroupRewardCommitHandler; dessen Commit und Receipt-Lesen verwenden
dieselbe Journalzuordnung mit Fingerprint/Zielgruppe/Schema. Ein fehlender oder
zurückgerollter Commit liefert null, eine bestätigte Übernahme ihr gespeichertes
Ergebnis. Abweichender Auftrag bei gleicher ID wird zurückgewiesen. Der echte
SQLite-Integrationstest liest unter query_only und belegt unveränderte Gruppen-,
Beute- und Receipt-Anzahlen sowie Projektionsrevision. Keine Migration/neue SQL-
Implementierung. 36 Integrations-/Registry-/Capabilitytests, vollständiger Typecheck,
gezieltes Lint, Build/Built-Smoke (ready/closed) und git diff --check bestanden.
Logs work/roadmap-phase4-group-receipt-*.log. Technische Development-Probe.

Roadmapabgleich: Phase 4 bleibt offen. Der Renderer muss den unveränderten Auftrag
samt Command-ID halten, diesen Leseweg bedienbar wiederholen und die Unknown-Sperre
erst nach bestätigtem Abgleich aufheben. Die Quittierung beweist einen historischen
Commit, nicht den heutigen Gesamtsnapshot; späteren Stand vor Freigabe frisch lesen
bzw. monoton berücksichtigen. Scene.saveGroup benötigt noch einen entsprechenden
verlässlichen Abgleich für Neuanlagen. Unbekannte Ausgänge bleiben bis zur folgenden
Integration gesperrt. Weitere Gruppen-Pending-Fälle, Session Planner, Gesamtaudit
sowie Phasen 5–7 und Handoff/Release sind weiterhin ausstehend.

### Phase 4 — Gruppenbeute-Abgleich in der Oberfläche: Umsetzungsplan

Vorheriger Turn Fortschritt (738db4459); Worktree sauber. Der Beutecommand hält den
ursprünglichen Commit-Auftrag mit einmal erzeugter Command-ID in seinem Closure.
Bei outcome_unknown hinterlegt er einen ausschließlich lesenden Recovery-Callback
beim bestehenden Draft-Runtime. Der Callback liest die passende Quittung und danach
den frischen Session-Snapshot, bevor lokale Baselines quittiert werden. Fehlende
Quittung oder fehlgeschlagene Reads lassen die Unknown-Sperre bestehen. Es wird kein
zweiter Commit ausgelöst. Frische externe Gruppenstände werden nach Quittierung
mit dem bestehenden Reducer synchronisiert; spätere Daten nicht durch das Receipt
ersetzt.

Runtime bietet diesen Abgleich explizit an; die Gruppenoberfläche zeigt Status und
„Speicherstand erneut prüfen“. Speichern/Verwerfen im Wartungsdialog können denselben
Abgleich vor ihrer Fortsetzung ausführen. Normale User-Mutationen bleiben während
Unknown/Pending gesperrt. Kein automatisches Schließen allein durch einen Read.
Scene.saveGroup ohne Receipt bleibt zunächst gesperrt und ist weiterhin offene
Abweichung. Tests für verlorene Antwort, wiederholte fehlende/fehlerhafte Reads,
frischeren Snapshot, erfolgreiche Freigabe und genau einen Commit; danach
Typecheck/Lint/Architektur und Build/Smoke.

Gruppenbeute-Abgleich — zusätzlicher Bediennachweis: 105 Tests einschließlich aller
Architekturgates sowie gezieltes Lint bestanden. Den tatsächlichen Retry-Button des
GroupManagerView zusätzlich mit realem Controller/Runtime rendern und klicken.
Katalog und Dialograhmen dürfen im Test reduziert werden; unbekannter Commit,
Quittungsread, Pending-Zustand und Freigabe bleiben echte Produktionspfade. Dies
prüft den neuen UI-Anschluss über einen bloßen Controlleraufruf hinaus.

Gruppenbeute-Abgleich — Typecheck-Korrekturrunde: Der frische Session-Read verlangt
explizit eine campaignId; ein parameterloser Aufruf der allgemeinen API ist falsch.
Im Capability-Port eine lokale parameterlose Convenience-Funktion bereitstellen,
die die bei der Port-Erzeugung geladene Kampagne bindet. Vor Read prüfen, dass die
Workspace-Projektion noch dieselbe aktive/session-Kampagne hält; Utility validiert
die explizite ID zusätzlich. Kein automatisches Ausweichen auf eine inzwischen
andere Kampagne und keine Aufweichung des API-Vertrags. Der gerenderte Retry-Button
hat bereits seinen UI-Test bestanden (12 Owner-Tests).

Gruppenbeute-Abgleich — abschließende Test-Lintkorrektur: Der neue Button-Test nutzt
einen async-act-Callback ohne await. Nach Auflösen des Testgates dessen Promise
explizit abwarten; danach den betroffenen Test und ESLint erneut ausführen.
Anwendungscode/Build unverändert.

### Phase 4 — Gruppenbeute-Abgleich: Teilaudit

Planabgleich bestanden: Ein Beutecommit erzeugt genau einen gehaltenen Auftrag;
outcome_unknown registriert dessen read-only Recovery-Callback. Dieser liest die
passende Quittung und danach den kampagnengebundenen frischen Sessionstand, bevor
lokale Bestätigungen angewendet werden. Fehler/fehlende Quittung erhalten die Sperre.
Save/Discard können denselben Abgleich fortsetzen; der explizite Button ist nach
Wartungsabbruch verfügbar, während Reads deaktiviert und schließt den Editor nicht.
User-Änderungen bleiben bis zur Quittierung gesperrt. Später persistierte Änderungen
werden aus dem frischen Snapshot übernommen, nicht durch den alten Receipt-Patch
ersetzt. Aktive und geladene Kampagnen-ID werden vor dem Session-Read geprüft.

Validierung: 105 Regressionstests einschließlich aller Architekturtests bestanden;
nach Kampagnenbindung 33 gezielte Tests einschließlich Renderer-Architektur erneut
bestanden. Abschließend 14 Owner-/Porttests nach der Test-Lintkorrektur bestanden,
einschließlich tatsächlichem Klick auf den GroupManagerView-Button mit realem
Controller/Runtime (Katalog und Dialograhmen im UI-Test reduziert). Read-Fehler,
fehlende Quittung, gescheiterter frischer Read, späterer Datenstand und beide
Kampagnenwechselvarianten geprüft. Genau ein Commit trotz mehrerer Abgleichsversuche.
Abschließender vollständiger Typecheck, gezieltes ESLint, Build/Built-Smoke
(ready/closed) und git diff --check bestanden. Logs unter
work/roadmap-phase4-group-reconciliation-*.log. Kein kanonischer Handoff.

Roadmapabgleich: Phase 4 bleibt offen. Der bestätigbare unbekannte Beutecommit ist
jetzt bedienbar abgleichbar. Dauerhaft fehlende Quittungen brauchen noch eine
verlässliche Abgrenzung zwischen nicht ausgeführtem und noch unklarem Auftrag.
Scene.saveGroup (insbesondere Neuanlage) besitzt weiterhin keine entsprechende
Receipt-ID; andere Unknown-Fälle wie Generierung/Archivieren/Combat sind zu prüfen
und bleiben derzeit konservativ gesperrt. Session Planner, übrige Writer-/Karten-
und Offline-/Updateabnahme sowie Phasen 5–7 bleiben erforderlich. Keine vollständige
Gruppen- oder Phase-4-Abnahme behauptet.

### Phase 4 — Bestätigbare normale Gruppen-Saves: Umsetzungsplan

Vorheriger Turn Fortschritt (732fd60bd), Worktree sauber. Normale scene.saveGroup-
Aufträge besitzen bisher keine persistierte Command-ID. Einen gruppeneigenen
SceneGroupCommandJournal einführen, dessen SQL beim Szenenverantwortlichen liegt.
Der IPC-Savevertrag erhält eine Command-ID; Save und Quittung werden atomar über
bestehenden LivePlayService/CampaignUnitOfWork gespeichert. Gleiches ID/Input-Paar
liefert das gespeicherte Ergebnis, geänderte Daten unter derselben ID einen Konflikt.
Ein rein lesender groupSaveReceipt-Pfad liefert die passende Quittung/null.
Interne Save-Aufrufe durch Beute bleiben im vorhandenen äußeren Beutejournal.

Das zusätzliche Journal benötigt eine echte Vorwärtsmigration: Kampagnenschema
34→35, Installation bleibt 39, Migrationsregistry 11→12. Bootstrap und Migration
verwenden denselben szeneneigenen Initializer. Bestehende eingefrorene Release-0.2-
Fixtures mit Schema 34 unverändert lassen; lediglich Tests aktueller Zielidentitäten
an neue Konstanten anpassen. Migration muss alte Inhalte erhalten und das Journal
auch nach Neustart lesbar machen. Keine Nutzerprofile migrieren.

Danach Renderer-Adapter mit einmaliger Command-ID und read-only Recovery versorgen,
analog Beute: verlorene Antwort abgleichen, frischen kampagnengebundenen Snapshot
lesen, Baseline quittieren und keine zweite Neuanlage. Tests: Neuanlage/Edit,
identischer Retry, ID-Konflikt, Transaktionsrollback einschließlich fehlgeschlagenem
Receipt-Write, read-only Quittungsread, Migration 34→35 und unveränderte Inhalte.
Typecheck, Lint, Migrations-/Wartungsregression, Build/Smoke und getrennte Audits.

Normale Gruppen-Saves — Validierung/Korrekturrunde: 500 Tests in 43 Dateien bestanden;
sechs Current-format-Suites scheitern bereits beim Laden am ausdrücklich auf Schema
34 festgelegten aktuellen Fixture-Manifest. Das ist ein aktiver vorläufiger
Qualifikationsauftrag (kein historischer Abnahmebeleg); auf Schema 35 und den neuen
Bootstrap-Owner scene-group-receipts erweitern. Diesen Owner als initialize-only
abgrenzen, da jene bestehenden Materialisierer weiterhin ihre direkten internen
Saves verwenden; der neue echte Receipt-Roundtrip wird separat geprüft. Eingefrorene
Release-0.2.0-Dateien und alte Ausführungsbelege bleiben unverändert. Danach die sechs
Suites erneut ausführen. Typecheck-Korrektur: den optionalen Adapter-Parameter
commandId ausdrücklich string typisieren, statt den engeren crypto.randomUUID-
Template-Literaltyp aus seinem Defaultwert abzuleiten.

Korrekturrunde Fixture-Vollständigkeit: 30 Tests bestehen, die Completion-Suite
weist den neuen Owner noch keinem Cohort zu. Den Root-Cohort um das initial leere
Scene-Quittungsjournal erweitern und dessen tatsächliche Zeilenzahl im unabhängigen
Readback vor/nach Kampagnenwechsel prüfen. Die Schema-Oracle auf 35 korrigieren;
keine historischen Run-Belege oder eingefrorenen Release-Fixtures ändern.

Korrekturrunde Versionsdokument: Der vollständige Typecheck und alle 34 Tests der
sieben betroffenen Fixture-Dateien bestehen. check:version-truth weist die noch
alte aktuelle Schema-/Registry-Tabelle zurück. Diese aus den ausführbaren
Registern neu erzeugen und den unveränderten Versionscheck erneut ausführen.

### Phase 4 — Normale Gruppen-Saves: Plan- und Roadmapabgleich

Planabgleich bestanden: Der Scene-eigene Journalvertrag speichert Save und Quittung
in derselben CampaignUnitOfWork. Gleiche ID mit gleichem Input liefert das
persistierte Ergebnis; abweichender Input wird abgewiesen. Receipt-Reads schreiben
nicht, auch unter query_only. Fehlgeschlagenes Receipt-Insert rollt Gruppe und
Revision zurück. Renderer hält dieselbe Auftrags-ID für den Abgleich, bestätigt
erst nach kampagnengebundenem frischem Read und erzeugt keine zweite Gruppe.
Bootstrap und echte Migration 34→35 verwenden denselben Scene-Initializer.

Validierung: zuvor 500 bestandene Tests in 43 Dateien (Integration, Architektur,
Wartungsregression); die sechs wegen des aktuellen Fixture-Manifests nicht geladenen
Suites bestehen nach Korrektur zusammen mit dessen Unit-Test: 34 Tests, 7 Dateien.
Die neue Root-Oracle liest die tatsächliche leere Receipt-Tabelle in beiden
Kampagnen. Eingefrorene 0.2.0-Fixtures unverändert; deren Migration erhält sämtliche
vorhandenen Tabelleninhalte, ergänzt das leere Journal und besteht integrity_check.
25 gezielte Tests hatten Renderer-Abgleich, Command-Runtime, Journal und Migration
bereits gemeinsam geprüft. Abschließend vollständiger Typecheck, ESLint aller
geänderten TypeScript-Dateien, Prettier dieser Dateien/JSON, check:version-truth,
Build, Built-Smoke (Utility ready/closed) und git diff --check bestanden.
Logs: work/roadmap-phase4-scene-receipt-*.log. Aktuell Installation 39,
Kampagne 35, Registry 12. Build/Smoke ist Entwicklungsevidenz, kein Handoff.

Roadmapabgleich: Phase 4 bleibt offen. Normale Gruppen-Saves besitzen jetzt ebenso
wie Beutecommits einen bestätigbaren unbekannten Ausgang. Die dauerhaft fehlende
Quittung braucht weiterhin einen verlässlichen, bedienbaren Abschluss; andere
Unknown-Fälle (Generierung/Archivieren/Combat), Session Planner, übrige Schreib-
und Kartenwege sowie Offline-/Update-UI bleiben zu bearbeiten. Phasen 5–7,
kanonischer Handoff, Livetest und Veröffentlichung sind weiterhin erforderlich.

### Phase 4 — Fehlende Gruppenquittung verbindlich auflösen: Umsetzungsplan

Vorheriger Goal-Turn Fortschritt: 07f8cf6b3 sauber gepusht. Aktueller Worktree sauber.
Die beiden Save-/Reward-Commit-Handler laufen synchron und atomar; Utility-Dispatch
führt den Handler vor Promise-Auflösung aus. Der Supervisor startet nach Timeout
keine Ersatz-Utility vor dem Exit der alten Generation. Ein erfolgreicher Read
nach dem unbekannten Auftrag kann daher dessen Abwesenheit bestätigen. Die Reads
müssen dazu serverseitig auf die ursprüngliche Kampagne beschränkt sein.

Die beiden Receipt-IPC-Inputs um die explizite Kampagnen-ID ergänzen; Utility weist
abweichende aktive Kampagnen vor dem Journalzugriff zurück. Renderer-Port bindet
sie an die beim Öffnen geladene Kampagne und prüft auch die aktuelle Projektion.
Nach erfolgreichem Receipt-Read (auch null) einen frischen kampagnengebundenen
Snapshot lesen. Nur vorhandene Quittungen bestätigen Draft-Baselines. Bei null
bleibt der lokale Entwurf erhalten, die Unknown-Sperre endet und eine Meldung nennt
Speichern oder Verwerfen als nächste Aktion. Save/Discard der Wartung dürfen nach
dieser bestätigten Abwesenheit fortfahren. Read-/Kampagnenfehler halten die Sperre.

Prüfen: beide Receipt-Verträge, Ablehnung anderer Kampagnen vor Domain-Zugriff,
bestätigt nicht gespeicherter normaler Save und Reward-Commit, keine Quittierung
des lokalen Entwurfs, kein Schreibaufruf beim Read-Abgleich/Verwerfen, bewusstes
erneutes Speichern, spätere persistierte Änderungen und fehlerhafter frischer Read.
Supervisor-/Dispatcherregression, Typecheck, Lint, Build/Smoke, getrennte Audits.

Korrekturrunde Testdaten: 60 Tests bestehen, zwei Testannahmen passen noch nicht.
Der neue native Reward-Read muss einen schema-validen Auftrag mit mindestens einem
Eintrag verwenden. Der bestehende UI-Test für gescheiterte Reads muss einen echten
Read-Fehler liefern; null ist jetzt bewusst bestätigte Abwesenheit. Diese Fälle
korrigieren, danach die unveränderte fachliche Erwartung erneut prüfen. ESLint
besteht bereits; Typecheck läuft noch.

Zusätzliche Beweisprüfung: 135 Regressionstests bestehen. Zwei neue Vertragstests
bestehen ebenfalls; der ergänzte Timeout-/Receipt-Test hängt nach seinen fachlichen
Assertions im Test-Cleanup, weil die Fake-Utility den Shutdown nicht beantwortet
und Fake-Timer nicht weiterlaufen. Im Cleanup den Exit der neuen Fake-Generation
explizit auslösen, damit der Test die tatsächliche Exit-Barriere isoliert prüft.

UI-Teilaudit/Korrektur: Bei bestätigter Abwesenheit eines Reward-Commits wurde
die Gruppenmeldung aktualisiert, die Beuteansicht zeigte jedoch noch den alten
Unknown-Fehler. Auch dort den bestätigten Nicht-Speichern-Status samt nächster
Aktion anzeigen und alte Issues ersetzen; keine Baseline oder Inhalte quittieren.
Diese sichtbare Konsistenz im vorhandenen Abwesenheitstest mitprüfen.

### Phase 4 — Fehlende Gruppenquittung: Plan- und Roadmapabgleich

Planabgleich bestanden: Beide Receipt-IPC-Verträge verlangen eine UUID der
ursprünglichen Kampagne; die Utility prüft diese vor dem Domain-Read. Renderer
bindet beide Quittungsreads und den anschließenden Session-Read an die geladene
Kampagne. Fehlende Quittung plus erfolgreicher frischer Read beendet Unknown,
bestätigt jedoch keine Draft-Baseline. Der Entwurf bleibt bearbeitbar; Save oder
Discard können bewusst fortfahren. Gruppen- und Beuteansicht zeigen konsistent,
dass der Auftrag nicht gespeichert wurde. Readfehler halten Unknown unverändert.

Die Abwesenheitsaussage gilt für diese beiden synchron atomaren Handler. Der
zusätzliche Supervisor-Test hält einen nach Timeout getöteten Writer künstlich
am Leben: kein Ersatzprozess nach 60 Sekunden, Receipt-Read abgewiesen, erst nach
Exit/neuer ready-Generation erfolgreich. Nicht auf asynchrone Hintergrundjobs
oder beliebige fehlende Journaleinträge verallgemeinert.

Validierung: 135 Tests in 12 Dateien einschließlich Architektur, Runtime/Owner,
Kampagnenbindung, nativer Save-/Reward-Quittungsreads und Supervisor bestanden.
Anschließend 35 Vertrags-/Supervisor-Tests mit expliziter Exit-Barriere bestanden.
Nach UI-Fehlertextkorrektur 16 Owner-/UI-Tests erneut bestanden. Vollständiger
Typecheck und ESLint bestanden; geänderte UI-/Testdateien anschließend erneut
lint-geprüft. Abschließendes Prettier, Build/Built-Smoke (ready/closed) und
git diff --check bestanden. Logs: work/roadmap-phase4-absent-receipts-*.log.
Kein Nutzerprofil verändert und kein kanonischer Handoff durchgeführt.

Roadmapabgleich: Die bisher offene dauerhafte Abwesenheit von Quittungen ist für
normale Gruppen-Saves und Reward-Commits bedienbar aufgelöst. Phase 4 bleibt offen:
Generierung, Archivieren/Combat, Session Planner, übrige Writer-/Kartenwege und
Offline-/Update-UI müssen noch vollständig qualifiziert werden. Phasen 5–7 und
exakter CI-Handoff/Main-Abschluss bleiben erforderlich.

### Phase 4 — Session-Planner-Wartungsowner: erster Umsetzungsabschnitt

Vorheriger Turn Fortschritt (43438551c), aktueller Worktree sauber. Der Planner
hat getrennte Owner für Entwurf, Sitzungsbefehle, Vorbereitung und Beute. Ein bloßes
whenIdle auf Einzeltransporten deckt mehrstufiges Save→Create/Prepare/Materialize
nicht ab. Einen lokalen Lebenszyklus für ganze Controller-Aktionen ergänzen und
alle schreibenden Benutzereinstiege darüber führen. Neue Eingaben werden während
Wartung sowie laufender Controller-Aufträge synchron blockiert. Unterhalb der
Hooks gestartete Receipt-/Load-Arbeit zusätzlich über den Coordinator drainen.

Den transitional Draft-Guard durch einen benannten Owner ersetzen: normale
Planentwürfe speichern über denselben saveDraft-Pfad wie die normale Oberfläche;
Verwerfen stellt den letzten bestätigten Workspace wieder her. Fehler behalten den
Entwurf und verhindern Wartung. Unknown-Fehler aus den beteiligten Command-Hooks
explizit an den Lebenszyklus melden, sodass kein blindes Verwerfen oder Speichern
folgt. Laufende Hintergrundvorbereitung/offene Unterdialoge zunächst ausdrücklich
als noch ungeklärte Zustände erkennen; diese dürfen die Wartung nicht passieren.
Deren vollständige Save-/Discard-Auflösung und Unknown-Recovery sind nachfolgende
Teile desselben Phase-4-Owners, keine abgeschlossene Planner-Abnahme.

Prüfen: realer Workspace-/Session-Command-Hook mit zentralem Owner, Speichern,
Verwerfen, Speicherfehler, Abbrechen/Entsperren, sofortige Eingabesperre, laufender
mehrstufiger Auftrag, unbekannter Ausgang und offene Unterdialoge. Bestehende
Planner-Command-/Preparation- und Architekturtests, Typecheck/Lint, Build/Smoke.

Planner-Teilaudit/Korrektur vor Abschluss: 86 Tests und Typecheck bestehen. Die
Vorbereitung kann nach einer lokalen Intent-Änderung ihren aktiven UI-Target
verlieren, obwohl der persistierte Auftrag weiterläuft. Umgekehrt kann ein alter
Workspace noch queued zeigen, nachdem die Cancel-Quittung terminal war. Für die
Wartungsprüfung deshalb die beobachteten nichtterminalen Operation-IDs getrennt
vom UI-Target halten und nur mit terminaler Quittung entfernen. Initiale noch nicht
übernommene Workspace-Quittungen ebenfalls erkennen. Diese Fälle im vorhandenen
Vorbereitungs-Hook testen; vollständige automatische Klärung bleibt Folgearbeit.

Planner-Validierung/Korrektur: 87 Tests bestehen. Der neue Cancel-Test konnte seine
Antwort nicht injizieren, weil der bestehende Testhelfer diesen Override noch
nicht unterstützt; dessen Signatur/Implementierung ergänzen. Typecheck beanstandet
zusätzlich einen absichtlich reduzierten Test-Port, dessen Cast ausdrücklich über
unknown erfolgen muss. Lint-Korrekturen: Callback-Optionen als Funktionswerte statt
ungebundene Methoden deklarieren, die neue stabile Dialog-Setter-Abhängigkeit
aufnehmen und den Fehlertext ohne unsichere verschachtelte Matcher-Zuweisung prüfen.

### Phase 4 — Session Planner: erster Owner-Abschnitt, getrennte Audits

Planabgleich dieses Abschnitts bestanden: Der normale Sitzungsplan verwendet den
vorhandenen Session-Command-Save auch in der zentralen Wartung. Verwerfen ersetzt
nur den lokalen Entwurf durch den bestätigten Workspace. Der Lebenszyklus hält
ganze Benutzeraktionen einschließlich ihrer Fortsetzungen; währenddessen sowie
bei Wartung sind die öffentlichen Eingabe-/Command-Einstiege synchron blockiert.
Die Workspace-Oberfläche ist zusätzlich inert. Ungebremste interne Fortsetzungen
können einen zuvor begonnenen Auftrag abschließen, bevor der Owner weiterarbeitet.
Dialog-Getter erfassen neu geöffnete Dialoge synchron vor einem React-Commit.
Unknown-Fehler aus Session-/Preparation-/Reward-Hooks verhindern erneute Writes
und Verwerfen. Beobachtete nichtterminale Vorbereitungen bleiben unabhängig vom
aktiven UI-Target als offen erfasst; eine terminale Quittung entfernt sie.

Validierung: 88 Tests in 9 Dateien bestanden, einschließlich aller Architekturtests,
realer Workspace-/Session-Command-Hooks mit Wartungsowner, Save, Discard, Fehler,
Abbrechen/Entsperren, unbekanntem Ausgang, sofortiger Eingabesperre, bereits laufendem
Save und Dialogöffnung am Ende einer mehrstufigen Aktion. Preparation-Hook deckt
stale UI-Target und bestätigten Cancel ab. Vollständiger Typecheck, gezieltes ESLint
aller geänderten/neuen TypeScript-Dateien, Prettier, Build, Built-Smoke (Utility
ready/closed) und git diff --check bestanden. Logs: work/roadmap-phase4-planner-*.log.
Keine Nutzerinstallation verändert; kein kanonischer Handoff.

Roadmapabgleich: Phase 4 und der vollständige Planner-Owner bleiben offen. Normale
Planentwürfe sind jetzt auflösbar. Namens-/Bestätigungs-/Beute-Unterdialoge werden
bis zu ihrer eigenen Auflösung ausdrücklich zurückgewiesen. Hintergrundvorbereitung
muss noch im zentralen Ablauf abgeschlossen/abgebrochen werden; insbesondere vom
UI-Target getrennte Aufträge benötigen eigene Receipt-Klärung. Unknown-Recovery für
Planner-Befehle ist noch nicht bedienbar und darf nicht als abgeschlossen gelten.
Weitere Gruppenbefehle (Generierung/Archivieren/Combat), übrige Writer-/Kartenwege,
Offline-/Update-UI, Phasen 5–7 und exakter CI-Handoff/Main-Abschluss bleiben offen.

### Phase 4 — Hintergrundvorbereitung in Wartung abschließen: Umsetzungsplan

Vorheriger Turn Fortschritt (3f756795b), Worktree sauber. Persistierte Vorbereitung
hat bereits idempotenten Abbruch: vor saving sofort canceled, in saving lediglich
cancel_requested bis zur abschließenden Quittung. Die neue Wartungsauflösung darf
daher eine Cancel-Antwort nicht pauschal als Abschluss behandeln.

Eine kampagnengebundene Statusoperation in der Utility liefert bekannte Quittungen,
alle weiteren recoverable Operationen und den gleichzeitig gelesenen Planner-
Workspace. Sie verwendet SessionPreparationStore.recoverable/read; kein neues SQL
außerhalb des bestehenden Owners. Ein ebenso kampagnengebundener Cancel-Adapter
nutzt die bestehende Abbruchimplementierung. Renderer bindet beide Fähigkeiten an
die beim Öffnen geladene Kampagne und lehnt Projektionswechsel vor dem Transport ab.

Wartungs-Save wartet auf terminale Quittungen; Discard fordert für nichtterminale
Aufträge Abbruch an und wartet auch bei saving weiter. Begrenzte Polls verhindern
ein Hängen bei nicht fortschreitenden Aufträgen. Read-/Cancel-Fehler halten Wartung
an; ein neuer Versuch liest wieder den tatsächlichen Zustand. Bekannte und vom
UI-Target getrennte Aufträge sowie weitere aktive Sitzungen werden erfasst.
Offene Ersetzungsbestätigung wird bei Discard nur geschlossen, bei Save weiterhin
zur ausdrücklichen Entscheidung zurückgewiesen.

Nach Abschluss gilt der frische Workspace: saubere Entwürfe dürfen aktualisiert,
Discard darf lokale Änderungen verwerfen. Bei Save und zwischenzeitlich geänderter
Sitzungsrevision bleibt ein lokaler Entwurf unverändert und meldet Konflikt statt
generierte oder spätere Inhalte zu überschreiben. Unbekannte andere Planner-
Befehle und offene Namens-/Beutedialoge bleiben Folgearbeit in Phase 4.

Prüfen: mehrere/detachierte Aufträge, bereits terminale/fehlende Quittungen, Save
wartet ohne Cancel, Discard wartet durch saving, Timeout/Readfehler, Camp-Bindung,
frischer Stand und Draft-Konflikt. Native Status/Cancel mit realem Journal und
kontrolliertem Worker; bestehende Planner-/Wartungs-/Architekturregression,
Typecheck, Lint, Build/Smoke und getrennte Audits.

Implementierungspräzisierung: Der zentrale Owner wird nur für offene Arbeit
aufgelöst. Deshalb genügt die Statusabfrage innerhalb von settle nicht, wenn nur
in einer anderen Sitzung ein Hintergrundauftrag läuft. Beim Öffnen des Planners
eine koordinierte kampagnengebundene Bestandsabfrage ergänzen; bis zu erfolgreicher
Abfrage bleibt der Status ungeklärt. Alle Vorbereitungsnotices erfassen Operation-
IDs, auch ohne aktiven UI-Target; ausschließlich Statusquittungen schließen sie ab.

Korrekturrunde Typecheck: Der Terminal-Observer muss receipt ausdrücklich auf
Nicht-null prüfen. Zwei optionale Session-IDs könnten beide undefined sein; ein
bloßer Gleichheitsvergleich beweist keine vorhandene Quittung. Guard korrigieren,
bevor Status/Fehltext der Quittung gelesen werden.

Korrekturrunde Testverträge: 119 Tests bestehen. Typecheck/Lint beanstanden die
unvalidierten unknown-Rückgaben des nativen Composition-Tests. Diese wie im echten
Dispatcher durch die jeweiligen Output-Schemas prüfen, bevor Eigenschaften gelesen
werden. Der optionale Settlement-Callback im Owner-Test darf bei exactOptional-
PropertyTypes nur dann im Optionsobjekt stehen, wenn er vorhanden ist. Produktcode
besteht diese Prüfungen bereits; Testadapter entsprechend korrigieren.

Korrekturrunde Transport-/Mengengrenze: Die Kampagnenbindung auch nach Rückkehr der
Transportantwort prüfen; ein Wechsel während des Reads darf keinen alten Workspace
publizieren. Den neu eingeführten Maximalwert 1000 für bekannte Operation-IDs
entfernen: der Status liefert alle recoverable Aufträge, deren Folgeabfrage sonst
bei größeren Beständen scheitern könnte. Die bestehende Profilzusage erhält keine
solche zusätzliche Mengenbegrenzung.

### Phase 4 — Vorbereitungsabschluss: Plan- und Roadmapabgleich

Planabgleich bestanden: Eine kampagnengebundene Utility-Statusoperation liest
bekannte Operation-IDs, weitere recoverable Aufträge aller Sitzungen und denselben
aktuellen Workspace. Bestehende Journalmethoden bleiben SQL-Verantwortliche.
Die zweite kampagnengebundene Fähigkeit nutzt den bestehenden idempotenten Abbruch.
Vor und nach den Renderer-Transporten wird die ursprüngliche Kampagne geprüft;
die Utility weist abweichende aktive Kampagnen vor Domain-Zugriff zurück.

Der Planner entdeckt offene Aufträge beim Öffnen und erfasst Notices auch ohne
aktiven UI-Target. Fehlgeschlagene Discovery bleibt ungeklärt. Save wartet auf
terminale Quittungen, Discard fordert Abbruch an und wartet bei saving weiter.
Ein späterer Versuch liest nach Fehler/Timeout erneut den tatsächlichen Stand.
Fehlende bekannte IDs müssen ausdrücklich receipt:null liefern; eine unvollständige
Antwort kann keine Auflösung behaupten. Ersetzungsbestätigung wird bei Save nicht
implizit erteilt; Discard schließt sie ohne Cancel eines nicht existenten Auftrags.

Der frische Stand bleibt bei sauberem Entwurf/Discard maßgeblich. Bei lokalem
Entwurf und geänderter gespeicherter Sitzungsrevision verhindert Save die
Überschreibung und behält den Entwurf. Native Prüfung mit zwei Sitzungen bestätigt
Discovery beider queued-Aufträge unter query_only, Camp-Ablehnung, idempotenten
Abbruch, unveränderte erste Sitzung und Erhalt des fertig vorbereiteten Ergebnisses
bei erneutem Cancel. Keine zusätzlichen Schema- oder Datenmigrationen nötig.

Validierung: 119 Tests in 12 Dateien einschließlich Architektur bestanden; nach
Validierung der Composition-Testoutputs 26 native/Owner-Tests erneut bestanden.
Nach Nachprüfung der Kampagnenbindung 18 Port-/Settlement-/Preparation-Tests
bestanden, einschließlich Wechsel während der Antwort. Abschließend vollständiger
Typecheck, ESLint aller geänderten/neuen TypeScript-Dateien, Prettier, Build,
Built-Smoke (ready/closed) und git diff --check bestanden. Logs unter
work/roadmap-phase4-planner-settle-*.log. Kein Nutzerprofil/keine Installation
verändert; kein kanonischer Handoff.

Roadmapabgleich: Der normale Vorbereitungsabschluss ist jetzt Teil der zentralen
Wartung. Phase 4 bleibt offen: Unknown-Ausgänge normaler Planner-Aufträge
(einschließlich außerhalb der Wartung unterbrochener Start-/Cancel-Aufträge),
Namens-/Beute-Unterdialoge und die vollständige bedienbare Konfliktklärung sind
noch zu bearbeiten. Weitere Gruppenbefehle, übrige Writer-/Kartenwege, Offline- und
Update-UI-Abnahme sowie Phasen 5–7 und exakter CI-Handoff/Main-Abschluss bleiben
verpflichtend. Keine vollständige Planner- oder Phase-4-Abnahme behauptet.

### Phase 4 — Unbekannte Vorbereitungsantworten abgleichen: Umsetzungsplan

Vorheriger Turn Fortschritt (b5147f9e1), Worktree sauber. Start besitzt bereits eine
stabile operationId; Cancel wirkt idempotent auf deren persistierte Quittung. Die
Runtime hält für outcome_unknown zusätzlich einen konkreten read-only Abgleich.
Vorbereitung übergibt den Abgleich mit ursprünglicher ID und Sitzungszuordnung,
auch wenn der UI-Target nach dem Fehler gelöscht wird. Normale Planner-Befehle ohne
solchen Nachweis bleiben unverändert ungeklärt.

Der Abgleich nutzt ausschließlich die kampagnengebundene Statusoperation und deren
frischen Workspace. Fehlende angeforderte Antwortzeile oder unpassende Sitzung ist
ein Fehler. Explizit null bei einem unbekannten Start bestätigt Nichtausführung;
bei Cancel fehlt dann dagegen die vorausgesetzte Quittung und die Sperre bleibt.
Ein vorhandener nichtterminaler Auftrag wird wieder als aktiver Target beobachtet,
terminaler Status wird übernommen. Keine Wiederholung von Start/Cancel im Abgleich.
Saubere Entwürfe dürfen den frischen Workspace übernehmen, lokale Änderungen bleiben
bei der bestehenden Konfliktregel erhalten. Readfehler halten den Abgleich bereit.

Automatische Wartungsklärung versucht denselben Read vor der eigentlichen
Vorbereitungsauflösung. Nach Wartungsabbruch erhält der Planner einen sichtbaren
Read-Retry außerhalb der gesperrten Editorfläche; keine normalen Aktionen während
Unknown oder Read. Bekannte nicht ausgeführte Starts können danach bewusst neu
angefordert werden. Nicht ausgeführter Abbruch wird verständlich angezeigt.

Prüfen: verlorene Start-/Cancel-Antwort, read failure/retry, laufender/terminaler
Auftrag, explizite Abwesenheit, fehlende Zeile, abweichende Sitzung, kein zweiter
Write, frischer gespeicherter Stand, Draft-Erhalt und realer Retry-Button. Bestehende
Planner-/Wartungs-/Architekturregression, Typecheck, Lint, Build/Smoke und Audits.

Korrekturrunde Sprachvertrag: Typecheck weist die neuen Planner-Texte zurück, weil
sie in der allgemeinen Session-Datei gesucht wurden. Die Planner-Schlüssel liegen
in session-planner-messages.de.ts. Neue Meldungen dort am tatsächlichen Owner
ergänzen; keine Ausweitung des Message-Typs und keine hart codierten UI-Ersatztexte.

Korrekturrunde Tests/Layout: 99 Tests bestehen. Zwei Fehlermatcher müssen die
zusammengeschriebene deutsche Meldung „Vorbereitungsquittung fehlt“ korrekt prüfen.
Die sichtbare Recovery-Notiz benötigt zudem einen gemeinsamen vertikalen Wrapper
mit dem gesperrten Planner: Der übergeordnete Cockpit-Bereich ist eine horizontale
Flexfläche und würde beide bisherigen Fragment-Kinder nebeneinander anordnen.
Wrapper/Notiz mit bestehenden Layout-Tokens gestalten; Editor bleibt separat inert.

### Phase 4 — Vorbereitungs-Recovery: Plan- und Roadmapabgleich

Planabgleich bestanden: Die Planner-Runtime hält bei unbekanntem Ausgang den
konkreten Read-Callback. Sie führt ihn bei Wartungs-Drain oder über den sichtbaren
Retry aus und löscht ihn erst nach erfolgreicher Klärung. Ein neuerer Callback
kann nicht durch eine ältere Abgleichsantwort entfernt werden. Start/Cancel
übergeben ursprüngliche Operation-ID und Sitzung; kein zweiter Schreibauftrag
wird durch den Abgleich ausgelöst.

Die bestehende kampagnengebundene Statusabfrage liefert Quittung und frischen
Workspace. Fehlende Antwortzeile, unpassende Sitzung und fehlende Cancel-Quittung
bleiben Fehler. Explizit fehlender Start wird als nicht ausgeführt erklärt;
vorhandener laufender Auftrag wird wieder beobachtet. Nicht ausgeführter Cancel
wird als solcher angezeigt. Saubere Entwürfe übernehmen den frischen Stand;
lokale Änderungen bleiben erhalten. Readfehler erhalten Unknown und Retry.

Die Recovery-Notiz steht in einer vertikalen Planner-Hülle außerhalb des inert
Editors. Der Button ist während Read oder Wartung deaktiviert. Die bestehende
Wartungsklärung kann denselben Read automatisch vor dem Vorbereitungsabschluss
verwenden. Namens-/Sitzungs-/Beute-Befehle ohne Quittungsabgleich bleiben gesperrt.

Validierung: 101 Tests in 10 Dateien einschließlich Architektur, realem Preparation-
Hook mit Runtime, unbekanntem Start (queued/succeeded/absent), unbekanntem Cancel
(queued/canceled/missing), Readfehler/Retry, fremder/fehlender Quittung, Draft-Erhalt
und tatsächlichem Klick auf den Recovery-Button bestanden. Der UI-Test prüft den
Button mit realer Runtime-Subscription einschließlich Sperre gegen Doppelklick;
kein vollständiger gerenderter Planner-Livetest behauptet. Vollständiger Typecheck,
ESLint aller geänderten/neuen TypeScript-Dateien, Prettier, Build/Built-Smoke
(ready/closed) und git diff --check bestanden. Logs: work/roadmap-phase4-planner-
reconcile-*.log. Kein Nutzerprofil verändert; kein kanonischer Handoff.

Roadmapabgleich: Vorbereitung besitzt nun auch nach verlorenen Start-/Cancel-
Antworten einen bedienbaren Abgleich. Phase 4 bleibt offen: normale Planner-
Sitzungsbefehle und deren Unknown-Recovery, Namens-/Beute-Unterdialoge, vollständige
Konfliktklärung, andere Gruppenbefehle, übrige Writer-/Kartenwege und Offline-/
Update-UI-Abnahme. Phasen 5–7 sowie exakter CI-Handoff und Main-Abschluss bleiben
verpflichtend. Keine vollständige Planner- oder Release-Abnahme behauptet.

### Phase 4 — Korrekturplan: Main-Integration und CI-Freigängigkeit

Aktueller Kandidat d482274bf ist sauber, aber PR 661 ist laut GitHub
CONFLICTING; es gibt keine Checks für diesen SHA. Main steht nach Fetch auf
63b427900 und bringt Kampagnenoberfläche, Szenendesktop, Charakterkatalog
sowie Installationsmigrationen bis 41 mit. Der letzte ältere Check auf
732fd60bd scheiterte an Prettier (location-maintenance-draft.test.tsx) und
mehr als 16 KiB Bundlewachstum. Kein grüner aktueller CI-Stand behauptet.

Plan: Main in den Kandidaten integrieren, beide fachlichen Änderungen erhalten.
Installationsschema 41 und Kampagnenschema 35 gemeinsam führen; Registry-Version
für die vereinigte Migrationsmenge fortschreiben, erzeugte Versionsdokumentation
und aktuelle Formatverträge entsprechend prüfen. Historische Fixtures bleiben
unverändert. Konflikte fachlich auflösen, besonders atomare Gruppenquittungen
und neue Kampf-/Reiseregeln. Danach Formatierung, Typen, Migrationen und relevante
Integrationstests prüfen. Aktuellen Bundlegraph messen, Wachstum den tatsächlichen
Änderungen zuordnen und nur mit dokumentierter Begründung den vorgesehenen
Baseline-Mechanismus verwenden; keine Budgetgrenzen abschwächen. Neue Writer
aus Main in die weiterhin offene Phase-4-Abnahme aufnehmen. Erst nach Prüfungen
committen/pushen und exakte CI-Auslösung kontrollieren. Plan- und Roadmapaudit
separat dokumentieren; kein Handoff oder Main-Push ohne vollständige Gates.

Korrekturergänzung vor Teständerung: Die gemeinsame Migration 39/34 nach 41/35
braucht einen expliziten Erhaltungsnachweis für die alten Installationstabellen,
nicht nur einen Theme-Lesetest. Im eingefrorenen 0.2.0-Profil zusätzlich sämtliche
bestehenden Installationszeilen vergleichen (neue Metadaten separat), die neue
nullable last_opened_at-Spalte und die leere scene_desktop-Tabelle prüfen. Keine
Änderung an den eingefrorenen Daten. Vollständige portable Prüfung zuvor grün.

### Phase 4 — Main-Integration: Plan- und Roadmapabgleich

Planabgleich bestanden für die lokale Integration: Main 63b427900 ist ohne
Verlust der Roadmap-Änderungen zusammengeführt. Die unabhängigen Datenrollen
stehen auf Installation 41 / Kampagne 35, Registry 14; Vorwärtsketten und
Versionsdokumentation stimmen überein. Gruppenquittungen und die neuen
Kampf-/Reise-Invarianten bleiben im gemeinsamen LivePlayService erhalten.
Die eingefrorenen 0.2.0-Fixtures sind unverändert. Der erweiterte Migrationstest
vergleicht alle bisherigen Installationstabellen ohne Migrationsmetadaten und
alle bisherigen Kampagnentabellen; neue last_opened_at-Werte sind null,
scene_desktop und Gruppenquittungen sind leer. SQLite-Integrität und fachliches
Readback bestehen.

Validierung: check:portable:fast vollständig bestanden (91 Architekturtests,
1127 portable Unit-Tests, 312 Integrationstests sowie Format/Lint/Typecheck und
Referenz-/Generator-/Versions-/Renderartefakt-Gates). Nach der Ergänzung des
Erhaltungsnachweises 23 Tests in release-baseline, persistence-preflight und
scene-desktop-store, gezielter ESLint und vollständiger Typecheck bestanden.
Build und Built-Smoke melden ready/closed. Bundlegraph gegenüber Main:
reachable +33295 Bytes, shell +423, workspace +4715, catalog +3763, hex +2791,
session +164. Keine Abhängigkeits-/Lockfileänderung gegenüber Main. Manifest
bestätigt dynamische Grenzen für Planner, Gruppen, Updates, Charakterkatalog,
Szenendesktop und Pixi. Baseline über das vorgesehene Skript mit konkreter
Begründung aktualisiert; absolute Grenzen und 16-KiB-Wachstumsgate unverändert.
Bundle-Gate danach bestanden, reachable 1628220 Bytes von 3019898. Logs:
work/roadmap-phase4-main-*.log. Kein Nutzerprofil oder installierte App verändert.

Roadmapabgleich: Phase 4 bleibt offen. Zusätzlich zu den bisherigen offenen
Planner-/Gruppen-/Karten-/Updatewegen benötigen CharacterCatalogSection,
CampaignScreen und die verzögerten DesktopProjection-Schreibvorgänge die
Wartungsanbindung und Abnahme. Die neue installationseigene scene_desktop-
Tabelle ist auch in der vollständigen Profil-/Recovery-Qualifikation fachlich
zu berücksichtigen; ein generischer SQLite-Backup allein beweist diese
Lesbarkeit nicht. Phasen 5–7 bleiben offen. Lokale Gates ersetzen weder
exakte Remote-CI noch kanonischen Handoff, Main-Grün oder Release-Abnahme.

### Phase 4 — Plan: Planner-Namensdialoge zentral klären

Ausgangslage: Kandidat 97d8377b8 ist sauber, exakter Check 34259911264 läuft.
Planner-Namens- und Löschbestätigungsdialoge werden bisher nur als pauschaler
Blocker behandelt. Umsetzung im bestehenden Sitzungs-Owner: Dialogzustand und
Namenseingabe synchron lesen, ursprüngliche Sitzung beim Öffnen binden.
Nach Drain und Vorbereitung zunächst den aktuellen Sitzungsentwurf klären, dann
bei Speichern einen offenen Create-/Rename-Dialog über den bestehenden Befehl
abschließen. Kein Zurückspielen des vor diesem Befehl gelesenen Workspace.
Fehlender Name oder Speicherfehler erhalten Dialog und Wartungssperre.
Bestätigte erste Speicherung bleibt bei fehlgeschlagenem zweiten Befehl erhalten;
Retry darf diese erste Speicherung nicht wiederholen. Ein zwischenzeitlicher
Sitzungswechsel darf keinen Namensbefehl auf das falsche Ziel umleiten.
Verwerfen schließt lokale Dialoge ohne Create/Rename/Delete. Unbestätigte
Löschanfragen werden bei beiden Wartungsentscheidungen geschlossen; generisches
Speichern bestätigt keine Löschung. Abbrechen der Wartung lässt Dialoge erhalten.

Prüfen mit realen Workspace-/Sitzungs-/Wartungshooks: Create und Rename,
leerer Name, teilweiser Erfolg/Retry, Verwerfen, Löschbestätigung ohne Delete,
sofortige Ref-Sichtbarkeit, verspätet geöffneter Dialog nach laufendem Befehl,
Zielwechsel und Erhalt des neuen Workspace. Unknown-Befehle bleiben bis zum
separaten Quittungsabgleich blockiert; keine Write-Wiederholung bei Unknown.
Relevante Planner-/Wartungs-/Architekturtests, Typecheck, Lint, Build/Smoke.
Danach separater Plan-/Roadmapabgleich. Beute-Unterdialoge bleiben eigenes
Arbeitspaket; vollständige Phase-4-Abnahme weiterhin erforderlich.

### Phase 4 — Planner-Namensdialoge: Plan- und Roadmapabgleich

Planabgleich bestanden: Namensinhalt und Dialogidentität sind synchron lesbar.
Der Dialog bindet die beim Öffnen ausgewählte Sitzung; Session-Antworten prüfen
zusätzlich die aktuelle Sitzungsidentität vor Veröffentlichung. Die Wartung
wartet bestehende Aktionen/Vorbereitungen ab, klärt den Sitzungsentwurf und
führt anschließend Create/Rename über den normalen Sitzungsbefehl aus.
Ein alter Vorbereitungs-Workspace wird danach nicht erneut angewandt.
Speicherfehler oder leerer Name erhalten den Dialog. Bestätigte Draft-Speicherung
bleibt bei fehlgeschlagenem Rename erhalten; Retry führt nur Rename erneut aus.

Verwerfen schließt die lokalen Namens- und Löschbestätigungsdialoge ohne
Create/Rename/Delete. Speichern bestätigt ebenfalls keine Löschung. Abbruch
der Wartung bewahrt Dialog und Eingabe. Nach einem verlorenen Rename-Ausgang
verhindert die bestehende Unknown-Sperre sowohl Retry als auch Verwerfen.
Verspätet von einer laufenden Aktion geöffnete Dialoge werden nach Drain
gesehen und können verworfen werden.

Validierung: 128 Tests in 10 Dateien einschließlich Architektur, Planner-
Sitzungsbefehlen, Vorbereitung und zentraler Wartung bestanden. Der reale
Workspace-/Sitzungs-/Wartungshook-Verbund prüft Create/Rename nach Draft-Save,
Teilerfolg/Retry, leeren Namen, Verwerfen, unbestätigte Löschung, Abbruch,
sofortigen Dialogzustand, Sitzungswechsel und Unknown ohne zweiten Write.
Nach expliziter Einbeziehung eines frischen Vorbereitungs-Workspace in den
Create-/Rename-Test bestehen die 19 Owner-Tests erneut. Typecheck, gezielter
ESLint, Prettier, Build/Built-Smoke (ready/closed), Bundle-Gate und diff --check
bestanden. Logs: work/roadmap-phase4-planner-dialog-*.log. Keine neue
Schema-/Abhängigkeits-/Baselineänderung, kein Nutzerprofil verändert.

Roadmapabgleich: Der zentrale Owner kann die Planner-Namensdialoge nun
auflösen. Dies ist keine vollständige Planner-/UI-/Release-Abnahme: allgemeine
Session-Unknown-Recovery, Beute-Unterdialoge, Konfliktklärung, übrige
Gruppen-/Karten-/Writerwege einschließlich neuem Charakterkatalog und
Szenendesktop sowie Offline-/Update-UI-Abnahme bleiben offen. Phase 4 bleibt
in Arbeit, Phasen 5–7 offen. Check 34259911264 für den Vorgänger 97d8377b8
war zuletzt weiterhin aktiv und ohne fehlgeschlagenen abgeschlossenen Job;
kein vollständiges CI-Grün oder kanonischer Handoff behauptet.

### Phase 4 — Plan: Szenendesktop-Speicherung vor Wartung klären

DesktopProjection lebt über Ansichtswechsel hinweg und hält 200-ms-Timer sowie
serialisierte Schreibvorgänge. Ein Hook-Owner nur für die sichtbare Szene würde
die offenen Änderungen einer verlassenen Szene verlieren. Deshalb registriert
sich die Projektion bei erster Änderung selbst und gibt die Registrierung erst
nach bestätigter Speicherung oder bestätigtem Verwerfen frei. Keine statische
Abhängigkeit des CapabilityProviders vom nachgeladenen Desktop.

Wartungssperre hält Timer und weitere Writes zwischen zwei laufenden Befehlen
an; Eingaben/Reload dürfen die Klärung nicht umgehen. Save wartet den aktiven
Write ab und schreibt verbliebenen Intent bewusst. Discard wartet ebenfalls,
liest den tatsächlich aktuellen Stand und verwirft nur den lokalen Rest.
Abbruch der Wartung setzt die normale Autospeicherung fort. Fehler erhalten
Intent/Owner. Verlorene Antwort: zuerst ursprünglichen Scope erneut lesen.
Identischer gespeicherter Stand bestätigt den Write; unveränderte Revision und
unveränderter vorheriger Stand erlauben ausdrücklich ausgelösten Retry.
Anderer/neuerer Stand verhindert Überschreiben und bietet Verwerfen/Reload;
fehlgeschlagener Read hält die Klärung offen.

Tests mit realem Wartungskoordinator und Projektion: Timer ohne Subscriber,
Save/Discard, bestehender Write plus nachfolgender Intent, keine Writes während
Klärung vor Entscheidung, Abbruch, unbekannter Ausgang/Read-Retry, Konflikt,
mehrere Szenen und Ende der Registrierung nach Erfolg. Regression der bisherigen
Desktopprojektion sowie Architektur, Typecheck, Lint und Build/Smoke prüfen.
Dies ersetzt nicht die ausstehende Charakter-/Planner-/Karten-/Updateabnahme.

Korrekturrunde vor Abschluss: Beim Audit des asynchronen Reloads kann ein
Wartungsabbruch die Autospeicherung wieder anstoßen, während dessen Read noch
läuft. Persist muss daher auch recoveryRequest als Sperre behandeln. Ein
gezielter Test hält den Reload-Read offen, beginnt/beendet Wartung und versucht
neue Eingaben; bis zum bestätigten Read dürfen keine Writes entstehen.

### Phase 4 — Szenendesktop: Plan- und Roadmapabgleich

Planabgleich bestanden: Die langlebige DesktopProjection registriert offene
Änderungen unabhängig von ihren React-Subscribern. Der Owner bleibt bei Timer,
Write, fehlgeschlagenem Write und Recovery erhalten und wird nach bestätigtem
Abschluss entfernt. Die gemeinsame Sperre hält Timer an, verhindert neue
Eingaben/Reloads und stoppt automatische Folge-Writes zwischen zwei Aufträgen.
Save wartet laufende Writes ab und sichert den restlichen Intent; Discard
wartet ebenfalls und liest den aktuellen gespeicherten Stand. Wartungsabbruch
setzt Autosave fort. Kein vor der Wartung bestätigter Stand wird zurückgesetzt.

Verlorene Antworten werden über Read im ursprünglichen Scope geklärt. Ein
identischer Stand bestätigt den Write ohne Wiederholung; nur unveränderte
Revision plus unveränderter vorheriger Stand erlauben einen ausdrücklichen
Save-Retry. Konflikte bleiben bei Save offen. Discard/Reload übernehmen nach
erfolgreichem Read den frischen Stand; Readfehler erhalten den lokalen Rest.
Auch ein laufender Recovery-Read blockiert Autosave nach Wartungsabbruch.

Validierung: 109 Tests in 10 Dateien einschließlich bestehender Desktop-
Projektion/Lifecycle, Wartungskoordinator und Architektur bestanden. Neue Tests
prüfen Timer ohne Subscriber, mehrere Szenen, Save/Discard, bestehenden Write
mit Folge-Intent, unmittelbare Eingabesperre, Abbruch, verlorene bestätigte
Antwort ohne Replay, expliziten Retry nach unverändertem Stand, Konflikt und
Readfehler sowie den verzögerten Recovery-Read. Typecheck, gezielter ESLint,
Prettier, Build/Built-Smoke (ready/closed), Bundle-Gate und diff --check
bestanden. Logs: work/roadmap-phase4-desktop-maintenance-*.log. Keine Änderung
an Datenformat, Abhängigkeiten oder Bundlebaseline; kein Nutzerprofil verändert.

Roadmapabgleich: Die verzögerten Desktop-Writes sind an die gemeinsame Wartung
angebunden. Die vollständige Phase-4-Abnahme bleibt offen: Planner-Unknown-
Recovery, Beute-Unterdialoge, Charakter-/Kampagneneditoren, weitere Gruppen-/
Karten-/Writerwege und Offline-/Updateoberfläche. Fachliches Profilreadback
für die neue Desktop-Tabelle sowie vollständige Artefakt-/Releaseprüfungen
bleiben ausdrücklich ausstehend. Phasen 5–7 sind offen. Der Vorgänger-Check
34260605418 lief beim letzten Abruf ohne abgeschlossenen Fehler weiter; dies
ist kein vollständiges CI-Grün. Kein kanonischer Handoff/Main-Push/Release.

### Phase 4 — Plan: Charakterprofil und Katalogwartung

Charakterkatalog e3b0cec15 ist sauber; Check 34261446658 ist noch pending.
CharacterProfileForm besitzt lokale Eingaben, aber fire-and-forget Save.
Der Katalog wartet die nachgelagerte Session-Aktualisierung bisher nicht ab.
Ein gemeinsamer Katalog-Owner soll offene Formulare, Löschbestätigung und den
vollständigen aktiven Mutationsvorgang erfassen. Das Formular registriert
seine validierende Save-Funktion beim Katalog, ohne einen zweiten Owner mit
eigenständiger Auflösungsreihenfolge einzuführen. Eingaben werden synchron
gelesen; Speichern liefert erst nach bestätigtem Erfolg true.

Katalogmutationen halten ein Promise über Write, Veröffentlichung, Refresh und
Accept. Wartung wartet es vor Save/Discard ab. Unbekannte Write-Ausgänge werden
festgehalten und verhindern blindes Wiederholen oder Verwerfen; deren konkrete
Quittungs-Recovery bleibt ein ausdrücklich offenes Folgepaket. Bestätigte
Writes dürfen bei anschließendem Refresh-Fehler nicht erneut ausgeführt werden.
Verwerfen schließt nur ungespeicherte Formulare/unbestätigte Löschanfragen.
Eingaben, Navigation und neue Mutationen werden während Wartung synchron
gesperrt; generisches Speichern führt keine unbestätigte Löschung aus.

Prüfen mit gerendertem Katalog und echter Wartungskoordination: Create/Update,
Validierung, Erhalt bei Fehler, Save/Discard/Abbruch, laufender Write plus
Refresh, keine zweite Mutation nach bestätigtem Write, Unknown-Sperre und
sofortige Eingabesperre. Bestehende Charakter-/Desktop- und Architekturtests,
Typecheck/Lint/Build/Smoke; danach getrennter Plan-/Roadmapabgleich.

### Phase 4 — Charakterprofil: Plan- und Roadmapabgleich

Planabgleich bestanden: Ein gemeinsamer Katalog-Owner erfasst offenes Formular,
unbestätigte Löschanfrage und die vollständige Mutation. CharacterProfileForm
registriert seine validierende Save-Funktion per Layout-Effekt beim Owner und
liest Eingaben synchron; es gibt keinen zweiten Formular-Owner mit konkurrierender
Auflösungsreihenfolge. Create/Update liefern bestätigten Erfolg zurück.
Wartung wartet Write, Veröffentlichung, Refresh und Accept ab. Refresh-Fehler
werden angezeigt, führen aber nicht zu einer erneuten bereits bestätigten
Mutation. Ein Unknown-Ausgang wird synchron festgehalten und verhindert
Wiederholung/Verwerfen.

Die zentrale Klärung speichert gültige Formulare, erhält ungültige/fehlgeschlagene
Eingaben und verwirft lokale Formulare erst nach Ende laufender Befehle.
Unbestätigte Löschanfragen werden bei beiden Entscheidungen ohne Delete
geschlossen. Wartungsabbruch bewahrt die Eingaben. Eingaben, Navigation und
neue Mutationen beachten die unmittelbare Wartungssperre.

Validierung: 124 Tests in 10 Dateien einschließlich gerendertem Charakterkatalog
mit CapabilityProvider und realem Wartungskoordinator, Desktopprojektion,
Wartungskoordination und Architektur bestanden. Neue Fälle prüfen Create/Update,
sofortige Eingabesperre, Validierung, bekannten Fehler/Discard, Unknown ohne
zweiten Write, Abbruch, offenen Write plus verzögerten Refresh, bestätigte
Mutation trotz Refresh-Fehler sowie unbestätigte Löschung. Bestehende Konflikt-,
Formular- und verspätete Veröffentlichungsfälle bestehen ebenfalls. Vollständiger
Typecheck, gezielter ESLint, Prettier, Build/Built-Smoke (ready/closed), Bundle-Gate
und diff --check bestanden. Logs: work/roadmap-phase4-character-*.log. Kein
Nutzerprofil verändert; Schema 41/35 und Registry 14 unverändert.

Roadmapabgleich: Die Formular-/Pending-Auflösung ist implementiert und lokal
geprüft; keine vollständige Charakter-/Phase-4-Abnahme behauptet. Der konkrete
Quittungsabgleich unklarer Charakterbefehle inklusive Kampagnenbindung bleibt
offen, ebenso die persönlichen Beute-Schreibwege des Katalogs. Planner-Unknown-
Recovery, Beute-Unterdialoge, Kampagnenoberfläche, übrige Gruppen-/Karten-/Writer-
wege und Offline-/Updateabnahme sind weiterhin erforderlich. Phasen 5–7 bleiben
offen. Vorgänger-Check 34261446658 war zuletzt aktiv ohne abgeschlossenen
Fehler; kein vollständiges CI-Grün, kanonischer Handoff, Main-Push oder Release.

### Phase 4 — Plan: Ledger-Korrekturquittung und kampagnengebundene Ports

Der bestehende Charakter-Ledger korrigiert append-only und speichert bereits
atomare LootOperationJournal-Quittungen. Der Renderer kann diese bislang nur
durch erneutes Senden des Write-Befehls erreichen. Für bedienbare Unknown-
Recovery zunächst eine reine Status-Leseoperation ergänzen: vollständiger
Originalbefehl plus Kampagnen-ID, geprüfte Quittung oder explizites null und
frischer Ledger. Der Read schreibt weder Journal noch Ledger und spielt
keine alte Quittung über inzwischen eingegangene Änderungen.

Utility prüft die aktive Kampagne vor Zugriff. Zusätzlich kampagnengebundene
Ledger-Read-/Correct-Operationen für den Renderer, der die ursprüngliche
Kampagne vor und nach IPC prüft. Alte interne API-Aufrufer bleiben kompatibel;
keine neue Tabelle/Migration. SQL bleibt beim vorhandenen Journal-Owner.
Native Prüfung: abwesender/gespeicherter Befehl, unveränderte Zeilen und
Revisionen unter query_only, spätere Korrektur bleibt im frischen Ledger,
Fingerprintkonflikt und falsche Kampagne. Porttests prüfen Wechsel vor und
während Read/Write. Die darauf aufbauende Dialog-Wartungsklärung mit sichtbarem
Read-Retry bleibt ein eigener notwendiger nächster Umsetzungsschritt.

### Phase 4 — Ledger-Status: Plan- und Roadmapabgleich

Planabgleich bestanden für die Quittungs-/Portgrundlage: CharacterLootService
liest den bestehenden correct_ledger-Journaleintrag mit Original-Fingerprint,
Operationstyp und Charakter-ID und liefert Quittung/null plus aktuellen Ledger.
Es wird kein Write erneut gesendet und keine alte Quittung als aktueller Stand
ausgegeben. LootService exponiert diesen fachlichen Read. Drei GM-only-
Operationen sichern Status, Ledger-Read und Korrektur durch explizite Kampagnen-ID
ab; Utility vergleicht sie vor Zugriff mit der aktiven Kampagne. Der Renderer-
Port prüft geladene/aktive Kampagne vor und nach IPC. Vorhandene interne
Operationen bleiben kompatibel. Keine neue Tabelle oder Migration.

Validierung: 106 Tests in 10 Dateien einschließlich nativer Loot-Integration,
neuer Porttests, Capability-Verträge/-Provider und Architektur bestanden.
Nach Präzisierung der falschen Kampagne auf den Fehlercode stale bestehen
19 native/Port-Tests erneut. Status mit fehlender und vorhandener Quittung
funktioniert unter query_only; total_changes bleibt unverändert. Nach einer
späteren Korrektur liefert der Read die ursprüngliche Quittung und den neueren
Ledger, Fingerprintabweichung schlägt fehl. Alle drei qualifizierten Utility-
Operationen verweigern die falsche Kampagne. Porttests prüfen korrekte
Übermittlung, Wechsel geladener/aktiver Kampagne und verspätete Antworten.
Typecheck, gezielter ESLint/Prettier, Build/Built-Smoke (ready/closed), Bundle-
Gate und diff --check bestanden. Logs: work/roadmap-phase4-ledger-status-*.log.
Schema 41/35 und Registry 14 unverändert; kein Nutzerprofil verändert.

Roadmapabgleich: Dies ist die geprüfte Grundlage für sichere Ledger-Recovery,
noch keine abgeschlossene Ledger-Wartungsoberfläche. Nächster notwendiger
Schritt: Originalinput und ursprünglichen Port beim Beginn einer Korrektur
festhalten, vollständigen Write abwarten, zentral Save/Discard registrieren
und Unknown über den neuen Read abgleichen. Sichtbarer Retry, keine zweite
Buchung nach bestätigtem Ausgang und Erhalt späterer Einträge müssen im
gerenderten Dialog geprüft werden. Phase 4 mit ihren übrigen offenen Writer-/
Planner-/Charakter-/Karten-/Updatewegen sowie Phasen 5–7 bleibt offen.
Kein vollständiges Remote-CI-Grün, kanonischer Handoff, Main-Push oder Release.

### Phase 4 — Vorrangiger Integrationsplan: kollidierendes Kampagnenschema 35

Vor Dialogänderungen ist der Kandidat sauber, PR 661 aber CONFLICTING.
Main e6ad4389b bringt Szenenbesetzung, selektive XP/Rast und die bereits
übergebene Migration 34→35 für explizite Belastungsherkunft. Der Kandidat
verwendete 35 für Gruppenquittungen. Kein aktueller CI-Lauf auf 925ef2334.

Main integrieren und seine veröffentlichte Migrationsidentität erhalten.
Gemeinsamer Nachfolger: Kampagne 36, Installation 41, Registry 15. Migration
35→36 initialisiert Gruppenquittungen und ergänzt fehlende Belastungsfelder
über den idempotenten Party-Owner. So werden sowohl Main-35-Profile als auch
bisherige Kandidaten-35-Profile erhalten. Keine Ableitung vertrauter XP-Herkunft
aus unbekannten Altzählern; vorhandene Vertrauensflags bleiben unverändert.
Konflikte in Scene-Verträgen vereinigen. Aktuelle Versions-/Fixture-Verträge
nachziehen, eingefrorene Release-Daten unverändert lassen.

Prüfen: beide Schema-35-Varianten und 34 über den gesamten Pfad; vorhandene
Quittungen, Partywerte und Flags bleiben erhalten. 0.2.0-Zeilenvergleich muss
nur die neu hinzugefügten, separat geprüften Spalten ausnehmen. Vollständige
portable Prüfung und Build/Smoke/Bundlegate. Neue Main-Writer bleiben im
Phase-4-Audit sichtbar. Ledger-Dialog-Recovery danach fortsetzen.

### Phase 4 — Schema-35-Kollision: Plan- und Roadmapabgleich

Planabgleich bestanden: Main e6ad4389b ist integriert. Seine komplette
Migrationskette einschließlich campaign-34-to-35-party-burden bleibt unverändert;
der neue Schritt 35→36 ergänzt über die jeweiligen Owner beide fehlenden
Strukturen. Installation bleibt 41, Kampagne wird 36, Registry 15. Bestehende
Gruppenquittungen sowie belastbare/unsichere Partyherkunft werden erhalten.
Vorhandene Metadateneinträge behalten ID und Zeitstempel. Scene-Verträge und
Handler enthalten sowohl Gruppenquittungen als auch neue Roster-Kommandos.
Aktuelle Versionsdokumentation und Qualifikationsmanifest stimmen mit den
ausführbaren Registern überein; eingefrorene Release-Fixtures sind unverändert.

Validierung: Native Tests rekonstruieren beide Schema-35-Varianten mit
realen Party-/Gruppendaten und echter Gruppenquittung. Ein injizierter Fehler
beim abschließenden Migrationseintrag setzt DDL, Zeilen und user_version
vollständig zurück. Anschließende Migration und Profilneustart erhalten
Gruppenstand, gegebenenfalls Quittung und Partywerte; vorhandene Flags bleiben
erhalten, fehlende Flags werden explizit unbekannt (0). Der 0.2.0-
Zeilenvergleich prüft zusätzlich beide neuen Partyspalten und vergleicht alle
alten Spalten weiter exakt. 54 gezielte Migrations-/Versions-/Current-format-
Tests sowie vollständiges check:portable:fast bestanden: 91 Architekturtests,
1165 Unit-Tests, 321 Integrationstests, Format/Lint/Typecheck und Referenz-/
Generator-/Versions-/Renderartefakt-Gates. Build/Built-Smoke ready/closed,
Bundle-Gate und diff --check bestanden. Keine Baseline-/Budgetlockerung;
reachable Renderer 1642871 Bytes. Logs: work/roadmap-phase4-main36-*.log.
Keine echte Nutzerinstallation oder Nutzerdaten verändert.

Roadmapabgleich: Diese notwendige Zusammenführung stellt den qualifizierten
Migrationspfad und die CI-Freigängigkeit wieder her, ersetzt aber keine
Abnahme mit echten alten AppImages. Der Ledger-Dialog wurde in diesem Schritt
noch nicht geändert; seine zentrale Klärung und sichtbare Recovery sind als
Nächstes umzusetzen. Neu aus Main hinzugekommene DesktopRosterActions,
DesktopRestAction und persönliche XP-Eingaben benötigen ebenfalls die
Phase-4-Wartungsanbindung. Alle bisher offenen Planner-/Charakter-/Beute-/
Karten-/Updatewege bleiben in der Abnahme. Phasen 5–7, exakte Remote-CI,
kanonischer Handoff und Main-Abschluss bleiben verpflichtend.

### Phase 4 — Plan: bedienbare Ledger-Korrektur und Recovery

Kandidat 37cb5631b ist sauber, Check 34264129314 läuft. Die neue Statusoperation
steht bereit. Ein Dialogmodell hält Ledger, Korrekturentwurf, Originalrevision,
Originalport und den vollständigen aktiven Vorgang. Ein einzelner Wartungs-Owner
wartet laufende Reads/Writes ab, speichert gültige Korrekturen oder verwirft
nur den lokalen Rest. Eingaben/Schließen werden während Wartung, Pending und
ungelöstem Befehlsausgang gesperrt.

Nach jeder fehlgeschlagenen Write-Antwort bleibt der genaue Originalinput
festgehalten. Read-Retry fragt die Quittung ab: vorhanden → frischen Ledger
übernehmen und Entwurf bestätigen; abwesend → frischen Ledger übernehmen,
Entwurf behalten und bewussten Save/Discard wieder zulassen. Unterschiedliche
Revisionen verhindern automatisches Übertragen auf späteren Ledgerstand.
Readfehler behalten Unknown; Retry selbst schreibt nie. Wartung verwendet
denselben Abgleich. Dialogport bleibt an die ursprüngliche Kampagne gebunden.

Gerenderte Tests prüfen Save/Discard/Abbruch/Validierung, Pending plus fehlende
Antwort, Readfehler/Retry, vorhandene/abwesende Quittung, spätere Ledgeränderung,
keine zweite Buchung, sofortige Sperre und Originalinput. Bestehende Loot-/
Port-/Architekturtests und Typecheck/Lint/Build/Smoke. Plan-/Roadmapaudit danach;
übrige Phase-4-Schreibwege und Phasen 5–7 bleiben im Gesamtumfang.

Korrekturrunde Testaufbau: Der neue gerenderte Test hat eine fehlende schließende
Klammer in fixture(). Syntax korrigieren, anschließend die vollständige
geplante Dialog-/Port-/Loot-/Architekturprüfung erneut ausführen.

Korrekturrunde Bundle-Nachweis: Build und Smoke ready/closed bestanden,
Typecheck und gezieltes ESLint ebenfalls. Das Bundle-Gate meldet kumulativ
reachable +18638 Bytes gegenüber der letzten Baseline; gegenüber dem zuletzt
geprüften 37cb-Build sind es +3987 Bytes. Messung: 1646858 reachable,
527693 workspace, 171783 session, 190479 catalog; shell/hex/reference/pixi
unverändert zur Baseline. Manifest bestätigt den dynamischen Ledger-Dialog.
Keine neuen Dependencies oder Lockfileänderungen. Die vorgesehen begründete
Baseline-Aktualisierung übernimmt diese gemessenen Werte, ohne absolute
Budgets oder 16-KiB-Wachstumsgrenze zu ändern. Anschließend Gate erneut prüfen.

### Phase 4 — Ledger-Dialog: Plan- und Roadmapabgleich

Planabgleich bestanden: Ein kampagnengebundener Dialogcontroller hält den
Originalinput einschließlich Befehls-ID und Ausgangsrevision fest, wartet
laufende Vorgänge ab und übernimmt zentrale Save-/Discard-Entscheidungen.
Ungültige Eingaben verhindern Wartung mit benanntem Owner. Nach fehlender
Schreibantwort verhindert der Zustand weitere Bearbeitung und Schließen;
der sichtbare Leseabgleich schreibt nicht. Vorhandene Quittungen bestätigen
die ursprüngliche Korrektur, übernehmen aber den frischen Ledger einschließlich
späterer Buchungen. Explizite Abwesenheit erhält den Entwurf; eine abweichende
Ledgerrevision verhindert dessen Übertragung. Lesefehler lassen Recovery offen.
Der bei Dialogbeginn erfasste Port bleibt an die ursprüngliche Kampagne gebunden.

Validierung: 107 Tests in 10 Dateien (gerenderter Ledger-Dialog, gebundene
Loot-Ports, vorhandene Loot-UI, Wartungskoordinator und Architektur) bestanden.
Geprüft sind Save/Discard, ungültiges Speichern mit anschließendem Abbruch,
laufender Write plus Discard, fehlende Antwort, erneuter fehlgeschlagener Read,
vorhandene/abwesende Quittung, spätere Buchung, bewusster erneuter Save und
Kampagnenwechsel ohne fehlgeleiteten Read. Typecheck und gezieltes ESLint
bestanden. Build und Built-Smoke ready/closed bestanden. Bundle-Gate besteht
nach dokumentierter Messung/Baseline-Aktualisierung. Logs unter
work/roadmap-phase4-ledger-dialog-*.log. Keine echte Nutzerinstallation oder
Nutzerdaten verändert.

Roadmapabgleich: Dieser Nachweis schließt den persönlichen Ledger-Korrekturweg,
nicht Phase 4 insgesamt. Allgemeine Planner-/Charakterbefehle mit unklarem
Ausgang, weitere Beute-/Karten-/Desktop-/Kampagneneditoren und die vollständige
Update-/Offline-Abnahme bleiben offen. Phasen 5–7 benötigen weiterhin echte
unterschiedliche AppImages, vollständige Artefaktqualifikation, Releasefreigabe
und Livetest. Lokale Prüfungen ersetzen weder exact-SHA Remote-Check noch
kanonischen Handoff und grünen Main-Abschluss.

### Phase 4 — Plan: quittierbare allgemeine Plannerbefehle

Der vorherige Zielturn hat mit 51f1bf61c geprüften Fortschritt geliefert.
Der Planner hat für create/open/switch/rename/save/delete bisher weder stabile
Befehls-IDs noch Quittungen. Eine reine Zustandsähnlichkeit wäre bei späteren
Änderungen oder gelöschten Sitzungen kein Beleg. Zuerst einen gemeinsamen,
streng validierten Befehlsumschlag und eine kampagnengebundene Execute-/Status-
Capability ergänzen. Der Planner-Owner speichert vollständigen Fingerprint und
versionierte Ergebnisquittung atomar mit der Änderung; Status liest Quittung
plus aktuellen Workspace, auch wenn die ursprüngliche Sitzung gelöscht wurde.
Keine Quittungseviction, kein Write beim Statuslesen. Die vorhandenen internen
Serviceoperationen bleiben wiederverwendbar. Eine neue Vorwärtsmigration 36→37
und Bootstrap-Registrierung ergänzen ausschließlich die Quittungstabelle.

Native Tests prüfen alle sechs Operationen, idempotenten Wiederholungsaufruf,
Fingerprintfalschbelegung, Rollback beim Quittungsinsert, query_only-Status,
spätere Änderungen und Kampagnenabweichung. Versionswahrheit und eingefrorene
Fixtures bleiben konsistent. Danach folgt die Rendereranbindung mit originalem
Befehlsumschlag/Port, lesender Unknown-Recovery und zentraler Wartungsklärung;
ein Backendnachweis allein schließt diesen Schreibweg ausdrücklich noch nicht.

Korrekturrunde Planner-Testaufbau: Alle sechs neuen Befehlsfälle bestehen ihre
Atomizitäts-/Read-only-Prüfung, scheitern anschließend beim Neustartnachweis am
falschen Helpernamen createServices statt services. Typecheck bestätigt genau
diesen Fehler. Helper korrigieren und Current-format-Manifest auf Schema 37
nachführen; native Suite und Typecheck danach erneut prüfen.

Korrekturrunde Manifest: 119 Prüfungen bestanden; der Current-format-Vertrag
meldet den noch fehlenden session-planner-receipts-Owner. Ihn nach party in
der tatsächlichen Bootstrap-Reihenfolge ergänzen. Die bestehende Fixture nutzt
interne Serviceoperationen ohne Quittung; diese Einschränkung explizit als
initialize-only benennen. Die neuen nativen Befehls-/Neustarttests belegen die
gefüllte Quittung separat. Typecheck und ESLint sind bestanden.

Korrekturrunde Versionsoracle: Vollständige Format-/Lint-/Typprüfung und 91
Architekturtests bestanden. Unter 1175 Unit-Tests erwartet allein das explizite
version-truth-Oracle noch Kampagne 36. Es auf die ausführbare Kette bis 37
nachführen, dieses Oracle erneut prüfen und die noch nicht ausgeführten
Integrationstests sowie Artefakt-/Versionsgates abschließen.

Remote-Befund 51f1bf61c: Check 34265480950 ist abgeschlossen und nicht grün.
Beide roten UI-Jobs scheitern in campaignCombat. Das heruntergeladene echte
Fehlerbild zeigt die Loot-Verwerfen-Bestätigung über dem Gruppendialog,
während der Test bereits Monster suchen bearbeiten will. Diesen konkreten
Ablauf nach dem Planner-Backendnachweis untersuchen; kein Handoff und keine
Main-Promotion auf Basis der übrigen grünen Jobs.

Korrekturrunde Current-format-Abdeckung: 324 Integrationstests bestanden;
der übergreifende Abschlussvertrag fordert zusätzlich die eindeutige Zuordnung
des neuen Owners zu einer Fixturekohorte. Dem strukturellen Root-Readback
session-planner-receipts hinzufügen und dort die tatsächlich leere Tabelle
prüfen. Die gefüllten Quittungen bleiben durch die sechs nativen Plannerfälle
belegt. Root-/Completion-Qualifikation anschließend gezielt erneut ausführen.

Korrekturrunde Root-Reihenfolge: Der Root-Untervertrag verlangt ebenfalls die
Bootstrap-Reihenfolge; die neue Registrierung muss direkt nach party stehen,
nicht bei der älteren Gruppenquittung. Beide Listen entsprechend ordnen.

Korrekturrunde Kampagnenkampf-E2E: Die vorhandene Reducerprüfung bestätigt,
dass unmodifizierte generierte Beute bewusst als ungespeichert geschützt wird.
Das CI-Fehlerbild zeigt genau die notwendige Bestätigung nach Undo. Der Test
soll zuerst deren Sichtbarkeit und gesperrte Suche prüfen, Verwerfen ausdrücklich
wählen und erst nach Schließen der Bestätigung weiterschreiben. Schutzdialog
und Produktlogik bleiben erhalten. Danach den vollständigen campaignCombat-
Ablauf im gebauten Produkt einschließlich visueller Prüfung ausführen.

E2E-Assertionsabgleich vor Ausführung: inert liegt laut ModalDialog am Backdrop,
nicht am Dialog selbst. Die Sperrprüfung muss deshalb den tatsächlichen
inert-Vorfahren des Suchfelds verlangen; ein bloß definiertes Attribut wäre
kein belastbarer Nachweis.

### Phase 4 — Plannerquittungen und Kampagnenkampf: Plan-/Roadmapaudit

Planabgleich Backend bestanden: Execute und Status verwenden denselben strikten
Befehlsumschlag für create/open/switch/rename/save/delete. Beide Capabilities
prüfen die ursprüngliche Kampagne vor Zugriff. Der Planner-Owner persistiert
vollständigen Fingerprint und versionierte Ergebnisquittung innerhalb derselben
Transaktion wie die Änderung. Wiederholungen liefern das ursprüngliche Ergebnis,
ohne aktuelle Daten zu verändern. Status liest separat den aktuellen Workspace;
die Quittung bleibt nach späterer Sitzungsänderung und -löschung erhalten.
Kein automatisches Wiederholen oder Löschen von Quittungen. Kampagne 36→37
führt nur die neue Quittungstabelle ein; Installation 41 / Registry 16.
Bootstrap, Versionswahrheit und Current-format-Root-Abdeckung sind nachgeführt;
die eingefrorenen 0.2.0-Quelldaten bleiben unverändert.

Validierung: Alle sechs Befehle bestehen Fehler beim Quittungsinsert mit
vollständigem Rollback, bewusste Wiederholung, falsche Kampagne, Fingerprint-
Konflikt, query_only-Status, spätere Löschung und echten Profilneustart. Der
Migrationsabbruch setzt Tabelle und user_version zurück und erhält Plannerdaten;
der erneute Übergang gelingt. Vollständige Format-/Lint-/Typprüfung und 91
Architekturtests bestanden. 1174 Unit-Tests plus korrigierter Versionsoracle-
Retest (2 Tests) bestanden. 324 Integrationstests bestanden; der zunächst
fehlgeschlagene Root-/Completion-Abdeckungsabgleich wurde korrigiert und besteht
mit 11 gezielten Root-/Completion-/Manifesttests. Referenz-, Generator-, Versions-
und Renderartefakt-Gates bestanden. Nach den letzten Änderungen Typecheck und
gezieltes ESLint erneut grün. Build, Smoke ready/closed und Bundle-Gate bestanden;
Renderergröße unverändert zur letzten Baseline, keine Budgetänderung.
Logs work/roadmap-phase4-planner-receipts-*.log.

E2E-Korrekturabgleich bestanden: Die im echten CI-Fehlerbild sichtbare notwendige
Verwerfen-Entscheidung wird im Kampagnenkampf-Test ausdrücklich geprüft und
gewählt. Eine echte inert-Vorfahrenprüfung bestätigt die Eingabesperre bis zur
Entscheidung. Der vollständige campaignCombat-Ablauf besteht auf demselben Build
funktional und mit allen bestehenden visuellen Goldens, ohne Bildaktualisierung.
Logs work/roadmap-phase4-combat-recovery-{e2e,visual}.log. Der frühere rote
Remote-Lauf bleibt rot; diese lokalen Nachweise ersetzen keine neue Exact-SHA-CI.

Roadmapabgleich: Backend und Migration sind qualifiziert. Die Rendererbefehle
verwenden noch den bisherigen Vertrag; der sichtbare Planner-Recoveryweg ist
somit ausdrücklich noch nicht abgeschlossen. Nächster Schritt: Originalinput
und Port im Planner halten, bestätigte Quittung plus frischen Zustand abgleichen,
abwesende Quittung ohne Replay freigeben und Save/Discard sowie Namensdialoge
korrekt abschließen. Die übrigen Phase-4-Schreibwege, Update-/Offline-Abnahme,
Phasen 5–7 und kanonischer Handoff/Main-Abschluss bleiben verpflichtend.
Keine echte Nutzerinstallation, Nutzerdaten oder öffentlichen Releases geändert.

### Phase 4 — Plan: Plannerbefehle an lesende Recovery anbinden

Ausgang af04f95a1 sauber, Check 34270091488 läuft. Der vorherige Zielturn war
Fortschritt: atomare Quittungen und qualifizierte Migration sind gepusht.
Jetzt create/open/switch/rename/save/delete im Sitzungscontroller auf den
kampagnengebundenen Execute-Vertrag umstellen. Der Controller erstellt vor dem
Transport einen unveränderlichen Befehlsumschlag und hält genau diesen zusammen
mit dem ursprünglichen Port im Recoverycallback. Ein Kampagnenwechsel nach
erfolgreichem Write-Transport bedeutet outcome_unknown, nicht sicher abgelehnt.

Bei vorhandener Quittung nur den frischen Workspace übernehmen; ursprüngliche
Dialogbestätigung nur bei unverändertem lokalem Bearbeitungskontext ausführen.
Bei abwesender Quittung lokale Entwürfe erhalten, frischen Katalog nachführen
und Unknown beenden. Neuere lokale Eingaben bleiben geschützt. Readfehler
halten Unknown; Retry schreibt nie. Die vorhandene zentrale Wartung verwendet
denselben Callback, wartet vollständige Aktionen ab und entscheidet anschließend
über noch offene Entwürfe/Dialogs. Tests prüfen alle sechs Befehle, Originalinput,
Readfehler/Retry, Abwesenheit, spätere Daten, neuere lokale Entwürfe, Dialogschluss,
Save/Discard und Kampagnenwechsel vor/während Transport. Bestehende Planner-/
Vorbereitungs-/Wartungstests plus Typecheck/Lint/Build/Smoke/Bundle prüfen.

Korrekturrunde Planner-Testharness: 142 Tests bestanden. Ein alter Unknown-Test
hat keinen Statusport und scheitert deshalb am Testdouble statt am beabsichtigten
Readfehler. Einen explizit fehlgeschlagenen Statusread als Default ergänzen.
Typecheck beanstandet außerdem die nachträgliche Zuweisung an den readonly-Port;
das Testobjekt vollständig bei Erstellung zusammensetzen. Produktverhalten
bleibt unverändert; die vollständige gezielte Suite erneut prüfen.

### Phase 4 — Planner-UI-Recovery: Plan- und Roadmapabgleich

Planabgleich bestanden: Alle sechs allgemeinen Plannerbefehle verwenden jetzt
den kampagnengebundenen Quittungsvertrag. Der Controller kopiert den kompletten
Befehl vor dem Transport und hält ihn im Callback zusammen mit dem ursprünglichen
Port fest. Ein Wechsel nach erfolgreichem Write-Transport wird als unbekannter
Ausgang behandelt; ein Wechsel vor Transport verhindert den Write. Statusreads
prüfen die Kampagne vor und nach dem Lesen.

Eine bestätigte Quittung führt zum aktuellen Workspace, nicht zur historischen
Quittungskopie. Nur unveränderte lokale Autorität darf dadurch bestätigt und
ihr Namens-/Löschdialog geschlossen werden. Neuere lokale Änderungen bleiben
bestehen; nur der Katalog wird aktualisiert. Abwesende Quittungen beenden Unknown
nach erfolgreichem Read, lassen lokale Entwürfe aber erhalten. Retry schreibt
nie. Fehlgeschlagene Reads halten die Bearbeitung gesperrt. Die zentrale Wartung
verwendet denselben Abgleich vor Save/Discard und wartet vollständige Aktionen ab.

Validierung: 144 Tests in 12 Dateien bestanden, einschließlich aller sechs
Befehle mit fehlender Antwort und fehlgeschlagenem erstem Read, Originalinput,
frischem statt historischem Workspace, Dialogschluss, zentralem Save/Discard,
expliziter Abwesenheit und erst danach bewusstem Save sowie neueren lokalen
Entwürfen. Kampagnenbindung vor/während Write und Read sowie Rückkehr zum
Originalport geprüft. Bestehende Vorbereitungs-/Wartungs-/Architekturtests und
der sichtbare Recoverybutton bleiben grün. Typecheck, gezieltes ESLint, Build,
Smoke ready/closed und Bundle-Gate bestanden. Renderer reachable 1647536 Bytes;
keine neue Dependency und keine Baseline-/Budgetänderung. Der bestehende echte
sessionGeneration-E2E besteht auf demselben Build einschließlich Wiederaufnahme
der Plannerarbeit nach Electron-Neustart. Logs work/roadmap-phase4-planner-ui-*.

Roadmapabgleich: Dieser Schritt vervollständigt die zentrale Klärung der
allgemeinen Plannerbefehle. Er ersetzt nicht die noch offenen Beute-/Verteilungs-
Unterdialoge und Belohnungsmaterialisierung des Planners. Charakterbefehle,
weitere Gruppen-/Kampagnen-/Karten-/Desktop-Schreibwege, vollständige Update- und
Offline-Abnahme sowie Phasen 5–7 bleiben offen. Remote-Check des neuen SHA,
kanonischer Handoff und grüner Main-Abschluss bleiben notwendig. Keine echte
Nutzerinstallation, Nutzerdaten oder öffentlichen Releases verändert.

### Phase 4 — Plan: generierte Planner-Beute lesend abgleichen

Ausgang 86b174b58 sauber. Der vorherige Zielturn hat geprüften Fortschritt
gepusht. acceptGenerated besitzt bereits eine atomare Lootquittung. Ergänzen:
Owner-Statusread mit vollem Originalfingerprint, Quittung und aktuell vorhandenem
Schatz für dasselbe Generierungsobjekt; kampagnengebundener Write-/Statusvertrag.
Keine neue Tabelle oder Schemaänderung. Der Planner erhält einen gebundenen
Workspace-Read, damit Folge-/Recoveryreads nicht in andere Kampagnen geraten.

Der Renderer hält den vollständigen Originalinput pro Versuch. Nach Unknown
oder fehlgeschlagenem Refresh nach bestätigtem Write bleibt ein lesender Callback
für Status plus aktuellen Workspace verfügbar. Bestätigung führt nie zu erneutem
Write; abwesende Quittung beendet Unknown erst nach erfolgreichem Read. Nur bei
unveränderter lokaler Autorität frischen Workspace und gegebenenfalls den aktuellen
Schatzeditor öffnen. Spätere Schatzänderungen/Verteilung nicht mit einer alten
Quittung überschreiben. Kein bloßes Wiederverwenden einer ID mit geändertem Label.
Ein neuer bewusster Versuch darf eine neue ID erhalten; die Domain gewährleistet
weiterhin Eindeutigkeit je generiertem Schatz.

Native Tests: query_only, Vollfingerprintkonflikt, aktueller Schatz nach späterer
Änderung, falsche Kampagne, keine Doppelanlage. Renderer: Unknown, fehlgeschlagener
Refresh nach Write, Readretry, Originalinput, Abwesenheit und geänderte lokale
Autorität. Bestehende Loot-/Plannerprüfungen, Typ/Lint/Build/Smoke/Bundle. Offene
Schatz-/Verteilungsunterdialoge danach separat zentral anbinden; dieser Schritt
allein schließt weder diese Dialoge noch Phase 4.

Zwischenabgleich: Die erste gezielte Suite besteht mit 130 Tests. Vor Abschluss
noch die konkret neuen Loot-/Workspace-Ports bei Kampagnenwechsel und den
Statusread nach späterer Verteilung ergänzen; so bleiben Herkunft und aktuelle
Bestände auch über die zusätzliche Read-Verbindung ausdrücklich belegt.

Korrekturrunde Typdisziplin im Test: Die 132 Tests und Typecheck bestehen.
ESLint meldet eine untypisierte Mock-Rückgabe beim Vergleich des Originalinputs.
Diesen reinen Vergleichswert ausdrücklich als unknown führen; keine Änderung
am Produkt oder am bereits fertig gebauten App-Artefakt. Lint erneut prüfen.

### Phase 4 — Generierte Planner-Beute: Plan-/Roadmapaudit

Planabgleich bestanden: Der vorhandene Loot-Owner liest die Quittung anhand des
kompletten Originalfingerprints und separat den aktuellen Schatz desselben
Generierungsobjekts. Status und Write sind kampagnengebunden; Planner-Reads
verwenden jetzt ebenfalls eine gebundene Capability. SQL und existierende
Quittungstabelle bleiben beim Loot-Owner; keine Schemaänderung.

Der Renderer hält den Originalinput im lesenden Callback. Verlorene Antworten
und fehlgeschlagener Refresh nach bestätigtem Write bleiben klärbar. Auch ein
bereits platzierter Schatz wird vor Editoröffnung frisch gelesen. Recovery
öffnet nur den aktuellen Schatz, nie die historische Quittungskopie, und nur
bei unverändertem lokalen Kontext. Abwesenheit und später entfernte Objekte
führen zu keiner erneuten Anlage. Die bisherige reine ID-Wiederverwendung wurde
ersetzt; neue bewusste Versuche haben neue IDs, während die vorhandene Domain-
Eindeutigkeit Doppelanlagen verhindert.

Validierung: 132 Tests in 11 Dateien bestanden. Native query_only-Prüfungen
belegen Abwesenheit, Fingerprintkonflikt sowie aktuellen Schatz nach Bearbeitung
und nach Verteilung, bei unveränderter Originalquittung. Falsche Kampagne wird
vor Domainarbeit abgewiesen. Rendererprüfungen belegen verlorenen Write,
Refreshfehler nach bestätigtem Write, fehlgeschlagenen Read und erneuten Retry,
Originalinput, Abwesenheit, bereits platzierten Schatz und neuere lokale Eingaben.
Neue Ports sind bei Kampagnenwechsel vor und während Transport geprüft.
Typecheck und gezieltes ESLint bestanden; die reine unknown-Typannotation im
Test ändert keine Runtime. Build, Smoke ready/closed und Bundle-Gate bestanden
(reachable 1648030 Bytes, keine Baseline-/Budgetänderung). Der sessionGeneration-
E2E mit Electron-Neustart besteht auf demselben Build. Logs:
work/roadmap-phase4-reward-recovery-*.log. Keine echte Nutzerinstallation oder
Nutzerdaten verändert.

Roadmapabgleich: Der Recoveryteil der Belohnungsübernahme ist angeschlossen.
Schatzeditor und Verteilungsdialog haben weiterhin keine vollständigen eigenen
Wartungs-Owner. Der Planner blockiert bei offenen Beutedialogen noch zentral.
Deren Integration muss abhängige Owner und wartungsinterne Abschlusscallbacks
vorsehen: heutige öffentliche setTreasureEditor/setDistribution-Guards sperren
auch einen während Wartung erfolgreichen Kindabschluss. Dies ist der nächste
konkrete Schritt. Die übrigen Phase-4-Schreibwege, Update-/Offline-Abnahme,
Phasen 5–7 sowie Exact-SHA-CI/Handoff/Main-Abschluss bleiben offen.

### Phase 4 — Plan: Schatzeditor zentral klären

Ausgang 62729b31c sauber; vorheriger Zielturn war geprüfter Fortschritt.
Zuerst bestehende atomare Create-/Update-Quittungen durch einen streng validierten
Editor-Statusvertrag lesbar machen. Originalinput inklusive Revision/Fingerprint
bleibt maßgeblich; Ergebnisquittung und aktuell gespeicherter Schatz bleiben
getrennt. Create/Update und Status über kampagnengebundene Ports anbieten. Keine
neue Quittungstabelle oder Migration. Native Tests prüfen Status ohne Schreibrecht,
spätere Änderungen und Fingerprintkonflikt; Ports prüfen Kampagnenwechsel.

Danach erhält der Editor einen eigenen Wartungs-Owner mit synchronem Entwurf,
Originalport, Pending-/Unknown-Zustand und Save/Discard/Retry. Der Planner benennt
diesen Kind-Owner als Abhängigkeit, auch während des Lazy-Ladens. Erfolgreiche
Wartungsabschlüsse benötigen interne Callbackpfade, die trotz allgemeiner
Bedienungssperre den Kinddialog schließen und den Parent frisch lesen dürfen.
Lesefehler und Konflikte halten Entwürfe erhalten und verhindern Wartung. Tests
müssen gerenderten Editor plus zentrale Klärung und Parent-Abschluss abdecken.
Der erste Backend-/Portnachweis allein schließt diesen Dialog ausdrücklich nicht.

Korrekturrunde Vertrags-Typen: 102 Tests und ESLint bestehen. Die Bridge verwendet
normalisierte Zod-Ausgaben; der neue Commandtyp war als roher Zod-Input definiert
und erlaubte deshalb fehlende containers/containerId. Den öffentlichen Commandtyp
auf die normalisierte Form ausrichten und die neuen Bridge-Testinputs vollständig
angeben. Owner und Boundary parsen weiterhin strikt mit denselben Defaults;
Originalfingerprints bleiben dadurch identisch. Tests/Typecheck erneut prüfen.

### Phase 4 — Schatzeditor-Statusvertrag: Plan-/Roadmapaudit

Planabgleich des Backend-/Portschritts bestanden: Strikter Create-/Update-
Commandvertrag, lesender Ownerstatus und kampagnengebundene Create/Update/Status-
Capabilities sind implementiert. Status liest die ursprüngliche Quittung mit
normalisiertem Vollfingerprint und unabhängig davon den aktuellen Schatz.
Abwesende Create-Quittung liefert ausdrücklich null; ein abwesender Updatebeleg
liefert weiterhin den bestehenden Schatz. Fehlende Zielobjekte/Readfehler werden
nicht als erfolgreicher Abschluss ausgegeben. Post-Write-Kampagnenwechsel ist
outcome_unknown, vor Transport wird abgewiesen. Bestehende Schema-/Journal-
Implementierung bleibt erhalten; keine Migration und keine Tabellenänderung.

Validierung: 102 Tests in 10 Dateien bestanden, darunter query_only für
Create-/Update-Abwesenheit und vorhandene Quittungen, spätere Änderung,
Fingerprintfalschbelegung, kampagnengebundene Handler und Ports vor/während
Transport. Bestehende Loot-/Ledger-/Planner-Ports und Architekturtests grün.
Typecheck und gezieltes ESLint bestanden. Build, Smoke ready/closed und
Bundle-Gate grün (1648629 reachable, keine Baseline-/Budgetänderung). Der echte
loot-E2E besteht auf demselben Build: teilweise verteilen, Neustart, vollständig
verteilen und Herkunft erhalten. Logs work/roadmap-phase4-treasure-ports-*.
Keine echte Nutzerinstallation oder Nutzerdaten verändert.

Roadmapabgleich: Der Vertrags-/Portteil des protokollierten Schatzeditorplans ist
qualifiziert, die eigentliche Wartungs-UI bleibt offen. Nächster Schritt ist der
Editorzustand mit synchronem Draft/Anchor, Pending und genau einem Originalcommand,
Save/Discard/Readretry sowie seine abhängige Einbindung im Planner. Dabei getrennte
Abschlusscallbacks für Wartung und Benutzeraktionen verwenden. Verteilungsdialog,
weitere Phase-4-Schreibwege, Update-/Offline-Abnahme und Phasen 5–7 bleiben im
Umfang. Exact-SHA-CI, Handoff und Main-Abschluss sind dadurch nicht ersetzt.

### Phase 4 — Plan: Schatzeditorzustand und Planner-Abhängigkeit

673bda007 ist sauber. Den protokollierten Editorplan jetzt umsetzen: ein eigener
Controller hält Draft, Anchor, Ausgangsrevision, Originalport, Pending und
Originalcommand. Save/Discard warten auf denselben Vorgang. Nach Writefehlern
wird ausschließlich die Quittung gelesen; bestätigte Writes schließen nach
erfolgreichem Parent-Refresh, abwesende Quittungen erhalten den Entwurf. Eine
abweichende aktuelle Revision verhindert erneutes Übertragen alter Entwürfe.
Unveränderte offene Editoren können während Wartung ohne Write geschlossen
werden. Der komplette offene Editor bleibt bis zum Abschluss ein Owner.

Der Planner benennt einen stabilen Schatzeditor-Owner als Abhängigkeit und
hält gesonderte interne Abschlusscallbacks vor. Sein Refresh wird abgewartet,
bevor der Kinddialog als erfolgreich geschlossen gilt. Ein Refreshfehler darf
keinen zweiten Write auslösen. Verteilung bleibt als eigener offener Dialog
weiter blockierend, bis ihr eigener Owner folgt. Gerenderte Tests des Editors
und Koordinator-/Parenttests prüfen diese Grenzen; anschließend bestehende
Loot-/Plannerprüfungen und Build/Smoke/Bundle sowie Loot-E2E.

Korrekturrunde nach UI-Prüfung: 156 Tests und Typecheck bestehen. ESLint meldet
Ref-Zugriff aus dem Controller-Initializer sowie unpräzise Mocktypen und unnötige
async-Funktionen in den neuen Tests. Die Callbackaktualisierung auf eine explizite
Controller-Methode im Layout-Effekt umstellen; der Initializer erhält normale
Props, der Originalport bleibt fest. Mockvergleiche auf unknown typisieren und
synchrone Testcallbacks mit expliziten Promises versehen. Danach dieselben
betroffenen Tests sowie Typecheck/Lint erneut prüfen. Kein Architektur-/Guard-
Bypass und keine Regelunterdrückung.

### Phase 4 — Schatzeditorzustand: Plan-/Roadmapaudit

Planabgleich bestanden: Der gerenderte Schatzeditor ist bis zum Abschluss ein
zentraler Wartungs-Owner. Synchroner Draft/Anchor, Originalport und Ausgangsrevision
bleiben erhalten; öffentliche Aktionen sind während Klärung, Pending und Unknown
gesperrt. Save/Discard warten auf den vollständigen Write einschließlich asynchronem
Abschlusscallback. Fehler bleiben im Editor sichtbar. Lesender Retry verwendet
denselben Originalcommand; bestätigte Quittungen führen keinen zweiten Write aus.
Bei Abwesenheit bleiben Eingaben erhalten, bei neuerer Revision ist erneutes
Überschreiben ausgeschlossen. Unberührte Editoren schließen während Wartung ohne
Write. Der Planner benennt den Kind-Owner auch vor dem Lazy-Mount als Abhängigkeit;
sein interner Abschluss liest frisch und schließt erst danach. Ein fehlgeschlagener
Refresh hält die Recovery offen, ein schmutziger Parentdraft bleibt erhalten.

Validierung: 178 Tests in 16 Dateien bestanden. Neue gerenderte Fälle prüfen
Save/Discard, unmittelbare Eingabesperre, Validierungsfehler/Abbrechen, unberührten
Editor, Pending inklusive Parent-Refresh, verlorene Antwort, mehrfachen Readretry,
Abwesenheit, Revisionskonflikt und ursprüngliche Kampagne. Koordinator-/Planner-
Tests prüfen Reihenfolge und einen noch ladenden Kind-Owner. Typecheck und gezieltes
ESLint sind nach der protokollierten Korrekturrunde grün. Build, Smoke ready/closed
und Bundle-Gate bestehen (1652738 reachable Bytes; keine Baseline-/Budgetänderung).
Beide E2E-Suiten auf demselben Build bestanden: loot mit teilweiser Verteilung,
Neustart und Provenienz; sessionGeneration mit dauerhafter Plannerarbeit über
Prozessneustarts. Logs: work/roadmap-phase4-treasure-ui-*.log. Keine echte
Nutzerinstallation oder Nutzerdaten verändert.

Roadmapabgleich: Der Schatzeditor samt Planner-Abhängigkeit ist implementiert und
gezielt automatisiert geprüft. Der Verteilungsdialog hat noch seinen alten lokalen
Pending-/Commandzustand ohne zentralen Owner und ohne lesende Recovery; der Planner
blockiert diesen Dialog weiterhin ausdrücklich. Als nächstes dessen bestehende
atomare Quittung lesbar und kampagnengebunden machen und anschließend Verteilungs-
Owner plus abhängigen Parentabschluss integrieren. Weitere Phase-4-Schreibwege und
Update-/Offline-Abnahme sowie Phasen 5–7 bleiben offen. Lokaler Build und diese
Prüfungen ersetzen weder vollständige Exact-SHA-CI noch Handoff, Main-Abschluss,
Livetest oder Veröffentlichung.

### Phase 4 — Korrekturplan: Main-Konvergenz nach Schatzeditor

96bcf8b7f ist sauber auf Candidate gepusht; GitHub meldet Konflikte und hat dafür
noch keine Check-Ausführung gestartet. origin/main ist inzwischen c084ff2f1 mit
96a0992ee (regulärer Szenendesktop) und Titelzeilen-/Fokuskorrektur. Merge-Vorschau
zeigt sechs Textkonflikte; keine Nutzerdaten wurden dabei geöffnet/verändert.

Main vollständig übernehmen und eigene Wartungsgarantien erhalten: Installation
42 mit neuer Main-Migration, Kampagne weiterhin 37 mit beiden Candidate-Quittungs-
Ownern, Registry auf 17. Datenvertrag und aktuelle Fixture-Erwartungen gemeinsam
aktualisieren; eingefrorene 0.2.0-Fixtures bleiben historisch unverändert. Im
Charakterkatalog Main-Suche/Status mit synchronem Wartungscontroller kombinieren.
Automatische Merges von Desktop-Persistenz, Session-Capabilities und Tests auf
verlorene Guards prüfen. Bundle-Konflikt zunächst mit bisheriger Candidate-
Baseline auflösen, dann reale kombinierte Buildgrößen prüfen; eine erforderliche
Neubaseline nur mit konkreter Ursachen-/Chunkangabe erzeugen.

Nach Merge Typecheck, Lint, Architektur, Unit-/Integrationstests und Version-Truth
prüfen, dann Build/Smoke/Bundle und Desktop-/Loot-/Planner-/Kampagnen-E2E passend
zum kombinierten Stand. Abweichungen vor Fixes gesondert protokollieren. Erst ein
sauberer neuer Mergecommit wird gepusht und für genau dessen SHA CI überprüft.
Die vorherigen 178 Tests und zwei E2Es belegen allein den Vor-Merge-Stand.

Korrekturrunde Main-Fixture: Vollständiges Format/Lint/Typecheck und 87 Architektur-
prüfungen bestehen; Unitlauf 1260 bestanden, drei Recoveryfälle fehlgeschlagen.
Der Fehler ist vor der simulierten Crashgrenze: Die Fault-Fixture setzt eine neu
gebootstrappte Installation auf current-1, behält aber den neuen Settings-Envelope
2. Migration 41→42 erwartet korrekt den historischen Envelope 1 mit Sessionlayout.
Die drei Fälle explizit auf Installation 41 samt gültigem Legacy-Envelope und
abweichendem Theme vorbereiten. Anschließend Theme und Sentinel nach Recovery
prüfen. Produktionsmigration bleibt strikt; die Fixture behauptet weiterhin keine
vollständige historische Kompatibilitätsqualifikation. Betroffene 51 Installer-
Tests erneut, danach bisher noch nicht erreichte Integrations-/Artefaktchecks.

Korrekturrunde Baseline-Orakel: Alle 51 Installerprüfungen bestehen nun. Der
Integrationslauf besteht mit 330 Fällen; einzig die eingefrorene 0.2.0-Baseline
vergleicht den migrierten installation_settings-Datensatz noch bytegleich mit
Envelope 1. Das Orakel muss den beabsichtigten Übergang explizit prüfen: gleicher
Theme-Wert, Envelope 2 und genau ein Revisionsschritt; alle übrigen Zeilen bleiben
weiterhin im vollständigen Vergleich. Kein pauschales Auslassen von Einstellungen,
keine Änderung der eingefrorenen Quelldateien. Den Baselinefall und die übrigen
Migrations-/Current-format-Integrationsfälle erneut prüfen.

Bundle-Konvergenz: Build und Smoke bestehen. Das Bundle-Gate verlangt die
Absenkung der historischen Candidate-Baseline: reachable −33365, Session −170472,
Workspace −14080, Reference −2311, Catalog −472, Hex −6 Bytes. Shell +106 Bytes
bleibt innerhalb unveränderter Wachstumsschwelle. Die Entfernung der alten
Session-/Referenzoberflächen aus Main erklärt die kleineren Graphen; Candidate-
Wartungscontroller bleiben enthalten. Gemäß Mergeplan jetzt die gemessene
kombinierte Baseline mit dem vorgesehenen Tool erfassen, ohne Grenzwerte zu ändern,
und das Gate auf denselben Buildbytes wiederholen.

### Phase 4 — Main-Konvergenz: Plan-/Roadmapaudit

Planabgleich bestanden: c084ff2f1 ist mit dem Schatzeditorstand zusammengeführt.
Installation 42 und Main-Migration 41→42 bleiben erhalten, Kampagne 37 behält
beide Candidate-Quittungsowner, Registry 17 und Versionsvertrag stimmen überein.
Charakterkatalog kombiniert Main-Suche/Status mit bisherigen Wartungsguards.
Desktop-Fokusänderungen lassen Pending-/Discard-/Recovery-Verfolgung bestehen;
der zusammengeführte Kampftest fordert weiterhin ausdrücklich Verwerfen an.
Die eingefrorenen 0.2.0-Dateien wurden nicht verändert. Testanpassungen für
Settings-Envelope 1→2 sind oben mit Ursache und explizitem Orakel dokumentiert.

Validierung: Vollständiges Format, Lint, Typecheck und 87 Architekturprüfungen
bestanden. Unitlauf 1260 bestanden / drei ungültige Fault-Fixtures; nach Korrektur
alle 51 Installerfälle bestanden. Integrationslauf 330 bestanden / ein veraltetes
Baseline-Orakel; nach Korrektur alle 50 Fälle in acht betroffenen Baseline-,
Current-format- und Preflightdateien bestanden. Letzte Teständerungen bestehen
ESLint und Typecheck. Referenz-/Generatorartefakte, Version-Truth und Render-
Qualifikationsartefakte sind grün. Build und Smoke ready/closed bestehen.
Bundle-Gate besteht nach vorgeschriebener Absenkung auf 1613493 reachable Bytes,
ohne Änderung der Grenzwerte. Fünf echte E2E-Suiten auf denselben Buildbytes
bestanden: sceneDesktop (sieben Fälle), campaignCreate, campaignCombat, loot und
sessionGeneration (zusammen elf Fälle). Logs work/roadmap-phase4-treasure-main-*.
Keine echte Nutzerinstallation oder Nutzerdaten wurden verändert.

Roadmapabgleich: Die Main-Konvergenz ist lokal geprüft und beseitigt den
festgestellten Mergekonflikt. Sie ersetzt keine vollständige Exact-SHA-CI oder
kanonische Übergabe. Phase 4 bleibt in Arbeit: Verteilungsdialog, weitere
Schreibwege einschließlich Desktop-Aktionen, Update-/Offline-Abnahme. Main hat
die Desktop-Scope-Prüfung um Aufräumarbeiten erweitert; bei der ausstehenden
Qualifikation der Desktop-Schreibwege auch die Trennung dieser Pflege vom
lesenden Wartungsabgleich erneut prüfen. Phasen 5–7, Handoff/Main-Abschluss,
Livetest und Veröffentlichung bleiben offen.

### Phase 4 — Plan: Beuteverteilung zentral klären

Vorheriger Zielturn war Fortschritt: Schatzeditor und Main-Konvergenz sind auf
381e34f4c sauber committed/gepusht, dessen Check 34276677982 läuft. Phase 4
bleibt offen. Für Verteilung existiert bereits eine atomare loot_operation_receipt
mit vollständigem Fingerprint. Diese über einen strikt validierten lesenden Status
mit Originalquittung, aktuellem Schatz und aktueller Partyrevision zugänglich machen.
Verteilung/Status erhalten kampagnengebundene Capabilities und Originalports.
Keine neue Quittungstabelle und keine neue Migration. Native Prüfung unter
query_only, spätere Verteilung/Partyänderung, Fingerprint-/Zielkonflikt und
Kampagnenwechsel vor Domainarbeit bzw. vor/während Transport.

Danach hält der Dialog seine Anteile synchron, einschließlich unverändertem
Ausgangsentwurf, Originalrevisionen und genau einem laufenden Originalcommand.
Zentral Save/Discard wartet auf Write und asynchronen Parentabschluss; Unknown
wird nur gelesen. Fehlende Quittung lässt den Entwurf erhalten; geänderte Schatz-
oder Partyrevision verhindert erneute Buchung auf alter Grundlage. Unberührtes
Öffnen erfordert keine Buchung. Neue Eingaben/Schließen sind während Klärung,
Pending und Unknown gesperrt. Der Planner benennt den Kind-Owner auch vor dem
Lazy-Mount und erhält interne, abgewartete Refresh-/Schließcallbacks.

Gerenderte Tests müssen Mehrfachempfänger, ungültige Anteile, zentrale Klärung,
Abbruch, Pending/Refreshfehler, Unknown/Readretry/Abwesenheit/Revisionskonflikt und
Parentreihenfolge belegen. Danach Loot-/Planner-/Port-/Architekturprüfungen,
Typecheck/Lint und Build/Smoke/Bundle plus echter Loot-Neustartablauf. Der erste
Backend-/Portschritt allein schließt den Dialog nicht; beide Schritte bleiben
Teil desselben Phase-4-Plans.

Korrekturrunde UI-Audit: Die ersten 17 gerenderten UI-/Regressionsfälle bestehen.
Beim noch ladenden Kinddialog benennt der Planner zwar die Abhängigkeit, zählt sie
aber ohne eigenen Parentdraft nicht als offenen Änderungsstand. Die zentrale
Ansicht kann dadurch zunächst nur eine Prüfung statt Save/Discard anbieten.
Offene Kindabhängigkeiten deshalb in isDirty einbeziehen; Tests prüfen sauberen
Parent vor Lazy-Mount und beide Kind-IDs sowie deren synchrone Anmeldung. Die
Verteilungs-Testquittung außerdem als tatsächliche Teilverteilung modellieren.

### Phase 4 — Beuteverteilung: Plan-/Roadmapaudit

Planabgleich bestanden: Bestehende atomare Verteilungsquittungen sind über einen
strikten, kampagnengebundenen Status lesbar. Originalfingerprint und Ziel-ID werden
geprüft; Ergebnisquittung, aktueller Schatz und aktuelle Partyrevision bleiben
getrennt. Verteilung ist ebenfalls kampagnengebunden, einschließlich Unknown nach
Kampagnenwechsel während eines bestätigten Writes. Keine neue Tabelle/Migration.

Der gerenderte Verteilungsdialog besitzt einen zentralen Owner und synchrone
Anteile. Save/Discard warten auf denselben laufenden Write einschließlich
asynchronem Parentabschluss. Unknown und fehlgeschlagener Refresh werden nur
lesend abgeglichen; keine zweite Buchung bei bestätigter Quittung. Abwesenheit
bewahrt Anteile, geänderte Schatz-/Partyrevision blockiert erneutes Buchen auf
alter Grundlage. Ein unberührter Dialog schließt ohne Write. Klärung/Pending/
Unknown sperren neue Eingaben, Splitaktionen und Schließen. Planner-Abhängigkeiten
sind für beide Beutedialoge synchron bekannt, auch vor Lazy-Mount. Interne
Abschlusscallbacks warten den frischen Plannerstand ab und erhalten lokale
Parentänderungen. Ersetzte öffentliche Close-/Fire-and-forget-Refreshprops wurden
aus dem Dialoghost entfernt.

Validierung: 179 Tests in 17 Dateien bestanden. Native Tests prüfen query_only
bei Abwesenheit und nach Buchung, späterem Edit, weiterer Verteilung und Party-
änderung, unveränderte ursprüngliche Quittung sowie Fingerprint-/Zielkonflikte.
Falsche Kampagne wird vor Domainarbeit abgewiesen; Ports sind vor/während
Transport geprüft. Gerenderte Fälle prüfen zwei Empfänger, doppelte Empfänger,
Überbelegung, Bruchteile, zentrale Klärung, Abbrechen, Pending bis Parentrefresh,
Refreshfehler, mehrfachen Readretry, Abwesenheit und beide Revisionskonflikte.
Parent-/Kindtests prüfen Reihenfolge, Kindfehler, Lazy-Mount und stabile synchrone
IDs. Typecheck und gezieltes ESLint bestehen. Build, Smoke ready/closed und
Bundle-Gate grün (1617724 reachable Bytes; keine Baseline-/Budgetänderung).
Loot-E2E mit teilweiser Verteilung/Neustart/Provenienz und sessionGeneration-E2E
mit dauerhaftem Plannerstand über Neustart bestehen auf denselben Buildbytes.
Logs work/roadmap-phase4-distribution-*.log. Keine echte Nutzerinstallation oder
Nutzerdaten verändert.

Roadmapabgleich: Schatzeditor und Verteilungsdialog sind nun vollständig an die
zentralen Wartungsschnittstellen und den abhängigen Planner angeschlossen. Phase 4
bleibt offen: insbesondere Unknown-Recovery der Charakterprofil-Schreibbefehle,
CampaignScreen, weitere Gruppen-/Kampf-/Karten-/Preset-/Desktop-Schreibwege und
Update-/Offline-Abnahme. Die erwähnte Desktop-Scope-Pflege beim Read bleibt bei
deren Qualifikation zu prüfen. Phasen 5–7, vollständige Exact-SHA-CI, kanonischer
Handoff/Main-Abschluss und öffentliche Abnahme bleiben erforderlich.

### Phase 4 — Plan: Charakterprofil-Befehle wiederherstellbar machen

Vorheriger Zielturn war Fortschritt; e21d3e078 ist sauber, Check 34278244449 läuft.
Die Charakter-CRUD-Operationen besitzen noch keine Quittungen. Profile liegen in
PartyStore der Kampagne; LivePlayService koordiniert bei Update/Delete zusätzlich
Szene/Kampf. Im Charakterkatalog blockiert Unknown derzeit dauerhaft; ein
fehlgeschlagener Refresh nach bestätigtem Write wird bisher nur gemeldet.

Zunächst einen strikt validierten Commandvertrag für Create/Update/Delete mit
Originalcommand-ID einführen. Party-eigenes Journal enthält Vollfingerprint und
versionierte Ergebnisquittung (betroffene Charakter-ID plus damaliger Partystand),
ohne löschende Fremdschlüssel und ohne automatische Eviction. LivePlayService
schließt bestehende CRUD-Transaktionen und Quittung in eine gemeinsame Transaktion
ein. Status liest ursprüngliche Quittung und aktuellen Partystand getrennt und
schreibfrei. Beide Capabilities prüfen die ursprüngliche Kampagne vor Domainarbeit.

Neue Kampagnenmigration 37→38 initialisiert ausschließlich diesen Owner; Registry
18, Installation weiter 42. Bootstrap, Versionsvertrag und aktuelle Qualification-
Owner/Readbacks ergänzen. Eingefrorene 0.2.0-Fixtures bleiben unverändert. Native
Tests prüfen alle drei Commands: Rollback bei Quittungsfehler inklusive Szene/
Kampf, Replay, Fingerprintkonflikt, query_only vor/nach Command und nach späterer
Änderung/Löschung, Wiederöffnen sowie unterbrochene Migration mit Datenvergleich.

Danach Charakterkatalog an Originalkampagnenports anbinden. Originalinput und
Originalabschluss bleiben während Write und vollständigem Refresh erhalten.
Unknown-Recovery liest ausschließlich; aktuelle Daten werden frisch übernommen,
nie die alte Ergebnisquittung über neuere Arbeit gelegt. Save/Discard warten auf
Abgleich; abwesende Commands erhalten Entwürfe, geänderte Revisionen verhindern
blinde Wiederholung. Delete wird ausschließlich nach ausdrücklicher Bestätigung
ausgeführt, nie durch zentralen Save eines offenen Bestätigungsdialogs. Gerenderte
Tests decken alle drei CRUD-Wege, verlorene Antwort, fehlgeschlagenen Refresh/Read,
spätere Änderungen, ursprüngliche Kampagne und zentrale Klärung ab.

Vertrags-/Migrationsschritt und anschließender Rendereranschluss erhalten jeweils
gezielte Nachweise; erst zusammen gilt diese Phase-4-Lücke als geschlossen.
Wegen Schemaänderung sind vollständige statische/Unit-/Integrationsprüfungen,
Versions-/Artefaktchecks sowie Build/Smoke/Bundle und passende echte Charakter-/
Kampagnen-E2E erforderlich. Vollständige Exact-SHA-CI/Handoff bleiben maßgeblich.

Korrekturrunde erster Vertragsnachweis: Zwei Testfehler betreffen neue Orakel.
Das Qualification-Manifest muss die topologische Bootstrap-Reihenfolge verwenden;
Party-Quittungen sind erst nach Party bereit und stehen nach character-loot vor
scene. Der Kampftest muss den tatsächlichen Initiativevertrag (label) statt eines
nicht vorhandenen name-Felds vergleichen. Manifestposition und Assertion
korrigieren; die Produktionsbefehle/Transaktionen bleiben unverändert. Die bisher
bestandenen Create-/Delete-/Migrationsfälle und alle geänderten Fälle erneut prüfen.

Fortsetzung derselben Korrekturrunde: Alle 35 ausgeführten Fälle bestehen, darunter
nun Update samt Initiativeabgleich. Der Root-Fixture-Loader verlangt außerdem die
neu erklärte elfte Registrierung in der aktuellen Fixture-Datei. Diese Coverage-
Liste um den bereits implementierten Party-Quittungsowner ergänzen; importierte
Kampagneninhalte und historische Release-Fixtures bleiben unverändert.

Korrekturrunde Handler-Orakel: Format und Produkt-Lint bestehen. Der vollständige
Test-Linter/Typecheck meldet ausschließlich unaufgelösten Handleroutput im neuen
Integrationstest. OperationHandlers liefert absichtlich unknown; das Orakel muss
wie die echte Boundary mit partyCharacterCommandReceiptSchema parsen, bevor es
Felder verwendet. Explizite Outputvalidierung statt Typcast ergänzen und die
vollständige Kette erneut starten. Produktionsvertrag/SQL bleiben unverändert.

### Phase 4 — Audit des Charakterprofil-Vertrags und der Migration

Fortsetzung: Der vorherige Installations-Prüfturn brachte keinen Fortschritt an
 der Roadmap. Arbeitsbaum und laufender E2E-Handle wurden erneut geprüft; Handle
44494 ist erfolgreich beendet. Check 34278244449 für e21d3e078 ist ebenfalls
abgeschlossen und erfolgreich.

Planabgleich des Backend-Teils: Create/Update/Delete und ihre versionierte
Quittung liegen in derselben Kampagnentransaktion, einschließlich Szene/Kampf.
Status prüft den vollständigen Originalfingerprint und liefert ursprüngliche
Quittung und aktuellen Partystand getrennt. Beide neuen Handler prüfen die
Kampagne vor Domainarbeit. Quittungen überleben Löschung und Wiederöffnung.
Migration 37→38 initialisiert ausschließlich den neuen Owner; Installation 42,
Registry 18 und aktuelle Qualification-Verträge sind konsistent. Historische
Release-Fixtures wurden nicht geändert. Keine offene Abweichung im Backend-Teil.

Validierung: vollständiges check:fast erfolgreich (87 Architekturtests,
1281 Unittests, 335 Integrationstests; Format, Lint, Typen und Artefakt-/Versions-
prüfungen). Native Fälle belegen Rollback einschließlich Szene/Kampf bei
Quittungsfehler, Replay, Fingerprintkonflikte, query_only vor und nach späteren
Änderungen, Wiederöffnung und unterbrochene Migration. Build, Smoke und Bundle
bestehen; reachable 1617724 Bytes ohne Budgetänderung. Auf denselben Buildbytes
bestehen sieben sceneDesktop-Fälle und campaignCombat. Logs liegen unter
work/roadmap-phase4-character-receipts-*.log; E2E-Zusammenfassung unter
.tmp/e2e-runs/functional-1788902438927-507715/summary.json. git diff --check besteht.

Separater Roadmapabgleich: Der Backend-Teil erfüllt die Voraussetzung für
lesende Charakter-Recovery, aber noch nicht die bedienbare Fehlerklärung.
Rendereranschluss mit ursprünglicher Kampagne, gehaltenem Write/Refresh und
Save-/Discard-Recovery bleibt der nächste geplante Schritt. Phase 4 bleibt offen;
Phasen 5–7 sowie Exact-SHA-CI, kanonischer Handoff und Main-Abschluss bleiben
unverändert erforderlich. Lokale Buildprüfungen ersetzen keinen Handoff.

### Phase 4 — Konkretisierung des Charakterkatalog-Anschlusses: Originalport

Backend-Commit 508101c9e ist gepusht; dessen Check 34281011400 wurde gestartet.
Der Renderer erhält zunächst einen getesteten Port mit expliziter Kampagnen-ID
vom Katalog. Execute und Status prüfen aktive und geladene Kampagne vor und nach
Transport; ein Wechsel nach Write meldet Unknown. Refresh verwendet die bestehende
Workspace-Projektion und akzeptiert nur ready mit vorhandenem Sessionstand der
ursprünglichen Kampagne. Stale, Fehler und leere Session bleiben Fehler. Tests
prüfen beide Identitäten vor/während aller drei Operationen und Refresh-Ergebnisse.
Danach folgt der bereits geplante Controller-/UI-Anschluss; ein isolierter Port
schließt die Bedienlücke ausdrücklich noch nicht. Beim Anschluss außerdem die
Mount-/Close-Lebensdauer des Katalogs prüfen, damit ausstehende Schreibversuche
beim Schließen nicht aus der zentralen Wartung verschwinden.

Originalport-Nachweis: Zehn Hooktests bestehen; sie prüfen aktive und geladene
Kampagne jeweils vor/während Write, Status und vollständigem Refresh. Ungültige
Refresh-Ergebnisse und Transportfehler werden abgewiesen, ohne Write-Replay.
Vollständiger Typecheck, gezieltes ESLint, Format der neuen Dateien und
 git diff --check bestehen. Logs work/roadmap-phase4-character-port-{tests,types,lint}.log.
Der Port ist noch nicht in den Katalog eingebunden; dieser Zwischenstand ist
lokal und ersetzt keine UI- oder Handoff-Abnahme. Check 34281011400 ist für den
Backend-Commit weiterhin in_progress; PR 661 nennt exakt 508101c9e und MERGEABLE.

Plan-/Roadmapabgleich des Ports: ursprüngliche Kampagnenbindung und bestätigter
vollständiger Refresh sind implementiert und gezielt geprüft. Die geplante
Controller-/UI-Arbeit bleibt offen. Zusätzlicher bestätigter Befund:
CatalogWorkspace rendert CharacterCatalogSection nur für section=characters
und mit campaignId als Key. Der Bereichswechsel in setSection hat keinen
Pending-Guard; useMaintenanceDraft meldet den Owner beim Unmount ab. Deshalb muss
der Charakter-Controller seinen ausstehenden Versuch einschließlich Originalport
unabhängig vom Mount halten, bis lesende Klärung abgeschlossen ist. Vor dem
UI-Anschluss eine solche begrenzte Registrierung für Pending/Unknown umsetzen
und Unmount plus zentrale Save-/Discard-Klärung testen. Allgemeine Hook-Cleanup-
Semantik nicht pauschal verändern. Unbestätigte Entwürfe und Navigation außerdem
im Katalog ausdrücklich behandeln, statt sie beim Bereichswechsel zu verlieren.
Phase 4 bleibt offen; die kanonische Roadmap bleibt unverändert.

### Phase 4 — Plan: Lebensdauer und Recovery eines Charakterbefehls

Vorheriger Zielturn war Fortschritt: Backend gepusht, Originalport implementiert
und geprüft. Check 34281011400 läuft weiterhin. Als nächster konkreter Teil des
UI-Anschlusses einen Charakterbefehls-Controller einführen: ein Versuch hält
Originalinput und Port, wartet Write plus vollständigen Refresh ab und klärt
jeden nicht bestätigten Ausgang ausschließlich über Status plus aktuellen Read.
Eine abwesende Quittung erhält den Entwurf; eine geänderte Partyrevision sperrt
blinde Wiederholung bis zum ausdrücklich verworfenen/neuen Entwurf. Erfolgreiche
Quittungen liefern nur Identität, nie den alten Partystand als aktuelle Anzeige.

Der Controller besitzt attach/detach für UI-Callbacks. Wird er mit Pending oder
Unknown ausgehängt, registriert er selbst einen begrenzten Wartungsowner, dessen
Save und Discard ausschließlich den Originalversuch lesend klären. Nach Abschluss
wird dieser Owner entfernt. Ohne ungelösten Versuch entsteht keine Registrierung.
Bei Rückkehr darf derselbe Controller wieder angebunden werden; keine späten
Navigationscallbacks an bereits geschlossene Oberflächen. Native Befehle bleiben
unverändert. Controller-Tests prüfen alle CRUD-Arten, Vollrefresh, verlorene
Antworten, Abwesenheit/Revisionskonflikt, mehrfachen Readfehler, spätere Löschung,
Unmount während Write/Unknown und anschließende zentrale Klärung ohne Replay.
Die Form-/Navigationsintegration samt Entwurfserhalt bleibt Bestandteil des
anschließenden UI-Schritts und ist nicht durch Controllertests allein abgenommen.

Korrekturrunde Controller-Testumgebung: Fehlerfälle erreichen die vorhandene
Renderer-Fehlerübersetzung, die window.location für die Pseudolokalisierung liest.
Der neue Controllertest lief bisher in Node und scheitert dort vor seinen
Recovery-Assertions. Wie die übrigen Renderer-Controllertests jsdom deklarieren;
Produktverhalten unverändert lassen und sämtliche neuen Fälle erneut prüfen.

Controller-Zwischennachweis: 22 Controller-/Porttests bestehen nach Korrektur der
Testumgebung. Jetzt den Charakterkatalog an diesen Controller anschließen:
Formsave normalisiert das Draftschema und verwendet eine neue Command-ID;
Delete bleibt am ausdrücklichen Bestätigungsklick. UI-Callbacks erhalten Quittung
plus aktuelle Session und wählen nur noch existierende IDs. Save/Discard warten
settle; Readretry ist gesondert sichtbar. Controller attach/detach erfolgt in der
Layout-Lebensdauer. Bestehende Tests mit alten CRUD-Mocks müssen auf die neuen
Capabilities und echte Workspace-Identität umgestellt werden; alte Erwartungen,
die Stale/Refreshfehler als Erfolg behandeln, gelten nicht mehr als Abnahme.

Navigationsanschluss: Der Charakterbereich bleibt nach seinem ersten Öffnen im
Katalog gemountet und wird beim Bereichswechsel verborgen. Dadurch bleiben Form,
Save-Callback und Wartungsowner erhalten, ohne den Charakterchunk vor der ersten
Nutzung zu laden. Die Auswahl nach einem verspäteten Save respektiert den aktuell
sichtbaren Katalogbereich. Bereichswechsel während Wartung werden abgewehrt;
Charakterauswahl/Neu ersetzen keinen noch offenen Form-/Löschentwurf. Schließen des
gesamten Katalogs nutzt für Pending/Unknown den geprüften Detached-Owner. Die
übergreifende Behandlung ungeklärter, noch nicht gesendeter Entwürfe beim Schließen
ganzer Workspacefenster muss in der verbleibenden Desktop-Abnahme geprüft werden.

Korrekturrunde UI-Testlint: Alle 41 ausgeführten Fälle und der Typecheck bestehen.
Zwei Testcallbacks sind unnötig async (Mock liefert synchron berechneten Wert;
act-Callback löst nur Deferred auf). Explizites Promise.resolve im API-Mock und
synchrones act verwenden, anschließend UI-/Controller-/Porttests und Lint erneut.

Korrekturrunde Retention-Testowner: Bereichswechsel und Entwurfserhalt bestehen,
aber der künstliche Testowner meldet Dirty über veralteten React-State, während
Discard synchron zurückkehrt. Wie der echte Charakterowner einen synchronen
Ref für Dirty/Discard verwenden. Dies korrigiert ausschließlich den Testdouble;
der echte Owner verwendet bereits editingRef/confirmRef. Retentiontest erneut.

UI-Audit vor Build: 44 gezielte Tests bestehen. Zwei kleine Vertragsdetails vor
Artefaktprüfung absichern: Fehler auch ohne noch ausgewählten Charakter anzeigen;
den endgültigen Delete-Handler zusätzlich synchron gegen Wartung sperren. Der
Controller übernimmt eine Kopie des Originalcommands, damit spätere Änderungen
an einem aufrufereigenen Objekt nicht den Recovery-Fingerprint verändern können.
Dazu einen Mutationsschutztest ergänzen; danach keine weiteren Sourceänderungen
während Build/Smoke/E2E.

Korrekturrunde Architektur-/Typprüfung: 112 Fälle bestehen; zwei Architekturtests
finden einen Runtime-Schemaimport im Renderer und unlokalisierten Buttontext.
Der Renderer normalisiert die sechs optionalen Profilfelder wie der vorhandene
Partyadapter; Zod-Validierung bleibt an der Capability-Grenze. Button und neue
Controllerhinweise in den typisierten Workspace-Nachrichtenkatalog übernehmen.
Der Retentiontest verwendet außerdem eine nicht unterstützte getByRole-Option
exact; exaktes name-Matching genügt. Keine Regeln/Budgets abschwächen. Danach
Architektur-/UI-Tests, Typen und Lint erneut prüfen.

### Phase 4 — Zwischenprüfung des Charakterkatalog-Anschlusses

Implementiert: Originalkampagnenport, kopierter Commandinput, Controller mit
vollständigem Write-/Refresh-Lebenszyklus, lesender Statusabgleich, Revisions-
konfliktsperre, expliziter Readretry und zentrale Save-/Discard-Anbindung. Nach
Quittungsabgleich wird nur eine im aktuellen Sessionstand vorhandene Charakter-ID
ausgewählt; alter Quittungs-Partystand wird nicht publiziert. Unbestätigtes Delete
wird durch zentralen Save nicht ausgeführt. Neue Charakterauswahl ersetzt keinen
offenen Entwurf. Nach dem ersten Öffnen bleibt der Charakterbereich bei anderem
Katalogbereich verborgen gemountet; sein Entwurf und Wartungsowner bleiben erhalten.
Pending/Unknown nach Unmount behalten einen eigenen Wartungsowner und lösen keine
späte Navigation aus. Der sichtbare Host nutzt display:contents, um die vorhandene
Gridanordnung zu erhalten; versteckte Hosts bleiben ausgeblendet.

Nachweise: 114 Tests in elf Dateien grün (Architektur plus Charakterform, Katalog,
Port, Controller und Bereichs-Retention); vollständiger Typecheck, gezieltes Lint,
Format und git diff --check bestehen. Build/Smoke ready/closed und Bundle-Gate grün,
1621273 reachable Bytes ohne Baseline-/Budgetänderung. Buildidentität: dirty auf
508101c9e, appBuildInputFingerprint
1614e3c4918289137d38563f71d3eff1420a79b4778e49bd560b977ecff38ab5,
BuiltAt 2026-09-08T21:45:25.609Z. Alle sieben sceneDesktop-E2E bestehen. Auf denselben
Bytes läuft campaignCombat noch in Handle 42016. Logs work/roadmap-phase4-character-ui-*.log;
Controller-/Portlogs wie zuvor. Backend-Check 34281011400 ist vollständig SUCCESS.

Separater Roadmapabgleich: Die montierte Charakter-Recovery ist implementiert
und gezielt geprüft. Ein zusätzlicher Lebensdauerfall bleibt offen und verbietet
noch den Abschluss dieser Lücke: Nach Unmount und Status=abwesend wird der
Originalversuch bislang freigegeben, obwohl der geschlossene Editor seinen
ungespeicherten Entwurf nicht mehr anzeigen kann. Zentrale Save darf diesen
Zustand nicht als erfolgreich gespeicherten Entwurf behandeln. Noch nicht
abgesendete Entwürfe beim Schließen des ganzen Workspacefensters gehören ebenfalls
zur verbleibenden Desktop-Klärung. Phasen 4–7 und kanonischer Handoff/Main-Abschluss
bleiben offen. Der aktuelle UI-Stand ist noch nicht committed/gepusht.

### Phase 4 — Nächste Korrekturrunde: abwesender Versuch nach Unmount

Nach Ende des laufenden E2E zunächst dessen Handle/Log auswerten, nicht neu starten.
Dann den Originalentwurf bei bestätigter Abwesenheit nach Unmount weiter halten.
Readretry bleibt rein lesend. Eine ausdrücklich gewählte zentrale Discard-Aktion
darf den nachweislich nicht gespeicherten Entwurf entfernen. Zentrale Save muss
den Entwurf tatsächlich speichern oder einen konkreten Fehler zurückgeben; sie
darf keine leere Erfolgsmeldung erzeugen. Nur nach lesend bestätigter Abwesenheit
und unveränderter Revision darf eine explizite Save-Aktion einen neuen Command
mit neuer ID verwenden. Bei Konflikt bleibt der Entwurf erhalten und Wartung
blockiert, bis ausdrücklich verworfen oder im wieder geöffneten Editor geklärt.
Detached-Owner erst freigeben, wenn weder Versuch noch solcher Entwurf vorhanden.
Tests für Save/Discard, Konflikt, wiederholte Readfehler und neues vs. ursprüngliches
Command-ID-Verhalten ergänzen. Danach passende statische Tests und neu gebaute
Artefaktprüfungen; die bestehenden Buildnachweise gelten nur für den obigen Stand.

Fortsetzung der Korrekturrunde: Vorheriger Zielturn war Fortschritt. E2E-Handle
42016 ist exit 0; alle acht Fälle bestehen, Summary
.tmp/e2e-runs/functional-1788903954257-514679/summary.json. Der Controller wird nun
zwischen ungelöstem Versuch und bestätigt ungespeichertem Entwurf unterscheiden.
Auch nach montierter Abwesenheitsklärung bleibt die Originaleingabe bis zum
expliziten Reset/Save intern verfügbar, falls die Ansicht anschließend schließt.
Nur Detached-Save darf nach erfolgreicher lesender Klärung den gehaltenen Entwurf
mit neuer Command-ID senden; Detached-Discard entfernt ihn ohne Write. Konflikte
bleiben konkret gemeldet und blockieren Save. Bestehende Quittungs-Recovery bleibt
rein lesend und wird nicht wiederholt geschrieben.

Korrekturrunde Testassertion: 121 Tests, vollständiger Typecheck, Build/Smoke/Bundle
bestehen. ESLint findet ausschließlich any im verschachtelten asymmetrischen
Matcher der neuen Konfliktassertion. Ergebnis lokal halten, Länge und konkrete
message mit toContain prüfen; Produktdateien und gebaute Appbytes unverändert.
Danach betroffenen Test/Lint erneut und sceneDesktop auf dem bestehenden Build
prüfen. Dieser E2E enthält echtes Charakter-Create/Update/Delete (Zeilen 464–504).

### Phase 4 — Abschlussprüfung des Charakterbefehls-Anschlusses

Planabgleich: Der Charakterkatalog verwendet Originalkampagnenports und kopierte
Originalinputs für Create/Update/Delete. Pending umfasst Write und vollständigen
Workspace-Refresh. Fehler halten den Versuch; Readretry und Quittungsklärung sind
rein lesend. Spätere Änderungen/Löschungen werden aus dem aktuellen Sessionstand
angezeigt, alte Quittungsdaten nicht darüber publiziert. Konflikte nach
Abwesenheitsbestätigung sperren blinde Wiederholung. Unbestätigtes Delete wird
beim zentralen Save geschlossen, nicht ausgeführt. Eingaben sind während der
Klärung gesperrt, Validierungsfehler erhalten die Form.

Die zusätzliche Unmount-Korrekturrunde ist implementiert und geprüft: Der
Controller hält sowohl ungelöste Versuche als auch bestätigt ungespeicherte
Originalentwürfe. Nach Unmount bleiben beide wartungsrelevant. Save nach
bestätigter Abwesenheit und konfliktfreier Revision sendet ausschließlich auf
explizite zentrale Save-Aktion einen neuen Command mit neuer ID. Discard löscht
den bestätigten Entwurf ohne Write. Readfehler/Revisionkonflikte halten ihn fest;
eine verlorene Antwort des neuen Commands wird mit dessen eigener ID geklärt.
Späte Navigation an die geschlossene Ansicht unterbleibt. Auch ein erst nach
montierter Abwesenheitsklärung geschlossenes Formular behält seinen Original-
entwurf. Keine offene Abweichung innerhalb dieses Befehls-/Recovery-Teilplans.

Validierung: 121 Tests in elf Dateien bestanden (Architektur und gezielte
Charakter-/Katalog-/Port-/Controllerfälle), einschließlich gerendertem Unmount
mit zentralem Save/Discard. Vollständiger Typecheck besteht. Gezielt geänderte
Produkt-/Testdateien sind lintgrün nach der reinen Matcher-Korrektur; alle 18
Controllerfälle danach erneut grün. Vollständiges pnpm format und git diff --check
bestehen. Build, Smoke ready/closed und Bundle-Gate grün, reachable 1621722 Bytes,
keine Baseline-/Budgetänderung. Finaler Build auf dirty 508101c9e:
appBuildInputFingerprint c64e2b3e10bba566c4b7ff5853aa3508580ec283f4436e093d297e5197394854,
BuiltAt 2026-09-08T21:52:46.947Z. Auf diesen unveränderten Appbytes bestehen alle
sieben sceneDesktop-E2E einschließlich echtem Profil-Create/Update/Delete und
Neustart. Summary .tmp/e2e-runs/functional-1788904439533-518181/summary.json;
Logs work/roadmap-phase4-character-detached-*.log. Die anschließende Änderung war
nur eine Unittest-Assertion. Der Kampf-E2E bestand auf dem unmittelbar vorherigen
Build; die letzte Korrektur verändert ausschließlich den Detached-Controller.

Separater Roadmapabgleich: Charakterbefehls-Recovery und Katalogbereichswechsel
sind implementiert und lokal geprüft. Das ist kein Abschluss von Phase 4. Offen
bleiben insbesondere noch nie abgesendete Editorentwürfe beim Schließen ganzer
Workspacefenster, CampaignScreen, weitere Gruppen-/Kampf-/Karten-/Preset-/Desktop-
Schreibwege und die vollständige Update-/Offline-Abnahme. Die bekannte schreibende
Desktop-Scope-Pflege in Readpfaden bleibt zu qualifizieren. Phasen 5–7 sowie
Exact-SHA-CI, kanonischer Handoff und Main-Abschluss bleiben erforderlich. Keine
Nutzerinstallation oder echten Kampagnendaten verändert.

### Phase 4 — Plan: Desktop-Recovery ohne schreibende Reads

Vorheriger Zielturn war Fortschritt: 05bbb492e ist sauber gepusht, Check
34283346372 läuft. Bestätigter offener Befund: SceneDesktopService.validateScope
führt bei read und save cleanupCampaigns und retainScenes aus. Dadurch kann eine
Statusabfrage Layoutdaten löschen. visitCampaignDatabase öffnet inaktive
Kampagnen außerdem schreibfähig und setzt journal_mode=WAL.

Validierung von Scope und Lesen von Layouts von der Bereinigung trennen. Reads
prüfen Existenz und lesen ausschließlich. Bestehende Bereinigung bleibt beim
expliziten permanenten Kampagnenlöschen und beim erfolgreichen Desktop-Save.
Save umschließt Layoutspeicherung und Bereinigung in einer Installationstransaktion,
damit ein stale/fehlgeschlagener Save keine unabhängigen Layouts löscht. Ungültige
Scopes werden vor Schreibarbeit abgewiesen.

CampaignStore erhält für den vorhandenen Visitor einen expliziten Lesezugriff:
inaktive Datenbanken readonly/fileMustExist öffnen, ohne journal_mode zu setzen;
aktive Verbindung weiter verwenden. SceneDesktop-Scopeprüfung nutzt diesen
Lesezugriff. Native Tests erzwingen query_only auf Installation/aktiver Kampagne,
prüfen fehlende/verwaiste/trashed Scopes unverändert, fehlgeschlagenen Save ohne
Cleanup, erfolgreiche Cleanup und inaktive Kampagnen mit unverändertem
DELETE-Journalmodus. SQL bleibt in SceneDesktopStore/SceneStore und Persistenz-
owner. Keine Schemaänderung. Danach passende Integrations-, Typ-/Lint-/Architektur-
prüfungen sowie Build/Smoke und Desktop-E2E; Phase 4 bleibt darüber hinaus offen.

### Phase 4 — Audit: schreibfreie Desktop-Statusabfrage

Planabgleich: SceneDesktopService.read validiert ausschließlich Registry-/Scene-
Existenz und liest den gespeicherten Layoutstand. Ungültige, verwaiste und trashed
Scopes werden ohne Bereinigung abgewiesen. Die Scopeprüfung inaktiver Kampagnen
öffnet diese readonly/fileMustExist und verändert nicht den Journalmodus. Aktive
Verbindungen bleiben unter dem bestehenden Owner; der konkrete Lesepfad ist mit
query_only geprüft. Erfolgreicher Desktop-Save und anschließende Bereinigung
liegen in einer gemeinsamen Installationstransaktion. Stale oder ein Fehler
während Cleanup rollen die gesamte Änderung zurück. Permanente Kampagnenlöschung
behält ihre explizite Cleanup-Anbindung. Keine Schema-/Capabilityänderung.

Nachweise: 88 Architektur-/Persistenzfälle sowie 31 zusätzliche Campaign-Import-
und Desktop-Projection-/Maintenancefälle bestanden. Native Assertions prüfen
query_only auf Installation und aktiver Kampagne, unveränderte verwaiste Layouts
bei Read/ungültigem Scope/stalem Save, Rollback nach injiziertem Cleanup-Abbruch,
readonly inaktive Verbindung ohne Änderung von journal_mode=DELETE, Trash/Restore
und explizites permanentes Cleanup. Vollständiger Typecheck, gezieltes ESLint,
Format und git diff --check bestehen. Build, Smoke ready/closed und Bundle-Gate
grün; unverändert 1621722 reachable Bytes, keine Budget-/Baselineänderung.
Build auf dirty 05bbb492e, appBuildInputFingerprint
d5d745dcb4e06f0ce748bb9cb6d31bde371c88763fb487ee52ff41003ae62491,
BuiltAt 2026-09-08T22:01:37.399Z. Alle sieben sceneDesktop-E2E bestehen auf diesen
Bytes; Summary .tmp/e2e-runs/functional-1788904905195-521685/summary.json.
Logs work/roadmap-phase4-desktop-readonly-*.log. Keine offene Abweichung im Teilplan.

Separater Roadmapabgleich: Der bekannte schreibende Desktop-Read ist behoben und
qualifiziert. Phase 4 bleibt wegen CampaignScreen, übrigen Gruppen-/Kampf-/Karten-/
Preset-/Desktop-Schreibwegen, noch nie gesendeten Entwürfen beim Fensterschließen
und durchgängiger Update-/Offline-Abnahme offen. Phasen 5–7, Exact-SHA-CI,
kanonischer Handoff und Main-Abschluss bleiben erforderlich. Keine echte
Nutzerinstallation/Nutzerdaten geändert.

Nächster konkreter Kandidat ist CampaignScreen: offene Popups besitzen bislang
keinen Maintenance-Owner. run/reconcile verwenden nur ein Boolean-Pending, das
nicht awaitbar ist; New/Rename-Eingaben und unbestätigte Delete-Dialoge müssen
zentral geklärt werden. Der submit-Code entscheidet nach aktuell gefundenem
editing-Objekt statt nach ursprünglicher Popup-Art: verschwindet die umbenannte
Kampagne, darf das nicht in create umfallen. Vor Umsetzung die bestehenden
CampaignWorkspaceProjection-Quittungen und use-campaign-session-coordinator
prüfen, insbesondere automatische Navigation/Unmount nach create/activate und
Fehler beim nachfolgenden enterSession. Den Detailplan vor Sourceänderungen
festhalten und vorhandene Lifecycle-Recovery wiederverwenden.

### Phase 4 — Plan: Kampagnenbefehle bis zum vollständigen Sitzungsstart halten

Vorheriger Zielturn war Fortschritt; 2632726aa ist sauber gepusht und Check
34284009832 wartet. CampaignScreen besitzt lokale Popups ohne Maintenance-Owner.
Vor deren Anschluss muss useCampaignSessionCoordinator seine Wahrheit klären:
enterSession meldet bei fehlgeschlagenem Read bislang nur sessionRetry, kehrt aber
normal zurück; run liefert deshalb true. Ein bestätigtes Create/Activate kann so
als vollständig abgeschlossen gelten, obwohl der Sessionstand fehlt.

Zuerst den Koordinator absichern: awaitbares Pending statt Boolean, ursprüngliche
Zielkampagne des bestätigten Starts bis zum vollständigen Read behalten, Fehler
als false zurückgeben, weitere Schreibbefehle bis Klärung sperren. Erfolgreicher
Read verlangt ready, vorhandene Session und identische aktive/geladene Kampagne
vor/nach dem Read. Retry sendet weder Create noch Activate erneut. Ein stabiler
Maintenance-Owner am Workspace-Koordinator wartet Pending ab und klärt bestehende
Quittungs-Reconciliation bzw. den Sessionread; Save/Discard führen hier dieselbe
lesende Klärung aus. Während zentraler Wartung keine automatische Navigation in
neu gemountete Editoren auslösen. Tests für Fehler/Stale/fehlende Session,
Kampagnenwechsel, laufenden Read und Save/Discard sowie verlorene Quittung ergänzen.

Danach CampaignScreen-Drafts anbinden: synchrone Eingaberefs und Original-Popup-Art,
zentraler Save ausschließlich Create/Rename, Delete nur ausdrücklich bestätigt,
Discard nach abgeschlossener Befehls-/Readklärung, globale Interaktionssperre.
Veraltetes Rename darf nie zu Create werden. Koordinator- und Screenteil getrennt
prüfen, aber erst zusammen als erledigte CampaignScreen-Lücke bewerten. Keine
neue Backend-Migration oder alternative Quittungsimplementierung erforderlich.

Koordinator-Detailprüfung: Auch nach Quittungs-Recovery muss enterSession an
receipt.campaignId gebunden sein; bei Create an die bestätigte Ergebnis-Kampagne,
bei Activate an die ursprüngliche ID. Eine inzwischen neuere Projektion darf
nicht still zur Zielkampagne des alten Befehls werden. Pro zentraler Klärung
höchstens einen erneuten Sessionread ausführen; wiederholte Fehler bleiben für
den nächsten ausdrücklich ausgelösten Versuch offen. Öffentliche Schreibaktionen
zusätzlich synchron gegen globale Wartung und ausstehende Reconciliation sperren.
Der spätere Screen-Save benötigt dafür einen ausdrücklich internen Wartungsweg.

Korrekturrunde Typprüfung: Lint und 27 Tests bestehen. Beim Ergänzen des
Receipt-Typimports wurde dieser vor die vorhandene vite/client-Referenz gesetzt;
damit wirkt die Triple-Slash-Referenz nicht mehr und der Test-Typecheck verliert
SVG-URL-Deklarationen. Import hinter die Dateidirektiven verschieben, keine
Projektkonfiguration ändern. Zusätzlich Create mit bestätigtem Ergebnis und
fehlgeschlagenem Read prüfen; erneute Create-Aktion muss bis Read-Recovery gesperrt
bleiben. Danach Typen und Koordinatortests wiederholen.

### Phase 4 — Audit des gehaltenen Kampagnen-Sitzungsstarts

Planabgleich Koordinatorteil: Pending ist awaitbar und umfasst den vollständigen
Befehl plus Sessionread. Bestätigte Create-/Activate-Ziele bleiben bei fehlendem,
veraltetem oder fehlgeschlagenem Read erhalten; run liefert false statt eines
falschen Gesamterfolgs. Weitere Schreibbefehle sind bis zur Klärung gesperrt.
Die Ziel-ID stammt aus dem bestätigten Create-Ergebnis, dem Activate-Auftrag oder
der ursprünglichen Quittung. Eine inzwischen andere aktive Kampagne wird nicht
als Ersatz geöffnet. Retry liest ausschließlich; kein erneutes Create/Activate.
Der stabile Workspace-Maintenance-Owner wartet Pending und vorhandene
Quittungs-Reconciliation ab und hält fehlgeschlagenen Sessionstart offen. Save
und Discard klären diesen Teil beide lesend. Während zentraler Wartung erfolgt
keine automatische Navigation in neu gemountete Workspace-Editoren. Öffentliche
Schreibaktionen sind zusätzlich synchron bei Wartung gesperrt.

Validierung: 106 Tests in neun Dateien bestanden (Architektur, Koordinator,
Workspace-Projektion und bisherige CampaignScreen-Fälle). Neue Fälle prüfen
Create-/Activate-Readfehler, Verhinderung doppelter Befehle, fehlende/abweichende
Sessionstände, ursprüngliche Kampagne, laufenden Read, zentrale Save-/Discard-
Klärung, gescheiterte Quittungs-Recovery und globale Schreibsperre. Vollständiger
Typecheck, gezieltes Lint, Format und git diff --check bestehen nach Wiederherstellen
der Test-Dateidirektive. Build, Smoke ready/closed und Bundle-Gate grün;
1622594 reachable Bytes ohne Baseline-/Budgetänderung. Auf denselben Appbytes
besteht campaignCreate-E2E mit echtem Anlegen und Wechseln. Summary
.tmp/e2e-runs/functional-1788905575321-525268/summary.json. Build auf dirty
2632726aa, appBuildInputFingerprint
5b5465f0d61dcab8c63275c343be2936793f40effb32118961dfcc2b121824d6,
BuiltAt 2026-09-08T22:12:47.389Z. Logs work/roadmap-phase4-campaign-entry-*.log.
Keine offene Abweichung im Koordinatorteil des Plans.

Separater Roadmapabgleich: CampaignScreen ist noch nicht vollständig angebunden.
Die Namens-/Löschpopup-Entwürfe besitzen weiterhin keinen eigenen zentralen
Save-/Discard-Owner. Ihr Anschluss muss nach einem fehlgeschlagenen Befehl
zwischen bestätigtem Write, noch offener Recovery und bestätigter Nichtausführung
unterscheiden. Boolean-Ergebnisse allein genügen dafür nicht: insbesondere darf
ein inzwischen durch den Koordinator geklärtes Create nicht aus dem noch offenen
Namenspopup erneut ausgeführt werden. Für den Screenteil einen an den ursprünglichen
Versuch gebundenen Abschlussstatus/Handle vorsehen, vorhandene Projektionsquittungen
weiterverwenden und den expliziten internen Wartungs-Save von öffentlichen Aktionen
trennen. Anschließend Original-Popup-Art und synchronen Namen/Bestätigung halten,
veraltetes Rename niemals zu Create umdeuten, unbestätigtes Delete zentral nur
schließen, Eingaben sperren und Save/Discard/Cancel/Unknown/Readfehler gerendert
prüfen. Vor Sourceänderungen den konkreten Schnittstellenplan protokollieren.
Phase 4, Phasen 5–7, Exact-SHA-CI, Handoff/Main und öffentliche Abnahme bleiben offen.
Keine Nutzerinstallation oder echten Kampagnendaten verändert.

### Phase 4 — Plan: ursprünglicher Abschlussstatus für Kampagnendialoge

Vorheriger Zielturn war Fortschritt; 05c83d699 ist sauber, Check 34284992539 wartet.
Die Screen-Anbindung benötigt zuerst ein Ergebnis je ursprünglichem Versuch.
Frontend-Vertrag CampaignActionAttempt enthält completion (bisheriges Boolean für
bestehende Aufrufer) und settle mit confirmed/absent/pending. Begin erhält einen
unveränderlich kopierten Create/Activate/Rename/Trash/Restore/Delete-Auftrag.
Bestehende öffentliche Aktionen delegieren dorthin; keine zweite Backend- oder
Reconciliation-Implementierung einführen.

Je Versuch Start, bestätigten Write, ursprüngliche Reconciliation-Command-ID und
noch offenen Sessionread halten. Die vorhandene Reconciliation aktualisiert nur
den dazugehörigen Versuch. Alte Handles dürfen nicht das Ergebnis späterer
Befehle übernehmen. settle liest/klärt ausschließlich und bleibt nach bestätigter
Nichtausführung absent; ein neuer Save muss einen neuen Versuch beginnen. Ein
interner maintenance-Aufruf darf die globale UI-Sperre nur für Create/Rename
umgehen, niemals für Activate/Trash/Restore/Delete. Pending/Reconciliation-
Sperren gelten weiterhin. Tests decken direkte Bestätigung, Abweisung, Unknown,
Abwesenheit, bestätigten Write plus Readfehler, zentrale Klärung vor Handle-Abfrage,
unveränderten Originalinput und spätere unabhängige Befehle ab. Danach Screen
schrittweise mit diesen Handles verbinden; dessen Lücke bleibt bis dahin offen.

### Phase 4 — Audit des ursprünglichen Kampagnen-Abschlussstatus

Planabgleich: CampaignActionAttempt hält completion und den lesend klärbaren
Status confirmed/absent/pending je ursprünglichem Versuch. beginCampaignAction
kopiert den Auftrag; die bestehenden sechs öffentlichen Methoden delegieren
auf denselben Ablauf. Der Koordinator hält Start, Writebestätigung, ursprüngliche
Quittungs-ID und ausstehenden Sessionread pro Versuch. Bestehende Reconciliation
aktualisiert den passenden Versuch; auch eine schon zentral erledigte Klärung
bleibt danach am ursprünglichen Handle erkennbar. Spätere Befehle ändern dieses
Ergebnis nicht. Nicht gestartete/abgewiesene und bestätigt nicht ausgeführte
Versuche sind absent, verlorene Antworten bleiben pending bis zur bestehenden
lesenden Recovery. settle sendet keinen Ersatzbefehl. Interner Maintenance-Start
umgeht die globale UI-Sperre ausschließlich für Create/Rename; ausstehende
Befehle/Reconciliation bleiben gesperrt. Keine zusätzliche Backend-Quittungskette.

Validierung: 42 Koordinator-/Projektions-/bestehende Dialogtests und 69 Architektur-
tests bestanden. Neue Nachweise prüfen unveränderten Originalinput, unabhängige
spätere Befehle, Unknown mit wiederholtem Readfehler, zentrale Klärung vor
Handle-Abfrage, bestätigte Abwesenheit und bestätigtes Create plus Readfehler.
Wartungsweg erlaubt ausschließlich Create/Rename; Activate/Trash/Restore/Delete
bleiben nachweislich ohne Aufruf. Vollständiger Typecheck, gezieltes ESLint,
Format und git diff --check bestehen. Build, Smoke ready/closed und Bundle-Gate
grün; 1623965 reachable Bytes ohne Baseline-/Budgetänderung. Kampagnen-E2E mit
echtem Create und Wechsel besteht auf denselben Appbytes. Summary
.tmp/e2e-runs/functional-1788906092971-527475/summary.json. Build auf dirty
05c83d699, appBuildInputFingerprint
3525d6dcd5a297a4fcceff3373b7de86aabb0a1cb35ee7794e0ffda997a232bf,
BuiltAt 2026-09-08T22:21:25.152Z. Logs work/roadmap-phase4-campaign-attempt-*.log.
Keine offene Abweichung im Abschlussstatus-Teilplan.

Separater Roadmapabgleich: Der neue Vertrag ist im Koordinator aktiv, aber
CampaignScreen verwendet weiterhin die bisherigen Boolean-Aktionen. Sein
Maintenance-Owner und die Dialogeingaben sind noch anzubinden; diese Lücke und
Phase 4 bleiben offen. Alle weiteren Roadmapphasen und Exact-SHA-CI/Handoff/Main
bleiben unverändert erforderlich. Keine echten Nutzerdaten verändert.

### Phase 4 — Konkreter nächster Schritt: CampaignScreen-Dialogowner

CampaignScreen über einen begin-Prop an beginCampaignAction anschließen und je
laufendem Auftrag Handle plus ursprünglichen Abschlusscallback halten. Pending
muss awaitbar sein. Ein gemeinsamer drain wartet den Versuch und liest dessen
Status: confirmed führt genau den ursprünglichen Abschluss aus, absent erhält
den Entwurf, pending verhindert Wartung. Dadurch kann der Koordinator zuerst
zentral klären, ohne dass Screen-Save danach ein bestätigtes Create wiederholt.
Kein Rückschluss allein aus aktuellen Boolean-Props.

Popup-, Name- und Bestätigungseingaben synchron in Refs halten. Originale Popup-Art
und bei Rename ursprüngliche ID/Name behalten; fehlende oder inzwischen umbenannte
Kampagne erklärt einen Konflikt und erhält die Form. Ein Editdialog rendert auch
bei verschwundener Kampagne weiter und kann nie zu Create umfallen. Zentrales
Save klärt zuerst drain, startet danach nur Create/Rename über den internen
Wartungsweg oder schließt einen unbestätigten Delete-/Trashdialog ohne Write.
Discard wartet drain und verwirft anschließend ausdrücklich die Eingaben.
Public-Handler, Close und Eingaben bei globaler Klärung synchron sperren; Cancel
behält den Entwurf. Readretry verwendet zuerst das Originalhandle. Bestehende
Aufruf-/Testfixtures auf den neuen begin-Vertrag umstellen, statt einen zweiten
Boolean-Fallback einzubauen. Gerenderte Fälle für alle Save/Discard/Cancel-
Ausgänge, Pending, zentrale Vorab-Recovery, Abwesenheit, unveränderte Original-ID,
fehlgeschlagenen Read und veraltetes Rename ergänzen. Danach passenden Build/E2E
qualifizieren und beide Teile zusammen auditieren.

Fortsetzung CampaignScreen-Dialogowner: Vorheriger Turn war Fortschritt; 3e18fad45
ist sauber und sein Check 34285789972 wartet. Jetzt den dokumentierten Screenplan
umsetzen. Die sechs Boolean-Actionprops durch den begin-Vertrag ersetzen; bestehende
Testaktionen erhalten ausschließlich im Fixture einen passenden Attempt-Adapter.
Production erhält keinen Boolean-Fallback. Pending- und Eingaberefs sind synchron;
der ursprüngliche Abschlusscallback wird erst bei confirmed ausgeführt. Ein
absenter Versuch entfernt nur den Versuch, nicht den Namensentwurf. Lokale Fehler
werden im Dialog angezeigt. Der Workspace-Koordinator bleibt Owner globaler
Befehls-/Session-Recovery, CampaignScreen wird Owner seiner Eingaben und des
ursprünglichen UI-Abschlusses. Zentrale Discard führt keine Write-Aktion aus.

Korrekturrunde Dialog-Orakel: 39 Fälle bestehen. Drei neue Selektoren verwenden
abweichende Texte statt der bestehenden Labels „Löschen …“ und „Erstellen & öffnen“;
diese korrigieren. Der bisherige Pending-Test erwartete nach false sofort wieder
Save. Nach dem neuen Vertrag muss zuerst das Originalhandle lesend absent melden;
den Test um den ausdrücklichen „Ergebnis prüfen“-Schritt ergänzen und danach
Editierbarkeit prüfen. Keine Produktionssperre zugunsten des alten Orakels lockern.

Dialog-Zwischenprüfung: 43 Fälle bestehen. Vor der integrierten Prüfung auch einen
geworfenen Handle-Read-/Completionfehler als unklaren Versuch sichtbar halten;
sonst könnte die nächste lesende Aktion trotz erhaltenem Attempt fehlen. Bei
unverändertem Rename-Namen nach gültigem Konfliktcheck den Dialog ohne unnötigen
Write schließen. Danach einen realen CampaignWorkspaceProjection-/Koordinator-
und Screen-Test ergänzen: bestätigtes Create, fehlgeschlagener Sessionread,
zentraler Save klärt zuerst den Koordinator und schließt danach den Originaldialog,
bei genau einem Create-Transport. Dies ergänzt die bisherigen getrennten Tests.

Abgleich nach 129 bestandenen Tests: Koordinator und Dialog müssen ihre vorhandene
Owner-Abhängigkeit ausdrücklich deklarieren. Sonst könnte nach einem fehlgeschlagenen
Koordinatorread der Screen im selben globalen Durchlauf sofort einen zweiten Read
starten. Stabile ID im Koordinator mit useId erzeugen, an dessen Registrierung und
CampaignScreen weiterreichen; Screen dependsOn verwenden. Standalone-Screentests
benötigen keinen künstlichen Parent, daher optionaler Dependency-Prop. Gemeinsamen
Test verschärfen: erster zentraler Read scheitert, Dialog bleibt unverändert und
startet keinen zweiten Read; erst die nächste zentrale Aktion klärt beide Owner.

Korrekturrunde Test-Lint: Produkt-Lint und Typecheck bestehen. Die neue lokale
TestActions-Typdeklaration verwendet Methodensignaturen; ihre Mock-Assertions
lösen dadurch unbound-method aus. Wie zuvor Funktionsproperties deklarieren,
ohne this-Kontext und ohne Regel-Ausnahmen. Danach die betroffenen Checks erneut.

Zusätzlicher Auditbefund während des laufenden E2E (Handle 6047): Der neue
Originalhandle-Zweig ist geprüft. Der verbleibende allgemeine reconcile-Zweig
ohne lokalen Versuch übernimmt jedoch noch den alten removedFocus-Abschluss.
Wird eine andere/ältere Recovery bei einem neu geöffneten Namenspopup geklärt,
könnte sie dessen unabhängigen Entwurf schließen; außerdem könnte der Koordinator
nach Create/Activate automatisch navigieren. Die vorhandenen Reconciliation-UI-
Tests stellen einen solchen unabhängigen offenen Entwurf bereits dar, bislang
aber nur mit null als Ergebnis.

Korrektur nach Ende des laufenden E2E: Allgemeinen Screen-Recovery-Aufruf mit
explizitem stayOnCampaigns an den Koordinator geben. Nur dieser Readabschluss
unterdrückt zusätzliche Navigation; normale Originalhandle-Recovery behält ihr
bisheriges Verhalten. Im allgemeinen Screen-Zweig lediglich Status melden,
keinen fremden Popup-/Name-/Bestätigungszustand schließen. Test mit bestätigter
älterer Create-Quittung und unverändertem neuerem Namensentwurf ergänzen sowie
Koordinatortest zur unterdrückten Navigation. Keine Sourceänderung während der
laufenden Artefaktprüfung; deren Handle zuerst abschließen/auswerten.

Artefaktzwischenstand: Handle 6047 ist exit 0; campaignCreate und alle sieben
sceneDesktop-Fälle bestehen. Summary
.tmp/e2e-runs/functional-1788906924471-530627/summary.json. Jetzt die bereits
geplante unabhängige Dialog-Recovery korrigieren; danach neue Appbytes bauen und
die geänderte Navigation mit Koordinatortest und campaignCreate erneut prüfen.

Korrekturrunde letzter UI-Selektor: 130 Fälle bestehen. Im neuen Recoverytest
existieren bewusst sowohl die allgemeine Recoveryanzeige als auch der neue
Statushinweis; getByRole('status') ist deshalb mehrdeutig. Den konkreten
Bestätigungstext abfragen und anschließend unveränderte Eingabe/Dialog prüfen.
Produktverhalten unverändert; betroffenen Test und statische Prüfung abschließen.

Fortsetzungsprüfung 2026-09-09: Die letzte Selektorkorrektur besteht mit 26/26
CampaignScreen-Tests. Die zuvor gestarteten Typecheck- und Lint-Handles 48373 und
77194 enden beide mit exit 0. Neuer Build, Built-Smoke, Bundlebudget und
campaignCreate bestehen zusammen (Handle 25897, exit 0). Geprüfter
appBuildInputFingerprint: 475371c460a29ea1593a290dc54e7f1a4cc274f290c981486f885bbb95ca276b.
E2E-Summary: .tmp/e2e-runs/functional-1788907475723-533947/summary.json.

Planabgleich Dialogintegration: Originalversuche werden ohne Write-Wiederholung
geklärt, zentrale Create-/Rename-Saves sind explizit begrenzt, Delete bleibt
bestätigungspflichtig, fremde Recovery erhält unabhängige Entwürfe und Navigation.
Der integrierte Parent-/Child-Test verhindert einen zweiten Recoveryread im selben
fehlgeschlagenen Wartungsdurchlauf. Die lokale Dialogintegration erfüllt damit den
aufgezeichneten Teilplan. Roadmap-Abgleich: Phase 4 bleibt offen; insbesondere
Fensterschluss, übrige Writer und vollständige Updatebedienung sind nicht durch
CampaignScreen-Tests abgenommen.

Neuer CI-Befund: Run 34285789972 für 3e18fad ist abgeschlossen mit failure.
Linux E2E hex-npc-restart scheitert im currentFormatCampaignQualification-Test
beim Wechsel von Current Format A nach B: Kampagnenübersicht erscheint nicht.
Heruntergeladener CI-Screenshot zeigt ausdrücklich die Meldung über offene
Editoränderungen, obwohl nur die Szenenübersicht sichtbar ist. Dies ist kein
Beleg für einen Infrastrukturfehler. Aggregate scheitert folgerichtig ebenfalls.

Korrekturplan: Zunächst denselben Current-Format-Test mit den eben geprüften Bytes
lokal ausführen (Handle 79341); keine Sourceänderung währenddessen. Den konkreten
noch schmutzigen Owner und seine Lebensdauer ermitteln, bevor die Navigationssperre
verändert wird. Reale Entwürfe müssen erhalten bleiben; ein Test-Timeout oder das
pauschale Entfernen der Sperre wäre keine Lösung. Nach belegter Ursache fokussierte
Regression ergänzen und danach den echten Wechseltest erneut qualifizieren.
Kein Handoff und keine Main-Promotion auf Grundlage des fehlgeschlagenen CI-Laufs.

Lokale Reproduktion endet ebenfalls mit Produktfehler (Handle 79341, exit 1),
Summary .tmp/e2e-runs/functional-1788907593877-534921/summary.json. Fokussierter
nächster Schritt: Die bisher pauschale Meldung beim blockierten Kampagnenwechsel
um die vorhandenen Owner-Bezeichnungen ergänzen. Der Koordinator liefert dazu
nur lesend die Namen schmutziger Bereiche; keine Auflösung oder Writes. Damit
wird die nächste Aktion auch für Nutzer zuordenbar und der reproduzierte Befund
konkret diagnostizierbar. Bestehende Navigationssperre unverändert erhalten;
Unit-Test prüft benannten Bereich und weiterhin blockierte Navigation.

Diagnose bestätigt: Screenshot der zweiten lokalen Reproduktion benennt
Szenendesktop als einzigen offenen Bereich; Handle 55527 endet mit exit 1.
37 Unit-Tests sowie Typecheck/Lint der Bereichsanzeige bestehen. Der Desktop
führt bereits ausgelöste automatische Layoutwrites; die Navigation prüft deren
kurzzeitig schmutzigen Zustand synchron und bleibt danach ohne erneuten Klick stehen.

Korrekturplan: Optionales Owner-Protokoll zum Abschluss bereits beauftragter
Hintergrundwrites ergänzen. Nur Desktop implementiert es: geplanten Autosave
abschließen, laufenden Write abwarten, Fehler/unklares Ergebnis behalten. Dies
ruft weder generische Editor-Saves noch Discard oder Recovery-Replay auf. Beim
Kampagnenwechsel zunächst diese Writes abwarten, anschließend globale Sperre,
Originalkampagne und weiterhin offene Entwürfe erneut prüfen. Neue Entwürfe während
des Wartens müssen die Navigation ebenfalls verhindern. Tests für laufenden und
geplanten Desktopwrite, Fehler und einen währenddessen geöffneten Entwurf ergänzen.
Danach echte Current-Format-Qualifikation erneut ausführen; deren Grenzwerte bleiben.

Korrekturprüfung Autosave: 76 Tests in vier Dateien bestehen, einschließlich
laufendem/geplantem/fehlgeschlagenem Desktopwrite und erneutem Dirty-Check nach
Wartezeit. Typecheck und ESLint bestehen (42713/80450, beide exit 0), ebenso 69
Architekturtests (54323, exit 0). Build, Built-Smoke und Bundlebudget bestehen.
Die zuvor zweimal reproduzierbar fehlgeschlagene Current-Format-Qualifikation
besteht jetzt vollständig einschließlich Neustart und persistierter nächster
Szenenänderung: 100 Messungen, p95 155.304 ms, Maximum 171.421 ms. Die unveränderten
Grenzen bleiben 1.000 ms p95 / 10.000 ms Maximum. campaignCreate läuft anschließend
mit denselben Bytes; dessen Ergebnis steht noch aus (Gesamthandle 22774).

Plan-Audit Autosave: Nur der Desktop bietet settleBackgroundWrites an; sein
bestehender Speicherauftrag wird abgearbeitet. Generische save/discard-Callbacks
bleiben unaufgerufen. Unklare Writes bleiben dirty, die Navigation prüft danach
Sperre, ursprüngliche Kampagne und neue Entwürfe. Die Bereichsnamen sind aus dem
vorhandenen Ownerregister abgeleitet. Keine SQL-, Profil- oder Schemaänderung.
Roadmap-Audit: Diese Korrektur schließt die aufgedeckte Navigationsregression und
verbessert die zuordenbare Fehleranzeige in Phase 4. Sie ersetzt weder die noch
ausstehende Fensterentwurfsbehandlung noch die Artefakt-/Releasephasen 5 bis 7.

Abschluss dieser Korrekturrunde: Handle 22774 endet mit exit 0. Beide echten
E2E-Suiten currentFormatCampaignQualification und campaignCreate bestehen mit
appBuildInputFingerprint 011277ba89d5a1d0aaebb4193a8a5566c27f329a4b73f6915bbeac41109f6c7f.
Summary: .tmp/e2e-runs/functional-1788907966361-537722/summary.json.
Formatprüfung der zehn betroffenen Quell-/Testdateien sowie git diff --check
bestehen. Den zusammengehörigen Dialog-/Navigationsstand jetzt als Candidate
committen und pushen; vollständige Remote-Prüfung dieses neuen SHA bleibt Pflicht.
Phase 4 bleibt in Arbeit, Handoff/Main/Liveabnahme/Veröffentlichung unbestätigt.

Phase 4, nächster Teilplan – Entwürfe vor Arbeitsbereichswechsel erhalten:
Candidate 28a6364d2 ist sauber; Remote-Run 34288396494 läuft. Read-only-Prüfung
zeigt neben Desktop-close/minimize einen unmittelbaren Verlustpfad: WorkspaceRail
ruft den rohen setWorkspace auf, ModuleHost ersetzt den bisherigen Bereich.
CharacterCatalogSection hält noch nicht abgeschickte Formdaten nur im gemounteten
Editor. Dessen Registrierung verschwindet beim Wechsel; der bestehende detached
Commandcontroller kann nur bereits abgeschickte Versuche halten.

Zuerst diesen übergreifenden Routenpfad schließen: Einen Shell-Hook für bestätigte
UI-Übergänge erstellen, der die vorhandene Wartungsregistrierung und globale Sperre
verwendet. Bereits beauftragte Hintergrundwrites vorab abwarten; bei offenen
Entwürfen den ursprünglichen Bereich erhalten und Save/Discard/Cancel zeigen.
Gemeinsame Dialogdarstellung mit der bestehenden Releasebestätigung verwenden.
Savefehler bleiben bereichsbezogen; Teil-Saves bleiben erhalten; Cancel schreibt
nichts. Bei Unmount oder geänderter Kampagnenidentität keine verspätete Navigation.
WorkspaceRail, Rückkehr zur Sitzung, Charakter-/Referenznavigation und obere
Desktop-Öffnungen müssen den gesamten jeweiligen Übergang kapseln, damit keine
Nebenwirkung vor dem bestätigten Wechsel erfolgt. Wechsel innerhalb desselben
Arbeitsbereichs bleibt bei dessen bestehenden Editorregeln.

Prüfung: Hook/UI mit nie abgeschicktem Entwurf, mehreren Ownern, Teilerfolg,
Verwerfen, Abbrechen, laufendem Save, neuem Dirty-Zustand während Autosave-Wartezeit,
Unmount und Identitätswechsel. Bestehende Release-UI-Tests sichern die extrahierte
Darstellung. Anschließend Typecheck/Lint/Architektur, Build und relevante echte
Navigationstests. Desktop-close/minimize und weitere Writer bleiben eigenständig
in Phase 4 offen; dieser Teilplan erklärt sie nicht für erledigt.

Korrekturrunde Testaufbau: Der neue Hooktest hat die in der App vorhandene
ModalLayerProvider-Umgebung noch nicht eingebunden; deshalb schlagen seine sieben
Fälle vor der Verhaltensprüfung fehl. Provider ergänzen. Für den synchronen
Testentwurf eine echte useRef statt mutiertem useState-Objekt verwenden und
Promise-returnende Testcallbacks ohne unnötiges async deklarieren. Der angenommene
Dateiname release-settings.test.tsx existiert nicht; die tatsächlichen
ReleaseSettings-Prüfungen ermitteln, bevor deren Ausführung behauptet wird.

Zusätzlich Produkt-Lint: Den UI-Zustand bei geänderter Übergangsidentität bedingt
im Render zurücksetzen, statt setState im Layout-Effekt aufzurufen. Der Effekt
behält ausschließlich Lebensdauer/Abbruch der laufenden Aufträge. Keine Lockerung
der React-Regel. Tatsächlicher Release-UI-Test: profile-recovery-ui.test.tsx.

Zwischenprüfung: 132 Tests (11 Dateien), Typecheck und Produkt-Lint bestehen.
Build und Built-Smoke bestehen. Bundlecheck stoppt vor E2E mit Pflicht-Ratchet:
Hex -3584, Katalog -3339, Referenz -51 und Shell -44 Bytes. Die gemeinsame
Dialogdarstellung verschiebt diese Abhängigkeiten; der gesamte erreichbare Graph
liegt +15108 Bytes über alter Baseline, innerhalb des bestehenden 16-KiB-Limits.
Nur gesunkene Teilbudgets nachziehen; keine Grenzerhöhung zum Bestehen des Checks.
Danach Budgetcheck und die noch nicht gestarteten E2E auf vorhandenen Bytes ausführen.

CI-Befund des vorherigen 28a6364d2: Portable-Lint beanstandet den seit dem letzten
Autosavefix Promise-returnenden showCampaigns-Prop in workspace.tsx. Die neue
vollständig gekapselte Navigation verwendet dort bereits einen void-Callback und
besteht gezieltes Produkt-Lint. Vor erneutem Push bleibt vollständiges Renderer-
Lint erforderlich; der frühere Candidate ist damit weiterhin nicht handofffähig.

E2E-Korrekturplan: Der neue workspace-isolation-Fall scheitert am Testselektor
`.catalog-section-selector button=Charaktere`: WebDriver akzeptiert die Kombination
von CSS-Vorfahren und Textstrategie nicht als einen Selektor. Elterncontainer
zuerst mit CSS auswählen, dessen button=Charaktere bzw. button=Neu separat suchen.
Die Produktbytes unverändert lassen. Laufenden Gesamthandle 53502 zunächst
abschließen, da Current-Format noch auf denselben Bytes folgt. Danach nur den
betroffenen Workspace-E2E erneut ausführen, keine Zeitgrenzen lockern.

Teilprüfung vor Candidateabschluss: 132 Architektur-/Featurefälle bestehen;
Typecheck (8230) und vollständiges partitioniertes Lint (63584) jeweils exit 0.
Die ReleaseSettings-Extraktion ist durch 12 vorhandene profile-recovery-ui-Fälle
und sieben neue Übergangsfälle abgedeckt. Build/Built-Smoke bestehen, ebenso der
Budgetcheck nach ausschließlich nach unten korrigierter Baseline. Geprüfter
appBuildInputFingerprint: 1c11b3230857224567439a4cbe37b1ae28c4e49148aaf49a3c2463849595261b.

Current-Format besteht vollständig (Gesamthandle 53502 endet wegen des separaten
Workspace-Testselektors mit exit 1): 100 Wechsel, p95 150.961 ms, Maximum 160.878 ms,
Szenenänderung und anschließender Neustart bestätigt. Zusammenfassung
.tmp/e2e-runs/functional-1788908766491-542036/summary.json. Korrigierter Workspace-
Test läuft separat als Handle 20958; Produktbytes unverändert.

Plan-Audit: Vor Routenwechseln bleiben die realen Editorinstanzen gemountet.
Die gemeinsame Dialogdarstellung bietet Save/Discard/Cancel, die vorhandenen
Owner verantworten Speicherung und Fehler. Hintergrundwrites werden zuerst beendet;
neue Entwürfe während dieses Wartens werden danach entdeckt. Auftragsidentität,
Unmount und globale Sperre verhindern verspätete Übergänge. Charakter- und
Referenznavigation kapseln ihre Auswahl-/Öffnungsnebenwirkung bis zur Freigabe.
Roadmap-Audit: Der Routenverlustpfad für nie abgeschickte Entwürfe ist implementiert;
seine echte Charakter-E2E-Abnahme steht noch aus. Desktop-close/minimize,
Szenenwechsel und weitere direkte Writer bleiben zu prüfen. Phase 4 bleibt offen.

E2E-Korrekturrunde Elementlebensdauer: Handle 20958 endet mit exit 1, obwohl alle
drei Workspace-Verhaltensfälle bestehen. Die verpflichtende Warnungsprüfung zählt
sechs staleElement-Warnungen. Der neue Test hält Input und Dialog über deren
bewusstes Entfernen/erneutes Öffnen hinweg fest. Diese Elemente vor jeder Aktion
über ihre stabilen Selektoren neu beziehen. Warnungsgrenze und Produkt unverändert;
Workspace-Suite erneut auf identischen Appbytes prüfen. Vollständiges Format
(7790) ist bereits exit 0. E2E-Abnahme noch nicht als vollständig bestanden werten.

Abschluss Routen-Korrekturrunde: Handle 90322 endet mit exit 0. Alle drei echten
Workspace-Fälle bestehen einschließlich neuem Charakterentwurf, Abbrechen,
zentralem Save, Rückkehr mit gespeichertem Charakter und anschließendem Discard
eines anderen Entwurfs. Keine staleElement-Warnungsregression mehr. Summary:
.tmp/e2e-runs/functional-1788909159467-544032/summary.json. Produktbytes sind dieselben
wie bei Built-Smoke/Budget und bestandenem Current-Format-Test.

Abschließender Plan-Audit: Die reale Editor-E2E ergänzt die Hook-/Ownerprüfungen;
Routenschutz ist damit implementiert und automatisiert geprüft. Gemeinsame
Release-Dialogdarstellung bleibt durch die vorhandenen UI-Fälle abgedeckt.
Roadmap-Audit unverändert: Phase 4 ist nicht geschlossen. Desktopfenster-Schließen,
Minimieren, Szenenwechsel und weitere Writer sind nächste Prüffelder; vollständige
Updatebedienung und Phasen 5–7 bleiben verpflichtend. Keine neue Datenformatversion.

Run 34288396494 des vorherigen Candidate ist inzwischen failure; ausschließlich
Portable-Lint und dessen Aggregate sind fehlgeschlagen. Der konkrete Promise-Prop
ist im neuen Routen-Callback behoben und vollständiges Lint besteht. Den geprüften
neuen Stand committen/pushen; nur dessen vollständige Remote-Prüfung kann den
nächsten kanonischen Handoff freigeben. Keine lokale Installation oder Main-Promotion
in dieser Runde.

Phase 4 – Desktop-Eingaben, konkretisierter Teilplan:
Candidate 516a992d6 ist sauber; CI 34289734156 läuft. Prüfung von DesktopWindow,
DesktopXpAction, DesktopRosterActions und DesktopRestAction zeigt, dass ihre
Popovereingaben und direkten Writes bislang keine vollständigen Wartungsowner
besitzen. Eine bloße Schließsperre würde daher diese Änderungen nicht entdecken.
XP add/subtract/set nutzt direkte Party-Writes ohne originale Befehlsquittung.

Zuerst den XP-Schreibweg absichern: Den vorhandenen PartyCharacterCommand-Vertrag
um adjust-xp und set-xp erweitern. Beide bleiben einzelne Charakteränderungen mit
dem vorhandenen Receiptformat {characterId, party}; das vorhandene Journal enthält
bereits vollständige Fingerprints und benötigt keine neue Tabelle oder Spalte.
LivePlay führt XP-Änderung und Quittung in derselben UnitOfWork aus; Status bleibt
rein lesend, Replay liefert die ursprüngliche Quittung. Bestehende Grenzen für
XP-Werte, Revisionsprüfung und Burden-Berechnung übernehmen. SQL bleibt beim
Party-Aggregat. Danach DesktopXpAction auf diesen Port und Originalauftrag umstellen,
mit Wartungsowner und Schutz des noch nicht abgesendeten Betrags. Die drei
bestehenden Aktionen bleiben ausdrücklich wählbar; zentrales Speichern darf
bei einem Betrag ohne gewählte Aktion keine Add-/Subtract-/Set-Absicht erfinden.

Abnahme Backend: alle drei XP-Wirkungen, wiederholter Originalauftrag nach späterer
Änderung und Neustart, abweichender Fingerprint, read-only Status und atomarer
Rollback bei gescheiterter Quittung. Renderer-Abnahme folgt mit tatsächlichem
Originalhandle, unklarer Antwort, neuerem Party-Stand, Save/Discard/Cancel und
Schließen/Minimieren. Erst danach ist dieser Desktop-Teilpfad abgeschlossen;
Roster und Rest bleiben zusätzliche offene Schreibwege.

XP-Testkorrektur: 104 Fälle bestehen; die drei neuen XP-Orakel missachten die
bestehende Level-3-Untergrenze von 900 XP. Die Produktberechnung bleibt unverändert.
Fixture und Erwartungswerte oberhalb dieser Grenze wählen (1300 Ausgangs-XP),
so dass Plus/Minus/Set eigenständige Wirkungen prüfen; bestehende Burden-Tests
behalten den Grenzfall. Typecheck findet außerdem im reinen Charaktereditor-Mock
noch eine implizite create/update/delete-Annahme. Unerwartete XP-Varianten dort
explizit ablehnen, statt nicht existente character-Felder auszulesen. Keine
Produktionseinschränkung oder unsichere Typassertion zur Umgehung des Fehlers.

Backend-Zwischenstand: Die korrigierten Receipt-/Burden-/Charaktereditorfälle
bestehen (31/31). Die vorherigen 104 übrigen Fälle einschließlich Architektur
bestanden bereits; Produkt-Lint des Backendteils ist grün.

Renderer-Umsetzung konkretisiert: Betrag und gewählte Originalaktion synchron
halten. Nach erfolgreichem Write darf derselbe Betrag für einen neuen ausdrücklich
ausgelösten Klick erhalten bleiben; er gilt dann als bestätigt. Noch nicht
bestätigte oder neu eingegebene Beträge bleiben dirty. Save ohne ausdrücklich
gewählten Modus meldet eine nächste Aktion; kein stillschweigendes Add/Set.
Unklare Versuche nur über die originale Quittung klären; Eingaben/weitere Writes
bis dahin sperren. Dismiss eines Popovers erhält einen offenen Entwurf und eine
Wiederöffnung setzt ihn nicht zurück. Zusätzlich close/minimize des Desktopfensters
über den bestehenden DraftTransition-Hook klären, mit passender Fensterbeschreibung.
Nur nach erfolgreicher Klärung wird die ursprüngliche Desktopaktion ausgeführt.

Prüfung: 140 Fälle in 13 Dateien bestehen, einschließlich nativer XP-Quittungen,
Controller/Port, Charaktereditor, Desktop-XP und Übergängen. Typecheck besteht.
Auditkorrektur vor dem Build: Die konkrete Meldung „+ / − / Überschreiben wählen“
muss im zentralen Fehlerdialog erscheinen, auch wenn das XP-Popover bereits
verdeckt/geschlossen ist. Deshalb den bekannten Validierungsgrund vom XP-Saveowner
als Fehler an den Koordinator geben statt lediglich false zurückzuliefern; lokale
Meldung ebenfalls erhalten. Der Test prüft den konkreten Hinweis im Ownerfehler.

Korrektur vor E2E: Vollständiges Lint findet genau eine unsichere any-Zuweisung
im Testobjekt `commandId: expect.any(String)`. Den tatsächlichen Aufruf getrennt
auf Commandinhalt und string-ID prüfen; keine Regel-Ausnahme. Produkt-Lint besteht.
Build und Built-Smoke bestehen. Der erreichbare Graph beträgt 1630221 Bytes,
1620 Bytes mehr als beim zuletzt qualifizierten Routenstand. Weil der alte
Wachstumsvergleich bewusst noch bei 1613493 blieb, überschreiten die aufsummierten
16728 Bytes jetzt die 16-KiB-Prüfschwelle. Baseline nach dem vorhandenen expliziten
Verfahren aktualisieren: keine neue Bibliothek, bestehender Charaktercontroller
für XP wiederverwendet; Fensterübergang nutzt vorhandenen gemeinsamen Dialog.
Absolute Budgets und 16-KiB-Wachstumsschwelle unverändert lassen. Danach Budget
und SzeneDesktop-E2E auf denselben Appbytes; E2E wurde bislang nicht gestartet.

Hinweis zur laufenden Prüfung: Die nachgelagerte Lint-/Test-/Formatkette (56445)
ist bereits beim Lint gestoppt; deren Tests/Format sind noch nicht ausgeführt.
Fehler genau auswerten und erst nach Ende der laufenden E2E korrigieren; die
Appbytes der E2E bleiben währenddessen unverändert.

Lint-Korrekturplan konkret: Die zusätzliche Assertion auf den zentralen
Validierungstext verwendet ebenfalls expect.stringContaining als Objektproperty
(any). Den Failuretyp im Test um message:string erweitern und die konkrete
Message getrennt mit toContain prüfen. Bestehende Label-Assertion beibehalten;
keine Produktänderung. Nach E2E-Ende betroffenen Test/Lint und Format ausführen.

XP-/Fensterabnahme: Gesamthandle 72072 endet mit exit 0. Alle sieben echten
sceneDesktop-Szenarien bestehen, einschließlich erweitertem XP-Fall für
Fenster-schließen und Minimieren: ungesendeter Betrag, Cancel erhält 250,
zentrales Save ohne Modus blockiert, Discard schließt/minimiert, Wiederöffnung
zeigt die unveränderten zuvor bestätigten 100 XP. Roster, Rest, Reisen,
Referenzfenster und Neustarts bestehen als bestehende Verhaltensregressionen;
dies belegt noch nicht deren vollständige Wartungsintegration.
Summary: .tmp/e2e-runs/functional-1788909976708-547745/summary.json.
Geprüfter appBuildInputFingerprint:
62e7218a0d611b25bfd59c404444febaf792b87e5ab221501b3782d88cdfcacb.

Plan-Audit: Desktop-XP verwendet jetzt einen dauerhaft identifizierten Original-
befehl, atomare Quittung und lesende Recovery. Nicht abgeschickte Beträge bleiben
in der Ownerregistrierung; Dismiss/Wiederöffnung löscht sie nicht. Ungewählte
Rechenart ist ein klarer zentraler Validierungsfehler. Confirmed amount bleibt
für einen weiteren expliziten Klick erhalten. Fenster-close/minimize verwenden
dieselbe Entwurfsklärung und führen ihre Originalaktion erst danach aus. Die
native Abnahme zeigt, dass XP und Quittung gemeinsam zurückrollen und ein Replay
spätere XP-Arbeit selbst nach Neustart nicht überschreibt. Kein Schemawechsel:
Receipt v1 speichert denselben Resultattyp; bestehende Tabelle/Fingerprints reichen.

Roadmap-Audit: Dieser XP-/Fensterpfad ist implementiert und automatisiert geprüft.
Weitere Desktop-Roster-/Rest- und Szenenwechsel-Writes bleiben offen. Insbesondere
die weiterhin vorhandene direkte adjustXp-Adaptermethode in party-capabilities.ts
ist beim abschließenden Writer-Inventar zu bewerten. Phase 4 bleibt in Arbeit;
kein Handoff, keine Main-Promotion und keine Veröffentlichung dieser Runde.

Finale lokale Prüfungen dieser Runde: gezieltes korrigiertes Lint, alle fünf
Desktop-Action-Tests und vollständiges Format bestehen zusammen als Handle 17336,
exit 0. Im vollständigen früheren Lint bestanden alle anderen Partitionen; seine
einzige verbleibende Testbeanstandung ist damit behoben. Typecheck bestand als
16492; 140 qualifizierte Fälle plus konkrete Fehlermeldungsprüfung und echte
Desktop-E2E bilden die lokale Abnahme. git diff --check besteht. Candidate jetzt
committen/pushen, vollständige Remote-Prüfung des neuen SHA abwarten.

Phase 4 – Besetzung und ausgewählte Rasten, Backend-Teilplan:
Candidate 4c95c1604 ist sauber; CI 34290901390 steht pending. setRoster,
moveRoster und restSelected sind direkte Writes ohne wiederlesbares Original-
ergebnis. Vor der UI-Wartungsintegration einen gemeinsamen ScenePartyCommand
mit Varianten set-roster, move-roster und rest-selected einführen. Ergebnisse
enthalten den ursprünglichen vollständigen LiveSessionSnapshot, einschließlich
der bei move neu angelegten Szene. Status liefert Originalreceipt plus heutigen
Snapshot. Campaign-ID validiert die Utility-Grenze vor Write und Read.

Eigener SQL-Owner ScenePartyCommandJournal im Scene-Aggregat, mit Befehls-ID,
vollständigem Fingerprint und versioniertem Resultat. XP/Charakterquittungen nicht
zweckentfremden: Rasten und Verschieben betreffen mehrere Charaktere/Szenen.
Atomare UnitOfWork umfasst alle vorhandenen Domainwirkungen und die Quittung.
Kampagnenschema 38→39, Registry 18→19; Installation bleibt 42. Frische Profile
und Vorwärtsmigration registrieren denselben Owner. Eingefrorenes Release-0.2.0-
Fixture bleibt unverändert. Aktuelle Qualifikationsinventare und Versionstruth
auf die neue Migration abstimmen.

Abnahme: set-roster, move in bestehende/neue Szene und short/long rest; ursprüngliche
Quittung nach späterer Arbeit und Neustart; doppelte Befehle erzeugen keine zweite
Szene/Rast; falsche Campaign-ID/Fingerprint werden abgewiesen; query_only-Status;
Quittungsfehler rollt Party/Scene/Combat/Travel gemeinsam zurück. Migration mit
Abbruch und erneutem Start erhält Inhalte. Danach separate Rendererintegration
mit ausgewählter Originalabsicht, vorhandener Rastbestätigung und zentraler
Save/Discard/Cancel-Klärung. Backendprüfung allein schließt diesen Teilpfad nicht.

Qualifikationskorrektur für den Scene-Party-Backendteil: Die nativen
Befehls-/Migrationstests bestehen (71 Fälle), die aktuelle Root-/Completion-
Qualifikation bricht bereits beim Manifestladen ab: Schema 38 statt 39.
Vor der Korrektur festgelegt: ausschließlich das aktuelle Manifest und dessen
Root-Inventar um den tatsächlich registrierten Scene-Party-Receipt-Owner ergänzen;
Reihenfolge gegen den Bootstrapper prüfen und den veralteten textlichen
Schema-Oracle auf 39 berichtigen. Das eingefrorene 0.2.0-Fixture bleibt unverändert.
Danach die betroffenen Qualifikationen erneut ausführen und deren tatsächliche
Abdeckung prüfen. Der vorige Installationsturn änderte keinen Implementierungsstand;
diese Runde setzt am nachgewiesenen Qualifikationsfehler fort.

Scene-Party-Backend: Qualifikationskorrektur abgeschlossen. Root/Completion
bestehen mit neun Fällen (66694, exit 0); sämtliche Current-Format-Integrationen
plus Scene-Party-Receipt-Abnahme bestehen mit 39 Fällen in sieben Dateien
(34611, exit 0). Vollständiges Lint, beide Typechecks und Format bestehen
(78487, exit 0). Build, Smoke und unveränderte Bundlegrenzen bestehen
(52813, exit 0). Kein geändertes eingefrorenes Release-0.2.0-Fixture.

Echte App-Abnahme currentFormatCampaignQualification besteht (14890, exit 0):
100 warme Kampagnenwechsel, p95 168.184 ms, Maximum 172.723 ms, anschließende
Szenenänderung und Neustart mit dauerhaftem Zustand. Summary:
.tmp/e2e-runs/functional-1788911124303-553473/summary.json.
App-Build-Fingerprint b601dff077f0e7ce4a79f1d81cb5dd2ed0bad9f6d0d8fb2c8eb15963ba182722.

Plan-Audit: Neues Schema und frischer Bootstrap verwenden denselben Scene-Owner.
Die Utility prüft die ursprüngliche Kampagnenidentität vor Lesen und Schreiben.
Originalquittung und Domainwirkungen werden gemeinsam transaktional gespeichert;
Status liest Originalergebnis und heutigen Zustand getrennt. Die nativen Tests
prüfen Wiederholung, Neustart, spätere Arbeit, Fingerprint-Konflikt und Rollback
samt Reisezustand. Aktuelle Qualifikationsdaten erkennen die neue Tabelle und
Version ausdrücklich. Backend-Teilplan damit lokal automatisiert geprüft.

Roadmap-Audit: Phase 4 bleibt offen. DesktopRosterActions und DesktopRestAction
verwenden weiterhin die direkten Legacy-Operationen; sie müssen im nächsten
Teilplan die neuen Quittungen und die zentrale Entwurfsklärung verwenden. Insbesondere
bleibt die zweite bewusste Rastbestätigung erhalten. Die oben beschriebene
Current-Format-App-Abnahme belegt Schema-/Bestandsregression, keine fertige
Wartungsintegration dieser beiden Oberflächen. Phasen 5–7 bleiben unverändert offen.
Kein Local-Handoff, keine Main-Promotion, kein öffentlicher Release in dieser Runde.
Candidate-Remoteprüfung für diesen neuen Stand ist nach Commit/Push noch abzuwarten.

Phase 4 – Renderer-Teilplan für Scene-Party-Befehle:
Voriger Turn war Fortschritt (Backend 8cf10f495, qualifiziert und gepusht).
DesktopRosterActions und DesktopRestAction werden auf den ScenePartyCommand-Port
mit ursprünglicher Campaign-ID umgestellt. Ein eigener Controller hält den
Originalbefehl bei unbekanntem Ergebnis auch nach Unmount; Status liest nur,
frischt den vollständigen Sessionzustand auf und unterscheidet bestätigte von
fehlenden Quittungen. Fehlende Quittungen prüfen sowohl Party- als auch
Scene-Revision, bevor ausdrücklich erneut gespeichert werden darf.

Besetzungs-/Verschiebeentwürfe behalten Auswahl, Ziel und Titel bei Popup-Dismiss;
ein anderer Modus darf einen offenen Entwurf nicht ersetzen. Zentrales Save
klärt zuerst die ursprüngliche Quittung, Discard klärt ebenfalls und verwirft
anschließend nur den ungespeicherten Entwurf. Wartung sperrt alle Eingaben.
Rasten behalten ihre zweistufige bewusste Bestätigung: zentrale Speicherung darf
keine bloß vorbereitete Rast ausführen. Bereits bestätigte, nachweislich nicht
angekommene Rast darf bei explizitem Save mit neuer ID erneut gesendet werden.

Abnahme: Controllerfehler nach Write/Refresh, reine Statusklärung, spätere
Änderungen, konfliktbehafteter Fehlbeleg, Unmount und gesperrte Konkurrenz;
Komponententests für Save/Discard/Cancel, Dismiss, zweite Rastbestätigung und
Eingabesperren. Bestehende Desktop-E2E ergänzen die echte UI-Abnahme. Danach
getrennte Audits gegen diesen Plan und Phase 4; keine Phase-5-Abnahme vorziehen.

Implementierungsprüfung vor Tests: Die mechanische JSX-Anpassung hat doppelte
disabled-Attribute erzeugt; außerdem liegen Rasttexte in workspace-messages.de.ts.
Korrekturplan: Duplikate entfernen, neuen Bestätigungstext beim vorhandenen
Nachrichtenowner ergänzen und Eingabehandler zusätzlich synchron gegen die
Wartungssperre schützen. Danach Typecheck und Verhaltensabnahme ausführen.

UI-Teilprüfung: 30 Controller-/Port-/Komponentenfälle bestehen. Die Erstprüfung
meldete genau die bereits korrigierten JSX-Duplikate und den damals noch fehlenden
Rasttext; erneuter vollständiger Typecheck folgt jetzt. Auditkorrektur vor Abschluss:
der neue Scene-Controller darf keinen ausschließlich auf Charaktere bezogenen
Konflikttext anzeigen. Eigenen Text für geänderte Szene oder Gruppe ergänzen;
keine Änderung am bestehenden Charaktercontroller. Erfolgreich bestätigte Rasten
schließen das erledigte Popup; den bestehenden E2E-Schritt auf diesen sichtbaren
Abschluss abstimmen, ohne die zweite Bestätigung zu entfernen.

Renderer-Zwischenabnahme: 30 gezielte Fälle in drei Dateien bestehen (42189,
exit 0): alle drei Befehlsvarianten, beide Revisionskonflikte, verlorene Antwort,
fehlgeschlagener Refresh, lesende Recovery, ursprüngliche Campaign-ID, detached
Save/Discard, Popup-Dismiss, zentrale Klärung unter Eingabesperre sowie keine
unbestätigte Rast. Vollständiger Typecheck und Lint bestehen (87400, exit 0).
Build, Smoke und Bundlebudget bestehen; unveränderte Grenze, Renderer 1635446
Bytes. E2E-Gesamthandle 72604 läuft noch und darf nicht als abgeschlossen gelten.
Backend-Candidate 8cf10f495 hat CI 34292249972 in Arbeit; Vorgänger 4c95c1604
ist nun vollständig grün (34290901390).

Zusätzlicher Roadmap-Befund: SceneDesktop keyt DesktopRosterActions auf focused.id;
die Originalszene bleibt innerhalb einer gemounteten Ownerinstanz stabil. Der
Szenenselektor ruft aber weiterhin actions.focusScene direkt auf. Ein weiterer
Schritt muss diesen Wechsel durch die vorhandene Entwurfsklärung führen, bevor
ungesendete Entwürfe beim Szenenwechsel sicher erhalten/aufgelöst sind. Dies bleibt
explizit offen; die aktuelle Teilabnahme schließt Phase 4 nicht.

Renderer-App-Abnahme abgeschlossen: Handle 72604 endet mit exit 0; Build,
Smoke, Bundlebudget und alle sieben sceneDesktop-Szenarien bestehen. Summary:
.tmp/e2e-runs/functional-1788911674558-556222/summary.json. Der echte Desktoppfad
führt Besetzungsbatches, Aufteilen/Zusammenführen, XP und bestätigte Rasten über
die neue Bridge aus; die vorhandenen Reise-/Karten-/Fensterregressionen bestehen.

Plan-Audit: Besetzung/Verschieben bewahrt einen Entwurf beim Popup-Dismiss und
wechselt bei erneuter Öffnung nicht unbemerkt die Absicht. Der Port bindet den
Originalauftrag an seine Kampagne; Controller und detached Wartungsregistrierung
bewahren unklare Ergebnisse. Status fragt nur das Original ab und veröffentlicht
über vollständigen Refresh den heutigen Sessionzustand; keine alte Quittung wird
als heutiger Zustand eingesetzt. Beide Revisionsstände begrenzen eine ausdrücklich
autorisierte erneute Speicherung bei fehlender Quittung. Save/Discard klären
zuerst unbekannte Ergebnisse. Zentrales Save verlangt bei unbestätigter Rast die
Bestätigung im Rastfenster; es wählt oder bestätigt keine Rast selbst. Alle
Eingaben sind während Klärung und ungewissem Ausgang gesperrt. Controller-/Port-
und Komponententests liefern die Fehlerpfadbelege, Desktop-E2E den realen Normalpfad.

Roadmap-Audit: Dieser Besetzungs-/Rast-Schritt ist implementiert und lokal
qualifiziert. Die vollständige Phase 4 bleibt offen (direkter Szenenwechsel,
weitere Writer und vollständige Update-/Offline-Abnahme). Die Oberfläche behält
auch vorbereitete Popup-Entwürfe bis zur bewussten Klärung; spätere Daten werden
beim Verwerfen einer bestätigten Originalaktion nicht zurückgerollt. Kein Handoff,
keine Main-Promotion und keine öffentliche Veröffentlichung. Nach abschließendem
Formatcheck diesen geprüften Stand als Candidate committen/pushen und dessen
vollständige Remote-Prüfung abwarten.

Phase 4 – Teilplan Szenenwechsel: Voriger Turn war Fortschritt, Candidate
458c2c6ff enthält die geprüfte Besetzungs-/Rastintegration. Der Desktop-Selektor
wird über einen eigenen useDraftTransition-Aufruf mit passendem Szenentext
geführt. Das Ziel wird synchron aus dem Ereignis übernommen; dieselbe Szene
ist keine Aktion. Die vorhandene Controllerfunktion verwendet beim tatsächlichen
Write den dann aktuellen Snapshot, damit ein vorangegangenes Save keine veraltete
Scene-Revision in den Fokusauftrag trägt. Während globaler Klärung ist der
Selektor gesperrt; Abbrechen hält die Originalszene und ihren gemounteten Owner.
Keine Änderung am Fokus-SQL oder den eigenen Wartungsmodulen.

Abnahme: bestehende Transition- und Desktop-Owner-Tests plus echter E2E-Fall
mit Besetzungsentwurf, Szenenwechsel, Abbrechen, anschließend Save und später
Discard; ursprüngliche/gespeicherte Auswahl nach Rückkehr vergleichen. Vollständige
Typ-/Lint-/Buildprüfung und vorhandene Desktop-E2E bleiben Pflicht. Dies schließt
nur den Desktop-Selektor, nicht automatisch alle übrigen Scene-/Map-Writes.

Testreview vor App-Abnahme: Der neu geschriebene E2E-Selektor muss den realen
Alertdialog über seine zugängliche Bezeichnung „Szene wechseln“ finden. Außerdem
muss der Test nach der Klärung den tatsächlich abgeschlossenen Fokuswechsel
abwarten, bevor er zurückwechselt. Beides jetzt korrigieren; ein geschlossenes
Dialogelement allein belegt noch keinen abgeschlossenen asynchronen Fokusauftrag.

Korrekturrunde nach E2E 54868 (exit 1): Der neue Test klickte die erste Checkbox
im vollständigen Katalog, obwohl diese bereits unbesetzt sein konnte; seine
Annahme „danach abgewählt“ war falsch. Explizit Reserve 4 über den vorhandenen
Suchfilter auswählen und auch nach dem Wechsel dieselbe Figur vergleichen.
Der folgende Katalogtest scheitert anschließend am noch offenen Entwurf und
liefert keinen unabhängigen Produktbefund.

Zusätzlicher Codebefund: mutateSnapshot verwendet input.snapshot aus dem Render,
in dem der zurückgehaltene Fokuscallback entstand. Vor dem Fokusauftrag muss
stattdessen der aktuelle Snapshot der ursprünglichen Kampagnenprojektion gelesen
werden. Im bestehenden Mutation-Controller diesen lesenden Zugriff durchführen,
abweichende geladene/aktive Campaign-ID vor Write abweisen und nach Antwort erneut
prüfen. Kein Ersatz unbekannter Ergebnisse durch neue Writes. Gezielter Test
hält die alte Callbackinstanz, ändert den Projektionsstand und erwartet die neue
Revision; Campaign-Wechsel vor/nach Antwort muss ohne veraltete Publikation enden.

Korrekturrundenstatus: 22 gezielte Fälle bestehen; Typecheck besteht. Lint meldet
als einzigen Fehler den untypisierten setSnapshot-Testspy (.scene auf any).
Korrektur nach Ende der laufenden App-Abnahme: Spy mit Dispatch<SetStateAction<
LiveSessionSnapshot>> typisieren und das tatsächlich übergebene Snapshot-Objekt
getrennt prüfen. Keine Produktlogik ändern, keinen Lintfilter abschwächen.

Writer-Inventar für den weiteren Phase-4-Audit: partyCapabilities wird im Renderer
nur noch von use-adventuring-day-calculation verwendet; die alten create/update/
delete/membership/XP/rest-Adapter sind dort nicht mehr aufgerufene Altoberfläche.
Aktive verbleibende Scene-Writes liegen unter anderem in setLocation, deleteGroup
und setGroupArchived (SessionWorkspaceController und GroupManagerCommands).
Diese Beobachtung ersetzt noch keine Verhaltensabnahme oder Entfernung.

Weitere Korrekturrunde nach 76601 (exit 1): Screenshot belegt Produktfehler:
Besetzungs-Save entfernt Reserve 4 und damit dessen sauberen XP-Editor. Der
Koordinator meldet pauschal „Editor während Klärung geschlossen“, obwohl dort
keine Änderungen vorhanden waren. Plan: anfängliche Dirty-Menge vor jedem
Resolverlauf festhalten. Ein inzwischen entfernter Owner darf nur dann als erledigt
gelten, wenn er sowohl zu Beginn als auch bei der Prüfung sauber ist. Entfernte
ursprünglich schmutzige oder inzwischen schmutzige Owner bleiben Fehler. Neue
registrierte Dirty-Owner werden unverändert im abschließenden Durchlauf geprüft.
Gezielte Tests für sauberes Entfernen versus entfernten offenen Entwurf ergänzen;
keine Fehler unterdrücken und keine spätere Änderung verwerfen. Danach E2E erneut.

42 gezielte Fälle der Koordinatorkorrektur bestehen. Typecheck besteht; Lint
beanstandet drei neue Testcallbacks ohne await. Nach Ende von E2E 55893 diese
Callbacks ausdrücklich Promise.resolve(true) zurückgeben lassen, dann die
betroffenen Tests und Lint wiederholen. Dies ist eine reine Testtyp-/Stilkorrektur.

Noch offener Phase-4-Auditfall: Wenn eine Besetzungsänderung gleichzeitig einen
wirklich schmutzigen XP-Editor entfernt, muss seine Klärung vor dem Entfernen
geordnet werden bzw. sein Entwurf gehalten bleiben. Die neue Regel für saubere
entfernte Owner löst nur den nachgewiesenen sauberen Fall; der schmutzige Fall
bleibt absichtlich ein Fehler und benötigt weitere Abnahme über wiederholte
Klärungsversuche hinweg. Keine pauschale Freigabe entfernter Owner.

Szenenwechsel-App-Abnahme: Gesamthandle 55893 endet mit exit 0. Build, Smoke,
Bundlebudget und alle sieben Desktop-E2E-Szenarien bestehen. Der erweiterte Fall
prüft Reserve 4 ausdrücklich: Abbrechen erhält den Entwurf in Wald; Save übernimmt
die Auswahl vor dem Wechsel nach Vorhut; Rückkehr liest die gespeicherte Auswahl;
Discard beim nächsten Wechsel erhält die vorherige Besetzung. Summary:
.tmp/e2e-runs/functional-1788912576699-564404/summary.json.

Plan-Audit: Der Szenenselektor hält seine Originalaktion bis zur zentralen
Klärung zurück und bleibt währenddessen gesperrt. Der Callback übernimmt das
Ziel synchron, liest aber beim tatsächlichen Write den aktuellen Sessionstand
seiner ursprünglichen Kampagne. Das beseitigt die durch vorangegangenes Save
veraltete Revision. Saubere beim Besetzungs-Save entfernte XP-Owner verursachen
keine falsche Blockade mehr. 42 gezielte Tests und die echte App-Abnahme belegen
die beschriebenen Fälle; die nachgeschaltete Teststilkorrektur ändert keine
Produktdatei des geprüften Builds.

Roadmap-Audit: Dieser Szenenwechselpfad ist automatisiert geprüft; Phase 4 bleibt
in Arbeit. Die explizit notierten Fälle für gleichzeitige schmutzige XP-/Besetzungs-
Owner, weitere Scene-Writes und Update-/Offline-Bedienung bleiben offen. Die
Korrektur für sauber entfernte Owner ist keine allgemeine Freigabe schmutziger
entfernter Editoren. Handoff, Main-Promotion und Veröffentlichung sind weiterhin
nicht erfolgt. Nach gezieltem korrigiertem Lint/Test und Format den aktuellen
Stand auf Candidate sichern; Remote-Abnahme bleibt ein eigener Nachweis.

Finale Korrekturprüfung 84702 endet mit exit 0: betroffenes Lint, 23 Fälle und
vollständiger Formatcheck bestehen. Alle anderen Lintpartitionen bestanden bereits
im vollständigen Lauf; dessen drei Testbeanstandungen sind damit korrigiert.
git diff --check besteht. Candidate-Commit und Push jetzt durchführen.

Phase 4 – Teilplan gekoppelte XP-/Besetzungsentwürfe:
Voriger Turn war Fortschritt (6d7bfa33b, Szenenwechsel abgenommen). Desktop-XP-
Owner erhalten stabile, szenengebundene IDs; der Besetzungsowner hängt explizit
von den tatsächlich gerenderten XP-Ownern ab. So blockiert ein ungeklärter Betrag
oder unbekannter XP-Ausgang die Besetzungsänderung vor dem Entfernen einer Zeile.
Direktes Übernehmen bei schmutzigen XP-Abhängigkeiten öffnet dieselbe zentrale
Klärung; ausschließlich die bewusste Save-/Discard-Wahl löst die Entwürfe auf.

Nach erfolgreichem XP-Save kann sich die Partyrevision geändert haben. Ein noch
nie gesendeter Besetzungsentwurf darf seine Partyrevision ausschließlich dann
aktualisieren, wenn Scene-Revision und sämtliche Charakter-IDs/Aktivzustände
unverändert sind. Dafür synchron den aktuellen, kampagnengebundenen Portzustand
lesen; keine asynchrone Lücke vor dem neuen Originalbefehl. Unbekannte oder
konfliktbehaftete bereits gesendete Befehle behalten ihre Originalrevisionen und
werden weiterhin zuerst über ihre Quittung geklärt.

Abnahme: gleichzeitiger XP-Betrag ohne gewählte Aktion blockiert Save und erhält
beide Entwürfe; Discard verwirft beide ohne Write. Erfolgreich geklärte XP vor
Besetzung verwenden den neuen revisionsgeschützten Stand; fehlgeschlagene XP
verhindern Entfernen. Direkte Übernahme darf diese Reihenfolge nicht umgehen.
Echte Desktopabnahme ergänzen; übrige Phase-4-Writer bleiben offen.

Implementierungsreview vor gekoppelten Tests: Wenn ein ungesendeter Entwurf nach
XP-Klärung eine neue Partyrevision übernimmt, muss genau diese Revision auch im
Entwurf als ursprünglich gesendete Revision gehalten werden. Vor execute deshalb
partyRevision aktualisieren und submitted setzen; spätere Statusklärung darf
nicht auf die vor dem XP-Save geltende Revision zurückfallen.

Typkorrekturplan nach 43 bestandenen Tests: exactOptionalPropertyTypes verlangt
bei optionaler Maintenance-ID einen explizit passenden Propvertrag; optionales
dependsOn wird als leere Liste übergeben. Der Befehlscontroller benötigt nur
execute/status/refresh, nicht die neue synchrone Lesemethode des UI-Ports; seinen
Porttyp entsprechend auf diese drei Fähigkeiten begrenzen. Keine Lockerung der
Projekt-Typechecks. Anschließend Typecheck und relevante Controllerfälle erneut.

Gekoppelte Abnahme: 53 gezielte Fälle bestehen; Typecheck 4926 endet mit exit 0,
vollständiges Lint 46285 mit exit 0. Build, Smoke und Bundlegrenzen bestehen.
E2E-Gesamthandle 16639 endet mit exit 0, alle sieben sceneDesktop-Szenarien:
.tmp/e2e-runs/functional-1788913143356-567881/summary.json. Der neue echte Fall
hält 77 als ungewählten XP-Betrag, versucht Reserve 4 aus der Besetzung zu
entfernen, blockiert Save mit „XP: Reserve 4“, erhält nach Cancel beide Entwürfe
und verwirft sie bewusst ohne Änderung der zuvor gespeicherten 100 XP/Besetzung.
Renderergröße 1637524 Bytes, bestehende Bundlegrenze unverändert.

Plan-Audit: XP-Owner-IDs enthalten Kampagne, Szene und Charakter. Der reale Desktop
übergibt dieselben IDs als Besetzungsabhängigkeiten. Die zentrale Klärung arbeitet
XP vor Besetzung ab; ein abhängiger Fehler verhindert den Besetzungs-Write.
Direktes Übernehmen verwendet bei schmutzigen XP-Ownern denselben Dialog und
umgeht die Reihenfolge nicht. Die synchrone revisionsgeschützte Lesemethode ist
auf die ursprüngliche Kampagne begrenzt. Nur ungesendete Entwürfe mit unveränderter
Scene-Revision und identischen Charakter-IDs/Aktivzuständen übernehmen eine neue
Partyrevision. Die tatsächlich gesendete Revision wird danach im Entwurf gehalten.
Bereits unbekannte Aufträge bleiben beim Original und durchlaufen Quittungsklärung.
Controller-/Komponentenfälle belegen erfolgreiche XP-Recovery vor Besetzung,
fehlende Aktionswahl, Discard und die Ablehnung geänderter Mitgliedschaften.

Roadmap-Audit: Der zuvor offene konkrete XP-/Besetzungsfall ist implementiert
und lokal automatisiert qualifiziert. Phase 4 bleibt offen für weitere aktive
Scene-/Gruppen-/Karten-Writes und vollständige Update-/Offline-Bedienung; Phasen
5–7 bleiben unverändert offen. Keine Main-Promotion, kein Local-Handoff und kein
öffentlicher Release. Der letzte Candidate 6d7bfa33b hatte CI 34294070133 noch
in Arbeit; eine neue Candidate-Abnahme wird durch Commit/Push dieses Stands
angefordert. Die aktuelle Runde ersetzt keine vollständige Remote-Freigabe.

Finale Prüfkorrektur: Gezieltes Lint und alle zwölf Portfälle bestehen, einschließlich
synchroner Read-Abweisung bei geänderter aktiver/geladener Kampagne. Format meldet
noch desktop-roster-actions.test.tsx; ausschließlich dieses Testfile mit Prettier
normalisieren und Format erneut prüfen. Keine Produktänderung nach App-Abnahme.

Formatkorrektur 35497 endet mit exit 0. Abschließend bestehen 55 gezielte Fälle
(53 plus zwei neue synchrone Portidentitätsfälle), Typecheck, vollständiges Lint
mit ergänzendem Lint der korrigierten Typdateien, Format, Build/Smoke/Budget und
sieben Desktop-E2E-Szenarien. Candidate jetzt committen und pushen.

Phase 4 – Teilplan Updatebedienung und Offlinebetrieb:
Voriger Turn war Fortschritt (773d47fc5). Read-only-Inventar bestätigt weitere
aktive Scene-Writes ohne vollständige Wartungsintegration; diese bleiben offen.
Jetzt den ausdrücklich geforderten Update-UI-Pfad qualifizieren: Prüfung,
Download und bestätigte Installation müssen getrennt bleiben. ReleaseSettings
verwendet derzeit busy auch für die Modal-Schließsperre und hält damit während
eines Downloads die normale Arbeit hinter dem Einstellungsdialog fest.

Änderung: Während Netzwerkprüfung/Download darf die Einstellung geschlossen und
später wieder geöffnet werden; nur tatsächliche Wartung/Entwurfsklärung sperrt
das Schließen. Aktionsbuttons berücksichtigen sowohl lokale laufende Aufträge
als auch eingehende checking/downloading-Statusereignisse. Main behält Netzwerk-
und Downloadzustand; kein automatischer Installationsaufruf beim Schließen.

Abnahme: verfügbare Version und Release Notes, manuelle Prüfung ohne Download,
Downloadfortschritt und Weiterarbeit nach Schließen, Wiederöffnung mit geladenem
Update, keine Installation bis separater Bestätigung, Offline-/Downloadfehler
mit erneut möglicher Aktion sowie Statusereignisse ohne lokale Buttonaktion.
Bestehende Wiederherstellungs-/Mehr-Editor-Tests unverändert weiterführen.

Testkorrektur nach erstem Lauf: 16 Fälle bestehen, ein neuer Test findet den
Einstellungsknopf nicht, weil der vorhandene Updatehinweis seinen zugänglichen
Namen erweitert. Den tatsächlichen Namen mit /Einstellungen/ auswählen, ohne
die Produktausgabe zu ändern. Zusätzlich den vom Main zurückgegebenen Download-
Fehlerstatus und die ausdrückliche Wiederholung des Downloads prüfen.

Update-UI-Zwischenabnahme: 45 Fälle in release-update-ui, profile-recovery-ui,
draft-transition und maintenance-draft-coordinator bestehen. Netzwerkphasen
checking/downloading deaktivieren konkurrierende Aktionen auch bei Statusereignissen
ohne eigenen Buttonauftrag. Schließen und Escape bleiben möglich; das Schließen
ruft install nicht auf. Der kontrollierte Download läuft bis zur Auflösung seines
Promises weiter; Wiederöffnung zeigt die separate Installationsaktion. Offline-
Prüfung lässt onReady(true) und die Wartungssperre unverändert frei; Wiederholung
erfolgt nur nach Klick. Ein zurückgegebener Downloadfehler bietet keine Installation.

Build, Smoke und Bundlebudget bestehen (88152, exit 0), Renderer 1637720 Bytes.
Die UI-Tests verwenden einen kontrollierten Capability-Port; sie beweisen keine
vollständige AppImage-Transport-/Migration-Abnahme. Diese bleibt ausdrücklich
Phase 5 mit echten Artefakten und unterschiedlichen Schemas vorbehalten.

Finale Testkorrektur: Typecheck besteht, vollständiges Lint meldet ausschließlich
einen async-act-Callback ohne await in release-update-ui.test.tsx. Den Download-
Abschluss im Test ausdrücklich um einen Microtask abwarten, anschließend diesen
Test und sein Lint/Format erneut prüfen. Produktstand bleibt seit Build unverändert.

Plan-Audit: Updateprüfung, Download und Installation bleiben getrennte Aktionen.
Die UI startet keine Installation beim Beenden des Einstellungsdialogs. Lokale
Aufträge und Main-Statusereignisse sperren konkurrierende Wartungs-/Netzwerkaktionen;
Netzwerkphasen halten die normale Arbeit nicht mehr hinter dem Einstellungsdialog
fest. Nur Bestätigung/Wartung sperrt dessen Schließen. Vorhandene Save-/Discard-
und datenbankunabhängige Wiederherstellungsfälle bestehen weiterhin.

Roadmap-Audit: Der konkrete Update-UI-/Offline-Komponentenpfad ist lokal geprüft.
Automatische tägliche Prüfung und vollständiger Transport/Neustart mit echten
Artefakten wurden hier nicht neu abgenommen. Phase 4 bleibt wegen weiterer aktiver
Scene-/Gruppen-/Karten-Writes in Arbeit; Phasen 5–7 bleiben offen. Diese Runde
enthält keinen Handoff, keine Main-Promotion und keinen öffentlichen Release.

Abschluss der lokalen Runde: 83755 endet mit exit 0 (korrigiertes Test-Lint,
sechs Update-UI-Fälle und Format). Alle übrigen Lintpartitionen bestanden zuvor;
45 relevante Fälle, Typecheck, vollständiges Format und Build/Smoke/Budget sind
nachgewiesen. git diff --check besteht. Candidate committen/pushen; dessen
Remoteprüfung und spätere kanonische Übergabe bleiben eigenständige Gates.

Phase 4 – Teilplan Gruppen-Lebenszyklusquittungen:
Voriger Turn war Fortschritt (012849c62); dessen CI 34295230994 steht pending.
Aktive archive/restore/delete-Pfade verwenden direkte Gruppenwrites. Den bestehenden
SceneGroupCommandJournal um einen unterscheidbaren Lifecycle-Auftrag (commandId,
kind, input) erweitern. Alte Save-Fingerprints und Resultatversion 1 unverändert
lesen; gleiche Tabelle und Resultatstruktur, daher keine neue Schema-Version.
Neue Zod-validierte Execute-/Statusoperationen binden beide Wege an die ursprüngliche
Campaign-ID. Resultat und Group-/Combat-Effekte werden gemeinsam transaktional
persistiert; Status liefert Originalquittung plus aktuellen vollständigen Snapshot.

Archivierung/Resultatlesung muss das Combat-Aggregat der ausdrücklich genannten
Szene verwenden, nicht versehentlich das der fokussierten Szene. Qualifikation:
Archivieren, Wiederherstellen, Löschen; fehlgeschlagene Quittung rollt Effekte
zurück; Wiederholung nach späterer Arbeit/Neustart ändert nichts; query_only-Status,
Fingerprintkonflikt, falsche Campaign-ID und bestehende Save-Quittungen. Danach
Rendereranbindung mit Wartungseigentümer; Backend allein schließt den UI-Pfad nicht.

Native Testkorrektur: Die vier neuen Fälle erreichen prepareCombat mit einer
leeren Party und werden korrekt durch canStart abgewiesen. Vor den neuen
Lifecyclefällen eine Beispielparty anlegen, eine Figur aktivieren und den
Gruppen-Save mit der danach gültigen Scene-Revision aufbauen. Bestehende vier
Save-Receipt-Fälle bleiben unverändert. Kein Abschwächen der Kampfvalidierung.

Oracle-Korrektur nach Typecheck: Combat-Karten tragen memberIds, keine groupId.
Die bisherige neue .groupId-Assertion hätte zur Laufzeit das Entfernen nicht
bewiesen; ihre acht Laufzeiterfolge gelten deshalb noch nicht als vollständige
Abnahme. Vergleiche stattdessen die echten Gruppenmitglied-IDs mit card.memberIds
und verlange ausdrücklich Präsenz vor Archivierung sowie Abwesenheit danach.
Erneuter Typecheck und native Tests sind vor jeder Abschlussaussage erforderlich.

Weitere Oracle-Korrektur: 93 Fälle bestehen, die vier neuen Präsenzprüfungen
zeigen, dass Combat-Karten eigene Kampfmitglied-IDs verwenden (combat-state-reducer
und combat-service.unlinkGroup); sie sind nicht die Scene-Member-IDs. Das Fixture
hat genau eine feindliche Gruppe mit ausschließlich wolf und eine Spielerfigur.
Daher die eindeutig dieser Gruppe zugehörigen Wolf-Karten vor Archivierung
verlangen und danach deren Abwesenheit prüfen. Vollständiger Snapshotvergleich
für Rollback und späteren Zustand bleibt zusätzlich bestehen.

Fixturezustand präzisiert: Die Präsenzprüfung scheitert weiterhin, weil prepareCombat
nur die Initiative vorbereitet. combat-service.confirmInitiative erzeugt erst die
Karten; dabei werden vorhandene Scene-Member-IDs übernommen. Die frühere Erklärung
„eigene IDs“ war für dieses Fixture daher unvollständig. Jetzt nach Vorbereitung
die vorhandenen Initiativezeilen bestätigen und erst dann Kartenpräsenz prüfen.
Die Abnahme verlangt einen tatsächlich laufenden Kampf und bleibt bis dahin offen.

Gruppen-Lifecycle-Backend qualifiziert: 123 Fälle in zwölf Dateien bestehen
(inklusive vier neuer Lifecyclefälle mit tatsächlich bestätigter Initiative,
alten Save-Quittungen, LivePlay, SceneParty, Architektur und Bridge/Operationen).
Die echten Wolf-Karten sind vor Archivierung nachgewiesen und danach entfernt;
bei absichtlich fehlgeschlagener Quittung entspricht der gesamte Snapshot dem
vorherigen laufenden Kampf. Nicht fokussierte Archivierung bearbeitet den Combat-
Owner der genannten Szene und lässt den fokussierten Zustand unverändert.
Typecheck besteht. Build, Smoke und Bundlebudget bestehen (27940, exit 0);
Renderergraph unverändert bei 1637720 Bytes. Kein Schemawechsel.

Plan-Audit: Neuer Execute-/Statusvertrag validiert die ursprüngliche Campaign-ID,
Auftrags-ID und vollständige Absicht. Das vorhandene Journal speichert weiterhin
Resultatversion 1; alte Save-Einträge sind unverändert lesbar. Archivieren,
Wiederherstellen und Löschen werden gemeinsam mit der Quittung transaktional
committet. Read-only-Status liefert Originalquittung und aktuellen Snapshot;
Replay nach späterer Arbeit und Neustart ändert diesen späteren Stand nicht.
Falsche Campaign-ID und geänderter Fingerprint werden abgewiesen.

Roadmap-Audit: Backend-Teilplan lokal qualifiziert. Die bestehenden Renderer-
archive/restore/delete-Aufrufe verwenden noch die alten direkten Operationen;
ihre Umstellung und Wartungseigentümerschaft sind der nächste notwendige Schritt.
Die Backendtests belegen keine fertige UI-Recovery. Phase 4 sowie Phasen 5–7
bleiben offen. Kein Handoff, keine Main-Promotion und kein öffentlicher Release.

Finale lokale Prüfungen: 69943 endet mit exit 0 (123 Tests, Typecheck,
vollständiges Lint), 20298 mit exit 0 (vollständiges Format). git diff --check
prüfen, den Backendstand als Candidate committen/pushen. Remote-Gates bleiben
vor kanonischem Handoff und Main-Promotion verpflichtend.
