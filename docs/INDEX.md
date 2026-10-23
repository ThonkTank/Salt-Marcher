# Dokumentationsindex

Gesamtprodukt: [Produktziele](PRODUCT.md), [Umfang](SCOPE.md) und [Lieferfolge](ROADMAP.md). Technische Entscheidungen: [ARCHITECTURE](../ARCHITECTURE.md). Die Fachpläne ergänzen konkrete Abläufe und Datenregeln; aktueller Code ist Istbefund. Abnahmen und direkte Belege: `acceptance.json` und `docs/reference/`.

| Ich möchte … | Hier beginnen | Danach nur bei Bedarf |
| --- | --- | --- |
| den aktuellen Stand verstehen | [Produktstand](PRODUCT.md#gegenwärtiger-stand-und-offene-entscheidungen) und [Atlasübersicht](../ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick) | Datierte Fachbelege in `acceptance.json` |
| selbstständig am Atlas weiterarbeiten | [Beschlossener Atlasumbau und aktuelle Etappe](plans/maps/unified-spatial-atlas.md#aktueller-arbeitsstand) | M0–M8, metrische Kamera, stabile Weltkacheln, deck.gl/WASM und gemeinsame Abnahme; historische Fachbelege nur bei Bedarf |
| den nächsten Lieferabschluss umsetzen | [Gemeinsamer technischer Einstieg](ROADMAP.md#technischer-übergang) und [Fachabhängigkeiten](ROADMAP.md#fachliche-lieferabhängigkeiten) | [Atlaspakete](../ROADMAP-HEX-ATLAS.md#lieferpakete-und-codeanschlüsse), Fachquelle und passende Tests |
| die Oberfläche bauen | [Atlas-Besitzer und Prüfweg](../ARCHITECTURE.md#atlasoberfläche-ändern), [gemeinsame Darstellung und Suche](../ARCHITECTURE.md#darstellung-suche-und-spieleranzeige) und Fachplan des gewählten Ablaufs | [Atlasoberfläche](../ROADMAP-HEX-ATLAS.md#informationsarchitektur-der-oberfläche), [Bedienregeln](../ROADMAP-HEX-ATLAS.md#gemeinsame-bedienung), Werkzeugkatalog und Objektaktionen |
| Atlasdarstellung, Auswahl oder Bildausgabe ändern | [Codebesitzer und Schutzregeln](development/atlas-rendering.md#wo-ändern-und-prüfen) | [Prüfwege und offene Qualifikation](development/atlas-rendering.md#prüfwege-und-offene-qualifikation) |
| den Nutzerzweck oder die Priorität klären | [Produktziele](PRODUCT.md) und [fachliche Lieferfolge](ROADMAP.md) | [Atlasabläufe und Work → Efficient → Beautiful / KISS](../ROADMAP-HEX-ATLAS.md#wie-kommen-wir-zum-ziel), konkreter Fachplan |
| eine verlorene Buchungsantwort klären | [Bestätigungsbesitzer und modale Rückbindung](../ARCHITECTURE.md#buchungsantworten-klären) | Fachvertrag des betroffenen Writers |
| eine Lieferung prüfen | Betroffene Fachabnahme und [gemeinsame E2E-Kriterien](../ROADMAP-E2E-GATES-CANDIDATE.md) | [Atlas-Bedienproben](../ROADMAP-HEX-ATLAS.md#spätere-bedienabnahme), [GM-Aufgaben](../ROADMAP-GM-PRODUCT-TESTING-PLAN.md) und `acceptance.json` |
| Tests ausführen oder ihren Aufwand beurteilen | [Testvorbereitung, Laufzeiten und Bereinigung](development/testing.md) | Betroffene Fachabnahme und tatsächliche Testdateien im Capability-Katalog |

| Thema | Fachliche Quellen |
| --- | --- |
| Gesamtprodukt | [Produktziele](PRODUCT.md), [Lieferfolge](ROADMAP.md), [vollständiger Umfang](SCOPE.md), [Quellenregister](scope-sources.json) |
| Hex-Atlas und gemeinsame Karte | [Hex-Atlas](../ROADMAP-HEX-ATLAS.md), [Wonderdraft-Vergleich](../WONDERDRAFT-PARITY.md), [gemeinsamer Speicher-/Hostanschluss](../ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md) |
| Gemeinsamer räumlicher Atlas und semantischer Zoom | [Roadmap M0–M8: alle acht Ansätze](plans/maps/unified-spatial-atlas.md), [historische Ausgangsbasis und Werkzeugumfang](plans/maps/unified-atlas-baseline.md) |
| Regionen und Kartenbeschriftung | [Pinselablauf, Maßstab, Hierarchie und Nachweise](plans/maps/atlas-cartography.md) |
| Straßen, Flüsse und Landschaftspinsel | [Bedienung, Datenvertrag und offene Referenzabnahmen](plans/maps/landscape-tools.md), [geländegebundene Trassen, Flussbetten und Schutz](plans/maps/terrain-routes.md) |
| Höhenlandschaft und kippbarer Atlas | [Relief-Roadmap R0–R7](plans/maps/terrain-relief.md): gezeichnete Gebirge, gekoppelte Küsten, Höhenabfragen und räumliche Ansicht |
| Bewuchs und Felsen | [Landschaftsvorlagen, automatische Bestände und Einzelkorrekturen](plans/maps/vegetation.md) |
| Gemeinsame Gebäude und Dungeons | [Raumgruppen, Generierung und Speichergrenze](plans/maps/room-groups.md) |
| Stadt | [Stadtziele](../ROADMAP-CITIES.md), [technische Anforderungen](../ROADMAP-CITIES-IMPLEMENTATION-PLAN.md), [Referenzgalerie](../ROADMAP-CITIES.md#referenzgalerie) |
| Dungeon | [Grundrisse und Objekte](../ROADMAP-PARITY.md), [weitere Werkzeuge](../ROADMAP-PARITY-TOOLS.md), [3D/Rooms/Paths/Passages](plans/dungeon/smr04-spatial-coverage.md), [Geometrie und Vorschau](../ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md#dungeon-geometrie-und-vorschau) |
| Kampagnen und Planung | [Gesamtumfang](../ROADMAP-SALTMARCHER-REPLACEMENT.md), [Kopie, Import und Export](../ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md#copy-complete-import-remap-und-ownerlieferung), [manuelle Sessionplanung](plans/campaign/manual-session-planner.md) |
| NPC-Dossiers, Tagespläne und Autorenverweise | [Fachbesitzer und Gespräche](plans/campaign/npc-dossiers.md#aktueller-vertrag), [Tagespläne und Ortsbesuche](plans/campaign/npc-dossiers.md#tagespläne-und-geplante-ortsbesuche), [Textverweise und unabhängige Kopien](plans/campaign/authored-text-references.md) |
| Spielabendmappe und Markdownausgabe | [Quellenstand, Suche und nächste Abnahmen](plans/campaign/session-packet.md) |
| Party und LiveSession | [Fachvertrag und Kernumsetzung](plans/runtime/smr03-live-scene-contract.md), [Spielabendstart und Wiederaufnahme](plans/runtime/session-opening-and-resume.md) |
| Kampfentwürfe, Szenenauswahl und Nachbereitung | [Codeeinstiege, Datenregeln und offene Abnahmen](plans/runtime/combat-recovery.md), [spontane Katalogübernahme](plans/runtime/combat-recovery.md#spontane-katalogübernahme-ohne-teilkampf) |
| Quest-/Gerüchtabschluss und verlorene Antworten | [Narrative Entwürfe, Award und Recovery](plans/runtime/narrative-recovery.md) |
| Adventuring Day und XP-Vorschau | [Aktive Party, Rechengrenzen und nächste Abnahmen](plans/runtime/adventuring-day.md) |
| Passive Spielerprojektion | [Datenfreigabe, große Karten und nächste Schritte](plans/runtime/player-projection.md) |
| GM-Referenzsuche und Regeln | [Lesen, Übergabe und nächste Schritte](plans/runtime/rule-references.md), [Autorenverweise und Kopien](plans/campaign/authored-text-references.md) |
| Beuteoberflächen und Wertvergleich | [UI-Einstiege für Schatz und Charakterbeute](plans/runtime/treasure-distribution.md#codeeinstiege-der-beuteoberflächen), [gemeinsame Ledger-/Lootbilanz](plans/runtime/loot-balance.md) |
| Handel, Shopbesitzer und Restock | [Preisvorschlag, Buchung und Beleganzeige](plans/runtime/shops-and-restock.md#handel-ändern-und-prüfen), [Besitzer- und Zeitgrenzen](plans/runtime/shops-and-restock.md#vorhandener-ablauf-und-grenzen), [offene Lieferungen](plans/runtime/shops-and-restock.md#nächste-lieferungen) |
| Actor Autonomy und Jobintegrität | [Aktueller Anschluss und nächste Schritte](plans/runtime/actor-autonomy.md) |
| Katalogsuche, Filter und Inhaltswechsel | [Suchvertrag](plans/runtime/catalog-browsing.md#aktueller-suchvertrag), [SRD-Gegenstandsreferenz](plans/runtime/catalog-browsing.md#srd-gegenstandsreferenz), [Inhaltswechsel und Wiederaufnahme](plans/runtime/catalog-browsing.md#inhaltswechsel-und-wiederaufnahme) |
| Eigene Gegenstandsdefinitionen bearbeiten und speichern | [Definitionsentwürfe, Validierung und sichere Auswahl](plans/runtime/catalog-browsing.md#eigene-definitionsentwürfe-und-sichere-auswahl), [Codebesitzer und Prüfwege](plans/runtime/catalog-browsing.md#code-und-prüfwege) |
| Encounter-Vorlagen, Tabellen und Generierung | [Codeeinstiege, Save-/Recoverygrenzen und offene Lieferungen](plans/runtime/encounter-planning.md) |
| Katalog- und Encounteranforderungen | [Fachanforderungen](../ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md), [Item-Quellenkorpus](../ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md#itemquellen-und-provider) |
| Tutorials und Tastaturkontext | [Aktuelle Lektionen, Kontextschutz und nächste Abnahmen](plans/runtime/tutorial-and-shortcuts.md) |
| Erweiterungsinstallation und Wiederaufnahme | [Rechte, defekte Vermerke und nächste Unitlieferung](plans/extensions/installation-recovery.md) |
| Installation und In-App-Updates | [Linux-Pakete, signierte GitHub Releases und Wiederherstellung](project/delivery/github-updates.md) |
| Plattform und Architektur | [Plattform-ADR](../ROADMAP-SALTMARCHER-PLATFORM-ADR.md), [Prototypen](../ROADMAP-SALTMARCHER-ADR-PROTOTYPES.md), [Architektur](../ARCHITECTURE.md) |
| Reise und Gruppenzeit | [Laufzustand und Datenregeln](plans/maps/hex-travel.md#vorhandener-ablauf-und-datenregeln), [Checkpoint, Rücknahme und Restart](plans/maps/hex-travel.md#checkpoint-und-wiederaufnahme-auf-der-aktuellen-atlasfläche) |
| Agenda, Fantasy-Datum und Fristen | [Kalenderplanung und ausdrücklicher Zeitsprung](plans/runtime/campaign-agenda.md#ausführbarer-anschluss) |
| Scene-Wetter und GM-Override | [Datenvertrag, lokaler Nachweis und nächste Abnahmen](plans/runtime/weather.md) |
| Musik, Ambience und Audiofehler | [GM-Stopp](plans/runtime/music-recovery.md#gm-stopp-und-verspätete-antworten), [Schichtfreigabe und Fehlerklärung](plans/runtime/music-recovery.md#audio-schichten-und-fehlerklärung), [Nachweise und offene Prüfungen](plans/runtime/music-recovery.md#nachweise-und-nächste-arbeit) |
| Verknüpfte Raum- und GM-Notizen | [Direkter Vergleich mit Logseq: Notizen neben dem Raum-Key bearbeiten](reference/gm-ux-qa/key-note-context-20261015/README.md) |
| Notizorganisation und Raum-Key-Suche | [Direkter Vergleich mit TiddlyWiki: Vorlagen und NSC-Verweise wiederfinden](reference/gm-ux-qa/key-lookup-20261015/README.md) |
| Raum-Keys bis zum Folgeabend | [Tatsächlicher Obsidian-Vergleich: vorhandenen Plan öffnen und zum Raum zurückkehren](reference/gm-ux-qa/connected-room-prep-20261017/README.md) |
| Ausgangsnotiz nach Raum- und Planbearbeitung | [Native Nachprüfung und Obsidian-Zusammenführungsvergleich](reference/gm-ux-qa/note-room-plan-return-20261017/README.md) |
| Doppelte NSC-Notizen | [Originale redigieren und Raum-/Besuchsverweise gemeinsam umstellen](reference/gm-ux-qa/npc-note-merge-20261017/README.md) |
| Prüfung | [GM-Szenarien](../ROADMAP-GM-PRODUCT-TESTING-PLAN.md), [Campaign-B-Fixture](CONTRIBUTOR-FIXTURE-B.md), [Abnahmeregister](../acceptance.json), [portable Hostbelege](reference/) |

Attribution: [NOTICE](../NOTICE.md), [SRD](../src/features/catalog/SRD-5.1-ATTRIBUTION.md), [Items](../src/features/catalog/SRD-5.1-ITEMS-ATTRIBUTION.md).
