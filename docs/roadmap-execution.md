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

Phase 4 – Teilplan Renderer-Gruppenquittungen, Sessionaktionen:
Voriger Turn war Fortschritt (4994e6de9), CI 34295945998 läuft. Einen eigenen
Lifecycle-Controller/Port für die vorhandenen Gruppenquittungen ergänzen. Er hält
Originalauftrag und bekannte Abwesenheit auch bei Unmount, liest vor jeder Klärung
die Originalquittung und veröffentlicht nur den frisch gelesenen Kampagnenstand.
Fehlende Quittung prüft die Revision der konkreten Gruppe in der Originalszene;
geänderte/entfernte Gruppen blockieren erneutes Speichern, bis ausdrücklich
verworfen wird. Save und Discard klären unbekannte Ausgänge zuerst.

Session-Wiederherstellen und bestätigtes Löschen auf diesen Owner umstellen;
Wartungssperre vor neuem Write prüfen und eine lesende Wiederholungsaktion bei
unbekanntem Ergebnis anbieten. Keine neue Löschaktion aus zentralem Save erfinden:
Controller speichert nur bereits ausdrücklich ausgelöste Originalaufträge erneut.
Gruppenmanager-Archivierung folgt danach mit dessen eigenem Draft-Runtime und
bleibt in dieser Teilrunde offen. Abnahme: alle Lifecyclevarianten, Statusfehler,
Refreshfehler, Konflikt/Abwesenheit, detached Save/Discard, Originalkampagne sowie
Sessionintegration und bestehende Type-/Lint-/Buildprüfungen.

Implementierungsreview: lifecycleNotice muss im tatsächlichen Rückgabeobjekt des
Workspacecontrollers enthalten sein. Ein nachweislich fehlender Auftrag bleibt
ein offener Originalauftrag und darf nicht durch einen zweiten Gruppenbutton
ersetzt werden. Deshalb held statt nur unresolved für neue UI-Aufträge sperren;
bei bekannt fehlendem Auftrag explizites Wiederholen/Verwerfen anbieten, bei
Konflikt ausschließlich Verwerfen. Diese Korrektur vor Verhaltensprüfungen umsetzen.

Workspace-Testkorrektur: Der bestehende setLocation-Test hat seit dem früheren
aktuellen-Snapshot-Guard keine aktive Kampagnenprojektion im Fixture. Er darf
keinen ungeprüften Inputsnapshot als Autorität simulieren. Das Fixture erhält
eine explizite aktive/geladene Originalkampagne und einen veränderbaren Session-
Snapshot. Den Fehlerfall auf executeGroupLifecycle umstellen und die unbekannte
Antwort danach über Status/Refresh klären, damit kein offener Wartungsowner in
nachfolgende Tests ausläuft. Keine Abschwächung der Produktions-Campaign-Prüfung.

Session-Lifecycle-Abnahme erweitern: 47 gezielte Tests bestehen, Typecheck und
Lint sind ohne Diagnose beendet. Build/Smoke/Bundlebudget (77339) bestehen;
Renderergraph 1642845 Bytes bei unveränderten Grenzen. Der vorhandene Desktop-
E2E deckt bislang keine archivierten Gruppen ab. Einen zusätzlichen Fall im
bestehenden Desktop-Fixture ergänzen: abgegrenzte Testgruppe anlegen/archivieren,
über die sichtbare Session wiederherstellen, erneut als Fixture archivieren,
Löschbestätigung abbrechen, dann bestätigen und nach Prozessneustart Abwesenheit
prüfen. Archivierung im Gruppenmanager bleibt ausdrücklich der nächste Teilplan.

Korrekturrunde vor erneuter Abnahme: Electronlauf 3295 ist terminal, sieben
bestehende Desktopfälle bestehen, neuer Lifecyclefall scheitert beim Aufklappen
an einem überlagernden Fenster (click intercepted), vor jedem Lifecyclewrite.
Die Szenenübersicht über ihre Werkzeugleistenaktion ausdrücklich fokussieren,
auch wenn sie bereits existiert. Kein synthetischer DOM-Klick. Außerdem die von
Prettier gemeldete Workspace-Testformatierung korrigieren; vollständiges Lint
besteht bereits. Anschließend Format/Typecheck und Desktop-E2E wiederholen.

CI-Audit 4994e6de9: Run 34295945998 ist failure, kein laufender Gate-Wait mehr.
Portable meldet fünf Fehler in session-workspace-controller (1),
session-mutation-controller (3) und version-truth (1); die übrigen 1336 Fälle
bestehen. Workspace-Fixture wurde in dieser Runde bereits korrigiert.
Korrekturplan nach Ende des unveränderten E2E-Laufs: Mutationstests erhalten den
in Produktion erforderlichen Capability-Kontext mit ursprünglicher Campaign-ID
und aktueller Sessionprojektion. Zusätzlich die tatsächliche Verwendung eines
neueren Snapshot und Abweisung bei Campaign-Wechsel prüfen. Version-Truth-Test
von Campaign 38 auf den im Migrationsregister nachgewiesenen Pfad 38 -> 39
aktualisieren; eingefrorene Altfixtures und Migrationsketten bleiben unverändert.
Dann betroffene Tests und vollständige Portable-Testpartition prüfen. Diese
Fehler dürfen nicht durch Abschwächung der Produktionsguards beseitigt werden.

Die korrigierte Desktop-Abnahme besteht vollständig: 8 Fälle, Lauf 48031 exit 0,
Summary .tmp/e2e-runs/functional-1788915522544-579968/summary.json. Die zehn
CI-Korrekturtests bestehen. Vollständige Portable-Architekturprüfung findet
jedoch zwei neue statische JSX-Texte im Lifecycle-Hook, die gemäß Repositoryregel
hinter typisierten Message-Keys liegen müssen. Vor Korrektur: beide bestehenden
Wortlaute unverändert in workspace-messages.de.ts übernehmen und über message
aufrufen; keine UI-Verhaltensänderung. Portable/Type/Lint/Format wiederholen,
danach Build/Smoke/Bundle erneut für die geänderten Appinputs ausführen.

Zwischen-Audit der Session-Lifecycle-Umstellung: Der konkrete Teilplan ist
implementiert. Originalauftrag/Campaign-ID bleiben beim Controller, Status und
frischer Snapshot klären Antworten ohne Replay, fehlende/geänderte Gruppen
verlangen ausdrückliche Auflösung. Wiederherstellen und bestätigtes Löschen
verwenden diesen Owner; globaler Save erfindet keinen unbestätigten Löschauftrag.
47 gezielte Fälle und acht echte Electron-Desktopfälle bestehen. Die letzte
Appänderung verschiebt ausschließlich zwei unveränderte Wortlaute in typisierte
Message-Keys; der anschließende Architekturtest besteht (87 Fälle).

Roadmap-Audit bleibt offen: Session-Lifecycle ist nur ein Teil von Phase 4.
Gruppenmanager-Archivierung und verbleibende aktive Writer sowie Phasen 5–7 sind
weiter erforderlich. Noch kein Candidate-Commit für diese Runde, kein Handoff,
keine Main-Promotion, kein Release. Lauf 31997 prüft aktuell die vollständige
Portable-Partition, danach Type/Lint/Format und neuen Build/Smoke/Bundle.
Ergebnis vor Commit erneut am Prozesshandle und den Logs überprüfen.

Voriger Goal-Turn war Fortschritt: Session-Lifecycle, echter Desktopfall und
CI-Fixtures wurden geändert und qualifiziert. Lauf 31997 ist nun vollständig
exit 0: 87 Architekturtests, 1369 Portable-Unittests und 349 Integrationstests;
Typecheck, vollständiges Lint/Format, Build, Smoke und Bundlebudget bestehen.
Renderergraph 1642947 Bytes bei unveränderten Grenzen. Plan-Audit dieses
Session-Teilplans bestanden; Roadmap-Audit weiterhin Phase 4 in Arbeit, 5–7 offen.
Den qualifizierten Zwischenstand auf Candidate committen/pushen; der nächste
Teilplan ist die Gruppenmanager-Archivierung inklusive offener Entwürfe.

Phase 4 – Teilplan Gruppenmanager-Archivierung (nach Candidate 7aa201635):
Den vorhandenen Lifecycle-Hook in einen wiederverwendbaren Owner mit explizitem
Port zerlegen; Sessionadapter bleibt erhalten. Der Gruppenmanager erhält denselben
originalkampagnengebundenen Port, Statushinweise und eine Wartungsabhängigkeit
vor seinem Draft-Owner. Bestätigte Ergebnisse übernehmen den frisch gelesenen
Snapshot. Den alten direkten Archive-Write aus den Gruppenmanagercommands entfernen.

Archivieren muss zuerst den zentralen Speichern-/Verwerfen-/Abbrechen-Dialog
verwenden. Nach Auflösung anhand der ursprünglich gewählten Szene/Gruppe den
aktuellen bestätigten Stand aus dem Runtime lesen, dann den Auftrag erzeugen.
Wartungs-Save/Discard dürfen die Gruppenverwaltung nicht vor dem ausstehenden
Übergang schließen; der normale bestätigte Archivierungserfolg darf schließen.
Andere Entwürfe während ausstehender Archivierung sperren, Originalauftrag auch
nach Unmount behalten. Originalszene/-gruppe fehlen: verständlich abbrechen.

Abnahme: bestehende Gruppenmanager-Wartungsfälle, Archive mit sauberen/geänderten
Entwürfen (Save/Discard/Cancel), fehlgeschlagener Save verhindert Archive, verlorene
Antwort/Statusfehler halten Wartung, erfolgreiche Originalquittung ohne Replay,
frischer Snapshot statt alter Quittung. Echte Electron-Archivierung im vorhandenen
Desktop-Lifecyclefall ergänzen, um den kompletten sichtbaren Gruppenweg zu prüfen.
Type/Lint/Format/Architektur sowie Build/Smoke/Bundle prüfen. Phase 4 insgesamt
bleibt bis zur restlichen Writer-Inventur offen; Remote-Gates vor Handoff bestehen.

Gruppenmanager-Korrekturplan: Der erste Hooklauf findet zwei Regressionen bei
bereits vollständig aufgelöster allgemeiner Wartung: deren bestätigter Snapshot
wurde nicht mehr publiziert. Das Zurückhalten von props.saved nur auf einen
tatsächlich offenen Archivierungsübergang beschränken. Allgemeine Wartung behält
ihr geprüftes Publikationsverhalten; während Archivierungsauflösung bleibt der
Editor bis zum nachfolgenden Originalauftrag montiert. Danach gezielte Fälle für
Save/Discard/Cancel, Speicherfehler und verlorene Archive-Antwort ergänzen.

Fixture-Korrektur: Neue Archivierungs-Dialogtests haben den echten ModalDialog
ohne ModalLayerProvider gerendert; dadurch fehlen Dialoge und nachfolgende
Auflösungen sind nicht aussagekräftig. Den Produktions-Modalprovider im neuen
Fixture einsetzen, dann erneut getrennt die Archivefälle prüfen. Eine gescheiterte
Lifecycleabhängigkeit kann mehrere betroffene Bereiche melden; Abnahme verlangt
sichtbares Scheitern und gehaltenen Auftrag, keine künstlich feste Fehleranzahl.

22 Gruppenmanagerfälle bestehen einschließlich der sechs neuen Archivefälle.
Nachweis der Call-Site-Inventur: setGroupArchived/deleteGroup in den internen
SessionCapabilities haben keine Renderercaller mehr. Diese zwei unbenutzten
Wrapper entfernen; die öffentlichen Bridgeoperationen bleiben für Kompatibilität
unverändert. Den bestehenden Desktop-Lifecyclefall jetzt auf echte UI-Archivierung
umstellen: erste Archivierung mit geänderter Disposition und zentralem Save,
zweite Archivierung ohne Entwurf; Wiederherstellen und bestätigtes Löschen bleiben.

118 gezielte/Architekturtests bestehen. Typecheck stoppt vor Build wegen eines
falsch aufgebauten neuen Archive-Testbelegs: scenePatch besitzt keine globale
revision. Das Fixture auf den tatsächlichen SceneGroupCommandResult-Vertrag
korrigieren und einen lokal nicht-null typisierten Beleg erzeugen, bevor er im
Statusfixture gespeichert wird. Produktionscode und Assertions bleiben unverändert.

Gruppenmanager-Archivierung qualifiziert: 118 gezielte und Architekturfälle
bestehen; nach Korrektur des rein typisierten Testbelegs erneut alle 22
Gruppenmanagerfälle grün. Lauf 39624 endet exit 0: Typecheck, vollständiges
Lint/Format, Build, Smoke, Bundlebudget und acht Electron-Desktopfälle bestehen.
Renderergraph 1643683 Bytes, Grenzen unverändert. E2E-Summary:
.tmp/e2e-runs/functional-1788916514269-588411/summary.json.
Der echte UI-Weg speichert die geänderte Disposition vor Archivierung, stellt
wieder her, archiviert unverändert erneut, bricht Löschen ab, bestätigt es und
prüft Abwesenheit nach einem echten Prozessneustart.

Plan-Audit: bestanden für diesen Teilplan. Session und Gruppenmanager verwenden
denselben Lifecycle-Owner/Port. Der alte direkte Renderer-Archivierungsaufruf und
seine unbenutzten internen Wrapper sind entfernt; öffentliche Altoperationen
bleiben kompatibel. Save/Discard/Cancel vor Archivierung sind geprüft; Savefehler
lösen keinen Archiveauftrag aus. Wartungsauflösung hält den Archivierungsdialog
montiert, danach wird die ursprünglich gewählte Gruppe mit bestätigter Revision
archiviert. Statusfehler und Unmount behalten den Originalauftrag; erfolgreiche
Quittung beendet ihn ohne Replay. Wartungskontext verhindert neue Edits.

Roadmap-Audit: weiterhin Phase 4 in Arbeit. Nächste konkrete Lücke ist
use-group-manager-commands.ts joinCombat -> combat.joinGroup ohne Originalbeleg.
Auch die weiteren Combat-Operationen besitzen im operations/combat.ts-Vertrag
noch keine Execute-/Statusquittungen. Diese zusammenhängende Schnittstelle vor
weiterer Einzelumstellung inventarisieren und gemeinsam planen. Phasen 5–7,
kanonischer Handoff, Main-Gates und öffentlicher Release bleiben offen.
Candidate 7aa201635 / CI 34297853752 wurde zuletzt live in_progress ohne
fehlgeschlagene Jobs gelesen. Diese Runde als neuen Candidate sichern; kein
Handoff oder Main-Push vor vollständigen Gates des neuen exakten SHAs.

Phase 4 – Teilplan Combat-Auftragsvertrag und Persistenz:
Voriger Goal-Turn war Fortschritt (f1b56946b). Arbeitsbaum sauber, CI 34298646929
ist aktuell pending; kein abgeschlossener Handoff. Die Inventur von
operations/combat.ts und encounter-panels/combat-card bestätigt 17 zusammengehörige
direkte Schreiboperationen einschließlich Gruppenbeitritt, Initiative, HP/Status,
Phasenwechsel und XP-Abschluss. Gemeinsam einen Zod-validierten Execute-/Status-
Vertrag mit Originalkampagne, Originalszene, UUID und vollständiger typisierter
Absicht ergänzen. Ergebnisbeleg ist CombatCommandResult; Status kombiniert diesen
mit dem frisch gelesenen LiveSessionSnapshot. Vor neuer Ausführung Originalszene
prüfen; bereits gespeicherter Beleg darf nach Fokuswechsel read-only wiederkehren.

SQL-Journal bleibt beim Encounter-Aggregat. Alle 17 Operationen durch denselben
CampaignUnitOfWork samt Belegeintrag führen, einschließlich bisherigem complete.
Neue Kampagnenmigration 39 -> 40 initialisiert das Journal; Installation bleibt 42,
Registry steigt auf 20. Bootstrapper, Current-Format-Inventar und Version-Truth
entsprechend anpassen; veröffentlichte/frozen Altfixtures unverändert lassen.
Utility prüft Campaign-ID vor Execute und Status. Alte API-Operationen bleiben
bis zum vollständigen Renderer-Cutover erhalten. UI-Integration ist Folgeteilplan.

Abnahme: alle 17 gültigen Commandvarianten nativ ausführen; Beleg lesen, bei
absichtlich fehlgeschlagenem Journaleintrag gesamte Fachänderung zurückrollen,
Replay nach späterer Arbeit und Neustart ohne weitere Änderung. Fehlende Belege
read-only; falsche Campaign-ID, andere Szene und geänderte Absicht abweisen.
Migration/Bootstrap und Version-Truth prüfen. Danach Type/Lint/Format, relevante
bestehende LivePlay/Bridge/Architekturtests und Build/Smoke. Keine Freigabe der
Phase 4 allein aufgrund dieses Backend-Teilplans.

Backend-Review vor Nativenachweis: Die Utility-Komposition benennt ihren Store
campaigns, nicht store; den neuen Callback entsprechend korrigieren. Zusätzlich
Current-Format-Manifest und bestehende Latest-Schema-Assertions auf 40/20 bringen.
Historische 38->39-Fehlerinjektion bleibt erhalten; ihr erfolgreicher vollständiger
Vorwärtslauf endet jetzt bei 40. Die folgende Prüfung nutzt reale SQLite-Zustände
für alle 17 Befehle und stoppt bei jedem nicht belegten Phasenübergang.

Erste Nativeprüfung: prepare und Szenen-/Migrationsschutz bestehen. 16 andere
Fälle erreichen die eigentliche Aktion noch nicht: das neue Fixture verwendet
einen nicht vorhandenen initiative-Feldnamen. Auf den echten CombatSnapshot-
Vertrag umstellen. Zwei weitere Abweichungen: Current-Format-Owner müssen in der
Bootstrap-Reihenfolge stehen, und Version-Truth nennt noch Registry 19.
Beides aus den ausführbaren Registern ableiten; keine Abnahmegrenze abschwächen.

43/44 Kernprüfungen bestehen. updateResolution verwendet im neuen Fixture
Karten-IDs; der Fachvertrag erwartet die einzelnen IDs aus resolution.enemies.
Das Fixture auf diese Original-Enemy-IDs korrigieren. Die gezielte Abnahme bleibt
für diesen Fall offen, bis auch dessen Journaleintrag tatsächlich erreicht und
zurückgerollt wurde; die anderen 16 Aktionen erreichen diesen Nachweis bereits.

Alle 17 Combatvarianten erreichen jetzt den beabsichtigten atomaren Belegnachweis;
141 Prüfungen bestehen. Die zusätzliche Root-Qualifikation stoppt am noch nicht
erweiterten coveredCampaignRegistrations-Array ihres separaten JSON-Fixtures.
Nur diese Owner-Metadaten ergänzen, importierte Kampagnenpayloads unverändert
lassen. Abnahme zusätzlich stärken: Originalbelege nach echtem Szenenfokuswechsel
lesen/replayen und veränderte innere Befehlsabsicht ablehnen. XP-Award-Fixture vor
Ausführung mit ausgewählten Gegnern auf einen positiven Award einstellen, damit
der Rollback auch eine reale Party-XP-Änderung belegt.

Combat-Backend qualifiziert: 146 Fälle in 15 Dateien bestehen, einschließlich
aller 17 Befehle mit fehlgeschlagenem Beleginsert, unverändertem Datenrollback,
späterer XP-Arbeit, echtem Fokuswechsel und erneutem Öffnen der Kampagne. Positive
XP-Vergabe wird ebenfalls zurückgerollt. Migration 39->40 wird unterbrochen und
korrekt wiederholt; Golden-Master-Vorwärtsketten und Root-Qualifikation bestehen.
Weitere 38 Fälle in sechs Dateien prüfen die übrigen Current-Format-Kohorten und
das Operationsregister. Der zunächst angegebene bridge-operation-contract-Dateiname
existiert nicht; die tatsächlichen capability-bridge-adapter/operation-authorization-
Dateien wurden anschließend separat erfolgreich ausgeführt.

70812 ist exit 0 (Tests, Typecheck, vollständiges Lint/Format). 66875 ist exit 0
(Current-Format-Tests, Build/Smoke/Bundle). Renderergraph unverändert 1643683 Bytes.
Buildidentität bestätigt Installation 42, Kampagne 40, Registry 20.

Plan-Audit: Backend-Teilplan bestanden. Vollständige Combatabsicht, Originalszene
und UUID gehören zum unveränderlichen Fingerprint; Utility weist die falsche
Campaign-ID vor jedem Execute/Status ab. Neuer Write verlangt die Originalszene,
vorhandene Belege bleiben nach Fokuswechsel lesbar. Alle Befehle und Belege laufen
in einer gemeinsamen CampaignUnitOfWork; SQL bleibt beim Encounter-Aggregat.
Bootstrapper, additive Migration, Current-Format-Owner und Version-Truth stimmen.

Roadmap-Audit: Phase 4 weiterhin offen. Renderer nutzt noch die alten direkten
Combatoperationen; Backendtests sind keine UI-Abnahme. Der nächste Teilplan muss
Encounter-Panel, CombatCard-Eingaben, Ergebnis-/XP-Abschluss und Gruppenbeitritt
auf den gemeinsamen Auftrag umstellen und ihre offenen Änderungen bei Wartung
auflösen. Phasen 5–7, kanonischer Handoff, Main-Gates und Veröffentlichung bleiben
offen. f1b56946b CI 34298646929 zuletzt in_progress; neue Runde als Candidate
sichern und dessen exakte Remote-Gates vor Handoff erfüllen.

Phase 4 – Combat-Renderer-Integrationsplan, erster notwendiger Vertragsschritt:
Voriger Turn war Fortschritt (3f17660e5); Arbeitsbaum aktuell sauber. Die konkrete
UI-Inventur findet neben direkten Writes drei bislang flüchtige Eingaben:
Initiativewerte, HP-Betrag ohne gewählte Schaden/Heilung-Absicht und Ergebniswerte.
Zusätzlich ist „Abschließen“ bislang eine Folge aus Ergebnis speichern, XP vergeben
und Combat löschen; ein Fehler zwischen den Schritten lässt einen Teilabschluss.

Vor dem UI-Cutover zwei auf denselben Journalvertrag aufbauende Operationen
bereitstellen: saveInitiative speichert Werte in der Initiativephase, ohne Combat
zu starten; finishResolution speichert die gewählte Abrechnung, vergibt nötige XP
und beendet Combat atomar mit einem einzigen Beleg. Bereits vergebene XP dürfen
bei Wiederaufnahme nicht nochmals vergeben werden. Kein neues Schema nötig:
Tabelle und Resultatvertrag bleiben Version 1 bei Campaign 40/Registry 20.

Danach einen originalkampagnengebundenen Combat-Port und Controller mit derselben
Auftragsaufbewahrung wie Gruppenaktionen ergänzen. Read-only-Klärung muss Original-
beleg und aktuellen Stand unterscheiden, bei fehlendem Beleg Fokus/Combat-/Gruppen-
revision prüfen und bekannte Abwesenheit bis zu Save/Discard halten. Callback für
zugehörige Draftbestätigung darf auch bei zentraler Recovery laufen, nie nach
Unmount in eine andere Ansicht schreiben. Tests decken diese Grenzen ab.

Der folgende UI-Teil verwendet einen gemeinsamen Owner für Crumbs/EncounterPanel,
separate gespeicherte Initiative-/Ergebnisentwürfe und einen HP-Betragsentwurf,
der ohne explizite Schaden/Heilung-Wahl kein Spielkommando erfindet. Phasenwechsel
und Gruppenbeitritt klären Entwürfe zentral. Gruppenbeitritt bekommt denselben
Combatvertrag und verliert seinen direkten Write. Erst vollständige UI-/E2E-
Nachweise können diesen Integrationsplan schließen; Grundlagentests allein nicht.

Fortsetzung – Combat-Integrationsreview: Der vorherige Installationsturn hat
keinen Roadmap-Code verändert. Arbeitsbaum und kanonische Roadmap erneut gelesen;
keine laufenden Native-/Build-/E2E-Prozesse vorhanden. Ein konkreter Befund:
finishResolution vergibt XP atomar, verliert aber beim abschließenden clear das
Party-Ergebnis des Awards. Korrekturplan: dieses ursprüngliche Party-Ergebnis im
Gesamtbeleg erhalten. Native Tests ergänzen für reines Initiative-Speichern sowie
Abschluss mit neuer und bereits erfolgter XP-Vergabe. Diese Tests müssen positive
XP, unveränderte Initiativephase und ausbleibende Doppelvergabe direkt prüfen.
Die übrige UI-/Electron-Abnahme bleibt davon unabhängig offen.

24 native Combat-Belegfälle bestehen (9146 exit 0). CI 34299443859 ist dagegen
terminal fehlgeschlagen: fünf ältere Migrationsfälle in vier Dateien erwarten
nach vollständigem Vorwärtslauf noch Campaign 39 statt 40. Korrekturplan: nur
jeweilige Endversionsassertionen auf 40 anheben; historische Ausgangsstände,
Fehlerinjektionen und unveränderliche 0.2.0-Fixtures bleiben bestehen. Zusätzlich
den neuen XP-Test von bloßer Snapshot-Ungleichheit auf den tatsächlichen positiven
XP-Zuwachs des zugewiesenen Mitglieds verschärfen. Danach alle betroffenen nativen
Dateien und Typecheck ausführen.

60 native Fälle in fünf Dateien bestanden (73581 exit 0), einschließlich der
fünf CI-Regressionen und des positiven XP-Nachweises. UI-Abnahmeplan ergänzen:
im echten SceneDesktop Initiative ändern, Start zunächst abbrechen und danach
mit zentralem Speichern fortsetzen; den gespeicherten Wert im Kampf anzeigen.
HP-Betrag ändern, Schließen abbrechen und anschließend verwerfen; dabei darf kein
HP-Kommando entstehen. Anschließend expliziten Schaden auslösen und die Änderung
sichtbar prüfen. Bestehende Karten-/Fenster-/Neustartabnahme danach weiterführen.

Statische Prüfung: Typecheck bestanden, Lint stoppt an vier Meldungen desselben
Ref-Reads im Renderpfad von useCombatDraft. Fixplan: sichtbaren Draft mit React-
State führen, die synchrone Ref nur für Event-/Wartungsaktionen behalten.
Build bestanden. Bundleprüfung scheitert an der kumulierten Wachstumsschwelle:
1651178 erreichbare Bytes, +7495 gegenüber 3f17660e5. Keine neue Abhängigkeit;
Controller, Port und Draftintegration liegen im gemeinsamen Workspacegraph.
Nach finaler Korrektur den vorgesehenen Baseline-Helper mit expliziter Begründung
verwenden, harte Größenbudgets unverändert lassen.

Electron 62245 terminal exit 1: neue Initiative-/HP-Dialogschritte erreichen ihre
Assertions; später tritt beim Minimieren/Wiederöffnen eine stale-Fehlermeldung auf,
die Folgeaktionen verdeckt. Suite insgesamt nicht bestanden. Screenshot und
Log unter functional-1788918833977-596961 aufbewahrt. Nächste Untersuchung:
Desktop-Projektions-/Layoutrevision nach Combat-Refresh; den Fehler nicht durch
Wegklicken oder Entfernen der nachfolgenden Abnahme verdecken.

Ref-Korrektur geprüft: 29 Combat-Owner-/Port-/Drafttests in drei Dateien bestehen;
gezieltes ESLint für useCombatDraft bestanden (81812 exit 0). Der alte Build ist
nach dieser Sourceänderung ausdrücklich kein aktueller Abnahmenachweis.

Plan-Audit dieser Korrekturrunde: XP-Gesamtbeleg vollständig, positiver Award und
keine Doppelvergabe sowie reines Initiative-Speichern nativ nachgewiesen. Die fünf
remote gefundenen Endversionsassertionen sind lokal qualifiziert. Ref-Renderfehler
behoben und gezielt geprüft. Electron-Gesamtabnahme weiterhin fehlgeschlagen;
kein Handoff/Commit/Promotion in dieser Runde.

Roadmap-Audit: Phase 4 bleibt offen. Vorliegender Electronlauf erreicht die neuen
Dialogassertionen, scheitert danach bei Zeile 370 am überlagernden Workspace-stale-
Fehler. DesktopProjection würde eigene desktop-error anzeigen; Screenshot zeigt
feature.operation, daher Ursache in den Domain-/Workspaceaktionen lokalisieren,
nicht vorschnell Layoutrevision ändern. Danach Gruppenbeitritt-UI und Ergebnis-
abschluss vollständig qualifizieren, finale statische Prüfungen/Build/Bundle mit
begründetem Vergleichsstand und Electron wiederholen. Phasen 5–7 und sämtliche
Auslieferungsgates bleiben erhalten und offen.

Fortsetzung: vorheriger Turn war Fortschritt (Korrekturen und neue Abnahmebefunde).
Arbeitsbaum bestätigt. Diagnoseplan für den Electronfehler: die bestehende Abnahme
um assertionsfreie Zeitdiagnose nicht erweitern, sondern an den fachlichen
Übergängen ausdrücklich das Fehlen eines Workspacefehlers prüfen. So meldet die
Suite den ersten fehlerhaften Schritt statt erst die verdeckte Folgeschaltfläche.
Bei reproduzierbarem Befund die ursprüngliche fehlschlagende Capability ermitteln;
keine CAS-Prüfung abschwächen. Danach dieselbe Suite vollständig wiederholen.

Diagnose 42852 terminal exit 1: erster Workspacefehler liegt bereits nach HP-
Bearbeitung vor (Zeile 349), nicht beim Layoutwechsel. Codebefund: das Encounter-
Panel betreibt useEncounterEvaluation auch während aktivem Combat; jede neu
gefilterte Selection triggert die CAS-basierte Auswahlprüfung erneut. Während
ein Combatkommando die Szene verändert, kann diese obsolete Auswahlprüfung mit
der vorherigen Revision laufen und stale global melden. Korrekturplan: Evaluation
nur ohne aktiven Combat und ohne offenen Combatauftrag zulassen; beim Deaktivieren
laufende Antworten logisch entwerten. Unit-Abnahme muss fehlende unnötige Reads
und Ignorieren einer verspäteten Fehlerantwort sowie Reaktivierung belegen.
Danach Electron mit unveränderten vollständigen Abnahmeschritten erneut ausführen.

34848 exit 0: alle acht SceneDesktop-Electronfälle bestehen mit den vollständigen
Initiative-/HP-, Fenster-, Reise- und Neustartassertionen. Summary:
.tmp/e2e-runs/functional-1788919400141-602211/summary.json. 50307 exit 0 bestätigt
gezieltes Lint plus Typecheck der Korrektur. Plan-Audit: obsolete Auswahlbewertung
ist während Combat/Auftrag deaktiviert; verspätete Antworten sind entwertet.
Roadmap-Audit: dieser Fehler behoben, Phase 4 insgesamt noch offen.

Nächster UI-Nachweis: Gruppenbeitritt mit offenem Gruppenentwurf für Save/Discard/
Cancel durch den echten GroupManagerController führen. Save muss erst den neuen
Gruppenstand bestätigen, dann mit dessen frischer Revision genau einmal joinGroup
aufrufen; Cancel schreibt nichts; Discard verwendet den ursprünglichen Stand.
Bestehende Archivtests dabei beibehalten.

Gruppenbeitritt-UI: 86478 exit 0, 25 GroupManager-Fälle bestanden. Die drei neuen
Fälle belegen Save/Discard/Cancel, genau einen joinGroup-Auftrag, unveränderte
Originalszene und Combatrevision sowie nach Save die neue Gruppenrevision 2.
Archivabnahme bleibt mit denselben Tests erhalten. Gezieltes ESLint ist grün;
Typecheck 39904 läuft noch und muss terminal geprüft werden.

34567 exit 0: Baseline mit vorgesehenem Helper und expliziter Dependency-/Chunk-
Begründung aktualisiert, Bundleprüfung und Built-Smoke bestanden. Erreichbarer
Renderer 1651242 Bytes; feste Budgets und 16-KiB-Schwelle unverändert. Veränderung
seit vorherigem Baseline-Dokument 21021 Bytes umfasst auch zuvor qualifizierte
Roster-/Gruppenowner. Kein neuer Laufzeitimport von Schema-/Node-/SQL-Bibliotheken.

Plan-Audit: Versionskonflikt ursächlich durch obsolete Auswahlabfrage behoben,
Unit-Reproduktion und vollständige Electron-Suite bestanden. Gruppenbeitritt mit
zentraler Entwurfsauflösung ist jetzt ebenfalls im echten Controller belegt.
Roadmap-Audit: Phase 4 bleibt offen, insbesondere vollständiger Ergebnisabschluss
über die UI und abschließende Prüfung der gesamten Combatintegration. Noch keine
Candidate-Sicherung dieser Integration, kein exakter grüner CI-/Handoff-/Main-
Nachweis. Phasen 5–7 bleiben ungekürzt offen.

39904 abschließend exit 0: auch Typecheck für die Gruppenbeitritt-Abnahme bestanden.

Fortsetzung – vorheriger Turn war Fortschritt, Arbeitsbaum erneut bestätigt.
Plan für den noch fehlenden vollständigen UI-Ergebnisabschluss: am Ende der
bestehenden Electron-Suite einen isolierten Testkampf mit zugewiesenem Charakter
und Wolfgruppe im Wegwerfprofil vorbereiten. Kampfstart, Auflösung, manuelle
Gegnerwahl und Abschluss über sichtbare Bedienelemente durchführen. Abbrechen
muss Entwurf und ursprüngliche Party-XP erhalten; Speichern muss den Ergebnis-
entwurf persistieren und den atomaren Abschluss auslösen. Party-XP vor/nach dem
Vorgang anhand des angezeigten Awards vergleichen, Combat muss verschwinden und
nach Prozessneustart weiterhin beendet sein, ohne weitere XP-Vergabe. Keine
Änderung an echten Nutzerprofilen, historischen Fixtures oder Abnahmegrenzen.

Portable-Gesamtprüfung 16168 exit 0: Format/Lint/Typecheck, Architektur-, Unit- und
Integrationstests sowie Referenz-/Version-/Renderartefaktprüfungen bestanden.
53147 dagegen exit 1: acht bestehende Electronfälle grün, neuer Abschlussfall
scheitert innerhalb des Test-Setups bei execute/sync; WebDriver serialisiert die
Fehlerantwort nicht sinnvoll. Fixplan: Setupfehler zusammen mit der aktiven
Setupstufe als einfache Textdaten zurückgeben und außerhalb der Browserfunktion
explizit fehlschlagen. Keine Wiederholung unbekannt abgeschlossener Setupwrites
innerhalb derselben Funktion. Anschließend tatsächliche Ursache korrigieren.

23701 exit 1: Diagnose benennt prepareCombat -> validation_failed. Vorherige
Rosterabnahme weist Reservecharaktere ohne Level zu; evaluateSceneGroupDraft
verlangt ausdrücklich vollständige Level aller zugewiesenen Mitglieder. Fixplan:
der isolierte Abschlussfall wählt einen vorhandenen Charakter mit Level und setzt
seine Testbesetzung explizit per setRoster. Produktive Startvalidierung bleibt
unverändert. Zusätzlich Diagnosefeld failureText statt error verwenden: WebDriver
interpretiert ein Top-Level-error-Feld als Transportfehler und wiederholt dadurch
die Browserfunktion. Ein normaler Datenwert verhindert solche Setupwiederholungen.

58314 exit 1: Setup meldet jetzt korrekt als normale Textdaten setRoster ->
validation_failed, ohne WebDriver-Wiederholung. Codeprüfung zeigt die zweite
Fixturebedingung: setRoster darf aktive Mitglieder einer anderen Szene nicht
stillschweigend übernehmen. Korrektur: den gewählten vollständigen Charakter mit
der vorhandenen expliziten assignPartyMember-Operation in die Testszene verschieben,
frischen Stand lesen und erst dann den isolierten Roster setzen. Diese fachliche
Grenze bleibt unverändert; der Abschlussfall bekommt einen gültigen Ausgangszustand.

41193 exit 0: alle neun SceneDesktop-Electronfälle bestanden. Neuer Abschlussfall
belegt Abbrechen mit unveränderten Party-XP und erhaltenem manuellen Entwurf,
Speichern/Abschluss mit genau dem angezeigten positiven Award, unveränderte XP
nicht zugewiesener Mitglieder, Combat=null sowie dieselbe Party nach Prozess-
neustart. Summary .tmp/e2e-runs/functional-1788920531872-614481/summary.json.

Plan-Audit der Combat-Renderer-Integration: 19 journalisierte Befehlsvarianten,
Originalkampagnen-Port, gehaltene unbekannte Aufträge, zentrale Initiative-/HP-/
Ergebnisentwürfe und Gruppenbeitritt integriert. Native Beleg-/Rollback-/Replay-
Nachweise, UI-Owner/Port/Controller-Prüfungen, positive Abschluss-XP, neun echte
Electronfälle, vollständige portable Prüfung mit 1869 Tests, Build/Smoke/Bundle
bestehen. Nach letzter ausschließlich testseitiger Setupkorrektur läuft nochmals
Typecheck 77587; erst terminaler Erfolg erlaubt Candidate-Sicherung.

Roadmap-Audit: Combat-Teilplan erfüllt, Phase 4 insgesamt offen. Erneute Inventur:
useMaintenanceDraftGuard hat keine aktiven Aufrufer mehr. Direkte Szenenortänderung
in useSessionSceneController/useSessionMutationController und Reiseentwürfe in
travel-view-projection/use-travel-commands besitzen noch keinen vollständigen
Wartungsauftrag; dieser verbleibende Umfang darf nicht als erledigt gelten.
Als nächste Teilpläne die tatsächlichen Save-/Discard-Semantiken und laufenden
Aufträge dieser Bereiche bestimmen und absichern. Phasen 5–7, exakte Remote-Gates,
kanonischer Handoff, Main-Promotion und öffentliche Freigabe bleiben offen.

77587 exit 0: abschließender Typecheck bestanden. Combat-Integration als geprüften
Candidate-Zwischenstand sichern und pushen; unveränderte vollständige Remote-
Check-Gates gelten weiterhin vor jeglichem Handoff oder Main-Promotion.

Phase 4 – Szenenmetadaten-/Fokusplan. Voriger Turn war Fortschritt; HEAD 5ff524103
sauber, CI 34303180324 in_progress. setLocation/focus benutzen noch einen
latest-only-Callback ohne gehaltenen Originalauftrag. UI-Sperre allein klärt
verlorene Antworten oder einen Unmount während des Writes nicht.

Gemeinsamer Vertrag: scene-command ergänzt die bestehenden SceneParty-Varianten
um set-location und focus. Vorhandenes Scene-Aggregat-Journal und dessen
unveränderlicher Full-Snapshot-Beleg bleiben der einzige Speicherpfad; historische
Tabelle/Bootstrap/Schema-Version bleiben unverändert. Alte Party-Operationen
validieren weiter ihren engen Vertrag und delegieren an den gemeinsamen Executor.
Neue Szenenoperationen binden Campaign-ID in Utility und Ursprungsszene in die
Absicht ein. Replay liest Originalbeleg vor Fokus-/Revisionsprüfung, Status schreibt
nichts. Neue Ausführung verlangt weiterhin Originalfokus und aktuelle Revision.

Zunächst Backend und native Nachweise: Beleginsertfehler rollt Orts-/Fokusänderung
zurück; alte und neue Belege bleiben nach späterer Arbeit und Neustart lesbar;
geänderte Absicht/falsche Campaign-ID werden abgewiesen. Danach originalgebundener
Renderer-Port/Owner, zentraler Übergang und Speichern-/Verwerfen-Statusanzeige;
aktive direkte setLocation-/focus-Writes abschalten. Fehlender Beleg mit geändertem
Stand darf nicht automatisch überschrieben werden. UI- und Electron-Nachweis
bleiben verbindlich; der Backendabschnitt allein schließt diesen Teilplan nicht.

Erste Grundlagenprüfung: 76 bestehende Fälle bestehen; vier neue Szenenfälle
scheitern vor ihrer Aktion am ungültigen Ortsfixture (Tags dürfen nicht leer sein).
Korrekturplan: einen gültigen Ortstag setzen, ohne den Ortsvertrag zu verändern;
dann dieselben nativen Beleg-/Rollbackfälle erneut ausführen.

Grundlagen: 11 native Fälle (inklusive alter Partybelege) sowie 23 Originalport-/
Controllerfälle bestehen. Typecheck/Lint der Backendbasis bestanden. UI-Cutover
umgesetzt: Szenenort und Fokus verwenden den neuen gehaltenen Owner; Status und
zentrale Klärung stehen im SceneDesktop, Ortseingabe/Fokus sind bei offenem Auftrag
gesperrt. Bestehende Szenenwechsel-Klärung bleibt erhalten. Der bisherige
Workspace-Controller-Test muss seinen transportnahen Mock auf executeCommand plus
Full-Snapshot-Beleg umstellen; die bisherige Ergebnis-/Revisionsassertion bleibt
bestehen. Zusätzlich echte UI-Owner-Tests für Save/Discard/Cancel und Unmount.

UI-Prüfung: 94 Workspace-/Port-/Controller-/Architekturfälle plus vier zentrale
Scene-Ownerfälle bestehen. Letztere belegen Save/Discard/Cancel anderer Editoren,
frische Szenenrevision nach Save, gesperrte Aktion während Klärung sowie verlorene
bereits ausgeführte Ortsänderung nach Unmount ohne erneuten Write.

Electronplan: bestehenden neun Fällen einen Ortswechsel bei offenem XP-Betrags-
entwurf hinzufügen. Abbrechen erhält alten Ort/Party; explizites Verwerfen klärt
den Betrag und führt nur den gewählten Ortswechsel aus. Neustart muss Ort und
unveränderte Party bestätigen. Bestehende Fokus-/Fenster-/Combatfälle bleiben
vollständig bestehen. Danach passende statische und Bundle-/Smokeprüfungen.

13489 exit 0: alle zehn SceneDesktop-Electronfälle bestanden, einschließlich
Ortswechsel mit XP-Entwurf, Abbrechen/Verwerfen und unverändertem Partyzustand nach
Neustart. Full Lint meldet ausschließlich fünf neue Testhilfenstellen: async ohne
await, unnötiger DOM-Cast und untypisierte expect.any-Zuweisungen. Fixplan: echte
Promise-Rückgabe, generische DOM-Abfrage und getrennte UUID-/Payloadassertionen mit
typisierten Transportmocks. Keine fachliche Assertion oder Prüfung entfernen.

Cleanup-Plan nach erfolgreichem UI-Cutover: useSessionMutationController hat keine
Produktaufrufer mehr; seine zwei Testdateien prüfen nur den ersetzten latest-only-
Mechanismus. Entfernen und den Baselineeintrag/Architektur-Inventar auf die neuen
Szenenowner umstellen. Die relevanten Sicherheitszusagen sind jetzt stärker durch
scene-command-port (Originalkampagne vor/während Writes/Reads), scene-command-
maintenance (frische Revision nach Draft-Save) und scene-command-controller
(gehaltene Originalantworten statt verlorener älterer Writes) abgedeckt. Bestehende
Gruppenowner-Tests behalten deren unabhängige Recovery-Abnahme. Danach passende
Architektur-/Ownerprüfungen, vollständiges Lint/Type/Format und erneuter Build/Smoke.

Abschließende Qualifikation: 94790 exit 0 (37 Cleanup-/Owner-/Architekturregressions-
fälle, Typecheck, vollständiges Lint/Format). 73016 exit 0 (neuer Build, Smoke und
Bundle; Renderer 1656365 Bytes innerhalb unveränderter Limits). 82630 exit 0
(Version-Truth sowie zwölf Root-/Baseline-/Bridge-/Autorisierungsfälle). Zehn
Electronfälle im Lauf functional-1788921422808-619158 bestanden. Nach der Electron-
Abnahme wurden ausschließlich ungenutzter Altcontroller/alte ausschließlich ihn
prüfende Tests entfernt und neue Testhilfen typisiert; neue Runtimepfade unverändert.

Plan-Audit Szenenort/Fokus: gemeinsamer Executor nutzt vorhandene Journal-Tabelle,
Party-Kompatibilitätsvertrag bleibt eng und delegiert. Replay ist vor aktueller
Fokusprüfung, Status read-only; Nativebelege bleiben nach späteren Änderungen und
Neustart unverändert. Neue Writes prüfen Originalfokus und CAS, Utility prüft die
Originalkampagne. Renderer hält Originalauftrag über Unmount, klärt fremde
Entwürfe zentral und blockiert erneute Änderungen; kein aktiver direkter alter
Session-Mutationspfad bleibt. Definierte UI-/E2E- und technische Abnahme bestanden.

Roadmap-Audit: dieser Szenen-Teilplan erfüllt; Phase 4 noch nicht geschlossen.
Reiseplanung/-aktionen in useTravelViewProjection/useTravelCommands besitzen noch
keinen vollständigen Draft-/Wartungsowner. Nächster Teilplan muss Route speichern
von Reise starten trennen und aktive Aufträge vor Wartung klären, ohne durch
„Speichern“ eine Reise zu erfinden. Phasen 5–7 bleiben offen. Voriger Candidate
5ff524103/CI 34303180324 zuletzt in_progress, keine fehlgeschlagenen Jobs gesehen;
kein Handoff oder Main-Abschluss behauptet. Diesen qualifizierten Zwischenstand
als neuen Candidate sichern; vollständige exakte Remote-Gates bleiben verbindlich.

### Phase 4 – Reiseplanung und laufende Reiseaufträge, Teilplan (2026-09-09)

Wiederaufnahme: vorheriger Installationsturn verifizierte nur den bereits aktuellen
Roadmap-Skill; kein Fortschritt an der App. Worktree zu Beginn sauber auf 978860ec7.
Die kanonische Roadmap und AGENTS wurden erneut gelesen. Phase 4 bleibt offen.

Befund: useTravelViewProjection hält Wegpunkte und lokalen Multiplikator nur im
Renderer. HexTravelStore.start persistiert eine aktive Reise und verändert bereits
Partyposition/Szenenort; diese Operation ist deshalb kein Speichern eines Entwurfs.
useTravelCommands verwendet eine abbrechbare FIFO-Projektion ohne gehaltenen
Wartungsowner. Im Produkt existiert nur createHexTravelProviderPort; 'dungeon' ist
bislang eine Erweiterungsoption des generischen Ports, kein zweiter produktiver
Provider. Keine neuen Dungeonfunktionen aus dieser Typoption ableiten.

Ziel: eigenständig speicherbare Route pro Originalkampagne/Szene, getrennt von der
aktiven Reise; bestätigte Reiseaktionen mit dauerhaftem Originalbeleg. Zentrale
Klärung erhält Entwürfe bei Abbruch/Fehler und wartet auf laufende Aufträge. Ein
Speichern darf weder Reisezeit starten noch Position oder Party verändern.

Umsetzungsfolge:
1. Strikte gemeinsame Hex-Reiseverträge: versionierbarer Routenstand mit eigener
   CAS-Revision, explizites Speichern/Löschen des Plans, bestehende sechs Reise-
   aktionen, UUID-Auftragsidentität und Originalkampagne. Status trennt originalen
   Beleg von frischer Reise-/Routenprojektion. Vertragstests prüfen insbesondere
   die Trennung von Planrevision, Reiserevision und Szenenrevision sowie Grenzen.
2. SQL beim Hex-Aggregat: additive Migration für Plan und unveränderliche Belege;
   atomare Aktion samt Beleg, Replay vor CAS, Status ausschließlich lesend.
   Utility prüft Originalkampagne, neue Aktionen Originalszene. Bestehende APIs
   bleiben kompatibel. Native Tests: Rollback, Replay, spätere Änderungen,
   Neustart, Quellen-/Versionsschutz. Frozen-0.2-Fixtures bleiben unverändert.
3. Originalgebundener Rendererport und gehaltener Befehlsowner; unklarer Ausgang
   wird über Belege geklärt, nicht blind erneut geschrieben. Planowner registriert
   Save/Discard/Cancel und sperrt lokale Änderungen während zentraler Klärung.
   Laden stellt gespeicherte Wegpunkte wieder her, Start bleibt eigene Aktion.
4. UI-/Electron-Abnahme: Route speichern ohne Reisebeginn, Wiederladen, Verwerfen,
   Abbrechen, mehrere Editoren, fehlgeschlagenes Speichern, laufender/verlorener
   Auftrag und spätere Arbeit. Danach vollständiges Phase-4-Inventar und getrennte
   Plan-/Roadmap-Audits, bevor Phase 4 geschlossen werden darf.

Erster überprüfbarer Abschnitt ist der gemeinsame Vertrag. Er aktiviert noch
keinen neuen Datenweg; Backend und UI sind danach weiterhin explizit offen.

Vertragsprüfung: zwölf Fälle bestanden. Gezieltes Lint fand eine ungenutzte
Destrukturierungsvariable im Negativtest; Typecheck wurde durch && noch nicht
begonnen. Korrekturplan: den absichtlich falschen CAS-Payload explizit konstruieren,
anschließend Vertragstests, Lint und Typecheck erneut prüfen.

Vertragsabschnitt – Prüfergebnis: Lauf 82509 exit 0: gezieltes ESLint, zwölf
Hex-Reisevertragstests und beide Typecheck-Projekte bestanden. Prettier --check
für beide neuen Dateien und git diff --check bestanden ebenfalls. Kein nativer
Test, Build oder Electronlauf ist für diesen Abschnitt gestartet worden.

Plan-Audit Vertragsabschnitt: Plan und aktive Reise haben getrennte Payloads und
Revisionen; Löschen ist explizit plan:null. Alle sechs bisherigen Reiseaktionen
behalten ihre Eingaben. Der neue Kampagnenumschlag verlangt eine UUID; Beleg und
Status enthalten getrennte Original-/Frischprojektionen. Grenzen für Wegpunkte,
Multiplikator und Koordinaten sind durch wiederverwendete Hex-Verträge und
Negativtests belegt. Kein Dateipfad-/SQL-Zugriff für den Renderer hinzugefügt.

Roadmap-Audit: dies ist ausschließlich die geprüfte Schnittstellenbasis des oben
aufgezeichneten Teilplans. Persistenz, Migration, Utility-Capabilities, gehaltene
Rendererowner sowie deren native und UI-/Electronabnahme fehlen weiterhin. Kein
behaupteter Schutz offener Reiserouten und kein Phase-4-Abschluss. Nächster Schritt
ist Abschnitt 2: Hex-eigene Plan-/Belegtabellen und atomarer Executor. Bestehende
Datenstände Installation 42/Kampagne 40/Registry 20 wurden noch nicht verändert.
Änderungen dieses Abschnitts liegen uncommitted im Candidate-Worktree; kein
Handoff/Main-Push/Release. Exakter Vorgänger-SHA 978860ec7 in CI 34304409104 beim
aktuellen Abruf weiterhin in_progress (conclusion leer); nicht als grün gewertet.

### Phase 4 – Hex-Persistenz und atomare Reisebefehle, Ausführung (2026-09-09)

Voriger Zielturn: Fortschritt durch geprüfte Vertragsbasis. Worktree stimmt mit
protokolliertem Stand überein. Konkretisierung vor Backendänderung: neuer Hex-
RoutePlanStore besitzt Planrevision und JSON; Löschen erhält einen Tombstone mit
weiterlaufender Revision. HexTravelCommandJournal besitzt unveränderliche Belege.
HexTravelCommandService verbindet vorhandenen HexTravelService, LivePlayService
und CampaignUnitOfWork auf derselben aktiven Kampagnenverbindung. Kein Import des
LivePlayService in hex-travel.ts (bestehende Gegenrichtung bleibt zyklusfrei).
Plan-Save prüft Szenen-CAS und vorhandene Karte/Wegpunkte, setzt aber weder Reise,
Spielzeit noch Partyposition. Die Route bleibt auch nach explizitem Start als
Plan erhalten; Start und Plan-Löschen sind getrennte Benutzerabsichten.
Migration 40→41 plus Registry 21 und Bootstrap verwenden dieselben Hex-eigenen
Initializer. Status/Planlesen sind kampagnengebunden, neue Writes fokusgebunden.
Native Qualifikation muss alle sieben Varianten, atomaren Rollback, Replay nach
späteren Änderungen und Neustart, read-only Status, falsche Kampagne/Fokus und
40→41-Migration abdecken. Keine Behauptung einer fertigen Rendereranbindung.

Backendprüfung: 20 native Reise-/Belegfälle bestanden (47366); Typecheck 46333
bestand. Vollständiger Fast-Lauf 52264 beendete Format/Lint/Type erfolgreich,
scheiterte dann mit zwei Architekturabweichungen (85/87 bestanden): neue Hex-
DDL referenziert direkt die Scene-Tabelle; der Renderer-Architekturprüfer verlangt
noch den im Vorgänger entfernten use-session-mutation-controller.

Korrekturplan vor Änderungen:
- Hex-Plan-DDL folgt vorhandenen Hex-Verantwortungsgrenzen mit eigener scene_id;
  Szenengültigkeit wird ausschließlich über SceneStore geprüft. Kein fremdes
  Scene-SQL und keine Ausnahme im Ownership-Test. Es gibt aktuell keinen produktiven
  Szenenlöschpfad; keine automatische Scene-Cascade als implementiert ausgeben.
- Architekturprüfer auf tatsächlichen use-scene-commands-Owner mit erforderlicher
  Maintenance-/Transition-/Originalport-Anbindung umstellen; Negativprobe für eine
  entfernte Maintenance-Anmeldung ergänzen. Nicht nur den alten Gateeintrag löschen.
- Reviewfund unabhängig von Testfehlern: position löscht hex_journey und setzt die
  sichtbare Reiserevision zurück. Start im neuen Belegvertrag verlangt deshalb
  zusätzlich expectedSceneRevision und prüft diese vor Wirkung. Legacy-Start-API
  bleibt unverändert; neuer nativer Fall belegt Ablehnung nach Neupositionierung
  trotz identischer Reiserevision. Vertrags-/Backendtests und statische Gates neu.

Korrekturrunde 16567: 54 Vertrags-/Native-/Architekturfälle bestanden. Erneuter
Fast-Lauf 10602 bestand vollständiges Format/Lint, Typecheck meldete danach einen
Testtypfehler: Zugriff auf expectedRevision über eine noch ungeschnittene
Befehlsunion. Fixplan: die vor Neupositionierung erfasste Reiserevision separat
halten und sowohl im Startauftrag als auch in der Assertion verwenden. Kein Cast
und keine abgeschwächte Assertion. Danach gezieltes Lint/Format, beide Typechecks,
volle portable Tests und übrige Fast-Gates; Build/Smoke/Bundle erst danach.

Lauf 97078: beide Typechecks und alle 87 Architekturtests bestanden; portable Unit-
Suite 1436/1439 bestanden. Drei Fehler betreffen veraltete Current-Format-Metadaten
und erwartete Versionspfade (noch Kampagne 40). Integration/Build wurden dadurch
noch nicht ausgeführt. Fixplan: ausschließlich das aktuelle Qualifikationsmanifest
auf 41 aktualisieren und neue Bootstrap-Owner in tatsächlicher Reihenfolge
aufnehmen. Root-Kohorte bekommt überprüfte initialize-only-Abdeckung der beiden
anfangs leeren Hex-Tabellen mit echten Row-Count-Assertions; keine Behauptung
gefüllter Reisebelege in diesem Fixture. Die separaten Reiseintegrationstests
belegen deren gefüllte Zustände. Versionspfad-Test auf echte 40→41-Kante ergänzen;
Frozen-0.2-Dateien unverändert. Danach Current-Format-/Versions-Unitfälle und volle
Integration sowie die übrigen Fast-/App-Gates ausführen. Die 1436 bestandenen
unveränderten Unitfälle müssen dafür nicht pauschal erneut laufen.

Backendabschluss – Nachweise: 14600 exit 0, neun gezielte Versions-/Manifest-/
Rootqualifikationsfälle bestanden. 60379 exit 0: gezieltes Lint der Korrekturen,
beide Typechecks, alle 387 Integrationstests, Referenz-/Generierungskatalog,
Version-Truth, Render-Artefaktprüfung und check:portable:app (Build, Smoke, Bundle)
bestanden. Renderergraph weiterhin 1656365 Bytes, keine Baseline-/Limitänderung.
Vollständiges Format/Lint bestanden zuvor in 10602; danach nur dokumentierte
Testtyp-/Versions- und Qualifikationskorrekturen, jeweils gezielt geprüft/formatiert.
87 Architekturtests bestanden im finalen Portablerun; dessen 1436 erfolgreichen
Unitfälle plus gezielt korrigierte drei Fälle ergeben vollständige Unit-Abdeckung
für diesen Abschnitt, ohne einen einzelnen erfolgreichen Full-Fast-Lauf zu behaupten.
Keine laufenden lokalen Test-/Buildprozesse. Frozen tests/fixtures/release-0.2.0
besitzen keinen Diff. Schema jetzt Installation 42/Kampagne 41/Registry 21.

Plan-Audit Backendabschnitt: sieben explizite Befehlsvarianten besitzen atomare,
fingerabdruckgebundene unveränderliche Belege. Replay prüft den vorhandenen Beleg
vor aktueller Fokus-/CAS-Prüfung; Status ist nachgewiesen query_only-kompatibel.
Native Tests erzwingen Belegfehler nach Wirkung und vergleichen das vollständige
vorherige Reise-/Session-/Planzustandspaar, anschließend Originalergebnis nach
späterer XP-/Fokusänderung und Datenbankneustart. Neue Aktionen auf fremdem Fokus
und falscher Kampagne werden verworfen. Plan-Save verändert ausschließlich Plan;
Clear erhält Revisionstombstone. Zusätzlicher Szenen-CAS verhindert Start nach
Neupositionierung trotz zurückgesetzter Reiserevision. Migration 40→41 bleibt
bei Fehler einschließlich DDL atomar und bewahrt eine laufende Reise sowie Session.
Initializer liegen beim Hex-Aggregat und werden von Migration und Bootstrap
verwendet. Utility-Capabilities sind über Zod/GM-Rolle registriert; Legacy-APIs
bleiben unverändert. Alter Renderer-Architekturverweis durch tatsächliche
Maintenance-/Transition-/Originalport-Verpflichtung mit Negativprobe ersetzt.

Roadmap-Audit: Vertrags-/Backendabschnitte 1–2 des Reise-Teilplans erfüllt.
Abschnitte 3–4 (Originalport, gehaltener Rendererowner, persistierte Planprojektion,
zentrale Save/Discard/Cancel-Anbindung, UI-/Electronabnahme) sind ausdrücklich
noch offen. Bestehendes Travel-UI nutzt weiterhin die Legacy-APIs; daher keine
Behauptung, Reiseentwürfe seien bereits in der ausgelieferten Oberfläche sicher.
Phase 4 bleibt offen, ebenso Phasen 5–7. Nächste Arbeit: useSessionTravelIntegration
mit Originalkampagnenbindung ergänzen und den generischen Travel-Port um Plan-/
Belegoperationen erweitern; gehaltene Originalantworten dürfen bei Scopewechsel
nicht vom bisherigen FIFO-Abbruch verworfen werden. Vor UI-Änderungen konkreten
Teilplan mit Lifecycle-/Draft-Abnahmekriterien fortschreiben.

Voriger Candidate 978860ec7 hat im abgeschlossenen Portable-Job 102317982553 den
nun behobenen missing_owner_source-Fehler; andere aufgelistete Native-/Linuxjobs
grün, Aggregat zuletzt noch in_progress. Nicht handoff-fähig behauptet. Diesen
geprüften Backendzwischenstand jetzt committen/pushen; exakte Remote-Gates sowie
Handoff/Main-Promotion bleiben ausstehend. Lokaler Dirty-Build war ausschließlich
Qualifikation und ist kein Übergabe-/Releaseartefakt.

### Phase 4 – Originalgebundener Reise-Renderer, Teilplan (2026-09-09)

Voriger Zielturn: Fortschritt, Backend f3b485af2 sauber committed/gepusht. Aktueller
Worktree sauber; AGENTS und bisherigen Reise-Teilplan erneut geprüft. Phase 4
bleibt offen. Nächster implementierter Abschnitt stellt Originalport und gehaltenen
Befehlscontroller bereit; anschließend werden generische Travel-Hooks und die
Planprojektion darauf umgestellt, ohne einen optionalen Legacy-Fallback einzubauen.

Konkreter Plan vor Änderungen:
1. Ein atomar gelesener Reise-/Plan-/Sessionzustand als readState-Capability, damit
   Recovery nicht drei zeitlich unterschiedliche Antworten zusammenbauen muss.
   Port ist an ursprüngliche Kampagne UND Szene gebunden. Aktive sowie geladene
   Kampagne vor/nach Transport und Workspace-Refresh prüfen; nach abgeschicktem
   Write geänderte Bindung als outcome_unknown erhalten. Keine globalen API-Zugriffe.
2. Gehaltener Hex-Reisecontroller behält den Originalauftrag, blockiert weitere
   Writes und stellt nach Unmount einen Wartungsteilnehmer. Status prüft nur Belege,
   publiziert frischen Zustand separat und wiederholt keine Aktion. Explizites Save
   nach sicher belegter Abwesenheit verwendet neue UUID und prüft die Revisionen
   erneut; Discard klärt laufende/unbekannte Writes vor Freigabe. Fehlende Reads
   bleiben blockierend. Kein Callback in eine inzwischen geschlossene/fremde Ansicht.
3. Reviewergänzung zur bereits abgesicherten Startaktion: auch Pause/Resume/Abort/
   Multiplikator können nach position+start dieselbe Reiserevision wie eine ältere
   Reise besitzen. Deshalb erhalten alle NEUEN journalisierten Reiseaktionen
   zusätzlich Szenen-CAS; Legacy-APIs unverändert. Native Regression prüft einen
   pausierenden Altauftrag nach einer neuen Reise bei gleicher Reiserevision.
4. Port-/Controllerprüfungen: Kampagnenwechsel vor/während jeder Operation,
   falsche Szene, Refreshfehler, Originalbeleg plus spätere Arbeit, alle sieben
   Revisionsvarianten, Unmount während laufendem Write, zentrale Save/Discard-
   Klärung, Abwesenheit mit Konflikt, neue Änderungen zwischen Status und Retry.
   Relevante Native-/Bridge-/Architekturregressionen und Type/Lint/Format folgen.

Danach eigener konkreter UI-Cutover: generischer TravelProviderPort transportiert
Planstände/Auftragsidentitäten; useTravelCommands verwendet gehaltene Aufträge
anstelle abbrechbarer FIFO-Writes. useTravelController registriert gespeicherte
Routenentwürfe und sperrt Eingaben während Klärung; SessionTravelIntegration bindet
Originalkampagne und zeigt Status/zentralen Dialog. UI-/Electronabnahme muss noch
folgen; dieser Grundlagenabschnitt allein schließt Phase 4 nicht.

Erste Qualifikation: 41877 exit 0, 61 neue/erweiterte Vertrags-, Port-, Controller-
und native Belegfälle bestanden. Einschließlich später Neupositionierung bei
identischer Reiserevision, query_only-readState, Originalkampagne vor/während
Transport, falscher Szene, sieben Recoveryvarianten, Revisionskonflikten,
zentraler Klärung nach Unmount und serialisiertem explizitem Retry.
Früher Typecheck 53416 lief vor vollständiger Anpassung des Multiplikatorfixtures
und meldete dort noch fehlendes expectedSceneRevision. Das Fixture wurde während
der Implementierung vervollständigt; jetzt erneuter Typecheck und relevante
Architektur-/Bridge-/Reiseregresse. Save hält auch seine asynchrone erneute
Revisionsprüfung als einen serialisierten Auftrag; ein zweiter Save teilt dessen
Promise, andere Writes bleiben gesperrt.

Abschluss dieses Grundlagenabschnitts: 40271 exit 0. Gezieltes Lint sämtlicher
geänderter TS-/TSX-Dateien, beide Typechecks, 157 Architektur-/Autorisierungs-/
Bridge-/Vertrags-/Port-/Controller-/Nativefälle sowie Build/Smoke/Bundle bestanden.
30021 exit 0: vollständige Formatprüfung, Version-Truth und git diff --check.
Renderergraph unverändert 1656365 Bytes; keine Budget-/Baselineänderung. Schema
weiter Installation 42/Kampagne 41/Registry 21, keine zusätzliche Migration nötig.
Keine laufenden lokalen Prüfprozesse. Neue Wrapper-Verträge ergänzen nur die CAS-
Anforderung neu eingereichter Befehle; bestehende Belegergebnisse und Legacy-APIs
behalten ihr Datenformat.

Plan-Audit Originalport/Controller: readState liefert Reise, Plan und Session in
einem synchronen Utility-Aufruf. Originalport prüft geladene/aktive Kampagne und
Originalszene vor Transport; bei Kampagnenwechsel nach Write bleibt outcome_unknown.
Workspace-Refresh wird vor frischer Reiseprojektion vollständig abgeschlossen und
beide Antworten erneut an die Originalkampagne gebunden. Controller trennt
Originalbeleg von aktuellem Stand, hält Write und Readfehler über Unmount, klärt
bei Save/Discard erst offene Aufträge und verwendet nur bei bestätigter Abwesenheit
und frischen Revisionen eine neue UUID. Gleichzeitige Save-Aufrufe werden auch
während Retry-Preflight zusammengehalten. Native Regression belegt: ein alter
Pauseauftrag kann eine neue Reise bei gleicher Reiserevision nicht anhalten.
Tests für Originalbindungen, alle sieben Recoveryvarianten, Konflikte zwischen
Status/Refresh/Retry und zentrale Klärung nach Unmount bestanden.

Roadmap-Audit: Originalport-/Befehlscontroller-Grundlage dieses Teilplans geprüft.
Noch kein Produkt-Cutover: useSessionTravelIntegration und useTravelCommands
instanziieren den neuen Owner noch nicht. Gespeicherte Routen werden noch nicht
in useTravelViewProjection geladen und als Editor registriert. Deshalb bleibt
Phase 4 offen; nächste Arbeit ist ausdrücklich der geplante UI-Cutover inklusive
Maintenance-Registrierung auch im geöffneten Fenster, Eingabesperre, zentralem
Dialog und Routenentwurf. Danach gezielte UI- und echte Electronabnahme, bevor
Phasen 5–7 beginnen dürfen. Kein Handoff/Main-/Releaseabschluss.

Candidate f3b485af2 in CI 34305976464 beim Abruf noch in_progress; Vorgänger
978860ec7 ist inzwischen terminal failure (der hier bereits korrigierte alte
Architekturpfad). Diesen geprüften Abschnitt als neuen Candidate committen und
pushen; vollständige exakte Remote-Prüfungen bleiben ausstehend.

### Phase 4 – Reisebefehle in der produktiven Oberfläche, Cutoverplan (2026-09-09)

Voriger Zielturn: Fortschritt, Originalport/Controller c0ef61744 committed/gepusht;
Worktree jetzt sauber. Vor vollständiger Routenentwurf-Anbindung zuerst den
produktiven Befehlsweg umstellen: ein React-Owner hält HexTravelCommandController,
registriert ihn auch bei offenem Fenster zentral und zeigt Statusprüfung/
expliziten Retry/Discard außerhalb der einzelnen Reisefenster. Hook bleibt an
Originalkampagne und Originalszene gebunden; bei Unmount übernimmt der vorhandene
gehaltene Controller. Keine Legacy-Write-Alternative im produktiven Provider.

Der Hex-Provider erhält den originalgebundenen Executor und liest konsistente
Reise-/Plan-/Sessionzustände; generische Reisebefehle tragen Szenenrevisionen.
useTravelCommands führt keine abbrechbare FIFO-Writequeue mehr und wiederholt bei
stale keine Aktion selbständig. Diese Wiederholung konnte eine inzwischen neue
Reise treffen; allein der gehaltene Owner klärt und wiederholt explizit. Query-
Koordinator und deren Abbruch bleiben unverändert. Read-only Recovery aktualisiert
die Reiseprojektion über eine Providerinvalidierung, nicht durch Einspielen des
alten Belegs. Bei abgeschlossenem Auftrag wird frischer Zustand verwendet.

Eingabesperre: Controller-/UI-Aktionen berücksichtigen laufende/ungeklärte Befehle
und zentrale Wartungssperre. Reiseroute, Modus, Karte, Multiplikator und Token dürfen
während dieser Sperre nicht weiter verändert werden; Handler prüfen synchron,
nicht nur über disabled-Attribute. Abnahme: alle generischen Befehle gehen an den
journalisierten Executor, alter FIFO-/Retrypfad entfällt; echte Hooktests mit
zentraler Klärung bei offenem und geschlossenem Owner, Recoveryfehlern und
Eingabesperre. Bestehende Travel-/Provider-/Controller-/UIregresse aktualisieren
und durch neue Sicherheitsnachweise ergänzen. Type/Lint/Build folgen.

Noch nach diesem Befehls-Cutover offen: persistierten Routenstand in die lokale
Projektion übernehmen, echte Plan-Dirtybasis mit Save/Discard/Cancel registrieren,
vor Aktionen andere offene Editoren zentral klären und Electron-Gesamtabnahme.
Insbesondere Start darf nach Discard nicht die verworfenen Wegpunkte aus einer
alten Closure benutzen; Pause darf nach zwischenzeitlichem Save nicht zu Resume
umgedeutet werden. Dies im anschließenden Routen-/Transitionteilplan ausdrücklich
prüfen. Kein Abschluss von Phase 4 allein durch den Befehls-Cutover.

Cutover-Implementierung: produktiver Provider benötigt jetzt zwingend den
originalgebundenen Executor. Er meldet Recovery als Kontextinvalidierung. Hook
registriert laufende/unklare Aufträge im geöffneten Fenster; SceneDesktop rendert
Status außerhalb der einzelnen Fenster. Direktes FIFO und impliziter Pause-Retry
entfallen. Handler und Buttons prüfen Wartung/Owner-Sperre.

Typecheck 40091 fand erwartete Anpassungen in vier Tests, die den Provider noch
mit einem Argument/alten Payloads konstruieren. Test-Anpassungsplan: Providerfälle
auf zwingenden Belegexecutor und UUID-/Payloadassertionen umstellen; bestehende
Console-/Markerfixtures erhalten explizite Testexecutoren. Alte FIFO-/Stale-Retry-
Assertions ersetzen durch Nachweis eines einzigen delegierten Auftrags, Sperre
weiterer Aktionen und keine selbständige Wiederholung. Gehaltene Recovery wird
zusätzlich am realen Ownerhook geprüft, nicht vom Providerfake behauptet.

Weiterer Reviewfund: remoteVersionIsOlder priorisiert bisher die Reiserevision;
position kann diese zurücksetzen, obwohl die Szenenrevision fortgeschritten ist.
Korrekturplan: zuerst gleiche Szene und Szenenrevision vergleichen, erst bei
gleicher Szenenrevision die Reiserevision. Native Reset-Invariante besteht bereits;
Controllerregression soll frische Positionierung mit kleinerer Reiserevision
akzeptieren und weiterhin alte Szenenstände abweisen.

24 Provider-/Controller-/Console-/Markerregressionen und sechs echte Ownerhook-
Fälle bestanden. Letztere belegen zentrale Klärung im geöffneten Fenster,
Unmount-Recovery ohne fremden Callback, expliziten Retry mit neuer UUID sowie
blockierende Recoveryfehler. Review vor breiter Prüfung: Providerladen darf nicht
von der Identität des UI-Fehlercallbacks abhängen; sonst kann ein Parent-Rerender
unnötig den Provider und lokale Route ersetzen. Fixplan: Fehlercallback über
committed Ref halten, Provider-Lifecycle nur an aktiv/API/Originalexecutor binden.
Danach technische Gates und echte Reise-Electronfälle, nicht nur Hooktests.

Breitere Prüfung 57807: Typecheck bestand, Lint stoppte mit zwei Hook-Abhängigkeits-
warnungen in useTravelController. Architektur/Build starteten deshalb noch nicht.
Fixplan: commandsBlocked und selectMap vor den Closures als konkrete Bindungen
entnehmen; deren tatsächliche Abhängigkeiten verwenden, ohne instabile komplette
options-/queries-Objekte einzuführen. Danach betroffene Rendererdatei und gesamte
Testpartition linten, geplante Regressionen sowie Build/Smoke/Bundle ausführen.

62290 stoppte in der Test-Lintpartition: zwei untypisierte Mockrückgaben im Console-
Fixture. Fixplan: Reisecontext-Rückgaben der betroffenen Mocks ausdrücklich typisieren
und den Multiplikator separat diskriminieren; keine unsafe Casts in die Payloads.

Reviewkorrektur zum frischen Positionsresultat: der Originalport aktualisiert den
Workspace bereits vor der finalen Reiseantwort. Deshalb reicht die globale
Szenenrevision allein nicht als Zeitstempel der alten Providerprojektion. Zusätzlich
merken wir deren bei der Veröffentlichung gültige Szenenrevision. Eine Regression
schiebt das neue globale Session-Snapshot vor die verspätete Positionsantwort;
diese muss trotzdem akzeptiert werden. Ältere globale Szenenstände bleiben gesperrt.

72747: Typecheck und verbleibende Lintprüfung bestanden. 140/142 gezielte Tests
bestanden; zwei Architekturabweichungen: neue sichtbare JSX-Texte sind noch nicht
hinter typisierten Messagekeys, und der Travel-Architekturtest fordert weiterhin
die ausdrücklich ersetzte FIFO-Queue. Fixplan: bestehende Status-/Retry-/Discard-
Keys verwenden, Reiselabel/-konflikte im Workspacekatalog ergänzen. Architekturtest
verlangt stattdessen Providerdelegation, tatsächlichen Owner und dessen zentrale
Maintenance-Anmeldung sowie Originalport in der produktiven Integration; Query-
Koordinatorprüfungen bleiben bestehen. Die entfernte automatische Wiederholung
bleibt durch konkrete Recovery-/Sperrtests ersetzt, nicht durch ein gelockertes Gate.

Abnahme Befehls-Cutover: 55673 exit 0, alle 142 geplanten Architektur-/Owner-/Port-/
Provider-/Controller-/UIregressionen bestanden; Build/Smoke/Bundle bestanden.
Renderergraph 1663183 Bytes innerhalb unveränderter Limits, keine Baselineänderung.
95906 exit 0: echter Reise-Electronfall bestanden (Planen, Positionieren, Start,
Pause, Fortsetzen, Stopp, Fortschritt und stabile Kartenprojektion), Summary
functional-1788925102421-636656. 29834 exit 0: alle zehn SceneDesktop-Electronfälle
bestanden, Summary functional-1788925209423-637107; danach gezieltes Lint der letzten
Message-/Architekturänderungen, beide Typechecks und vollständiges Format bestanden.
Vorherige Lintpartitionen/Korrekturprüfungen decken die übrigen Änderungen ab.
Nach diesen GUI-Läufen keine Runtimeänderung. Keine laufenden lokalen Prozesse.
Installation 42/Kampagne 41/Registry 21 und Frozen-0.2-Fixtures unverändert.

Plan-Audit Befehls-Cutover: alle sechs produktiven Reiseaktionen gehen durch den
zwingenden Originalexecutor zu den journalisierten Capabilities. Kein aktiver
Legacy-Write oder abbrechbarer FIFO-/impliziter Stale-Retry im Travelprovider.
Queryabbruch bleibt auf Reads beschränkt; verlorene/noch laufende Writes leben
beim gehaltenen Owner weiter. Owner ist bereits im geöffneten Desktop zentral
registriert, Fehler/Status/Retry/Discard bleiben außerhalb der einzelnen Fenster
erreichbar. Eingabehandler und UI prüfen Owner-/Wartungssperre. Planen-/Karten-/
Tokenänderungen können während Klärung nicht neue lokale Fakten erzeugen.
Provider-Lifecycle hängt an Originalexecutor/API, nicht Fehlercallbackidentität.
Neue Positionierung wird auch nach vorherigem Workspace-Refresh anhand des
Zeitstempels der Providerprojektion korrekt übernommen; alte globale Szenenstände
bleiben abgewiesen. Gezielte Tests und elf echte Electronfälle bestanden.

Roadmap-Audit: produktiver Befehlsweg dieses Teilplans abgeschlossen. Phase 4
bleibt offen: Routenentwürfe sind weiterhin flüchtige Projektion und müssen als
persistierbarer Editor angemeldet werden; auch die vor einer Aktion notwendige
Klärung anderer Editoren folgt im Routen-/Transitionabschnitt. Nicht behaupten,
dass Updates jetzt schon sämtliche offenen Reiserouten erhalten. Phasen 5–7
unverändert offen. Nächster Teilplan: routePlan aus readState im Provider
weiterreichen, eindeutige Dirty-/Basisrevision pro Szene/Plan und Save/Discard/
Cancel integrieren. Save während der Wartung benötigt einen ausdrücklich auf
Plan-Save begrenzten internen Executorpfad; der normale execute-Guard muss für
Benutzereingaben während der Sperre geschlossen bleiben. Fremde offene Aufträge
zuerst klären; keine alte Start-Closure nach Discard und kein Pause→Resume-Toggle
nach zwischenzeitlichem Speichern. Danach Route-/Mehrfacheditor-Electronabnahme.

Candidate c0ef61744/CI 34306628897 jetzt terminal success. Der aktuelle Cutover
ist davon nicht abgedeckt; neuen SHA sauber committen/pushen und dessen eigene
Remote-Gates abwarten. Kein Handoff/Main-/Releaseabschluss durch diesen lokalen
Qualifikationsbuild. Worktree vor diesem Abschnitt war sauber, Änderungen gehören
vollständig zum dokumentierten Cutover.

### Phase 4 – Routenprojektion und unabhängige Planrevision

Fortsetzung: vorheriger Installationsturn hat den vorhandenen Skill gegen dessen
Repository verifiziert, aber die Roadmap nicht verändert (für das Implementierungsziel
kein Fortschritt). Aktuell sauberer Candidate 6d5ab734d, remote identisch; dessen
Check 34308324446 ist nach Abfrage in_progress. Kein lokaler Testprozess läuft.

Teilplan vor Änderungen: Das bestehende atomare readState-Ergebnis vollständig
bis zum Travel-Descriptor führen. Ein providerneutraler, verpflichtender
Routenplan-Snapshot enthält Szene, eigene Revision und nullable Plan mit Karte,
Wegpunkten und Multiplikator. Hex reicht ihn sowohl bei Reads als auch nach
Befehlen unverändert weiter; kein zweiter Planread und kein Ersatz durch einen
leeren Plan. Die Projektion vergleicht Planrevision unabhängig von Reise-/
Szenenrevision: kein Rückschritt, auch nicht bei einer neuen Szene-Revision mit
zurückgesetzter Reiserevision. Bei gleichen Reise-/Szenenständen gilt eine höhere
Planrevision als neuer Zustand. Fremde Plan-Szenen werden abgewiesen.

Prüfung: konkrete Porttests für gespeicherten Plan, tombstone und falsche Szene;
Controllerregressionen für Planfortschritt nach lokaler Auswahl, veraltete Pläne,
Positionsreset und spätes Wiederauftauchen gelöschter Pläne. Bestehende Reise-,
Owner-, Architekturtests, Typen, Lint, Format, Build/Smoke/Bundle. Dieser Abschnitt
ist die notwendige Datenbasis des Routeneditors, kein abgeschlossener Editor:
Dirty-/Save-/Discard-Owner, Wiederaufnahme im Planmodus und zentrale Übergänge
folgen mit eigenem konkretem Plan. Kein neuer Savepfad ohne dessen Recoveryowner.

Erste Validierung: 32896 beendet; 20/20 gezielte Port-/Controllerfälle bestanden.
Typecheck meldet eine bisher untypisierte Portfixture: deren `as const` erzeugt
readonly path, während der atomare IPC-Vertrag ein deserialisiertes Array enthält.
Fixplan vor Korrektur: Fixture direkt als context.travel-Vertrag deklarieren,
keinen Cast des Ergebnisses und keine Lockerung des produktiven Vertrags.

40494: beide Typechecks bestanden, Lint stoppt an einem leeren async-Testcallback
zum Abschließen der React-Microtasks. Fixplan: dessen Promise ausdrücklich
zurückgeben; kein eslint-disable. Erweiterte Tests/Build wurden durch && noch
nicht gestartet, alte Logausgaben sind keine neue Abnahme.

76436 exit 0: gezieltes Lint und 130 Tests/13 Dateien inklusive Architektur,
Travelcontroller, Provider, Owner und Reiseoberfläche bestanden. Build, Smoke und
Bundle bestanden; Renderergraph 1663543 Bytes, unveränderte Baseline/Limits.
16793 exit 0: echter Reise-Electronfall bestanden (Planen/Positionieren/Start/
Pause/Fortsetzen/Stopp), Summary functional-1788926032774-642329; vollständiges
Format danach bestanden. Keine Runtimeänderungen seit diesem Build.

Zusätzlicher CI-Fixplan: Job 102329557164 des Vorgänger-SHA 6d5ab734d ist terminal
failure; Gesamtcheck 34308324446 hatte bei Abfrage noch laufende andere Jobs.
Log belegt 1482 erfolgreiche Unitfälle und genau einen veralteten FR0-Baselinefall:
frontend-robustness-baseline fordert use-travel-commands weiterhin als FIFO-
Referenz. Diese Erwartung widerspricht dem protokollierten Befehls-Cutover.
Travel aus dieser FIFO-Liste in eine ausdrücklich geprüfte journalisierte
Referenz überführen: Controllerkonstruktion, Owneranmeldung, Statusabfrage und
Erhalt abgehängter Aufträge müssen bestehen. Andere FIFO-Referenzen unverändert.
Architektur-/Boundarytests und gezielte Recoverytests bleiben bestehen. Nach
Korrektur Baseline/Boundary/Recovery gezielt prüfen; keine neue Runtime und somit
kein Wiederholen desselben Electron-Builds nötig.

97508 exit 0: Lint des CI-Fixes und 38 Baseline-/Boundary-/Travel-Recoveryfälle
bestanden. Bestehender negativer Queue-Test und produktive Journalreferenz jetzt
konsistent; kein CI-Gate abgeschaltet. git diff --check bestanden.

Plan-Audit Routenprojektion: verpflichtender providerneutraler Snapshot sowie
Hex-State enthalten die vollständige gespeicherte Route, einschließlich einer
leeren Route mit fortgeschrittener Tombstone-Revision. Reads und Writeantworten
geben dasselbe atomare Ergebnis weiter; keine zweite Planabfrage. Fremde Szene
wird abgewiesen. Reise-, Plan- und Szenenrevision werden mit ihren unterschiedlichen
Fortschrittsregeln berücksichtigt; Tests belegen Plan-only-Fortschritt nach lokaler
Kartenwahl, Rückschrittsverbot bei Reise-/Szenenfortschritt, Positionsreset bei
gleichem Planstand und Schutz vor spätem Wiederauftauchen eines gelöschten Plans.
130 erweiterte Tests, Typecheck/Lint, Build/Smoke/Bundle und echter Reise-Electron-
Ablauf bestanden. Nach GUI-Prüfung ausschließlich Baseline-Test und Protokoll
geändert; dessen 38 gezielte Tests/Lint ebenfalls bestanden.

Roadmap-Audit: Datenbasis für den Routeneditor vollständig durchgereicht, dessen
Bedienabnahme weiterhin offen. Kein automatisches Laden in lokale Wegpunkte,
keine Dirty-/Save-/Discard-Anmeldung oder Plan-Save während der Wartung in diesem
Abschnitt behauptet. Phase 4 bleibt in Arbeit; Phasen 5–7 unverändert offen.
Nächster Implementierungsschritt bleibt der tatsächliche persistierbare Routen-
Editor mit Basisrevision, Originalkampagne/-szene, gezieltem Plan-Save, vorgeschalteter
Auftragsklärung und eindeutigem Umgang mit unbekanntem Speicherergebnis. Danach
zentrale Übergänge, welche nach Verwerfen keine alten Startdaten und nach einem
Save keinen umgedeuteten Pause/Resume-Intent verwenden. Main-/Handoff-/öffentliche
Releasegates weiterhin ausstehend; lokalen Qualifikationsbuild nicht installieren.

### Phase 4 – Persistierbarer Routeneditor

Fortschrittsklassifikation: vorheriger Turn ist Fortschritt (b6b4418de, neue
Routenprojektion und Regressionen). Worktree sauber, Candidate bestätigt.
Check b6b4418de/34309077288 läuft; Vorgängercheck terminal cancelled nach Push.

Plan vor Implementierung: Ein HexRoutePlanDraft hält je Originalport den lokalen
Plan, die geladene Planbasis und einen ggf. angeforderten Save. Er verwendet den
bereits produktiven HexTravelCommandController für save-plan, Statusklärung und
explizite Wiederholung. Dessen zuletzt bestätigter Auftrag samt aktuellem Readback
bleibt lesbar, damit der Editor auch nach verlorener Antwort oder abgehängter View
einen erfüllten Save erkennt. Keine zweite Write-/Recoveryimplementierung.

Save klärt zuerst gehaltene Aufträge, liest den Originalcontext frisch, prüft die
Planbasis und schreibt ausschließlich save-plan mit aktueller Szenenrevision.
Neue lokale Eingaben und normale Reiseaktionen sind währenddessen gesperrt.
Ein neuerer fremder Plan wird bei schmutzigem Entwurf nicht überschrieben.
Discard klärt offene Writes und übernimmt den aktuellen gespeicherten Plan;
später gespeicherte Arbeit wird niemals auf die alte Basis zurückgesetzt.
Detached dirty drafts bleiben zentral auflösbar. Der Hook registriert den Editor
mit Abhängigkeit vom bestehenden Befehlsowner und hält beide außerhalb der
Kartenfenster. Der generische Reisecontroller bekommt dessen schmale Schnittstelle;
Wegpunkte aus einem gespeicherten Plan werden auf der zugehörigen Karte geladen,
Planmoduswechsel/Start dürfen den Editor nicht implizit löschen. Explizites Clear
ist ein löschbarer Entwurf (tombstone erst nach Save).

Validierung: Save ohne Reisestart, Clear/Discard, Mehrfachsave, neuere Basis,
verlorene Antwort mit und ohne Receipt, spätere Arbeit, Wechsel der Originalszene,
Readbackfehler und detached Klärung; zentrale Save/Discard- und Eingabesperrentests.
Danach tatsächliche Integration und Reise-UI prüfen. Vor endgültigem Phase-4-
Abschluss bleiben zentrale Voraktionsdialoge und Mehrfacheditor-Electronabnahme
verbindlich; dieser Plan ersetzt sie nicht. Kein Schemawechsel vorgesehen.

Reviewpräzisierung vor Tests: Completion kann den Editor synchron quittieren,
bevor dessen await zurückkehrt; Save muss auch diesen bereits sauberen Zustand
als Erfolg anerkennen. Außerdem müssen absichtlich abgehängte Entwürfe bei einer
späteren zentralen Saveentscheidung speicherbar bleiben. Dafür erhält der bestehende
Commandcontroller einen eng auf save-plan typisierten Einstieg; normale execute-
Aufträge bleiben für detached Views gesperrt. Beide Fälle werden konkret getestet.

49370: bestehende Controller-/Reiseoberflächentests bestehen; zwei Testprobleme:
Der neue Modelltest benötigt wegen des realen Renderer-Message-Runtimes jsdom.
Außerdem meldet der bislang saubere Routenowner einen zweiten Abhängigkeitsfehler,
wenn ausschließlich ein Reiseauftrag unklar ist. Fixplan: Abhängigkeit vom
Befehlsowner nur für tatsächlich offene Routenentwürfe deklarieren; bei Dirty/
Pending/Save bleibt sie verpflichtend. Bisheriger Typcheck (3381) bestanden.

50799: alle zehn neuen Modellfälle, sechs Ownerfälle und der neue echte Console-
Save-/Reloadfall bestanden. Zwei zentrale Dialogfälle scheitern am fehlenden
ModalLayerProvider des bisherigen (dialoglosen) Consoleharness. Fixplan: denselben
Modal-Provider wie die App verwenden und den Completioncallback des Harness auf
context.session projizieren; keine Mockdialoge. Danach alle gezielten Fälle und
statische Prüfungen erneut ausführen.

75160 stoppte im Typecheck: der geplante Harness-Callbackersatz traf die inzwischen
von Prettier einzeilig formatierte Stelle nicht. Fix: genau diesen Aufruf auf
current.context.session umstellen; Lint und erweiterte Tests waren noch nicht
gestartet.

76699: beide Typechecks bestanden; Lint verlangt gebundene Callbacktypen für
subscribe/snapshot, einen vollständigen Hook-Dependencybezug sowie await im
Dialog-Testcallback. Fixplan: Schnittstelle mit readonly Funktionsproperties,
onError lokal destrukturieren, React-Test-Microtasks ausdrücklich abwarten.
Fachliche Präzisierung: gespeicherte Wegpunkte erscheinen nur im Planmodus,
damit nach abgeschlossener Reise kein alter Plan als aktive Reiseroute erscheint.
Der Plan bleibt trotzdem gespeichert/dirty und beim erneuten Planen verfügbar.
Der reale Reise-Electronfall ergänzt Save ohne Start, Renderer-Neustart und
Weiterreise aus dem gespeicherten Plan. Die neue sichtbare Saveaktion erfordert
später gezielte, visuell geprüfte Aktualisierung der drei Reise-Goldens.

81001: Typprüfung/Lint bestanden, 148/150 Tests bestanden. Beide Dialogfälle
scheitern jetzt an der korrekten aria-hidden-Abschirmung des Hintergrunds durch
den echten ModalLayer: die Hintergrund-Saveaktion wird mit getByRole nicht mehr
gefunden. Fixplan: den Button vor Öffnen des Dialogs erfassen und an dieser
Referenz seine disabled-Sperre prüfen; Modal-Abschirmung unverändert lassen.

1588: alle sieben Consolefälle bestanden, danach Build und Smoke bestanden.
Bundleprüfung verlangt eine begründete Baselineprüfung: reachable jetzt 1669010
Bytes, +17768 gegenüber 1651242. Gegenüber dem qualifizierten b6b4418de sind es
5467 Bytes; der Rest sind bereits qualifizierte Scene-/Reiseowner seit der letzten
Combat-Baseline. Keine neue Bibliothek, keine Lockfileänderung, nur bestehende
React-/Wartungs-/Capabilitybausteine; Route- und Befehlsowner bleiben beim lazy
SceneDesktop. Workspacegraph wächst insgesamt um 732 Bytes, Shell unverändert.
Fixplan: vorhandenen Mess-/Baselinehelper mit diesem Dependency-/Chunkgrund
verwenden. Absolute Limits und 16-KiB-Prüfschwelle unverändert. Anschließend
Budget erneut prüfen und denselben bereits gebauten Stand in Electron abnehmen.
Candidate b6b4418de/34309077288 jetzt terminal success; gilt nicht für aktuelle
uncommittete Editoränderungen.

24822: Budget bestanden; Electronlauf terminal product-assertion nach erfolgreich
geprüftem Plan-Save, Renderer-Neustart und erster Start/Pause/Resume/Stop-Sequenz.
Der zweite Reiseabschnitt erwartet nach einem Klick 5x, weil er früher das Tempo
2x der letzten Reise als neue Planbasis verwendete. Der wieder geladene gespeicherte
Plan hat korrekt weiterhin 1x; tatsächliches Ergebnis nach Klick ist 2x. Fixplan:
vor zweiter Reise den erhaltenen Plan und sein 1x-Tempo ausdrücklich prüfen,
keinen zusätzlichen Wegpunkt in den bereits geladenen Plan einfügen, dann 2/5/10x
explizit wählen und den geänderten Plan speichern. Aufnahmen zeigen erreichbare
Aktionen ohne Überdeckung. Keine Runtimekorrektur für diese fachlich überholte
Testerwartung; denselben Build weiterverwenden.

32224: gezieltes Update aller drei Reisegoldens erfolgreich (identischer Build),
alle drei Bilder visuell geprüft: lesbare Aktionen, keine Überdeckung, nach
Reiseende keine aktive Planlinie. SceneDesktop danach terminal failure: erster
Fehler ist der nun korrekt erscheinende Save/Discard/Cancel-Dialog beim Schließen
des Fensters mit noch ungespeichertem Plan. Drei Folgefälle laufen in denselben
offenen Dialog; keine zweite Ursache belegt. Fixplan: dieser konkrete Reise-
Fensterfall wählt Speichern und fortfahren, wartet auf tatsächliche Schließung
und prüft den gespeicherten Plan über die Capability. Danach die bestehende
Weiterreise-/Pause-/Prozessneustartabnahme beibehalten. Keine Dialogumgehung und
kein pauschaler automatisch bestätigender Testhook. Anschließend gesamte gekoppelte
SceneDesktop-Suite und Visualvergleich der gezielt aktualisierten Bilder.

Abnahme Routenentwurf: 64962 exit 0, vollständiger funktionaler Reisefall inklusive
Save ohne Reisestart, Renderer-Neustart, geladener Route und erneutem Plan-Save
bestanden; Summary functional-1788927563531-647448. 24338 exit 0: alle zehn
SceneDesktopfälle bestanden (functional-1788928007938-650024), darunter zentrale
Plan-Saveentscheidung beim Schließen des Fensters, Weiterreise bei geschlossenem
Fenster und pausierte Reise nach Prozessneustart. Anschließender Visualvergleich
aller drei gezielt erneuerten Reisebilder bestanden (visual-1788928170690-651827).
Danach beide Typechecks und vollständiges Format bestanden. Gezieltes Lint der
Runtime-/Unitänderungen und der beiden abschließend angepassten Electrondateien
bestanden. 150 gezielte Architektur-/Controller-/Owner-/UI-Fälle abgedeckt:
81001 hatte 148 erfolgreiche Fälle; die zwei korrigierten Dialogfälle wurden mit
allen sieben Consolefällen in 1588 erfolgreich wiederholt. Seitdem keine Runtime-
oder Unitänderung. Build/Smoke und nach begründetem Messupdate Bundle bestanden.
Keine laufenden lokalen Prüfprozesse; keine Schema-/Frozen-Fixtureänderung.

Plan-Audit Routeneditor: tatsächliche produktive Integration im Originalcampaign-
Owner; eigenständiger Plan mit Basisrevision statt flüchtiger, beim Start gelöschter
Wegpunkte. save-plan verwendet denselben gehaltenen Commandcontroller, inklusive
lesbarer Bestätigung für synchrone Quittierung und spätere Recovery. Detached
Entwürfe bleiben explizit speicher-/verwerfbar; normale detached execute-Aktionen
bleiben gesperrt. Save klärt Writes und prüft frischen Originalcontext plus
unveränderte Planbasis. Discard lädt den aktuellen gespeicherten Stand, statt alte
Daten zurückzuschreiben. Neuere Änderungen nach einem zunächst unbekannten Save
bleiben erhalten. UI und Handler sperren neue lokale Eingaben während Save und
zentraler Klärung. Die Abhängigkeit vom Commandowner gilt bei offenen Entwürfen,
verursacht aber keinen zusätzlichen Fehler für einen sauberen Routeneditor.
Planen zeigt den auf dieser Karte gespeicherten Entwurf; außerhalb des Planmodus
wird er nicht als aktive/abgeschlossene Reiselinie ausgegeben. Kartenwechsel bei
offenem Entwurf geht bereits über die zentrale Klärung. Savebutton und zentraler
Save/Discard/Cancel-Dialog, Clear-Tombstone, Restart und Fensterclosure sind geprüft.

Roadmap-Audit: dieser persistierbare Routenabschnitt ist implementiert und lokal
automatisiert geprüft, Phase 4 bleibt offen. Noch erforderlich sind zentrale
Voraktionsübergänge für Start/Position/Pause/Resume/Abort und passende Tempoaktionen,
mit Klärung anderer Editoren und frischen Revisionen: nach Discard keine alte
Start-Closure benutzen, nach anderen Saves ein beabsichtigtes Pause nicht in
Resume umdeuten. Danach gemeinsame Routen-/Mehrfacheditorabnahme mit Teilerfolg,
Fehler und finalem Owner-Inventaraudit (inklusive verbliebener Übergangsguards).
Ein Tempo ohne Wegpunkt ist weiterhin eine temporäre Eingabe für den nächsten
Plan; erst eine tatsächliche Route enthält einen speicherbaren Multiplikator.
Phasen 5–7 vollständig offen. Kein Handoff, keine Mainpromotion und kein öffentlicher
Release durch diese lokalen Builds. Als nächstes den geprüften Kandidaten committen/
pushen und seine eigenen Remote-Gates verfolgen; b6b4418de bleibt nur Nachweis
seines vorigen Stands.

### Phase 4 – Editorauflösung vor Reiseaktionen

Vorheriger Turn: Fortschritt durch 1d55407b0 (produktiver persistierbarer
Routeneditor und elf Electronfälle). Worktree sauber. Check 34311390117 läuft,
bei Abfrage kein fehlgeschlagener Job; kein lokaler Prüfprozess aktiv.

Plan vor Änderungen: Start, Position, Pause, Resume, Abort und persistierte
Tempoänderungen gehen vor Ausführung durch den vorhandenen useDraftTransition.
Die Aktion wird beim Nutzerklick festgelegt. Bei offenen Editoren folgen Save/
Discard/Cancel und danach unter einer kurz gehaltenen zentralen Eingabesperre
ein frischer Originalcontext und fachliche Vorbereitung. Kein zusätzlicher
Writeowner und keine FIFO-/automatische Stale-Wiederholung. Ohne offene Editoren
bleibt der bereits qualifizierte unmittelbare Befehlsweg bestehen.

Nach einer Klärung: Start liest den aufgelösten Routenentwurf samt Basisrevision,
prüft ihn gegen den aktuellen gespeicherten Plan und bewertet die Route erneut.
Ein leerer verworfener Plan startet nichts; ein Plan auf einer anderen Karte
wird nicht still gestartet. Pause bleibt Pause (bereits pausiert => kein Write),
Resume bleibt Resume, Abort bleibt Abort. Relative Tempoänderungen beziehen sich
auf den frischen Zustand; ein einmal übermittelter Auftrag bleibt danach unverändert
bei seinem vorhandenen Recoveryowner. Position prüft die gewünschte Karte/Position
frisch. Szene/Provider dürfen während der Klärung nicht wechseln. Der frische
Context wird auch bei einer inzwischen unnötigen Aktion veröffentlicht.

Die Wartungssperre bleibt während vorbereitender Reads/Evaluation bestehen und
wird unmittelbar vor Übergabe an den normalen gesperrten Writeowner freigegeben.
Unbekannte Writes bleiben bei diesem Owner. Noch offene oder fehlgeschlagene
Editoren verhindern die Aktion, bereits erfolgreiche Saves bleiben erhalten.
Der Transitionhook stellt seinen bereits bestehenden Pendingzustand als stabilen
Leser bereit, damit auch die kurze Background-Write-Klärung weitere Reiseeingaben
abweist, bevor der Dialog seine globale Sperre hält.

Prüfung: konkrete vorbereitete Befehle nach Save/Discard, frische Scene-/Travel-
Revisionen, kein Pause->Resume, leeres/verändertes/fremdes Routenresultat, relative
Temposchritte, Scopewechsel und gesperrte Eingaben während verzögerter Vorbereitung.
Tatsächliche Oberfläche mit mehreren Editorbesitzern, Teilerfolg und Savefehler,
Abbrechen/Verwerfen und anschließender Reiseaktion. Passende Electronfälle und
unveränderte Bildreferenzen prüfen; Phase 4 erst nach abschließendem Ownerinventar
und vollständiger gemeinsamer Abnahme schließen. Phasen 5–7 bleiben unverändert.

Erste Validierung: 40317 Typecheck bestanden; 49236 alle 47 gezielten Vorbereitungs-,
bestehenden Async-, Routen- und Consolefälle bestanden. Review-Fixplan vor Erweiterung:
Vorbereitungsreads müssen denselben vorhandenen Query-Abbruch beim Unmount/Scope-
Wechsel verwenden. useTravelQueries bekommt eine reine latest-only Vorbereitung;
Writes bleiben ausschließlich nach deren erfolgreicher Rückkehr beim Commandowner.
Zusätzlich deaktiviert die bestehende Remote-Reconciliation beim Cleanup ihre
Viewprojektion, damit auch vor Beginn eines Reads bereits abgehängte Captures
keine Veröffentlichungs-/Schreibautorität behalten. Kein zweiter Requestzähler.
Ein verspätet eintreffender Read nach Unmount wird ausdrücklich getestet.

Fortsetzung: Der letzte Installationsturn bestätigte die unveränderten aktuellen
Skill-Dateien; für die Roadmap entstand dadurch kein Implementierungsfortschritt.
Worktree und SHA 1d55407b0 erneut geprüft. Die 53 lokalen gezielten Fälle sind
bestanden. Remote-Check 34311390117 ist inzwischen fehlgeschlagen: SceneDesktop
erwartete nach Editorauflösung Vorhut, las Wald; im Fehlerbild ist Vorhut bereits
sichtbar. Ein späterer Standortfall zeigt einen Workspace-Stalehinweis. Ursache
noch nicht belegt; keine Testabschächung oder pauschale Wiederholung als Heilung.
Prüfplan: den bereits geplanten Reise-Startdialog im Electronfall bestätigen
(dadurch beim späteren Fensterschließen kein verbleibender Routendraft), aktuelle
Typ-/Architekturprüfung und Build, dann SceneDesktop mit diesem Stand ausführen.
Die beiden CI-Symptome anhand dieser Ergebnisse und betroffener Owner untersuchen.

Validierung: Typecheck 68077, Lint 99919, Build 91578 und Bundlebudget bestanden
(+3393 Bytes erreichbar, unveränderte Grenzen). Architektur und gemeinsame
Dialog-/Szenenowner: 123 Tests in elf Dateien bestanden (65428).
Electron 15446 beendet mit sechs bestandenen/vier fehlgeschlagenen Fällen.
Primärfehler: Test erwartete Fensterschließdialog; tatsächlich öffnet sich der
generische Arbeitsbereichwechsel-Dialog vor Reisebeginn. Drei Folgefälle scheitern
am verbliebenen Modal. Standortfall bestanden, dessen CI-Ursache bleibt offen.
Fixplan vor Änderungen: den Reiseübergang passend als Reiseaktion mit offenen
Änderungen beschriften und im Electronfall genau diesen Dialog bestätigen.
Zusätzlich CI-Szenenauswahltest korrigieren: expect-webdriverio 5.7.0 toHaveText
behält das einmal gefundene Element; executeCommand fragt den Selektor nicht neu
ab. option:checked wird so nach Auswahlwechsel weiterhin als alte Wald-Option
gelesen. Stattdessen Vorhut-Option über ihren stabilen Wert auf ausgewählt prüfen
und dieselbe Szenen-ID am Desktop nachweisen. Kein längeres Timeout, kein Write-
Retry, keine Unterdrückung des getrennten Workspacefehlers. Danach die gesamte
betroffene Electron-Suite erneut mit frisch gebautem Runtime-Stand prüfen.

Abnahme des korrigierten lokalen Stands: Build 40684, Typecheck 46697 und
gezieltes ESLint 49796 bestanden. SceneDesktop 4360: alle zehn Fälle bestanden,
einschließlich Reise-Startdialog, geschlossenem Reisefenster, Roster-Save/Discard
vor Szenenwechsel und XP-Discard vor Standortwechsel. Nachweis:
`.tmp/e2e-runs/functional-1788930183829-658332/summary.json`.
30748 vollständig beendet, Exit 0: Smoke, unverändertes Bundlebudget, eigener
Reisefunktionstest (ein Fall) und Reise-Bildprüfung gegen unveränderte Goldens.
Funktion: `.tmp/e2e-runs/functional-1788930369308-660688/summary.json`;
Visual: `.tmp/e2e-runs/visual-1788930458482-661130/summary.json`.
Insgesamt elf unterschiedliche Electron-Funktionsfälle, zusätzlich Bildprüfung.
Kein lokaler Prüfprozess mehr aktiv. Alle Builds sind ausdrücklich dirty Development
und kein Nachweis eines Kandidaten-Handoffs oder Release-Artefakts.

Plan-Audit: Reise-Voraktionsübergänge sind implementiert und gezielt abgenommen.
Die bereits bestandenen 53 Unit-/UI-Fälle decken frische Befehlsrevisionen,
Erhalt der Pause-Absicht, leeren verworfenen Plan, Teilerfolg und fehlgeschlagenen
Routen-Save sowie Unmount während gesperrter Vorbereitung ab. 123 zusätzliche
Architektur-/gemeinsame Dialog-/Szenenfälle bestehen. Der konkrete Electronweg
bestätigt nun den Routen-Save vor dem Start; der bestehende Reise- und Bildweg
bleibt grün. Der CI-Szenenauswahlfehler ist durch Matcher-Code und Screenshot
erklärt und korrigiert. Der getrennte Stalehinweis aus CI 34311390117 ist lokal
nicht reproduziert und ausdrücklich noch nicht als behoben nachgewiesen.

Roadmap-Audit: Phase 4 bleibt offen. Erforderlich bleiben Ursachenklärung oder
stärkerer Regressionstest für den CI-Stalehinweis, finales Editor-/Ownerinventar
und gemeinsame vollständige Abnahme. `useMaintenanceDraftGuard` ist nur noch
definiert; keine Aufrufer in src/tests gefunden. Vor Entfernung einen eigenen
engen Korrekturplan festhalten. Dann sauberer Kandidat und dessen eigene
Remote-Gates; derzeit kein neuer Commit, Push, Handoff oder Mainpromotion.
Phasen 5–7 und die unveränderte öffentliche Artefaktabnahme bleiben vollständig
Teil des Ziels.

### Phase 4 – Abschließendes Editorinventar und CI-Fehlergrenze

Vorheriger Turn: Fortschritt durch konkrete Reiseübergänge, korrigierten
Szenen-Auswahltest und elf erfolgreiche Electronfälle samt Bildvergleich.
Aktueller Worktree entspricht diesem protokollierten uncommitteten Stand.
Plan vor Änderungen: den ausschließlich noch definierten Übergangs-Guard
useMaintenanceDraftGuard entfernen, einschließlich seines allein benötigten
useEffect-Imports. Die tatsächliche gemeinsame Owner-Schnittstelle bleibt
erhalten; fehlende Laufzeitfunktionen werden weiterhin sicher abgewiesen.
Keine fachliche Save-/Discard-Implementierung wird durch einen bloßen Guard
ersetzt. Aufruferprüfung in src/tests/scripts ist negativ.
Zusätzlich den CI-Standortfall zeitlich eingrenzen: fehlerfreien Workspace direkt
nach dem erneuten Start und nach Abbrechen prüfen, bevor der Standort-Discard
überhaupt ausgelöst wird. Damit lässt ein erneuter CI-Ausfall erkennen, ob der
Fehler vom Start, vom Abbrechen oder von der bestätigten Aktion stammt. Keine
Fehlermeldung schließen, kein Timeout erhöhen, kein Write wiederholen.
Validierung: gemeinsame Dialog-/Koordinatortests und Architektur, Typprüfung;
der stärkere Electronfall bleibt Teil der nächsten vollständigen Suite.

139 Architektur-/Übergangs-/Reisefälle bestanden (97181). Die gemeinsame
Editorabnahme umfasst 296 bestandene Fälle in 26 Dateien (3632), darunter
Katalog, Weltplanung, Gruppen, Kampf, XP/Rast/Besetzung, Beute, Sitzungsplanung,
Kampagnen und Updates. Typprüfung 10825 bestanden. Der Formatter verlangte nur
das Zusammenziehen des Imports nach Guardentfernung; korrigiert. Volles Lint und
Repositoryformat 60225 bestanden. Registrierungsinventar samt Testzuordnung:
`docs/project/architecture/release-editor-inventory.md`.

Neue konkrete Evidenz für den CI-Stalehinweis: isolierte Reproduktion unter
`../../work/reproduce-session-read-supersession.ts` mit der echten
CampaignWorkspaceProjection. Drei überlappende reine Sitzungsabfragen: die erste
wird durch die zweite überholt, hängt sich per ensure an diese, dann überholt
eine dritte die zweite. Beim Abschluss der zweiten liefert die erste `stale`,
während die dritte noch läuft; anschließend liefern zweite/dritte `ready`.
useHexTravelCommandPort übersetzt dieses Schedulingresultat in CapabilityError
stale und damit unter Umständen in den Workspacehinweis. Der historische
CI-Stack ist damit nicht rekonstruiert, der gleiche Fehlerpfad ist jedoch
reproduzierbar. Keine Quelländerung während der laufenden Electronabnahme.

Fokussierter Fixplan: settleRead in der CampaignWorkspaceProjection folgt den
bereits vorhandenen aktuellen Reads auch nach wiederholtem Superseding. Bei
abgebrochenem Owner sofort beenden; echte Lesefehler unverändert zurückgeben.
Bei verworfener älterer Revision den vorhandenen aktuellen Cache verwenden.
Keine erneute Schreibausführung, kein neuer Requestowner und keine pauschale
Stale-Unterdrückung. Regression mit drei kontrollierten Abfragen; zusätzlich
Abbruch und tatsächlicher Fehler der letzten Abfrage, damit Warten nicht zur
Endlosschleife oder Fehlerverdeckung wird. Vor Implementierung scheiternden Test
belegen, danach relevante Projektions-/Port-/Architekturtests und Typprüfung,
anschließend erneut gebaute Electronabnahme.

Regression 51462 belegt: zwei neue Fälle scheitern (Erfolg/echter Fehler),
15 bestehen. Erste Korrektur 90527 bleibt rot: AsyncCommandCoordinator markiert
auch ein durch Superseding abgebrochenes Signal als reason=aborted. Diese
allgemeine bestehende Semantik wird hier nicht geändert. Präzisierter Fixplan:
settleRead als private Methode des Workspaceowners führen und dessen tatsächlichen
Disposedzustand als Abbruchgrenze verwenden. Dadurch folgen alle vier bestehenden
Read-Aufrufer gültigen Ersetzungen; der abgebaute Owner beendet das Warten.
Der neue Test verwendet außerdem den vorhandenen Fehlercode internal.

Korrigierte Leseabstimmung: 11010, alle 50 Projektions-/Originalporttests
bestanden. Die mehrfach überholte Abfrage liefert jetzt das aktuelle Ergebnis
beziehungsweise den tatsächlichen Lesefehler; Dispose endet ohne Wiederholung.
29263: neuer Build, Smoke, Bundlebudget und beide Electron-Suites vollständig
bestanden (zehn SceneDesktop- und ein Reisefall). Die drei neuen Fehlergrenzen
im Standortfall bleiben sauber. Das Budget wächst gegenüber der unveränderten
Baseline um 3632 Bytes. Typprüfung 28134 fand nur einen fehlenden generischen
API-Typ beim neuen vi.fn-Katalogmock; nach terminaler Electronabnahme wird dieser
Mock typisiert und die Typprüfung samt relevantem ESLint/Test erneut ausgeführt.

Abschließende lokale Prüfung: 27074 Exit 0 (Typprüfung, betroffenes ESLint und
alle 17 Workspace-Projektionsfälle), 47740 volles Repositoryformat bestanden.
E2E-Nachweis des aktuellen Runtime-Stands:
`.tmp/e2e-runs/functional-1788931159301-666594/summary.json` (elf Fälle).

Plan-Audit: Guard entfernt, alle gefundenen produktiven Registrierungen mit
Save-/Discard und Testzuordnung inventarisiert, 296 gemeinsame Editorfälle
bestanden. Standort-E2E prüft zusätzlich vor Aktion und nach Abbrechen auf
Workspacefehler. Wiederholtes Superseding ist als konkreter Fehlerpfad mit
rotem Ausgangstest und grüner Korrektur belegt; echter Lesefehler und Ownerabbau
sind separat enthalten. Keine Schreibwiederholung oder Fehlerunterdrückung.

Roadmap-Audit: dieser Phase-4-Abschnitt ist implementiert und lokal automatisiert
geprüft. Vollständige Remote-Abnahme des neuen Kandidaten steht aus. Die alte
CI-Fehleraufnahme enthält keinen Aufrufstack; deshalb wird nicht behauptet,
dass der historische Ablauf zweifelsfrei rekonstruiert wurde. Der reproduzierte
passende Fehlerpfad ist behoben und die strengere betroffene Suite besteht.
Phase 4 bleibt bis zur abschließenden Kandidatenabnahme offen. Phasen 5–7,
Handoff, Main-Gates und veröffentlichte unveränderte Artefakte bleiben Pflicht.
Nächster Schritt: geprüften Stand sauber committen und auf den bestehenden
Kandidatenbranch pushen, ausschließlich dessen neuen exakten SHA prüfen.

### Phase 4 – Sichtbare betroffene Bereiche vor der Entscheidung

Vorheriger Turn: Fortschritt durch d8998d9e8, sauber gepusht. CI 34314803230
ist bei erneuter Abfrage aktiv; noch keine Fehler, vollständige Abnahme offen.
Abschlussaudit gegen den detaillierten Zielzustand findet eine weitere Lücke:
„Der Wartungsdialog zeigt die betroffenen Bereiche“ ist vor der Entscheidung
nicht erfüllt. DraftResolutionDialog zeigt Namen bislang nur bei Speicherfehlern.

Fixplan vor Änderungen: vorhandene dirtyLabels des gemeinsamen Koordinators an
beiden Dialogaufrufern (ReleaseSettings und useDraftTransition) als Pflichtprop
übergeben; im Dialog eine lesbare Liste offener Bereiche anzeigen. Bei Teilerfolg
zeigt die nächste Darstellung nur weiterhin offene Bereiche. Keine Registrierung,
Save-/Discard-Logik oder Wartungsfreigabe ändern. Bei fehlenden Entwürfen keine
leere Liste. Prüfungen an der echten gemeinsamen Transition vor Save, nach
Teilerfolg und am bestätigungspflichtigen Installationsdialog mit offenem Editor;
anschließend Typen/Lint und betroffene Electronabnahme.

CI 34314803230 meldet einen Fehler in Portable: 1526 von 1527 Unit-Fällen
bestanden; renderer-async-boundary erkennt in use-travel-command-transition.ts:60
einen veränderlichen Promise.resolve-Platzhalter als parallele Warteschlange.
Der Code hängt keine Aufträge an, benötigt den Platzhalter aber zur synchronen
Rückgabe des aus requestTransition gestarteten Promises. Der Architekturtest
und seine Regeln bleiben unverändert.

Fixplan: useDraftTransition.request gibt generisch das Ergebnis zurück, wenn die
Aktion sofort ausgeführt wird; bei Dialog/ausstehender Klärung bleibt die Rückgabe
undefined. Der Reiseübergang reicht dieses Ergebnis direkt zurück und entfernt
den veränderlichen Promise-Platzhalter. Seine bestehenden asynchronen Besitzer
bleiben unverändert; keine Queue und keine neue Schreibwiederholung. Bestehende
Dialog-/Reise-Asyncfälle prüfen weiterhin den sofort abwartbaren Befehlsweg und
die spätere Ausführung nach Bestätigung. Zusätzlich genau den fehlgeschlagenen
Architekturtest ausführen. Änderungen erst nach terminalem Electronlauf 53360.

Validierung: Bereichsübersicht 55821, 27 Tests bestanden. Der erste gebaute Stand
besteht zehn SceneDesktop-Fälle inklusive sichtbarem Routenentwurf vor Bestätigung
(53360). Nach Entfernung des Promise-Platzhalters: 40921, 47 Fälle in fünf Dateien
bestanden, ausdrücklich einschließlich unverändertem renderer-async-boundary.
82084: Typecheck und betroffenes ESLint bestanden. 69329: Build, Smoke,
unverändertes Bundlebudget (+3837 Bytes gegenüber Baseline) und die zehn
SceneDesktop-Fälle erneut vollständig bestanden. Keine aktive lokale Prüfung.

Plan-Audit: beide Dialogaufrufer liefern die vor der Entscheidung offenen
Bereiche. Die gemeinsame Liste verschwindet für bereits erfolgreich gespeicherte
Bereiche; Tests decken Teilerfolg und unveränderte Installationsbestätigung ab.
Der bisherige Rückgabe-Platzhalter entfällt; unmittelbare Aktionen bleiben
abwartbar, Entscheidungen im offenen Dialog weiterhin verzögert. Keine neue
Warteschlange, kein geänderter Architekturfilter, keine Schreibwiederholung.

Roadmap-Audit: die benannten Bereiche des detaillierten Zielzustands sind nun
auch vor einem Fehler sichtbar. Phase 4 bleibt bis zur vollständigen Remote-
Abnahme offen. Der vorherige Kandidat d8998d9e8 hatte einen einzelnen Fehler im
portablen Async-Architekturtest; der genaue Test besteht jetzt lokal. Noch
laufende Remotejobs des alten SHA werden nicht als Prüfung dieses Diffs gewertet.
Nächster Schritt: diesen geprüften Fix committen/pushen und seine eigenen Gates
verfolgen. Keine Mainpromotion, kein Handoff und keine öffentliche Freigabe.

### Phase 4 – Vollständige Kandidatenprüfung und aktualisierte Main-Basis

CI 34315593773 für 0f47d10814f8fe7e6ea52b6ff11a5c3cf7113ed7 ist vollständig
success, einschließlich aller Plattform-, Paket-, funktionalen, visuellen und
Exact-SHA-Aggregatjobs. Die vorherigen Warteturns waren jeweils verifiziertes
Warten auf diesen aktiven Lauf. Lokale Handoff-Ressourcenprüfung ist bestanden:
Local läuft nicht, rund 229 GB verfügbar, Kampagnendaten etwa 3 MB; keine
Profil- oder Installationsänderung.

Die anschließende delivery:verify-candidate-Prüfung stoppt vor dem Handoff:
remote main enthält inzwischen c01dc6159c25a1215f467194cbb70c8d38a7299e,
der nicht Vorfahr des Kandidaten ist. Genau ein fehlender Main-Commit,
ausschließlich Abschlussdokumentation für die separat ausgelieferte Scene-
Desktop-Roadmap (zwei Dokumente). Keine fehlenden Laufzeitänderungen.

Integrationsplan vor Merge: diesen Main-Commit unverändert übernehmen, unsere
Wartungsänderungen erhalten, Konflikte gegebenenfalls anhand beider Roadmaps
auflösen. Nachweisen, dass src/resources/Abhängigkeiten/Buildkonfiguration
gegenüber 0f47d1081 unverändert sind. Dokumentformat prüfen, sauberen Mergecommit
pushen und seine eigenen vollständigen CI-/Artefaktnachweise abwarten. Kein
Umgehen der aktuellen Main-Abstammung oder Umdeuten alter Artefakte auf den neuen
SHA. Danach kanonischer Handoff und Main-Gates; Phase-4-Abschluss bleibt bis zur
abschließenden Auslieferungsprüfung offen. Phasen 5–7 bleiben vollständig im Ziel.

Mergeprüfung: konfliktfrei. Die vollständige Dateidifferenz gegenüber 0f47d1081
besteht aus den zwei übernommenen Main-Dokumenten und diesem Ausführungslog.
Expliziter Diff für src/resources/Abhängigkeiten/scripts/Workflows/Electron-
Buildkonfiguration ist leer. Volles Repositoryformat 99009 bestanden. Der
Laufzeitstand der grünen Prüfung bleibt erhalten; SHA-gebundene Handoffbelege
werden erst aus der neuen CI übernommen.

### Phase 4 – Erfolgreicher Handoff und lineare Main-Historie

Die letzten Warteturns waren verifiziertes Warten auf den aktiven CI-Lauf
34317009076. Dieser Lauf für c5a9c78aab7b33e2f767120d4016394517d88f6c
ist vollständig success. delivery:verify-candidate (25558) besteht. Der
kanonische handoff:app (56304) endet mit Exit 0 und vollständigem Beleg:
State 055338e7-9d94-4e07-8d33-12b3c894d19d, Versuch
f95cbc87-8233-48bb-a4f7-02d2da15cc22. Geprüftes und installiertes AppImage
haben denselben SHA-256
ffc8932d681e80e8e915cb0d67e390202b3903e808c892953ffd03cb2a040eb7.
Vorherige Local-Daten sind in Backup 30fc6916-8269-48bf-b851-ceeda1fc87fe
gesichert. Installierte Laufzeit: zwei Quickchecks und vier fachliche Readbacks
bestanden. Kein öffentlicher Release und keine manuelle Liveabnahme.

delivery:promote (23982) scheitert an GitHubs required_linear_history:
Mergecommit c5a9c78aa ist auf Main nicht zulässig. Main bleibt unverändert auf
c01dc6159c25a1215f467194cbb70c8d38a7299e. Die Live-Regelabfrage bestätigt
lineare Historie, Fast-forward-Schutz und das erforderliche Kandidatenaggregat.
Der vorhandene Verifier erkannte diese strukturelle Unzulässigkeit nicht vor
dem Handoff; Verbesserung der Regelprüfung gehört in den Entwicklungsablauf
der Phase 6. Keine Abschwächung der Repositoryregeln.

Korrekturplan vor Änderung der Kandidatenhistorie: alten Kandidaten und seine
Nachweise erhalten. Einen neuen Branch candidate/unified-maintenance-linear
anlegen und ausschließlich dessen lokalen Branchzeiger mit soft reset auf
die bestätigte Main-Basis setzen. Index und Dateien behalten den vollständig
geprüften Stand; daraus einen einzelnen linearen Kandidatencommit mit diesem
zusätzlichen Log erzeugen. Gegen c5a9c78aa muss der gesamte Dateibaum außer
diesem Log unverändert sein; keine Laufzeit-, Test- oder Fixtureänderung.
Format prüfen, neuen Branch normal pushen, eigene vollständige CI abwarten,
erneut dessen exakten Artefakthandoff ausführen und denselben neuen SHA nach
Main übernehmen. Kein Force-Push, kein Umschreiben des alten Kandidaten und
kein Verwenden seines Artefaktbelegs für den neuen SHA. Phase 4 bleibt bis zum
grünen Main-Nachweis offen; Phasen 5–7 bleiben vollständig ausstehend.

Korrekturprüfung: neuer Branch angelegt, ausschließlich dessen unveröffentlichte
Historie linearisiert. Vollständiger Dateibaumvergleich gegen c5a9c78aa nennt
nur dieses Log; alle 352 übernommenen Änderungsdateien behalten ansonsten den
bereits vollständig geprüften Stand. Repositoryformat (92716) und diff --check
bestanden. Der neue Commit benötigt unabhängig davon eigene CI- und Handoff-
Belege. Der vorherige Kandidatenbranch bleibt auf c5a9c78aa erhalten.

### Phase 4 – Abschluss mit eigenem linearen Kandidaten und grünem Main

Die anschließenden Warteturns haben jeweils den laufenden CI-Job 34318597826
autoritativ abgefragt. Der vollständige Lauf für
bd8b33c4f5b6e5f064deb64278d9097f739cac6d ist success, einschließlich des
Exact-SHA-Aggregats. Neuer Reviewstand: PR 671. Die unabhängige
delivery:verify-candidate-Prüfung 42309 besteht mit sauberem Arbeitsbaum,
aktuellem Main als Vorfahr und sämtlichen erforderlichen Jobs.

handoff:app 40821 endet mit Exit 0. Belegstate
cd434d39-0a3b-401d-970e-80202bde9a8d, Versuch
3f705929-d743-491e-9eb9-91067f716494. CI-Artefakt und installiertes AppImage
haben denselben SHA-256
59c509f13517430c5e15d95aed0c306e6c295be3f2bcc2a485957e9eff53d0c4.
Vorherige Local-Daten wurden in 0d9906ff-e39b-4063-b421-d0bde1da9cce gesichert.
Die installierte Laufzeit besteht zwei Quickchecks und vier fachliche Readbacks.

delivery:promote 69490 übernimmt exakt bd8b33c4f nach Main (Exit 0), ohne
Neubau oder Änderung des Kandidaten. delivery:verify-post-promotion 92905
mit explizitem GITHUB_SHA besteht. Main-Check 34320025838 ist vollständig
success. Seine Attestation bestätigt die vorherige vollständige Kandidaten-
abnahme; die dort übersprungenen Kandidatenjobs sind keine erneut ausgeführten
Tests. Kandidaten- und Main-SHA stimmen überein.

Plan-Audit bestanden: gemeinsame Editorregistrierungen und konkrete Save-/
Discard-Funktionen sind im release-editor-inventory.md den produktiven Besitzern
und Tests zugeordnet. Die bisherigen Fixrunden belegen ursprüngliche Befehls-
identität, Auflösung unklarer Ergebnisse, abhängige Editoren, erhaltene
Teilerfolge und Eingabesperren. Der gemeinsame Dialog benennt die offenen
Bereiche. Keine offenen Diskrepanzen aus den Phase-4-Fixplänen; die gesamte
Implementierung besteht die eigenen Remote- und Handoff-Gates.

Roadmap-Audit Phase 4 bestanden: mehrere offene Editoren, Speichern mit Fehler,
Teilerfolg, Verwerfen, Abbrechen und neu hinzukommende Änderungen besitzen
ausgeführte UI-/Koordinatortests. release-update-ui prüft explizit getrennte
Aktionen, Weiterarbeit beim Download, kein Installieren beim Schließen,
Offlinefehler und erneute Nutzeraktion. Die tatsächlichen Electronfälle prüfen
unter anderem Reise-/Szenenübergänge und den benannten Routenentwurf.

Phase 4 ist damit implementiert, automatisiert geprüft, lokal übergeben und
auf grünem Main abgeschlossen. Dies ist keine vollständige historische
AppImage-Qualifikation, keine öffentliche Liveabnahme und keine Veröffentlichung.
Phasen 5–7 bleiben offen. Der nächste Schritt ist der konkrete Phase-5-Plan
gegen die aktuelle Implementierung und die unveränderte kanonische Roadmap:
echte historische Schemaartefakte, semantischer Profilvergleich, tatsächliche
UI-Aktionen und Prozess-/Dateisystemfehler einschließlich Recovery und Restore.

### Phase 5 – Verbindlicher Implementierungs- und Abnahmeplan

Ausgangslage erneut geprüft: Phase 4 ist auf bd8b33c4f ausgeliefert; aktueller
Branch candidate/release-artifact-qualification trägt zunächst nur den obigen
Abschlusslog. Kanonisch bleiben release-maintenance-roadmap.md und die ursprüngliche
Abnahmematrix. Die Quellenrecherche ist Vorbereitung, kein Artefaktnachweis.

Ziel dieser Phase: ein ausführbarer Abnahmeauftrag identifiziert echte historische
AppImages und den aktuellen Zielstand. Die Tests vergleichen vollständige Profile
und fortsetzbare Fachzustände über Update, Fehler-Recovery und Wiederherstellung.
Der gemeinsame produktive Wartungsablauf bleibt verantwortlich; Testcode darf
keine eigene erfolgreiche Aktivierung oder eine erfundene Migration vortäuschen.

Arbeitspakete in Reihenfolge:

1. Historische Quellen unveränderlich festhalten und maschinell prüfen:
   A=52a0cc28cdb332406a4d03e0a14cc005eb7a0ff0 (37/34),
   B=6e84a12c1c83cd6437680ae70529cdc9723c353b (38/34),
   C=c583e05506e10d8446a4e210fa0603e3be53d63a (39/34).
   Zusätzlich Loot30=b4927dbc0979906f71b2ee4e106ec22668245dd7 (30/30)
   und Loot31=a3c506b50cac3ff3c6a52bb5285f9c96d5e0b0b8 (31/31).
   Der aktuelle Zielcommit wird bei seinem Build ausdrücklich fixiert (derzeit
   42/41); keine implizite Auswahl von latest oder einem Java-Release-Tag.
2. In isolierten Quellbäumen originale Main-/Utility-/Schemaartefakte bauen.
   Für fehlende historische Wartungs-/Prüfeinstiege einen getrennt ausgewiesenen
   Harness verwenden, mit eigener Quellidentität und Hash. Die ursprünglichen
   Schemaowner und Migrationsdateien bleiben unverändert. Provenienz umfasst
   Originalcommit, Quellbaum, Harness, Werkzeuge und tatsächliche AppImage-Bytes.
   Historischer Start, Seed, Migration und Readback müssen im jeweils benannten
   Artefakt laufen; der aktuelle Arbeitscheckout darf Daten nicht vorher öffnen.
3. Separate reichhaltige Fixture samt semantischem Erwartungszustand ergänzen:
   Installationseinstellungen, aktive/inaktive/Trash-Kampagnen, eigene Dateien
   einschließlich leerer Verzeichnisse, Weltinhalte, Gruppe, Loot/Belegidentität
   und fortsetzbarer Kampf-/Reisezustand. Originalfixture release-0.2.0 unverändert
   erhalten. Fachliche Werte/Identitäten vergleichen; zulässige neue Schema-
   Metadaten getrennt bewerten. Leere, bestehende und beschädigte Profile sind
   eigene Fälle. Nach Migration eine weitere echte Fachaktion ausführen.
4. Kontrollierten Loopbackfeed und tatsächliche Rendererbedienung integrieren:
   prüfen, herunterladen, bestätigen, installieren, Neustart, weiterarbeiten,
   Sicherung auswählen und wiederherstellen. Die vorhandene Controller-Direkt-
   prüfung bleibt Transportnachweis. Kein Download/Install ohne jeweilige Aktion;
   Downloadabschluss und Profilsperren/Prozessende zuverlässig abwarten.
5. Übergangsmatrix ausführen: A→B→C, A→C, historischer Stand→aktuelles Ziel,
   zwei echte unterschiedlich versionierte Zielartefakte ohne Schemaänderung,
   und vollständiger Loot30→Loot31-Profilübergang. Jeder Nachweis benennt die
   tatsächlich ausgeführten Bytes und die erreichten Installation-/Kampagnenschemas.
6. Fehlerfälle mit denselben Artefakten ergänzen: tatsächlicher Prozessabbruch
   innerhalb einer produktiven Migration und an allen Aktivierungs-/Recovery-
   Grenzen; WAL, Platzmangel, Zugriffsfehler, Parallelstart, beschädigte Downloads,
   fehlende Migration und neueres Datenformat. Vor Freigabe konsistentes altes
   oder neues Paar beweisen. Nach Freigabe spätere Änderungen erhalten und
   automatischen Rollback ausschließen. Restore erstellt vorher eine vollständige
   Sicherung des aktuellen Stands; diese muss spätere Arbeit wiederherstellen können.
7. Maschinenlesbare Abnahmebelege und Grenzen dokumentieren, relevante statische,
   native und echte Artefakt-/UI-Prüfungen ausführen, anschließend getrennte Audits
   gegen diesen Plan und Phase 5 der Roadmap. Kandidaten-/Handoff-/Main-Gates wie
   bisher einhalten. Erst danach Phase 6 beginnen.

Betroffene Komponenten: neue Quellen-/Artefaktverträge und Runner unter
scripts/qualification, historische Harness-Einstiege, semantische Fixtures und
Tests; vorhandener Release-Qualification-/Feed-/Remote-Debugging-Adapter;
erforderliche eng begrenzte Testports an produktiven Utility-/Wartungsgrenzen.
Main behält Netzwerk und Prozesssteuerung, Utility die Datenarbeit, SQL bleibt
bei Original- beziehungsweise Zielaggregaten. Fehlerports nur im ausdrücklich
isolierten Testmodus, keine frei aktivierbare Störung normaler Profile.

Erster konkreter Abschnitt vor Implementierung: Quellenkatalog und Inspektor
erstellen. Vollständige Commit-IDs verlangen, Git-Bäume und Originaldateien lesen,
Installation/Kampagne aus dem tatsächlichen TypeScript-Schemaowner bestimmen,
erwartete Versionen abgleichen und Quelldigests ausgeben. Unbekannte Ownerform,
fehlender Commit und abweichende Schemazuordnung müssen scheitern. Zielgerichtete
Tests dieser Ablehnungen sowie echte Inspektion aller fünf historischen Quellen;
kein AppImage-Erfolg aus diesen Metadaten ableiten. Danach erst den Buildadapter
gegen die bestätigten Originalquellen konkretisieren und implementieren.

Abschlussgrenze: Jeder geforderte Fall besitzt einen bestandenen Nachweis im
passenden Umfang. Ein Vertrag, grüner Unit-Test, erfolgreicher Neubau oder Start
allein schließt Phase 5 nicht. Releasepipeline/geschützte Freigabe und Risiko-CI
bleiben Phase 6; vorhandene Nutzerdatenkopie, dokumentierter Livetest und die
öffentliche Veröffentlichung unveränderter Bytes bleiben Phase 7.

### Phase 5 – Quelleninspektor: erster geprüfter Abschnitt

Implementiert: scripts/qualification/historical-release-sources.ts benennt die
fünf Originalcommits und erwarteten Schemapaare. Der Inspektor verlangt volle
Commit-IDs, liest Dateien mit git show aus diesem Commit und ermittelt die
Schemawerte über den TypeScript-AST ohne Ausführung alten Anwendungscodes.
Ausgabe enthält Quellbaum, Paket-/Paketmanagerversion und SHA-256 von Schemaowner,
package.json und Lockfile, ausdrücklich als source-inspection-only gekennzeichnet.
scripts/inspect-release-history.ts inspiziert alle fünf Originalstände.

Validierung: 52822, elf Tests bestanden. Die Git-basierte Regression verändert
nach dem Commit den Arbeitsbaum und belegt trotzdem die ursprünglichen
Schemawerte; falsche Erwartungen und fehlende Commits werden abgelehnt. Weitere
Fälle prüfen ungepinnte Referenzen, irreführende Kommentare, nichtliterale Werte,
doppelte Deklarationen/Felder und unbekannte Ownerformen. Typprüfung 49645 und
betroffenes ESLint/Format 75238 bestanden. Tatsächliche Quelleninspektion 30560
bestanden: A 37/34, B 38/34, C 39/34, Loot30 30/30, Loot31 31/31. Bericht unter
work/roadmap-phase5-historical-sources.json außerhalb des Repositorys.

Abschnittsaudit gegen Plan bestanden: die gewählten Quellen sind nun anhand
der Originaldateien maschinell prüfbar und bleiben unabhängig vom Arbeitsbaum.
Roadmap-Audit: dies qualifiziert ausschließlich die Quellidentität. Noch keine
historischen AppImages gebaut, keine reale Migration/UI- oder Fehlerabnahme
dieser Phase bestanden. Nächster Abschnitt: Buildadapter mit unveränderten
historischen Schemaownern und ausdrücklich separatem Harness konkretisieren.

### Phase 5 – Historischer Buildadapter: konkreter nächster Abschnitt

Quellenprüfung: A besitzt originale Release-Build-/Packaging-Skripte und dieselben
grundlegenden Electron-/SQLite-Versionen, aber keinen Release-Updater. Der Build
kann deshalb aus einem separaten detached Worktree mit eigenem node_modules
erfolgen. Historische Runtime- und Migrationsdateien werden nicht bearbeitet.

Implementierungsplan: Originalstand prüfen, frischen detached Worktree anlegen,
Lockfile-Installation und originales build:release ausführen. Danach ausschließlich
unter out/qualification einen separat gebündelten Test-Main und Test-Utility
ergänzen. Packaging wählt den Test-Main als expliziten Wrapper: normale Starts
delegieren an den originalen Main; nur der isolierte historische Testmodus startet
die Test-Utility. Ein Alias bindet den originalen Schemaowner aus dem historischen
Worktree ein. Native Module bleiben original paketiert. Testversionen sind explizite
CLI-Eingaben und keine veröffentlichten Releases. Vor/nach dem Build unveränderten
getrackten Quellbaum nachweisen; vorhandene Ausgabeordner nicht überschreiben.

Erster Runtimeauftrag liefert ausschließlich Identität: tatsächliche Schemas,
native SQLite-Funktion, Electron-/Node-Version. Ausgabe und Prüfumgebung liegen
unter einem eigens gewählten isolierten XDG-Ort. Kein Öffnen vorhandener Profile.
Ein Herkunftsbeleg bindet Originalquellen, separate Harness-Quelldigests,
Buildwerkzeuge, eingepackte Harness-Dateien und AppImage-Hash zusammen. Dieser
Abschnitt behauptet noch keine historische Updatebedienung oder Migration.
Validierung: statische Prüfungen, tatsächlich A bauen und den eingebauten
Utility-Einstieg aus exakt diesem AppImage starten. Bei Fehlern gezielte
Fixrunden; erst danach Seed/Migrate/Readback und die übrigen Stände erweitern.

Erste statische Prüfung des Buildadapters: Typprüfung 51299 bestanden; ESLint
45070 beanstandet eine unvalidierte version-Eigenschaft aus JSON.parse bei der
Vite-Werkzeugidentität. Korrekturplan: Paketmetadaten mit Zod validieren statt
eines nachgeschalteten Typecasts; betroffenes ESLint erneut ausführen, dann
erst den tatsächlichen historischen Build starten.

Korrigiertes ESLint 1647 bestanden. Historischer Build A (89305) vollständig
Exit 0: eigener detached Worktree, originales Lockfile installiert und originaler
Release-Build durchgeführt; zwei separate Harness-Bundles ergänzt und AppImage
gebaut. Der getrackte Originalbaum ist vor/nach dem Build unverändert. Artefakt
SaltMarcher-0.0.137-x64.AppImage, 176562741 Bytes, SHA-256
0ff4bc0bbb21b59e2fe2b7c55b8e39f6cb06066a8c90891a09442325b20c5bc6.
Herkunftsbeleg liegt neben den Bytes unter work/historical-artifacts/a.

Der erste Startaufruf erreichte das AppImage wegen fehlendem xvfb-run im PATH
nicht (Exit 127). Mit dem vorhandenen Testwerkzeugpfad startet dieselbe Datei,
ohne Neubau: 85992 Exit 0. Tatsächlicher Utility-Readback meldet Testversion
0.0.137, Installation 37/Kampagne 34, SQLite 3.53.4, Node 24.18.0 und Electron
43.2.0. Unabhängiger Vergleich bestätigt Dateigröße/Hash und Übereinstimmung
von Laufzeitschema und ursprünglichem Quellenbeleg. Keine vorhandenen Profile
geöffnet; Testmodus nutzte einen separaten XDG-Ort.

Abschnittsaudit: Build- und Utility-Identitätsweg bestehen für A. Das ist ein
echtes historisches AppImage mit unveränderten Originalschemas und bezeichnetem
Harness. Normale UI-Delegation, weitere Quellen, Seed/Migration/Readback,
Fehlerfälle und vollständige Updatebedienung sind noch unqualifiziert. Phase 5
bleibt offen; kein historischer Migrations- oder Veröffentlichungserfolg behauptet.

### Phase 5 – Historische Profilbefehle und erste semantische Fixture

Plan vor Erweiterung: Test-Main erhält explizite seed/read/advance-Aufträge
mit eindeutiger Request-ID. Er hält die vorhandene gemeinsame kanonische
Profilsperre bis zum Ende seiner Utility. Profile liegen am Release-Profilort
innerhalb des isolierten XDG-Verzeichnisses; Ergebnisse außerhalb des Profils,
unveränderlich pro Request. IPC-Anfragen/-Antworten werden validiert. Keine
Änderung normaler Anwendungsaktionen oder historischer SQL-Dateien.

Utility bindet CampaignStore und PartyStore ausschließlich aus dem gewählten
Originalbaum ein. Vor read/advance muss dessen ursprünglicher Persistence-
Preflight alle Daten als ready bestätigen; kein Lesen mit versehentlicher
Vorwärtsmigration. Seed verweigert bereits vorhandene Daten, erzeugt aktive,
inaktive und Trash-Kampagne, abweichende Einstellungen, eigene Binär-/Textdateien
und ein leeres Verzeichnis sowie benannte Charaktere mit XP/Sprachen/Werten.
Read liefert konkrete Werte aus allen drei Kampagnen und eigene Dateiinhalte;
advance verändert XP über den ursprünglichen PartyStore und belegt weitere
Facharbeit. Diese Fixture ist zunächst ausdrücklich partiell; Weltinhalte,
Kampf-/Reisezustand und Loot31-Fakten bleiben im Phase-5-Plan verpflichtend.

Weil die gemeinsame Sperre zusätzliche aktuelle Harness-Abhängigkeiten einbindet,
erfasst der Builder nun auch die tatsächlich gebündelten Quelldateien samt Hash,
getrennt vom unveränderten Originalbaum. Nach statischer Prüfung neues A-Artefakt
in neuem Ausgabeordner bauen; altes Identitätsartefakt erhalten. Seed/read/advance
aus denselben Bytes prüfen und Schema/semantische Werte vergleichen. Ein
Migrationsbefehl wird erst im nächsten Abschnitt über Original-Preflight und
Original-Migrationsregistry auf einer Arbeitskopie ergänzt; kein In-place-Test
als Nachweis journalgestützter Aktivierung ausgeben.

Profilbefehle implementiert: validierte Request-/Response-Verträge und eindeutige
Ergebnisdateien, gemeinsame Main-Profilsperre bis zum Utility-Ende, ursprüngliche
CampaignStore-/PartyStore-/Preflight-Bindungen. read/advance verlangen ready vor
Öffnen; seed verweigert jedes vorhandene Profil. Der Builder erfasst nun alle
tatsächlich gebündelten Harness-Abhängigkeiten mit Dateidigests und prüft ihre
Unverändertheit. Originaldateien bleiben separat durch Commit/Tree gebunden.

Typprüfung 51960 und ESLint 67436 bestanden. Build A mit erweitertem Harness
32275 Exit 0, neues eigenes Ausgabeverzeichnis a-profile-v1. AppImage-SHA-256
9e05893db392a1c13dc60080ee8fc28683713a04d4eb1aa52f5a9ea8f4c955a6.
Der vorherige reine Identitätsbuild bleibt erhalten. Tatsächliche AppImage-
Abnahme 12556 Exit 0: seed, read, advance, read, abgelehnter seed und read.
Jeder Aufruf prüfte Prozessende, Paketversion, Request-ID und Erfolg/Fehler.
Initiales und erneut gelesenes Profil stimmen vollständig überein. Drei
Kampagnen, eine davon im Trash, dunkles Theme, Charaktersprachen und leeres
eigenes Verzeichnis explizit geprüft. Weiterarbeit erhöht nur die aktive
Charakter-XP um 25; die anderen Kampagnen bleiben gleich. Nach verweigertem
Neuanlegen bleibt der gesamte spätere Readback identisch.

Unabhängige abschließende SQLite-Prüfung: genau vier Datenbanken, Installation
37 und alle drei Kampagnen 34, jeweils integrity_check=ok und keine verletzten
Fremdschlüssel. Ergebnisse unter work/roadmap-phase5-profile-a-evidence.json;
pro Request unveränderte Berichte unter dem isolierten historischen Testprofil.

Abschnittsaudit bestanden für die ausdrücklich partielle Fixture. Dies belegt
Erzeugung, Persistenz und eine spätere Fachänderung in Originalruntime A. Keine
historische Migration oder gekoppelte Aktivierung ausgeführt; Welt-/Kampf-/
Reise-/Loot-Fakten und die vollständige Fehler-/UI-Matrix bleiben ausstehend.
Nächster Abschnitt: wiederverwendbaren Artefaktrunner und Originalmigrations-
auftrag auf Arbeitskopien ergänzen, dann A→B und A→C tatsächlich vergleichen.

### Phase 5 – Runner und Originalmigrationen auf Arbeitskopien

Konkreter Plan: ein wiederverwendbarer Runner validiert den historischen
Artefaktbeleg und Dateinamen, prüft Größe/Hash vor Ausführung, bindet jeden
AppImage-Aufruf an Request-ID/Operation/Version und wartet auf dessen tatsächliches
Prozessende. Ergebnis und Laufzeitbeleg bleiben pro Aufruf erhalten. Eine
Testdeadline beendet ausschließlich die eigens gestartete Prozessgruppe;
Beobachtungszeitlimits lösen keinen neuen Lauf aus. Byteidentität nach dem Lauf
erneut prüfen. Strukturierte fachliche Fehler sind von Prozess-/Protokollfehlern
zu unterscheiden.

Getrennte Arbeitskopie: nur in neuem Ziel-XDG-Ort anlegen, ursprüngliches
Testprofil mit gemeinsamer Sperre halten und vollständigen Dateibaum einschließlich
WAL/SHM/leerem Verzeichnis kopieren. Vorher/nachher Inventar der unveränderten
Quelle vergleichen; Arbeitskopie außerhalb des Profils ausdrücklich markieren.
Dies ist Fixturetransport unter exklusiver Sperre, kein Ersatz für den produktiven
Online-Backup-/Updateablauf und kein Beleg seiner Aktivierung.

Test-Utility erhält migrate nur für diese markierte Arbeitskopie. Vorab den
vollständigen Original-Preflight ausführen; sämtliche ermittelten Datenbanken mit
dem unveränderten applySchemaMigrations der Zielquelle aktualisieren, WAL
abschließen und Integrität/Fremdschlüssel prüfen. Danach ready und fachlichen
Readback durch dieselbe Zielruntime verlangen. Bericht enthält tatsächliche
Migrations-IDs und vorherige/erreichte Versionen, getrennt von fachlichen Werten.

Nach statischer Prüfung B mit Originalschema 38/34 bauen, A-Profil auf Arbeitskopie
mit B migrieren und gegen A-Readback vergleichen; ursprüngliches A-Profil bleibt
unverändert. Danach C für A→C und B→C einschließlich späterer Arbeit verwenden.
Unveränderte Quellbäume, separate Harnessbelege, Datenpaaraktivierung und echte
Update-UI bleiben strikt getrennte Nachweise im vollständigen Phase-5-Plan.

Erste Runnerprüfung: 17 Quellen-/Artefaktfälle (39011) und Typprüfung 18441
bestanden. ESLint 27520 fordert für den unbekannten kill-Fehler einen Error als
Promise-Rejection. Fixplan: diesen Fehler mit Ursache in einen Error einbetten,
ohne Timeout-/Prozessbeendigung zu ändern, und betroffenes ESLint wiederholen.

Korrektur-ESLint 13336 bestanden. B-Build 68822 Exit 0 mit Originalcommit
6e84a12c1c83cd6437680ae70529cdc9723c353b und Testversion 0.0.138;
AppImage-SHA-256 f679ff8e6fa291487b70ce3c6c32185230555c720f4cb0b6117734509f6f482a.
Der neue wiederverwendbare qualify-historical-migration.ts orchestriert Quelle,
markierte Arbeitskopie, Ablehnung des unmigrierten Stands, Migration, Wiederlesen,
Weiterarbeit und Kontrolle der Quelle. CLI-ESLint 8611 und Typprüfung 18589 bestanden.

Tatsächlicher A→B-Lauf 91477 Exit 0, Nachweis
work/historical-a-to-b-v1/historical-migration-evidence.json. A-Bytes
9e05893db392a1c13dc60080ee8fc28683713a04d4eb1aa52f5a9ea8f4c955a6
gegen die oben benannten B-Bytes. Die Originalmigration
installation-37-to-38-campaign-registry-revision wurde tatsächlich ausgeführt;
Installation ist danach 38, alle drei Kampagnen bleiben 34. Vor Migration
verweigert B den Readback. Danach stimmen sämtliche bisher erfassten
Profilwerte mit A überein; B kann XP weiter erhöhen und denselben späteren
Stand nach Neustart lesen. Der abschließende A-Readback bleibt identisch.

Abschnittsaudit: echte Originalmigration und eigene Zielruntime mit partieller
Fixture belegt. Kein Beleg für Updatefeed, Programmaktivierung oder vollständigen
Spielzustand. Nächster Lauf: C-Bytes bauen und A→C sowie B→C ausführen, damit
das Überspringen und die mehrstufige Kette dieselben Originalmigrationen prüfen.

C-Build 64706 Exit 0: Originalcommit
c583e05506e10d8446a4e210fa0603e3be53d63a, Testversion 0.0.139, AppImage-SHA-256
bcfadf0f953588db692c4766ea7a5a7c463e8a44a8d26e5eaedd24e2c61deecf.
A→C 44982 besteht (Exit 0): echte Installation 37→38→39 über
campaign-registry-revision und campaign-command-receipts, Kampagnen 34 bleiben
34. Sämtliche partiell erfassten Inhalte werden vor/nach Migration und nach
weiterer XP-Arbeit geprüft. Quelle unverändert. Nachweis
work/historical-a-to-c-v1/historical-migration-evidence.json.

B→C 46953 besteht (Exit 0) aus dem bereits unter B fortgeführten A-Profil:
Installation 38→39 durch installation-38-to-39-campaign-command-receipts.
Die nach A→B geleistete Arbeit bleibt erhalten, C ermöglicht weitere Arbeit,
und der unveränderte B-Quellstand bleibt lesbar. Nachweis
work/historical-b-to-c-v1/historical-migration-evidence.json. Dieselben C-Bytes
wurden für beide Pfade verwendet; keine Neubauten zwischen diesen Abnahmen.

Plan-Audit dieses Abschnitts bestanden: A→B→C und A→C laufen mit tatsächlichen
Original-Schemawechseln in echten AppImages, nicht nur umbenannten aktuellen
Bundles. Der Runner bindet Ergebnisse an Dateihashes, Request-IDs und Prozessende.
Roadmap-Audit bleibt unvollständig: partielle Fixture, keine gekoppelte
Programmaktivierung, kein UI-Updateweg, keine volle Fehler-/Restorematrix.
Noch erforderlich: reichhaltiger Fachzustand, aktuelles Ziel 42/41, gleicher-
Schema-Fall, Loot30→31, echte Unterbrechungen/WAL/Platz/Zugriff/Parallelstart,
fehlende/neue Formate, Restore und spätere Arbeit. Phase 5 bleibt offen.

### Phase 5 – Fortsetzbarer Kampf und eigene Orte

Plan vor Fixture-Erweiterung: den tatsächlich vorhandenen Originalablauf aus
live-play.test.ts verwenden: Charakter der Szene zuweisen, benannte feindliche
Wolfsgruppe mit Notiz speichern, Kampf vorbereiten, Initiative bestätigen,
poisoned auf einer Gegnerkarte setzen und einen Zug fortschalten. Pro Kampagne
einen eigenen Ort mit Tags, Vorlesetext und Spielleitungsnotiz anlegen. Original-
LivePlayService, DatabaseAccess und WorldLocationStore über explizite historische
Aliase einbinden; keine direkte Fixture-SQL-Abkürzung.

Readback erweitert sich um vollständigen LiveSessionSnapshot und Ortsbestand
aller Kampagnen einschließlich Trash. Die Weiterarbeit im aktiven Bestand erhöht
weiterhin XP und schaltet zusätzlich einen tatsächlich laufenden Kampfzug fort.
Abnahme prüft vor Migration vorhandene Gruppen, Zustände und Initiative, danach
vollständige Gleichheit sowie fortgesetzten und erneut geladenen Kampfzustand.
Der generische Runner darf eine leere/unvorbereitete Kampfsnapshot nicht als
Fortsetzbarkeit werten.

Neue Fixturekennung und neue Artefakt-/Profilverzeichnisse verwenden; bisherige
partielle Belege bleiben unverändert. Zuerst Typen/Lint, dann A und C mit demselben
erweiterten Harness bauen und den überspringenden Originalmigrationspfad erneut
prüfen. B und die vollständige Matrix folgen für die finale Fixture. Reise,
Loot-Migration, NSC/Fraktionen und die übrigen Abnahmeanforderungen bleiben offen.

Erweiterung implementiert und statisch geprüft: Typprüfung 66482 und ESLint
27711 bestanden. combat-profile.ts nutzt ausschließlich die Originalservices;
zusätzlich zu poisoned werden zwei Trefferpunkte Schaden gespeichert. Der
Runner verlangt vorbereiteten Kampf, vergifteten verletzten Gegner, eigenen
Ort und nach Weiterarbeit höhere Kampfrevision sowie andere aktive Karte/Runde.
Die dünne CLI run-historical-artifact.ts macht einzelne Harness-Aufträge ohne
temporäres Eval-Skript ausführbar.

Buildsequenz 93418 vollständig Exit 0. A-combat-v2 hat SHA-256
4c1c3196e42c6792df4d8d3e351693065f35c3cef37ca72aec90bebc44e5576f;
C-combat-v2 hat SHA-256
583b43ce40be8aa015ad805c41abfcd2e288f383a9f59042009bb17f54015e0f.
Seed aus tatsächlichem A-AppImage 46367 Exit 0. A→C 5641 Exit 0, Beleg
work/historical-a-to-c-combat-v2/historical-migration-evidence.json. Originale
Installation 37→38→39, alle Kampagnen 34. Vollständige erfasste Sessions/Orte,
Charaktere, Kampagnen und eigene Inhalte stimmen nach Migration überein. Der
aktive Kampf wird unter C fortgesetzt; erneutes Lesen bestätigt den späteren
Zustand. A bleibt unverändert. Alle drei Kampagnen, einschließlich Trash, tragen
einen echten laufenden Kampf statt einer leeren Fachprojektion.

Abschnittsaudit bestanden: fortsetzbarer Kampf und eigene Orte sind im
überspringenden historischen Artefaktpfad belegt. Die Fixture bleibt ohne
Reisefortschritt, NSC-/Fraktionsbestand und Loot-Migrationsfakten unvollständig;
die volle Matrix ist mit der finalen Fixture erneut auszuführen. Aktueller
Zielstand 42/41, gekoppelte Aktivierung, UI, Fehlerfälle und Restore bleiben
weiterhin verpflichtend. Phase 5 bleibt offen.

### Phase 5 – Verknüpfte Weltinhalte und pausierter Reisefortschritt

Plan vor Erweiterung: Original-EncounterTableStore und WorldFactionStore erzeugen
eine eigene Begegnungstabelle und Fraktion; WorldLocationStore verknüpft sie mit
dem eigenen Ort. Original-WorldNpcApplicationService legt einen benannten NSC
mit Fraktions- und Ortsbezug sowie eigenen Textfeldern an. Readback prüft die
vollen jeweiligen Bestände und ausdrücklich die erhaltenen Verknüpfungen.

Original-HexMapStore erzeugt eine kleine begehbare Karte mit fünf Hexfeldern und
Ortsplatzierung. Der Charakter wird der Standardszene zugewiesen; originaler
HexTravelService startet die Route, erreicht mit kontrollierter Uhr einen
Wegpunkt und pausiert. Danach beginnt der bereits qualifizierte Kampf auf dieser
Szene. Beide Zustände bleiben gespeichert; es läuft keine Hintergrunduhr im
Harness. Readback ergänzt Karte/Chunks und vollständigen Reise-Snapshot.
Weiterarbeit setzt die pausierte Reise über den Originalservice fort, erreicht
einen weiteren Wegpunkt und pausiert erneut. Position, Spielzeit, Wegindex und
unveränderte Route werden explizit geprüft, zusätzlich zum Kampfzug/XP-Nachweis.

Fixturekennung v3 und neue Artefakt-/Profilverzeichnisse verwenden. Keine neuen
produktiven SQL-Abkürzungen. Statische Prüfungen, dann A/C neu bauen und den
überspringenden Migrationslauf mit vollständigem Vergleich wiederholen. Diese
Erweiterung betrifft den Schema-34-Kohortenbestand; Loot30/31 benötigt weiter
seine auf die damals verfügbaren Besitzer abgestimmte fachliche Fixture.

V3-Erweiterung implementiert: world-profile.ts verwendet Originalbesitzer für
Tabelle, Fraktion, verknüpften Ort und NSC; travel-profile.ts erzeugt Karte und
pausierte Reise über Originalservices mit kontrollierter Uhr. Profil-Readback
enthält vollständige Welt-, Karten-/Chunk- und Reiseprojektionen. Weiterarbeit
setzt Kampf und Reise fort. Der Qualifier verlangt die Referenzbeziehungen,
einen zusätzlichen Wegpunkt, unveränderte Route und 3600 zusätzliche Spielsekunden.

Statische Validierung: erste Typprüfung 78270 Exit 0; ESLint 75020 Exit 0;
abschließende Typprüfung einschließlich erweitertem Qualifier 32110 Exit 0.
Planabgleich: Implementierung des V3-Abschnitts vorhanden, tatsächliche A/C-
Artefaktprüfung noch ausstehend. Roadmapabgleich: Phase 5 bleibt unvollständig;
diese statischen Prüfungen belegen weder historische Laufzeitkompatibilität noch
Updateaktivierung. Nächster Schritt: neue A/C-world-travel-v3-AppImages bauen,
Seed und überspringenden Migrationspfad ausführen, Abweichungen vor Korrektur
protokollieren. Frühere Artefakte und deren Nachweise bleiben erhalten.

V3-Artefaktprüfung abgeschlossen: A-Build 98646, A-Seed 66285, C-Build 16955
und A→C-Qualifikation 63053 jeweils Exit 0. A-SHA256
45883945c2dd3cc5e267d893fecaaf98b55085d48793d05019ad9f2bb7fccf44,
C-SHA256 ec801da1a7d75adbbbd6fb9554a51a05814b2f5cfa01e2f20877986a2a254cdf.
Beleg: work/historical-a-to-c-world-travel-v3/historical-migration-evidence.json.
Alle drei Kampagnen (aktiv/inaktiv/Trash) enthalten verknüpfte Weltinhalte,
laufenden Kampf und pausierte Reise bei Wegindex 1. Originale Installation
37→38→39 ausgeführt, Kampagnen bleiben bei 34. Vollständige erfasste Projektionen
nach Migration identisch, anschließend XP/Kampfzug/Reise fortgesetzt und erneut
identisch geladen. Aktive Reise erreicht Index 2 mit 3600 zusätzlichen
Spielsekunden; das Quellprofil bleibt im vollständigen Readback unverändert.

Plan-Audit des V3-Abschnitts: bestanden einschließlich tatsächlicher historischer
Laufzeiten, Referenzerhalt und fortsetzbarer Reise. Roadmap-Audit: Teilnachweis;
Loot-Migration, vollständige finale Matrix, aktueller Zielstand 42/41,
Produktionsaktivierung mit UI/Feed, Fehlermatrix und Restore bleiben offen.
Phase 5 wird nicht geschlossen. Keine laufenden Builds/Tests nach diesem Lauf.

### Phase 5 – Übergang zum aktuellen Originalstand 42/41

Voriger Goal-Turn: Fortschritt durch V3-Implementierung und bestandenen echten
A→C-Migrationsnachweis. Aktueller Checkout bestätigt den unveränderten grünen
App-Commit bd8b33c4f5b6e5f064deb64278d9097f739cac6d mit Installation 42 /
Kampagne 41. Keine laufenden Builds oder Tests festgestellt.

Plan: Diesen vollständigen Commit als expliziten Vergleichsstand current in den
Quellkatalog aufnehmen. Ein neues Test-AppImage 0.0.142 mit den unveränderten
Originalquellen und demselben V3-Harness bauen. A→current auf neuer Profilkopie
prüfen; dabei müssen erstmals auch die Kampagnenschemata 34→41 migrieren.
Vollständiger Projektionsvergleich bleibt zunächst streng. Falls neue fachliche
Felder einen begründeten Vergleichsvertrag benötigen, zuerst konkrete Differenz
und Migrationsverantwortung untersuchen und einen Korrekturplan protokollieren;
keine pauschale Entfernung unbekannter Felder oder Abschwächung der Assertions.
Eigene Dateien, Referenzen, Kampf und Reise müssen erhalten und fortsetzbar sein.

Current-Build 85775 Exit 0. A→current 31672 endet erwartungsgemäß am strengen
Vergleich mit Exit 1, nachdem Originalmigrationen und Fachreadback erfolgreich
waren. Konkrete Differenzen: neue burden-Projektion (shortTrusted/longTrusted
false, dailyBudget 1200) an beiden Party-Lesestellen; lastOpenedAt null für alle
Registry-Einträge; Settingsrevision +1 und entfallenes altes Standardlayout.

Korrekturplan vor Änderung: Eigenständigen erwarteten Migrationszustand aus der
Quellprojektion bilden, eng begrenzt auf den nachgewiesenen Übergang 34→41 /
37–39→42. Nur die ausdrücklich erwarteten neuen Felder hinzufügen. Die damalige
Fixture besitzt ausschließlich das alte Standardlayout; dessen Ablösung ist in
scene-desktop-roadmap.md Phase 6 vorgesehen und Installation 41→42 umgesetzt.
Nur exakt dieses Standardlayout darf dieser Vergleich entfernen, kundenspezifische
Layoutwerte müssen den Test abbrechen und gesondert geprüft werden. Theme bleibt
unverändert, Revision erhöht sich genau einmal. Alle übrigen Felder bleiben im
vollständigen Gleichheitsvergleich; keine generische Normalisierung. Unitfälle
prüfen Erwartungen, Quellunverändertheit und Ablehnung fremder Layoutwerte.
Danach denselben unveränderten AppImage-Bytesatz auf frischer Arbeitskopie prüfen.

Erwartungsvertrag implementiert in historical-profile-expectations.ts; dieser
transformiert ausschließlich den bekannten Standardlayout-/Stufe-3-Kohortenfall.
14 Unitfälle (inklusive bestehender Quellinspektion) in 37573 bestanden; ESLint
und Typprüfung 31073 Exit 0. AppImage current unverändert mit SHA256
4a4d93dd7c591911042adbb31e66f801e0e7e84316900a13af1b8d7b8d1c2bdb.

Erneuter Lauf 57483 auf neuer Kopie endet Exit 1 erst bei advance: Migration
37→42 / 34→41 und vollständiger erwarteter Profilvergleich sowie erneutes Lesen
bestehen. Advance meldet scene_activity_conflict. Original-HexTravelStore.resume
verhindert bei laufendem Kampf eine Reise; V3 hatte nach XP/Kampfzug die Reise
auf derselben Szene fortgesetzt. Das war historisch zulässig, ist im aktuellen
Fachmodell ausdrücklich verhindert. Kein Produktfehler aus dieser Beobachtung
abgeleitet. Die fehlgeschlagene Kopie enthält bereits XP/Kampfzug-Änderungen und
wird nicht als Ausgangsbestand wiederverwendet. Quellen und Artefakte unverändert.

Korrekturplan vor nächster Harness-Änderung: Weiterarbeit in zwei explizite
Aufträge aufteilen. Zuerst XP und Kampfzug, dann vollständiger read/persistierter
Vergleich inklusive weiterhin unveränderter pausierter Reise. Anschließend über
originales endCombat den Kampf beenden, Reise fortsetzen und erneut pausieren;
separater Vergleich von Route, Position, Wegindex, Zeit, eigenen Weltinhalten und
unberührten Kampagnen. Auch diesen Endzustand in neuem Utility-Prozess lesen.
Der Nachweis des fortgesetzten Kampfs bleibt als Zwischenbeleg erhalten; kein
Entfernen seiner Assertions zugunsten der Reise. Aufträge versioniert im Harness
abbilden und neue Artefaktverzeichnisse verwenden; ältere V3-Bytes erhalten.
Danach A→current mit vollständigen Nachweisen wiederholen und die übrige Matrix
mit konsistentem Harness nachziehen.

Plan-Audit aktueller Abschnitt: Originalmigration bis 42/41 und erwartete
Fachreadbacks belegt, Fortsetzung wegen unpassender Testreihenfolge offen.
Roadmap-Audit: Phase 5 bleibt offen, insbesondere echte Produktionsaktivierung,
UI-Feed-Ablauf, Fehler-/Recoverymatrix und vollständige Restore-Abnahme. Kein
Build-/Testprozess mehr aktiv am Ende dieses Abschnitts.

Präzisierung vor Umsetzung: endCombat öffnet die Ergebnisphase. Der zweite
Auftrag ruft danach completeCombat auf (keine besiegten Gegner, keine zusätzliche
XP-Vergabe) und erst dann resume/tick/pause. Finale Kampfsnapshot muss null sein;
der unveränderte gespeicherte Zwischenstand beweist zuvor den fortgesetzten Kampf.
Neue Auftragsnamen advance-combat und finish-combat-and-travel vermeiden eine
stille Umdeutung des bereits belegten V3-Auftrags advance.

Korrektur implementiert: explizite Aufträge advance-combat und
finish-combat-and-travel, vollständiger gespeicherter Kampf-Zwischenstand,
anschließender Abschluss und gespeicherte Reise. Typprüfung 12809 und ESLint
8736 Exit 0. Current-V4-Build 53764 Exit 0; SHA256
18633206ffea1f4b3c24a91cfbdd7721cefd65a9396c3b55ace53408216534d9.
A→current 27673 vollständig Exit 0, Beleg
work/historical-a-to-current-sequential-v4/historical-migration-evidence.json.
Originalinstallation 37→42 und alle drei Kampagnen 34→41; beide Fortsetzungs-
Zwischenstände erneut geladen. Quelle unverändert. Plan-Audit Korrektur bestanden;
Roadmap-Audit weiterhin Teilnachweis ohne gekoppelte Updateaktivierung.

Nächster geplanter Matrixfall: aktuelles Original-AppImage erzeugt ein frisches
V3-Fachprofil. Zweites AppImage desselben expliziten Originalcommits mit anderer
Testversion 0.0.143 qualifiziert den Übergang ohne Schemaänderung. Neue Verzeichnisse,
keine Wiederverwendung fehlgeschlagener Kopien. Vergleich darf keine Migration
melden und keinen erwarteten Datenformatumbau anwenden; Fortsetzung von Kampf
und Reise bleibt identisch verpflichtend. Dieser Fall bleibt als Daten-/Artefakt-
prüfung vom noch offenen UI-Transport-/Aktivierungsnachweis getrennt.

Ohne-Schemawechsel-Fall abgeschlossen: Current-Seed 22036 Exit 0, unabhängig
gebautes zweites AppImage 36712 Exit 0, SHA256
066d6a6eee0ed94614cc563348eda653d7b694f16b755ac5d0e29507ce01306e.
Version 0.0.142→0.0.143, beide Originalcommit bd8b33c4f5b6e5f064deb64278d9097f739cac6d.
Qualifikation 94768 Exit 0, Beleg
work/historical-current-to-next-sequential-v4/historical-migration-evidence.json.
Alle vier Datenbanken bleiben auf 42/41; keine Migration wird ausgeführt.
Vollständiger Profilvergleich, fortgesetzter Kampf, Abschluss, fortgesetzte Reise,
erneutes Laden beider Zwischenstände und unveränderte Quelle bestätigt.

Abschließende statische Prüfung 37302 Exit 0. ESLint leer/erfolgreich und alle
20 Unitfälle in 89649 bestanden. Keine Builds/Tests mehr aktiv.
Plan-Audit dieses Abschnitts: sequenzielle Fortsetzung und echter Artefaktfall
ohne Schemaänderung bestanden. Roadmap-Audit: A/B/C mit finalem Harness,
Loot30→31, Fehler-/Abbruchmatrix, Produktionsaktivierung über kontrollierten Feed
und UI sowie Restore bleiben offen. Kein vollständiger Updateweg behauptet;
alle aktuellen Nachweise verwenden isolierte markierte Arbeitskopien und den
expliziten historischen Utility-Harness. Phase 5 bleibt offen.

### Phase 5 – Vollständiger Zwischenversionspfad mit späterer Arbeit

Voriger Goal-Turn ist Fortschritt: sequenzielle Fortsetzung und schemafreier
Artefaktvergleich bestanden. Aktuelle Dateien und Prozesszustand bestätigt.
Plan vor Erweiterung: Qualifier erhält optional continuation-home. Nach dem
vollständig erneut gelesenen Kampf-/XP-Zwischenstand wird das vollständige Profil
unter bestehender exklusiver Kopiersperre in ein neues Verzeichnis kopiert und
vom B-AppImage dort erneut gelesen. Der Vergleich muss exakt dem B-Zwischenstand
entsprechen; dieser Beleg wird in den A→B-Nachweis aufgenommen. A→B schließt danach
seinen Reise-/Abschlusstest weiterhin ab. B→C verwendet die erhaltene Kopie mit
bereits erhöhten XP, fortgesetztem Kampf und eigener later-work.txt. So bleiben
beide Abnahmeläufe vollständig, während der zweite echte spätere Arbeit übernimmt.

B und C mit dem aktuellen sequenziellen Harness in neuen Verzeichnissen bauen.
A→B, B→C und A→C ausführen. Keine Änderungen an historischen Appquellen oder SQL;
keine Behauptung von Produktionsbackup/Updateaktivierung für die Harness-Kopie.

B-Build 78847, C-Build 74530, A→B 66769 und B→C 17705 Exit 0.
Parallel A→C 67046 Exit 1: Antwortdatei beweist Migration erfolgreich, jedoch
stimmt Prozessabschluss nicht mit Erfolg überein; Runner verweigert korrekt den
Erfolgsnachweis. Log enthält „Failed to clean up cache directory“, gemeinsame
/tmp/appimage_extracted_d27f3a09da4c14919c9cd728a3dcfbc0 sowie Inotify-Limitmeldungen.
Beide Prozesse verwendeten dasselbe C-AppImage mit standardmäßig gemeinsamem
Extraktionsverzeichnis. Kein erneuter Start wegen Beobachtungstimeout: beide
Prozesshandles sind terminal bestätigt.

Korrekturplan: pro Harness-Auftrag eigenes TMPDIR innerhalb des isolierten
Reportverzeichnisses mit restriktivem Modus bereitstellen. Damit konkurrieren
Extraktion und Aufräumen desselben AppImages nicht um einen gemeinsamen Pfad.
Fehlerdiagnose bei widersprüchlichem Abschluss um tatsächlichen/erwarteten Exitcode
und Request-ID ergänzen, ohne die Erfolgsbedingung abzuschwächen. A→C anschließend
auf neuer Kopie wiederholen; parallele Identitätsaufrufe desselben Artefakts mit
isolierten Profilen prüfen zusätzlich die Extraktionsisolation. Inotify-Limits
werden nicht global verändert. Historische AppImage-Bytes bleiben unverändert.

Extraktionskorrektur geprüft: ESLint und sechs Runner-Unitfälle 8916 bestanden;
A→C 13023 Exit 0 auf neuer Kopie. Zwei parallele C-Identitätsaufrufe 35170/85433
beide Exit 0, während A→C lief. Kein gemeinsamer TMPDIR mehr. Abschließende
Typprüfung 30263 Exit 0, git diff --check bestanden.

A/B/C-Artefakte dieses Nachweises: A 45883945c2dd3cc5e267d893fecaaf98b55085d48793d05019ad9f2bb7fccf44;
B b37be6fec9668cca8d6a3545a6c213d531e8455c459c24fa59cdc4b03ba6dd55;
C bc5911f9789a61aa2706c3f1e197f65cf70b6818038c1e8c3d0ebfcd7e65d52e.
A ist die unveränderte V3-Quellfixture; B/C besitzen die expliziten sequenziellen
V4-Aufträge. Readback-Inhalt bleibt kompatibel. Kein identischer Harness-Build
aller drei behauptet; deren individuelle Herkunft steht in jedem Manifest.

Kettenbindung zusätzlich vollständig verglichen und in
work/historical-a-b-c-chain-v4.json festgehalten: B-continuation entspricht exakt
dem erneut gelesenen B-Zwischenstand sowie der B→C-Quelle; Artefakthash identisch.
Unter B gespeicherte 1000 XP und later-work.txt werden übernommen. Beide
Einzelnachweise sind mit SHA256 gebunden. A→C-Nachweis:
work/historical-a-to-c-sequential-v4-isolated/historical-migration-evidence.json.

Plan-Audit: A→B→C mit unter B entstandener Arbeit sowie direkter Sprung A→C und
Fortsetzung/Neuladen in allen Zielständen bestanden. Roadmap-Audit weiterhin
Teilnachweise: Loot30→31, echte Migrations-/Aktivierungsabbrüche, Fehlerfälle,
Produktions-UI-Feed-Aktivierung und Restore fehlen. Keine parallele echte
Profilnutzung aus separaten TMPDIR-Identitätsaufrufen abgeleitet. Phase 5 offen;
alle gestarteten Prozesse dieses Abschnitts terminal beendet.

### Phase 5 – Original-Loot-Kohorte 30→31

Voriger Turn Fortschritt durch Kettennachweise und korrigierte Extraktionsisolation.
Originalquellen 30/31 untersucht: LootService erzeugt manuelle Schätze und
Verteilungen; Schema 31 ersetzt kopierte Itemfakten durch kanonische Referenzen.
Der existierende Integrationstest verwendet reduzierte Tabellen und ersetzt den
verpflichtenden Original-AppImage-Nachweis nicht. Schema 30 besitzt noch keine
NSC-Services der V3-Fixture; CampaignStore bietet visitCampaignDatabases, aber
noch nicht visitCampaignDatabase. Keine spätere API wird in alte Quellen kopiert.

Plan: Generischen Migrationslauf in ein gemeinsames Harness-Modul extrahieren,
mit Fachreadback als Callback. Builder bindet Worker-Profil über explizite
Fixtureauswahl aus dem gepinnten Quellkatalog (30/31→Loot, sonst Welt/Spielstand).
Eigenes Loot-Profil zunächst mit original erzeugtem manuellem Schatz, teilweiser
Verteilung und Ledger aufbauen; eigene IDs außerhalb der Datenbank als
Fixturemanifest speichern. Originalschema unverändert. Danach Generatorbestand,
Verteilung/Korrektur und archivierte Receipts ergänzen; manuelle Teilfixture ist
kein Abschluss des Loot-Nachweises. Strenger Readback mit expliziten erwarteten
Referenzänderungen; keine generische Entfernung neuer Felder. Ziel 31 liest und
bearbeitet migrierte Daten über seine eigenen Originalservices.

Statische Prüfung 88723/6718 fehlgeschlagen: die heutige CampaignStore-Typreferenz
enthält die in beiden Originalständen tatsächlich vorhandene Methode
activeCampaignDatabase nicht mehr. Korrekturplan: eigener enger Legacy-Store-Port
für die Loot-Kohorte mit den verwendeten, an Originalquellen nachgewiesenen
Methoden. Keine Ergänzung der entfernten API in produktivem aktuellem Store;
kein any-Cast. Builder bindet den Port weiterhin auf dieselbe Originaldatei.

Loot-Kohortenport korrigiert, Typprüfung/ESLint 63815 bestanden. Original-Loot30-
AppImage-Build 87638 und Seed 46653 Exit 0; Original-Loot31-Build 76437 Exit 0.
Qualify-historical-loot.ts vergleicht ausschließlich die ausdrücklich ausgewiesene
manuelle Teilfixture: kopierte Itemfakten werden in erwartete Legacy-Definitionen
überführt, IDs/Referenzen/Werte/Verteilungen und übriger Profilinhalt vollständig
verglichen. Zielservice teilt anschließend eine zweite Handkarte zu. Beide
Ledger-Einträge und Schatz müssen dieselbe erwartete Definition auflösen.

Qualifikation 55876 Exit 0; Beleg
work/historical-loot30-to31-manual-v1/historical-loot-evidence.json.
Installation und Kampagne original 30→31; Handkartenwert 250 cp und Gesamtmenge 3
bleiben erhalten. Zuteilung nach Migration von 1 auf 2 erweitert, erneut geladen;
Quellprofil unverändert. Qualifier-ESLint 69648 und abschließende Typprüfung 84787
Exit 0. git diff --check bestanden. Alle Prozesse terminal.

Plan-Audit manueller Teil: echte Erzeugung, Migration, Readback und weitere
Verteilung nachgewiesen. Roadmap-Audit: Loot-Kohorte bleibt unvollständig bis
Generatorbestand, relevante Korrekturen/Status und archivierte Receipts belegt
sind. Dafür ist Originaltest loot-vertical-slice.test.ts ab Zeile 1144 der nächste
konkrete Pfad: SessionGenerationService mit BundledEncounterCatalogProvider,
sha256EncounterEntropy, OriginaldefaultGeneratorConfig und seed 1000 erzeugt
und speichert einen echten Run; LootService.acceptGenerated übernimmt ihn.
Keine generierten Fakten als neue Fixture-SQL-Zeilen nachbilden. Die ausgelagerte
Migrationsimplementierung wird vor finaler Matrix auch für Welt/Spielstand erneut
im neu gebauten Harness ausgeführt; frühere Artefaktbelege bleiben unverändert.
Phase 5 und alle nachfolgenden Phasen bleiben offen.

### Phase 5 – Original erzeugte Beute und unveränderlicher Generatorlauf

Voriger Turn Fortschritt: manuelle Loot-Migration mit tatsächlichen 30/31-
AppImages bestanden. Aktuelle Dateien/Prozesse geprüft; keine laufenden Tests.
Plan vor Erweiterung: Original-SessionGenerationService erzeugt mit mitgeliefertem
Katalog catalog-2026-07-16, Original-Entropy, Original-Defaultpreset und Seed 1000
einen gespeicherten Run. Original-LootService.acceptGenerated übernimmt einen
nichtleeren Schatz. Eine Position wird dem Fixturecharakter zugeteilt. Run-/
Schatz-/Positions-IDs werden im Fixturemanifest gebunden. Readback enthält den
vollständigen Originalrun, übernommenen Schatz und gemeinsamen Charakterledger.

Die Originalressourcen werden innerhalb des AppImages über process.resourcesPath
angesprochen; kein Zugriff auf einen Entwicklerkatalog. Versionierte V2-Fixture
und neue Artefakte statt Überschreiben der manuellen V1-Belege. Ziel 31 liest den
migrierten Run durch seinen Original-GeneratedRunStore. Vergleiche prüfen
kanonische Referenzidentität zwischen Run, übernommenem Schatz und Ledger sowie
alle übrigen Run- und Profilfakten. Die Umwandlung der Auditprojektion wird gegen
die konkreten Originalmigrationen geprüft. Korrektur-/Archivbelege bleiben noch
verpflichtend; generierte Teilfixture allein schließt Loot nicht ab.

Typprüfung 19016 findet einen Einfügefehler: generated wurde zusätzlich im
manuellen Verteilungsauftrag vor seiner Deklaration eingesetzt. Korrekturplan:
diesen unzulässigen Zusatz nur dort entfernen; Manifestbindung nach dem
Generatoraufruf bleibt erhalten. ESLint 73410 ohne Befund. Danach Typen erneut.

Generated-V2: Loot30-Build 63459, Seed 42024, Loot31-Build 11762 Exit 0. Original-
Generator erzeugt zwei Schätze und nach Übernahme zwei Ledger-Einträge insgesamt.
Migrationsprobe 48350 Exit 1 beim Fachreadback: rewardEngineVersion reward-v1
wird vom Original-31-Vertrag (literal reward-v2) abgelehnt. SQLite-Migration allein
ist somit kein Fachlesbarkeitsnachweis. Auch der heutige Persistenzvertrag erlaubt
nur reward-v2/v3; Herkunft darf nicht auf eine neuere Engine umetikettiert werden.

Korrekturplan für Produktfehler: vollständige, vom Original-30-AppImage erzeugte
Kampagnen-DB komprimiert als synthetische Regressionfixture einfrieren, mit
Quellcommit/Artefakthash/DB-Hash und Originalrun-Readback. Auf frischer DB-Kopie
heutige Originalmigrationskette ausführen; GeneratedRunStore muss reward-v1 und
unveränderte Run-ID, Fingerprint, Erzeugungszeit, Katalog und Begegnungen lesen.
Zunächst roten Test ausführen. Persistierten Versionsvertrag dann um die konkret
bekannte reward-v1 ergänzen; neue Erzeugung bleibt auf reward-v3 beschränkt und
unbekannte Versionen bleiben ungültig. Weitergehende Differenzen separat erfassen.
Historisches 31-Artefakt bleibt unverändert als reproduzierbarer Fehlerbeleg.
Dieser Befund macht für die Abnahme einen korrigierten aktuellen Zielcommit nötig;
kein Patch in die als Original deklarierten 30/31-Quellen.

Regression 73829 ist erwartungsgemäß rot: heutiger GeneratedRunStore lehnt den
Original-run nach vollständiger heutiger Schema-Migration allein wegen reward-v1
ab. Keine native ABI-/Testumgebungsstörung. Jetzt die geplante enge Erweiterung
des persistierten Versionsvertrags ausführen und denselben Test wiederholen.

Produktkorrektur implementiert: persistierter rewardEngineVersionSchema akzeptiert
jetzt reward-v1/v2/v3. Erzeugungsverträge bleiben literal reward-v3; unbekannte
Versionen werden abgewiesen. Regression mit eingefrorener Originaldatenbank sowie
bestehender GeneratedRunStore-Suite: 16105 Exit 0, fünf Tests bestanden. Der Test
prüft ausdrücklich, dass reward-v1 unverändert in SQLite bleibt und nicht als
aktuell generierter Run akzeptiert wird. ESLint und abschließende Typprüfung
95559 Exit 0; git diff --check bestanden.

Neue synthetische Fixture tests/fixtures/historical-loot30: vollständige DB
komprimiert (28 KiB), Originalrun (12 KiB), Provenienz und Nutzungshinweis.
Original-AppImage-SHA256
2e0c1d71e1336dce02e89f424cf191c68bd116b47d17175eee2e2d5ba7297dfc;
unveränderte DB-SHA256
d22c3fbf49a9f05b371a89038c1e9c507a9ee3a8405b5a344203edd05f1b32da.
Readback-Provenienz im Fixturemanifest. Kein Nutzerprofil verwendet.

Plan-Audit: Generatorfixture erzeugt; realer Kompatibilitätsfehler reproduziert,
heutiger Persistenzvertrag korrigiert und native Regression bestanden. Vollständiger
kanonischer Referenzvergleich des generierten Bestands, Ledger-Korrekturen und
Receiptarchiv fehlen noch. Original-31-AppImage bleibt erwartbar inkompatibel;
sein gescheiterter Readback ist kein qualifizierter Releasevergleich. Der korrigierte
aktuelle Stand muss auf einem unveränderlichen Candidate-Commit neu gebaut und
mit diesem Original-30-Profil tatsächlich qualifiziert werden. Eine Relabelung
oder Änderung historischer Originalquellen ist ausgeschlossen.
Roadmap-Audit: Phase 5 weiterhin offen; Produktkorrektur noch nicht kanonisch
übergeben. Keine laufenden Tests/Builds am Ende dieses Abschnitts.

### Phase 5 – Vollständige Loot-Referenzen und archivierte Befehlsbelege

Voriger Turn Fortschritt: echter reward-v1-Readbackfehler behoben und Regression
mit Originaldatenbank bestanden. Plan: Originalprofil-Readback ergänzend zum
bereits eingefrorenen Run unverändert/hashgebunden ablegen; DB und Run unverändert
lassen. Test vergleicht sämtliche generierten Itemdefinitionen und -positionen,
übrige Generatorlaufdaten sowie übernommenen Schatz und Ledger gegen ausdrücklich
abgeleitete Referenzumwandlung. Alle historischen Receipts vor der Migration
vollständig lesen, anschließend das Archiv byte-/feldgleich vergleichen. Danach
über CharacterLootStore einen empfangenen Eintrag als verkauft korrigieren und
Original/Korrekturverkettung, Gegenstandsreferenz, Werte und erneutes Lesen prüfen.
Der Archivevergleich wird nach Weiterarbeit erneut verlangt. Kein Nachbau alter
Tabellen und keine Umbenennung der Generatorherkunft. Dies ist eine native
fachliche Regression; das noch ausstehende neue AppImage ersetzt sie nicht.

Vollvergleich 84449 scheitert gezielt am übernommenen Schatz: historisches
provenance.catalogEntry wird in der aktuellen Projektion bei generated-Referenz
null. Ownerbefund LootStore.project Zeilen 320ff: Katalogreferenzen werden nur
für direkte catalog-Referenzen projiziert; generierte Definitionen tragen die
ursprüngliche Katalog-ID in components.baseItemId. Bereits verglichener vollständiger
Run/Definitionen ist identisch. Korrekturplan Vergleich: originale catalogEntry-ID
und Art ausdrücklich gegen die zugehörige Definition prüfen, dann genau dieses
redundante Projektionsfeld auf null erwarten. sourceLineId bleibt erhalten. Keine
pauschale Entfernung der Provenienz und keine unbelegte Annahme von Datenerhalt.

Vergleichskorrektur 32613 findet einen Adapterfehler: Zod-Projektion der alten
Provenienz enthielt noch nicht catalogEntry und entfernte dieses vor der Prüfung.
Korrekturplan: das vorhandene nullable Katalogfeld ausdrücklich in diesen engen
Quellvertrag aufnehmen; Referenzvergleich unverändert beibehalten und wiederholen.

67717 entdeckt einen weiteren Einfügefehler: die nur für Schatzpositionen gedachte
Provenienztransformation wurde auch in den Ledger-Mapper eingesetzt. Korrekturplan:
ausschließlich diesen Ledger-Zusatz entfernen; Ledgerprovenienz bleibt vollständig
unverändert. Die Schatztransformation und ihr Katalog-ID-Nachweis bleiben bestehen.

56018 besteht den vollständigen nativen Vergleich samt Korrektur und Archiv.
Typprüfung 55984 beanstandet die nicht ausdrücklich typisierte characterId im
Ledger-Erwartungswert. Korrekturplan: vorhandene characterId und revision im
Quell-Ledgervertrag explizit validieren statt dynamischen Feldzugriff zu casten.
Zusätzlich den korrigierten Stand nach Schließen/Neuöffnen der SQLite-Verbindung
lesen, damit die Prüfung über einen neuen Store hinaus persistente Daten abdeckt.

Vollständiger nativer Nachweis abgeschlossen: 72418 Exit 0, sechs Tests über
Historical-Generated-Loot-, Loot31-Migrations- und GeneratedRunStore-Suites.
Erwartungsvertrag historical-loot-expectations.ts vergleicht alle Run-Felder,
sechs generierte Positionen/Definitionen, manuelle und übernommene Schätze sowie
zwei Ledger-Einträge. Katalogherkunft ist in der Definition ausdrücklich gebunden.
Alle vier alten Loot-Receipts stimmen nach Migration und nach Weiterarbeit exakt
mit dem Archiv überein. Verkaufskorrektur erhält Originaleintrag und verknüpften
Korrektureintrag; nach Schließen und neuer SQLite-Verbindung unverändert lesbar.
Originalgeneratorlauf bleibt auch nach Korrektur vollständig unverändert.
ESLint und Typprüfung 8530 Exit 0; git diff --check bestanden.

Plan-Audit dieses nativen Abschnitts bestanden. Originalprofil-Readback ergänzt
und via profileSha256 gebunden; zuvor eingefrorene DB/Runbytes unverändert.
Roadmap-Audit: Abnahme im korrigierten aktuellen AppImage weiterhin offen. Der
Legacy-Loot-Harness verwendet activeCampaignDatabase und Funktionszugriff, die
heutige CampaignStore-/LootService-Schnittstelle nicht mehr anbietet. Vor dem
neuen Artefaktnachweis einen ausdrücklichen Harness-Adapter über den in allen
betroffenen Versionen vorhandenen visitCampaignDatabases-Owner-Scope vorsehen;
aktuelle Services benötigen SqliteDatabaseAccess.use. Originalquellen unverändert
lassen. Neuer aktueller Quellcommit muss die reward-v1-Korrektur enthalten und
unveränderlich gebaut werden. Diese Adapter-/Artefaktarbeit ist noch nicht getan.
Phase 5 offen, keine laufenden Prozesse.

### Phase 5 – Aktueller Loot-Artefaktadapter

Voriger Turn Fortschritt durch vollständigen nativen Referenz-/Archiv-/Korrektur-
Nachweis. Checkout und Prozesszustand erneut bestätigt. Plan: Loot-Harness führt
alle Datenbankarbeiten innerhalb visitCampaignDatabases aus und wählt darin nur
die aktive Fixturekampagne. Kein Database-Handle verlässt den Callback. Ein
expliziter Testzugriff unterstützt sowohl den historischen Funktionsaufruf als
auch das heutige SqliteDatabaseAccess.use; beide sind auf den geöffneten Owner-
Scope begrenzt. Builder erhält validierte optionale --fixture-Auswahl, damit ein
aktueller unveränderlicher Quellcommit mit dem Loot-Readback gebaut werden kann.
Ausgewählte Fixture wird im Artefaktmanifest dokumentiert. Eine aktuelle Loot-
Neuerzeugung mit alten Itemeingaben wird nicht behauptet; Seed bleibt für Schema30.
Gezielte Tests prüfen aktive Auswahl, Fehler ohne aktive Kampagne sowie Ablauf und
Scope des Adapters. Danach Typen/Lint und kanonischen Candidate-Zwischenstand für
das neue Originalquellen-Artefakt vorbereiten; Phase 5 dabei nicht schließen.

Adapter implementiert und geprüft: Owner-Callback statt herausgereichtem aktivem
DB-Handle; kompatibler Callable/use-Testzugriff; explizite validierte Builder-
Fixtureauswahl im Manifest; Legacy-Seed verlangt Schema30. Typprüfung 29100,
Adapter-/Originaldatenbanktests 93295, breites ESLint/Typprüfung 98649 und gezielter
Checkpoint-Testlauf 63004 Exit 0. Keine laufenden Prozesse.

Plan-Audit Adapter: implementiert und lokal geprüft. Roadmap-Audit: aktueller
Artefaktlauf und gesamte restliche Phase 5 weiter offen. Jetzt den bestehenden
Phase-5-Zwischenstand einschließlich reward-v1-Produktkorrektur auf dem vorhandenen
Candidate-Branch festhalten und dort prüfen lassen. Dieser Commit ist ein
unveränderlicher Ausgangspunkt für weitere Qualifikation, kein Phasenabschluss
und keine Freigabe auf Main. Keine Veränderung realer Installationen vorgesehen.

Candidate-Zwischenstand 1703c25c96366a7ff76d1d119b2250afcbf35690 committed und
auf candidate/release-artifact-qualification gepusht; ursprünglicher Checkout
anschließend sauber. Draft-PR 672 eröffnet, weil Check ausschließlich auf PRs
und Main-Push reagiert. Vollständiger Check-Lauf 34329224274 für exakt diesen SHA
ist queued bestätigt; kein CI-Erfolg und kein Handoff behauptet.

Nächster konkreter Schritt: diesen Commit als neuen gepinnten Quellkatalogeintrag
corrected (42/41) aufnehmen und mit --fixture loot in neuem Artefaktverzeichnis
bauen. Historischer current-Eintrag bd8b33c bleibt unverändert als vorheriger
Vergleichsstand. Der Builder verwendet den gepinnten vollständigen Commit, keine
Arbeitskopie der Produktquellen. Lokale Artefaktqualifikation verändert keine
reale Installation und ersetzt das vollständige Candidate-/Handoff-Gate nicht.

Corrected-Loot-AppImage aus 1703c25c erfolgreich gebaut (14341 Exit 0).
CI Portable-Job 102393613684 scheitert ausschließlich an Prettier für den
hashgebundenen Original-Readback source-profile.json; übrige CI-Jobs laufen noch.
Korrekturplan: die beiden bytegenau eingefrorenen Original-Readbacks gezielt von
Formatierung ausnehmen, analog zu bereits ausgenommenen generierten Ressourcen.
DB-/Readback-Provenienz und Integrationstest bleiben verbindlich; keine Umformatierung
und kein Neuberechnen des Originalhashes. Alle übrigen Dateien weiter formatprüfen.
Danach Probe mit dem bereits gebauten korrigierten Loot-AppImage ausführen.

Formatterkorrektur 78286 Exit 0: vollständiger Prettier-Check besteht, eingefrorene
Readbackbytes unverändert. Korrigiertes Loot-AppImage (Originalquellcommit 1703c25c)
hat SHA256 5d0bf81ae71d7d891a064485e88cc46cc4bb4aeeca324bf69205587243005be9.
Probe 29781 Exit 0: Originalkampagne 30→41, Installation 30→42 und vollständiger
Loot-/Generator-Readback im aktuellen AppImage erfolgreich; reward-v1 bleibt erhalten.
Probeausgabe work/roadmap-phase5-migrate-loot-corrected-v3-probe.log und
Runtime-Receipts unter work/historical-loot30-to-corrected-v3-probe. Dieser Probe
fehlt noch der gesamte erwartete Profilvergleich samt weiterer Bearbeitung und
separatem Neustart; nicht als vollständige Artefaktabnahme gewertet.

Plan-Audit: Adapter funktioniert auch im tatsächlichen korrigierten AppImage.
Roadmap-Audit: kontrollierter Feed/UI-Aktivierung, Fehler-/Abbruchmatrix und Restore
weiter offen. Vollständiger generierter Loot-Artefaktqualifier muss den bereits
nativen Erwartungsvertrag plus explizite Installation-/Partyformat-Ergänzungen
verwenden. Erst danach diesen Bereich schließen. Jetzt gezielte Formatterausnahme
und gepinnte corrected-Quellidentität als Folgecommit pushen; neue CI muss den
neuen SHA prüfen. Keine Main-Promotion/Handoff in diesem Abschnitt.

### Phase 5 – Vollständiger generierter Loot-Artefaktvergleich bis 42/41

Voriger Turn Fortschritt: Adapter, immutable Candidate/Draft-PR und erfolgreicher
korrigierter AppImage-Readback. Check 34329574327 für 462c7a45 ist weiterhin pending
bestätigt, nicht beendet. Aktueller Checkout sauber. Plan: neuer Qualifier nutzt
das bestehende vollständige Loot-Erwartungsmodell und ergänzt exakt die anhand
Originalmigrationen geprüften Profiländerungen 30→42/41: fünf Stufe-3-Mitglieder
mit untrusted Burden/1200, Registryrevision 0 und lastOpenedAt null, Settingsrevision
+2 (altes Sessionlayout und spätere Desktopumstellung), Theme erhalten. Nur das
bekannte Standardlayout zulassen. Alle übrigen Profilfelder vollständig vergleichen.

Danach Originalzielservice teilt eine weitere manuelle Karte zu. Vergleich erlaubt
nur deklarierte Schatz-/Ledgerrevision, Zuteilungsmenge/-wert, Änderungszeit und
einen neuen Ledger-Eintrag; Generatorlauf, eigener Inhalt und vorhandene Einträge
bleiben exakt gleich. Anschließend eigener neuer Prozess für Readback; Quelle
ebenfalls erneut unverändert lesen. Aktuelle Artefaktbytes wiederverwenden, neue
Arbeitskopie. Unitfälle schützen die enge Profilumwandlung vor stiller Normalisierung.

### Phase 5 – Korrekturrunde: aktive Loot-Befehlsbelege nach Migration

Erneut geprüft: der vollständige AppImage-Lauf in
work/roadmap-phase5-generated-loot-full-artifact.log scheitert beim Weiterarbeiten
mit `no such table: loot_operation_receipt`. Die Migration 30→31 archiviert die
alten Belege; bereits auf 41 migrierte Profile können ohne aktive Belegtabelle
vorliegen. Der bisherige native Korrekturtest umging den Befehlsservice und war
für diese Fortsetzbarkeit zu schwach. Kein vollständiger Phasennachweis.

Korrekturplan vor Produktänderungen: Regression mit der unveränderten originalen
Schema-30-Fixture über LootService.distribute einschließlich Wiederholung und
Neustart ergänzen. Fehlverhalten zuerst reproduzieren. Die kanonische Tabellen-
initialisierung zum LootOperationJournal verschieben und sowohl für frische DBs
als auch in einer neuen Vorwärtsmigration 41→42 verwenden. Historische Migration
30→31 nicht umschreiben. Bestehende aktive und archivierte Belege erhalten;
Registryversion von 21 auf 22 erhöhen. Neu benötigte Erwartungen gezielt anpassen,
gepinnte historische Quellidentitäten unverändert lassen. Native Migrationstests,
Versionstruth und Typprüfung durchführen; danach neues unveränderliches Ziel-
artefakt für den vollständigen Lauf vorbereiten. Produktionsaktivierung, gesamte
Fehlermatrix und restliche Phasen bleiben weiterhin offen.

Check 34329574327 aktuell noch in_progress; Portable fehlgeschlagen, beide
plattformnativen Jobs und verpackter Harness erfolgreich. Fehlerursache vor
nächstem Candidate-Push ermitteln; kein Handoff aus unvollständigem Check.

Regressionsbefund: RED-Lauf 99940 Exit 1 reproduziert exakt die fehlende aktive
Tabelle im echten DistributeLootCommandHandler. Nach neuer 41→42-Migration besteht
51822 Exit 0 einschließlich Befehlswiederholung und Neustart. Erweiterter Lauf
16487: 23 Tests bestanden, zwei alte Erwartungen in combined-schema-35-migration
verlangen weiterhin 41 statt aktuellem 42; Versionstruth und Typecheck bestanden.
Korrekturplan: ausschließlich Assertions auf den aktuellen Endstand in den sieben
betroffenen Migrationstests aktualisieren; historische Eingangsstände und gepinnte
Artefakte unverändert lassen. Neuer Loot-Qualifier muss Ziel 42/42 verlangen.

Erweiterte Prüfung 33681 Exit 0: 101 Tests in elf Dateien bestanden. Neue
Vorwärtsmigration erhält bestehende aktive Belege und alle vier historischen
Archivbelege; Verteilen ist nach Neustart idempotent. Lint und Formatprüfung
78273 Exit 0; git diff --check sauber. Plan-Audit dieser Reparatur lokal erfüllt,
Roadmap-Audit weiterhin offen bis neues tatsächliches Zielartefakt qualifiziert ist.

Portable-Joblog 102394928389 jetzt direkt abgerufen: zwei Fehler in
version-truth.test.ts, da die reward-v1-Erweiterung noch nicht im erwarteten
Lesbarkeitsvertrag und Dokument abgebildet war. Dokument bereits im aktuellen
Versionsabgleich korrigiert. Fixplan: erwartete explizite Liste um reward-v1
ergänzen; Unknown-Version-Ablehnung und aktuelle Generatorversion unverändert
prüfen. Gezielt Versionstruth-/historische Unitfälle erneut ausführen.

Versionstruth-Unitlauf 33211 fand zusätzlich die explizite alte Kampagnenpfad-
erwartung 41. Im Rahmen des aufgezeichneten Endstand-Abgleichs auf 42 samt
vollständigem Pfad korrigiert. Wiederholung 22765 Exit 0: fünf Unitfälle bestanden.
Keine lokale Prüfung läuft mehr. Nächster Schritt: aktuellen Reparaturstand
als Candidate-Commit sichern, vollständigen Check auslösen und ihn als neuen
unveränderlichen 42/42-Zielstand für die AppImage-Qualifikation verwenden.
Historische Artefakte bleiben unverändert. Main und reale Installation unberührt.

### Phase 5 – Unveränderliches Reparaturartefakt 42/42

Voriger Turn war Fortschritt: neue Vorwärtsmigration samt 106 gezielten Tests.
Vollständiger Formatcheck 7934 Exit 0. Reparatur jetzt als
6d7889ca451762259bc4f472851c893bce57e1e0 auf dem Candidate gepusht (17125 Exit 0),
Checkout danach sauber; vollständige CI noch nicht als bestanden behauptet.

Plan: neuen Quellkatalogeintrag repaired mit genau diesem SHA und 42/42 ergänzen.
Als Loot-Testartefakt 0.0.145 in neuem Verzeichnis repaired-loot-v4 bauen. Originale
source30-Bytes wiederverwenden; vollständigen Qualifier auf neuer Arbeitskopie
laufen lassen. Erfolg verlangt vollständigen Profilvergleich, zusätzliche
Verteilung, separaten Prozessneustart und unveränderte Quelle. Erst dieser Lauf
kann den vormals fehlgeschlagenen AppImage-Fall schließen; Produktionstransport,
Aktivierung und Restore bleiben gesonderte Anforderungen der Phase 5.

Reparaturartefakt gebaut: 87568 Exit 0. Vollständiger ursprünglicher Loot-Fall
56947 Exit 0, Nachweis
work/historical-loot30-to-repaired-v4-full/generated-loot-migration-evidence.json.
Originalprofil 30→42/42 vollständig verglichen, weiter verteilt, neuer Prozess
liest dieselben Daten, Originalquelle erneut unverändert. Der konkrete Fehler
mit fehlender aktiver Belegtabelle ist damit auch im tatsächlichen AppImage behoben.
Plan-Audit Reparaturartefakt bestanden; Roadmap-Audit Phase 5 weiter unvollständig.

### Phase 5 – Vorbereitung des tatsächlichen UI-Updatewegs

Quellinspektion: historischer Stand c583e055 besitzt noch keine Releaseoberfläche;
er eignet sich nicht für einen behaupteten UI-Updatetest. Der vorhandene
qualify-release-update.ts ruft Controller direkt auf und prüft nur Namen/Text.
Nächster UI-Vergleich verwendet den tatsächlichen Main-Stand bd8b33c (42/41)
gegen reparierten Stand 6d7889ca (42/42), plus historisch qualifizierte Daten.

Plan vor Änderungen: im externen historischen Test-Harness einen ausdrücklich
aktivierten UI-Modus ergänzen, der vor Start der unveränderten Originalapp nur
GitHub-Requests auf einen Loopback-Testfeed umleitet und einen dynamischen
Debuggingport für echte Eingabeereignisse öffnet. Normale Starts bleiben ohne
Testmodus unverändert. Absolute isolierte XDG-Pfade, Loopback-URL und expliziter
Opt-in sind zwingend; vorhandener Headless-Qualifikationsmodus bleibt getrennt.
Kein direkter Aufruf von Update-/Restore-Controllern aus dem UI-Driver.

Darauf aufbauend zwei neue unveränderliche Testartefakte erstellen, vollständige
Originaldaten seed/read über die zugehörigen Utility-Harnesses, reale Fenster-
Aktionen check/download/install/restart/continue/restore; jeden Prozess bis zum
Ende verfolgen, Artefakt- und Feedhashes im Nachweis binden. Historische Ketten,
Faultmatrix und veröffentlichte Bytes bleiben eigene Anforderungen. Dieser Plan
ist Vorbereitung; UI-Nachweis ist noch nicht implementiert oder bestanden.

UI-Transportadapter implementiert. 99061 Exit 0: 21 Unitfälle (Konfiguration,
Routing und unveränderliche Quellidentitäten) und vollständige Typprüfung bestehen.
Der Adapter wird ausschließlich bei explizitem HISTORICAL_UI-Opt-in aktiv; ein
parallel aktivierter bisheriger Headless-Updater wird abgewiesen. Er übergibt
Originalrequests außerhalb GitHub unverändert und bewahrt Signal/Header bei
umgeleiteten Requests. Noch kein gestarteter UI-Updatefall und kein UI-Erfolg.

Nächste konkrete Artefakte für den UI-Fall: current-ui-world-v5 Version 0.0.146
(Original bd8b33c, 42/41) und repaired-ui-world-v5 Version 0.0.147 (Original
6d7889ca, 42/42), beide mit demselben externen World-/UI-Harness. Der bestehende
Livetestbestand mit Reise/Kampf/eigenen Dateien ist Ausgangspunkt des geplanten
Profilvergleichs. Lint 99020 Exit 0. Vor den neuen Builds zunächst diesen
Harnessstand sichern; kein Abschluss der Phase und keine Main-Promotion.

Korrektur der unmittelbar vorherigen Lint-Aussage: 99020 beendete die Shell mit
Exit 0 wegen nachfolgender Dokumentationsbefehle; die Lintdatei enthält tatsächlich
einen no-base-to-string-Fehler im neuen Test. Kein Lint-Pass. Fixplan: das erwartete
URL-Objekt direkt vergleichen statt einen Request/URL/String-Unionwert implizit
zu stringifizieren. Lint anschließend als alleinigen Abschlussbefehl prüfen.

Lintwiederholung 4824 Exit 0, anschließender gezielter UI-Feed-Unitlauf Exit 0.
Plan-Audit des Transportadapters bestanden; echter UI-Lauf weiterhin offen.
Harnessstand einschließlich gepinnter Reparaturquelle jetzt als Folgecommit
auf Candidate sichern. Keine Änderung an den bereits qualifizierten Artefakten.

Beide UI-Testartefakte gebaut: 59573 und 23101 jeweils Exit 0. Danach neuen
DOM-/CDP-Driver und ersten ausführbaren Abschnitt des UI-Qualifiers ergänzt:
Originalprofil erzeugen, Arbeitskopie, prüfen/download/install durch reale
Mauseingaben, Zielneustart und vollständiger Readback im Ziel-AppImage. Explizite
Negativassertions verhindern, dass automatische Downloads oder Aktivierung beim
Download als Erfolg gelten. Der Nachweis kennzeichnet fehlende Weiterarbeit und
Restore ausdrücklich; diese folgen im selben Phase-5-Ablauf nach erfolgreicher
Prüfung dieses Abschnitts. Controller werden nicht direkt aufgerufen.

Typprüfung 34912 Exit 2: TypeScript inferiert das zusammengesetzte env-Objekt zu
eng für das Entfernen von ELECTRON_RUN_AS_NODE. Korrekturplan: expliziten
NodeJS.ProcessEnv-Vertrag am Prozess-Environment verwenden; Verhalten unverändert.

UI-Erstabschnitt 97097 Exit 0: realer Ablauf check/download/install/restart mit
0.0.146→0.0.147 und Kampagnenschema41→42, danach kompletter Ziel-Readback gleich
Original sowie unveränderte Quelle. Nachweis work/historical-ui-update-v5/
ui-update-evidence.json; Transaktion e8c71d7f-2c23-41fa-bd43-3cff11ece5ba committed.
Typprüfung 44703 und Lint 96528 jeweils Exit 0. Kein Restore-Nachweis bisher.

Fortsetzungsplan: Zielversion erneut normal öffnen, Charakterfenster und XP-Popup
über echte Eingaben bedienen, Mara 1 um 25 XP erhöhen, schließen und im separaten
Zielprozess persistierte Änderung prüfen. Erwartungsvertrag erlaubt ausschließlich
Partyrevision +1 und XP/Rastzähler +25 in aktiver Kampagne und deren Sessionprojektion.
Danach UI-Wiederherstellung der einzigen Vor-Update-Sicherung bestätigen. Neuer
Restorejournal muss eigene Sicherung der späteren Arbeit referenzieren; diese auf
separater vollständiger Profilkopie durch Ziel-AppImage lesen und mit späterem
Stand vollständig vergleichen. Wiederhergestelltes Profil muss Original entsprechen,
Zielprogramm bleibt unverändert, neue Vorwärtsmigration erfolgt bei Restore.

Lauf 4525 noch aktiv. Read-only DOM-Inspektion des tatsächlich gestarteten Fensters
zeigt die Kampagnenauswahl mit genau einem Fortsetzen-Button; der Driver wartet
bereits auf die erst danach sichtbare Charaktertoolbar. Konkreter Fixplan nach
terminalem Lauf: Fortsetzen als echte UI-Aktion vor dem Charakterfenster ergänzen.
Das ist fehlende Testnavigation, kein Nachweis eines Produktfehlers. Quellen
während des laufenden AppImage-Tests nicht ändern.

CI-Job102401426977 meldet drei veraltete Erwartungen: current-format-manifest
verlangt Kampagnenschema41, Golden-Master-Preflight Registry21/Schema41. Plan nach
Laufende: ausschließlich aktuelle Manifestzielversion und aktuelle Endstand-
erwartungen auf42/22 aktualisieren; originale Golden-Masterbytes unverändert.
Das Manifest ist ausdrücklich eine vorläufige Current-Format-Referenz und keine
historische Releasefixture oder abgeschlossene RP-Abnahme. Gezielte Unitfälle
und vollständige CI müssen den aktualisierten Stand erneut prüfen.

4525 terminal Exit 1 mit genau dem erwarteten Navigations-Timeout; eigene
Appprozesse beendet. Fortsetzen ergänzt. Quellprüfung zeigt zusätzlich:
CampaignRegistryRepository.setActive aktualisiert last_opened_at und die Registry-
revision. Der historische Readback enthält keine Registryrevision, aber explizite
Zeitstempel. Erwartungsvertrag für diese echte Benutzeraktion deshalb erweitern:
ausschließlich aktiven lastOpenedAt auf den beobachteten, innerhalb des Eingabe-
intervalls liegenden ISO-Zeitpunkt setzen; alle übrigen Registryfelder unverändert.
Keine pauschale Normalisierung von Zeitstempeln oder unbekannten Feldern.

Wiederholung 41529 Exit 1: echte UI-XP-Eingabe erfolgreich, 1000 XP nach Neustart
persistiert. Vollvergleich meldet ausschließlich unveränderte Rastzähler statt
der angenommenen +25. Quellprüfung von applyXpAdjustment erforderlich, bevor der
Erwartungsvertrag angepasst wird; keine Änderung an Produktsemantik anhand des
Testergebnisses. Restore wurde wegen des strikten Vergleichs noch nicht gestartet.

Quell-/Anforderungsabgleich: applyXpAdjustment erhält shortXp/longXp bewusst;
party-burden.test.ts prüft unveränderte Zähler für alle manuellen XP-Modi, und
requirements-party-dropdown.md verweist auf korrigierte manuelle XP-Semantik.
Die +25-Annahme des neuen Qualifiers war falsch. Fixplan: XP +25 und Revision +1
weiter verlangen, Rastzähler exakt unverändert vergleichen. Keine Produktänderung.

### Phase 5 – Erster vollständiger UI-Update-/Restore-Nachweis

Lauf 24891 Exit 0, evidence work/historical-ui-update-restore-v7/
ui-update-evidence.json. Reale UI-Eingaben: prüfen, herunterladen, bestätigen,
Installation und Zielneustart; erneut öffnen, Kampagne fortsetzen, Mara 1 +25 XP
speichern; erneut öffnen, ganze Vor-Update-Sicherung wiederherstellen und Ziel-
neustart. Unabhängige eigene AppImage-Prozesse lesen vollständigen Ausgangs-,
Update-, Weiterarbeits-, Restore- und Sicherungsstand. Die Quelle bleibt unverändert.
Rastzähler bleiben entsprechend aktueller manueller XP-Semantik unverändert.

Vor-Update-AppImage SHA256
639b0d4d797261f2fbc6ff3e27786d2f0562ea1598b577113c763582d876c5f9,
Ziel-AppImage SHA256
3e143eee43b745eb61f425c6e623d7ee3726bb14f91171c71eb4094bb556724c.
Restore773dca7c-f985-4c49-b8b2-395163389f28 committed, zusätzliche Sicherung
16791f9b-6ba1-47ca-a5e8-98cbd8785648 enthält vollständig die spätere Arbeit.
Zielprogramm bleibt beim Restore identisch, Originalschema41 wird vorwärtsmigriert.

Plan-Audit dieses UI-Ablaufs bestanden. Roadmap-Audit Phase5 bleibt offen:
Prozessabbrüche in Migration/allen Aktivierungs-/Recoverygrenzen, volle Platte,
Zugriffsfehler, WAL/Parallelstart/beschädigter Download und fehlende/neue Formate
müssen noch in der abschließenden echten Artefaktmatrix belegt werden. Dieser
Erfolg ersetzt weder diese Matrix noch Main-Handoff oder manuellen Livetest.
18 CI-Regressionsunitfälle11952 bestanden; Golden-Masterbytes unverändert.

Nachweisbindung des erfolgreichen Laufs:
Report SHA256 492f97ea40b8dd9e7ca232c62d9ea97f1013fb731a00b20f23abb518ee40af90;
Qualifier SHA256 10e38f3419dc9fce017a1362a7559cf85600ceddce1c3e6413b9c65ce359ab8e;
UI-Driver SHA256 68ddbdd52b958ba8ed76a1438b26d0280e19f8aeb2146b4d636ef7a0e433134e.
Update c27228c5-edd6-46f0-806c-b9d2fd962836. Lint6458 Exit0.

### Phase 5 – Echte Transportfehler vor erfolgreichem UI-Update

Voriger Turn Fortschritt: kompletter UI-Update-/Restore-Nachweis, Stand567cb13c
gepusht, aktuelle CI34333006569 pending bestätigt. Checkout sauber.

Plan: optionalen --transport-failures-Modus in bestehenden UI-Qualifier integrieren.
Erster Feedversuch liefert HTTP503; UI muss verständlich fehlschlagen und normales
Beenden/erneutes Öffnen und vollständigen eigenen Baseline-Readback erlauben.
Danach unverändertes Manifest, aber einmal gleich große AppImage-Bytes mit einem
gekippten Byte und einmal abgeschnittene Bytes ausliefern. Nach jedem Fehler:
Fehlermeldung sichtbar, kein Installationsbutton, keine aktive oder partielle
Cachedatei, keine Wartungstransaktion, vorheriges Deployment unverändert;
App schließen, vollständiger Baseline-Readback muss Quelle entsprechen.
Anschließend dasselbe echte Artefakt korrekt herunterladen und den gesamten
bereits qualifizierten UI-Update-/Weiterarbeits-/Restoreweg durchlaufen. Keine
Änderung der gespeicherten Artefaktbytes. Neue Arbeitskopie und eigener Nachweis.
Dieser Modus ersetzt nicht WAL-, Kapazitäts- oder Prozessabbruchprüfungen.

Transportfehlermatrix53227 Exit0. HTTP503, gleich große korrumpierte Datei und
abgeschnittener Download wurden im echten Baseline-AppImage sichtbar abgewiesen.
Nach jedem Fehler eigener vollständiger Baseline-Readback gleich Quellprofil,
keine Cache-/Partialdatei, kein Wartungsjournal und unverändertes Deployment.
Danach kompletter UI-Update-/Weiterarbeits-/Restoreweg bestanden. Nachweis:
work/historical-ui-transport-failures-v1/ui-update-evidence.json,
SHA256 dbafa3ce6a35a535d45d12bb13f06453d8d69035a11f072d411c3e4fe1420a9a.
Update7393cffb-2541-4140-9025-4eaa0e1d3d0c, Restore210ae205-5b9e-4082-aefd-ac00e869d5c7.
Typprüfung45177 und Lint27286 Exit0. Plan-Audit Transportfälle bestanden.

Roadmap-Audit weiter offen für restliche Phase5 sowie Phasen6–7. Abnahmematrix
jetzt mit diesen Nachweisen aktualisieren, damit alte Bestandsaufnahme nicht
mehr die neuen Artefaktläufe als fehlend bezeichnet. Fehlende Abbruch-/Kapazitäts-
Nachweise weiterhin explizit lassen. Unshare-Usernamespace-Probe funktioniert;
ein isoliertes begrenztes Dateisystem ist als nächste Kapazitätsprüfung möglich,
aber noch nicht aufgebaut oder als ENOSPC-Nachweis gewertet.

### Phase 5 – Harter Abbruch nach bestätigter Nutzung

Plan: separaten --accepted-crash-Fall zum selben realen UI-Qualifier hinzufügen.
Nach erfolgreichem Update und eigenständig verifiziertem späterem XP-Stand die
Ziel-App normal öffnen, Bereitschaft über sichtbare Einstellungen prüfen, dann
nur Prozesse mit dem einmaligen Test-XDG-Root per SIGKILL beenden. Exit-Signal des
vom Driver gestarteten Prozesses explizit belegen; normale Starts weiter Exit0
verlangen. Anschließend normalen Zielstart einschließlich Recovery ausführen,
schließen und vollständigen eigenen Ziel-Readback mit späterem Stand vergleichen.
Journal muss committed bleiben; kein Rücksprung auf Vor-Update-Daten. Danach
wie bisher explizite Wiederherstellung und Sicherung späterer Arbeit prüfen.
Dieser Fall qualifiziert ausschließlich Absturz nach Freigabe, nicht Abbrüche
innerhalb der Migration oder der noch nicht bestätigten Aktivierung.

88583 terminal Exit1. Korrektur zur vorherigen Zwischeninterpretation: nicht der
Einstellungsklick scheiterte, sondern der anschließende Browser.close-Aufruf
beendete nach dem Neustart nicht alle Appprozesse. Die Zeile395 und terminale
Fehlermeldung belegen das; Einstellungen und Zielversion waren vorher geprüft.
Der abschließende Cleanup beendete die Testprozesse, kein Datenverlustnachweis.

Fixplan für den Driver: den tatsächlich verbundenen Renderer-Target explizit
über Target.closeTarget schließen, damit das Electron-Fenster den normalen
window-all-closed/quit-barrier-Pfad durchläuft. Target-ID aus derselben überprüften
DevTools-Page übernehmen, Erfolg oder Socketende prüfen und weiterhin alle
Prozessenden abwarten. Keine Lockerung des Exit-/Datenvergleichs und kein
SIGTERM als erfolgreicher regulärer Beenden-Ersatz. Danach vollständigen
accepted-crash-Fall auf frischer Arbeitskopie wiederholen.

Parallel zur laufenden unveränderten AppImage-Prüfung eine isolierte Kapazitäts-
Umgebung geprüft: eigener User-/Mount-Namespace mit 1MiB tmpfs, Schreiben von2MiB
liefert echtes ENOSPC(errno28), Mount und temporärer Ordner danach entfernt.
Keine Füllung des Host-Dateisystems. work/roadmap-phase5-capacity-probe.log, Exit0.
Dies qualifiziert die spätere Fehlerumgebung, noch keinen App-Backup-/Updatefall.

48961 ebenfalls terminal Exit1 am normalen Beenden nach dem akzeptierten Absturz.
Target.closeTarget beseitigt den Fehler nicht. Kein weiterer Wiederholungslauf
mit bloß verändertem Timeout. Nächster Diagnoseschritt: im isolierten fehlgeschlagenen
Profil einen Start mit Main-Inspector beobachten, Fensterbestand und Quit-Lifecycle
vor/nach demselben Close-Aufruf read-only erfassen. Anschließend ausschließlich
diese Diagnoseprozesse beenden. Erst anhand dieses Befunds weitere Korrektur planen.

Main-Inspector-Diagnosen im isolierten fehlgeschlagenen Profil:
71642 Exit1 (nach Close war Main-Kontext bereits nicht mehr auswertbar),
27575 Exit0 als Diagnose mit explizitem Cleanup, nicht regulärer Shutdown-Abnahme.
Beide zeigen einen sichtbaren BrowserWindow und registrierte Quit-Barriere;
Target.closeTarget meldet success. Core-Logs zeigen danach shutdown/exited0/closed.
Mit offenen Einstellungen ebenfalls Main-Kontext beendet. Wegen anschließendem
Inspector-Cleanup per SIGTERM zählen diese Proben nicht als bestandener normaler
Beenden-Test. Keine Ursache durch bloße Timeoutverlängerung als behoben behauptet.

Der Fehler ist bislang an die vollständige Kill-/Neustartsequenz gebunden.
Nächster konkreter Schritt: genau diese Sequenz mit beobachtenden Main-Eventtraces
(browser-window-created/close/closed, window-all-closed, before-quit) und gebundener
CDP-Target-ID diagnostizieren; Inspector vor dem Schließen trennen, damit er
Shutdown nicht selbst zurückhält. Danach begründete Korrektur und unveränderten
regulären Abnahmefall erneut ausführen. Aktuell keine lokale Prüfung aktiv;
Transporterweiterung und Matrix aktualisiert, accepted-crash bleibt unbestanden.

### Phase 5 – Prozessidentität statt unzuverlässiger Environment-Erkennung

Nach Unterbrechung revalidiert: Handle48742 fehlt, Log terminal Exit1, PID815440
existiert nicht mehr. Voriger Turn lieferte entscheidende neue Evidenz: Trace
schloss nach dem vermeintlichen SIGKILL noch Fenster aus ui-launch-2, während
ui-launch-3 erst startete. /proc/815440/environ enthielt trotz laufendem Main keine
XDG-/TMPDIR-Einträge; stat und cmdline belegten denselben lebenden Testprozess.
Damit war die Environment-only-Prozessliste kein zulässiger Todesnachweis.

Fixplan vor Änderungen: gestartete AppImage-Prozesse mit PID plus Kernel-Startzeit
verfolgen, bekannte Nachfahren aufnehmen und Identitäten über Scans erhalten,
auch wenn Environment-Einträge verschwinden. Den durch beide Profilleases
verifizierten Main-PID zusätzlich aufnehmen, damit Relaunch/Orphans erfasst sind.
Zombies gelten als beendet, wiederverwendete PID nicht als alter Prozess.
Unitfälle mit kontrolliertem proc-Baum für leeres Environment, Nachfahren,
PID-Wiederverwendung und Zombies. Danach echter accepted-crash-UI-Lauf ohne
Inspector wiederholen; keine Lockerung von Shutdown- oder Inhaltsassertions.

### Phase 5 – Desktop-Ausfall: Diagnose und Schutz vor weiteren GUI-Läufen

2026-09-09: Voriger Turn ist Fortschritt durch neue Ursachen-Evidenz, keine
bestandene Artefaktabnahme. Vorheriger Boot endet um11:37:47, aktueller Boot
nach Neustart. Um11:20:42 und11:31:40 melden isolierte Test-Mains
inotify_init/EMFILE. Um11:34:37 scheitert dbus-broker-launch beim
Konfigurationsreload in dirwatch_new mit „Too many open files“; unmittelbar
folgen D-Bus-Abbruch und Fatal-Abstürze von ChatGPT und SaltMarcher Local sowie
WirePlumber-Segfault. Keine gespeicherte OOM-/GPU-Hang-Evidenz. Verursachender
Ressourcenverbraucher nach Neustart nicht beweisbar; Testprozess-Leaks sind ein
plausibler Beitrag. Warnungen hätten weitere Starts stoppen müssen.

Keine GUI-/AppImage-Tests bis Absicherung. Aktuelle Prozessprüfung zeigt keine
übrig gebliebenen Salt-Marcher-/Xvfb-/Qualifier-/Vitest-Prozesse. Der vor der
Untersuchung gestartete Tracker-Unitlauf ist laut Log terminal:4Tests bestanden,
208ms,11:45:05. Das ist kein Nachweis vollständiger Prozessbereinigung im E2E.

Korrekturplan vor Änderungen:
1. Historischen UI-Qualifier vor dem ersten Seed/Prozessstart sperren, wenn
   tatsächliche cgroup-v2-Grenzen für Speicher und Prozesszahl fehlen oder der
   Desktop-D-Bus verwendet wird. Kein Umgebungsflag als alleiniger Nachweis.
2. Eigenen begrenzten Service und privaten D-Bus als Startweg ergänzen; gesamter
   Test einschließlich Relaunch und Xvfb gehört zur Gruppe. Gruppencleanup statt
   alleiniger PID-/Environment-Heuristik, kein Zugriff auf Desktop-D-Bus.
3. Gemeinsame inotify-Ressourcen zusätzlich berücksichtigen: cgroup-Speicher-
   und Prozesslimits begrenzen dieses benutzerweite Limit nicht zuverlässig.
   Vor erneuter GUI-Abnahme separate Benutzer-/VM-Isolation oder eine nachweisbar
   wirksame Grenze und Überwachung samt Abbruch vor Ressourcenerschöpfung nötig.
4. Erst kleine Nicht-GUI-Proben, dann Fehler-/Cleanup-Prüfung. Keine Wiederholung
   der vollständigen AppImage-Sequenz allein aufgrund bestandener Unitprüfungen.
Plan-/Roadmap-Audit: Phase5 weiterhin offen; bisherige Inhaltsvergleiche bleiben
Evidenz ihres Inhaltsumfangs, env-only-Prozessende ist kein vollständiger
Cleanup-Nachweis. Keine Public-Release-/Handofffreigabe aus diesen Läufen.

Erster Schutzschritt implementiert: historical-test-isolation.ts liest die
wirkliche cgroup-v2-Zuordnung sowie memory.max/pids.max. Historischer UI-Qualifier
prüft dies vor Seed/erstem AppImage. Verlangt eigene benannte Service-cgroup,
maximal8GiB/256Tasks und privaten tmp-D-Bus statt Desktopbus. Unitprüfung für
Isolation und Prozessidentität:15Tests/2Dateien bestanden (26350, Exit0).
Read-only-Probe der tatsächlichen Desktopumgebung wird wie beabsichtigt
abgewiesen; kein AppImage gestartet. git diff --check bestanden.

Plan-Audit: Schritt1 erfüllt als Startsperre, Schritte2–4 offen. Diese Sperre
allein ist KEIN vollständiger Sicherheitsnachweis: private-Bus-Adresse ist
noch kein Nachweis vollständiger Sessionisolation, und benutzerweite inotify-
Erschöpfung bleibt ungelöst. Daher weiterhin keine GUI-Läufe. Roadmap-Audit:
Phase5 unverändert offen; keine neue Migrations-/Recovery-Abnahme behauptet.

### Phase 5 – Eigener Kernel für GUI-Qualifikation

Voriger Turn: Fortschritt (Startsperre +15 bestandene Tests), nicht vollständige
Isolation. Iststand: /dev/kvm verfügbar, Podman installiert, QEMU nicht installiert.
Korrekturplan: QEMU-Werkzeuge in einem begrenzten lokalen Container bereitstellen;
keine Änderung an Desktopdiensten oder systemweiten inotify-Limits. Gast mit
festem RAM/vCPU-Budget, eigenem Kernel, eigenem D-Bus und virtueller Grafik ohne
Host-GPU-Passthrough. Nur explizite Testdateien übertragen. Zunächst Boot und
Ressourcengrenzen ohne AppImage verifizieren. Erst danach kontrollierten Startweg
mit Kernelidentität und kompletter Prozessgruppenbereinigung anbinden. QEMU-
Systememulation/KVM-Aufruf anhand offizieller Invocation-Dokumentation geprüft:
https://www.qemu.org/docs/master/system/invocation.html .

Werkzeugbereitstellung abgeschlossen: erster Build wegen nicht unterstütztem
--pids-limit abgewiesen, zweiter wegen relativem cwd abgewiesen; anschließend
absoluter Kontext im begrenzten systemd-Service erfolgreich, Exit0,422.1MiB Peak.
Podman-Image3d6445cd07b63f6032fff7c4505e1f72ede65ac90aecce1044ebb792ee66bc08.
Ubuntu noble amd64 SHA256 mit Hersteller-SHA256SUMS über HTTPS verglichen:
d0fe84bb5f80853425fa6be28e2c106f30104c3cfe8611933f2e65c9b63f0e30.
Original unverändert als qcow2-Backing, neue12GiB-sparse-Overlay-Probe.

Bootprobe12992 startet ausschließlich QEMU, keine SaltMarcher-App. Tatsächliche
cgroup-Dateien im laufenden Container: memory.max2147483648,pids.max128,
cpu.max200000/100000. /dev/dri und Desktopbus fehlen. Gast mit1024MiB,2vCPUs,
KVM, serieller Ausgabe, ohne Netzkarte; eigener Kernel6.8.0-138-generic bereits
im Bootlog. Container bei erster Stichprobe425.8MB/14Tasks. Harddeadline180s
plus10s Kill-Nachlauf, automatisches Entfernen des Containers. Hostboot-ID
ea2527db-9f4d-4588-b388-51f759fea11c. Vollständiger Boot-/Shutdownnachweis noch
ausstehend; derzeit wartet Gast auf Netzwerk-online-Timeout. Keine GUI-Freigabe.

Bootprobe12992 terminal Exit0: cloud-init-Probe bei129s vollständig, reguläres
Powerdown bei161.33s vor180s-Deadline. Gastboot-ID
8c4189f5-bf92-4f2c-9e69-a4f198333272 unterscheidet sich vom Host; MemTotal984196kB,
eigenes inotify-Instanzlimit128. Container nach Abschluss entfernt. Das erwartete
network-online-Timeout bei netzlosem Gast verzögerte den Boot, verhinderte aber
Probe und Shutdown nicht. Log: work/qualification-vm/probe.log.

Plan-Audit: Werkzeugbereitstellung, begrenzter eigener Kernel und regulärer
Shutdown nachgewiesen. Noch offen: wiederverwendbarer Gast-Startweg, Übergabe
unveränderlicher AppImages/Quellen, Startguard-Bindung an geprüften Gast und
Fehlercleanup. Roadmap-Audit: keine neue AppImage-Abnahme; Phase5 bleibt offen.

### Phase 5 – VM-Startvertrag und garantierter Abbruch

Voriger Turn Fortschritt: Boot und Shutdown im eigenen Kernel nachgewiesen.
Nächster Fixplan: wiederverwendbarer begrenzter Podman/QEMU-Startweg mit frischem
Overlay, read-only Gastbasis/Seed, exklusiver Host-Laufsperre und harter Deadline.
Nur eigene Container-ID beim Cleanup verwenden; keine breite Prozesssuche.
Hostboot-ID als QEMU-fw_cfg in den Gast übertragen. UI-Guard verlangt diesen
Kernelvertrag zusätzlich zu Gast-cgroup/private-D-Bus und lehnt denselben Boot
ab. Kleine Abbruchprobe mit bestehendem netzlosem Seed vor AppTests, Unitfälle
für fehlende/gleiche Boot-ID. Noch kein GUI-Start in diesem Korrekturschritt.

Implementiert: scripts/qualification/run-historical-vm.sh mit exklusivem flock,
frischem24GiB-sparse-Overlay, read-only Basis/Seed, einmal aufgelöster Toolimage-ID,
Hostboot-ID per fw_cfg, Gast4GiB/2vCPU, Host-cgroup7GiB/128Tasks/2CPU ohne Swap,
keinem Netz/Grafik-Passthrough, Deadline und UUID-spezifischem Cleanup. Isolations-
Guard verlangt verschiedene UUID-Bootkennungen aus Kernel/QEMU-Dateien.

Validierung:24185 terminal Exit0,17Unitfälle/2Dateien, Shellsyntax und diff-check
bestanden. Reale Abbruchprobe27796 terminal Exit124 wie erwartet; serielles Log
belegt SIGTERM von timeout nach10s. exit-code-Datei124; podman ps -a zeigt keinen
zugehörigen Container mehr. Keine SaltMarcher-App ausgeführt. Testdaten unter
work/qualification-vm/abort-probe-1, originale Basis bleibt read-only.

Plan-Audit: Startweg und Deadline-Cleanup implementiert/geprüft. Signalunterbrechung
des äußeren Runners und Konkurrenzstart noch gesondert zu prüfen; QEMU-fw_cfg-
Lesbarkeit im fertig gebooteten Gast noch nicht praktisch bestätigt. Gastpakete,
Übertragung der unveränderlichen Qualifikationseingaben und Ergebnisexport fehlen.
Roadmap-Audit: Phase5 weiterhin offen; kein Ersatz echter Update-/Recoverytests
oder Handoff durch Infrastrukturproben.

Signal-/Konkurrenzprobe50683 abgeschlossen: zweiter Start korrekt Exit2 ohne
Ausgabeordner. SIGTERM nur an Starter führt jedoch nach10s noch nicht zum Ende;
Container existiert weiter. Diagnosecleanup entfernt ausschließlich Testcontainer.
Fixplan vor Änderung: Podman-Aufrufe als eigene Hintergrundkinder starten und
mit Bash wait warten (unterbrechbar durch Trap); auch Vorbereitung eindeutig
benennen. EXIT-Cleanup zeichnet Exitstatus auf, entfernt eigenen aktiven Container
und wartet Clientende. SIGTERM muss143 melden und Container zeitnah entfernen.

Korrigierter Signal-/Konkurrenzlauf terminal Exit0: SIGTERM nur an Bash-Starter
endet143, exit-code-Datei143, Container nach0.18s entfernt. Zweiter Start erneut
Exit2 und kein Ausgabeordner. Shellsyntax bestanden. Logs unter
work/qualification-vm/signal-probe-2*. Fehler im Vordergrund-Warten behoben.

Noch offene Startgrenze: Signal exakt während Containererzeugung vor dessen
Sichtbarkeit kann Cleanup-Prüfung überholen; vor GUI-Läufen gesondert absichern.
Als nächstes Gast-bootstrap mit begrenztem ausgehendem Netzwerk nur für Pakete,
privatem D-Bus und Xvfb vorbereiten, dann wieder offline qualifizieren. Keine
Desktopprofile oder Host-GPU durchreichen. Gast muss QEMU-fw_cfg lesen können;
Testeingaben samt SHA256 werden nur explizit als read-only Datenträger übertragen.

### Phase 5 – Startgrenze schließen, Gast vorbereiten

Voriger Turn Fortschritt durch korrigierten und geprüften Signalpfad. Fixplan:
Container zunächst nur erzeugen (noch kein Gastprozess), danach vorhandene ID
asynchron starten. Trap während synchronem create wird erst nach dessen Ende
abgearbeitet, kann dann den erzeugten Container entfernen; start kann gelöschten
Container nicht neu erzeugen. Gleicher Ablauf für Overlay-Vorbereitung. Danach
kontrollierte Probe für Signal während verzögertem create plus reale Signalprobe.
Gastbootstrap erhält ausdrücklich optionales ausgehendes NAT-Netz; Standard der
Qualifikation bleibt ohne Netzwerk. Keine Portweiterleitung oder Hostfreigabe.

69758 Exit0: verzögertes create mit echtem Podman, SIGTERM an Starter bevor
create zurückkehrt:143, kein Gastoverlay gestartet, Preparecontainer entfernt.
Bootstrap60276 Exit0 ist nur QEMU-Shutdown, KEIN Bootstrap-Pass: Pakete installiert,
aber qemu_fw_cfg-Modul fehlt im minimalen Cloudkernel. Erfolgmarker fehlt. Fix:
passendes linux-modules-extra-Paket im Gast installieren und Kernelvertrag erneut
prüfen. Gebündelter Qualifier benötigt __filename/__dirname für enthaltenes
TypeScript; erster Bundle-Start scheitert vor Guard. Bundlebanner ergänzen, dann
Host-Abweisung explizit prüfen. Keine AppImage-Ausführung bisher.

Payload1 vorbereitet: gebündelter Qualifier mit CJS-Pfadbanner startet auf Host
bis zum Guard und scheitert dort an fehlender QEMU-fw_cfg-Datei (keine App).
Baselinehash639b0d4d797261f2fbc6ff3e27786d2f0562ea1598b577113c763582d876c5f9,
Targethash3e143eee43b745eb61f425c6e623d7ee3726bb14f91171c71eb4094bb556724c
nach Kopie erneut geprüft, unveränderte Original-AppImages/Receipts; Node22-Tarball
und Bundle ergänzen6dateiiges SHA256-Inventar. Manifest benennt ausdrücklich
uncommittete Qualifieränderungen, kein falscher exact-commit-Buildnachweis.
work/qualification-vm/payload-1. Gastbootstrap48433 aktuell laufend mit tatsächlichem
Container086ce3e4-5b23-4d0b-a09c-77cfd6f96e3a; Quelle ist weiterhin frisches Overlay,
keine Benutzerkampagnen. diff-check bestanden. Phase5 weiterhin offen.

Bootstrap48433 terminal Exit0 mit explizitem QUALIFICATION_BOOTSTRAP_COMPLETE:
Host-IDea2527db-9f4d-4588-b388-51f759fea11c via fw_cfg lesbar, Gast-ID
56410099-75f5-4c5a-82f3-bff1fa6cc513, systemd-detect-virt=kvm. Vollständiger
Shutdown, Container entfernt. linux-modules-extra behebt fehlendes qemu_fw_cfg.
Plan-Audit: Startgrenze/create, Gastpakete, Kernelkennung und Eingabekopie geprüft.
Für Offline-Qualifikation wird Gastoverlay als unabhängige qcow2-Basis exportiert
(22729), damit keine Host-Backingpfade im späteren Gaststart erforderlich sind.
Noch keine UI-Abnahme; Ergebnisexport und Ausführung des vollständigen
accepted-crash-Update-/Restorefalls bleiben als nächster Schritt offen.

### Phase 5 – Vollständiger UI-Fall im Offline-Gast

Voriger Turn Fortschritt: Bootstrap, separate Kennungen und Payloadhashes belegt;
Export22729 terminal Exit0. Plan: read-only Seed-ISO mit Payload/SHA256-Inventar,
Gast kopiert und prüft alle Eingaben, führt als ubuntu in begrenztem systemd-Service
mit privatem D-Bus/Xvfb den unveränderten accepted-crash-Fall aus. Gastservice
liefert expliziten Exitcode; Bericht/Diagnoselogs werden seriell exportiert.
QEMU-Exit0 allein gilt weiterhin nicht als Testpass. Keine Quellenänderungen
während dieses AppImage-Laufs. Keine Desktopdaten oder Hostnetzfreigaben.

UI-Gastlauf19278 terminal QEMU Exit0, aber Testservice Exit1: Timeout „target
restart commits update“. Gastservice Peak2.3GiB, vollständig beendet/exportiert;
kein laufender Container. Evidenz unter work/qualification-vm/ui-run-1/evidence.
Journal5f58e3bd-77dd-4ae0-abfe-61532e3c982e: rolled-back aus prepared, Backup
e681ece5-641b-4a29-b5cc-7aa8df431a3c vorhanden, frühere Programmreferenz0.0.146.
Damit kein bestandener Update-/accepted-crash-Nachweis. Zielvorbereitung scheitert
vor Aktivierung. Controller verwirft Wartungschild-stdio und meldet bei Exitfehler
nur generische Ursache. Ubuntu-Sandboxunterschied ist eine Hypothese, kein Befund.

Nächster Diagnoseplan: Ziel-AppImage im selben isolierten Gast mit ungültigem
Wartungstoken und eigenem leeren Diagnoseprofil starten, stderr/Exit aufzeichnen;
keine vorhandenen Profile verwenden. Außerdem Test-Timeout um UI-Fehlertext und
terminalen Rollbackzustand ergänzen, damit keine120s trotz abgeschlossenem
Fehlerversuch verstreichen. Erst nach Ursachenbeleg Produkt-/Harnesskorrektur;
keine Deaktivierung von Host-Schutzmaßnahmen und kein stilles Lockern der Abnahme.

Diagnose32204 terminal Exit0 (Gast), Wartungsprozess Exit1 erwartungsgemäß:
liest maintenance-request.json im leeren Diagnoseprofil und meldet ENOENT.
Kein grundsätzlicher Electron-/Sandbox-Startfehler belegt; Hypothese nicht als
Ursache verwenden. Nächste geplante Diagnosekorrektur: UI-Wartekriterium erkennt
rolled-back als terminal und berichtet Journal-ID plus lesbaren UI-Fehlertext.
Danach frische VM mit identischen AppImage-Bytes; nur gebündelter Test geändert.

63333 terminal TestExit1 nach22.6s statt120s: UI nennt „Der Starthelfer konnte
nicht aus dem Ziel-AppImage gelesen werden.“ Diagnose60521 terminal GastExit0,
separater Node-Leseaufruf Exit9: salt-marcher: bad option: --no-sandbox.
Originales AppRun geprüft: unshare -Ur true scheitert → NO_SANDBOX=(--no-sandbox),
unabhängig von ELECTRON_RUN_AS_NODE. Damit konkrete Plattformursache belegt,
kein Migrationsfehler. Fedora-Erfolg deckte diese AppRun-Verzweigung nicht ab.

Produkt-Fixplan: Hashprüfung beibehalten, Wartungsresource per AppImage-Runtime
--appimage-extract in exklusivem temporären Ordner lesen, APPIMAGE_EXTRACT_AND_RUN
und ELECTRON_RUN_AS_NODE entfernen; AppRun nicht ausführen. Extrahierte reguläre
Datei innerhalb temporären Roots, Größenlimit, erneuter Artefakthash und Cleanup
bei jedem Ergebnis. Unitfälle für Fehlpfad/Symlink/Größe/Extraktionsfehler/Hashwechsel
und echte Extraktion im Gast. Danach neue unveränderliche Vergleichsartefakte mit
Fix; bestehende historische Bytes niemals nachträglich ändern.

Direkte Runtime-Extraktion78062 terminal GastExit0 UND DiagnoseExit0: unverändertes
Ziel-AppImage extrahiert resources/maintenance/start.cjs als reguläre Datei mit
169006Bytes. Kein AppRun-/Node-Modus, keine Sandbox-Flagänderung. Damit alternativer
Leseweg auf derselben problematischen Gastplattform praktisch belegt. Produktfix
und dessen Regressionstests noch ausstehend; Phase5 bleibt offen.

Produkt-Leseweg auf direkte Runtime-Extraktion umgestellt, reguläre Pfadkomponenten,
Dateigröße, Vor-/Nachhash und finally-Cleanup geprüft. Unit40372 Exit0:31Tests
inklusive14Extraktionsfälle. Typecheck40654 Exit2: expliziter ProcessEnv-Typ und
Indexsignaturzugriff fehlen, außerdem älterer DBUS-Zugriff im Isolationsguard.
Fixrunde: diese3Typfehler korrigieren, typecheck/lint wiederholen; danach dieselbe
Produktfunktion im isolierten Gast gegen unveränderte Targetbytes prüfen.

Typecheck61766 vollständig bestanden; anschließender ESLint meldet7unsichere
Zugriffe ausschließlich auf untypisierte Mock-Aufrufe im neuen Unitfile. Fixplan:
Mock-Signatur konkret typisieren, Umgebungsvariablen per Index lesen; Lint und
31gezielte Tests erneut prüfen. Produkt-Reader-Probe ist als separate Payload
gebündelt, noch nicht ausgeführt.

Fixvalidierung: Typecheck vollständig bestanden; gezieltes ESLint ohne Befund
(leere Logdatei);35117 Exit0 mit31Tests. Produkt-Reader-Gastprobe44159 terminal
GastExit0 UND ServiceExit0: readAppImageLauncher + readAppImageProfileProtocol
gegen unverändertes0.0.147. Helper169006Bytes, SHA256
b0c175f9c4e9c8244e800373ca678f488c8721e1009fe4a9b71eada4f34d77ce stimmt mit
unabhängig vorhandenem Originalresource überein. Profilvertrag format1,
canonical-profile-v1/complete-profile/outside-profile. Kein AppRun-Nodeaufruf.
git diff --check bestanden. Plan-Audit des Lesewegfixes: implementiert und gezielt
geprüft; kein vollständiger Paketupdate-Pass behauptet.

Nächster Schritt: unveränderliche Quellen für neue Artefakte herstellen. Sowohl
Ausgangs-App (Schema42/41) als auch Ziel-App (42/42) brauchen den Lesewegfix,
weil die alte Ausgangs-App sonst weiterhin vor Zielaktivierung scheitert.
Historische Artefakte/Quellen nicht nachträglich verändern: eigener deklarierter
Backport-Commit für Ausgangsstand, eigener Zielcommit, neue Testversionen/Hashes.
Danach kompletter accepted-crash-Update-/Restorefall im Gast. Phase5, exakter
Candidate-CI/Handoff/Main-Abschluss und Phasen6–7 bleiben offen.

### Phase 5 – Unveränderliche Quellen für Plattformkorrektur

Voriger Turn Fortschritt: Produktfix,31Unitfälle, Typecheck/Lint und echter Reader-
Gastpass. Nun aktueller Candidate einschließlich Isolation/Testdiagnose committen;
separaten Ausgangsbranch vonbd8b33c mit ausschließlich demselben Resource-Reader-
Fix und zugehörigen Regressionstests erzeugen. Schemata müssen42/41 bzw42/42
bleiben. Beide SHA in historische Quellliste aufnehmen und zwei neue deklarierte
Testversionen0.0.148/0.0.149 bauen, ohne bisherige Artefakte zu überschreiben.
Bauten begrenzen; keine AppImageausführung auf Desktop. Vollständiges Candidate-
Check/Handoff/Main erst nach Phase5-Abnahme, keine Freigabe durch bloßen Build.

Candidate f633b89621a3307ba01ad3772dcaead51451f333 enthält Produktfix und bislang
geprüfte Isolation/Testdiagnose. Formatprüfung meldete noch eine Testdatei; nach
Commit in Folgeänderung korrigiert und erneut explizit grün geprüft. Keine
falsche Format-/Checkfreigabe für f633 behauptet.
Ausgangscommit ab32d4947ea8409bda679d60d3befe9103c176c0 von bd8b33c enthält nur
Resource-Reader und Regressionstests. Quellliste benennt extraction-baseline
42/41 und extraction-target42/42. Vor historischen Builds Metadaten/Tests prüfen,
dann bounded build, keine Laufzeit auf Desktop.

Quellen/Tests:49716 Exit0,25Tests für Quellinspektion und Ressourcenleser.
Candidate796c3017dab9ead17de61d04562c99f99426121c und separater Baselinebranch
gepusht; Check34340503082 auf genau796c läuft noch (abgefragt nach Builds).
Erster bounded Aufruf42328 Exit1 vor Build: systemd löste anderes pnpm auf,
Purge wurde mangelsTTY abgewiesen. Korrigiert durch absolutes Node22-Corepack;
keine CI=true-/Purge-Umgehung und keine Quellenmutation während Build.

10147 terminal Exit0,44.7s,Peak2.8GiB:0.0.148 ausab32d4947,Schema42/41,
SHA25629404e318b4bd0a0da08df952c21cc9f971879d05b6db2abf96698f93fa6bfbb.
11277 terminal Exit0,43.1s,Peak2.5GiB:0.0.149 ausf633b8962,Schema42/42,
SHA256fce8c543bbdbd289e529e8f2f5f0c66cb3b2a1bf92d32d5479a702643263a7e0.
Beide Manifeste und tatsächlichen Bytes nach Build erneut verglichen; Original-
Quelltrees im Builder unverändert geprüft. Begrenzung10GiB/256Tasks/2CPU ohne
Swap tatsächlich beim laufenden Baseline-Service gelesen. Keine Appausführung
auf Desktop. Plan-Audit: neue unveränderliche Vergleichsartefakte fertig.
Roadmap-Audit: Laufzeitabnahme dieser Bytes fehlt; Phase5 weiterhin offen.
Nächster Schritt: aktuelle Qualifier-Payload mit genau diesen zwei Artefakten,
frischer Offline-Gast, accepted-crash plus Update/Weiterarbeit/Restore.

### Phase 5 – Aktualisiertes Artefaktpaar im vollständigen Gastlauf

Voriger Turn Fortschritt: unveränderliche42/41→42/42-Artefakte neu gebaut und
hashgeprüft. Plan: aktuelle796c-Qualifierquellen bündeln,0.0.148/0.0.149 und
Receipts unverändert in frische Payload übertragen, alle Eingabehashes im Gast
prüfen. Vollständiger accepted-crash-Update-/Restorefall; Host nurVM-Prozess.
Keine Quellenänderung während dieses Laufs. Testexit und Vollprofilbericht sind
maßgeblich, nicht QEMU-Exit. CI34340503082 gesondert nachverfolgen.

Gastlauf76613 terminal Exit0 UND TestExit0: kompletter UI-Update/Weiterarbeit/
accepted-crash/Restorefall mit0.0.148→0.0.149 bestanden, ServicePeak2.5GiB.
ReportSHA25683a9c615116a180d35fc689711aa9301282d4524fddae609aad9b61fe8f97731
unter work/qualification-vm/ui-run-3/evidence/qualification/ui-update-evidence.json.
Update50dc8b4c-4bbd-4ed1-a3c8-c4f9d685b214 committed;
Restore62b6991d-b3ad-4797-b039-6dee86e920b0 committed;
Schutzbackupd2926da8-eb1e-42ec-b217-3adb4f9211aa.
Prozessausgänge:963/1314/1555/1721 Exit0,1469 erwarteter SIGKILL. Akzeptierter
Absturz enthält eigene Nachher-Lesung; keine stillschweigende Todesannahme.

Export enthielt eingestreute cloud-init-SSH-Meldungen. Nur vollständige Base64-
Zeilen zwischen Markern rekonstruiert; striktes Base64, gzip/tar-Prüfung und
sicheres data-Filter-Entpacken erfolgreich. Bericht zusätzlich unabhängig gelesen:
alle eigenen Runtime-Ausgänge0/response.ok; after/restored/unchanged vollständig
==seeded; acceptedCrash.readback/protectedRead vollständig==continued;
continued!=seeded. Damit Quellerhalt und spätere Arbeit explizit nachgewiesen.
Kein Datenbank-/Dateifeld beim Vergleich entfernt. CI34340503082 weiterhin laufend,
bisher kein fehlgeschlagener Job; kein Handoff/Main-Abschluss.

Plan-Audit dieses Testfalls: bestanden. Roadmap-Audit: Phase5 NICHT abgeschlossen.
Weiterhin Faultmatrix, Erststartfälle und andere Annahmen offen. Zusätzlich
Codeprüfung findet denselben Node/AppRun-Fehler im stabilen Startpunkt:
src/shared/maintenance/launcher.ts startet retained AppImage mit
ELECTRON_RUN_AS_NODE=1. UI-Update relauncht Ziel direkt und deckt diesen Pfad nicht
ab. Nächster Fixplan: stabilen Startpunkt auf direkt entpackte, hashgeprüfte
Electron-Laufzeit umstellen, ohne AppRun im Node-Modus; Argumente/Exit/Cleanup und
Recovery-Sperren bewahren, tatsächlichen installierten Start im Gast prüfen.
Keine Behauptung, dass erfolgreicher UI-Fall bereits Desktopstart/Recovery beweist.

### Phase 5 – Stabilen Startpunkt von AppRun entkoppeln

Voriger Turn Fortschritt: kompletter UI-/accepted-crash-Fall bestanden, getrennte
Launcher-Lücke benannt. Konkreter Fix: Shellstart prüft weiter Runtime/Helperhash,
extrahiert zurückgehaltenes AppImage in eigenes temporäres Verzeichnis ohne
AppRun/Node-Modus, prüft Runtimehash erneut und startet enthaltenes Electron
im Node-Modus direkt. Shell erhält Exitcode/Argumente, räumt auch bei Signal auf;
keine Änderung von Wartungsjournal/Profilsperren. Unit-Interpreterfixtures müssen
AppImage-Extraktion statt direktem Node-Proxy modellieren. Danach tatsächlicher
installierter Startpunkt im Gast; kein Ersatz durch direktes Zielrelaunch.

Launcherfix implementiert: Hashprüfungen, direkte Extraktion, regular/non-symlink
Laufzeit, Node-Ausführung ohne AppRun, Signaltraps und Cleanup.30684 terminalExit0:
20Tests für Reader/Launcher inklusive Extraktionsfehler, fehlender Laufzeit,
Helper-Exit23, Leerzeichen/Apostrophen, geerbten Startmodi und Tempbereinigung.
Typ-/Lintlauf1785 separat nachverfolgt; echte installierte Gastlaufzeit und
Signalprüfung noch nicht durch Unit-Erfolg ersetzt.

### Phase 5 – Installierten Startpunkt mit vollständigem Profil prüfen

Voriger Turn Fortschritt: Launcherfix und20gezielte Tests, Typen/Lint grün.
Plan: eigenständiger Qualifier seedet Profil über tatsächliches Target-AppImage,
installiert aktuellen Shellstart mit original verpacktem Helper, startet nur
root/start, prüft sichtbare Version und reguläres Beenden, vergleicht danach
vollständiges Profil und Temp-Cleanup. Gast-/cgroup-Guard zwingend. Separater
Signaltest folgt, damit normaler Start nicht als Signal-/Recoverybeweis gilt.

16353 terminal GastExit0, TestExit1: Starthelper meldet „Der Wartungsbeleg fehlt“.
Kein Electronstartfehler, sondern unvollständiger Fixtureaufbau: Qualifier setzte
nur current und installierte Launcher ohne Initialtransaktion. Fixplan: eigenes
vollständig geschlossenes Seedprofil als Arbeitskopie bereitstellen, gemeinsamen
MaintenanceCoordinator.begin/activate mit Profiljournal3 nutzen und Start NICHT
im Test committen. Tatsächliche App muss über root/start die Startprüfung und
committed-Übergang durchführen. Dann UI/Exit/Vollprofilvergleich wie geplant.

41309 terminal GastExit0, TestExit1: „Keine bestätigte Installation vorhanden“.
Quellprüfung admitDesktopStart erklärt dies: stabiler Desktopstart ruft rollback
für unbestätigte Wartung auf; eine Erstinstallation ohne previous darf daher
nicht über ihn bestätigt werden. Zweiter Fixtureaufbau ebenfalls unzutreffend,
kein neuer Produktfehler belegt. Typprüfung40559 bestanden, ursprünglicher
Qualifierlint leer; beide Gastfehler bleiben dokumentiert.

Korrekturplan: authentischen Installationsabschluss nachbilden: begin/activate,
direkter Ziel-AppImage-Start mit --release-complete <Transaktion> wie produktiver
Controller, App selbst committed prüfen und regulär schließen. Erst anschließend
root/start mit original verpacktem Helper starten, Version/Profil/Cleanup prüfen.
Kein manuelles Journal-commit im Test; stabile Recovery-Semantik nicht lockern.
Zusätzlich abgewiesene fehlende/unbestätigte Installation später als eigene
Negativfälle behalten, nicht als normalen Start auswerten. Phase5 offen.

82214 terminal GastExit0, TestExit1. Initialer direkter Zielstart bestätigt die
Installation und endet0. Danach root/start scheitert konkret mit fehlender
libfuse.so.2. Ursache der Launcheränderung: APPIMAGE_EXTRACT_AND_RUN wurde auch
beim direkten Nodebinary entfernt; der echte Helper übernimmt sein Environment
für den späteren AppImage-Appstart. Fixplan: nur bei Extraktion entfernen, bei
direkt ausgeführtem Nodebinary ausdrücklich1 setzen (dieses führt kein AppRun aus).
Regression muss diese vererbte FUSE-freie Appstartoption prüfen. Danach neuer
Gastlauf, ohne FUSE zu installieren und damit den Produktfehler zu verdecken.

65452 Exit0:6Launcher-Unitfälle inklusive FUSE-freier Environmentweitergabe.
Gast47872 terminal GastExit0 UND TestExit0: installierter Startpfad bestanden.
Bericht work/qualification-vm/launcher-run-4/evidence/qualification/
installed-launcher-evidence.json SHA256
e6f7af9f3b2a0c5427a1e238038d422244272f53a604e165e54d76a004a6fbd2.
Initialer echter Zielstart bestätigt Installation (committed), endet0;
anschließendes root/start mit originalem AppImage/Helper endet0, sichtbare
Version0.0.149, vollständiger Nachherstand gleich Seed, keine salt-launcher-
Tempverzeichnisse. Bericht unabhängig geparst und Profil/Journal/Exit geprüft.
FUSE wurde nicht nachinstalliert. Payload enthält ausdrücklich uncommitteten
Launcherfix; kein falscher exact-SHA-AppImagebuildnachweis.

CI34340503082 auf796c3017d jetzt completed success. Diese CI umfasst NICHT die
noch uncommittierten Launcher-/Qualifieränderungen. Plan-Audit normaler Start:
bestanden. Signalabbruch des echten Starthelfers und Wiederherstellungsfälle
bleiben separat offen; Phase5-Faultmatrix sowie erneute Candidate/Handoff/Main-
Gates nach Produktänderung weiterhin erforderlich. Kein Phasenabschluss.

### Phase 5 – Signalabbruch des bestätigten Startpunkts

Voriger Turn Fortschritt: echter stabiler Start und vollständiger Datenvergleich
bestanden. Plan: optionaler --signal-abort-Fall nach regulärem erfolgreichen Start:
erneut root/start, sichtbare Bereitschaft, SIGTERM ausschließlich an Starter-PID,
Exit143 und keine verbleibenden Testprozesse binnen10s. Journal bleibt committed,
Tempverzeichnisse weg; danach voller Readback und erneuter regulärer Start mit
Beenden. Nicht durch Kill aller Prozesse als erfolgreichen Signalpfad ersetzen.
Fehlercleanup bleibt getrennt und zählt nicht als Abnahme.

Signaltest33878 terminal GastExit0, TestExit1: nach10s verbleiben8Testprozesse
(1198,1200,1203,1204,1225,1229,1256,1262). Cleanup separat im Gast; kein Pass.
Fixplan: direkte Node-Laufzeit durch setsid in eigene Prozessgruppe starten;
Starter-Signal beendet diese Gruppe statt nur unmittelbaren Node-PID, sodass
spawnSync-Kinder nicht übrig bleiben. Rückgabecode/normaler Start unverändert,
keine globalen Prozessnamenkills. Launcher-Units und echter Signal-/Neustartfall
wiederholen. Typen/Lint des erweiterten Qualifiers zuvor bestanden.

81930 Exit0:6Launcher-Unitfälle nach Prozessgruppenfix.31061 terminal GastExit0
UND TestExit0: ursprünglicher Normalstart, SIGTERM nuranStarter, Exit143,
keine erkannten Testprozesse binnen10s, Tempbereinigung, erneuter Normalstart
und vollständiger Profilvergleich bestanden. ReportSHA256
9a9e8f3571952d0879ae2262b86e73ffecf3788c4fbc515ce42955a6071a4084 unter
work/qualification-vm/launcher-run-6/evidence/qualification/
installed-launcher-evidence.json. Unabhängiger Berichtvergleich bestätigt
seeded==after und committed; signalAbort={code:143,signal:null}. Fehlercleanup
war nicht Teil des erfolgreichen Abbruchnachweises. AppImage0.0.149 unverändert,
installierter Shellfix weiterhin als uncommittierte Testeingabe gekennzeichnet.

Plan-Audit des Signal-nach-Bereitschaft-Falls: bestanden. Kein Nachweis für Signale
während Extraktion/Prozessgruppenanlage oder SIGKILL innerhalb Migration. Phase5
bleibt offen; übrige Faultmatrix und exakte neue CI/Handoff/Main-Gates fehlen.

### Phase 5 – Unterbrechung während Launcher-Extraktion

Voriger Turn Fortschritt: Signal nach UI-Bereitschaft korrigiert und Gastpass.
Jetzt fokussierter Regressionstest mit langsamem synthetischem Extraktor (nur
Node, keine GUI): nach sicherem Extraktionsbeginn SIGTERM nuranStarter, binnen3s
Exit143, Extraktor beendet, Tempverzeichnis weg. Vorher-/Nachhernachweis. Falls
Vordergrund-Warten verzögert reagiert, Extraktion ebenfalls in eigene Prozess-
gruppe mit unterbrechbarem wait überführen. Keine Änderung am Profiljournal.

60397 terminalExit1: neuer Test scheitert genau an ausbleibendem Exit143 nach3s,
6bestehende Fälle bestehen. Diagnosecleanup beendet nur bekannte Test-PIDs.
Bestätigter Fix: Entpacken asynchron mit setsid --wait, salt_child während
Extraktion gesetzt; Waitstatus prüfen, danach Identität leeren. Cleanup versucht
zuerst Prozessgruppe, vor Gruppenanlage fallback unmittelbarer eigener Kind-PID.

59996:21gezielte Reader-/Launcherfälle bestanden; neuer Extraktions-Signaltest
nun grün nach vorherigem Fehlbeleg. Extraktor nicht mehr lebend, Starter143,
Tempverzeichnis weg. Lint ohne Befund; vollständige Typprüfung im selben Lauf.
Dies ist ein synthetischer Nicht-GUI-Extraktionsabbruch, kein zusätzlicher echter
AppImage-Migrationsabbruch. Normal-/Signal-Gastfall auf finalem Launcherstand
nochmals erforderlich, anschließend Quelle/CI sichern und Faultmatrix fortsetzen.
Phase5 weiterhin offen; keine anderen Profildaten angefasst.

### Phase 5 – Finaler Launcher-Gastlauf: UI-Timeout diagnostizieren

Fortsetzung nach erneuter Desktop-Diagnose: alter D-Bus-/EMFILE-Befund bestätigt;
keine Host-GUI-Tests autorisiert. Lauf39900 ist terminal, QEMUExit0 aber
QUALIFICATION_TEST_EXIT=1. launcher-run-7 exportierte Logs zeigen erfolgreiche
Installationsbestätigung sowie gestarteten Main/Utility beim stabilen Start,
anschließend Timeout der sichtbaren Versionsanzeige. Kein Pass und kein Beleg
für einen Extraktionsfehler. Export separat unter launcher-run-7/evidence gelesen.

Korrekturrundenplan vor Änderung: Qualifier speichert beim Fehler aktuelle Stufe,
sichtbaren DOM-Text, Screenshot (als JSON für bestehenden Export), Journal und
zugeordnete Prozess-IDs. Diagnostikfehler dürfen Originalfehler nicht ersetzen.
Assertions bleiben unverändert. Danach gezielte Typ-/Lintprüfung und ein neuer
begrenzter Gastlauf mit gleicher unveränderter AppImage-Datei. Erst dessen
Bild-/Textnachweis entscheidet über Produkt- oder Treiberkorrektur.
Plan-Audit: letzter Signal-Regressionstest grün, aktueller vollständiger Gastlauf
rot; Roadmap-Audit: Phase5 weiterhin offen, spätere Phasen nicht begonnen.

14067 terminal: launcher-run-8 GastExit0, TestExit1 erneut beim ersten stabilen
Start. launcher-failure.json zeigt committed und vollständige Kampagnenübersicht,
keinen geöffneten Einstellungsdialog. Screenshot failure.png visuell geprüft:
Einstellungen unten rechts, keine Fehleransicht/überlagernder Dialog. Main lädt
Fenster zunächst verborgen und zeigt erst bei ready-to-show; CDP-Verfügbarkeit
allein ist keine sichtbare Startbereitschaft. Qualifier klickt bislang unmittelbar
nach CDP-Verbindung. Kausalität noch Hypothese, nicht als Produktfehler verbuchen.

Fixplan: Im installierten Launcherfall vor jeder Settings-Interaktion auf sichtbares
Dokument und geladene Kampagnenauswahl warten. Dieser Fall hat explizit gesäten
Kampagnenstand; Recoveryfälle behalten andere Bereitschaftskriterien. Kein
wiederholtes Blindklicken, keine längeren Timeouts, kein direkter DOM-click oder
Capability-Aufruf. Diagnose bleibt aktiv; gleicher finaler Launcher/AppImagestand
in frischem Gast muss Normalstart, Signal, Neustart und Datenvergleich bestehen.

29211 terminal: launcher-run-9 TestExit1 nach29s, sichtbare Dokumentprüfung
bestand, nachfolgende Textprüfung scheiterte an document.body=null. Damit ist
vorzeitiger DOM-Zugriff konkret belegt, nicht nur vermutet. Fixplan: text() liest
fehlenden Body als leeren Ladezustand, sodass bestehendes begrenztes expectText
weiter wartet. Andere DOM-Ausnahmen bleiben Fehler. Keine Timeoutverlängerung.
Danach erneuter Gastfall und gezielte Typ-/Lintprüfung des gemeinsamen Treibers.

86738 terminal: launcher-run-10 QEMUExit0 UND TestExit0 nach46s. Bericht
installed-launcher-evidence.json SHA256
978b2febb8249832ebb533509c50704fd9bc6541456d97023182c2cc5b022980.
Unabhängig aus Export validiert: gesamter fachlicher seeded/readback-Inhalt gleich,
committed, normaler LauncherExit0, SIGTERM nuranStarter ergibt143, anschließender
regulärer Neustart und Beenden erfolgreich. Assertions für Prozessende und
Tempbereinigung bestanden. Finaler Launcher mit asynchroner Extraktion unverändert
gegenüber run7; nur belegte Test-Bereitschaft/Diagnostik korrigiert. Originales
AppImage0.0.149 hashgleich, Quelle als uncommittierte Qualifiereingabe deklariert.

Plan-Audit Launcher-Normal-/Signal-/Neustartfall nun bestanden. Roadmap-Audit:
Phase5 bleibt offen; echte Migrations-/Aktivierungs-SIGKILL-Matrix und weitere
Fehlerfälle sowie neue exakte CI/Handoff/Main-Gates fehlen. Keine Freigabe einer
Installation auf dem Desktop oder Veröffentlichung aus diesem Nachweis.

39780 terminalExit0: 21 Reader-/Launcher-Unitfälle, gezielter ESLint und beide
vollständigen TypeScript-Projekte bestanden. Begrenzter Host-Nicht-GUI-Service
salt-marcher-launcher-final-check; Log work/roadmap-phase5-launcher-current-check.log.
Vorheriger versehentlicher pnpm11-Aufruf brach vor Dependencies-Purge ab; korrekt
wiederholt über explizites Node22/corepack/pnpm10, kein Install-/Purge-Override.
Änderungsstand wird als Candidate gesichert; kein Main-/Handoffabschluss daraus.

### Phase 5 – Echte Prozessabbrüche des gemeinsamen Koordinators

Voriger Turn Fortschritt: finaler Launcher-Gastnachweis, Candidate ad01235d3
gepusht; CI34345111460 aktuell in_progress. Arbeitsbaum zu Rundenbeginn sauber.
Roadmap-Refresh: Phase5 fordert Abbrüche innerhalb Migration sowie an Aktivierungs-
und Recoverygrenzen. Bisherige Coordinatorfälle werfen Exceptions im selben
Prozess. Konkreter Plan: ergänzende Linux-Subprozesssuite für Journal2/3, SIGKILL
an vorhandenen dauerhaften Vorwärts-/Rollbackgrenzen, Recovery in separaten neuen
Prozessen zweimal. Prüfen vollständigen Dateibaum/Leerordner, Programmverweis,
erhaltenen fehlgeschlagenen Datenbaum und spätere Arbeit nach committed. Kind
bestätigt erreichten Prüfschritt auf stdout, beendet sich selbst mit SIGKILL;
Parent verlangt genau dieses Signal, kein bloßer Fehlerexit. Timeout und nur
eigene temporäre Profile. Keine Electron-/AppImage-Ausführung auf Host.

Dies ist ein ergänzender realer Prozessgrenzennachweis des gemeinsamen Moduls,
kein Nachweis der Local-/Release-Adapter, realer SQLite-Migration, Stromverlust
oder unveränderter Release-Artefakte. Anschließend Artefakt-Faultfälle anbinden;
Phase5 aus dieser Suite allein keinesfalls schließen.

54672 terminal:35 echte SIGKILL-Fälle bestanden, ESLint verlangt validierte
statt any-typisierte JSON-Eingabe im Kind. Korrektur: vorhandenen Journalvertrag
auf die Begin-Felder projizieren und Fixture-JSON damit parsen; kein neuer
paralleler Vertrag. Gezielte Suite plus Lint/Typprüfung erneut ausführen.

56485 terminalExit1: Zod lehnt pick() auf dem refinierenden Journalvertrag ab;
kein SIGKILL-Fall erreicht. Korrekturplan: Fixture serialisiert vollständigen
prepared-Journalwert, Kind validiert den unveränderten ganzen Vertrag und übergibt
ihn an begin. Journal-Prüfungen bleiben wirksam; keine Typassertion/any-Umgehung.

88678 terminalExit0:35 SIGKILL-Fälle, ESLint und vollständige Typprüfung bestanden;
Log work/roadmap-phase5-process-interruption-check3.log. Kein Host-Electronlauf.
Plan-Audit: zusätzliche Prozesssuite erfüllt ihren begrenzten Prüfauftrag;
Roadmap-Audit: reale AppImage-/SQLite-Migrationsabbrüche und Adapterabdeckung fehlen
weiterhin. pnpm check bleibt Abschlussgate, dessen GUI-Anteile nach Desktopvorfall
nur in isolierter VM laufen dürfen; die fokussierte Suite ersetzt es nicht.
Nächster Schritt: tatsächliche Zielruntime-/Migrations-Faultpunkte im
Qualifikationsartefakt anbinden, originalen Profilreadback vor/nach Crash prüfen.

### Phase 5 – Unterbrechung innerhalb originaler SQLite-Migrationen

Voriger Turn Fortschritt:35 reale Coordinator-Prozessabbrüche grün, Candidate
7c97eadee gesichert. Zu Beginn CI34345599892 pending, Vorgänger34345111460 läuft.
Plan vor Änderungen: historischer Harness erhält optionalen Callback unmittelbar
nach dem originalen SQL einer Migration, noch innerhalb der originalen
applySchemaMigrations-Transaktion und vor user_version/Commit. Die vorhandene
Registry-Funktion nimmt bereits explizite Migrationsobjekte entgegen: nur die
vom Preflight aufgelösten Originalmigrationen dekorieren, keine SQL-Neufassung
und keine Änderung der normalen App. Callback meldet ID, Rolle, Versionen und
inTransaction; separater Utility-Abbruchfall muss dort SIGKILL auslösen.

Reihenfolge: typed Harness-Callback und Welt-/Loot-Weiterleitung; dessen Ort und
Originalaufruf mit gezielter Prüfung absichern; anschließend neues Testartefakt
mit Utility-Todesbeleg/Runner qualifizieren. Bei fehlendem/außerhalb Transaktion
liegenden Callback kein bestandener Abbruch. Quelle bleibt unangetastet, gestorbene
Arbeitskopie wird mit Originalruntime gelesen, danach Zielmigration neu gestartet
und vollständiger Readback verglichen. Der Callback allein ist kein Abnahmenachweis.

54278 terminalExit0:Harness-Lint, beide TypeScript-Projekte und6 vorhandene
Artifact-Runnerfälle bestanden. Neue migrate-kill-Operation schreibt vor dem
Utility-SIGKILL einen validierten Transaktions-/Migrationsbeleg; Main bindet ihn
an seine gestartete Worker-PID und speichert den beobachteten Utility-Exitcode.
Runner verlangt zugehörigen Abbruchbericht und fehlgeschlagene normale Antwort.
Der tatsächliche Exitcode und Datenrollback müssen im Gast noch geprüft werden.

29805 terminalExit0:Test-AppImage0.0.150 aus Originalquelle f633b896... (42/42),
unveränderter Sourcecheckout, neuer expliziter Harness.177044124Bytes,SHA256
c5460bb82ff02f04c81b0db0f4aca8d9209c995358350228344828ed6e5c1a8a,
work/historical-artifacts/migration-kill-target-v1. Gegenseite bleibt unverändertes
0.0.148(42/41). Payload-migration-kill-1 hashbindet beide Artefakte und aktuellen
uncommittierten Qualifier. Gastlauf74369 gestartet, separates neues Overlay,
keine Host-GUI. Ergebnis nicht aus erfolgreichem Build ableiten.

74369 terminal: migration-kill-run-1 GastExit0 UND TestExit0 nach33s. BerichtSHA
 a9c38ce269a2a41c2e3594565c1fb4e5d833a15c0070cb0fbbb284520797ffd4
unter evidence/qualification/migration-interruption-evidence.json. Beleg zeigt
PID1017, Auftragd83d677b-b92b-498a-bc4a-07b276aff1f9, beobachteter UtilityExit9,
SIGKILL nach campaign-41-to-42-active-loot-receipts bei inTransaction=true.
Unabhängig aus exportiertem Bericht verglichen: seeded==recovered==sourceAfter,
resumed.profile==after. Originalmigration erneut erfolgreich, Quelle unverändert.

Audit-Korrekturplan: Runner akzeptierte bisher jeden Nichtnull-Utilityexit;
Linux-SIGKILL wurde konkret als9 beobachtet. Auf literal9 verschärfen und den
aufbewahrten Bericht gegen dieselbe Vorgabe validieren; andere Exitursachen
zählen nicht. Keine neue Artefaktdatei für diese reine Orchestratorverschärfung.
Plan-Audit Migrationscallback/erster echter Abbruch erfüllt. Roadmap-Audit:
weitere Migrationsstände, komplette Updateaktivierung nach Fehler, Local-/Release-
Adaptergrenzen, Kapazitäts-/Zugriffsfehler bleiben eigenständige Abnahmefälle.

89796 terminalExit0: abschließender Harness-Lint, vollständige Typprüfung und6
Artifact-Runner-Tests bestanden. Aufbewahrter echter Gastbericht separat auf
workerExitCode===9 geprüft; Runner verlangt nun literal9. Abnahme gilt exakt für
die geprüfte erste 41→42-Migration im Arbeitsprofil, nicht den gesamten Updateweg.
Commit/Push als weiterer Candidate; keine Main-Promotion, kein Desktop-Handoff.

### Phase 5 – Utility-SIGKILL im tatsächlichen Release-Update

Voriger Turn Fortschritt: echter isolierter Migrationsabbruch mit vollständigem
Readback bestanden. Aktuell Candidate0e3526011, neue CI34346407184 pending,
Vorgänger34345599892 läuft. Arbeitsbaum sauber. Plan: optionales, ausdrücklich
hashdokumentiertes Wartungs-Wrappermodul ausschließlich im historischen
Test-AppImage. Originales gebautes maintenance.js unverändert als
maintenance-original.js behalten; Wrapper dekoriert better-sqlite3.exec, ruft
originales SQL unverändert auf und hält beim DDL der aktiven Loot-Receipts an,
wenn UserVersion41, offene Transaktion und expliziter isolierter Arm-Auftrag
passen. Parent-Qualifier sendet SIGKILL an genau diese Worker-PID, nachdem
Profilpfad/Arbeitskopie und Grenze nachgewiesen sind. Normale Releasebuilds
bekommen weder Wrapper noch neuen Schalter.

UI-Qualifier erweitert: Check/Download/Install per Oberfläche, auf Barriere warten,
Worker killen, verständliche Fehleranzeige und alte Programmversion prüfen;
Anwendung schließen, vollständiger Readback durch alte Runtime. Arm entfernen,
erneut öffnen und denselben geprüften Download installieren; bestehender ganzer
Weiterarbeiten-/Restorefall muss danach bestehen. Backup vor Fehler separat
validieren und erhalten. Keine erfolgreiche Abnahme durch Cleanup-Kills.
Gekoppelter Vorbereitungsfehler ist ein Fall; Aktivierungs-/Recoverygrenzen
bleiben separat offen. Originalmodule-/Wrapperhash im Artefaktbeleg erforderlich.

93439 terminalExit1:Lint markiert absichtlich gelöste exec-Methode. Sie wird
bereits mit original.call(this,sql) an dieselbe reale Datenbank gebunden;
Fixplan: genau diese Stelle mit begründeter Lint-Ausnahme kennzeichnen, keine
Änderung der SQLite-Ausführung. Anschließend Lint/Typprüfung wiederholen.

68228 Lint/Typprüfung terminalExit0.69909 Testartefaktbuild terminalExit0,
44.7s/2.6GiBSpitze. Vor Gasttest Prüfpräzisierung: erhaltene Sicherung nicht nur
auf Manifest/Dateihashes prüfen, sondern zusätzlich mit alter AppImage-Runtime
vollständig lesen und gegen Seed vergleichen. Qualifieränderung nach Buildende;
Artefaktbytes unverändert. Dadurch wird kein bloß vorhandenes Backup als korrekter
Sicherungsinhalt gewertet.

Test-AppImage0.0.151:177059542Bytes,SHA256
4741a6029e7608c3f68bdda3f43b27b8711539fbde03a2875272e57b7a428597.
Original gebauter Wartungseinstieg bleibt bytegleich mitSHA
bdc25b66cd4484b43a0ce3131c57129db0d39a367fb8923445d5d573ac9730db;
WrapperSHA cf2c2236f1f9e35fb0bb7396507021b265b2c751e3db2e29f1baa14fbef27ff1.
Receipt enthält beide Hashes und explizite Option; normales build:release wird
nicht verändert. Payload-update-crash-1 dokumentiert uncommittierten Qualifier.
82060 Gastlauf gestartet, ursprüngliche0.0.148 bleibt Vergleichsversion42/41.

82060 terminal: GastExit0/TestExit1 nach183s. Fehler ist nicht der Utilityabbruch:
Qualifier erreicht Wiederherstellung nach erfolgreichem Retry/Weiterarbeiten,
findet aber wegen zweier erwartbar vorhandener Backups keinen einzigartigen
Wiederherstellen-Button. Barriere belegt PID1109 in ursprünglicher Migration
innerhalb staged-d11f1dd2-41cd-48db-90f6-8506a8003ebc, gelöschte Kampagne .trash.
49065 Lint/Typprüfung terminalExit0. Kein voller UI-Pass aus Teilfortschritt.

Fixplan vor Änderung: gewünschte Vor-Update-Sicherung aus committed-Updatejournal
ermitteln; DOM-Zeile über sichtbares Datum (im Browser lokal formatiert) und
Version eindeutig identifizieren, normalen Mausclick auf deren Button begrenzen.
Keine Sicherungen löschen, keine erste beliebige Zeile wählen, keine direkte
Bridge-Aktion. Bestätigten Utility-Fehlerteil als eigenen Zwischenbericht sichern,
damit späterer Fehler seine bestandenen Vergleiche nicht verschwinden lässt.
Dann gleicher unveränderter Artefaktsatz in frischem Gast erneut vollständig.

60782 terminal: update-crash-run-2 GastExit0 UND TestExit0 nach80.9s. BerichtSHA
 eac69a16dd473c772126e0207604a114de1c3c8d2a93d537115f25dec6f2f1c5
unter evidence/qualification/ui-update-evidence.json. Barriere19b9196b-a8cc-481c-
96c0-16302252181d, Worker1109, staged-e399e417-f3c0-45ba-840a-255e4e490546,
.original-DLL41→42 in offener Transaktion einer wiederherstellbar gelöschten
Kampagne. Parent sendet SIGKILL nuranverifizierte Worker-PID. App zeigt
Unterbrechungsfehler, ursprüngliche Programmzuordnung und Profil bleiben gleich.
Eine vollständige Sicherung aus dem fehlgeschlagenen Versuch erhalten und mit
alter Runtime gelesen. Nach Entfernen der Arm-Datei vollständiger regulärer
UI-Update-/Weiterarbeiten-/Restoreablauf bestanden, dieselben AppImagebytes.

Unabhängige Exportprüfung: maintenanceCrash.readback==seeded; alle
backupReadbacks==seeded; after==restored==unchanged==seeded;
continued==protectedRead. Alle4 explizit gestarteten UI-Prozesse Exit0; der
Utilityabbruch ist getrennt dokumentiert, kein pauschaler Prozesskill als Pass.
Vorheriger Restore-Selektorfehler durch eindeutige sichtbare Backupzeile behoben,
keine Sicherung gelöscht. Plan-Audit dieses gekoppelten Vorbereitungsabbruchs
bestanden. Roadmap-Audit Phase5 weiterhin offen: SIGKILL an sämtlichen Aktivierungs-
und Recoverygrenzen in ausgelieferten Adaptern, weitere Kapazitäts-/Zugriffs-/
Kompatibilitätsfälle und abschließende unveränderte Artefakt-/CI-Gates bleiben.

17753 terminalExit0:abschließender Lint und beide Typprüfungen bestanden,
work/roadmap-phase5-update-crash-final2.log. Präzisierung des vorigen Eintrags:
„original-DLL“ war Schreibfehler; geprüft wurde originales DDL. Candidate-CI
34346407184 weiterhin in_progress; kein Green/Main-Abschluss behauptet.

### Phase 5 – Aktivierungsabbruch nach dauerhaftem Datenwechsel

Voriger Turn Fortschritt:gekoppelter Utility-Vorbereitungsabbruch/Retry/Restore
mit Originalwartung grün. Zu Beginn sauberer Candidate f6406409f, CI34347682840
in_progress. Plan vor Änderungen: historischer Main-Bootstrap lädt einen
Testbeobachter für originale fs.renameSync/openSync/fsyncSync/closeSync-Aufrufe.
Er ruft alle Originalfunktionen unverändert auf und pausiert erst nach erfolgreichem
fsync des Elternverzeichnisses einer erkannten Journal-/Profil-/Programmänderung.
Keine SQL-Änderung, keine neuen Schalter in normalen Releasebuilds. Expliziter
Arm-Auftrag mit ID/Punkt; Barriere enthält originalen Journalzustand und Main-PID.

Erster konkreter Fall: new-data-moved, Journal data-moving. UI führt echtes Update
bis zum Haltepunkt aus; Parent beendet die zugeordneten Appprozesse mit SIGKILL,
wartet auf deren Ende und startet den tatsächlichen aktuellen AppImage-Startpfad.
Die App muss vor Datenöffnung zurücksetzen, alte Version sichtbar bereitstellen,
Profil vollständig mit alter Runtime lesbar erhalten. Kein Test-Coordinator darf
Rollback ausführen. Danach vollständiger erneuter UI-Update-/Restorefall, ohne
Journal/Backup zu löschen. Vorheriges rolled-back-Journal als erwarteten
Ausgangszustand berücksichtigen statt fälschlich Null zu verlangen.

Anschließend dieselbe Beobachtung auf übrige Aktivierungs-/Recoverygrenzen
anwenden; erster Fall schließt deren gesamte Matrix nicht ab. Der stabile
Shellstarter und Local-Adapter benötigen weiterhin eigene End-to-End-Nachweise.

53056 terminalExit0:Lint und vollständige Typprüfung.18168 terminalExit0:beide
Test-AppImages aus unveränderten historischen Sourcecheckouts gebaut;
0.0.152(42/41)177048458Bytes SHA285562ac0e40f24a0cb734439e6f24311f070ece24b0e33655d0389cba825157,
0.0.153(42/42)177048079Bytes SHAc149e927db222c4863469ec78dcc1e36142e1bc274343ae7b4e845218889c8f3.
Payload-publication-crash-1 enthält hashgebundenen uncommittierten Qualifier;
91841 Gastlauf gestartet. Ereignisbeobachtung erfolgt nach originalem
Verzeichnis-fsync, nicht durch Exception statt Dateiumbenennung. Lauf noch keine
bestandene Abnahme; keine Host-Electron-Ausführung.

91841 terminal GastExit0/TestExit1 nach48.6s. Tatsächlicher Datenwechselabbruch
new-data-moved/data-moving wurde erreicht, alter Datenstand von App-Recovery
wiederhergestellt, activation-crash-evidence.json mit vollständigem Readback
liegt vor. Anschließender Retry wurde im Qualifier sofort fälschlich als Fehler
gemeldet: waitFor akzeptiert noch das rolled-back-Journal des vorherigen Versuchs.
Keine Produktkorrektur daraus ableiten; bisheriger Test erwartete leeres Journal.

Fixplan: Abschlusswarteschleife darf nur eine Transaktions-ID ungleich dem
startingJournal akzeptieren. Phase committed/rolled-back bleibt verpflichtend;
neuer tatsächlicher Rollback bleibt Fehler. Originalartefakte wiederverwenden,
vollständigen Gastfall erneut durchführen. Alten Beleg weder löschen noch resetten.

47481 terminal: publication-crash-run-2 TestExit0 nach87.8s. BerichtSHA
1259525343ddb697e8f885e96e3b06a23991e74dbe3e15a6adad912481470530.
Barriere new-data-moved, Journal data-moving; ursprünglicher AppImage-PID970
nachgewiesen SIGKILL. Tatsächlicher nächster Appstart setzt rolled-back; vier
weitere gestartete UI-Prozesse Exit0. Unabhängiger Exportvergleich:
activationCrash.readback==seeded; after==restored==unchanged==seeded;
continued==protectedRead.43671 Lint/Typprüfung terminalExit0.

Plan-Audit erster Aktivierungsfall bestanden; Roadmap-Audit gesamte Matrix offen.
Nächste unveränderte Fälle: journal:data-ready und program-linked, jeweils frisches
Profil und kompletter Recovery-/Retry-/Restorefall. Gleiche AppImage-/Qualifier-
Bytes, nur explizit gewählter Barrierenname und getrennte Testhome-Verzeichnisse.
Beide nacheinander in derselben begrenzten VM; Fehler eines Falls stoppt die Folge.

86952 terminal: publication-pair-run-1 GastExit0/TestExit0 nach162.2s. Beide
nacheinander ausgeführten Fälle vollständig bestanden, identische Artefaktbytes:
- journal:data-ready / Journal data-ready:ReportSHA
89437437405fcecb5df0fb57a04edc1b271d0305f260281016e056b847866f9c.
- program-linked / Journal program-moving:ReportSHA
6465be10afafef9a162d9229386d1e69c6a6765438a358e4aad818e44af87a45.
Beide Exporte unabhängig gelesen:App-Recovery rolled-back,
activationCrash.readback==seeded; after==restored==unchanged==seeded;
continued==protectedRead. Der program-linked-Fall startet tatsächlich das nun
verknüpfte Ziel-AppImage; dieses stellt vor Datennutzung das alte Paar wieder her.

Plan-Audit drei konkrete Aktivierungsgrenzen bestanden. Roadmap-Audit weiterhin
offen:prepared/data-moving/old-data-moved/program-moving/awaiting-start,
Unterbrechung der Recovery selbst, stabiler Starter/Local-Adapter und weitere
Fehlermatrix. Keine Phase5-/Public-Release-Freigabe aus den drei Fällen.

CI34347682840 für unveränderten Candidate f6406409f ist jetzt terminal success.
Dieser Nachweis deckt den vorigen Utility-Abbruchstand ab, nicht die noch
uncommittierte neue Aktivierungsbeobachtung. Letztere wird separat gesichert und
benötigt ihren eigenen vollständigen Check; kein Main-/Handoffabschluss daraus.

### Phase 5 – Übrige Aktivierungsgrenzen mit unveränderten Artefakten

Voriger Turn Fortschritt:drei echte Aktivierungsfälle grün, Candidate23d418557
gepusht. Plan:die übrigen fünf Vorwärtsgrenzen journal:prepared,
journal:data-moving, old-data-moved, journal:program-moving,
journal:awaiting-start nacheinander mit unveränderten0.0.152/0.0.153 und
Payload-publication-crash-2 prüfen. Jeweils frisches Testhome, kompletter
App-Recovery-/Retry-/Weiterarbeiten-/Restorefall, Stop bei erstem Fehler.
VM-Laufzeitlimit900s; keine Host-Appstarts oder Daten-/Codeänderung während Lauf.
Dies schließt weder Recovery-Unterbrechungen noch Commit-/Local-/Starterfälle.

Folgerundenplan nach Ende des laufenden Tests: Recovery-Unterbrechung ohne
vorweggenommene Renderer-Verbindung. launch() in unveränderten Spawnteil und
anschließende CDP-Verbindung trennen; nach initialem Aktivierungstod neuen
Arm-Auftrag setzen, App nur starten, vor Fenstererstellung erreichte Recovery-
Barriere abwarten, dieselbe Journal-ID und zugeordnete PID prüfen, erneut SIGKILL.
Erst danach normal starten und vollständige alte sowie erhaltene fehlgeschlagene
Profilbäume mit ihren AppImages lesen. Kein hängender connect()-Versuch darf in
einen späteren Start hineinreichen. Historischen Observer für dauerhaftes
maintenance-history-Journal ergänzen; Originalfunktionen/SQL unverändert.
Codeänderungen erst nach terminalem Status des aktuellen VM-Laufs.

9230 terminal:GastExit0/TestExit0 nach403.96s, alle5 übrigen Vorwärtsfälle grün.
Export unabhängig geprüft:jeweils activationCrash.readback==seeded,
after==restored==unchanged==seeded, continued==protectedRead, App-Recovery
rolled-back. Berichtindex unter publication-remaining-run-1/validated-report-index.json:
- journal:prepared ef7156071e7a89e3154572125927ce96d0cb5894407fb204f40f963c6dda7c54
- journal:data-moving 7d1dbcfaa73d16527718ccb7ff037d1aad837e06cf2848657daa81fc9ed7eb33
- old-data-moved 1dc3dead23ea927f7659f09ff36773b18a2971e6c9096e66f08bfbc96437c931
- journal:program-moving 97fc82ca9a17df26bc9c6ab77bd668c8066d925d1f1502cc76a1522c34d5f509
- journal:awaiting-start a0c100ca2757d6d068079bd177d3ef481efb145f272bde4b8940c7d5a5a55f89
Zusammen mit den3 vorigen Fällen acht Vorwärtsgrenzen vor Bestätigung geprüft.
Keine Aussage über Unterbrechung während Recovery oder nach committed daraus.

Konkreter nächster Pilot gemäß Folgerundenplan: --activation-crash new-data-moved
plus --recovery-crash failed-data-preserved mit unveränderten0.0.152/0.0.153.
Beobachter unterstützt diesen Punkt bereits; keine neue Artefaktdatei notwendig.
Wiederhergestelltes altes Profil UND aufbewahrtes fehlgeschlagenes Zielprofil
mit ihrer jeweiligen Runtime vollständig lesen. Historiengrenze erst danach
ergänzen. Arbeitsbaumänderung erst nach terminalem9230.

21870 terminalExit0:Lint/Typprüfung des erweiterten Qualifiers.42105 terminal:
recovery-crash-run-1 GastExit0/TestExit0 nach91.53s. BerichtSHA
06c6910d166cb8031fe92708622846094c5955cfafc1993368d80a9745f7c09c.
Zweiter Abbruch failed-data-preserved, Journal rollback-preserving derselben
Transaktion. Zwei explizite AppImage-PIDs967/1146 beobachtet SIGKILL, anschließend
vier normale Exit0. Kein wartender CDP-Verbindungsversuch beim Vorfenster-Abbruch.
Unabhängige Exportprüfung:altes readback UND failedReadback==seeded;
Recovery rolled-back; after==restored==unchanged==seeded;
continued==protectedRead. Beide Profilbäume vollständig erhalten und mit passender
AppImage-Runtime gelesen, anschließend ganzer UI-Retry-/Restorefall bestanden.

Plan-Audit Recovery-Pilot bestanden. Roadmap-Audit übrige Recoverygrenzen,
Historienübergang, committed/Starter/Local und weitere Fehlermatrix bleiben offen.
Nächste unveränderte Matrix:Activation program-linked, dann Recovery an
journal:rollback-started, journal:rollback-preserving, journal:rollback-restoring,
old-data-restored, journal:rollback-program, program-linked, journal:rolled-back.
So wird auch Rückkehr vom bereits ausgewählten Zielprogramm geprüft. Historien-
beobachtung erfordert separat ergänzte Testartefakte, keine Produktionsänderung.

### Phase 5 – Weitere Recoverygrenzen nach Programmwechsel

Voriger Turn Fortschritt:acht Vorwärtsgrenzen und Recovery-Pilot grün,
Candidate35a486c41 gesichert. Plan:unveränderte0.0.152/0.0.153 und
Payload-recovery-crash-1 für sieben weitere Recoverypunkte verwenden.
Erster SIGKILL jeweils program-linked, zweiter an journal:rollback-started,
journal:rollback-preserving, journal:rollback-restoring, old-data-restored,
journal:rollback-program, program-linked, journal:rolled-back. Pro Fall frisches
Profil; beide Profilbäume und kompletter Retry-/Restoreablauf müssen bestehen.
Sequenzieller Gastlauf, Stop bei erstem Fehler, Gast-/Hostdeadline1200s.
Keine Codeänderung während Lauf; Historiengrenze/Commit/Local/Starter bleiben offen.

### Phase 5 – Unterbrechung des Nachweisexports und Historiengrenze

Voriger Turn Fortschritt: Host-Absturzprotokolle erneut gelesen und den eigenen
laufenden VM-Container auf Nutzerwunsch gestoppt; keine weiteren Host-Appstarts.
Aktueller Zustand: kein laufender Qualifikationscontainer. Der erhaltene serielle
Lauf recovery-remaining-run-1 meldet sieben erfolgreiche Fälle und TestExit0,
aber QUALIFICATION_EXPORT_END fehlt. Daher kein vollständiger unabhängiger
Berichtvergleich und keine abgeschlossene Abnahme dieser sieben Fälle. Die
Overlaydatei bleibt für spätere ausschließlich lesende Berichtgewinnung erhalten.

Korrekturrundenplan: ausschließlich historischen Test-Beobachter um dauerhaft
veröffentlichtes maintenance-history/<Transaktion>-rolled-back.json erweitern.
Das vorhandene Original-rename und Original-fsync müssen zuerst erfolgreich
sein; nur das Historienverzeichnis dieser Installation und die konkrete laufende
Transaktion dürfen den Punkt rollback-history-written auslösen. Danach gezielte
Lint-/Typprüfung und vorhandene echte Koordinator-Unterbrechungstests in begrenzter
Host-Servicegruppe ohne Electron. Gepackter Nachweis erfordert anschließend neue,
versionierte Testartefakte und einen isolierten Gastlauf; er ist durch diese
Quelländerung nicht erbracht. Phase 5 und die Gesamtroadmap bleiben offen.

Korrektur nach tatsächlicher Exportauswertung: Der gzip-Stream ist unvollständig,
aber alle sieben vollständigen ui-update-evidence.json-Dateien liegen vor dem
Abbruch. Sie wurden einzeln ohne Teil-JSON-Akzeptanz gelesen und separat abgelegt
unter recovery-remaining-run-1/partial-export-validated. Beide Artefakthashes
stimmen mit 0.0.152/0.0.153 überein; je zwei erwartete SIGKILL und vier Exit0.
Alle vollständigen Profilvergleiche bestanden: readback und failedReadback sowie
after/restored/unchanged entsprechen seeded; continued entspricht protectedRead.
Beide Unterbrechungen gehören jeweils derselben Journal-ID, Recovery rolled-back.
Der komplette Logexport bleibt unvollständig, die sieben Ergebnisberichte sind
unabhängig geprüft. Ihre SHA-256:
- journal:rollback-preserving d3d71c1e825ed994897d0883fec39dc9e19da418cab237141c81d5330a16eb3d
- journal:rollback-program 127bd129103d4d11719da75550c51ff98cc81e7c1e80de86926ef8c9f8633ce3
- journal:rollback-restoring 3453efa27ffee5c05068b90ddaca9aeaf9e03aff4892c396e66263140e3b986a
- journal:rollback-started 7256c3648a9f33f8a2b735167aa6d61fe84c67473fe3296e380936ada388b7e6
- journal:rolled-back 1f0d29ce7b291848ae2f204af91cae523413b68eb70801d6c8d90772744a6e79
- old-data-restored bd5d384a9285d1dc707f8bf6c7ca5228850758ac5773332f89b65a08019db3ae
- program-linked a61ec12d5a9c65cacff1a29833f1bda374d110239d41091000c98ef645834951

86263 terminal laut Serviceprotokoll: Lint, beide Typprüfungen und 35 vorhandene
Koordinator-Prozessabbruchtests grün; Spitzen-RAM 1.5 GiB, kein Swap, kein Electron.
Plan-Audit: Beobachter ergänzt und lokal geprüft. Roadmap-Audit: gepackte
Historiengrenze weiterhin offen; keine Phasenfreigabe.

Nächster konkreter Plan: neue Testartefakte 0.0.154/0.0.155 aus unveränderten
extraction-baseline/extraction-target mit ergänztem historischem Bootstrap bauen.
Danach isolierter vollständiger UI-Fall: activation program-linked, recovery
rollback-history-written, beide Profilbäume und Retry/Weiterarbeiten/Restore prüfen.
Keine parallelen Quelländerungen während Build/Test. Keine öffentlichen Assets,
kein Main-Handoff und keine echten Nutzerprofile werden hierbei verändert.

70210 terminalExit0: beide neuen historischen Test-AppImages gebaut.
0.0.154 SHA25be40406418275d60b31cdbcd5c4980aec3888916466385edbe69a966003169
(177048228 Bytes), 0.0.155
SHAb89464df053290c8b6469dbe8a98cea3ba87021889213435db1ad24129c2cb3b
(177048138 Bytes). Beide Herkunftsbelege enthalten den Hash des erweiterten
Testbeobachters; Originalquellen ab32/f633 und Schemas42/41→42/42 unverändert.
58415 terminalExit0; history-crash-run-1 TestExit0, vollständiger Export gelesen.
BerichtSHA af1f82c11ba405e5a248507e35a05db2daf695e43865c3a2a42b05afc5a1b926
Initialer Abbruch program-linked, zweiter rollback-history-written im Zustand
rollback-program derselben Transaktion. Zwei erwartete SIGKILL und vier Exit0.
Unabhängiger Vergleich beider vollständiger Profilbäume, Retry, gespeicherter
Weiterarbeit, Restore, vorgeschalteter Sicherung und unveränderter Quelle grün.

Plan-Audit Historiengrenze bestanden einschließlich echtem AppImage-Ablauf.
Roadmap-Audit: Phase5 bleibt offen (u.a. gepackte Commit-/Starter-/Local-Fälle,
Platz-/Zugriffs-/WAL-/Import- und weitere Fehlermatrix); Phasen6/7 unverändert offen.
Keine Host-GUI gestartet, keine Nutzerdaten verändert, kein Release veröffentlicht.

### Phase 5 – Dauerhafte Annahme des Updates

Voriger Turn Fortschritt: historische Recoverygrenze mit AppImages grün,
0585fd78b gepusht. Arbeitsbaum sauber, kein Qualifikationscontainer aktiv.
Plan: UI-Qualifier um --commit-crash ergänzen. Historischen Beobachter vor
normalem UI-Update auf journal:committed scharfstellen; nach erfolgreichem
Original-fsync Ziel-Main anhand eigener Prozesse zuordnen und SIGKILL auslösen.
Beim nächsten echten Appstart müssen dasselbe committed-Journal und Zielprogramm
bestehen bleiben. Anschließend vollständigen Datenvergleich, Weiterarbeiten,
zusätzlichen --accepted-crash nach gespeicherter Arbeit und Restore prüfen.
Vorhandene unveränderte0.0.154/0.0.155 unterstützen diesen Beobachterpunkt bereits.
Nur Testdriver ändern; Lint/Typprüfung ohne GUI, dann ein isolierter Gastlauf mit
neuem Payload und vollständigem Berichtsexport. Keine Test-/Quelländerung während
Lauf, keine Freigabe allein anhand eines beobachteten Journalwerts.

27042 terminalExit0: Lint und beide Typprüfungen grün. 26121 terminalExit0,
commit-crash-run-1 TestExit0 und vollständiger Export. Unveränderte Testartefakte
0.0.154/0.0.155. BerichtSHA f8040582fe0e01126580ac984b5ebb7de8077ef7525b1f3b9843048752bd36df
Abbruch unmittelbar nach dauerhaftem journal:committed; echter Neustart behält
dasselbe vollständige Journal und Zieldeployment. after/restored/unchanged==seeded.
Spätere gespeicherte XP-Änderung überlebt zusätzlichen SIGKILL und Neustart;
acceptedCrash.readback==continued==protectedRead, dieser Stand unterscheidet sich
vom Seed. Wiederherstellung erhält spätere Arbeit in vorgeschalteter Sicherung.

Plan-Audit Annahmegrenze bestanden. Roadmap-Audit Phase5 bleibt offen für
Starter-/Local-Integration und übrige Daten-/Umgebungsfehlermatrix. Remote Check
34350796115 für35a486c41 ist vollständig grün; daraus folgt keine Freigabe des
geänderten aktuellen Candidate-Stands. Keine Host-GUI, kein Main-/Nutzerhandoff.

### Phase 5 – Update und Recovery über den installierten Startpunkt

Voriger Turn Fortschritt: dauerhafte Annahme plus Erhalt späterer Arbeit mit
AppImages grün,5c852f3b7 gepusht. Arbeitsbaum sauber, keine laufende Test-VM.
Plan: --installed-launcher im UI-Qualifier ergänzt echten Installationsstartpunkt
über installMaintenanceLauncher mit aus unverändertem Baseline-AppImage gelesenem
Originalhelfer. Alle expliziten Appstarts laufen dann über root/start; Herkunft
vor jedem Start sowie nach Abschluss prüfen und Startweg im Bericht festhalten.
Pilot: Aktivierung old-data-moved abbrechen (Profil fehlt zeitweise), anschließend
Recovery über den installierten Starter, vollständiger alter Datenvergleich und
normaler UI-Update-/Weiterarbeiten-/Restorefall. Keine Test-Recoveryfunktion.
Historischer Main-Beobachter kann nicht im eigenständigen Originalhelfer pausieren;
--recovery-crash zusammen mit diesem Startweg deshalb ausdrücklich ablehnen, nicht
stillschweigend einen ungeprüften zweiten Abbruch behaupten. Beobachtung dieses
Helfers bleibt separat offen. Vorhandene0.0.154/0.0.155 unverändert verwenden.
Lint/Typprüfung und anschließend isolierter Gastlauf; keine Quelländerung während
Build/Test, keine Host-GUI oder echten Nutzerprofile.

49300 terminalExit0: erster Driverstand Lint/Typen grün. Statischer Integrations-
Audit vor Gaststart findet fehlenden initialen Wartungsbeleg der bisher direkt
gestarteten Fixture. Korrekturplan: Baseline als echte Installations-Transaktion
aktivieren und ausschließlich diesen ersten Start mit --release-complete direkt
anstoßen. Erst die App bestätigt ihre Daten; danach alle Starts über root/start.
Fehlerfälle müssen den bestätigten initialen Beleg unverändert lassen statt null
zu erwarten. Kein künstlicher committed-Beleg, kein Test-Koordinator-commit.

18414 terminalExit0: korrigierter Driver Lint/Typen grün. Weitere statische
Prüfung vor Gaststart: installLauncher wird bei jedem Update aufgerufen. Die
alten ab32/f633-Testartefakte würden daher die dort noch alte Shellimplementierung
installieren. Neue explizite Vergleichsquellen sind erforderlich: Baseline ab32
mit ausschließlich aktuellem src/shared/maintenance/launcher.ts (Schemas und SQL
unverändert42/41), Ziel aktueller geprüfter Quellstand5c852f3b7 (42/42). Baseline
separat committen und veröffentlichen, beide immutable IDs im Quellenkatalog
registrieren. Neue Testversionen0.0.156/0.0.157; bestehende Assets unverändert.
Dies ist ein dokumentierter Vergleichsstand, kein nachträgliches Verändern alter
Releasebytes oder eine künstliche Migration. Erst danach Starter-Pilot ausführen.

73409 terminalExit0: neue Testartefakte0.0.156/157 gebaut.63927 terminalExit0:
Gast-TestExit0 nach121.5s, aber serieller Export enthält eine abgebrochene Base64-
Zeile während Shutdown-Ausgaben (14 statt76 Zeichen), gzip deshalb ungültig.
Kein vollständiger Berichtvergleich behauptet. Korrekturplan nur Gast-Export:
ui-update-evidence.json gezielt exportieren, Ausgabe flushen und zehn Sekunden
vor Shutdown zum Austragen des Konsolenpuffers lassen. Dasselbe unveränderte
Payload erneut in frischem Gast und Testhome ausführen; kein Quell-/Artefaktwechsel.

62948 terminalExit0, installed-update-run-2 TestExit0 und vollständiger Export
mit gültigem gzip. BerichtSHA 3fdc016f5f2082eac8daa849b8e45e84576f1e5aa29400c6c88af419e2634fc0
Baseline0.0.156 SHA8b6776d37bb8efa5a56bb625cb8e43249847253291517f51ebaba5d43cfd4286
(177048277 Bytes), Ziel0.0.157
SHA9b23022f613491ad3b55be0eac2fd8088549d7b56a261e2ec14d9698d30effd8
(177048160 Bytes). Initialer Abschluss durch Baseline-Runtime; danach Starts über
den installierten, hashgeprüften Shellstarter. Abbruch old-data-moved, Recovery
rolled-back mit altem Programm; vollständiger alter Profilvergleich bestanden.
Anschließend UI-Update, Schemawechsel, Weiterarbeiten und Restore grün:
after/restored/unchanged==seeded; continued==protectedRead. Keine Test-Recovery
und kein künstlicher commit. Neuer Quellenkatalog referenziert Baselineb64a408a5
und Ziel5c852f3b7 mit unveränderten echten Schemaständen42/41→42/42.

Plan-Audit Starter-Pilot bestanden. Roadmap-Audit: weitere Startergrenzen, Abbruch
im eigenständigen Helfer, Local-Adapter und übrige Fehlermatrix bleiben offen.
Phase5 nicht abgeschlossen; keine Freigabe/Handoff/Veröffentlichung.

### Phase 5 – Übrige Aktivierungsgrenzen über installierten Starter

Voriger Turn Fortschritt: Starter-Pilot old-data-moved vollständig geprüft und
9449f8d56 gepusht. Aktuell sauberer Arbeitsbaum und keine laufende Test-VM.
Plan: unverändertes Payload-installed-update-1 und Artefakte0.0.156/0.0.157 für
sieben weitere Aktivierungsgrenzen verwenden: journal:prepared,
journal:data-moving,new-data-moved,journal:data-ready,journal:program-moving,
program-linked,journal:awaiting-start. Achter Fall --commit-crash --accepted-crash
über denselben installierten Startpunkt. Pro Fall eigenes frisches Profil, echte
Baseline-Installationsbestätigung und kompletter UI-/Datenvergleich/Restore.
Sequenziell, Stop beim ersten Fehler; begrenzter Gast mit RuntimeMaxSec1800 und
Hostdeadline1800. Vollständige Ergebnisberichte exportieren, zehn Sekunden vor
Shutdown austragen lassen. Keine Code-/Teständerungen während des Laufs. Der
Originalhelfer wird dabei als Recovery-Einstieg geprüft, sein eigener interner
Abbruch und Local-/WAL-/Platz-/Zugriffs-/Importmatrix bleiben weiterhin offen.

Read-only Folgerundenaudit während Startermatrix: scripts/local-app-installation.ts
bindet den gemeinsamen Koordinator inklusive afterMaintenanceBoundaryForTest und
renameForInstall tatsächlich an; bestehende tests/unit/local-app-installation.test.ts
werfen LocalInstallCrashForTest (ab Zeile760/818), belegen aber keinen realen
Prozessabbruch. verifyLocalRuntimeStartup verlangt die tatsächliche committed-
Bestätigung des Kindes und versucht bei Fehlern gemeinsamen Rollback (der nach
committed wirkungslos bleibt). Nächster Local-Nachweis muss den unveränderten
Installer in separatem Prozess mit SIGKILL am vorhandenen Hook sowie vollständigen
Profil-/Desktop-/Programmvergleich verwenden; echte Local-Artefaktannahme bleibt
separater Pflichtnachweis. Kein Schluss von synthetischen AppImagebytes auf Runtime.
Implementierung erst nach terminalem Status der aktiven Startermatrix.

Fortsetzungsprüfung: Session43001 erneut live bestätigt, unveränderter Container
5d7a28f5-ba79-4421-b2bd-f524ae5d3d4e. Serielle Erfolgsmeldung für ersten Fall
journal:prepared bei Gast154.201s; übrige sieben Fälle noch aktiv. Dies ist eine
Laufmeldung, noch kein vollständiger Export-/Berichtvergleich der Matrix.
Read-only Local-Audit konkretisiert: bestehende Fixture verwendet künstliche
artifact-a/b-Bytes und synthetischen Helfer; installAndAccept bestätigt im Test
per coordinator.commit. Für den echten Prozessabbruchtest müssen diese Grenzen
im Bericht ausdrücklich bestehen bleiben. Aussage über Prozess-/Daten-/Desktop-
Recovery ist möglich, eine gepackte Local-Runtime-Abnahme folgt daraus nicht.

### Phase 5 – Wiederaufnahme nach abgebrochenem Tool-Turn

43001 ist nach explizitem Turn-Abbruch nicht mehr vorhanden; podman ps zeigt keinen
Testcontainer. Kein exit-code und kein Exportabschluss im bisherigen Lauf. Der
Lauf gilt beendet, nicht bestanden. Erste Erfolgsmeldung journal:prepared bleibt
indirekte Evidenz ohne vollständigen Bericht. Kein paralleler Neustart.
Korrekturplan: kleinere Gruppen mit Export nach jedem abgeschlossenen Fall.
Unverändertes Payload-installed-update-1 zuerst für journal:prepared und
journal:data-moving erneut verwenden, jeweils eigenes Profil. Snapshotexport vor
Beginn des nächsten Falls, damit eine spätere Unterbrechung frühere Nachweise nicht
verliert. Fehler stoppt die Gruppe; finaler TestExit und separate Exportmarker.
Danach übrige Aktivierungs- und Commitfälle fortsetzen. Keine Quell-/Artefaktänderung.

### Betriebsfehler – Host-Speicherplatz am 10. September 2026

Nutzer meldet volle Rootpartition. Verifiziert:231GiB gesamt,5.4MiB frei;
209GiB im eigenen work-Verzeichnis,176GiB davon qualification-vm. Keine aktive
Test-VM oder Buildprozesse. Ursache: unbegrenzt aufbewahrte beschreibbare Testdisks.
Acht abgeschlossene guest.qcow2-Dateien mit vorhandenem vollständigem UI-Bericht
und TestExit0 entfernt:installed-update-run-2,history-crash-run-1,commit-crash-run-1,
publication-remaining-run-1,publication-pair-run-1,recovery-crash-run-1,
publication-crash-run-2,update-crash-run-2. Berichte, Logs, AppImages, Quellcode,
Basisimage und Nutzerprofile unverändert. Danach73GiB frei (69% belegt).

Korrekturplan vor neuer Qualifikation: VM-Runner muss vor Ausgabeordner/Container
mindestens40GiB freien Hostspeicher verlangen (24GiB maximale Gastdisk plus16GiB
Reserve). Fehlermeldung mit tatsächlich verfügbarem Speicher und nächster Aktion.
Ablehnung bei4MiB durch kontrollierte df-Antwort testen; kein Container/Output darf
entstehen. Nach künftigem validiertem Berichtsexport disposable guest.qcow2 sofort
entfernen; fehlende/ungültige Exporte zuerst klären. Keine automatische Löschung
von Nutzer-Backups oder Beweisen. Roadmaparbeit pausiert bis Betriebsprüfung grün.

Speicherwächter geprüft: bash-Syntax grün; kontrollierte Werte4MiB,40GiB-minus1Byte
und unlesbarer Kapazitätswert jeweils Exit2 mit verständlicher Meldung. Kein
Ausgabeordner und kein Podman-Aufruf. Keine VM gestartet. Host weiterhin73GiB frei.
Plan-Audit Betriebsentlastung und Vorabgrenze bestanden. Gesamtroadmap weiterhin
offen; komplette pnpm-check/CI-Freigabe wird dadurch nicht ersetzt.

Wiederaufnahme nach Platzentlastung: sauberer Candidatebe4d624b6,73GiB frei,
keine laufende VM. installed-pair-run-1 enthält nur host-boot-id und ist kein
qualifizierter Lauf. Bestehendes unverändertes installed-pair-seed-1 in frischem
installed-pair-run-2 gestartet (Session9015,Deadline600s). Neuer Speicherwächter
hat den Start zugelassen. Nach vollständigem Exportvergleich guest.qcow2 entfernen.

CI-Audit während Lauf9015: Check34354498665 für9449f8d56 fehlgeschlagen.
Portable-Job102475876503 scheitert ausschließlich am vorangestellten
prettier --check .: publication-interruption.ts und qualify-historical-ui-update.ts
nicht formatiert. Aggregat folgerichtig fehlgeschlagen; keine Gesamtfreigabe.
Korrekturplan nach terminalem Gastlauf: beide Dateien mit Repository-Prettier
formatieren, Formatprüfung und Lint prüfen, neuen Candidate committen/pushen und
exakte vollständige CI abwarten. Bestehende AppImagebytes bleiben unverändert.

9015 terminalExit0 des Gastes, aber kein TestExit: cloud-init scheitert schon beim
Kopieren aus installed-pair-seed-1.img mit Input/output error (AppImagebaseline,
Ziel-AppImage und Manifest). Das vor/bei vollem Host erzeugte ISO ist unbrauchbar;
kein Appstart und keine Abnahme. Korrektur: Payload-SHA256SUMS verifizieren, neues
ISO mit neuer Kennung erzeugen und beide enthaltenen AppImages vor Gaststart per
isoinfo auslesen und gegen Originalhash vergleichen. Alten Fehlstart-Datenträger
nach gesichertem Diagnoseprotokoll entfernen; keinerlei Nutzerdaten darin.

16242: beide AppImages direkt aus neuem installed-pair-seed-2.img gelesen;
Dateigröße und SHA256 stimmen vollständig mit Originalartefakten überein. Alle
Payload-SHA256SUMS grün. Alte Fehlstart-Guestdisk entfernt, Diagnose-Log erhalten.
Prettier korrigiert beide gemeldeten Dateien; gezielter Formatcheck und Lint grün.
Änderungen betreffen ausschließlich Formatierung, keine AppImagebytes verändert.

installed-pair-run-3 (Session46337) live: erster kompletter Export während laufender
VM unabhängig gelesen und geprüft. journal:prepared BerichtSHA
ded65decad0a40134c5b522070e2e7258239c8c8ee710527bc0b31b6b9866467.
Hashgeprüfte0.0.156/0.0.157, Startweg installed-launcher, Recovery rolled-back;
readback/after/restored/unchanged==seeded,continued==protectedRead. Bericht unter
installed-pair-run-3/validated/journal-prepared.json gesichert. Zweiter Fall
journal:data-moving noch aktiv; Guestdisk erst nach terminalem Gesamtstatus und
verifiziertem zweitem Bericht entfernen. Kein Neustart bei bloßem Beobachtungsende.

46337 terminalExit0,installed-pair-run-3 TestExit0 nach370.1s. Alle drei
Exportarchive vollständig inklusive gzip-Prüfsumme gelesen. Beide Berichte
unabhängig verglichen: vollständige Profile, Quelle, Retry/Weiterarbeiten/Restore
und vorgeschaltete Sicherung stimmen. SHA256:
- journal:prepared ded65decad0a40134c5b522070e2e7258239c8c8ee710527bc0b31b6b9866467
- journal:data-moving 546b23190f91b0406f6836513747d806dabaf18685235160eef5dffb1925c3fc
Nach terminalem Status und abgeschlossener Prüfung guest.qcow2 entfernt;
Berichte, Logs, Herkunft und Original-AppImages bleiben erhalten. Plan-Audit
Zweierlauf bestanden. Roadmap-Audit weitere Startergrenzen/Local/Fehlermatrix offen.

Nächster Zweierplan: unveränderte0.0.156/157 und Payload-installed-update-1,
Abbrüche new-data-moved und journal:data-ready über installierten Starter.
Je frisches Profil und Export nach abgeschlossenem Fall; vollständiger
Retry-/Weiterarbeiten-/Restore-/Profilvergleich. Neues Seed,Deadline600s.
Nach validiertem Export wieder Gastdisk entfernen. Keine Quelländerung während Lauf.

Dokumentationsabgleich während unveränderter Testinputs: Abnahmematrix M05/M06
enthält noch pauschale ältere Testangaben. Plan: ausschließlich diese Evidenzfelder
mit den bereits exportgeprüften AppImage-Abbrüchen, durable-commit/later-work und
drei nachgewiesenen Startergrenzen präzisieren. Laufende Fälle nicht als bestanden
aufführen. Canonical roadmap unverändert; verbleibende Grenzen ausdrücklich offen.

89755 weiterhin aktiv: erster Bericht new-data-moved aus vollständigem gzip-Export
geprüft, SHA65f197ec6d53bf13731ca47750c8f9e9a784d26d3e4233e53d1d8d69bd8f592a
Startweg installed-launcher; Artefakthashes bestätigt, vollständiger alter
Profilvergleich und Retry/Weiterarbeiten/Restore/Quellerhalt grün. Zweiter Fall
journal:data-ready noch offen; Gastdisk bleibt bis zum terminalen Status erhalten.

89755 terminalExit0,installed-data-run-1 TestExit0 nach535.2s. Alle drei
Archive vollständig inklusive gzip-Prüfsumme geprüft; beide vollständigen
Profilvergleiche, Source/Retry/Weiterarbeiten/Restore und Sicherungen grün. SHA256:
- new-data-moved 65f197ec6d53bf13731ca47750c8f9e9a784d26d3e4233e53d1d8d69bd8f592a
- journal:data-ready 81a3c245369f9eeffeedd0e1a459ef9f5957e4a7a8784793d981eb5ee09f1518
Guestdisk nach terminaler Abnahme entfernt; alle Belege erhalten. Plan-Audit
Datenübergänge bestanden. Noch offen: Starter-Programmwechsel, awaiting-start und
committed/later-work; eigener Helfer-Abbruch,Local und übrige Fehlermatrix.

Nächster Zweierplan: journal:program-moving und program-linked über installierten
Starter; unveränderte0.0.156/157, eigenes Profil je Fall, Export nach jedem Fall,
vollständiger UI-/Daten-/Restorevergleich. Gast-/Hostdeadline900s, da vorherige
Gruppe535s benötigte; Ressourcen- und40GiB-Speichergrenze unverändert. Gastdisk nach
validierter Abnahme entfernen. Noch keine Quelle während laufendem Test ändern.

Remote-Gate: Check34455617730 für exakt4cc692ba06be45d75b73d36070d202ca80fe5cc8
completed/success verifiziert. Dies bestätigt die vollständige CI dieses
committeten Stands, nicht die zusätzlich noch laufenden Starterfälle oder einen
Main-Handoff. Lokale Dokumentationsfortschreibung liegt noch uncommittet vor.
Aktuelle Session87965 installiert unveränderte0.0.156/157 und bleibt aktiv.

87965 live: journal:program-moving komplett exportiert und unabhängig geprüft.
BerichtSHA 5b672e4b252bdfce19505082aed0283cb7f1cc838733100ec354ac140cd8b597
Passende Artefakthashes, installierter Starter, Recovery rolled-back; vollständige
Profilvergleiche/Retry/Weiterarbeiten/Restore/Quellerhalt grün. Zweiter Fall
program-linked läuft weiter; Guestdisk noch erforderlich.

87965 terminalExit0,installed-program-run-1 TestExit0 nach426.9s; drei vollständige
gzip-Archive einschließlich Prüfsummen verifiziert. Beide Programmwechselgrenzen
über installierten Starter bestehen vollständigen Profil-/Update-/Restorevergleich.
- journal:program-moving 5b672e4b252bdfce19505082aed0283cb7f1cc838733100ec354ac140cd8b597
- program-linked a9d6b54d20211866b9d79e6feb490098e3acdcc4fc686352d75031184d4590d6
Gastdisk nach Abnahme entfernt, alle Berichte und Logs bleiben. Plan-Audit
Programmwechsel bestanden; awaiting-start und committed/later-work über Starter
sowie weitere Local-/Fehlermatrixnachweise bleiben offen. Keine Phasenfreigabe.

Letzter Zweierplan der Starter-Reihe: journal:awaiting-start und separater Fall
--commit-crash --accepted-crash. Unveränderte0.0.156/157 und Payload, eigener
Installationsabschluss/Profil je Fall, unabhängiger Export nach jedem Fall,
Deadline900s und bisherige Ressourcenreserve. Im zweiten Fall muss derselbe
committed-Beleg erhalten bleiben und später gespeicherte Arbeit nach erneutem
SIGKILL sowie vorgeschalteter Restore-Sicherung exakt übereinstimmen. Nach
terminalem Gesamtstatus/validiertem Export Gastdisk entfernen. Danach Local-
Prozessnachweis implementieren; Phase5 bleibt bis gesamter Fehlermatrix offen.

Read-only Vorbereitung Local-Folgerunde: vorhandene Coordinator-Hooks des echten
advanceLocalAppInstallation verwenden, keine zweite Wartungslogik. Separater
Node-Prozess mit eigener SQLite-Fixture, drei Kampagnen (aktiv/inaktiv/trash),
Party/XP, Einstellungen und eigenen Dateien; nach beobachtetem Hook SIGKILL.
Elternprozess vergleicht vollständigen Profilbaum plus Desktopintegration und
Programmverweis, erneute Recovery in frischem Prozess. Artefakt-/Helferfixture und
simulierte Runtime-Annahme ausdrücklich als solche benennen; keine Behauptung
gepackter Local-Ausführung. Erst nach terminalem34202 implementieren und native
Host-Tests ausschließlich ohne GUI mit begrenzten Ressourcen ausführen.

### Phase 5 – Diagnose fehlender eindeutiger Sicherungszeile

34202 terminal: GastExit0, aber TestExit1. Erster Fall awaiting-start erreicht
Timeout „unique visible pre-update backup row“; zweiter committed-Fall wurde wegen
set-e nicht begonnen. Kein vollständiger UI-Abnahmebericht. Guestdisk behalten.
Korrekturplan zunächst ausschließlich Diagnose: VM-Runner um optionales
`evidence-disk PATH` erweitern, welches eine beendete eigene Gastdisk nur lesend
als zusätzliche Platte in einem frischen isolierten Diagnosegast einbindet.
Originalquelle und Basis bleiben read-only; Ressourcen-/Platz-/Einzellaufgrenzen
bleiben erhalten. Gast mountet mit ro,noload und exportiert Logs, Backup-Manifeste
und vorhandene Zwischenberichte. Kein Appstart und keine Datenmigration. Danach
Ursache des UI-Selektors anhand tatsächlicher Daten klären, erst dann korrigieren.

1694 Diagnosegast terminalExit0, DIAGNOSTIC_EXPORT_EXIT0; Quell-Gastdisk vor/nach
identischer SHAea5b98f0fd6aaaa7f85e7eb227a841b9578ee543494bdb0feeaacbd03c54f5c1.
27057 Export gelesen, Diagnosegastdisk entfernt. Zwei verschiedene Backupzeiten
08:58:16.743Z und08:58:57.309Z, beide0.0.156; committed-Update verweist auf letztere
Sicherung736fc266-b70b-47e3-9fb9-988096571f43. Core ready laut Startlog; spätere
Prozessfehler erst beim Test-Cleanup. Kein Beweis für Datendefekt oder Zeitkollision.

Korrekturplan Diagnosequalität: im UI-Qualifier vor finally bei Fehler sichtbaren
Text und DOM als ui-failure-evidence.json sichern, Originalfehler stets erhalten.
Keine Auswahlheuristik ohne beobachteten UI-Zustand ändern. Lint/Format/Typprüfung,
neues Driverpayload mit denselben AppImagebytes, nur awaiting-start-Fall erneut.
Fehlerexport muss auch ui-failure-evidence.json enthalten, bevor Gast beendet wird.

98378 installed-diagnostic-run-1 terminalExit0/TestExit0: awaiting-start über
installierten Starter vollständig bestanden. Vollständiger gzip-Export geprüft,
Bericht SHA07d9c9f85f4756ec142e119089b1f03289dd71701c0e6e84988f786194d9ee46;
Rollbackprofil, erneutes Update, Restore und Quelle == Seed; spätere Arbeit ==
vorgeschaltete Sicherung. Artefakthashes unverändert0.0.156/157. Gastdisk nach
Vergleich entfernt. Ursprünglicher Timeout bleibt ungeklärt/sporadisch, nicht als
behoben deklarieren. Fehleraufzeichnung bleibt für weitere Läufe aktiv. Nächster
Einzelfall: installierter Starter, committed-Abbruch und späterer Arbeitsabbruch.

93852 installed-commit-run-1 terminalExit0/TestExit0. Vollständiger gzip-Export
und JSON validiert, SHA0d00ea54b8b2755f4548a45e47a6386124bb0943a4f5135c78ebaae3e7b5c983.
Installierter Starter nach committed-SIGKILL: Journal identisch zur angenommenen
Transaktion. Zweiter SIGKILL nach späteren Änderungen: vollständiger Readback ==
continued == vorgeschaltete Restore-Sicherung != Seed. Restore/Quelle/after ==
Seed. Unveränderte Artefakte0.0.156/157. Gastdisk anschließend entfernt.
Plan-Audit Diagnoseaufzeichnung implementiert, Lint/Typprüfung bestanden; zwei
gezielte Artefaktläufe bestanden. Früherer Timeout bleibt ungeklärt. Roadmap-Audit:
keine Phase5-Freigabe, Local/eigener Helfer/weitere Fehlerfälle offen. Änderungen
an Testinfrastruktur und Abnahmedokumentation jetzt gemeinsam formatieren,
Candidate committen/pushen und vollständige exakte CI abwarten.

### Phase 5 – Local-Abbruchnachweise als echte Prozesse

Voriger Goal-Turn: Fortschritt, Candidate2d2f2f2fd mit zwei geprüften Gastläufen.
Arbeitsbaum sauber, keine VM aktiv. Remote PR672 zeigt exakten Head, aber noch
keine Check-Runs; kein grüner Nachweis für diesen SHA behauptet.
Umsetzungsplan: isolierter Node-Worker ruft originalen Local-Installer auf und
beendet sich am vorhandenen Maintenance-Hook mit SIGKILL. Erstinstallation mit
inerten Artefakt-/Helperbytes, ausdrücklich simulierte Runtime-Annahme; danach
reale SQLite-Registry mit drei Kampagnen, Party/XP, Einstellungen und eigenen
Dateien. Acht Aktivierungsgrenzen, neun Recoverygrenzen und durable commit.
Recovery über frischen Installerprozess, wiederholter Wiederanlauf, Vergleich
von Profilinhalt, Programmlink und Desktopintegration. Spätere Arbeit nach
simulierter Annahme darf nicht zurückgesetzt werden. Kein gepackter Local-/GUI-
Nachweis und kein historischer Schemawechsel durch diese Suite. Native Tests
nur begrenzt ohne Desktop, dann Lint/Typecheck und getrennte Plan-/Roadmapaudits.

67620 terminalExit1:18 Fälle fehlgeschlagen.17 Vergleiche zeigen zusätzliche
SQLite-WAL/SHM-Dateien durch den eigenen logischen Readback nach zuvor erfasstem
Rohbaum; kein belegter Nutzdatenverlust. Commit-Fall erwartet unzulässig dieselbe
Transaktions-ID bei ausdrücklich erneutem Installeraufruf nach geänderten Daten;
der Installer erstellt dafür eine neue Transaktion mit b als previous/next.
Korrekturplan: vollständigen logischen SQLite-Inhalt und Dateien vergleichen,
WAL über SQLite lesen statt Begleitdatei-Existenz zur Nutzdateninvariante erklären;
Binärdateien per SHA vergleichen, um riesige irrelevante Fehlerausgaben zu meiden.
Commit-Fall verlangt unveränderte spätere Daten und denselben Programmstand bei
explizitem Wiederaufruf, keine identische Wartungs-ID. Kein Lock-/Recoverycode
ändern. Gesamte18-Fälle-Suite erneut ausführen, danach statische Prüfungen.

39935 terminalExit0:18/18 Local-Prozessfälle bestanden (224s); anschließend
ESLint und beide Typechecks bestanden. Dienstmaximum1.5GiB, kein GUI-Start.
Vollständige Tabelleninhalte inkl. Einstellungen, Registry/Trash und Party/XP
sowie eigene Dateien/Verzeichnisse identisch nach Recovery und erneutem Update;
Programmverweis, Desktopdatei und Icon wiederhergestellt. Spätere eigene Datei
bleibt bei erneuter Installation desselben angenommenen Builds erhalten.
Plan-Audit: echte Prozessabbrüche am Originalinstaller, wiederholte Recovery und
Retry sowie committed-Fall geprüft. Artefakte weiterhin inert, Runtime-Annahme
simuliert; keine gepackte Local-Abnahme. Roadmap-Audit: dieser Prozessnachweis
ergänzt Phase5, ersetzt weder Local-Runtime, Helfer-Abbrüche, weitere Fehlerfälle
noch den ungeklärten UI-Timeout. Check34460289741 für2d2f2f2fd läuft noch.
Neue Tests und Nachweise als eigenen Candidate-SHA pushen; dessen vollständige
CI ist zusätzlich erforderlich. Keine Main-Promotion oder Phasenfreigabe.

### Phase 5 – Eigenständiger Starthelfer während Recovery

Voriger Turn Fortschritt:ee8c1024e enthält18 bestandene echte Local-Prozessfälle.
Nächster Plan: unveränderte0.0.156/157-AppImages verwenden. Den vorhandenen
fsync-Beobachter separat als CJS-Testpreload bündeln; nur beim expliziten
Recovery-Start des installierten Starters über NODE_OPTIONS laden und auf
ELECTRON_RUN_AS_NODE=1 beschränken. Originalhelper und AppImagebytes nicht ändern.
Marker ergänzt Prozessrolle, Driver muss launcher-Rolle und eigene PID prüfen.
Ein Fall program-linked→failed-data-preserved zunächst als Pilot; alte und
fehlgeschlagene Zielprofile vollständig lesen, normalen Update/Restoreweg prüfen.
Observer-Datei mit SHA im Bericht identifizieren. Format/Lint/Typprüfung vor VM,
frisches Payload,40GiB-Grenze und anschließende Exportprüfung/Datenträgerbereinigung.
Keine behauptete vollständige Helfer-Matrix aus einem einzelnen Pilotfall.

48584 terminalExit0 des Gastes, TestExit1: erneuter Timeout Sicherungszeile.
Fehlerexport vollständig geprüft:ui-failure SHA b8ff670c735bb99e08c840b5bf99b0c2a26bf045786c76717ed71a54f94da6eb.
DOM zeigt Kampagnenübersicht und Einstellungen-Trigger, keinen geöffneten Dialog.
Teilbericht activation-crash SHA229103cc3c316af67b9a19c4468ad3d5d134dda93c655392c7a4d360cd75e83a
belegt helper-Rolle launcher/PID1323, Abbruch failed-data-preserved nach
rollback-preserving und erfolgreiche alte/fehlgeschlagene Readbacks. Kein
vollständiger UI-Erfolg. Gastdisk bleibt für Diagnose erhalten.
Korrekturplan Driver-Actionability: Klick erst bei sichtbarem fokussiertem Dokument,
unverändertem Mittelpunkt über zwei Beobachtungen und tatsächlichem Treffer auf
den Button (keine Überdeckung/inert). DOM-Listener beobachtet genau einen echten
vertrauenswürdigen Maus-Klick; keine programmatic clicks oder blinden Wiederholungen.
Fehlende Zustellung sofort ausdrücklich melden. Bestehende Sicherungsauswahl und
Produktcode unverändert. Format/Lint/Typecheck, frisches Driverpayload und gleicher
Helfer-Pilot erneut; bei weiter fehlendem Dialog trotz Klick separate Produktdiagnose.

57880 launcher-recovery-run-2 terminalExit0/TestExit0: vollständiger gzip-Export
und BerichtSHA4a65302d946a38bd887d271fd65a4d084acc1dcf1e490c4b78092c385daf9cfb
validiert. Markerrolle launcher, eigene getötetePID, failed-data-preserved in
derselben Update-Transaktion. Altes und fehlgeschlagenes Zielprofil == Seed;
Update/Restore/Quelle == Seed, continued == vorgeschaltete Sicherung != Seed.
Observer-SHA mit Payload verglichen, AppImages0.0.156/157 unverändert. Erfolgsdisk
und vorherige Pilotdisk nach gesichertem vollständigem DOM/Teilbericht entfernt.
Plan-Audit: ein eigenständiger Helfer-Recoverypunkt plus kompletter UI-Ablauf
bestanden. Klicks jetzt actionability-geprüft und trusted beobachtet, keine
programmatischen Ersatzklicks. Ursprüngliche Ursache fehlender Dialogöffnung
nicht abschließend bewiesen; nicht als Produktfehlerbehebung deklarieren.
Roadmap-Audit: weitere Helfergrenzen, gepackter Local-Lauf und übrige Fehlermatrix
bleiben offen. Vorherige statischeChecks51710/44217 vollständig grün.

Abschluss dieser Korrekturrunde: Formatcheck und diff-check grün. Check34461096738
füree8c1024e bleibt nach erneuter Prüfung im Job campaign-workspaces aktiv; keine
vollständige grüne CI behauptet. Neue Driver-/Beobachteränderungen mit Pilotbeleg
auf Candidate pushen; vollständige CI für den neuen SHA erforderlich. Abnahme-
Matrix nennt ausschließlich den tatsächlich geprüften Helferpunkt.

### Phase 5 – Weitere eigenständige Helfergrenzen

Voriger Turn Fortschritt:957a63118 enthält Helper-Beobachter, trusted-click-
Nachweis und bestandenen Pilotlauf. Arbeitsbaum sauber, keine VM aktiv,62GiB frei.
Plan: dasselbe unveränderte Payload-launcher-recovery-2 zunächst in einem
Zweierlauf journal:rollback-started und journal:rollback-preserving prüfen,
jeweils nach initialem program-linked-Abbruch. Pro Fall vollständiger Export
vor dem nächsten Fall, am Ende erneut Export mit verzögertem Herunterfahren.
Helferrolle/PID, konsistente alte und fehlgeschlagene Profile, Retry/Continue/
Restore/Quelle prüfen; keine Generalisierung auf noch ungeprüfte Grenzen.
Nach terminalem Lauf und validiertem Export Gastdisk entfernen. Keine Source-
oder Teständerung während des Laufes. CI957a63118 separat beobachten.

62246 noch aktiv: erster vollständiger Export journal:rollback-started validiert,
SHA27f2691bb299950e224ed64d0c4f07b8dd25ba60751c88fe06f58118ed7d1328.
Helferrolle/eigenePID, rolled-back, beide Profile==Seed, Update/Restore/Quelle
==Seed und continued==protected!=Seed geprüft. Zweiter Fall noch ohne Endergebnis;
Gastdisk bleibt bis terminalem Status und kompletter Exportsicherung erhalten.

Read-only Vorbereitung nächste Fehlerrunde: neuer isolierter Profile-Fault-
Qualifier soll Originaltarget0.0.157 mit vollständigem synthetischem Profil nutzen.
Fälle neueres Format, bewusst fehlender Pfad, beschädigte Installation und echte
Zugriffsverweigerung getrennt starten. Versionseingriffe ausdrücklich Ablehnungs-
Fixtures, keine historischen Migrationen. Vor/nach dem fehlerhaften Start konkrete
Profilinhalte vergleichen; verständlichen Recoveryhinweis und Erreichbarkeit der
Sicherungsansicht durch reale UI prüfen. Beschädigter Stand vor Restore als
restorable=false erhalten, validiertes Backup auf Arbeitskopie einspielen und
vollständig lesen. Bestehender qualify-profile-recovery.ts ist eine Vorlage,
aber sein alter Prozess-/CDP-Harness ersetzt den aktuellen isolierten Driver nicht.
Erst nach terminalem aktuellen VM-Lauf implementieren. WAL/Platz/Parallelstart
und fehlender Transportherkunftsnachweis bleiben weitere getrennte Fälle.

62246 terminalExit0/TestExit0: beide Helferfälle bestanden, drei vollständige
gzip-Exporte CRC-validiert. journal:rollback-started
SHA27f2691bb299950e224ed64d0c4f07b8dd25ba60751c88fe06f58118ed7d1328;
journal:rollback-preserving
SHAc80c11f97718e663bced9b28c1054f2715de8fe4a8dc908fe1ea467894abbc25.
Helferrolle/eigenePID und Transaktions-ID geprüft; alte/failed Profile==Seed,
Update/Restore/Quelle==Seed, continued==protected!=Seed. Beide Artefakthashes und
Observerhash unverändert gegen Payload geprüft. Berichte und Index gespeichert,
Gastdisk entfernt. Plan-Audit Zweierlauf bestanden. Roadmap-Audit weitere sechs
Helfergrenzen, gepackter Local-Lauf und Fehlermatrix offen; keine Phasenfreigabe.

Nächster Zweierlauf ohne Codeänderung: journal:rollback-restoring und
old-data-restored, jeweils initial program-linked und unverändertes Payload2.
Gleiche Export-, Rollen-, Profil- und Wiederanlaufkriterien; abgeschlossene
Gastdisk nach vollständiger Prüfung entfernen. Aktuelle CI957a63118 läuft weiter,
Dokumentationsnachweise bis zum Abschluss dieses Helferblocks gemeinsam sammeln.

CI-Audit: Check34462695103 für957a63118f1f52d18150588a9c049a8d65fc8956
terminal completed/success, keine fehlgeschlagenen oder laufenden Jobs. Vollständiger
Candidate-Nachweis grün; kein Main-/Handoff- oder Releaseabschluss daraus ableiten.
99971 weiter aktiv, erster Export journal:rollback-restoring vollständig validiert,
SHAbc2c83e422aa81655be77f7c23697ca30804676ba0553b3c02ac34a4e406c2b4.
Zweiter Fall old-data-restored noch offen.

99971 terminalExit0/TestExit0, drei vollständige gzip-Exporte CRC-geprüft.
journal:rollback-restoring SHAbc2c83e422aa81655be77f7c23697ca30804676ba0553b3c02ac34a4e406c2b4;
old-data-restored SHAfd7bf948525d79eb80fb6a4a2d7e59c089e20b12ac6667a4d13533023783bad5.
Helferrolle, eigenePID/Transaktion, altes/failed Profil, Retry/Continue/Restore/
Quelle und unveränderte Artefakt-/Observerhashes vollständig geprüft. Gastdisk
nach Berichten/Index entfernt. Plan-Audit Zweierlauf bestanden. Roadmap-Audit:
noch journal:rollback-program, program-linked, rollback-history-written und
journal:rolled-back als eigenständiger Helfer offen, außerdem gepackter Local-
Lauf/Fehlermatrix. Nachweise dieser beiden Zweierläufe als Dokumentationscommit
sichern; Codebasis957a63118 hat die vollständige grüne CI34462695103. Neue Docs-
SHA benötigt ihren eigenen Check, keine Main-Promotion oder Phasenfreigabe.

### Phase 5 – Helfer-Programmrollback

Voriger Turn Fortschritt: vier neue Helfergrenzen mit validierten Vollberichten,
0cbb9912a gepusht. Arbeitsbaum sauber, keine VM aktiv,62GiB frei. Check34464652882
läuft. Nächster Zweierlauf unverändertes Payload-launcher-recovery-2:
journal:rollback-program und program-linked während Recovery, jeweils vorheriger
Aktivierungsabbruch program-linked. Rollen-/PID-/Transaktionsprüfung, vollständige
alte/failed Profile und Retry/Continue/Restore/Quelle; drei Exporte, terminale
Prüfung und Gastdiskbereinigung. Keine Codeänderung während Lauf. Danach bleiben
rollback-history-written und journal:rolled-back für den eigenständigen Helfer.

86850 terminalExit0/TestExit0. Drei vollständige gzip-Exporte CRC-validiert;
journal:rollback-program SHA01f2384a53708a255d6e977870c657a93812da9693bf84716da6e53e3ff3d572;
program-linked SHA9a7dd5839e8720c703e79725d5c2ab0166cd094c079ab2f75deeb6cd77f77355.
Originalartefakte/Observerhash, Helferrolle/eigenePID/Transaktion, alte und failed
Profile, Retry/Continue/Restore/Quelle vollständig verglichen. Gastdisk entfernt.
Plan-Audit beide Programmrollbackgrenzen bestanden. Roadmap-Audit letzter
Helfer-Zweierlauf rollback-history-written und journal:rolled-back noch offen.

Plan letzter Helfer-Zweierlauf: unverändertes Payload2, initial program-linked,
Recoveryabbruch nach dauerhafter Historie bzw. finalem rolled-back-Journal.
Gleiche drei Exporte und vollständige Vergleiche, danach Gastdisk entfernen.
Weitere Phase5-Fehlermatrix/Local-Runtime dadurch nicht als erledigt behandeln.

CI34464652882/Portable102830270336 fehlgeschlagen:17/18 Local-Prozessfälle
bestanden (19–25s), ausschließlich letzter committed/later-work-Fall scheitert
mit30.466s am pauschalen30s-Testlimit.1640 weitere Tests bestanden; keine Daten-
Assertion fehlgeschlagen. Vollständiger Joblog gesichert. Korrekturplan nach
terminalem73618: nur neue Local-Mehrprozessfälle auf60s Gesamtbudget setzen,
20s-Hardlimit jedes einzelnen Kindes und sämtliche Assertions unverändert.
Fehlerfall gezielt unter1CPU-Quota prüfen, Lint/Format, dann vollständige CI für
neuen Candidate. Keine globale Timeout-Erhöhung, kein Weglassen des Testfalls.
Erster finaler Helferexport rollback-history-written bereits vollständig geprüft,
SHA50d0fc3a9b986f9bcb99655548dfae8f21ae184d9b52676ab761a71c213cd020;
zweiter journal:rolled-back noch aktiv, keine Gesamtfreigabe.

73618 terminalExit0/TestExit0; letzte zwei Helfergrenzen vollständig geprüft.
rollback-history-written SHA50d0fc3a9b986f9bcb99655548dfae8f21ae184d9b52676ab761a71c213cd020;
journal:rolled-back SHAfea17a8d7d506fe2313314110b1aa02d09b149557eb32ddd80a1ed4eca504aa5.
Drei gzip-Exporte CRC-validiert, Helferrolle/PID/Transaktion und alle vollständigen
Profile/Restore/Quelle/Observer-/Artefakthashes verglichen; Gastdisk entfernt.
Plan-Audit Helferblock9/9 bestanden. Roadmap-Audit Phase5 weiter offen wegen
gepacktem Local-Lauf und übriger Fehlermatrix; keine öffentliche Releasefreigabe.
Jetzt nur geplante Local-Testbudgets60s gesetzt; Prozessdeadline20s unverändert.

27745 terminalExit0: gezielter zuvor gescheiterter Fall unterCPUQuota100% besteht
in32.208s (oberhalb altem30s-Limit);17 andere Fälle in diesem gezielten Lauf nicht
ausgeführt, nicht als erneut geprüft zählen. ESLint/Format und beide Typechecks
grün. Prozessdeadline20s/Assertions unverändert, ausschließlich fallbezogenes
60s-Budget für die neue Mehrprozesssuite. Plan-Audit Timeoutkorrektur bestanden;
Roadmap-Audit vollständige neue CI noch erforderlich. Check34464652882 terminal
failure wegen dokumentierter Zeitüberschreitung, nicht als grün behandeln.
Helferblock9/9 vollständig nachgewiesen, Phase5 bleibt insgesamt offen.

### Phase 5 – Gepackte Profilfehler und Recoveryoberfläche

Voriger Turn Fortschritt:7dbeecd8c mit9/9 Helfergrenzen und geprüftem Testbudgetfix.
Arbeitsbaum sauber, keine VM,61GiB frei. Check34466605053 läuft. Konkreter Plan:
neuer isolierter Qualifier mit Originaltarget0.0.157. Vollständiges synthetisches
Profil im Artefakt erzeugen; über tatsächliche Einstellungen/Bestätigung ein
leeres Profil anlegen, damit der originale Utility-Ablauf eine geprüfte Sicherung
anlegt. App schließen, eigene Quellkopie unter Sperre zurückkopieren und genau
einen Fehler setzen: neueres Installationsformat43, fehlender Pfad0 (explizite
Ablehnungsfixtures, keine historischen Schemabelege), beschädigte Datei oder
Zugriffsrecht000. Vor/nach fehlerhaftem Appstart das vollständige logische Profil
per Datei-/Verzeichnisinventar vergleichen; Browserlaufzeit liegt laut Architektur
außerhalb. Recoveryhinweis und Sicherungsansicht mit trusted Mausaktionen prüfen.
Für lesbare Fehler vollständiges Restore, vorherige restorable=false-Sicherung
mit defektem Stand und Originalprofil-Readback vergleichen. Access-denied muss
Restore ohne Ersetzung verweigern; nach Ende und Rechtekorrektur identischer
Datenstand. Node-SQLite nur zum Aufbau der Versionsfehlerfixture verwenden.
Fehlerbericht auch ohne erreichbares DOM schreiben. Zunächst einzelner newer-
format-Pilot in begrenzter VM, dann übrige Fälle; keine Nutzerprofile berühren.

15641 terminalExit1 vor Typprüfung: ESLint findet unnötige Initialzuweisung des
Fehler-DOM-Werts und direktes throw im finally. Korrekturplan: DOM-Wert in beiden
Zweigen zuweisen, Prozessbeendigung in separate Hilfsfunktion verlagern. Erneutes
Kopieren nach leerem Profil ebenfalls mit exklusiver Quellsperre und vollständigem
Vorher/Nachher-Kopievergleich absichern; bisherige Quellen waren nur garantiert
beendete Testfixtures. Danach Format/Lint/Typecheck erneut, noch kein Gast gestartet.

20179 terminalExit0/TestExit1: Pilot stoppt vor Setzen des Versionsfehlers, weil
nach bewusstem Leerprofil der Text für vorhandene Kampagnen erwartet wurde.
Vollständiger Fehlerexport SHA254e235f4d080333b8ec01da3dfafa9128f3e3e67fae74614a57dcee7a49432c
zeigt korrekt „Noch keine Kampagne vorhanden“, leere Liste und0 Kampagnen.
Kein Nachweis des newer-format-Falls. Korrekturplan ausschließlich Setup-Erwartung:
leeren Hinweis und tatsächlich0 Listenzeilen prüfen; späterer Restore behält
Erwartung für bestehende Kampagnen. Fehlerdisk nach gesichertem DOM/Log entfernen,
Format/Lint/Typprüfung, neues Driverpayload und gleicher einzelne Pilot erneut.

78917 profile-newer-run-2 terminalExit0/TestExit0, vollständiger gzip-Export
CRC-validiert. BerichtSHA5a62dfb590b764686a7e760b82b92d2311854de01ff3c4c9ec3e1b0f9cfac6a7.
Neueres Format43 gegenüber App42 abgewiesen, Profilinventar vor/nach unverändert,
Recoveryhinweis/UI bestätigt. Restore derselben Programmdeployment-ID committed,
restored==seeded==unchanged, vorgeschaltete restorable=false-Sicherung enthält
exaktes Datei-/Verzeichnisinventar des abgewiesenen Stands. Eigene Prozesse
normal beendet; Gastdisk entfernt. Plan-Audit Pilot bestanden, übrige Fälle offen.
Nächster Zweierlauf unverändertes Payload-profile-fault-2: missing-path und corrupt,
separate Profile, Export nach jedem Fall und am Ende; gleiche vollständige
Daten-/Sicherungs-/Quellvergleiche. Danach access-denied als eigener Lauf.

### Phase 5 – Fortsetzung nach Hostprüfung und CI-Diagnose

Voriger Turn liefert neue Betriebsevidenz: Root60GiB frei, keine Test-VM;
Journal bestätigt ENOSPC bei Desktop-/Codex-Coredumps. Direkte Crashursache bleibt
unbewiesen. Keine Host-GUI-Tests. Phase5 aktiv, Phasen6/7 unverändert offen.
24551 profile-fault-pair-run-1 terminalExit0/TestExit0; drei vollständige gzip-
Exporte geprüft. missing-path SHA03087ab8c9476524338a2de435e45a6c67e946add5c4c976ec9f5f9741efd17c,
corrupt SHA4c01b2ecd1e9a071a28027fea48ffc2b9b8523712a6fe980ac6f4684b469c331.
Inventare, vorgeschaltete defekte Sicherung, Restore und unveränderte Quelle
vollständig verglichen; Gastdisk entfernt. Access-denied bleibt offen.

Check34466605053 auf7dbeecd8c terminal failure: campaignCombat Zeile463 findet
Fraktionen nicht. Gesichertes Screenshot zeigt expliziten Schutzdialog wegen
laufender Szenenaktionen. setSceneLocation wartet bisher nur auf Auswahl; die
letzte Verwendung wartet nicht einmal auf den bestätigten Ort. DesktopOverview
zeigt commands.busy als disabled am Ortsbutton. Korrekturplan: gemeinsamer
Testhelper wartet nach Auswahl auf erwarteten Ort UND wieder aktivierten Button.
Keine Änderung am Schutzdialog, keine automatische Bestätigung, kein Schlafen.
Format/Lint/Typprüfung, danach vollständige Candidate-CI. Separat unverändertes
Profilfehlerpayload2 für access-denied in frischer begrenzter VM prüfen.

85456 Format/Lint/beide Typechecks bestanden (36.49s,1.4GiB). Plan-Audit
Szenentest: Abschlussbedingung bezieht sich auf bestätigten Ortswert plus aktiven
Button; Screenshotursache adressiert, tatsächlicher E2E-Nachweis noch CI-offen.
61850 profile-access-run-1 terminalExit0/TestExit0. Ein vollständiger gzip-Export
CRC-geprüft; Zugriffshinweis, verweigerte Wiederherstellung ohne Journalwechsel,
Dateirechte000 bis expliziter Testkorrektur und identisches vollständiges Profil
geprüft. Readback nach Rechtekorrektur==Seed==unveränderte Quelle, originale
Artefakthashes und normale Prozessexits bestätigt. Bericht siehe validated im
Laufverzeichnis; Gastdisk nach Prüfung entfernt. Dies ist ein Ablehnungsnachweis,
kein erfolgreiches Restore bei fehlenden Rechten. Plan-Audit Profilfehler4/4
bestanden. Roadmap-Audit Phase5 weiter offen, insbesondere WAL/Platzmangel und
gepackter Local-Ablauf. Kein Handoff, keine Main-Promotion oder Veröffentlichung.
19af07da9835d0073713dc31f68fd1bdc0fadd3e77cc276b4c4a4341b8d7a163

### Phase 5 – WAL im echten Updateweg

Voriger Turn Fortschritt:7c1740e64 gepusht,4/4 Profilfehler bestanden; Check34469294183
jetzt in_progress auf exakt diesem SHA. Arbeitsbaum sauber. Konkreter Plan:
UI-Updatequalifier um optionalen WAL-Fall ergänzen. Unter exklusiver Profilsperre
nach beendeter Baseline-App einen eigenen Node-SQLite-Fixtureprozess starten:
bestehende Installationseinstellungen lesen, abweichenden Theme-Wert checkpointen,
Originaleinstellungen nur in WAL committen, ohne Close mit SIGKILL beenden.
Keine Schemaänderung. Nach Prozessende nur Hauptdatei separat lesen und Abweichung
beweisen; vollständige DB+WAL-Kopie muss Originaleinstellungen lesen. WAL-Größe,
Hash, Prozesssignal und beide Werte protokollieren. Erst dann originalen
installierten Starter und gesamten geprüften UI-Update-/Weiterarbeits-/Restoreweg
mit unveränderten0.0.156/157 laufen lassen. Seed/Quelle bleiben unverändert.
Dies qualifiziert WAL-Recovery vor Update und Datenerhalt im Wartungsweg;
keine Aussage über unkooperierende laufende Fremdprofile. Neue Payload/VM erst
nach Format/Lint/Typprüfung, Hostreserve und vollständigen Export sichern.

14567 Format/Lint/beide Typechecks bestanden. Vertragsprüfung vor Gastlauf zeigt
preferences_json enthält {schemaVersion:2,preferences:{theme,...}} statt Theme
auf oberster Ebene. Korrekturplan: Fixtureassertion und checkpointed-Wert exakt
auf eingebettete preferences beziehen; gesamten Originaltext unverändert in WAL
zurückschreiben. Scratch-Erstellung ebenfalls im Lock-finally schützen. Noch
kein Gast gestartet; anschließend statische Prüfung erneut und Payload einfrieren.

98959 erneute Format/Lint/beide Typechecks bestanden (30.30s,1.5GiB).
Payload-wal-1 und wal-seed-1 neu eingefroren;37002 wal-run-1 aktiv, noch kein
Ergebnis. Read-only Folgeplanung: Platzprüfung liegt in ProfileMaintenance.prepare
vor Backup, aber AppImage-Deployment wird vorher kopiert. Für echten Platzmangel
nur root/salt-marcher als kleines ext4 innerhalb Gast mounten; TMPDIR und Berichte
außerhalb lassen. Vor Installation nach Download gezielt Restplatz knapp oberhalb
AppImagegröße lassen, sodass Programmkopie noch möglich, Backupreserve64MiB aber
nicht verfügbar ist. Ausschließlich Testvolume füllen; Host darf nie Ziel sein.
Dieses Folgeexperiment noch nicht implementiert oder als Nachweis gewertet.

37002 wal-run-1 terminalExit0/TestExit0. Vollständiger gzip-Export CRC-validiert,
BerichtSHA2c901c830b6b6c83512ce3cbf686477a800b40b858a9244c24c872d64764c6e4.
Fixtureprozess tatsächlich SIGKILL; nackte Hauptdatei Theme light, DB+WAL Theme
dark. Originaler installierter Starter, AppImages0.0.156→0.0.157 (42/41→42/42),
vollständiger UI-Updateweg bestanden. after==seeded==restored==unchanged;
continued==protectedRead und verschieden von seeded. Quellprofil unverändert,
keine Datenformatmutation, WAL-Bytes/Hash im Bericht. Gastdisk nach vollständiger
Prüfung entfernt. Plan-Audit WAL-Fall bestanden; Roadmap-Audit Phase5 weiterhin
offen wegen Platzmangel, parallelen gepackten Starts, gepacktem Local und weiteren
Transportfällen. Neuer Candidate braucht vollständige CI, kein Main/Handoff jetzt.

### Phase 5 – Begrenzter echter Platzmangel

Voriger Turn Fortschritt:0dec1a787 WAL-Nachweis gepusht. CI34469919756 pending,
34469294183 weiterhin live; keine doppelte Prüfung starten. Arbeitsbaum sauber.
Konkreter Implementierungsplan: optionales space-volume im UI-Qualifier verweist
auf eigenes maximal3GiB großes ext4-Gastdateisystem mit anderer Device-ID als
Gastroot/Home. Nur selbst erzeugten Installationsroot dorthin kopieren und am
bisherigen Pfad verlinken; Quelle, Extraktionen und Berichte bleiben außerhalb.
Nach echter UI-Prüfung/Download eine eigene reservierte Datei mit fallocate
anlegen, sodass AppImagegröße+32MiB frei bleiben. Verbleibenden Platz messen.
Installation muss im originalen Ziel-Utility vor Sicherung/Migration mit passender
Platzmeldung scheitern, Programm/Journal/Sicherungsliste unverändert lassen.
Füllung im finally entfernen; App schließen, vollständigen Original-Readback
vergleichen, danach gesamten Update-/Weiterarbeits-/Restoreweg erneut ausführen.
Seed richtet ausschließlich innerhalb Gast eine2GiB Loop-ext4 ein. Weder Host-
Dateisystem noch Gastroot darf Füllziel werden. Statische Prüfungen, neue immutable
Payload, einzelner begrenzter VM-Lauf, vollständiger Bericht und Diskbereinigung.

77934 Format/Lint/beide Typechecks bestanden. Vor Gastlauf Setupkorrektur:
Baseline-Erstaktivierung hat absichtlich backup:null, daher kann backups fehlen.
Sicherungsliste als [] bei fehlendem Verzeichnis behandeln, nach Fehlversuch
identisch prüfen. Keine Sicherung künstlich erzeugen. Check34469294183 wurde
cancelled (auch campaign-workspaces); kein E2E-Erfolgsnachweis. Nachfolger
34469919756 auf0dec1a787 in_progress; neue lokale Änderungen noch nicht gepusht.

86910 Format/Lint/Typechecks grün.94446 space-run-1 terminalExit0/TestExit0,
vollständiger gzip-Export CRC-validiert. BerichtSHA586e9ee78d4b0650cd32430883696725a7a5b0dc770d509739c0498c8344d2b2.
Vor Deployment210595840Bytes frei, AppImage177048160Bytes. Originales Ziel meldet
fehlenden Platz für Sicherung/Migration; Programm/Journal/Sicherungsliste unverändert,
Readback==Seed. Nach Freigabe vollständiger UI-Update-/Weiterarbeits-/Restoreweg
bestanden, Quelle unverändert, spätere Arbeit geschützt. Gastdisk entfernt.
Plan-Audit Platzvorprüfung bestanden, keine Behauptung über ENOSPC beim Kopieren.

Korrekturrunde verbleibender Platzfall: explizites space-exhausted zusätzlich zu
space-volume. Auf demselben geprüften Gastvolume nach Download nur1MiB frei lassen,
Programmdateikopie muss mit echtem ENOSPC scheitern. Gleiche Unverändertheits- und
Retrybeweise; reservierte Datei auch bei Testfehler entfernen. Keine Produkt-
Fehlerinjektion oder Hostfüllung. Neue Payload und separater Gast nach statischen
Prüfungen; Matrix unterscheidet Vorprüfung und tatsächlichen Schreibfehler.

86970 Format/Lint/beide Typechecks bestanden.77778 space-exhausted-run-1 terminal
Exit0/TestExit0. Vollständiger Export CRC-validiert, BerichtSHA
a8e19a4ac9cbfe8c8ce8101f98002eefbed77555b2ddaaefb5041d04164ce641.
Echter ENOSPC bei copyfile von Cache nach neuem Deployment, höchstens1MiB frei.
Journal/Programm/Sicherungen unverändert; Fehler-Readback==Seed, Retry mit echtem
Update/Weiterarbeit/Restore vollständig bestanden, Quelle unverändert. Disk
entfernt. Datensicherheits-Plan-Audit beide Platzfälle bestanden.

Roadmapabweichung bestätigt: UI zeigt rohes ENOSPC samt absoluten Dateipfaden ohne
verständliche nächste Aktion. Korrekturplan: Main übersetzt ENOSPC/EDQUOT anhand
Fehlercode in klare deutsche Platzfreigabe-/Erneutversuchen-Meldung. Andere
fachliche Meldungen bleiben erhalten; unbekannte Fehler erhalten bestehenden
Fallback. Utility-Platzvorprüfungen um nächste Aktion ergänzen. Reine Unitfälle
prüfen Systemcodes vs fachliche Meldungen/Fallback, statische Prüfungen. Echte
gepackte UI-Freigabe dieses Fixes erfordert anschließend neu gebaute unveränderte
Artefakte; bisherige0.0.156/157 beweisen ausschließlich Altfehlermeldung plus
Datenerhalt, nicht den UX-Fix. Noch keine Phase5-/Handoff-/Main-Freigabe.

7960 terminalExit0:5/5 Fehlertexttests, Format/Lint und beide Typechecks bestanden
(29.45s,1.5GiB). Plan-Audit UX-Implementierung und reine Fehlerklassifikation
bestanden. Gepackter Nachweis neuer Fehlermeldung bleibt offen; neue Artefakte
müssen den optionalen ENOSPC-Test mit explizit erwarteter verständlicher Meldung
wiederholen. Alte Artefakte unverändert weiter als ENOSPC-Datensicherheitsbeleg.
Check34469919756 weiterhin live, zuletzt nur campaign-workspaces und hex-npc-
restart offen, keine fehlgeschlagenen Jobs. Candidate lokal sichern; Push wird
nach diesem bereits laufenden Nachweis fortgesetzt, um ihn nicht erneut abzubrechen.
Keine aktive Test-VM,59GiB frei. Phase5 bleibt aktiv, Phasen6/7 offen.

### Phase 5 – Gepackte Abnahme der Platzmeldungen

Voriger Turn Fortschritt:c26f04a0a lokal committed, zwei Platzfehler mit echten
Artefakten bestätigt und UX-Abweichung behoben. CI34469919756 weiterhin live,
keine VM. Konkreter Plan: neue Baseline aus unverändertem b64a408a5 plus exakt den
3 Produktdateien des Platzmeldungsfixes; Schema/SQL bleiben42/41. Ziel unveränderter
c26f04a0a (42/42). Neue Testversionen0.0.158/159, neue IDs space-baseline/space-target,
bisherige Quellen und Artefakte unangetastet. Optionaler space-actionable-Schalter
im Qualifier verlangt ausdrücklich deutsche Meldung samt nächster Aktion und
verbietet sichtbares ENOSPC. Beide2GiB-Gastfälle mit neuen Originalartefakten
wiederholen. Baselinebackport separat committen; Quelle und Treiber vor Builds
festschreiben, keine Änderungen während Build/Test. Danach vollständige CI und
weiterer Phase5-Audit; kein Main/Handoff/Publicrelease aus diesen Teilnachweisen.

89946 Format/Lint/beide Typechecks grün. Quellenkatalog/Driverd95bf8f3c lokal
committed. Baseline2ccba43f60b92f99aa7fddbfcbb354bf00c44761 separat gepusht;
exakt3 Fehlertextdateien gegenüber b64, kein SQL-/Schemawechsel.40999 beide Builds
terminalExit0 (95.998s,3.7GiB). Baseline0.0.158 SHA
e23244fd8204b10e4b2c075aea9350ccf9b5449314b53e44bbefd8a231b94df9;
Ziel0.0.159 SHA004c0daa980cfa59aae4a44534b2e683b50a74c3ebfcf45124f8eb736a7c5da4.
Payload-space-actionable-1 mit unveränderten Quellen-/Artefakthashes eingefroren.
38412 erster Vorprüfungs-Gastlauf aktiv, keine Produkt-/Treiberänderungen dabei.

Check34469919756 auf exakt0dec1a787648d015b333daf3974cd972fc3b3a6c jetzt vollständig
completed/success, inklusive zuvor problematischem campaign-workspaces. Damit ist
der Testwartefix aus7c1740e64 durch vollständige nachfolgende CI qualifiziert.
Neue Platzmeldungsänderungen waren darin nicht enthalten; jetzt Candidate inklusive
c26f04a0a/d95bf8f3c pushen und neue exakte CI abwarten. Keine Main-Promotion.

38412 space-actionable-run-1 terminalExit0/TestExit0; vollständiger gzip-Export
CRC-geprüft. SHAce0b5be3bcb7c585afb0c8c51625ff2fd6287cf8b1d193213b880a38bf789f70.
99790 space-actionable-exhausted-run-1 terminalExit0/TestExit0; vollständiger
Export SHA12c4904aaa9d5e76aa908bb65add8d7288159fd91677df0c5949964bb48f8222.
Echter ENOSPC-Fall hatte1044480Bytes frei, Vorprüfungsfall210595840Bytes vor
AppImagekopie. Beide ursprünglichen0.0.158/159 zeigen jetzt nächste Aktion
„Gib Speicherplatz frei und versuche den Vorgang erneut.“ ohne ENOSPC-Text.
Vollständige Fehler-Readbacks==Seed==after==restored==unchanged; continued==
protectedRead und verschieden vom Seed. Starter-/Artefakthashes und sämtliche
normalen Prozessexits bestätigt; beide Gastdisks nach Exportprüfung entfernt.
Plan-Audit Fehlertextkorrektur einschließlich gepackter Abnahme bestanden.
Roadmap-Audit Phase5 weiter offen (Parallelstart, übrige Transportablehnungen,
Erstinstallation/Übernahme und gepacktes Local); Phasen6/7 offen.

383f6f4a3784840f5c107173f73bac5d3ba52cbd gepusht; Check34471542570 jetzt
in_progress. Neue Dokumentation lokal committen, diesen Lauf nicht durch einen
reinen Beleg-Push abbrechen. Vollständige CI des Produktfixes bleibt erforderlich;
kein Handoff oder Main-Promotion. Nächster Arbeitsblock: gepackte parallele Starts
und restliche Feedablehnungen. Read-only Vorbereitung zeigt strenge assetUrl-
Herkunftsprüfung und Manifest-Zod-Validierung; deren bisher ungeprüfte UI-Fehler
und nächste Aktionen müssen ausdrücklich mit erfasst werden.

### Phase 5 – Gepackter Parallelstart und kanonische Aliase

Voriger Turn Fortschritt:485a5f3fe gepackte Platzmeldung nachgewiesen; Check34471542570
auf383f6f4a3 weiterhin live, Arbeitsbaum sauber, keine VM. Konkreter Plan:
optional parallel-starts im bestehenden UI-Qualifier. Nach Baseline-Setup unter
exklusiver Installer-Profilsperre den originalen installierten Starter starten:
Ablehnung vor Recovery/Datenzugriff. Danach bei tatsächlich geöffneter Baseline-UI
zweiten Starter direkt und über Symlinkalias sowie das AppImage direkt starten.
Jeder eigene Prozess muss innerhalb20s mit Exit1 und ProfileLocked-Meldung enden;
Timeout/SIGKILL ist Testfehler. Vorher/Nachher identische kanonische Profil- und
Legacy-Lockbytes sowie Journal/Programm prüfen. Alias nur im eigenen Testhome.
Erste UI muss weiter ansprechbar sein; anschließend unveränderter vollständiger
Update-/Weiterarbeits-/Restore-/Quellvergleich. 0.0.158/159 unverändert verwenden.
Keine realen Nutzerprofile, keine Host-GUI. Statische Prüfungen, neue Payload,
begrenzte VM und vollständiger Export vor Disklöschung. Cross-channel-Local
bleibt ein separater Nachweis; dieser Block behauptet ihn nicht.

58670 Format/Lint bestanden, Typprüfung Exit2: inferierter Environment-Typ erlaubt
kein Entfernen von ELECTRON_RUN_AS_NODE. Korrekturplan: explizit NodeJS.ProcessEnv
verwenden. Deadline beendet nur das eigene ChildProcess über child.kill; übrige
Testprozesse bleiben beim bestehenden PID-Identitäts-/Home-basierten Cleanup.
Keine rohe Prozessgruppen-ID für Timeout verwenden. Danach statische Checks erneut;
noch keine Test-VM gestartet, kein Lauf als bestanden gewertet.

1567 statische Prüfungen vollständig grün (29.82s,1.5GiB). Letzter Harness-Audit:
Child-Kill allein garantiert kein close-Ereignis, wenn ein fehlerhaft gestarteter
Nachkomme die Pipe hält. Korrekturplan: Deadline muss zusätzlich das Warte-Promise
explizit ablehnen, damit vorhandenes äußeres Cleanup erreicht wird. Keine Änderung
an geforderter normaler Exit1-Ablehnung; Timeout zählt niemals als Erfolg.

68049 Format/Lint/beide Typechecks grün. Payload-parallel-1 mit Original0.0.158/159
und neuem Driver eingefroren;49728 parallel-run-1 aktiv. Keine Quelländerung dabei.
Read-only Vorbereitung nächster Feedfälle: Manifestvertrag erzwingt Repository,
Format1,linux/x64,Commit/Schemata/Größe/Hash; assetUrl erlaubt ausschließlich exakte
GitHub-Assetpfade. Qualifier leitet HTTPS GitHub/API zu eigenem Loopbackserver um,
führt unveränderte Originalprüfungen aus. Zu ergänzen sind getrennte Ablehnungen
für fremden Assetpfad, falsches Repository/Manifestformat/Architektur und
Versionsabweichung, jeweils ohne AppImageanforderung/Download/Aktivierung sowie
anschließend erfolgreicher Retry. Zod-/JSON-Fehler gelangen bisher als technischer
Text zum Renderer; eine konkrete Bedienbarkeitsabweichung muss anhand tatsächlichem
Fehlerreport vor Produktkorrektur belegt werden. Noch kein solcher Test gestartet.

49728 parallel-run-1 terminalExit0/TestExit0. Vollständiger gzip-Export CRC-geprüft,
BerichtSHAae7a5e77ba724a155e711abd34863ea80ada1cfebc7209c3994258dd574adb5c.
Vier geforderte Fälle mit normalem Exit1 ohne Signal bestätigt: Installer-Sperre
+Starter sowie geöffnete App+Starter,Alias,AppImage. Profil-/Legacy-Lockbytes
unverändert; gespeicherte Besitzer installer bzw.application unabhängig geprüft.
Journal/Programm unverändert, erste UI weiter ansprechbar. Vollständiger originaler
0.0.158→0.0.159 UI-Updateweg grün: after==seeded==restored==unchanged;
continued==protectedRead != seeded. Normale Hauptprozesse Exit0, Originalhashes
bestätigt. Gastdisk nach vollständiger Prüfung entfernt.
Plan-Audit Parallelstartblock4/4 bestanden. Roadmap-Audit Phase5 noch offen wegen
restlicher Feedablehnungen, Erstinstallation/Übernahme und gepacktem Local-Kanal.
Check34471542570 auf383f6f4a3 weiterhin live mit3 offenen Jobs, keiner fehlgeschlagen.
Neue Driver-/Belegänderungen lokal committen, Push erst nach diesem laufenden
Nachweis fortsetzen. Keine Behauptung über kanalübergreifende gepackte Local-Starts.

### Phase 5 – Abweisung ungültiger Releaseinformationen

Voriger Turn Fortschritt:6e413860e vier gepackte Parallelstarts qualifiziert.
CI34471542570 weiter live, Arbeitsbaum sauber. Konkreter Plan: feed-failures im
UI-Qualifier mit6 getrennten kontrollierten Antworten: fremder Manifest-Assetpfad,
fremder AppImage-Assetpfad, Repositoryabweichung, arch=arm64,formatVersion=2,
Manifestversion ungleich GitHub-Tag. Produktionsvalidator und Original0.0.158/159
unverändert. Pro Fall neue UI-Instanz, sichtbare konkrete Ablehnung, keine
AppImageanforderung und keine Cachedatei/Aktivierung; Programm/Journal unverändert.
Vollständigen Readback mit Seed vergleichen; nach allen Fällen normaler vollständiger
Update-/Weiterarbeits-/Restore-/Quellvergleich. Statusmeldungen im Bericht erfassen,
um die vermutete rohe Zod-Darstellung sachlich zu prüfen. Statische Checks, neue
Payload/Seed, einzelne begrenzte VM. Bekannte UI-Unzulänglichkeiten nicht als
Roadmap-Abnahme darstellen; Datensicherheit und Bedienbarkeit getrennt auditieren.

51270 Format bestanden, ESLint Exit1 vor Typprüfung: inspect liefert unknown und
hat keinen generischen Typparameter. Korrekturplan: gemeinsame lokale readNotice-
Funktion validiert CDP-Ergebnis mit z.string().parse, statt einen Rückgabetyp
anzunehmen. Erneute statische Prüfungen; kein Gast gestartet.

49412 statische Prüfungen bestanden.13965 feed-run-1 terminalExit0/TestExit0 nach
240.78s; vollständiger gzip-Export CRC-geprüft. BerichtSHA
70bbe97e91ced28e48f0e58e310fd4a2f7745933fabe92085cedef418541ad5d.
Alle6 Ablehnungen ohne AppImageanforderung/Cache/Aktivierung, jeweils vollständiger
Readback==Seed. Danach after==restored==unchanged==Seed, continued==protectedRead
und verschieden von Seed. Originale0.0.158/159 und normale Prozessexits bestätigt.
Gastdisk entfernt. Sicherheits-Plan-Audit Feed6/6 bestanden; UX-Audit gescheitert:
Repository/Architektur/Format zeigen rohe Zod-JSON-Fehler, übrige Ablehnungen ohne
nächste Aktion. Korrekturplan: checkRelease kapselt Schema-/JSON-Fehler in klare
Updateinformationen-Meldung samt späterer Prüfung; Herkunfts-/Versions-/fehlende
Manifestmeldungen ergänzen nächste Aktion. Strenge Prüfung unverändert, Fehlerursache
intern erhalten. Unitfälle echte JSON-/Schemafehler und keine weiteren Fetches,
Format/Lint/Typecheck; spätere neue gepackte Abnahme erforderlich.

Separater CI-Befund:34471542570 auf383f6f4a3 terminalfailure, nur sceneDesktop im
campaign-workspaces plus Aggregate. Log und ZIP10150267523 lokal gesichert.
Erster Fehler scene-desktop.e2e.ts:487 nach Pause: erwartet pausiert, erhalten
travelling plus Aktualisierungshinweis. Screenshot danach completed und Konflikt/
outcome_unknown;3 Folgefehler bei offenem Reisedialog. CI-Fixture-DBs gesichert:
01a08b17-ba81... enthält nur Position- und Start-Receipt (Reiserevision0,
Szenenrevision15/16), keine Pause-Receipt. Kein Nachweis eines erfolgreich
committeten Pausebefehls. Hypothesen getrennt prüfen: automatische Fortschritte
ändern Revision zwischen UI-Intent und Utility-Ausführung; Command-Port behandelt
überholte Session-Refreshes als stale. Keine pauschale Timeout-/Testlockerung.
Nach Feed-Textfix ist dieser reproduzierbare Reiseablauf nächster Korrekturblock.

94776 ESLint Exit1 vor Tests: zwei expect.any-Matcher tragen im Objekt any.
Korrekturplan: Matcherausgaben als unknown typisieren, Prüfungsinhalt unverändert.
Danach8 Transporttests einschließlich vorhandener Offline-/Downloadfälle sowie
Format/Lint/beide Typechecks erneut. Keine Änderung an Validierungsbedingungen.

94846 terminalExit0:8/8 Transporttests, Format/Lint und beide Typechecks grün
(29.70s,1.5GiB). Plan-Audit Feed-Fehlertextimplementierung bestanden; gepackter
Nachweis neuer Texte offen. Sicherheitsnachweise sechs Fälle bleiben auf
unveränderten0.0.158/159 gültig. Roadmap-Audit weiterhin unvollständig, insbesondere
CI-Reisepausefehler, neue gepackte Feed-Texte, Erstinstallation/Übernahme und Local.
Aktuellen Candidate pushen; kein Main/Handoff. Folgende Fehlerrunde muss zunächst
Reisepause reproduzieren und Ursache zwischen automatischem Fortschritt,
Intentrevision und Command-Receipt/Refresh isolieren; nicht nur Testwartezeit erhöhen.

### Phase 5 – Pause gegen ausschließlich automatischen Reisefortschritt

Voriger Turn Fortschritt:496bc1feb gepushte Feedfehlerqualifikation/UX-Korrektur;
Check34473788814 live, Arbeitsbaum sauber. CI383f6f4a3 hat keinen Pause-Receipt.
Codeprüfung: jeder erfolgreich automatisch zurückgelegte Hex erhöht genau einmal
Reiserevision, current_index und globale Szenenrevision. Pause prüft alte Reise-
und Szenenrevision strikt. Geplanter enger Fix: optionaler erwarteter Fortschritts-
index nur im Pausekommando. Innerhalb derselben Command-Transaktion darf ausschließlich
bei weiterhin reisender Szene und identischem positiven Delta aller drei Zähler
auf die aktuelle Revision pausiert werden. Kein Rebase bei anderem Szenenwechsel,
Gruppen-/Routen-/Kontrolländerung, beendeter Reise oder fehlendem Index. Bestehende
Kommandos bleiben strikt, keine neue Datenbankversion. Originalkommando bleibt
unverändert im idempotenten Receipt-Journal.
Zuerst optionalen Vertrag plus deterministischen Clock-Regressionsfall hinzufügen,
vor Verhaltensfix stale reproduzieren. Danach eng begrenzten Core-Guard und
Fortschrittsindex aus dem originalen UI-Descriptor bis zum Hexprovider übertragen;
bei Entwurfsklärung Index frisch aus vorbereitetem Descriptor übernehmen.
Tests für automatische Schritte, echte Kontroll-/Szenenkonflikte, alte Reise,
Receipt-Replay und Providerweitergabe; bestehende Reise-/Owner-Tests beibehalten.
Keine pauschale Retry-Schleife oder Lockerung der normalen Revisionsprüfung.
Anschließend statische Checks und isolierte E2E-/gepackte Abnahme; CI-Ursache bleibt
bis entsprechender Laufzeitbestätigung teilweise unbewiesen, kein Phasenabschluss.

29859 Regression vor Core-Fix terminalExit1: optionales Pausefeld akzeptiert, genau
ein automatischer Hexschritt ausgeführt; Pause scheitert in
hex-travel-command-service.ts:62 mit stale an der Szenenrevision. Damit ist diese
Race-Bedingung deterministisch nachgewiesen; ein überholter Refresh ist dafür
nicht erforderlich. Jetzt den geplanten Drei-Zähler-Guard und UI-Weitergabe
implementieren, positive Mehrschritt-/Replay- und negative Kontroll-/Roster-/
Neustart-/Abschluss-/Legacyfälle prüfen. Keine Änderung der allgemeinen Revisionen.

69490 terminalExit0:77/77 bestehende und neue Tests in6 Dateien bestanden,
inklusive18 SQLite-Receiptfälle. Ein/zwei automatische Schritte pausieren und
Receipt-Replay schreibt nicht erneut; Kontroll-/Roster-/Reiseersatz-/Abschluss-
und Legacykonflikte bleiben abgewiesen. Ergänzende geplante Absicherung vor
Freigabe: reine Szenenänderung trotz unveränderter Reise sowie Providerweitergabe
des ursprünglichen Index und frischer Index nach Entwurfsklärung. Danach dieselbe
Testsuite plus Format/Lint/beide Typechecks; gepackte/CI-Bestätigung noch offen.

22850 terminalExit0: abschließende 80/80 Tests in sechs Dateien, ESLint und beide
Typechecks bestanden; 38.829s, maximal1.7GiB, kein Swap. git diff --check grün.
Plan-Audit Pausekorrektur: optionaler ursprünglicher Fortschrittsindex durch alle
Providerpfade, frischer Index nach Entwurfsklärung, enger Drei-Zähler-Guard in der
Command-Transaktion und unveränderte Receipt-Identität implementiert. Positive
Ein-/Mehrschritt- und Replayfälle sowie sechs Konfliktarten nachgewiesen.
Roadmap-Audit: diese Korrektur beseitigt eine reproduzierte Laufzeitblockade der
Phase5; weder vollständige E2E-Bestätigung noch Artefaktabnahme damit ersetzt.
Check34473788814 für496bc1feb weiterhin live (campaign-workspaces), kein Fehler
bis zur letzten Abfrage. Kein Main/Handoff/Release. Host56GiB frei, keine VM.
Vorheriger Goalturn: Fortschritt durch erneute Prüfung von Speicher und
Vorboot-Protokoll; Speicherursache bestätigt, Absturzmitwirkung weiter unbewiesen.

Fixplan gepackte Feed-Fehleranzeige: bisherigen sechs negativen Feedfälle erhalten;
optional --feed-actionable verlangt zusätzlich den verständlichen Hinweis mit
nächster Aktion und schließt sichtbare rohe Zod-Diagnosen aus. Flag darf nur
zusammen mit --feed-failures verwendet werden. Alte Artefaktprüfungen bleiben
reproduzierbar. Nach statischen Checks neue unveränderte Vergleichsartefakte
bauen und denselben vollständigen Update-/Weiterarbeits-/Restoreweg prüfen.

Feed-Prüfer: erster statischer Lauf15528 scheiterte an falsch platzierter
Notice-Prüfung und unnötigen Regex-Escapes. Vor Laufzeitverwendung innerhalb des
Feedblocks korrigiert. Wiederholung45927 terminalExit0: Format, ESLint und beide
Typechecks grün; diff-check grün. Plan-Audit: sechs Ablehnungsfälle bleiben
unverändert sicherheitsgeprüft, neues Flag verlangt nächste Aktion und keine
rohen Schemafelder. Roadmap-Audit: gepackter Nachweis neuer Fehlertexte offen;
diese statische Erweiterung ersetzt ihn nicht.
Remote Check34473788814 terminal success für exakt496bc1feb8f6a91073467904678b8e88a5e73e67.
Jetzt neuer Kandidat mit Pausekorrektur und Feed-Prüfer, vollständige CI erneut;
keine Main-Promotion und keine neue Host-GUI-Ausführung.

Fortsetzung: vorheriger Goalturn Fortschritt (Pausekorrektur ac3a0b76d, Feed-Prüfer
983feb554 committed/pushed, statische Validierung). Check34475495340 für exakt
983feb554869a4719e441bac26b1b472855ab09a ist live. Host56GiB frei.
Konkreter Vergleichsartefaktplan: neue Baseline aus2ccba43f60 mit ausschließlich
Pause- und GitHub-Fehleranzeige-Quelldateien aus983feb554; Schema42/41 bleibt
unverändert. Ziel983feb554 Schema42/42. Neue Katalog-IDs feed-baseline/feed-target,
neue Testversionen0.0.160/161 und neue Ausgabeverzeichnisse; bestehende Bytes
unverändert. Beide Originalquellen werden vom vorhandenen Builder in getrennten
unveränderlichen Checkouts gebaut. Danach isolierter Gastlauf mit --feed-failures
--feed-actionable --installed-launcher. Vollständige sechs Ablehnungen, keine
Aktivierung/Artefaktanfrage, Profilvergleich und anschließender normaler Update-,
Weiterarbeits- und Restoreweg müssen gemeinsam bestehen. Keine neue Aussage über
Pause-E2E allein aus diesem Feedlauf. Gastdisk erst nach geprüftem Export entfernen.

14061 terminalExit1: Baseline0.0.160 vollständig gebaut; Ziel beim pnpm-install
mit ENOSPC abgebrochen. df weiterhin55.46GiB frei. btrfs filesystem usage zeigt
230.30GiB vollständig zugeordnet, nur1MiB unallocated; Metadata2.67/3GiB benutzt.
Keine feste Inodezahl bei Btrfs; deshalb kein Beweis einer Inode-Erschöpfung.
35 historische Buildcheckouts enthalten insgesamt1.885M Dateieinträge. Belegplan
roadmap-phase5-build-cache-cleanup.json validiert34 fertige Artefakte (Größe/SHA),
zugehörige unveränderte HEADs und saubere versionierte Dateien. Jetzt ausschließlich
deren generierte node_modules entfernen, Quellcheckouts/Artefakte/Beweise erhalten.
Keine aktive VM/Build. Anschließend Kapazität und begrenzten Dateierzeugungstest
prüfen. Builder soll nach erfolgreicher Artefakt-/Receipt-Erzeugung seine
rekonstruierbaren Abhängigkeiten entfernen, damit diese Ansammlung nicht fortgeht.

80528 terminalExit0:34 hash-/quellgeprüfte generierte node_modules entfernt.
Btrfs-Metadaten danach1.07/3GiB statt2.67/3GiB; keine Artefakt-/Quelllöschung.
Builder entfernt künftig nach vollständigem Receipt und unveränderter
Quellprüfung ausschließlich das eigene node_modules. 100 begrenzte Datei-/
Verzeichnis-/Rename-Proben im eigenen .tmp erfolgreich, automatisch entfernt.
Fehlgeschlagener Zielcheckout bleibt zur Diagnose erhalten; neuer Versuch
verwendet neuen unveränderlichen Checkout. Baseline-Bytes0.0.160 bleiben erhalten:
4681358dd3aabe1d6dab54f68803a5b4543302c64cc3f8bd55219eeb4d2656bd.

80766 terminalExit0: Builder-/Quellkatalogformat, ESLint und beide Typechecks grün.
72462 Wiederholungsbuild terminalExit0,48.665s,2.7GiB ohne Swap. Originale
Zielquelle983feb554 unverändert gebaut; eigenes node_modules nach Receipt entfernt.
Beide Artefakte per Größe/SHA erneut verifiziert:
0.0.160(42/41)177048243Bytes4681358dd3aabe1d6dab54f68803a5b4543302c64cc3f8bd55219eeb4d2656bd.
0.0.161(42/42)177048367Bytes27ba6b7b92352ea49701faa440c644805828931484134814df1d4c5007ef3d00.
Plan-Audit Builderbereinigung: erfolgreiche Ausführung nach vollständiger
Artefakterzeugung und Erhalt des Quellcheckouts nachgewiesen. Roadmap-Audit:
Build ist kein UI-/Update-Nachweis; Phase5 offen.

Externe Zustandsabweichung während72462: gesamtes work/qualification-vm fehlt;
df jetzt188GiB frei. Die hier ausgeführte Bereinigung80528 betraf ausschließlich
34 in roadmap-phase5-build-cache-cleanup.json enumerierte node_modules innerhalb
Salt-Marcher/.tmp. Kein VM-Verzeichnis in diesem Plan. Nutzer asynchron nach
paralleler Bereinigung gefragt. Containerimage weiterhin vorhanden, VM-Basis,
Seeds, Payloads und lokale validierte Berichte am bekannten Pfad fehlen.
Historische Logeinträge bleiben unverändert, aber deren lokale VM-Beweise sind
aktuell nicht erneut prüfbar. Keine daraus abgeleitete Phasenfreigabe. Neue
VM-Ausführung bis Klärung dieser konkurrierenden Änderung zurückgestellt.
Check34475495340 für983feb554 weiterhin live, bislang keine fehlgeschlagenen Jobs.
Vorheriger Goalturn Fortschritt: Baselinebau, belegte Cachebereinigung und
Builderkorrektur; aktueller Zielbau jetzt nachgewiesen erfolgreich.

Beweisverfügbarkeit nach externer Verzeichnisänderung: rein lesende Inventur
roadmap-phase5-surviving-evidence-inventory.json findet18 JSON-Evidenzdateien,
darunter15 historische Berichte außerhalb qualification-vm. Zwei erhaltene
vollständige UI-Berichte erneut semantisch geprüft: seeded==after==restored==
unchanged, continued==protectedRead!=seeded, alle Readback-Exitcodes0/ResponseOK,
beide Wartungsjournale committed. Berichthashes:
restore-v7 492f97ea40b8dd9e7ca232c62d9ea97f1013fb731a00b20f23abb518ee40af90;
transport-failures-v1 dbafa3ce6a35a535d45d12bb13f06453d8d69035a11f072d411c3e4fe1420a9a.
Dies ersetzt keine neueren Starter-/Unterbrechungs-/WAL-/Kapazitäts-/Feednachweise.
Fixplan Dokumentation: Abnahmematrix erhält datierten Verfügbarkeitshinweis vor
den historischen Klassifizierungen; ursprüngliche Befunde nicht überschreiben.
Plan-Audit Wiederauffinden teilweise erfolgreich, keine Kopie neuerer VM-Berichte
am untersuchten work-Pfad. Roadmap-Audit Phase5 weiter offen; Wiederbeschaffung
oder Wiederholung fehlender Nachweise vor Abschluss erforderlich. Vorheriger
Goalturn Fortschritt durch erfolgreichen Zielbau und belegte Builderbereinigung.

Phase5 unabhängiger Prüfplan während offener VM-Bereinigungsklärung: ergänze einen
separaten Erstinstallationsprüfer für ein tatsächlich leeres isoliertes Ziel.
AppImage direkt aus Downloadordner mit geprüftem angrenzendem Release-Manifest
starten, ursprüngliches „Auf diesem Rechner installieren“ und Bestätigung über
UI bedienen. Kein vorab stageDeployment/setCurrent/installMaintenanceLauncher.
Danach committed-Journal, originale Artefaktbytes, installierten Starter und
leere Kampagnenansicht prüfen; normal schließen, über installierten Starter
neu öffnen und unverändertes Journal prüfen. Keine Profilübernahme hier behaupten:
deren Dialog-/Quellsperrennachweis bleibt eigener offener Fall. Neue Ausführung
verlangt vorhandene Gastisolation und neues Home, findet jetzt nicht auf Host statt.
Validierung zunächst Format/Lint/Typechecks; Laufzeit ausdrücklich noch offen.

CI34475495340 Portable-Job102865137690 terminal failure:1652/1653 Tests bestanden.
Einziger Fehler session-travel-console „fresh preparation ... (false)“ erwartet
altes Pauseobjekt ohne neues optionales expectedProgressIndex. Tatsächlicher
Aufruf genau einmal mit korrekten Revisionen6/8 plusIndex0. Fixplan: Erwartung um
frischen Index ergänzen und Fixture mit nicht-null Fortschrittsindex von altem
Stand unterscheiden; Sperr-/Unmountprüfungen unverändert. Keine Produktlockerung.
Erstinstallationsprüfer73313 ESLintfehler korrigiert (Program.sha256 statt
manifest, kein Throw im finally);54812 noch TS4111 bei Env-Indexzugriff, fixen.
Danach gezielte Console-Suite plus Format/Lint/Typechecks gemeinsam ausführen.

35244 terminalExit0:13/13 Console-Tests inklusive frischemIndex2 und Unmountfall,
Format/ESLint/beide Typechecks bestanden. Neuer Erstinstallationsprüfer statisch
geprüft; kein Gast-/Host-GUI-Lauf erfolgt. Plan-Audit: kein Vorinstallationshelper
im Prüfer; UI-Setup aus Download mit angrenzendem Manifest, committed, Launcher,
Artefakthash, Desktopziel und zweiter regulärer Start werden verlangt.
Roadmap-Audit: Erstinstallation zur Laufzeit und Profilübernahme weiterhin offen;
Console-Testkorrektur ersetzt nicht den verbleibenden vollständigen CI-Lauf.

Fortsetzung: vorheriger Goalturn Fortschritt durch Erstinstallationsprüfer und
Console-Testkorrektur5a028380f. Noch unveröffentlichte Kandidatencommits werden
nach terminalem vorherigem CI-Lauf gepusht, um dessen letzte E2E-Beobachtung nicht
abzubrechen. Watch75023 beobachtet konkret34475495340; letzter Job102866526609
campaign-workspaces ist nach erneuter API-Abfrage in_progress, kein bloßer Lock.

Profilübernahme-Prüfplanung gegen aktuellen Code: qualifySourceProfile verlangt
terminales committed/rolled-back Journal, übereinstimmenden current-Symlink,
AppImage-Hash, validierten Starter und eingebettetes Profilprotokoll. Ein nur
mit stageDeployment und kopiertem Datenordner vorbereiteter Quellstand genügt
nicht. Kommender Test muss zuerst reale Quellinstallation durch Setup abschließen,
dann repräsentatives synthetisches Vollprofil unter exklusiver Sperre vorbereiten,
Quell-App schließen und native Ordnerauswahl plus verständliche Bestätigung im
Ziel bedienen. Vollständiger Quellenvergleich vor/nach und Zielreadback über
originalen Utility erforderlich; Alias/parallel geöffnete Quelle bleibt ein
separater Ablehnungsfall. Keine direkte IPC-Ausführung als Ersatz für UI-Abnahme.
VM-Bereinigungsrückfrage unbeantwortet; kein neuer VM-Start dieses Turns.

75023 Watch terminalExit1: Check34475495340 exakt983feb554 terminal failure.
Alle eigentlichen Jobs außer Portable erfolgreich; Aggregat folgerichtig failed.
Portable einziger Fehler ist die bereits in5a028380f korrigierte veraltete
Console-Pause-Erwartung. Campaign-workspaces102866526609 terminal success:
scene-desktop10/10 inklusive „continues travel with its window closed and
restores an explicitly paused journey after restart“ bestanden; sieben weitere
Workspace-Suiten ebenfalls erfolgreich. Original-Joblog gesichert in
work/roadmap-phase5-ci-34475495340-campaign.log. Damit Pause-E2E-Korrektur auf
983feb554 belegt; vollständiges grünes Kandidatengate bleibt erneut erforderlich.
Vorheriger Goalturn verifiziertes Warten auf75023/102866526609. Jetzt alle seitdem
lokal validierten Änderungen als neuen Kandidaten pushen. Keine Main-Promotion.

Phase5 Nachweissicherung-Fixplan: wiederverwendbarer Collector prüft terminalen
VM-Exitmarker, vollständige Base64-Exportblöcke, gzip-CRC und tar-Einträge vor
Archivierung außerhalb des VM-Verzeichnisses. Nur reguläre JSON-Berichte mit
relativen sicheren Pfaden; keine Links, Traversal oder doppelte Pfade pro Export.
Originalarchiv und Berichte mit SHA/Größe und Exitwerten bewahren. Manifest nennt
explizit nur Transportintegrität, niemals semantisch bestandene Abnahme. Keine
Gastdisklöschung im Collector, keine Quelländerung. Neue Zielverzeichnisse ohne
Überschreiben; Manifest zuletzt schreiben. Tests für gültige Exporte, fehlenden
Endmarker, beschädigtes gzip, unsicheren Archiveintrag und Ziel im VM-Verzeichnis.
Anbindung als eigener CLI-Schritt für zukünftige Gastläufe. Kein VM-Start nötig.

Collector10025 erster statischer Lauf scheiterte an unknown Promise-Rejection;
Fehlernormalisierung ergänzt.34429 terminalExit0:7/7 zielgerichtete Tests,
Format/ESLint/beide Typechecks bestanden. Plan-Audit: außerhalb VM-Ziel geprüft,
keine Quelllöschung, vorhandenes Ziel abgewiesen, gzip/Archive/JSON geprüft,
Originale und Hashes retained, semantische Abnahme ausdrücklich nicht behauptet.
Roadmap-Audit: verbessert künftige Nachweishaltung, ersetzt verschwundene Berichte
nicht. CLI und getrennte fachliche Auditpflicht in Abnahmematrix dokumentiert.
Vorheriger Goalturn Fortschritt: erfolgreicher Pause-E2E nachgewiesen, korrigierter
Kandidat8494e663a gepusht. Check34477259628 für8494e663a derzeit live. Kein VM-Start.

Betriebsentscheidung nach erneuter Prüfung:187GiB frei, kein rm-/QEMU-/Build-
Prozess (pgrep-f Selbsttreffer ausgeschlossen), Quellcheckouts unverändert. Ursache
des verschwundenen Verzeichnisses weiterhin offen, aber kein Beleg fortdauernder
Bereinigung. Frühere VM-Pause war eine eigene Vorsichtsentscheidung, keine
zusätzliche Nutzerfreigabeanforderung. Autorisierte Roadmap fortsetzen mit neuem
work/qualification-vm-v2 und separat aufbewahrten Nachweisen außerhalb dieses
Baums. Zunächst Hersteller-Cloudimage und SHA256SUMS über HTTPS laden, Hash
prüfen; erst dann Ressourcen-/Kernel-Bootstrap ohne SaltMarcher. Bestehender
40GiB-Guard,7GiB/128Tasks/2CPU-Container und private Gastumgebung gelten weiter.
Keine verschwundenen Nachweise als bestanden ausgeben oder Logs überschreiben.

76248 Download terminalExit0,624829952Bytes; Hersteller-SHA256SUMS überHTTPS:
d0fe84bb5f80853425fa6be28e2c106f30104c3cfe8611933f2e65c9b63f0e30,
identisch mit ursprünglichem Basisimage. Versioniertes bootstrap-cloud-init.yaml
enthält nur Gastpaketinstallation und Kernel-/Paketnachweis, keine Appausführung.
16088 neue Bootstrapausführung live: Container
salt-marcher-qualification-0be6183e-c82d-4705-94ae-77c9159a1aea,
work/qualification-vm-v2/bootstrap-run-1. Zeitlimit900s; bestehender Runner mit
Speicher-/Task-/CPU-Grenzen und opt-in NAT nur für Gastpakete. Boot im eigenen
Kernel begonnen, Host weiterhin187GiB frei. Erfolg/Export noch nicht belegt;
keine Quelldateien während der Ausführung ändern. Danach neuen Collector nach
outputs/qualification-evidence anwenden, semantisch Host/Gast/KVM prüfen und erst
dann unveränderliche vorbereitete Basis erzeugen. Vorheriger Goalturn Fortschritt
durch Collector07fb720e7; aktive Roadmap bleibt vollständig offen abPhase5.

16088 Bootstrap terminalExit0, regulärer Powerdown68.66s. Collector archiviert
Originalgzip+Bericht außerhalbVM unter outputs/qualification-evidence/bootstrap-v2-run-1.
Transport plus Semantik geprüft:VMExit0/TestExit[0], Hostkennung stimmt mit
Runner überein, Gast55845ed3-6992-4835-ae10-240231dfc1f3 verschieden, Kernel
6.8.0-138-generic, erforderliche Pakete vorhanden. ReportSHA
eae7cf706e7b7bf4cb127febded689a8e64883ddd411b34d9100a7c79fda2688.
27718 Konvertierung/SeedISO terminalExit0; qemu-img-info bestätigt unabhängige
24GiB-qcow2 ohne Backingreferenz. Erst danach abgeschlossenes Bootstrapoverlay
entfernt. Basis bleibt read-only bei Teststarts.
8033 first-install-run-1 läuft offline mit geprüftem0.0.161 und eingefrorenem
payload-first-install-1. Keine Appquelle geändert. Prüfer/Node/Artefakt/Receipt mit
SHA-Inventar aufread-onlySeed. Deadline600s, innerer3GiB/256Tasks-Service/private
D-Bus/Xvfb. Geplanter Berichtexport first-install-evidence.json bzw Fehlerbericht;
noch keine Laufzeitfreigabe. Nach terminalem Lauf Collector nach separatem
outputs/qualification-evidence verwenden, dann Szenarioinvarianten prüfen.
Vorheriger Goalturn Fortschritt: verifizierte Basisbeschaffung und neuerBootstrap.

8033 Erstinstallation terminalExit0/TestExit0. Collector archiviert vollständigen
Export nach outputs/qualification-evidence/first-install-v2-run-1. BerichtSHA
448b212e701a58b29f5eb9ffc1fbaa457f98080b3f00bcf7ad342f562e918d4a.
Semantische Prüfung:transaction committed, zwei reguläre ProzesseExit0/signalnull,
installierte SHA entspricht0.0.161/27ba6b7b92352ea49701faa440c644805828931484134814df1d4c5007ef3d00,
Desktopziel eigenerstart. Originalprüfer bestätigt tatsächlichen Setup-Klick,
leere Kampagnenansicht, gültigen Starter und unverändertes Journal beim zweiten
Starterstart. Danach Gastdisk entfernt. Plan-Audit Erstinstallation bestanden;
Roadmap-Audit Profilübernahme und vollständiges Phase5-Gate weiterhin offen.
38629 vollständiger Feedlauf mit0.0.160/161 gestartet: neuerread-onlyPayload und
Seed, sechs Ablehnungen mit next-action-Text, danach normalerUpdate/Weiterarbeit/
Restore. Offlinegast mit kontrolliertem Loopbackfeed. Deadline900s. Keine Quellen
während Testlauf ändern. Bericht nachTerminal separat archivieren und alle
Profil-/Prozess-/Artefaktinvarianten prüfen, dann disposableGastdisk entfernen.
Vorheriger Goalturn Fortschritt durch neuenBootstrap und sicherenNachweisexport.

Während38629 unverändert läuft, rein lesende Local-Artefaktvorbereitung:
CI34477259628 stellt10152231791 bereit,35433 Download terminalExit0. Zip enthält
exaktAppImage,Manifest,CandidateReceipt. AppImageSHA und Manifest-Build geprüft:
8494e663a/channelLocal/dirtyfalse,Schema42/42, SHA
9c6d9933bf1c04d82cbaf12fad821605601c9a26f37d3068d7e0bcc8b7c434b9.
Separat bewahrtes OriginalLocal ausrelease/local:bd8b33c4/Schema42/41,
SHA59c509f13517430c5e15d95aed0c306e6c295be3f2bcc2a485957e9eff53d0c4,
Kopie erneut gehasht nachwork/local-artifact-bd8b33c4. Neues Ziel liegt in
work/local-artifact-8494e663a samt Downloadherkunft. Keine Ausführung aufHost,
kein kanonischerHandoff, kein vollständigesCI-grün behauptet. Diese echtenLocal-
Artefakte erlauben künftig den fehlenden Local-Schemawechselnachweis imGast.
VorherigerGoalturn Fortschritt durch bestätigteErstinstallation undFeedstart.

38629 terminalExit0/TestExit0. NeuerCollector erhält Originalexport und Bericht
außerhalbVM in outputs/qualification-evidence/feed-actionable-v2-run-1.
BerichtSHA dcea76ed74cae9eadbafbbb119fb54d9e39c6fa6948d77a112424f519f9daee9.
SechsFehlerfälle manifest-origin/artifact-origin/repository/architecture/
manifest-format/version jeweils mit „Bitte später erneut prüfen.“ ohneZod-Rohtext,
keine AppImage-Anfrage; volleReadbacks stimmen mitSeed. Danach installierter
Starter mit0.0.160(42/41)→0.0.161(42/42), committed Update undRestore,
seeded==after==restored==unchanged, continued==protectedRead!=seeded; alle
ReadbacksExit0/OK und sämtliche normalenUI-ProzesseExit0/signalnull.
BeideArtefakt-SHAs und jeder archivierteDateihash erneut geprüft. Erst danach
Gastdisk entfernt. Plan-Audit gepackteFeed-UX bestanden; Roadmap-Audit Phase5
weiterhin offen (u.a. direkteProfilübernahme, Local-Schemawechsel, Wiederbeschaffung
fehlenderUnterbrechungsnachweise und vollständigeFreigabegates). VorherigerTurn
Fortschritt durch gesicherteOriginalLocal-Vergleichsartefakte.

CI34477259628 exakt8494e663a terminal failure:Portable nun grün, aber
campaign-workspaces102872110081 fehlgeschlagen, Aggregat folgerichtig rot.
Gesichertes Originaljoblog work/roadmap-phase5-ci-34477259628-campaign.log:
campaign creation/switching scheitert in support/campaign-walking-scenarios.ts:251,
Klick auf„Campaign B Archiv bearbeiten“ wird von offener modal-backdrop abgefangen.
Noch keine Ursachenbehauptung. NächsterFixplan erst nach zugehörigemScreenshot,
vorherigerDialogsequenz und Produktzustand; keine blinde Klick-/Timeoutlockerung.
Erfolgreicher neuerAppImage-Feedlauf davon getrennt; kein vollerCandidatepass.

CI-Fehlerklassifizierung34477259628: OriginalScreenshot ausArtifact10152637596
zeigtPapierkorb mit erfolgreicherWiederherstellung; Logposition251 ist zweiter
Editklick nachRestore/Close, nichtRenameabschluss. Produktcode setztModalCloseButton
disabled während busy/Reconciliation; Test klickt direkt nachWiederherstellen ohne
Abschlussbarriere. Fixplan: beide Papierkorb-Schließungen in diesemSzenario über
scopedModalClose ausführen, auf klickbarenKnopf warten, nachKlick aufverschwundenen
Dialog warten. Kein JS-Klick, keinTimeoutanstieg, keineÄnderung derBusy-Sicherheit.
Format/Lint/Typechecks; tatsächlicheE2E-Bestätigung im nächstenvollenCI-Lauf.

35538 terminalExit0:Format,ESLint,beideTypechecks unddiff-check grün.
Plan-Audit: ausschließlich zweiPapierkorb-Schließungen warten aufbedienbaren
scopedKnopf undverschwundenenDialog; nativeKlicks undvorhandeneTimeouts bleiben.
Roadmap-Audit: plausibleBusy-Race damit gezielt adressiert, tatsächlicheBehebung
noch durch vollständigenCI-/E2E-Lauf zu bestätigen. Screenshot allein beweist
nicht den exakten Busy-Wert imMomentdesvorherigenCloseklicks. KeineProduktfreigabe.
Jetzt neuerKandidat mitCollector/Bootstrapnachweisen undTestbarriere pushen.

Local-Qualifikationsplan gegenIstcode: migratePreparedCompleteProfile läuft im
jeweiligenInstaller, deshalb Baseline undZiel mit OriginalInstallerquellen aus
bd8b33c4 bzw8494e663a prüfen, keine Zielmigration beimBaseline-Setup verwenden.
BeideAppImages bereits hashgeprüft. Vor Bundles festeSourcecheckouts erstellen,
readWorkspaceIdentity gegenManifest prüfen, Originalmodule (Installer/Runtime-
Annahme) exportieren und Quellen vor/nachBundling unverändert bestätigen.
Gast erhält diesen separat ausgewiesenenTestadapter und eingefrorene verifizierte
WorkspaceIdentity statt eines fiktiven Source-Fingerprints. Echte Migration,
Launcherextraktion und Runtime-Annahme bleiben original; dies ist kein Ersatz für
kanonischenHandoff samtGit-/CI-Gate. NativeNode-SQLite fürGast gesondert prüfen.
Erst danach vollständigenLocal-Daten-/Runtime-/Rollbacktest aufsynthetischemProfil
aufbauen. Aktuell keinVM-/Buildprozess; letzterGoalturn Fortschritt durch gezielte
Kampagnen-Testbarriere undKandidatenpush. Check34479373201 füra5317c1c4 live.

65999 terminalExit0: Format/ESLint/beideTypechecks bestanden; beideOriginal-
Local-Adapter erfolgreich gebaut. VollständigeWorkspaceIdentity entsprichtjeweils
AppImage-Manifest vor/nachBundling; Schema42/41 und42/42 bleiben getrennt.
Ausgaben work/local-adapter-baseline-v1 undlocal-adapter-target-v1 enthalten
AdapterSHA,IconSHA,ManifestSHA,Originalcommit/Fingerprints undexpliziteKennzeichnung
„not-runtime-qualification-or-handoff“. Kein GUI-Start. Peak1.5GiB/keinSwap.
Plan-Audit Adapterherkunft bestanden; Roadmap-Audit tatsächlicheLocal-Migration,
Startannahme, Profilvergleich undRecovery bleiben offen. NativeBibliothek wird
separat inGast geprüft; lokalesprebuild verlangt maximalGLIBC_2.34 (readelf),
das allein belegt wederNodeABI-Kompatibilität noch erfolgreichenGastbetrieb.

KonkreterLocal-Laufzeitprüferplan: Originalhistorischer42/41-Runtime erzeugt
reiches synthetischesSeed. Kopie unter gemeinsamerProfilsperre in neuenLocal-
Installationsort. BaselineAdapter installiert OriginalLocal42/41; Original
verifyLocalRuntimeStartup startet unverändertesAppImage mit bestehenden
installed-runtime-verification/Smoke-Flags und verlangt reales committed.
Readback überunverändertehistorischeRuntime aufgesperrterKopie vergleichen.
DannOriginalZielinstaller42/42 migriert, startet realesZiel undliestvollständig
zurück. NativeNode-SQLite zuerst imGast öffnen; SHA/Manifest/Adapteridentitäten
prüfen. FehlendeQuellGit-Umgebung wird nur durchvorher realverifizierte eingefrorene
Identity ersetzt, keineFake-Runtimeannahme. Dieser ersteLauf decktLocal-Schema-
Update ab; Unterbrechung/Recovery unddirekterProfilimport bleiben weitereFälle.

36316 statischerErstlauf: zweiTS-Narrowingfehler anReadback-Response. ExpliziteOK-
Assertions anAufrufstellen ergänzt; Native-Diagnose inFehlerberichtspfad verschoben.
44433 terminalExit0:Format/ESLint/beideTypechecks bestanden. Plan-Audit Prüfer
implementiert OriginalInstaller+Runtime-Annahme, vollständigenSeed-/Vorher-/Nachher-
undunverändertenQuellreadback. Noch keinLaufzeitpass.
38290 local-schema-run-1 gestartetinvorbereiteterOfflineVM:600s,3GiB/256Tasks im
Gast,OriginalLocalbd8b33c4→8494e663a,OriginalAdapter separatHashgeprüft,Historical-
Runtime42/41 und42/42 fürsynthetischeVollprofilreadbacks. Nativebetter-sqlite3
13.0.2/lib+linux-x64prebuild undalleTesteingaben imread-onlyPayload samtSHA-Liste.
Noch keinHost-GUI-Test/keinHandoff. KeineQuelldateiänderungen währendLauf.
NachTerminal Collector inoutputs/qualification-evidence undSemantikprüfen; nicht
alleinVMExit0 alsErfolgwerten. VorherigerGoalturn Fortschritt: beideOriginalAdapter
herkunftsgeprüftgebaut. CI34479373201 fora5317c1c4 zuletztlive ohneFehler.

38290 terminalVMExit0/TestExit1. Fehlerexport transportgeprüft separatarchiviert
unteroutputs/qualification-evidence/local-schema-v2-run-1. NativeProbe/Seed
überstanden; OriginalBaseline-Backup startet --import tsx auscwd/ und scheitert
anfehlendemtsx. KeineUpdateabnahme. Adapteraudit findet zusätzlich kollabierte
import.meta.url-Workerpfade. Fixplan: Bundle inlocal-installation/adapter.mjs,
beideOriginalBackup-Worker separat daneben aufOriginalrelativpfaden bündeln;
Originalpackage.json fürESM-Grenze erhalten, jedenWorkerhash imAdaptermanifest
verankern undvorVerwendung prüfen. Prüfprozess cwd aufAdapterroot setzen, echte
installierteTsx/esbuild-Abhängigkeiten mitHashinventar inGast mitnehmen. Keine
ProduktSourceänderung, keineStubWorker odersimuliertenBackups. NeueAdapter-
Ausgaben undPayload,alteFehlerbeweise behalten. WiederstatischePrüfung plusneuer
vollständigerGastlauf erforderlich. Baseline-/ZielAppImagebytes unverändert.

5825 terminalExit0:Format/ESLint/beideTypechecks undbeideOriginalAdapter-v2-Builds
bestanden. Backup-Worker mitjeweilsOriginalquellen gebündelt, separateHashprüfung
plusOriginalpackage.json undrelativeWorkerpfade. Qualifier setztcwd aufverifizierte
Adapterwurzel. Payload-local-schema-2 enthält realeTsx4.23.1/esbuild0.28.1 und
linux-x64Binary nebenNativeSQLite; kompletteSHA-Liste, keineStub-Abhängigkeiten.
53272 local-schema-run-2 gestartet mitOriginalAppImagebytes undneuemSeed,Offline-
Gast600s. Quellen währendLauf unverändertlassen. Plan-Audit statischeWorkerpfade
undAbhängigkeiten ergänzt; Roadmap-Laufzeitnachweis weiterhin offen.
VorherigerGoalturn Fortschritt: Local-Prüfer implementiert/statischgeprüft und
Erstlauf gestartet; dessenFehler nunlokalisiert undarchiviert.


### Phase 5 – Speicherprüfung und Local-Baseline-Diagnose

Voriger Goalturn: Fortschritt durch aktuelle Host-Kapazitätsprüfung und Abgleich
mit dem protokollierten Speicherfehler. Aktuell 177.72GiB frei, Btrfs-Metadaten
925MiB/3GiB, keine QEMU-/Podman-Prozesse. Keine Bereinigung oder Host-GUI gestartet.
Die zuvor ausgesprochene vorläufige Testpause ist keine externe Freigabeschranke;
Diagnose wird unter bestehenden Ressourcen- und Isolationsgrenzen fortgesetzt.

Check34479373201 für a5317c1c4d00e54d423916cd573c8f46e0ea1486 ist jetzt
completed/success. Damit vollständige Remoteprüfung einschließlich der
Trash-Schließbarriere für genau diesen SHA bestanden. Lokale uncommittete
Adapter-/Qualifieränderungen sind davon ausdrücklich nicht abgedeckt.

Local-schema-run-2 ist terminal: VMExit0, TestExit1. Vorhandenes Archiv
outputs/qualification-evidence/local-schema-v2-run-2 erneut anhand sämtlicher
Dateigrößen und SHA-256 geprüft. Es belegt den Fehler, keinen erfolgreichen
Local-Schemaübergang. Gastdisk bleibt für Diagnose erhalten.

Codevergleich des originalen bd8b33c4-Installers zeigt: dessen Ressourcenleser
verwendet AppImage -e mit ELECTRON_RUN_AS_NODE und APPIMAGE_EXTRACT_AND_RUN.
Er verwendet noch nicht den aktuellen direkten --appimage-extract-Leseweg.
Der früher dokumentierte Gastbefund60521 war Exit9/bad option --no-sandbox,
verursacht durch AppRun nach fehlgeschlagenem unshare -Ur. Dies erklärt einen
plausiblen Zusammenhang, ist ohne stderr des aktuellen Fehlers noch kein
endgültiger Ursachenbeleg. Backup-Workerfehler des ersten Laufs trat diesmal
nicht erneut als Abbruchstelle auf.

Fokussierter Diagnoseplan vor weiterem Test: In frischem begrenztem Offlinegast
nur den originalen Ressourcenleseaufruf des unveränderten Baseline-AppImages
reproduzieren und Exit, Signal, stdout/stderr sowie unshare-Ergebnis als JSON
exportieren. Keine Änderung von Originalinstaller, AppImage oder Host-Schutz.
Erst danach entscheiden, ob die Gastumgebung für den historischen Installer
angepasst werden muss oder ein gesonderter Vergleichsstand erforderlich ist.
Ein Austausch des alten Installers gegen den aktuellen darf nicht als Prüfung
des ursprünglichen Local-Ablaufs ausgegeben werden. Plan-Audit: Fehlerarchiv und
CI-Status verifiziert. Roadmap-Audit: Local-Laufzeitmigration, Unterbrechungen und
weitere fehlende Phase-5-Nachweise weiterhin offen; Phasen6/7 nicht begonnen.

80278 Diagnosegast terminalExit0/TestExit0. Original-AppImage SHA vor/nach gleich;
Node-Ressourcenleseaufruf Exit9 mit bad option: --no-sandbox; unshare -Ur true
Exit1 mit uid_map Operation not permitted. Diagnosearchiv vollständig inklusive
SHA/Größe geprüft, BerichtSHA d239bdf737e7855c456c79def95423ba1b2d3b6b21673ffc6ce6d0e68280fa
(Korrektur: maßgeblich ist SHA im archivierten Manifest, nicht diese Abschrift).
Nur Diagnosegastdisk nach Prüfung entfernt. Kein Migrationserfolg behauptet.

Korrekturplan Gastkompatibilität: unveränderte Local-Payload2 in neuem Gast
verwenden. Ausschließlich dort kernel.apparmor_restrict_unprivileged_userns=0
setzen, davor vom QEMU-Hostbootwert abweichende Gastboot-ID erzwingen. Dadurch
kann historisches AppRun die ursprünglich vorausgesetzte unprivilegierte
Namensraumfunktion verwenden. Kein Host-sysctl, kein Artefaktpatch und keine
simulierte Runtimeannahme. Seed dokumentiert diese abweichende Gastkonfiguration;
Ergebnis gilt nur dafür. Aktuelle Release-Läufe unter unveränderten strengeren
Gastbedingungen bleiben eigenständige Nachweise. Vollständigen ursprünglichen
Local-Installer-/Migrations-/Runtime-/Profilvergleich wiederholen.

Diagnosebericht SHA korrekt: d239bdf737e7855c456c79def95423ba1b2d3b6b21673ffc6ce6d6e0e68280fa.

54379 Local-schema-run-3 terminalVMExit0/TestExit0. Vollständiges Archiv außerhalb
der VM unter outputs/qualification-evidence/local-schema-v2-run-3 aufbewahrt;
alle Größen/Hashes erneut geprüft. Originalinstaller bd8b33c4 und8494e663a
starten jeweils ihre unveränderten Local-AppImages und erhalten reale ready-
Bestätigung mit passendem Buildcommit. Beide Journale committed, zweiter previous
entspricht exakt erstem next, getrennte Sicherungen vorhanden. Seed, Vorher,
Nachher und unveränderte Quelle vollständig logisch gleich: Einstellungen,
Registry, Kampagnen, Präferenzen und eigene Dateien. Alle Readbacks Exit0/OK.
BerichtSHA: 0a8129aad563a7bc298c58ba20603fd2a10a0f2385f7c966e22f073d2ac20155.
Gastdisk nach vollständigem Belegvergleich entfernt; frühere Fehlerdisks bleiben.

Plan-Audit Local-Schemaübergang42/41→42/42 mit Originalinstallern und tatsächlichen
AppImages bestanden, ausdrücklich im Gast mit erlaubten unprivilegierten
User-Namespaces. Kein canonical handoff, kein Local-Abbruch-/Recoverynachweis und
kein direkter UI-Profilimport. Roadmap-Audit Phase5 bleibt für diese und zuvor
festgehaltene fehlende Nachweise offen. Nächste Arbeit: qualifizierten Local-
Prüfer samt Adapteränderungen reviewen/committen und direkte Profilübernahme
sowie unterbrochene Local-Aktivierung mit realen Artefakten ergänzen.
