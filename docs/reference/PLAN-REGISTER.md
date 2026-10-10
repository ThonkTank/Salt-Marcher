# Fachplanregister und frühere Pakete

Dieser Nachschlageort wird nur für den ausgewählten Fachvertrag oder einen konkreten Beleg gebraucht. Für aktuelle Aufgaben zum [Bereichseinstieg](../INDEX.md) zurückkehren. Repair-/Cleanup-Namen und Datumsangaben sind keine aktuellen Arbeitsaufträge. Bestehende Vertragsanforderungen bleiben bindend, bis eine ausdrückliche Ablösung vorliegt.

## Atlas-Laufbelege

[H02-Rohbelege und Buildprovenienz](atlas-host-h02/H02-PROVENANCE.md); [ursprüngliche Save/Fresh/Recovery-Belege](atlas-host-save-i02-h01/SAVE-PROVENANCE.md); [Orts-Save H01](atlas-shared-location-h01/README.md), [D01-Ursache](atlas-shared-location-d01/README.md), [R01-Reparatur](atlas-shared-location-r01/README.md), [damalige Komposition mit Shared315f09b](atlas-shared-location-r01/composition.json), [N02-No-op-Save](atlas-shared-location-r01/noop-repair.json), [Shared-Ort/Key H02: echter Save und frischer Prozess](atlas-shared-location-h02/README.md).

Diese Belege gelten für ihre damalige Source/Fixture. #40 ist im Orts-/Key-Scope abgeschlossen. [D01: konkreter Save-Eingang für Dungeonverortung](atlas-detail-binding-d01/README.md) und [N01: gezielte Referenzreparatur](atlas-detail-binding-d01/repair-n01.json) binden Befund und Kandidat an #7 und E2E-01 Zeile13; damalige nächste Schritte sind keine aktuellen Aufträge. [I01: sichtbarer Dungeon-am-Ort-Anschluss](atlas-detail-binding-d01/dungeon-at-location-i01.json) und [N02: Ortswechsel ohne alten Dungeonlink](atlas-detail-binding-d01/dungeon-at-location-n02.json) liefern den aktuellen #80-Consumer; Atlas-QA-Nachprüfung und Hostqualifikation bleiben getrennt.

## Bestehende Fach- und Paketpläne

Die folgenden Dateien sind ein **Register**, keine gleichrangigen aktuellen Aufträge. Umfang, Datum, aktueller Ownerlauf und direkte Abnahmen vor Verwendung prüfen. Insbesondere Repair-/Cleanup-Pläne und frühere Termine beschreiben ihren jeweiligen damaligen Stand. Die alte [Root-Roadmap](../../ROADMAP.md) dokumentiert den Raum-Key-Lieferweg.

Die bestehenden Pfade bleiben stabil, weil Checkpoints, Acceptance, externe Handoffs und laufende Kandidaten darauf verweisen. Neue Contributors brauchen die Dateien nicht der Reihe nach zu lesen: erst die Produktroadmap, dann das zu ihrer Aufgabe passende Fachpaket. Neue Gesamtziele werden nicht in zusätzlichen Root-Roadmaps dupliziert.

### Gesamtprodukt und Integration

- [Gemeinsame End-to-End-Gates – Kandidat v1](../../ROADMAP-E2E-GATES-CANDIDATE.md)
- [Vollständige SaltMarcher-Ablösung im gemeinsamen Zielprodukt](../../ROADMAP-SALTMARCHER-REPLACEMENT.md)

### Atlas und Hex

