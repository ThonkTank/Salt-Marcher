# Dokumentationsindex

Status: Current; offene Ziele sind als solche beschrieben.
Owner: project
Last Reviewed: 2026-10-29 (getrennte Architektur- und Ausführungseinstiege; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Die aktuelle Anwendung ist Electron/TypeScript/SQLite unter `desktop/` und `src/app/`. `npm run build` und `npm run build:desktop` bauen denselben Desktop; der Obsidian-Adapter ist historische Referenz. Build und lokale Prüfvorbereitung stehen in der [Testanleitung](project/verification/testing.md), Codebesitzer in der [Architektur](project/architecture/overview.md#code-nach-zuständigkeit-finden).

Gesamtprodukt: [Produktziele](project/requirements/product.md), [Umfang](project/requirements/scope.md) und [Lieferfolge](project/delivery/roadmap.md). Technische Entscheidungen: [ARCHITECTURE](project/architecture/overview.md). Die Fachpläne ergänzen konkrete Abläufe und Datenregeln; aktueller Code ist Istbefund. Implementierte Fähigkeiten und Restlieferungen besitzt die Roadmap, automatisierte und native Belege die Prüfdokumentation; Zielgerätequalifikation und Ownerabnahme bleiben eigene Aussagen. Abnahmen und direkte Belege: `acceptance.json`; dort angegebene historische Belege bleiben unter ihren festen Git-Revisionen erreichbar.

| Ich möchte … | Hier beginnen | Danach nur bei Bedarf |
| --- | --- | --- |
| den aktuellen Stand verstehen | [Vorhandene Umsetzung und nächste Anschlüsse](project/delivery/roadmap.md#vorhandene-umsetzung-und-nächste-anschlüsse) und [Produktziele](project/requirements/product.md) | Datierte Fachbelege in `acceptance.json` |
| Terrain und Meer nutzbar machen | [Bestätigter Lieferfokus und Abnahmekriterien](atlas/requirements/terrain-relief.md#aktueller-lieferfokus-terrain-und-wasser) und [Fortsetzungseinstieg des bestätigten Auftrags](atlas/delivery/terrain-water-execution.md#fortsetzungseinstieg) | Aktueller Code und gezielte Nutzerabläufe; alte Teilprüfungen ersetzen keine Abnahme |
| Gelände ändern | [Gelände: Writer, Datenvertrag und Prüfweg](atlas/architecture/rendering.md#gelände-ändern) | [Aktuelle Bedienung](atlas/guide.md#gelände-formen-und-ansicht-kippen), [fachlicher Geländeumfang](atlas/contract/hex-editing.md) |
| Reise ändern | [Reise: Writer, Raster und Prüfweg](atlas/architecture/rendering.md#reise-ändern) | [Journey- und Zeitregeln](atlas/contract/hex-travel.md#vorhandener-ablauf-und-datenregeln), kausale Reisehistorie |
| Atlas-Speicherklärung ändern | [Queue, Receiptregeln und Prüfweg](atlas/architecture/rendering.md#speicherklärung-im-atlas) | [Sichtbarer Klärungsablauf](atlas/guide.md#speicherstand-klären-und-weiterarbeiten), [Speicherwerte und Belege](project/architecture/storage-ports.md) |
| selbstständig am Atlas weiterarbeiten | [Dauerhafte Atlasarchitektur](atlas/architecture/unified-spatial-atlas.md#dauerhafte-architekturgrenzen) und [Terrain-/Wasserauftrag mit nächstem Restpaket](atlas/delivery/terrain-water-execution.md#fortsetzungseinstieg) | [Codebesitzer und Prüfwege](atlas/architecture/rendering.md), Fachverträge und getrennte Abnahmen |
| den nächsten Lieferabschluss umsetzen | [Nächster gemeinsamer E2E-01-Abschluss](project/delivery/roadmap.md#kritischer-pfad-für-e2e-01) und [Fachabhängigkeiten](project/delivery/roadmap.md#fachliche-lieferabhängigkeiten) | [Atlaspakete](atlas/requirements/atlas.md#lieferpakete-und-codeanschlüsse), Fachquelle und passende Tests |
| die Oberfläche bauen | [Atlas-Besitzer und Prüfweg](project/architecture/overview-2.md#atlasoberfläche-ändern), [gemeinsame Darstellung und Suche](project/architecture/overview-2.md#darstellung-suche-und-spieleranzeige) und Fachplan des gewählten Ablaufs | [Atlasoberfläche](atlas/requirements/atlas.md#informationsarchitektur-der-oberfläche), [Bedienregeln](atlas/requirements/atlas-2.md#gemeinsame-bedienung), Werkzeugkatalog und Objektaktionen |
| Atlasdarstellung, Auswahl oder Bildausgabe ändern | [Codebesitzer und Schutzregeln](atlas/architecture/rendering.md#wo-ändern-und-prüfen) | [Prüfwege und offene Qualifikation](atlas/architecture/rendering.md#prüfwege-und-offene-qualifikation) |
| den Nutzerzweck oder die Priorität klären | [Produktziele](project/requirements/product.md) und [fachliche Lieferfolge](project/delivery/roadmap.md) | [Atlasabläufe und Work → Efficient → Beautiful / KISS](atlas/requirements/atlas.md#wie-kommen-wir-zum-ziel), konkreter Fachplan |
| Editoraktivierung, Entwurfssicherung oder Bereichswechsel ändern | [Gemeinsamer Editor-Lebenszyklus](project/architecture/editor-lifecycle.md) | Geordnete Grenzen, alte Antworten, Entwurf und fachliche Übernahme |
| Store-Aufträge oder Host-Lebenszyklus ändern | [Desktop-Fähigkeiten und IPC](project/architecture/desktop-host.md), [kanonischer Store im Node-Worker](project/architecture/canonical-store-worker.md) | [Typisierte Speicheranschlüsse und Belegverträge](project/architecture/storage-ports.md), [fachliche Speicherbesitzer](project/architecture/storage-ownership.md), Pending, Backup und tatsächliches Workerende |
| eine verlorene Buchungsantwort klären | [Bestätigungsbesitzer und modale Rückbindung](project/architecture/overview.md#buchungsantworten-klären) | Fachvertrag des betroffenen Writers |
| eine Lieferung prüfen | Betroffene Fachabnahme und [gemeinsame E2E-Kriterien](project/verification/end-to-end.md) | [Atlas-Bedienproben](atlas/requirements/atlas-2.md#spätere-bedienabnahme), [GM-Aufgaben](project/verification/gm-workflows.md) und `acceptance.json` |
| Datenfelder oder unabhängige Kampagnenkopien ändern | [Transferverträge bei den Fachmodellen](campaign/contract/transfer-ownership.md) | [Archivvertrag](campaign/contract/archive.md) und Fachtests |
| Modulgrenzen oder Architekturkennzahlen prüfen | [Benannte Zuständigkeiten und reproduzierbarer Graphbericht](project/architecture/test-boundaries.md#benannte-zuständigkeiten-und-zyklen) | `node tools/module-graph.mjs --report`; reine Strukturprüfung, keine Produktabnahme |
| Integration oder Release liefern | [Integrationspflichten](../AGENTS.md#delivery) und [Releasevertrag](project/delivery/github-updates.md#verbindlicher-release-rhythmus-für-agenten) | [Lokale Prüfung](project/verification/testing.md); Terrainpakete wenden diese Regeln im [Ausführungsauftrag](atlas/delivery/terrain-water-execution.md) an |
| Tests ausführen oder ihren Aufwand beurteilen | [Testvorbereitung, Laufzeiten und Bereinigung](project/verification/testing.md), [Fachanschlüsse und Modulgrenzen](project/architecture/test-boundaries.md) | Betroffene Fachabnahme und tatsächliche Testdateien im Capability-Katalog |

| Thema | Fachliche Quellen |
| --- | --- |
| Gesamtprodukt | [Produktziele](project/requirements/product.md), [Lieferfolge](project/delivery/roadmap.md), [vollständiger Umfang](project/requirements/scope.md), [Quellenregister](project/requirements/sources.json) |
| Räumlicher Atlas und gemeinsame Karte | [Atlas](atlas/requirements/atlas.md), [Wonderdraft-Vergleich](atlas/verification/reference-comparison.md), [gemeinsamer Speicher-/Hostanschluss](atlas/contract/spatial-runtime.md) |
| Gemeinsamer räumlicher Atlas und semantischer Zoom | [Atlasumstieg](atlas/architecture/unified-spatial-atlas.md), [historische Ausgangsbasis und Werkzeugumfang](atlas/architecture/unified-spatial-atlas.md#funktionsumfang) |
| Regionen und Kartenbeschriftung | [Pinselablauf, Maßstab, Hierarchie und Nachweise](atlas/contract/atlas-cartography.md) |
| Straßen, Flüsse und Landschaftspinsel | [Bedienung, Datenvertrag und offene Referenzabnahmen](atlas/contract/landscape-tools.md), [geländegebundene Trassen, Flussbetten und Schutz](atlas/contract/terrain-routes.md) |
| Höhenlandschaft und kippbarer Atlas | [Relief-Roadmap R0–R7](atlas/requirements/terrain-relief.md): gezeichnete Gebirge, gekoppelte Küsten, Höhenabfragen und räumliche Ansicht |
| Bewuchs und Felsen | [Landschaftsvorlagen, automatische Bestände und Einzelkorrekturen](atlas/requirements/vegetation.md) |
| Gemeinsame Gebäude und Dungeons | [Raumgruppen, Generierung und Speichergrenze](atlas/contract/room-groups.md) |
| Stadt | [Stadtziele](city/requirements/city.md), [technische Anforderungen](city/contract/city.md), [Referenzgalerie](city/requirements/city.md#referenzgalerie) |
| Dungeon | [Grundrisse und Objekte](dungeon/requirements/drawing.md), [weitere Werkzeuge](dungeon/requirements/tools.md), [3D/Rooms/Paths/Passages](dungeon/requirements/smr04-spatial-coverage.md), [Geometrie und Vorschau](atlas/contract/spatial-runtime.md#dungeon-geometrie-und-vorschau) |
| Kampagnen und Planung | [Gesamtumfang](project/requirements/product-scope.md), [Kopie, Import und Export](campaign/contract/archive.md#copy-complete-import-remap-und-ownerlieferung), [manuelle Sessionplanung](campaign/contract/manual-session-planner.md) |
| NPC-Dossiers, Tagespläne und Autorenverweise | [Fachbesitzer und Gespräche](campaign/contract/npc-dossiers.md#aktueller-vertrag), [Tagespläne und Ortsbesuche](campaign/contract/npc-dossiers.md#tagespläne-und-geplante-ortsbesuche), [Textverweise und unabhängige Kopien](campaign/contract/authored-text-references.md) |
| Spielabendmappe und Markdownausgabe | [Quellenstand, Suche und nächste Abnahmen](campaign/contract/session-packet.md) |
| Party und LiveSession | [Fachvertrag und Kernumsetzung](runtime/contract/smr03-live-scene-contract.md), [Spielabendstart und Wiederaufnahme](runtime/contract/session-opening-and-resume.md) |
| Kampfentwürfe, Szenenauswahl und Nachbereitung | [Codeeinstiege, Datenregeln und offene Abnahmen](runtime/contract/combat-recovery.md), [spontane Katalogübernahme](runtime/contract/combat-recovery.md#spontane-katalogübernahme-ohne-teilkampf) |
| Quest-/Gerüchtabschluss und verlorene Antworten | [Narrative Entwürfe, Award und Recovery](runtime/contract/narrative-recovery.md) |
| Adventuring Day und XP-Vorschau | [Aktive Party, Rechengrenzen und nächste Abnahmen](runtime/contract/adventuring-day.md) |
| Passive Spielerprojektion | [Datenfreigabe, große Karten und nächste Schritte](runtime/contract/player-projection.md) |
| GM-Referenzsuche und Regeln | [Lesen, Übergabe und nächste Schritte](runtime/contract/rule-references.md), [Autorenverweise und Kopien](campaign/contract/authored-text-references.md) |
| Beuteoberflächen und Wertvergleich | [UI-Einstiege für Schatz und Charakterbeute](runtime/contract/treasure-distribution.md#codeeinstiege-der-beuteoberflächen), [gemeinsame Ledger-/Lootbilanz](runtime/contract/loot-balance.md) |
| Handel, Shopbesitzer und Restock | [Preisvorschlag, Buchung und Beleganzeige](runtime/contract/shops-and-restock.md#handel-ändern-und-prüfen), [Besitzer- und Zeitgrenzen](runtime/contract/shops-and-restock.md#vorhandener-ablauf-und-grenzen), [offene Lieferungen](runtime/contract/shops-and-restock.md#nächste-lieferungen) |
| Actor Autonomy und Jobintegrität | [Aktueller Anschluss und nächste Schritte](runtime/contract/actor-autonomy.md) |
| Katalogsuche, Filter und Inhaltswechsel | [Suchvertrag](runtime/contract/catalog-browsing.md#aktueller-suchvertrag), [SRD-Gegenstandsreferenz](runtime/contract/catalog-browsing.md#srd-gegenstandsreferenz), [Inhaltswechsel und Wiederaufnahme](runtime/contract/catalog-browsing.md#inhaltswechsel-und-wiederaufnahme) |
| Eigene Gegenstandsdefinitionen bearbeiten und speichern | [Definitionsentwürfe, Validierung und sichere Auswahl](runtime/contract/catalog-browsing.md#eigene-definitionsentwürfe-und-sichere-auswahl), [Codebesitzer und Prüfwege](runtime/contract/catalog-browsing.md#code-und-prüfwege) |
| Encounter-Vorlagen, Tabellen und Generierung | [Codeeinstiege, Save-/Recoverygrenzen und offene Lieferungen](runtime/contract/encounter-planning.md) |
| Katalog- und Encounteranforderungen | [Fachanforderungen](catalog/requirements/catalog-encounters.md), [Item-Quellenkorpus](catalog/requirements/catalog-encounters-4.md#itemquellen-und-provider) |
| Tutorials und Tastaturkontext | [Aktuelle Lektionen, Kontextschutz und nächste Abnahmen](runtime/contract/tutorial-and-shortcuts.md) |
| Erweiterungsinstallation und Wiederaufnahme | [Rechte, defekte Vermerke und nächste Unitlieferung](extensions/contract/installation-recovery.md) |
| Installation und In-App-Updates | [Linux-Pakete, signierte GitHub Releases und Wiederherstellung](project/delivery/github-updates.md) |
| Plattform und Architektur | [Plattform-ADR](project/architecture/platform-decision.md), [Prototypen](project/verification/architecture-experiments.md), [Architektur](project/architecture/overview.md) |
| Reise und Gruppenzeit | [Laufzustand und Datenregeln](atlas/contract/hex-travel.md#vorhandener-ablauf-und-datenregeln), [Checkpoint, Rücknahme und Restart](atlas/contract/hex-travel-3.md#checkpoint-und-wiederaufnahme-auf-der-aktuellen-atlasfläche) |
| Agenda, Fantasy-Datum und Fristen | [Kalenderplanung und ausdrücklicher Zeitsprung](runtime/contract/campaign-agenda.md#ausführbarer-anschluss) |
| Scene-Wetter und GM-Override | [Datenvertrag, lokaler Nachweis und nächste Abnahmen](runtime/contract/weather.md) |
| Musik, Ambience und Audiofehler | [GM-Stopp](runtime/contract/music-recovery.md#gm-stopp-und-verspätete-antworten), [Schichtfreigabe und Fehlerklärung](runtime/contract/music-recovery.md#audio-schichten-und-fehlerklärung), [Nachweise und offene Prüfungen](runtime/contract/music-recovery.md#nachweise-und-nächste-arbeit) |
| Prüfung | [GM-Szenarien](project/verification/gm-workflows.md), [Campaign-B-Fixture](project/verification/fixture-b.md), [Abnahmeregister](../acceptance.json), [portable Hostbelege](https://github.com/ThonkTank/Salt-Marcher/blob/16eb0aa8807ac21704abfea5412ac3a22033a23a/docs/reference) |

Attribution: [NOTICE](../NOTICE.md), [SRD](../src/features/catalog/SRD-5.1-ATTRIBUTION.md), [Items](../src/features/catalog/SRD-5.1-ITEMS-ATTRIBUTION.md).
