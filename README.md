# SaltMarcher

Status: Aktuell
Owner: SaltMarcher
Last Reviewed: 2026-10-16
Source of Truth: docs/PRODUCT.md, docs/SCOPE.md und ARCHITECTURE.md

Ein lokaler Arbeitsraum für Spielleitungen: Eine Kampagnenkarte und ihre Raum-Keys bearbeiten, Kampagnen vorbereiten und zusammenhängend live spielen. Das Produkt ist eine eigenständige Desktopanwendung mit Electron, TypeScript und SQLite. Obsidian wird nicht weitergeführt; sein Code und frühere Nachweise bleiben als historische Quellen im Repository.

**Entwicklungsstand:** Dungeon-, Atlas-, Stadt- und Kampagnenfunktionen sind in unterschiedlicher Tiefe umgesetzt. Der dokumentierte Gesamtumfang und die plattformübergreifende Produktabnahme sind noch offen.

SaltMarcher wird seit dem 16. Oktober 2026 auf Basis der bisherigen Kampagnenwerkstatt weiterentwickelt. Das frühere SaltMarcher ist im Archivzweig `archive/saltmarcher-before-workbench-20261016` und in der Git-Historie erhalten. [Übernahme, Daten und Arbeitsweise](docs/project/delivery/workbench-migration.md).

## Hier anfangen

- [Produktziele](docs/PRODUCT.md) und [Lieferfolge](docs/ROADMAP.md): vollständiger Funktionsumfang.
- [Atlas auf einen Blick](ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick): integrierter Atlasstand und offene Lücken.
- [Dokumentationsindex](docs/INDEX.md): Fachanforderungen und Nachweise.
- [Architektur](ARCHITECTURE.md): technische Zielstruktur und Grenzen.


## Lokal entwickeln

Node.js 22 und npm verwenden; diese Version entspricht der PR-CI.

```bash
git clone https://github.com/ThonkTank/Salt-Marcher.git
cd Salt-Marcher
npm ci
npm run check:repo
npm run check
npm run check:desktop
npm test
npm run build
npm run build:desktop
```

`npm run build` bleibt der historische Pluginbuild; `npm run build:desktop` erzeugt den Desktopbuild unter `.build/desktop`.
`npm test` nimmt alle lokalen `tests/*.test.mjs` automatisch auf und führt die Tests nacheinander aus. Native GUI-Prüfungen bleiben getrennte Aufrufe.
Die Tests in `tests/native-reference/` benötigen zusätzlich die ursprünglichen Dungeondraft-Dateien im Nachbarverzeichnis `../dungeon-auswertung/`; mit diesen Quellen separat ausführen: `node --test --test-concurrency=1 "tests/native-reference/*.test.mjs"`.

### Desktop-Testlauf

```bash
npm run start:desktop -- --data-dir /tmp/campaign-workbench-smoke
```

Die Desktopanwendung speichert ohne `--data-dir` im lokalen Appdatenordner `CampaignWorkbench`. Er verbindet Kampagnenverwaltung, Vorbereitung, Live-Spiel, Katalog, Gegenstände, einen gemeinsamen Atlas für Landschaft, Städte und Dungeonräume, Musik und eine getrennte Spieleranzeige. Die Desktopfunktion ist ein Entwicklungsstand; offene Produktlücken und Abnahmen stehen in den Fachplänen.

Ein lokales Linux-x64-Paket entsteht mit:

```bash
npm run package:desktop -- /tmp/saltmarcher-linux-x64
```

Die ursprünglichen Produktanforderungen bleiben erhalten. Für neue Kampagnen gilt das [gemeinsame Atlasmodell](docs/ATLAS.md); alte Testbestände ohne Atlaswurzel werden nicht als mehrere Karten migriert.

## Repositorykarte

- `src/`: Produktcode, historischer Obsidian-Anschluss und Desktopoberfläche unter `src/app/`.
- `desktop/`: privilegierter Desktopprozess und schmale Preload-Brücken.
- `tests/`: automatisierte Prüfungen und synthetische Fixtures.
- `tools/`: Build-, Paket-, Referenz-, Fixture- und Hostwerkzeuge.
- `docs/` und `ROADMAP-*.md`: Produktziele, Fachanforderungen und direkte Nachweise.
- `ARCHITECTURE.md`: Architekturentscheidungen; `acceptance.json`: Anforderungen und Abnahmen.

Historische Laufstände und Einzelpläne bleiben im Git-Verlauf zugänglich. Quellen- und Datenattribution: [NOTICE.md](NOTICE.md), [SRD 5.1](src/features/catalog/SRD-5.1-ATTRIBUTION.md) und [Itemquellen](src/features/catalog/SRD-5.1-ITEMS-ATTRIBUTION.md).