- [HEX-00: begrenztes Aufräumen nach dem Referenzreview](../../ROADMAP-HEX-00-CLEAN-PLAN.md)
- [HEX-00: technische Planung der Referenz- und Testbasis](../../ROADMAP-HEX-00-PLAN.md)
- [HEX-00: begrenzte Nachbesserung des Referenzkatalogs](../../ROADMAP-HEX-00-REPAIR-PLAN.md)
- [HEX-01: begrenztes Aufräumen](../../ROADMAP-HEX-01-CLEAN-PLAN.md)
- [HEX-01: den gemeinsamen Atlas anlegen und öffnen](../../ROADMAP-HEX-01-PLAN.md)
- [HEX-02: begrenztes Aufräumen vor dem ersten Ortsablauf](../../ROADMAP-HEX-02-CLEAN-PLAN.md)
- [HEX-02: eine Hexkarte tatsächlich bearbeiten und erhalten](../../ROADMAP-HEX-02-PLAN.md)
- [HEX-02-N01: zwei Pflichtbefunde aus R01 schließen](../../ROADMAP-HEX-02-REPAIR-PLAN.md)
- [HEX-03: ein Ort mit Key direkt auf der Hexkarte](../../ROADMAP-HEX-03-PLAN.md)
- [Roadmap: Hex-Atlas mit Wonderdraft-Parität und verbundenen Orts- und Dungeon-Keys](../../ROADMAP-HEX-ATLAS.md)

### Städte

- [CITY-01: Vorschlag zum bestehenden Atlasanschluss](../../ROADMAP-CITIES-ATLAS-INTEGRATION-PROPOSAL.md)
- [CITY-00 I47: COK-Licht und Wetter direkt prüfen](../../ROADMAP-CITIES-CITY00-COK-ATMOSPHERE-PLAN.md)
- [CITY-00 P48: Atmosphärenvorlage und frisches Öffnen](../../ROADMAP-CITIES-CITY00-COK-TEMPLATE-REOPEN-PLAN.md)
- [CITY-00: Canvas-of-Kings-Variantenprobe](../../ROADMAP-CITIES-CITY00-COK-VARIANTS-PLAN.md)
- [CITY-00 I45: Gebäudebedarfe und Anzahlgrenzen im FTG-Original](../../ROADMAP-CITIES-CITY00-FTG-BUILDING-LIMITS-PLAN.md)
- [CITY-00 I46: Bewohner gemeinsam bearbeiten](../../ROADMAP-CITIES-CITY00-FTG-BULK-EDIT-PLAN.md)
- [CITY-00 I44: FTG-Evidenzzuordnung bereinigen](../../ROADMAP-CITIES-CITY00-FTG-MAPPING-PLAN.md)
- [CITY-01-Vorbereitung: Stadtbefehle in der gemeinsamen History](../../ROADMAP-CITIES-CITY01-COMMANDS-PLAN.md)
- [CITY-01-Vorbereitung: Werkzeugentwurf, Abbruch und Apply](../../ROADMAP-CITIES-CITY01-DRAFT-PLAN.md)
- [CITY-01-Vorbereitung: Straßen- und Hausaktionen](../../ROADMAP-CITIES-CITY01-EDIT-PLAN.md)
- [CITY-01: Werkzeugadapter für direkte Stadtbearbeitung](../../ROADMAP-CITIES-CITY01-GESTURES-PLAN.md)
- [CITY-01: Anschluss an den gemeinsamen Atlas](../../ROADMAP-CITIES-CITY01-INTEGRATION-PLAN.md)
- [CITY-01-Vorbereitung: natives Stadtmodell und Codec](../../ROADMAP-CITIES-CITY01-MODEL-PLAN.md)
- [CITY-01: gemeinsamer City-Szenenbeitrag](../../ROADMAP-CITIES-CITY01-RENDERER-PLAN.md)
- [CITY-01-Vorbereitung: gemeinsame Stadtgeometrie und Treffer](../../ROADMAP-CITIES-CITY01-SCENE-PLAN.md)
- [Stadt-Pfad: technischer Gesamtplan und CITY-00](../../ROADMAP-CITIES-IMPLEMENTATION-PLAN.md)
- [Stadt-Referenzgalerie](../../ROADMAP-CITIES-REFERENCE-GALLERY.md)
- [Referenzlücken vor den Stadtpaketen](../../ROADMAP-CITIES-REFERENCE-GAPS.md)
- [Stadtpläne im durchgehend bearbeitbaren Atlas](../../ROADMAP-CITIES.md)

