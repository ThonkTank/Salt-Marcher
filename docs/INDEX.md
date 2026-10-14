# Dokumentationsindex

Gesamtprodukt: [Produktziele](PRODUCT.md), [Umfang](SCOPE.md) und [Lieferfolge](ROADMAP.md). Technische Entscheidungen: [ARCHITECTURE](../ARCHITECTURE.md). Die Fachpläne ergänzen konkrete Abläufe und Datenregeln; aktueller Code ist Istbefund. Abnahmen und direkte Belege: `acceptance.json` und `docs/reference/`.

| Ich möchte … | Hier beginnen | Danach nur bei Bedarf |
| --- | --- | --- |
| den aktuellen Stand verstehen | [Produktstand](PRODUCT.md#gegenwärtiger-stand-und-offene-entscheidungen) und [Atlasübersicht](../ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick) | Datierte Fachbelege in `acceptance.json` |
| den nächsten Lieferabschluss umsetzen | [Gemeinsamer technischer Einstieg](ROADMAP.md#technischer-übergang) und [Fachabhängigkeiten](ROADMAP.md#fachliche-lieferabhängigkeiten) | [Atlaspakete](../ROADMAP-HEX-ATLAS.md#lieferpakete-und-codeanschlüsse), Fachquelle und passende Tests |
| die Oberfläche bauen | [Gemeinsame Darstellung und Suche](../ARCHITECTURE.md#darstellung-suche-und-spieleranzeige) und Fachplan des gewählten Ablaufs | [Atlasoberfläche](../ROADMAP-HEX-ATLAS.md#informationsarchitektur-der-oberfläche), [Bedienregeln](../ROADMAP-HEX-ATLAS.md#gemeinsame-bedienung), Werkzeugkatalog und Objektaktionen |
| den Nutzerzweck oder die Priorität klären | [Produktziele](PRODUCT.md) und [fachliche Lieferfolge](ROADMAP.md) | [Atlasabläufe und Work → Efficient → Beautiful / KISS](../ROADMAP-HEX-ATLAS.md#wie-kommen-wir-zum-ziel), konkreter Fachplan |
| eine Lieferung prüfen | Betroffene Fachabnahme und [gemeinsame E2E-Kriterien](../ROADMAP-E2E-GATES-CANDIDATE.md) | [Atlas-Bedienproben](../ROADMAP-HEX-ATLAS.md#spätere-bedienabnahme), [GM-Aufgaben](../ROADMAP-GM-PRODUCT-TESTING-PLAN.md) und `acceptance.json` |

| Thema | Fachliche Quellen |
| --- | --- |
| Gesamtprodukt | [Produktziele](PRODUCT.md), [Lieferfolge](ROADMAP.md), [vollständiger Umfang](SCOPE.md), [Quellenregister](scope-sources.json) |
| Hex-Atlas und gemeinsame Karte | [Hex-Atlas](../ROADMAP-HEX-ATLAS.md), [Wonderdraft-Vergleich](../WONDERDRAFT-PARITY.md), [gemeinsamer Speicher-/Hostanschluss](../ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md) |
| Stadt | [Stadtziele](../ROADMAP-CITIES.md), [technische Anforderungen](../ROADMAP-CITIES-IMPLEMENTATION-PLAN.md), [Referenzgalerie](../ROADMAP-CITIES.md#referenzgalerie) |
| Dungeon | [Grundrisse und Objekte](../ROADMAP-PARITY.md), [weitere Werkzeuge](../ROADMAP-PARITY-TOOLS.md), [3D/Rooms/Paths/Passages](plans/dungeon/smr04-spatial-coverage.md), [Geometrie und Vorschau](../ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md#dungeon-geometrie-und-vorschau) |
| Campaign und Planung | [Gesamtumfang](../ROADMAP-SALTMARCHER-REPLACEMENT.md), [Campaign/Data](../ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md), [manuelle Sessionplanung](plans/campaign/manual-session-planner.md), [Szenenwiederverwendung](plans/campaign/session-reuse.md) |
| Spielabendmappe und Markdownausgabe | [Quellenstand, Suche und nächste Abnahmen](plans/campaign/session-packet.md) |
| Party und LiveSession | [Fachvertrag und Kernumsetzung](plans/runtime/smr03-live-scene-contract.md) |
| Adventuring Day und XP-Vorschau | [Aktive Party, Rechengrenzen und nächste Abnahmen](plans/runtime/adventuring-day.md) |
| Passive Spielerprojektion | [Datenfreigabe, große Karten und nächste Schritte](plans/runtime/player-projection.md) |
| Regelreferenzen an Scenes | [Aktueller Regelweg und nächste Schritte](plans/runtime/rule-references.md) |
| Beutewertung und Vergleich | [Gemeinsame Ledger-/Lootbilanz](plans/runtime/loot-balance.md) |
| Shopbesitzer, Wiederherstellung und Restock | [Aktueller Zeitweg und nächste vollständige Lieferungen](plans/runtime/shops-and-restock.md) |
| Actor Autonomy und Jobintegrität | [Aktueller Anschluss und nächste Schritte](plans/runtime/actor-autonomy.md) |
| Katalog und Encounter | [Fachanforderungen](../ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md), [Item-Quellenkorpus](../ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md#itemquellen-und-provider) |
| Tutorials und Tastaturkontext | [Aktuelle Lektionen, Kontextschutz und nächste Abnahmen](plans/runtime/tutorial-and-shortcuts.md) |
| Erweiterungsinstallation und Wiederaufnahme | [Rechte, defekte Vermerke und nächste Unitlieferung](plans/extensions/installation-recovery.md) |
| Plattform und Architektur | [Plattform-ADR](../ROADMAP-SALTMARCHER-PLATFORM-ADR.md), [Prototypen](../ROADMAP-SALTMARCHER-ADR-PROTOTYPES.md), [Architektur](../ARCHITECTURE.md) |
| Scene-Wetter und GM-Override | [Datenvertrag, lokaler Nachweis und nächste Abnahmen](plans/runtime/weather.md) |
| Musik und Ambience-Wiederaufnahme | [Fehlerfreigabe, GM-Vorrang und nächste Abnahmen](plans/runtime/music-recovery.md) |
| Prüfung | [GM-Szenarien](../ROADMAP-GM-PRODUCT-TESTING-PLAN.md), [Campaign-B-Fixture](CONTRIBUTOR-FIXTURE-B.md), [Abnahmeregister](../acceptance.json), [portable Hostbelege](reference/) |

Attribution: [NOTICE](../NOTICE.md), [SRD](../src/features/catalog/SRD-5.1-ATTRIBUTION.md), [Items](../src/features/catalog/SRD-5.1-ITEMS-ATTRIBUTION.md).
