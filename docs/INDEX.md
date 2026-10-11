# Dokumentationsindex

Der Leseweg folgt der Aufgabe. Erst die passende Einstiegsstelle öffnen, danach nur die betroffenen Fachdetails; nicht sämtliche Roadmaps vor jedem Codeabschluss lesen.

| Ich möchte … | Hier beginnen | Danach nur bei Bedarf |
| --- | --- | --- |
| den aktuellen Stand verstehen | [Atlasübersicht](../ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick) | Datierte direkte Belege in `acceptance.json` |
| den nächsten Lieferabschluss umsetzen | [Umsetzungsplan und Codeanschlüsse](../ROADMAP-HEX-ATLAS.md#umsetzungsplan) | Fachquelle des gewählten Pakets, tatsächlicher Code und passende Tests |
| einen Implementierungs-Goal starten | [Goal-Prompt für die vollständige Atlasumsetzung](../ROADMAP-HEX-ATLAS.md#goal-prompt-für-die-vollständige-atlasumsetzung) | [AGENTS.md](../AGENTS.md), anschließend die im Prompt benannten Quellen |
| die Oberfläche bauen | [Informationsarchitektur](../ROADMAP-HEX-ATLAS.md#informationsarchitektur-der-oberfläche) und [Bedienregeln](../ROADMAP-HEX-ATLAS.md#gemeinsame-bedienung) | [Werkzeugkatalog](../ROADMAP-HEX-ATLAS.md#konkreter-werkzeugkatalog) und [Objektaktionen](../ROADMAP-HEX-ATLAS.md#aktionen-am-ausgewählten-objekt) |
| den Nutzerzweck oder die Priorität klären | [Konkrete Nutzerabläufe](../ROADMAP-HEX-ATLAS.md#konkrete-nutzerabläufe) und [Work → Efficient → Beautiful / KISS](../ROADMAP-HEX-ATLAS.md#wie-kommen-wir-zum-ziel) | [Vollständiger Umfang](SCOPE.md), [Gebäudeentscheidung](../ROADMAP-CITIES.md#gebäude-und-innenräume-als-ein-objekt) |
| eine Lieferung prüfen | [Atlas-Bedienproben](../ROADMAP-HEX-ATLAS.md#spätere-bedienabnahme) | [GM-Aufgaben](../ROADMAP-GM-PRODUCT-TESTING-PLAN.md), betroffene Fachabnahme und `acceptance.json` |

Die Zuständigkeit der Informationen bleibt eindeutig: Atlasplan für Nutzerabläufe, Oberfläche und Umsetzungspakete; Fachpläne für technische Verträge; `acceptance.json` für Anforderungen und Nachweise; [Produktroadmap](ROADMAP.md) für die Integration ins Gesamtprodukt. Links verbinden diese Ebenen, statt Inhalte oder Statuslisten zu kopieren.

| Thema | Fachliche Quellen |
| --- | --- |
| Gesamtprodukt | [Produktziele](PRODUCT.md), [Lieferfolge](ROADMAP.md), [vollständiger Umfang](SCOPE.md), [Quellenregister](scope-sources.json) |
| Hex-Atlas und gemeinsame Karte | [Hex-Atlas](../ROADMAP-HEX-ATLAS.md), [Wonderdraft-Vergleich](../WONDERDRAFT-PARITY.md), [gemeinsamer Speicher-/Hostanschluss](../ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md) |
| Stadt | [Stadtziele](../ROADMAP-CITIES.md), [technische Anforderungen](../ROADMAP-CITIES-IMPLEMENTATION-PLAN.md), [Referenzgalerie](../ROADMAP-CITIES-REFERENCE-GALLERY.md), [Referenzlücken](../ROADMAP-CITIES-REFERENCE-GAPS.md) |
| Dungeon | [Grundrisse und Objekte](../ROADMAP-PARITY.md), [weitere Werkzeuge](../ROADMAP-PARITY-TOOLS.md), [3D/Rooms/Paths/Passages](plans/dungeon/smr04-spatial-coverage.md), [Geometrieanschluss](../ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md#dungeon-geometrie-und-vorschau) |
| Campaign und Planung | [Gesamtumfang](../ROADMAP-SALTMARCHER-REPLACEMENT.md), [Campaign/Data](../ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md), [manuelle Sessionplanung](plans/campaign/manual-session-planner.md) |
| Party und LiveSession | [Fachvertrag und Kernumsetzung](plans/runtime/smr03-live-scene-contract.md) |
| Katalog und Encounter | [Fachanforderungen](../ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md), [Item-Quellenkorpus](../ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md#itemquellen-und-provider) |
| Plattform und Architektur | [Plattform-ADR](../ROADMAP-SALTMARCHER-PLATFORM-ADR.md), [Prototypen](../ROADMAP-SALTMARCHER-ADR-PROTOTYPES.md), [Architektur](../ARCHITECTURE.md) |
| Prüfung | [GM-Szenarien](../ROADMAP-GM-PRODUCT-TESTING-PLAN.md), [Campaign-B-Fixture](CONTRIBUTOR-FIXTURE-B.md), [Abnahmeregister](../acceptance.json), [portable Hostbelege](reference/) |

Datierte Belege im Abnahmeregister beschreiben ihren damaligen Prüfumfang. Historische Einzelpläne und Laufstände sind im [Git-Verlauf vor der Bereinigung](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/tree/6a90f3ee2f50f0be45f0e256784576f13722c319) zugänglich. Direkte Nachweise behalten ihren jeweiligen Commit, Build und Prüfumfang; ein alter Beleg ist kein aktueller Auftrag oder Gesamt-PASS.

Attribution: [NOTICE](../NOTICE.md), [SRD](../src/features/catalog/SRD-5.1-ATTRIBUTION.md), [Items](../src/features/catalog/SRD-5.1-ITEMS-ATTRIBUTION.md).