### Dungeon-Parität und Werkzeuge

- [Werkzeuginventar](../../TOOL-PARITY.md)

- [Aufräumplan nach Fachphase 1: Building-Grundformen](../../ROADMAP-PARITY-CLEANUP-1-PLAN.md)
- [Aufräumplan nach Fachphase 2: Building-Konturpunkte](../../ROADMAP-PARITY-CLEANUP-2-PLAN.md)
- [Aufräumplan nach Fachphase 3: Building-Stile und Bodenvorschau](../../ROADMAP-PARITY-CLEANUP-3-PLAN.md)
- [Nachbesserungsplan: Phase-4-Aufräummatrix](../../ROADMAP-PARITY-CLEANUP-4-MATRIX-REPAIR-PLAN.md)
- [Aufräumplan nach Fachphase 4: Objektbibliothek und Tagbrowser](../../ROADMAP-PARITY-CLEANUP-4-PLAN.md)
- [Nachbesserungsplan: Phase-4-Aufräumen](../../ROADMAP-PARITY-CLEANUP-4-REPAIR-PLAN.md)
- [Aufräumplan nach Fachphase 5: Objektzustand, Palette und Licht](../../ROADMAP-PARITY-CLEANUP-5-PLAN.md)
- [Nachbesserungsplan für den Phase-5-Aufräumreview: Ressourcen und Lichtbilder](../../ROADMAP-PARITY-CLEANUP-5-REPAIR-PLAN.md)
- [Aufräumplan nach Fachphase 6: Objektliste und Auswahl-Zeigerzustand](../../ROADMAP-PARITY-CLEANUP-6-PLAN.md)
- [Aufräumplan nach Fachphase 7: Hostfenster und große Prüfzustände](../../ROADMAP-PARITY-CLEANUP-7-PLAN.md)
- [Phase 2 – Konturpunkte bearbeiten: konkreter Phasenplan](../../ROADMAP-PARITY-PHASE2-PLAN.md)
- [Fachphase 3 – Boden und Gebäudewand gestalten: Umsetzungsplan](../../ROADMAP-PARITY-PHASE3-PLAN.md)
- [Phase 3 – Nachbesserungsplan für Bevel und QAWall01-Konturen](../../ROADMAP-PARITY-PHASE3-REPAIR-BEVEL-POINTS-PLAN.md)
- [Phase 3 – Nachbesserungsplan nach dem 17-Fälle-Review](../../ROADMAP-PARITY-PHASE3-REPAIR-IMAGE-MATRIX-PLAN.md)
- [Fachphase 3 – Nachbesserungsplan für die vollständige Optionskarte](../../ROADMAP-PARITY-PHASE3-REPAIR-OPTIONS-PLAN.md)
- [Phase 3 – Nachbesserungsplan für die offenen Bild- und Pickerfälle](../../ROADMAP-PARITY-PHASE3-REPAIR-REMAINING-PLAN.md)
- [Phase 3 – Nachbesserungsplan für Gebäudeabnutzung und Building-Verhalten](../../ROADMAP-PARITY-PHASE3-WEAR-BEHAVIOR-PLAN.md)
- [Phase 4 – Umsetzungsplan für Objektbibliothek, Suche, Tags und Sets](../../ROADMAP-PARITY-PHASE4-PLAN.md)
- [Phase 4 – Nachbesserungsplan für den ersten Tagbrowser-Klick](../../ROADMAP-PARITY-PHASE4-REPAIR-COLD-START-PLAN.md)
- [Phase 4 – Nachbesserungsplan für Objektbibliothek und Tags](../../ROADMAP-PARITY-PHASE4-REPAIR-PLAN.md)
- [Phase 5 – Umsetzungsplan für Objektvorschau, Platzierung und Eigenschaften](../../ROADMAP-PARITY-PHASE5-PLAN.md)
- [Phase 5 – Nachbesserungsplan für Objektplatzierung und Farbe](../../ROADMAP-PARITY-PHASE5-REPAIR-PLAN.md)
- [Phase 5 – zweiter Nachbesserungsplan für Objektfarbe und Platzierung](../../ROADMAP-PARITY-PHASE5-REPAIR2-PLAN.md)
- [Phase 5 – dritter Nachbesserungsplan: Palettenrückkehr auf Karte A](../../ROADMAP-PARITY-PHASE5-REPAIR3-PLAN.md)
- [Phase 6: Objektgesten und nötige Auswahl](../../ROADMAP-PARITY-PHASE6-PLAN.md)
- [Phase 6: Nachbesserungsplan für Objektgesten und Auswahl](../../ROADMAP-PARITY-PHASE6-REPAIR-PLAN.md)
- [Phase 6: zweiter Nachbesserungsplan für sechs Eingabepaare](../../ROADMAP-PARITY-PHASE6-REPAIR2-PLAN.md)
- [Phase 6: dritter Nachbesserungsplan für A bei externem Fokuswechsel](../../ROADMAP-PARITY-PHASE6-REPAIR3-PLAN.md)
- [Phase 7: gemeinsamer Ablauf, physische Eingabe und große Karte](../../ROADMAP-PARITY-PHASE7-PLAN.md)
- [Phase 7: begrenzte Diagnose des Inhalte-Dialogs](../../ROADMAP-PARITY-PHASE7-REPAIR-PLAN.md)
- [Umsetzungsplan zur Roadmap für Building und Object Tool](../../ROADMAP-PARITY-PLAN.md)
- [Phase 1, DD-001/002: Kartenstart und Größenvorlagen](../../ROADMAP-PARITY-TOOLS-PHASE1-DD001002-PLAN.md)
- [Phase 1, DD-006.03/.04: Schattenwirkung im Dungeonbereich](../../ROADMAP-PARITY-TOOLS-PHASE1-DD006-SHADOW-PLAN.md)
- [Phase 1, DD-008: Gebäudeabnutzung abschließen](../../ROADMAP-PARITY-TOOLS-PHASE1-DD008-PLAN.md)
- [Phase 1, DD-036: Dateifluss für die einzige Atlaskarte](../../ROADMAP-PARITY-TOOLS-PHASE1-DD036-ATLAS-PLAN.md)
- [Phase 1, DD-041.02/.03: temporäres Pan erneut prüfen](../../ROADMAP-PARITY-TOOLS-PHASE1-DD041-PAN-PLAN.md)
- [Folge-Roadmap, Phase 1: Karte, Datei und Ansicht](../../ROADMAP-PARITY-TOOLS-PHASE1-PLAN.md)
- [Folge-Roadmap Phase 1: DD-038 Randbeschnitt nachbessern](../../ROADMAP-PARITY-TOOLS-PHASE1-RESIZE-REPAIR-PLAN.md)
- [Folge-Roadmap: übrige Dungeondraft-Abläufe angleichen](../../ROADMAP-PARITY-TOOLS.md)
- [Roadmap: Dungeondraft-Verhalten für Grundrisse und Objekte angleichen](../../ROADMAP-PARITY.md)

