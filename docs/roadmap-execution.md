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
| 3     | in Arbeit |
| 4–7   | offen |

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
