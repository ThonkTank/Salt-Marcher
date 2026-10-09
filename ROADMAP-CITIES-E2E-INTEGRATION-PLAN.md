# Stadtbeitrag zum gemeinsamen End-to-End-Fertigstellungsplan

CITY-E2E-P01, Start 2026-10-09T21:21:57Z; Basis 10436010dc180aa3577605ac4e50a99c43c5b843. Eigener Planungslauf für [Issue #12](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12), Fachkoordination [#7](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/7), Plattform [#11](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/11). Keine Implementierungs-, Host- oder Gesamtfreigabe.

## Eigene Entscheidungen und Besitz

Stadt stimmt einem einzigen Integrationsbranch `active/installed-phase1` zu: neue Arbeit auf Kandidatenbranches, Übernahme einer unabhängig geprüften Exact-SHA mit grünem zugehörigem Gate durch den vereinbarten Steward. Stadt stimmt einer Rotation je Gate ohne Fachweisungsbefugnis oder Selbstfreigabe zu; erster Steward und Gesamtplan sind noch gemeinsam zu bestimmen. Plan-/JSON-/Diffprüfung ist bei diesem Dokumentpaket ausreichend, aber kein unabhängiger Integrationsreview.

Stadt übernimmt die Implementierung der City-Fachmodelle, Edit-/Generations-/Rendereranteile, Cityadapter an die bestätigten Atlasverträge sowie eigene Fixtureanteile und City-E2E-/Original-/Bedienprüfungen. HEX-03–05, Platzierung, Kamera, Pointerrouter und gemeinsame Speicherautorität bleiben beim bestätigten Atlas-/Plattformbesitzer. Keine Übernahme der allgemeinen P02/P03/P04-Implementierung, der sicheren Spielerprojektion, LiveScene/Focus/SceneClock, Reise oder Dungeon-/Room-Key-Payloads. City liefert dort Validierung und eigene Daten-/Referenzorakel. Eigene Implementierung benötigt unabhängigen Review.

## Gelieferte und benötigte Grenzen

Vorbereitet sind CityDocument v1 mit stabilen Dokument-/Element-IDs und lokalen Metern, strikter Codec, genau eine CitySource in der gemeinsamen AtlasHistory, beginbasierter CityDraft/CityGesture mit Cancel ohne Write, lokale CityScene/Hit und CityRenderer ohne Kamera, Renderloop oder Persistenz. CityScene bezeichnet geometrische Darstellung, keine LiveScene.

Vor CITY-01 sind tatsächlich bestätigte HEX-04/05-Verträge nötig: relative präzise Welt-/Meterabbildung; Draw vor dem gemeinsamen Render; gemeinsamer Treffer-/Capture-/Cancel-/Quellenlebenszyklus; Fit über Terrain und geladene Detailinhalte; City- und Placementdateien in derselben Snapshot-/Draft-/Journal-/Recoverygrenze. Der inzwischen vorbereitete HEX-03-Repositoryanschluss ist keine native Citypersistenz. Der ältere [Anschlussvorschlag](ROADMAP-CITIES-ATLAS-INTEGRATION-PROPOSAL.md) beschreibt einen damaligen Quellenstand; dessen fehlende Placementunterstützung wird nicht als unverändert aktueller HEX-03-Befund ausgegeben.

## Versioniertes synthetisches Fixture: eigener verbindlicher Vorschlag

Fixtureversion `city-e2e-v1`; CampaignId aus Campaign/Data `00000000-0000-4000-8000-000000000001`. Reservierung zur gemeinsamen Bestätigung, keine bereits gespeicherte Kampagne:

| Citybesitz | Feste ID / Werte |
| --- | --- |
| CityDocument | `00000000-0000-4000-8000-000000000100`, Name `E2E-Stadt`, Version 1, Meter |
| Straßenknoten | `00000000-0000-4000-8000-000000000101` bei (-10,0), `00000000-0000-4000-8000-000000000102` bei (10,0) |
| Straße | `00000000-0000-4000-8000-000000000103`, die beiden Knoten, via [], Breite 4 m |
| Platz | `00000000-0000-4000-8000-000000000104`, Außenring (-4,-4),(4,-4),(4,4),(-4,4), keine Höfe |
| Haus A | `00000000-0000-4000-8000-000000000105`, Pose (-6,8), Drehung 0, Skalierung (1,1); Rechteck (0,0),(4,0),(4,6),(0,6) |
| Haus B | `00000000-0000-4000-8000-000000000106`, Pose (6,8), Drehung 0, Skalierung (1,1); Außenring (0,0),(8,0),(8,8),(0,8), Hof (2,2),(2,6),(6,6),(6,2) |

Districts/Plots zunächst leer. Welt-/Location-/Placement-IDs liefert Hex; Dungeon-/Room-/Key-IDs und Markdown liefert Dungeon. Haus A referenziert diese bestätigten Fremdkennungen später über den gemeinsam ratifizierten Bindungsvertrag; keine erfundene neue CityDocument-v1-Eigenschaft. Unbekannte/fehlende/stale Fremdreferenzen sind explizite Negativfälle. Erzeugte Fixturedateien samt kanonischen Bytes/Hashes werden erst im bestätigten gemeinsamen Fixtureschnitt implementiert und dann je Gate eingefroren, niemals zur Reparatur eines erwarteten Ergebnisses regeneriert.

## Gemeinsame Orakel und technische Umsetzung

| Gate | Stadtbeitrag und Pflichtorakel |
| --- | --- |
| E2E-01 Kampagne → Raum → Restart | Straße, Platz, Häuser im einen Atlas bearbeiten; Haus A → Dungeon/Raum-Key allein durch Zoom. Ein gemeinsames Terrain-/City-/Placementpaket, Undo/Redo, Save, neuer Prozess. Gleiche IDs, lokale Meterwerte, Referenzen und fremde Keytexte; keine zweite Kamera/History/Savequeue. Copy erhält Quelle und remappt kampagnenlokale Bindungen konsistent. |
| E2E-02 Spielabend | Derselbe Stadt-/Haus-/Raumbezug in immutable Location-/Sceneprojektionen; keine kopierten Party-/Encounterpayloads. City-Gesten Cancel/No-op/Stale schreiben nicht, erhalten Redo und fremde bestätigte Änderungen. Zeit-/Wetterwirkung nur aus bestätigten Consumerverträgen, kein Citytimer oder Clockbesitz. |
| E2E-03 Recovery / Portabilität | Gemeinsames Fixture injiziert Cancel vor Publish, Crash zwischen City-/Placementwrites, fremde Bytes, verweigerten Write, wenig Speicher und published-pending-finalize. Ursprüngliche CommandId/Receipt auflösen: gesamter bestätigter Vorher-/Nachherstand, keine Teilwirkung oder Doppelwirkung. Complete-/Salvage-/Quarantänestatus sichtbar; Citybytes, IDs und opaque Fremdrefs im unabhängigen Import prüfen. Allgemeine Durability-/Archivimplementierung bleibt P02/P04. |
| E2E-04 GM / Player / Accessibility | Im gewählten echten Host Straße/Haus/Key per Tastatur und bei 200 Prozent/kleinem Fenster bedienen, denselben Atlas durchzoomen. Sichere Playerprojektion allein vom P03-Owner: keine GM-Keys, none/stale/unavailable fail-closed. Citybelege bestätigen nur eigene Projektion/Bedienung. |

Zusätzliche feste Geometrieorakel: Weltanker/Kameramitte 1e16, .01 m/px, lokales Delta (.01,.01) ergibt (1,1) px und lokale Rückabbildung; negative Koordinaten, Rotation, Resize, Höfe, konstante Bildschirmgriffe und Straßenbreiten; gemeinsames Fit für city-only, entferntes Cityplacement und leere Szene. Diese Testfakten verlangen die bestätigte relative Transformkomposition, keine neue Kamera.

Host-/OS-Matrix je Gate: exakte Kandidaten-SHA, Host-/Buildversion, OS, installierter Artefakthash, frischer Prozess und Capability-/Fault-Ergebnis. Linux ist kein Windows-/macOS-Beweis; nicht ausgeführte Plattformen bleiben not-run. Modelltests sind keine native Durability, physische Eingabe oder Bedienparität.

## Reihenfolge und Wiederaufnahme

Gemeinsame Korrektur/Ownerannahme von #12 → unabhängiger Architektur-/Technikreview → Teamratifikation und Steward-/Fixturegate → HEX-03 → HEX-04 → HEX-05 → CITY-01–04 in Welle B/E2E-01 und E2E-02/04. City-Fixturematerialisierung erst als zugeordneter gemeinsamer Schnitt. Keine vorgezogene Citypersistenz. CITY-05–09 und alle 24 CTY-/65 CO-Abnahmen bleiben zusätzlich erforderlich; vier Spines verkleinern den Umfang nicht.

CITY-00-I48b bleibt ein eingeordneter Referenzbeitrag zu CITY-07/CO-COK-0004, keine Produktintegration. Wiederaufnahme erst nach gemeinsamem Plan-Gate und neuer konkreter GUI-Slotantwort; I48a/R47/P48 nicht wiederholen. Danach separate R48 und jeweils Aufräum-P/I/R. Falls Verträge fehlen, nur konkret verfügbare gemeinsame Plan-/Reviewarbeit, keine Leermeldungen oder konkurrierenden Slices.

Planergebnis: eigener Umfang, Fixturevorschlag und Orakel konkretisiert. Offene Punkte: gemeinsame ID-Reservierung/Foreignbindings, P02/P03/P04-Implementierungsowners, Steward, unabhängiger Review und Ratifikation. Keine fremde Ownerstimme.

## Getrennte Aufräumplanung

CITY-E2E-P01-CLEAN-P: Prüfen, dass nur dieser Plan und checkpoint.cityExecution geändert sind; keine acceptance-Freigabe, Fixturedatei, neue Speicher-/Kameraautorität oder Originalinstanz. Relative Planverweise auf Existenz und sieben City-ID-Reservierungen auf Kollision außerhalb dieses Vorschlags prüfen. Alte Anschlussbeschreibung als historischen Vorschlag kenntlich lassen. Wiederaufnahme im Heartbeat an #12-Gate statt bloß freie GUI binden. Umsetzung/Review folgen separat.

CITY-E2E-P01-CLEAN-I: Relative Planverweise vorhanden; sieben City-IDs ohne Treffer in sonstigen getrackten Dateien. Nur vorgeschlagene Reservierung, keine globale Vergabe. Historischen Quellenstand ausdrücklich abgegrenzt; Restart-/Foreignbinding-/OS-Gates erhalten. Keine entfernbare Produktsource oder Laufressource entstanden; deshalb kein Architekturumbau. Heartbeat wird auf gemeinsame Review-/Ratifikation vor I48b umgestellt.
