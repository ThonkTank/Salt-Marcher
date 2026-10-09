# Gemeinsame End-to-End-Gates – Kandidat v1

Stand: 9. Oktober 2026. Dieser Katalog ist ein **Vorschlag zur Teamratifikation**, kein Gesamt-Gate und keine Fachfreigabe. Er ordnet die vier Abläufe aus [Issue #12](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12) eindeutig zu. Die [vollständige SaltMarcher-Ablösung](ROADMAP-SALTMARCHER-REPLACEMENT.md), Dungeon-Draft-/Wonderdraft-Bedien- und Funktionsparität sowie alle eigenen Bereichsgates bleiben zusätzlich verbindlich. Die Atlasgrafik muss ungefähr gleichwertig sein; Bedienung und Funktion müssen übereinstimmen. Der Zielhost ist noch nicht entschieden.

## Regel für jeden Gate-Claim

Ein nummeriertes `PASS` benennt genau einen versionierten Gatekatalog, eine integrierte Kandidaten-SHA, einen eingefrorenen synthetischen Fixturestand mit Datei-Hashes, die ausgeführten Checks, den echten Host-/Prozessbeleg und einen unabhängigen Reviewer. Bereichsbranches, Modelltests, ein einzelner Obsidian-Smoke und geplante Verträge sind nur entsprechend begrenzte Zwischenbelege. Der Steward pinnt Kandidat, Fixture und Gateprotokoll; er entscheidet keine fremde Fachfrage und gibt eigene Änderung nicht selbst frei. `active/installed-phase1` ist der einzige gemeinsame Integrationsbranch; Facharbeit erfolgt auf Kandidatenbranches und wird erst nach Review und passendem Gate übernommen.

Bei jedem schreibenden Ablauf werden CommandId, Eingangsrevision, Receipt, Cancel-vor-Publish, Crash/Antwortverlust nach Publish, Retry mit der ursprünglichen CommandId und frischer Prozess geprüft. Ein `outcome_unknown` löst keinen blinden neuen Befehl aus. Bestätigte Daten erscheinen vollständig und genau einmal; weder Teilwirkung noch verlorene Quarantäne-/Survivor-Daten dürfen als Erfolg gelten. Diese Querschnittsregel ersetzt die fachlichen Orakel der vier Gates nicht.

## E2E-01 – Kampagne und gemeinsamer Raum → Save/Restart

**Nutzerablauf:** Neu angelegte oder vollständig importierte Kampagne öffnen → World/Location auf derselben grenzenlosen Atlasfläche wählen → Hex/Ort/City/Haus/Dungeon/Raum-Key allein durch Navigation und Zoom bearbeiten → gemeinsame Undo/Redo-Folge → speichern → Anwendung vollständig beenden → frischer Prozess → dieselben IDs, Geometrie, Abschnittsreihenfolge, exakten Markdownbytes und Referenzen wiederfinden. Es gibt keine zweite Kamera, getrennte Karten-History oder automatischen LiveSession-Start.

**Harte Eingänge vor vollständigem PASS:** ausführbare Campaign-/Party-/Preparation-/Initialize-Anbindung und Campaign→Atlas-Navigation; bestätigte Hex-/City-/Dungeon-Payload- und Haus→Dungeon-Bindung; genau ein History-/Snapshot-/Transaction-Port für alle betroffenen Owner; realer P02-Mehrbesitzer-Save/Recovery-Implementierer; für die verbindliche Import-Eingangsvariante ein P04-Owner und echter Complete-Import-Beweis. Ein früher Atlas/City/Dungeon-Smoke bleibt ausdrücklich Zwischenbeleg. Hex' [Atlas-Fixture-/Plan-Kandidat PR #13](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/13), [Stadts City-Plan auf Kandidaten-SHA](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/1de3ceead95b9a126419b79f1201fe95d9b22c7e/ROADMAP-CITIES-E2E-INTEGRATION-PLAN.md) und die Dungeon-Ownerantwort in #12 liefern Fachanteile, noch keinen gemeinsamen Kandidaten.

**Orakel:** dieselbe World-/Location-/Placement-/City-/Building-/Dungeon-/Floor-/Room-/Route-/Section-Identität; Gelände, City- und Dungeonänderung in einer Undo/Redo- und Savegrenze; keine kopierte Keywahrheit; Save/Copy/Discard/Recovery ohne Quellverlust; frischer Prozess und unabhängige Importvariante ohne stillen Text- oder ID-Verlust. Atlas-QA prüft den sichtbaren integrierten Hostablauf unabhängig; Fach- und Plattformreview bleiben bei ihren Besitzern.

## E2E-02 – Vorbereitung → Live-Spiel → Abschluss

**Nutzerablauf:** Ort, Party und Encounter vorbereiten → bestätigten immutable Preparation-Snapshot übernehmen → LiveSession ausdrücklich initialisieren → Party Split/Move/Rejoin, Primary-/SplitScene und Focus nutzen → Encounter/Chase/Combat/Loot ausführen → Session abschließen. Vorbereitung bleibt unverändert, solange kein eigener bestätigter Vorbereitungsbefehl sie ändert.

**Harte Eingänge:** Campaign-/Preparation-/Party-/Scene-/Focus-/Encounter-/Chase-IDs und Revisionen, versionierte immutable Projektionen, Katalogreferenzen statt kopierter Fremdpayloads, zuständige Fachowner und derselbe Receipt-/Savevertrag. Music/Weather/Shops konsumieren nur bestätigte Focus-/Clock-/Location-Projektionen; ihre manuelle Steuerung und Fehlergrenzen bleiben eigene Bereichsgates.

**Orakel:** ein durchgängiger ID-/Receipt-Trace; keine Doppelbelegung oder unerlaubte Zustandsübertragung bei Split/Rejoin; kein verfrühter Scene- oder Consumerstart; Restart, Retry und fehlgeschlagenes Publish erhalten Preparation und bestätigte Live-Wahrheit. Zeitfolgen, die im Spielabend ausgelöst werden, erfüllen zusätzlich E2E-03.

## E2E-03 – Reise → Kalender/Clock → Weltreaktion

**Nutzerablauf:** Reise im gemeinsamen Atlas vorbereiten und bestätigen → Partyposition und Scene-Zeit fortschreiben → Kalenderereignisse, Wetter, Shopzustand und Musik-/Szenencues konsistent reagieren lassen → Reise unterbrechen, fortsetzen, rückgängig machen und nach Neustart wiederholen.

**Harte Eingänge:** namentlich übernommener Travel-/Clock-/Calendar-/WorldEffects-Besitz, bestätigte Location-/Scene-/Focus-/Asset-IDs, kausale Ereignis- und genau-einmalige Receipt-Semantik sowie begrenzte Weather-/Shop-/Music-Consumerverträge. Ein Consumer besitzt keine Campaign- oder Clock-Wahrheit.

**Orakel:** Preview schreibt nichts; Confirm erzeugt genau eine fachliche Zeit-/Ortsfolge; Cancel, Crash, Providerfehler, Offline-Restart und Retry duplizieren weder Reise noch Restock, Wetter- oder Cue-Wirkung. `none`, stale und unavailable bleiben für Consumer sicher; manuelle Overrides behalten ihre Priorität.

## E2E-04 – Portabilität, Recovery und sichere Anzeige

**Nutzerablauf:** Kampagne samt Assets, Runtime, Definitionen, Trash und unbekannten erhaltenen Daten als Complete oder offengelegtes Salvage exportieren → auf einem unabhängigen Host importieren oder aus Backup wiederherstellen → denselben fachlichen Zustand weiterführen. Während eines GM-Spielabends erhält ein isoliertes passives Display ausschließlich freigegebene Spielerprojektionen. Die Bedienung funktioniert per Tastatur, bei 200 Prozent Skalierung und in kleinen Fenstern.

**Harte Eingänge:** reale P02-/P03-/P04-Implementierer und unabhängige Reviews; Host-/Capability-/Archiv-/Migrationverträge; ein zweiter isolierter Fensterprozess; vollständige Asset- und ID-Remap-Regeln; unterstützte OS-Builds. Der Plattformentscheid in [Issue #11](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/11) bleibt offen, bis P01–P04/C01 und die erforderlichen OS-Belege vorliegen.

**Orakel:** bestätigte Bytes und Referenzen über Export/Import/Restore erhalten; unvollständige Medien als Salvage sichtbar statt still fehlend; beschädigte Kerndaten fail-closed und Survivor-/Quarantänebestand erhalten. Display ist read-only und zeigt keine GM-Keys oder privaten Daten in DOM, Pixeln, Accessibility-Namen, Speicher, Logs oder Netzwerkanfragen; `none`/stale/unavailable und Fehler bleiben neutral. Zielhost-, OS-, physische Eingabe-, Accessibility- und Großweltbelege werden nicht aus einem Linux-/Obsidianlauf abgeleitet.

## Reihenfolge und offene Entscheidungen

1. Die beteiligten Fachowner bestätigen oder korrigieren diese vier Bedeutungen und pinnen einen versionierten gemeinsamen Katalog. Frühere abweichende E2E-02/03/04-Nummern in #12-Kommentaren und Bereichsplänen werden auf die bestätigte Zuordnung abgebildet, ohne Anforderungen zu löschen.
2. Für E2E-01 werden Campaign→Atlas, Haus→Dungeon, gemeinsame History/Transaction, P02 und die geforderte P04-Importvariante mit realen Implementierern und Fixtures verbunden. Hex' erste Steward-Rotation ist ein Angebot, keine Selbsternennung; unabhängiger Gate-Code-Review bleibt zusätzlich zu Atlas-QAs Hostprüfung nötig.
3. Encounter/Chase, Travel/Clock/Calendar/WorldEffects, P03-Player-Display und die allgemeinen P02/P04-Adapter brauchen ausdrücklich übernommene Implementierungsowner. Bereichsreview oder Consumerarbeit besetzen diese Rollen nicht stellvertretend.
4. Nach Review und Ratifikation werden Wellen B–E in #12 an die tatsächlichen Eingänge der vier Gates angepasst. Der gesamte SMR-00–11-Umfang und die eigenen Paritäts-, Performance-, A11y-, Migrations- und OS-Gates werden in Welle F zusätzlich geprüft.
