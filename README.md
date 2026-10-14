# Dungeon-Editor und gemeinsame Kampagnenwerkstatt

Ein lokaler Arbeitsraum für Spielleitungen: Karten und Raum-Keys bearbeiten, Kampagnen vorbereiten und zusammenhängend live spielen. Das Repository enthält die bestehende Obsidian-Integration und einen eigenständigen Desktopkandidaten. Die technische Zielplattform ist Electron mit TypeScript und SQLite; der Übergang und die Produktabnahme sind noch offen.

**Entwicklungsstand:** Dungeon-, Atlas-, Stadt- und Kampagnenfunktionen sind in unterschiedlicher Tiefe umgesetzt. Der dokumentierte Gesamtumfang und die plattformübergreifende Produktabnahme sind noch offen.

## Hier anfangen

- [Produktziele](docs/PRODUCT.md) und [Lieferfolge](docs/ROADMAP.md): vollständiger Funktionsumfang.
- [Atlas auf einen Blick](ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick): integrierter Atlasstand und offene Lücken.
- [Dokumentationsindex](docs/INDEX.md): Fachanforderungen und Nachweise.
- [Architektur](ARCHITECTURE.md): technische Zielstruktur und Grenzen.


## Lokal entwickeln

Node.js 22 und npm verwenden; diese Version entspricht der PR-CI.

```bash
git clone https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1.git
cd Obsidian-Dungeon-Editor-Phase1
git switch active/installed-phase1
npm ci
npm run check:repo
npm run check
npm run check:desktop
npm test
npm run build
npm run build:desktop
```

`npm run build` erzeugt das Obsidian-Plugin in `main.js`; `npm run build:desktop` erzeugt den Desktopbuild unter `.build/desktop`.

### Obsidian-Testlauf

Nur einen separaten Testvault verwenden. `main.js`, `manifest.json` und `styles.css` nach `.obsidian/plugins/dungeon-editor/` kopieren, das Plugin aktivieren und in der Befehlspalette „Dungeon“ oder „Atlas“ öffnen. Obsidian Desktop benötigt mindestens Version 1.8.7 und WebGL. Build und Push installieren nichts in einem Vault.

### Desktop-Testlauf

```bash
npm run start:desktop -- --data-dir /tmp/campaign-workbench-smoke
```

Der Desktopkandidat speichert ohne `--data-dir` im lokalen Appdatenordner `CampaignWorkbench`. Er verbindet Kampagnenverwaltung, Vorbereitung, Live-Spiel, Katalog, Gegenstände, Welt/Atlas, Städte, Musik, Dungeonzeichnung und eine getrennte Spieleranzeige. Die Desktopfunktion ist ein Entwicklungsstand; offene Produktlücken und Abnahmen stehen in den Fachplänen.

Ein lokales Linux-x64-Paket entsteht mit:

```bash
npm run package:desktop -- /tmp/campaign-workbench-linux-x64
```

## Repositorykarte

