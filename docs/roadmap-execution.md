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
| 2     | in Arbeit |
| 3–7   | offen |

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