### GM-Bedienung und Produkttest

- [Produkttests aus GM-Sicht](../../ROADMAP-GM-PRODUCT-TESTING-PLAN.md)
- [GM-UX-N-001: Räume mit einem Rechteckzug anlegen](../../ROADMAP-GM-UX-N-001-PLAN.md)
- [GM-UX-N-002: Objekte beim Tippen finden und Suche leeren](../../ROADMAP-GM-UX-N-002-PLAN.md)
- [GM-UX-N-003: Raum-Key ohne doppelte Editoransicht öffnen](../../ROADMAP-GM-UX-N-003-PLAN.md)
- [GM-UX-N-005: Raum-Keys während der Spielsitzung finden](../../ROADMAP-GM-UX-N-005-PLAN.md)
- [GM-UX-N-006: aktives Geschoss beim Wiederöffnen fortsetzen](../../ROADMAP-GM-UX-N-006-PLAN.md)
- [GM-UX-N-004: Atlasfläche im verfügbaren Pane halten](../../ROADMAP-GM-UX-N004-PLAN.md)

### SaltMarcher-Fachverträge und Plattform

- [ADR-P01-H02 – Echte Desktop-Prozess- und Linux-Durability-Hypothese](../../ROADMAP-SALTMARCHER-ADR-P01-H02-PLAN.md)
- [ADR-P01-H03-I02 – Native Child-State-Machines und Faultmatrix](../../ROADMAP-SALTMARCHER-ADR-P01-H03-I02-PLAN.md)
- [ADR-P01-H03 – Durable Capture/Publish- und Recovery-Hypothese](../../ROADMAP-SALTMARCHER-ADR-P01-H03-PLAN.md)
- [SMR-00-P01 – Ausführbare Beweise für den Plattformentscheid](../../ROADMAP-SALTMARCHER-ADR-PROTOTYPES.md)
- [SaltMarcher-Katalog- und Encounter-Migration](../../ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md)
- [CE-01-C01 – begrenztes Katalog-Aufräumen](../../ROADMAP-SALTMARCHER-CE01-C01-PLAN.md)
- [CE-01-C01-N01 – Nachbesserung der Draft-Zuordnung](../../ROADMAP-SALTMARCHER-CE01-C01-REPAIR-PLAN.md)
- [CE-01-H01 – Echte Obsidian-Abnahme des Monsterkatalogs](../../ROADMAP-SALTMARCHER-CE01-H01-PLAN.md)
- [CE-01 – Read-only Monsterkatalog](../../ROADMAP-SALTMARCHER-CE01-PLAN.md)
- [CE-02-I02-P01 – Itemkatalog: Provenienz, Datenvertrag und Umsetzung](../../ROADMAP-SALTMARCHER-CE02-I02-PLAN.md)
- [CE-02-P01 – Technischer Plan für den vollständigen SaltMarcher-Katalog](../../ROADMAP-SALTMARCHER-CE02-PLAN.md)
- [ADR-P01: Browsergrenze der Objekttexturen reparieren](../../ROADMAP-SALTMARCHER-P01-RENDERER-REPAIR-PLAN.md)
- [SMR-00-ADR-01 – Zielplattform und Migrationspfad](../../ROADMAP-SALTMARCHER-PLATFORM-ADR.md)