- `src/`: gemeinsamer Produktcode, Obsidian-Anschluss und Desktopoberfläche unter `src/app/`.
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
| Gemeinsamer Atlas | Hexkarte, Ortsverweise, Stadt- und Dungeonanschlüsse; Kartenbearbeitung und Reiseauswahl sind getrennte Werkzeuge. Der [Atlasplan](ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick) benennt die Lücken. |
| Stadt | Straßen und Flächen planen, Gebäudebestand erzeugen und nachbearbeiten; vollständiger Umfang und Grenzen im [Stadtplan](ROADMAP-CITIES.md). |
| Dungeon zeichnen | Grundrisse, Räume, Objekte, Türen, Licht, Geschosse, Volumen und parametrische Passagen; bearbeitbarer Graph mit ausdrücklich bestätigter Rasterübersetzung. |
| Dungeon vorbereiten | Raum-Keys, Vorlesetext, vererbte und referenzierte Vorlagen, regionale Beschreibungen, Budgets, Encounter-, Loot- und Curiosity-Kontexte auf räumlichen Ankern. |
| Dungeon-Binder | Raum-Keys, Ausgänge und gebundene Inhalte durchsuchen; ausdrücklicher Wechsel zur Karte oder Bearbeitung. |
| Dungeon leiten | Gruppen- und NPC-Positionen, Tür-/Treppenwege, editierbares Tempo, abschnittsweise Bewegung und gemeinsame Szenenzeit. Geometrieänderungen, Fallen und Kontakte können zur GM-Klärung anhalten. |
| Wahrnehmung | Licht, Sichtweite, Dunkelsicht, aktives/passives Ergebnis, Bekanntheits-Overrides, Geräusche und Spuren mit Bewegungs-/Oberflächenprofilen. GM-Informationen bleiben in der GM-Oberfläche. |
| Autonomie | NPC-Bedürfnisse, Raum-/Ortsjobs, Patrouillen und Fallenreset; gespeicherte Wege, Reservierungen, Fortschritt und bestätigte Zeitfolgen. Pause/Deaktivieren erhält Fortschritt; ausdrücklicher Abbruch ist separat. |
| Weltwissen | NPCs, Fraktionen, Quests, Gerüchte und Regeln mit Beziehungen, Ort und getrennten GM-/Vorlesetexten. Gemeinsame Schnellsuche für Welt, Regeln, Kreaturen, Gegenstände und Begegnungen. Quest-/Gerüchtjournal mit Status und bestehenden Belohnungsabläufen. Live-Suche bevorzugt Verweise des aktuellen Besuchs; Vorlesetext wird in den GM-Entwurf übernommen. |
| Encounter | Katalog-, Orts-, Fraktions- und Tabellenfilter, endlicher Weltbestand, verbindliche/exkludierte NPCs und benannte Gegner. Vorbereitung, Vorschauübernahme und laufende Initiative bleiben getrennte Schritte. |
| Wiederaufnahme | Übergabe, Gruppen, laufende Szenen und unverteilte Beute gemeinsam ansehen; für eine gewählte Gruppe den nächsten Abend beginnen. |
| Spielabendplanung | Besuchsfolge manuell bearbeiten oder erzeugen; Vorschläge durchsuchen, bearbeiten, verwerfen und einzeln oder gemeinsam nach Vorschau übernehmen. Gruppen platzieren, vorhandene Figuren auswählen, Plan ersetzen oder wiederverwenden; akzeptierte Weltfiguren und offene Eingaben bleiben erhalten. |
| Spielabendmappe | Besuchsfolge im Planner oder angedockt am Spieltisch mit Wortlaut, Orten, Weltverweisen, Statblocks, Belohnungen und den fünf neuesten Übernahmen durchsuchen und als Markdown ausgeben. Quellenänderungen verlangen Aktualisierung vor Export. |
| Besuchsergebnisse | Besuch für die Fokusgruppe über Vorschau übernehmen; Ergebnis als abgeschlossen, übersprungen oder wieder offen bestätigen. Chronik erhält frühere Ergebnisse. Erneute Übernahmen sind eigene Durchläufe. Offene Ergebnisfelder bleiben nur im aktuellen Prozess erhalten. |
| Party und Szenen | Roster, Teilnahme, Gruppenteilung, Fokuswechsel, freie Kampf-/Verfolgungsmasken und Archivierung. Wiederherstellen erhält die Figur und aktiviert sie nicht automatisch. |
| Fortschritt und Rast | Adventure-Day-Rechner, gemeinsame XP-/Belastungsabrechnung mit Vorschau und getrennten Empfängern; Rast, Szenenzeit und Erholung gemeinsam bestätigen. Manuelle XP-Korrekturen erhalten Rast-/Belastungsfakten, Abzug endet bei 0. |
| Beute und Gegenstände | Manuelle Quest-/Gerüchtebelohnungen, kumulierter Gold-/Magiebeuteausgleich, Katalogauswahl, Schätze vorbereiten/platzieren, unterbrochene Verteilung fortsetzen, Mengen teilen/zusammenführen und ausdrücklich weitergeben. |
| Reise und Weltfolgen | Ziele und bis zu 20 Wegpunkte im Atlas oder auf der Reisekarte am Spieltisch wählen, Vorschau prüfen und Reise bestätigen. Abschnitte, Pause, Fortsetzen und Abbruch verwenden dieselbe Gruppenzeit; Shops, Kalender und Wetter hängen daran. Offene Routeneingaben sind lokale Entwürfe. |
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