## Aktueller Funktionsstand

Die folgende Übersicht beschreibt vorhandene Anschlüsse, keine vollständige
Produktabnahme. Bedienung, Grenzen und nächste Schritte stehen in den verlinkten
[Fachplänen](docs/INDEX.md); Versionsverläufe gehören in den Git-Verlauf.

| Bereich | Vorhandene Nutzerabläufe |
| --- | --- |
| Kampagne | Lokale Kampagnen öffnen, sichern, kopieren und übertragen; Verweise und Medien erhalten. Unabhängige Kopien bekommen eigene lokale Identitäten. |
| Gemeinsamer Atlas | Genau eine Welt pro Kampagne. Landschaft, Städte, Häuser und Räume in derselben Fläche zeichnen, suchen und zoomen; gemeinsame Autorhistorie mit Undo/Redo, lokaler Gruppenweg und explizite Gebäudeeingänge. [Bedienung und Grenzen](docs/ATLAS.md). |
| Stadt | Straßen und Flächen planen, Gebäudebestand erzeugen und nachbearbeiten; vollständiger Umfang und Grenzen im [Stadtplan](ROADMAP-CITIES.md). |
| Dungeon zeichnen | Grundrisse, Räume, Objekte, Türen, Licht, Geschosse, Volumen und parametrische Passagen; bearbeitbarer Graph mit ausdrücklich bestätigter Rasterübersetzung. |
| Dungeon vorbereiten | Raum-Keys, Vorlesetext, vererbte und referenzierte Vorlagen, regionale Beschreibungen, Budgets, Encounter-, Loot- und Curiosity-Kontexte auf räumlichen Ankern. |
| Dungeon-Binder | Raum-Keys, Ausgänge und gebundene Inhalte durchsuchen; ausdrücklicher Wechsel zur Karte oder Bearbeitung. |
| Dungeon leiten | Gruppen- und NPC-Positionen, Tür-/Treppenwege, editierbares Tempo, abschnittsweise Bewegung und gemeinsame Szenenzeit. Geometrieänderungen, Fallen und Kontakte können zur GM-Klärung anhalten. |
| Wahrnehmung | Licht, Sichtweite, Dunkelsicht, aktives/passives Ergebnis, Bekanntheits-Overrides, Geräusche und Spuren mit Bewegungs-/Oberflächenprofilen. GM-Informationen bleiben in der GM-Oberfläche. |
| Autonomie | NPC-Bedürfnisse, Raum-/Ortsjobs, Patrouillen und Fallenreset; gespeicherte Wege, Reservierungen, Fortschritt und bestätigte Zeitfolgen. Pause/Deaktivieren erhält Fortschritt; ausdrücklicher Abbruch ist separat. |
| Weltwissen | NPCs, Fraktionen, Quests, Gerüchte und Regeln mit Beziehungen, Ort und getrennten GM-/Vorlesetexten. Zusammenhänge zeigt ihre Verbindungen einschließlich Kreaturen-, Gegenstands- und Vorlagenquellen als zoombare Karte; Quelle und Beziehungen werden im vorhandenen Editor bearbeitet. Spielabend-Übergaben lassen sich mit Vorlesetext und Ortsquellen als nächsten Besuch in einem gewählten oder neuen Plan vorbereiten. Ortsmappen bündeln geordnete Abschnitte und zugehöriges Spielmaterial einschließlich paginierter Gruppenbesetzung, Weltprofilen und Ortsbindung über den Gruppenbereich. Weltprofile, Gruppenübersicht und Ortsmappe öffnen die vorhandenen Wohnhäuser, Arbeitsgebäude und den aktuellen Dungeonraum eines NSCs direkt im Stadtinspektor oder Atlas. Textverweise mit eigenen Anzeigenamen und Suche nach verknüpften Begriffen. Gemeinsame Schnellsuche für Welt, Regeln, Kreaturen, Gegenstände und Begegnungen. Quest-/Gerüchtjournal mit Status und bestehenden Belohnungsabläufen. NSC-Dossiers am Spieltisch öffnen Profile, Beziehung und Verhalten; datierte Gesprächsentwürfe werden im bestehenden Profil gesichert. Live-Suche bevorzugt Verweise des aktuellen Besuchs; Vorlesetext wird in den GM-Entwurf übernommen. |
| Encounter | Katalog-, Orts-, Fraktions- und Tabellenfilter, endlicher Weltbestand, verbindliche/exkludierte NPCs und benannte Gegner. Vorbereitung, Vorschauübernahme und laufende Initiative bleiben getrennte Schritte. |
| Wiederaufnahme | Startbriefings je Gruppe mit Übergabe, Gruppenbereitschaft, laufende Szenen und unverteilte Beute gemeinsam ansehen; für eine gewählte Gruppe den nächsten Abend beginnen. |
| Spielabendplanung | Besuchsfolge manuell bearbeiten oder erzeugen; Vorschläge durchsuchen, bearbeiten, verwerfen und einzeln oder gemeinsam nach Vorschau übernehmen. Für den nächsten Abend Einstiegstext, nächste Besuche und offene Quests/Gerüchte anzeigen. Gruppen platzieren, vorhandene Figuren auswählen, Plan ersetzen oder wiederverwenden; akzeptierte Weltfiguren und offene Eingaben bleiben erhalten. |
| Spielabendmappe | Originalquellen öffnen, Begegnungen vorbereiten und besuchsbezogene Belohnungen im vorhandenen Ablauf verwalten. Besuchsfolge im Planner oder angedockt am Spieltisch mit Wortlaut, Orten, Weltverweisen, Statblocks, Belohnungen und den fünf neuesten Übernahmen durchsuchen und als Markdown ausgeben. Quellenänderungen verlangen Aktualisierung vor Export. |
| Besuchsergebnisse | Besuch für die Fokusgruppe über Vorschau übernehmen; Ergebnis als abgeschlossen, übersprungen oder wieder offen bestätigen. Chronik erhält frühere Ergebnisse. Erneute Übernahmen sind eigene Durchläufe. Offene Ergebnisfelder bleiben nur im aktuellen Prozess erhalten. |
| Party und Szenen | Roster, Teilnahme, Gruppenteilung, Fokuswechsel, freie Kampf-/Verfolgungsmasken und Archivierung. Wiederherstellen erhält die Figur und aktiviert sie nicht automatisch. |
| Fortschritt und Rast | Adventure-Day-Rechner, gemeinsame XP-/Belastungsabrechnung mit Vorschau und getrennten Empfängern; Rast, Szenenzeit und Erholung gemeinsam bestätigen. Manuelle XP-Korrekturen erhalten Rast-/Belastungsfakten, Abzug endet bei 0. |
| Beute und Gegenstände | Manuelle Quest-/Gerüchtebelohnungen, kumulierter Gold-/Magiebeuteausgleich, Katalogauswahl, Schätze vorbereiten/platzieren, unterbrochene Verteilung fortsetzen, Mengen teilen/zusammenführen und ausdrücklich weitergeben. |
| Agenda und Zeit | Bis zum Fantasiedatum oder Ereignis warten, Vorschau prüfen und Gruppenzeit ausdrücklich bestätigen. Fristen nach Fantasiedatum und Gruppenzeit suchen, planen und wiederholen; bestätigt keine neue Gruppenzeit. |
| Reise und Weltfolgen | Ziele und bis zu 20 Wegpunkte im Atlas oder auf der Reisekarte am Spieltisch wählen, Vorschau prüfen und Reise bestätigen. Abschnitte, Camp mit Warten/Rast, geprüfte Restreise, Fortsetzen und Abbruch verwenden dieselbe Gruppenzeit; Shops, Kalender und Wetter hängen daran. Offene Routeneingaben sind lokale Entwürfe. |
| Spieleranzeige | Getrenntes passives Fenster für ausdrücklich freigegebene Ortsbilder, NPC-Porträts, Handouts und gefilterte Dungeongeometrie; Blank jederzeit. Keine Übernahme privater Notizen, Kampf-/Verfolgungsdaten oder Vorlesetexte. |
| Musik und Extensions | Kontextbezogene lokale Medien und ein eng begrenzter Erweiterungsanschluss; vollständige Anforderungen, Rechte, Datenwege und offene Lieferungen im [Dokumentationsindex](docs/INDEX.md). |

## Noch zu prüfen und umzusetzen

Der Pflichtumfang steht in [SCOPE](docs/SCOPE.md), die Priorität in der
[Lieferfolge](docs/ROADMAP.md). Es gilt **Make it Work → Make it Efficient →
Make it Beautiful**, mit KISS und YAGNI. Neue Oberfläche oder grüne Tests
schließen fehlende Fachfunktionen nicht ab.

Native Speicherung nach einem neuen Prozessstart, Dateidialog-/Fehlerwege,
Spielerfenster auf externen Monitoren, vollständige Hex-/Stadt-/Dungeonparität,
große reale Pläne und durchgängige Vorbereitung/Spiel/Nachbereitung benötigen
jeweils ihren eigenen Nachweis. Lokale Store- und kontrollierte DOMtests belegen
nur die dort geprüften Abläufe. Verbindlich sind die betroffenen Einträge in
`acceptance.json` und die Fachpläne; Build, Push oder Paketierung sind keine
Produktabnahme.