## Bereits vorhandene Pläne im Integrationskandidaten

<details>
<summary>Kompatibilitätsbestand aus PR #13; kein zusätzlicher Auftrag</summary>

Diese Pfade waren vor Einführung der Strukturprüfung bereits im Kandidaten vorhanden. Die Links pinnen dessen Dokumentstand; sie behaupten keine Integration oder Abnahme. Bei Übernahme auf Shared die Verweise durch lokale Links ersetzen und fachlich einordnen. Die Ausnahme erlaubt keine weiteren neuen Root-Pläne.

- [ROADMAP-CITIES-ATLAS-DETAIL-ENTRY-CLEANUP-PLAN.md](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/892e20d737c9e4868aa44b615f8da0f97d98fb39/ROADMAP-CITIES-ATLAS-DETAIL-ENTRY-CLEANUP-PLAN.md)
- [ROADMAP-CITIES-ATLAS-DETAIL-ENTRY-PLAN.md](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/892e20d737c9e4868aa44b615f8da0f97d98fb39/ROADMAP-CITIES-ATLAS-DETAIL-ENTRY-PLAN.md)
- [ROADMAP-CITIES-E2E-INTEGRATION-PLAN.md](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/892e20d737c9e4868aa44b615f8da0f97d98fb39/ROADMAP-CITIES-E2E-INTEGRATION-PLAN.md)
- [ROADMAP-E2E01-ATLAS-CAPTURE-CLEANUP-PLAN.md](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/892e20d737c9e4868aa44b615f8da0f97d98fb39/ROADMAP-E2E01-ATLAS-CAPTURE-CLEANUP-PLAN.md)
- [ROADMAP-E2E01-ATLAS-HOST-CLEANUP-PLAN.md](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/892e20d737c9e4868aa44b615f8da0f97d98fb39/ROADMAP-E2E01-ATLAS-HOST-CLEANUP-PLAN.md)
- [ROADMAP-E2E01-ATLAS-NAVIGATION-CLEANUP-PLAN.md](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/892e20d737c9e4868aa44b615f8da0f97d98fb39/ROADMAP-E2E01-ATLAS-NAVIGATION-CLEANUP-PLAN.md)
- [ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/892e20d737c9e4868aa44b615f8da0f97d98fb39/ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md)
- [ROADMAP-E2E01-CAMPAIGN-CONTEXT-PLAN.md](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/892e20d737c9e4868aa44b615f8da0f97d98fb39/ROADMAP-E2E01-CAMPAIGN-CONTEXT-PLAN.md)
- [ROADMAP-E2E01-CAMPAIGN-OWNERSHIP-PLAN.md](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/892e20d737c9e4868aa44b615f8da0f97d98fb39/ROADMAP-E2E01-CAMPAIGN-OWNERSHIP-PLAN.md)
- [ROADMAP-E2E01-CAMPAIGN-RUNTIME-SOURCE-PLAN.md](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/892e20d737c9e4868aa44b615f8da0f97d98fb39/ROADMAP-E2E01-CAMPAIGN-RUNTIME-SOURCE-PLAN.md)
- [ROADMAP-E2E01-DUNGEON-GEOMETRY-CLEANUP-PLAN.md](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/892e20d737c9e4868aa44b615f8da0f97d98fb39/ROADMAP-E2E01-DUNGEON-GEOMETRY-CLEANUP-PLAN.md)
- [ROADMAP-E2E01-DUNGEON-GEOMETRY-PLAN.md](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/892e20d737c9e4868aa44b615f8da0f97d98fb39/ROADMAP-E2E01-DUNGEON-GEOMETRY-PLAN.md)
- [ROADMAP-E2E01-DUNGEON-GEOMETRY-PRODUCT-CLEANUP-PLAN.md](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/892e20d737c9e4868aa44b615f8da0f97d98fb39/ROADMAP-E2E01-DUNGEON-GEOMETRY-PRODUCT-CLEANUP-PLAN.md)
- [ROADMAP-E2E01-SPATIAL-INTEGRATION-PLAN.md](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/892e20d737c9e4868aa44b615f8da0f97d98fb39/ROADMAP-E2E01-SPATIAL-INTEGRATION-PLAN.md)
- [ROADMAP-HEX-ATLAS-E2E-PLAN.md](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/892e20d737c9e4868aa44b615f8da0f97d98fb39/ROADMAP-HEX-ATLAS-E2E-PLAN.md)
- [ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/892e20d737c9e4868aa44b615f8da0f97d98fb39/ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md)

</details>


## Frühere Koordinationshaupttexte

[Snapshot von #1, #12 und #38 vor der Einstiegskürzung am 10.10.2026](COORDINATION-SNAPSHOT-20261010.json). Enthält ursprüngliche Anforderungen und damalige Status-/Ratifikationsentwürfe mit Herkunft und Texthash; keine aktuellen Arbeitsaufträge. Kommentare und direkte Ownerbelege bleiben in GitHub erhalten.

Frühere Haupttexte der Bereichskoordination #6–#11: [Snapshot vom 10.10.2026](COORDINATION-AREAS-SNAPSHOT-20261010.json), nur für die historische Einordnung. Aktuelle Eingänge stehen im jeweiligen Issue.
