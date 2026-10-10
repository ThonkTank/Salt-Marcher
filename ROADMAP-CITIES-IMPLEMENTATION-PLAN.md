# Stadt-Pfad: technischer Gesamtplan und CITY-00

## Auftrag und Planstand

Direkter Auftrag vom 09.10.2026: vollständige Funktionsgleichwertigkeit mit Canvas of Kings, Watabou Medieval Fantasy City Generator und Fantasy Town Generator, mit besserer Bedienung. Die ältere Beschränkung auf zwei Ergebnisvorbilder reicht dafür nicht aus. Originalgesten sind weiterhin keine Vorgabe. Alle bestehenden CTY-Kennungen und fremden Nachweise bleiben erhalten.

Planungslauf CITY-P01; Ausgangspunkt bca9fbc. Repository: active/installed-phase1. Eigene Arbeitskopie, gemeinsame Veröffentlichung ohne Force-Push. Der Hex-Kollege besitzt derzeit HEX-00 und seine GUI-Testinstanz; keine parallele native Testinstanz starten. CITY-01 beginnt nach der festen CITY-00-Ergebnisgalerie und dem geprüften HEX-05-Übergabevertrag. Direkte Detailwirkungen werden spätestens vor ihrem zugehörigen Fachpaket geprüft; vollständige Originalinventur und Parität bleiben Pflicht für CITY-09. Bis zur Atlasübergabe wird Referenzarbeit vorgezogen.

Der konkrete [CITY-01-Anschlussplan](ROADMAP-CITIES-CITY01-INTEGRATION-PLAN.md) ordnet die aktuellen Quellschnittstellen, fehlenden HEX-05-Verträge, Stadtmodule und vollständigen Abnahmesequenzen zu. Er wird nach der geprüften Atlasübergabe an den gelieferten APIs aktualisiert.

Vor der Atlasübergabe wird ausschließlich der unabhängige [Stadtmodell-/Codec-Anteil](ROADMAP-CITIES-CITY01-MODEL-PLAN.md) vorbereitet, mit bestätigter Modulgrenze des Hex-Besitzers. Gemeinsame Atlasintegration und Hostabnahme bleiben hinter HEX-05. I41-Skalierwirkung ist zurückgestellt und weiterhin offen.

## Iststand und offene technische Basis

Alle 24 CTY-Unterfälle sind offen. Das reine native Stadtmodell mit Codec ist vorbereitet; Atlasintegration, Generierung, Darstellung und Stadtbedienung fehlen. `src/model.ts` beschreibt Dungeon-Dokumente, `src/session.ts` hält deren Befehle und Historie; `src/persistence.ts` besitzt Compare-and-write, Entwurf und Journal, erlaubt aber neben der Karte nur Markdown. Diese Besitz-/Journalgrenze darf nicht ungeprüft für .city/.location/.overworld aufgeweitet werden. HEX-05 ist noch nicht abgenommen. Eine neue separate Stadtansicht wäre keine Erfüllung des gemeinsamen Editors.

## CITY-FTG-SCOPE-P01 — Lebensdaten in der bestehenden Lieferfolge

Planungsgrundlage: Shared `e157462ee1a4c2b82b0c927df664a8c06fc38cb1`, [Issue #44](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/44), direkter Drei-Produkte-Auftrag vom 09.10.2026 und vorhandenes `acceptance.json.cityPlans.functionalInventory`. Dieser Lauf plant ausschließlich die noch fehlende sichtbare Zuordnung in Roadmap und Scope. Die Inventareinträge enthalten historische Originalbeobachtungen mit jeweils offenen Lücken; sie sind kein aktueller vollständiger Originalvergleich.

### Offene Punkte und konkrete Umsetzung im nächsten Fachlauf

| Teilziel / vorhandene Quellkennung | Bestehendes Paket und Zielregel | Geplante Dokumentationsänderung und zukünftige Produktabnahme |
| --- | --- | --- |
| Bewohner: `CO-FTG-0014`, ergänzend Demografie `CO-FTG-0004` und Massenbearbeitung `CO-FTG-0017` | CITY-06; Bewohner, Haushalt, Beruf sowie Wohn-/Arbeitsgebäude mit stabilen Referenzen. Explizite Änderungen und geschützte Regeneration, keine Erzeugung beim Öffnen. | CITY-06 in `ROADMAP-CITIES.md` und eigene Zuordnungstabelle in `docs/SCOPE.md` erweitern. Später zwei Bewohner anlegen/ändern, Haushalt und Arbeitsort wechseln, mehrere Namen mit Vorschau ändern; Cancel schreibt nichts, Apply ist ein gemeinsamer Befehl. IDs, geschützte Texte und Bindungen nach Regeneration, Undo/Redo und frischem Prozess prüfen. |
| Beziehungen: `CO-FTG-0014`, Stammbaum `CO-FTG-0026` | CITY-06; Personenbindungen und navigierbarer Zusammenhang. Richtung, Beziehungstypen, reziproke Wirkung sowie Entfernen/Remap benötigen einen konkreten Fachvertrag; keine Typenliste aus Teilbeobachtung als vollständig ausgeben. | Beziehungen und Familienansicht ausdrücklich in CITY-06 nennen. Später Beziehung bearbeiten, von beiden Personen aus wiederfinden, Familienansicht navigieren und nach Neustart dieselben Kennungen prüfen; Änderung/Entfernung/Undo darf keine verwaisten Referenzen hinterlassen. |
| Fraktionen: `CO-FTG-0007`, ergänzend Regierung/Wachen `CO-FTG-0005` | CITY-06; editierbare Fraktionsdaten und Zugehörigkeiten mit stabilen Personen-/Ortsbezügen. Allgemeine autonome Fraktionssimulation ist eine getrennte SaltMarcher-Frage; sie darf FTG-Funktionsumfang nicht streichen. | CITY-06 um Fraktionen ergänzen; konkrete Originalwirkungen sind noch offen. Später zwei Fraktionen anlegen, Zugehörigkeit ändern und gezielt suchen; Regeneration, Undo/Redo, Restart und vollständige Import-Referenzclosure prüfen. Umfang der Fraktionsattribute erst anhand vollständiger Inventur festlegen. |
| Tagesabläufe: `CO-FTG-0018`, manueller Ruhetag `CO-FTG-0042` | CITY-07; Aufenthalts-/Aktivitätsanzeige aus stabilen Personen-, Wohn- und Arbeitsbezügen und gemeinsamer autoritativer Campaignzeit. Kein eigener Timer, keine zweite CitySceneClock. Kalender-/Overridepolitik und Zeitport bleiben mit Travel/Clock/Calendar-Owner in #10/#12 zu entscheiden. | CITY-07 und dessen Abnahme um Tagespläne ergänzen; die technische Tabellenzeile muss die gemeinsame Zeitquelle ausdrücklich nennen. Später Arbeits-/Ruhetag und manuellen Override bei gleicher Zeit sowie Tagesgrenze/großen Zeitsprung prüfen; Rücknahme und Restart rekonstruieren identische Aktivität, Retry erzeugt keine doppelte Zeitwirkung. Positive gemeinsame Zeitintegration gehört auch in E2E-03. |

Die jeweiligen exakten `sourceUrl`, beobachteten Zeiten, Originalbelege und `gap`-Felder bleiben im vorhandenen Inventar nachlesbar. Die Quellkennungen werden in der Scope-Tabelle ausdrücklich referenziert; keine kopierte zweite Inventarliste und keine Änderungen an bestehenden Acceptancezuständen. CITY-00 besitzt weiterhin die vollständige Drei-Produkte-Inventur. CITY-08 berücksichtigt Ausgabe dieser Lebensdaten anhand der offenen Exportinventur; CITY-09 verlangt vollständige Funktion und gepaarte Aufgaben zur besseren Bedienung. E2E-01 ist kein Ersatz für diese späteren Fachabnahmen.

### Dateien, Reihenfolge und Prüforakel

1. **I01:** Nur `ROADMAP-CITIES.md` (CITY-06/07/09 und Ergebnisabnahme), `docs/SCOPE.md` (Stadt-Lückenzeile plus präzise Zuordnung) und die CITY-07-Zeitquellenformulierung dieses Plans ändern. Bestehende Phasenfolge und fremde Trap-Zuordnung erhalten; weder Produktcode noch neue Clock-/Datenverträge ratifizieren.
2. **R01:** Diff gegen diese vier Teilziele und #44 prüfen: jede Kennung vorhanden, Quelle und offene Entscheidung sichtbar, bestehendes Paket und konkrete zukünftige Produktprobe zugeordnet. Keine Umdeutung von historischem Teilbeleg zu Implementierungs-, Host- oder Paritäts-PASS. Unabhängigen Dokumentationsreview auf exakter Kandidaten-SHA anfordern.
3. **N/R:** Nur tatsächliche Befunde beheben und erneut prüfen. Danach unabhängige Stewardübernahme; andere Punkte aus #44 bleiben offen.
4. **Aufräum-P/I/R je Fachlauf:** Redundante Inventarkopien, tote Verweise und neue Dauerstatusdateien vermeiden; nur eigene Checkpointfelder ändern. `npm run check:repo`, JSON-/ID-/Diffprüfung; Acceptancebytes und fremde Checkpointwurzeln unverändert. Keine GUI und keine Produktvollsuite für reine Textänderungen.

Planungsergebnis: die vier verlangten Themen besitzen konkrete bestehende Pakete, Dateien, offene Vertragsgrenzen und zukünftige Produktorakel. Die Roadmap-/Scope-Umsetzung und deren unabhängiger Review folgen getrennt; keine Produktfunktion wird hier freigegeben.

**Aufräum-P01 — Plan:** Die JSON-Serialisierung hat fremde kompakte Checkpointformatierung aufgeweitet, obwohl deren Werte unverändert blieben. Im getrennten Aufräum-I01 ausschließlich die originale Formatierung außerhalb `cityExecution.currentRun/nextRun` wiederherstellen. Danach Bytevergleich der übrigen Checkpointsegmente, offene Inventar-IDs und Repository-/Diffprüfung; keine neue Statusdatei.

**Aufräum-I01 — Ergebnis:** Fremde Checkpointformatierung aus der gepinnten Sharedbasis wiederhergestellt; ausschließlich die beiden eigenen Laufobjekte ersetzt. Plan und Inventarzuordnung unverändert, keine Testartefakte oder zusätzlichen Dateien erzeugt.

## Technische Arbeitspakete

| Phase | Umsetzung und Zuständigkeit | Nachweis vor Freigabe |
|---|---|---|
| CITY-00 | Drei Originalprodukte funktional inventarisieren; stabile CO-Kennungen pro Fähigkeit, Quellen/Version/Datum und direkte Ergebnisproben. Galerie: Dorf, ummauerte Stadt, Hafen und Detailfläche. FTG zusätzlich Bewohner-, Fraktions- und Zeitabläufe. Katalog und Roadmap auf den aktuellen Auftrag erweitern. | Jedes Inventarelement hat Quelle, eigene Zielaufgabe, technische Zuordnung und offenen/belegten Vergleich; direkte Proben getrennt von Dokumentation. |
| CITY-01 | `src/features/city/model.ts`: versionierte Metergeometrie, IDs, Straßenknoten/-kanten, Platzkonturen, Gebäude, Grundstücke und Districts. Parser validiert endliche Werte, eindeutige IDs und Referenzen. `city/commands.ts` nutzt den gemeinsamen Atlasbefehl aus HEX-05; keine zweite Undo-Historie. Renderer und Trefferprüfung verwenden denselben Transform. Native Registrierung .city im vorhandenen Host. | Straße/Platz/zwei Häuser im Atlas zeichnen, außerhalb belegter Ausdehnung wachsen, verschieben, Undo/Redo, Save, frischer Prozess. |
| CITY-02 | `city/generator.ts` als deterministischer Workerauftrag mit Seed, Version, Polygon und Vorgaben. Straßen zuerst, Blöcke/Grundstücke danach; Gebäude dürfen Straßen, Wasser und Grenzen nicht schneiden. Materialisierte Geometrie speichern. Abbrechbare Vorschau, ein atomarer Commit, niemals beim Laden generieren. | Dorf/Stadt reproduzierbar; unmittelbare Straßen-/Hausänderung; Abbruch ohne Dirty/History; ein Undo; Reload identisch. |
| CITY-03 | Stabile optionale Orts-/Dungeonbindungen pro Gebäude; HEX-05-Platzierungsgraph um Stadt→Gebäude→Dungeon ergänzen. Meter/Fünf-Fuß-Konversion und lokale Rotation komponieren. Bestehendes Key-Panel zeigt .location bzw. Raumkey. Multi-Dokument-Befehl samt Compare-and-write-Journal und Wiederherstellung. | Ausschließlich Zoom Region→Stadt→Haus→Raum; dieselbe Werkzeugwahl, Auswahl und Historie. Elternbewegung verändert keine lokalen Raumdaten. Fehler nach jedem Journalschritt und externe Konflikte prüfen. |
| CITY-04 | Herkunft/Schutz je Element; manuelle Änderung setzt Schutz. Orts-/Dungeonbindung schützt automatisch. Lokale Neugeneration nur in ausgewähltem Polygon; geschützte Konturen als Hindernisse, bestehende IDs unverändert. Änderungen in einem Atlasbefehl. | POI, manuelle Straße und Haus-Dungeon vor/nach byte-/wertgleich; Cancel, Undo, Save und Neustart. |
| CITY-05 | Straßen als topologischer Graph mit Klassen/Breite; Anschluss an regionale Wege. Flusskreuzungen als Brücken, Tore als Bindung von Straße und Mauer; Mauern/Türme als editierbare Pfadobjekte. Punktänderung aktualisiert betroffene Bindungen lokal. | Regionalweg→Tor→Platz ohne Lücke; Brücke passt; Torzug erhält Schutz und Bindungen. |
| CITY-06 | Viertelpolygone mit Nutzung/Dichte; Gebäudearten Markt/Hafen/Burg/Tempel/Garten. FTG-Lebensdaten: stabile Bewohner-, Haushalts-, Berufs- und Fraktionsreferenzen, Religion/Demografie und editierbare Notizen. `city/population.ts` generiert diese deterministisch nach dokumentierten Gebäudebedarfen. Keine Pflichtdatei je namenlosem Haus. | Hafen/ummauerte Stadt, POI-Suche, Ortskey, Haushalts-/Berufs-/Fraktionsänderung; Daten bleiben nach Regeneration und Neustart konsistent. |
| CITY-07 | Gemeinsame Assetbasis/Detaildarstellung: variierte Dächer, Pflanzen, Props, Farb-/Stilvorlagen, Pfad-/Flächenplatzierung und gruppierte Objekte. FTG-Zeit, Tagespläne, Tageslicht, Wetter/Jahreszeit: deterministische ableitbare Anzeige mit expliziter gespeicherter Uhrzeit, kein unbegrenzter Hintergrundtimer. `city/simulation.ts` leitet Aufenthaltsorte aus stabilen Personenbindungen ab. | Übersicht/Detail metrisch deckungsgleich, ausgewählte Geometrie sichtbar; Personen-, Wetter-/Zeitaufgaben gegen Original. |
| CITY-08 | Ausschnitt/Exportsettings unabhängig von Kamera; PNG/JPEG/SVG/JSON ausdrücklich, Raster und Vorlagen sowie zusätzliche FTG-Exportformate nach Inventar. Alle Formate verwenden denselben materialisierten Szenenstand; SVG Vektoren/Texte und JSON metrische Geometrie separat prüfen. Räumlicher Index, Viewport-Culling und Bedarfsladen; Workerabbruch, Dispose. | 5.000 Gebäude, mehrere Städte/Innenräume; p95 Navigation ≤33 ms, Vorschau ≤100 ms nach Laden; Save/Reload; Export entspricht demselben Dokumentstand. |
| CITY-09 | Vollständiges Inventar gegen denselben Endbuild prüfen; gemeinsame HEX-28-Abnahme. Isolierter Testvault, Sicherung vor Installation. | Alle Pflichtfähigkeiten, Konflikt/Undo/Neustart/Export, installierter Build, Ergebnisvergleich und physische Bedienung jeweils eigene Belege. |

Stadtmodell und Codec unter `src/features/city/` samt `newCityDocument`, `parseCityDocument` und `serializeCityDocument` sind vorbereitet und reviewt. Auch [CitySource und cityDocumentChange](ROADMAP-CITIES-CITY01-COMMANDS-PLAN.md) verwenden bereits die gelieferte gemeinsame AtlasHistory; echte Terrain-/Cityowner sind auf gemeinsame Befehle und Konfliktablehnung geprüft. Die [reinen Fachaktionen](ROADMAP-CITIES-CITY01-EDIT-PLAN.md) sind ebenfalls vorbereitet: editCity liefert einen vollständig geprüften Stadtstand für denselben Change. Auch [lokale Szene und Treffergeometrie](ROADMAP-CITIES-CITY01-SCENE-PLAN.md) sind vorbereitet; Hauspose und Streckenabstand werden gemeinsam mit Codec/Dungeonhelfern verwendet. Der [transiente CityDraft](ROADMAP-CITIES-CITY01-DRAFT-PLAN.md) ist implementiert und reviewt: vollständige Vorschau, clearPreview, Cancel ohne Restore, ein Apply; Szenenfehler und echte Stalekonflikte verlieren keine bisherigen Werte. Auch der [lokale Werkzeugadapter](ROADMAP-CITIES-CITY01-GESTURES-PLAN.md) ist nach gezielter Präzisionsnachbesserung reviewt: feste Zugadresse, Haus/Knoten/Via, pivotfeste Drehung/Achsgriffe, ein CityDraft. Der [CityRenderer](ROADMAP-CITIES-CITY01-RENDERER-PLAN.md) ist nach numerischer N08/R12-Nachbesserung lokal implementiert und reviewt: affine Meterstraßen, transparente Höfe, Auswahl/Griffe und eng begrenzte Renderressourcen. Sichtbare Werkzeuge und Hostanschlüsse bleiben geplant. Die konkreten HEX-05-Schnittstellen werden nach dessen Review übernommen; ein eigener Stadt-Atlas würde Architektur und Auftrag verletzen.

## Drei Referenzen und bisher zusätzlich fehlende Fähigkeiten

Stand 09.10.2026, offizielle Dokumentation gelesen, aktuelle Laufversionen noch nicht direkt beobachtet:

- Canvas of Kings: interaktive Pfade/Flächen/Räume, automatische Objektverteilung, Zufallsvarianten, zusammen bewegte Objektgruppen, Licht/Wetter, Exportausschnitt mit Quadrat-/Hexraster und gespeicherten Vorlagen. Quelle: https://store.steampowered.com/app/2498570/Canvas_of_Kings/ . Jede genannte Fähigkeit einzeln in CITY-00 direkt prüfen.
- Watabou: Layout, Viertel, Gassen, Dächer und Umgebung; aktuelle Laufoptionen und Exportformate vollständig direkt erfassen. Quelle: https://watabou.itch.io/medieval-fantasy-city-generator . Ein altes Quellarchiv zählt nicht als aktuelle Funktionsabnahme.
- Fantasy Town Generator: konfigurierbare Siedlung/Bevölkerung/Wasser/Viertel, Gebäudeabhängigkeiten, Bewohner/Fraktionen, editierbare Karte und Lebensdaten, lokale Neugeneration, Tagespläne/Zeit, Wetter/Jahreszeiten, Exporte und Vorlagen. Quellen: https://docs.fantasytowngenerator.com/category/create-settlements/ , https://docs.fantasytowngenerator.com/category/use-settlements/ , https://docs.fantasytowngenerator.com/category/edit-settlement/ , https://docs.fantasytowngenerator.com/category/premium-features/ . Details, Premiumfähigkeiten und Formatspezifika offen inventarisieren; keine stillschweigende Einschränkung auf Kartenbilder.

Die genannten zusätzlichen Fähigkeiten sind Planungsgegenstände, keine vollständige Originalinventur. Nicht direkt zugängliche Funktionen bleiben mit Zugangslücke offen; keinen Kauf oder fremden Login voraussetzen.

## Bedienabnahme

Identische Aufgaben in den drei Originalen und im eigenen Endbuild: Siedlung erzeugen, Straße umlegen, Tor/Brücke setzen, Viertel erneuern ohne POI-Verlust, Bewohner/Fraktion ändern, Tageszeit ändern, Hausraum und Key bearbeiten, Ausgabe erstellen. Pro Aufgabe Schritte, Zeit bis Ergebnis, Fehlversuche und benötigte Hilfe erfassen. Aufgaben, die ein Original nicht besitzt, als Projektmehrwert prüfen, nicht als vergleichbaren Geschwindigkeitsgewinn zählen. Bessere Bedienung erst aus gepaarten Aufgaben ableiten; synthetische Eingabe ersetzt keine physische Maus-/Touchpad-Abnahme.

## Getrennte Arbeitsläufe und Aufräumen

Jede Fachphase: P (offene Punkte/technischer Plan), I (Umsetzung), R (Review gegen CTY, CO-Inventar und Plan), N (Nachbesserung), R erneut bis keine Pflichtlücke. Danach CP (Aufräumplan), CI (Bereinigung), CR (Review); bei Befunden CN/CR wiederholen. Nach JEDEM Fachlauf zusätzlich seine konkrete Aufräumprüfung getrennt planen, umsetzen und reviewen, bevor der nächste Fachlauf startet. Jeder Lauf enthält Start, Fokus, Ergebnis und nächsten Schritt im aktuellen `checkpoint.cityExecution`; keine weitere fortlaufende Statusdatei. Laufbelege unter der bestehenden QA-Wurzel.

Aufräumprüfungen: keine parallele Zustands-/Undoquelle, keine Kopie gemeinsamer Geometrie/Transformlogik, saubere Modulgrenzen, Ressourcen-/Workerfreigabe, stabile IDs und Textschutz, keine Testartefakte im Nutzervault. Auch ein Lauf ohne notwendigen Codeumbau erhält ein begründetes Ergebnis. Basisprüfungen für Produktänderungen: npm run check, npm test, npm run build plus betroffene Regressionen. Planpakete: JSON, CTY-Verweise und Diff. Vor jedem Paket und Push fetch/integrate; nur eigenes Paket committen; exakten Remote-Commit prüfen.

## Bestehende Pflichtfälle: vollständiger offener Bestand

- **CTY-001.01 / CITY-01 — Stadt als native Atlasgeometrie**: Stadt, Straße und Gebäude bleiben editierbare Daten mit stabilen Kennungen und tatsächlichem Metermaßstab; sie erscheinen an der gespeicherten Atlasposition. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-001.02 / CITY-02 — Editierbare Generation**: Siedlungsfläche mit wenigen Vorgaben erzeugt Straßen, Platz und individuell editierbare Gebäude. Gespeicherte Geometrie, Seed und Generatorversion werden nach Neustart ohne erneute Generation erhalten. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-001.03 / CITY-02 — Einfügung in die Umgebung**: Lokale Küste, Fluss und regionale Straßen geben Referenzanker; Stadtplanung überschreibt Landschaft und bestehende Ortsinhalte nicht stillschweigend. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-002.01 / CITY-01 — Straße unmittelbar ändern**: Im bestehenden Atlas eine Straße zeichnen, ziehen, ergänzen und rücknehmen; verbundenes Netz und Gebäude bleiben konsistent. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-002.02 / CITY-01 — Haus unmittelbar ändern**: Gebäude direkt auswählen, verschieben, skalieren, drehen und entfernen; derselbe Editor, dieselbe Kamera und durchgehende Historie bleiben bestehen. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-002.03 / CITY-03 — Keine separaten Modi oder Editorkontexte**: Zoom verändert sichtbare Details, aber wechselt weder Werkzeugleiste, Werkzeug, Auswahl, Historie noch Kartenfenster. Aktionen richten sich nach Werkzeug und getroffener Geometrie; ein laufender Zug behält sein Ziel. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-003.01 / CITY-04 — Gezielt neu erzeugen**: Nur gewählten Bereich erneuern; manuell bearbeitete oder verlinkte Elemente bleiben samt Kennungen, Geometrie und Keys erhalten. Eine Aktion ist vollständig rücknehmbar. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-003.02 / CITY-04 — Varianten und Entwürfe erhalten**: Variantenvergleich und Abbruch verlieren keinen bisherigen Stand. Gespeicherte Entwürfe und zukünftige Generatorupdates verändern die materialisierte Stadt nicht beim Öffnen. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-004.01 / CITY-05 — Zusammenhängendes Straßen- und Wegenetz**: Hauptstraße und Gassen sind verbunden; eine Straße schneidet geschützte Gebäude nicht unbemerkt. Kreuzungen, Sackgassen und Platzanschlüsse bleiben nachvollziehbar. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-004.02 / CITY-05 — Fluss, Brücken und Befestigung**: Straßenqueren über Brücken, Mauern mit begehbaren Toren und Türmen; Anschluss an Regionalstraße erhält räumliche Kontinuität nach Änderung und Neustart. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-004.03 / CITY-06 — Stadtformen und Viertel**: Dorf, ummauerte Stadt und Hafenstadt besitzen unterscheidbare Struktur; Viertel, Bebauungsdichte, Plätze und besondere Bauten lassen sich gezielt beeinflussen. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-005.01 / CITY-03 — Orts- und Gebäude-Keys**: Orts-Key bleibt .location; ein beschriebenes Gebäude oder Viertel erhält einen optionalen stabilen Ortsverweis. Umbenennen, Verschieben und lokale Neugeneration erhalten Abschnittslinks. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-005.02 / CITY-03 — Welt bis Haus-Dungeon nur zoomen**: Von oberster Hex-Stufe durch Stadt und Haus bis Raum ausschließlich zoomen; Innenräume erscheinen am tatsächlichen Gebäudeort. Keine Öffnen-/Betreten-/Modusaktion ist nötig. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-005.03 / CITY-03 — Direkte gemischte Bearbeitung und Undo**: In einer Sitzung Hex, Straße, Haus, Dungeonraum und Key ändern; ohne Karten-/Moduswechsel rücknehmen/wiederholen und mit wiederherstellbarem Journal speichern. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-005.04 / CITY-03 — Stadt und Gebäude gemeinsam verorten**: Stadt verschieben/drehen und ein verlinktes Gebäude verschieben; zugehörige Dungeonplatzierung folgt der Bindung. Raumgeometrie behält Maßstab, lokale Kennungen und Form. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-005.05 / CITY-08 — Zoom ohne räumliche Sprünge**: Kontrollpunkt bleibt beim Detailwechsel an derselben Weltposition und unter dem Zoomanker; Zoomgrenzen pendeln nicht, Dach-/Innenraumübergang verdeckt keine bearbeitbare Auswahl. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-006.01 / CITY-07 — Lesbare Stadtübersicht**: Straßenhierarchie, Viertel, Plätze, Wasser, Befestigung und POIs bilden eine klare Draufsicht nach dem gewählten Watabou-Ergebnisvorbild; Lage und Maßstab bleiben erhalten. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-006.02 / CITY-07 — Ausgearbeitete Stadtdetails**: Variierte Gebäude/Dächer, Mauern/Türme, Vegetation und Dekoration ergeben eine stimmige Draufsicht nach dem gewählten Canvas-of-Kings-Ergebnisvorbild; direkte Bearbeitung bleibt möglich. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-006.03 / CITY-08 — Gleicher Inhalt in Übersicht, Detail und Ausgabe**: Übersicht und Dekoration sind Darstellungen derselben editierbaren Daten. Stadtausschnitt zeigt dieselbe Geometrie und POIs unabhängig von Kamera; vollständige PNG/JPEG-Ausgabe wird mit HEX-27 geprüft. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-007.01 / CITY-08 — Große Stadt und Ressourcenfreigabe**: Auf dem vorhandenen Laptop eine Stadt mit 5.000 Gebäuden und mehreren Haus-Dungeons prüfen; Zielwerte der Atlasnavigation (p95 ≤33 ms/Bild, Vorschau ≤100 ms nach Laden) messen und ungenutzte Detailressourcen freigeben. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-007.02 / CITY-03 — Speichern, Konflikt und Wiederherstellung**: .overworld/.city/.location/.dungeon-Änderungen, externe Änderung und unterbrochenes Speichern prüfen. Konflikte bleiben sichtbar; Wiederherstellung erzeugt keine verwaisten Platzierungen oder verlorenen Texte. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-008.01 / CITY-02 — Einfacher Einstieg**: Mit wenigen sichtbaren Vorgaben und einer direkt aufgezogenen Siedlungsfläche entsteht ein nutzbarer Plan im selben Atlas; kein Wizard, Moduswechsel oder verstecktes Pflichtmenü. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-008.02 / CITY-08 — Bedienbarkeit durch tatsächliche Aufgaben**: Neue Stadt erzeugen, Straße umlenken, Gebäude/POI anlegen, in Hausgrundriss zoomen und Raum-Key bearbeiten mit Maus/Touchpad prüfen; Zeiten, nötige Aktionen und Fehlversuche getrennt erfassen. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.
- **CTY-009.01 / CITY-09 — Endstand mit allen Atlasgrößen**: Welt → Region → Stadt → Haus → Raum und zurück nur mit Zoom; direkte Bearbeitung, Datenhaltung, Verortung, Links, Ausgabe und installierter Endbuild belegt. Status: open; Umsetzung: not_started; Host: not_run; Bedienung: not_run; Review: not_run.

## Planungsergebnis und nächste Grenze

Alle bestehenden CTY-Pflichten sind zugeordnet; der neue Dreiprodukt-Funktionsauftrag ist zusätzlich explizit eingeplant. CITY-P01 schließt keine Produkt- oder Referenzabnahme. Nächster Lauf: getrennte Planbereinigung (CP/CI/CR), anschließend CITY-00-I01 Originalinventur und Katalogerweiterung. CITY-01 wartet auf die Referenzgalerie und HEX-05. Die Kollegenarbeit an HEX-00 bleibt unangetastet.

## Aufräumplan CITY-P01-CP

Start 09.10.2026 nach geprüftem Planungspush 37181e1. Fokus: Plan als ausführbare, widerspruchsfreie Grundlage.

1. CLP-01: Der CO-Inventarbegriff besitzt noch kein Schema. In CI feste Felder/Status und unveränderliche Kennungen definieren, damit dokumentierte Kandidaten niemals direkte Abnahmen vortäuschen.
2. CLP-02: Gemeinsame Abhängigkeiten sind genannt, aber der Übergabevertrag fehlt. In CI Kamera/Transform, stabile Dokumentkennungen, Befehls-/Journalgrenze und Zoom-Hit-Test-Vertrag als prüfbare HEX-05-Übergabe festlegen.
3. CLP-03: Vollständige Funktionsgleichwertigkeit benötigt eine Abschlussregel jenseits der 24 alten CTY-Fälle. In CI Vollständigkeits-/Abdeckungsreview des Dreiproduktinventars und messbare Bedienverbesserung definieren.

Ergebnis: drei konkrete Planungsschwächen; kein Produktcode betroffen. Nächster eigener Lauf CITY-P01-CI; danach CITY-P01-CR prüft jeden Punkt gegen den geänderten Plan.

## Bereinigte Verträge CITY-P01-CI

### CLP-01: Referenzinventar

`acceptance.json.cityPlans.functionalInventory` erhält pro Originalfähigkeit `id` (CO-COK-0001 / CO-WAT-0001 / CO-FTG-0001), `product`, `feature`, `sourceUrl`, `observedAt`, `observedVersion` (null bis direkt bekannt), `availability` (free/premium/local/unknown), `observationKind` (documentation/direct), `originalEvidence`, `task`, `phase`, `caseIds`, `technicalPlan`, `implementationEvidence`, `hostEvidence`, `comparisonEvidence`, `usabilityEvidence`, `review` und `status`. Dokumentationskandidaten bleiben `open`; direkte Originalprobe alleine erlaubt nur `original_observed`, niemals `accepted`. `accepted` setzt Host-/Funktionsvergleich und Review auf demselben benannten Build voraus. UI-/Gestenunterschiede sind erlaubt; verlorene Fähigkeiten nicht. IDs werden nie durch Neuordnung geändert. Neue Fähigkeiten erweitern den Bestand statt bestehende Kennungen umzudeuten.

### CLP-02: HEX-05-Übergabe

Vor CITY-01 gemeinsam mit dem Hex-Pfad prüfen: (a) ein kamerageführter grenzenloser Raum mit Metertransform und präziser Hin-/Rückabbildung, (b) stabile Dokument-/Platzierungskennungen mit Elternbindung und aufgelösten Datei-Konflikten, (c) ein gemeinsam rücknehmbarer Befehl für mehrere Dokumente und alle Journalfehlerstellen, (d) Trefferprüfung/Zeichenziel bleiben während Zoom-/Ladegrenzen stabil, (e) frische Öffnung reproduziert Raum und Keys. Fehlender Vertrag bleibt Voraussetzung; CITY-Code erzeugt dafür keine zweite Kamera, Sitzung oder Speichertransaktion. Übergabe mit konkreten API-/Testverweisen im aktuellen Checkpoint dokumentieren. Nur notwendige gemeinsame Änderungen mit dem zuständigen Kollegen abstimmen.

### CLP-03: Abschlussregel

CITY-00 hat zwei getrennte Tore: alle öffentlich dokumentierten Produktbereiche sind inventarisiert, und alle Pflichtbereiche besitzen direkte Originalproben einschließlich der Galerie. Premium-/Zugangslücken bleiben offen. Nach jeder direkten Probe weitere entdeckte Fähigkeiten nachtragen; vor CITY-09 aktuelle Referenzversionen erneut prüfen. Jede Fähigkeit wird genau einer Phase und mindestens einer eigenen Zielaufgabe zugeordnet; jedes CTY-Kriterium bleibt separat prüfbar. CITY-09 schließt erst, wenn Inventarvollständigkeitsreview und sämtliche Pflichtfähigkeiten auf dem Endbuild bestanden sind und HEX-28 den gemeinsamen Atlasweg bestätigt.

Bedienverbesserung: pro vergleichbarer Aufgabe mindestens drei gleich vorbereitete Versuche, gleiche Eingabegeräte und vergleichbare Kartengröße; Medianzeit, Aktionszahl und Fehler erfassen. Ziel: keine zusätzlichen notwendigen Modus-/Kartenwechsel, keine höhere Fehlerrate und geringere Medianzeit oder weniger notwendige Aktionen pro Kernaufgabe. Kein pauschaler Geschwindigkeitsanspruch aus Einzelversuchen. Noch fehlende physische Beobachtung bleibt offen. Produktumfang ohne direkten Originalzugang wird nicht als gleichwertig freigegeben.

CI-Ergebnis: CLP-01/02/03 konkretisiert; keine Produktfähigkeit implementiert oder abgenommen. Nächster eigener Lauf CR prüft Schema, Übergabe und Abschlussregel gegen Nutzerauftrag und Roadmap.

## Aufräumreview CITY-P01-CR

09.10.2026; eigener Reviewlauf nach CI-Commit 83693f3. CLP-01 bestanden: stabiles Dreiproduktschema trennt Dokumentation, Originalprobe und eigene Abnahme. CLP-02 bestanden: fünf überprüfbare Atlasübergaben; keine zweite Kamera/History. CLP-03 bestanden: vollständiges Inventar plus CTY- und Endbuildreview, messbare gepaarte Bedienaufgaben; Zugangslücken bleiben offen. Alle 24 bestehenden CTY-Fälle sind eindeutig zugeordnet. Checkpoint-Roots des Ausgangsstands sind semantisch unverändert. JSON-/Verweisprüfung und Diffcheck bestanden.

Keine weitere Pflichtlücke im Planaufbau gefunden. Dies beendet die Bereinigung des Planungspakets, nicht CITY-00 oder die Produktparität. CITY-00-I01 beginnt mit direkten Browserproben und Erweiterung des Katalogs auf drei Originalprodukte; native QA nur nach gemeinsamer Sperrprüfung. Der vollständige Originalumfang ist noch zu ermitteln.

## Referenzpaket-Aufräumplan CITY-00-I02-CP

R01: Pauschale Zuordnung aller CTY-Fälle einer Phase entfernen. In CI eine explizite semantische Tabelle je CO-Kennung verwenden. Zusätzliche Bewohner-/Simulations-/Exportfähigkeiten ohne entsprechendes CTY-Kriterium bleiben eigenständige Funktionsanforderungen (`caseIds: []`, `independentFunctionalRequirement: true`); sie werden dadurch nicht optional. Stabile CO-/CTY-Kennungen und vorhandene Belege erhalten.

R02: Für die JSON-Exportaktion `originalProbe.exportFileState: unverified_after_download_timeout` samt Beobachtung eintragen. Datei-/Formatinhalt erst nach realer Sicherung belegen. Menübeobachtung bleibt als Teilbeleg; keine Fähigkeiten oder Qualitätsanforderungen streichen.

CI führt ausschließlich diese beiden Katalogbereinigungen aus. CR prüft vollständige Kennungs-/Belegerhaltung, die explizite CTY-Zuordnung, fehlende Abschlussbehauptungen und JSON-/Diffgültigkeit. Danach eigener Fach-Nachreview N-R, bevor das nächste Originalpaket startet. Die vollständige CITY-00-Abnahme bleibt offen.

## CITY-00-I03-P: Watabou-Referenzpaket

Offen: direkte Stadtübersicht, aktuelle Version, Größen-/Layout-/Darstellungs-/Exportfähigkeiten. Originalseite ist nach automatischer Sicherheitsprüfung erreichbar; keine manuelle Sicherheitsumgehung.

Konkreter Lauf: den auf der offiziellen itch-Seite tatsächlich eingebetteten Generator öffnen; Start-URL samt Seed/Größe/Features sichern. Eine ummauerte Küsten-/Flussstadt in Übersicht und Detail erfassen; Kontextmenü und Versionsanzeige direkt lesen. Nur beobachtete Optionswege nutzen. Ergebnisbilder, Menü-AX und Manifest mit Dateihashes in der bestehenden city-plans-QA-Wurzel sichern. Weitere echte Wirkungs-/Speicherproben getrennt durchführen, statt Menüs zu vollständiger Funktionsabnahme umzudeuten.

Review: Referenzbilder lesbar und reproduzierbare Vorgaben bekannt; jede neu entdeckte Fähigkeit mit stabiler CO-WAT-Kennung, Zielaufgabe und Phase ergänzen; keine Referenztor-/Produktfreigabe aus diesem Teilpaket. Aufräumen danach getrennt planen, umsetzen und reviewen.

## CITY-00-I03-CP: Belegmetadaten bereinigen

R01: Genau vier Menübilder (Kontext, Features, Roads, Export) und zwei Ergebnisbilder benennen; das siebte Bild stammt aus dem separaten Reloadreview. Alle Dateien im Manifest mit Hashes aufnehmen, ohne frühere Prüfnachweise zu überschreiben.

R02: Aktivierte Citadel-/Temple-/Plaza-Vorgaben getrennt von tatsächlich visuell identifizierten Merkmalen notieren. Das Bild belegt Stadtumriss, Hausformen, Straßen, Mauer/Türme, Fluss/Küste und Hafenanlagen. Die Identität eines Tempels oder anderer besonderer Gebäude bleibt einer eigenen Wirkungsprobe vorbehalten.

CI aktualisiert Belegmanifest und Checkpoint; CR prüft alle sieben Bilder/Hashes, die unveränderten 44 CO-Anforderungen sowie die korrigierten Beleggrenzen. Die Originalgesamt-/Produkt-/Bedienabnahme bleibt offen.

## CITY-00-I04-P: Canvas of Kings und gemeinsame Abschlusskoordination

Lokaler Zugang ist geprüft: Steam-App 3122210 (`Canvas of Kings Demo`) ist unter dem vorhandenen Steam-Verzeichnis installiert. Die Vollversion wird daraus nicht abgeleitet. Offizielle Produktbeschreibung nennt Pfad-/Flächenplatzierung, Objektvariation und Gruppenbewegung, Licht/Wetter sowie Ausgabeausschnitt/Raster/Vorlagen. Direkte Demo-Wirkungsproben und Unterschiede zur Vollversion bleiben offen.

Technischer nächster Lauf: vorhandenen spezialisierten Original-QA-Zugang und gemeinsame native Sperre mit dem Hex-Kollegen klären; dessen bestätigtes Veröffentlichungsfenster erhalten. Keine parallele native Instanz starten. Native CUA ist in diesem Stadtlauf deaktiviert; das ist kein Nachweis fehlender Produktfunktionen. Öffentlich sichtbare originale Ergebnisbilder können für den Grafikvergleich gesichert werden, ersetzen aber keine eigenen Wirkungsproben der Demo. Originalzugang, Demo-/Vollversionsumfang, tatsächliche Bildausschnitte und Versionsstand im Katalog getrennt festhalten.

Gemeinsamer Produktabschluss: Hex-Kollege besitzt HEX-00 und HEX-01 bis HEX-05; Stadtlauf besitzt CITY-00 bis CITY-09. Dungeonarbeit wird im bestehenden GitHub-Thema 1 nach aktuellem Bearbeiter/Übergaben abgefragt. Jede Familie erhält ihre eigenen Checkpoint-/Abnahmewurzeln. Ein identischer Endbuild muss Dungeonpflichten, Hex-/Stadtablauf, Speicher-/Konflikt-/Undoverhalten, Ergebnis-/Bedienvergleiche, Ausgabe, Installation und physische Bedienung erfüllen. Noch nicht zugängliche Original- oder Hostabnahmen bleiben offen; weitere unmittelbar nutzbare Arbeit wird fortgesetzt.

## CITY-00-I04-I: FTG-Gebäudedaten

Der zugängliche Teil des geplanten Referenzlaufs bestätigt Umbenennen, Speichern und Wiederfinden nach Browser-Reload: The Radiant Flats heißt anschließend CITY00 Protected House; sieben Bewohner bleiben zugeordnet. Eigenständige Pflicht CO-FTG-0030 in CITY-06, ohne zusätzliche Pflichtdatei für ein namenloses Gebäude. Gebäudeinformationen gehören an stabile Gebäude-IDs; Umbenennen erzeugt einen gemeinsamen Atlasbefehl und erhält Personen-/Ortsbindungen. Sichtbare Unterbereich-Tabs sind nur Inventarhinweise, keine Wirkungsnachweise. Der zweite JSON-Downloadversuch schließt den Dialog, liefert jedoch keinen bestätigten Download; keine weiteren Wiederholungen derselben Hypothese. Belege: `/home/aaron/.cache/dungeon-native-qa/city-plans/city00-i04-20261009/manifest.json`. Canvas-of-Kings-Zugang bleibt offen.

## CITY-00-I04-CP: Belegzuordnung bereinigen

R01/R02 gezielt reparieren: Exportmenü und beide unbestätigten Dateiversuche ausschließlich CO-FTG-0020 zuordnen; die in temporärer Siedlung deaktivierten Integrationsschaltflächen CO-FTG-0021 zuordnen. CO-FTG-0019 erhält wieder den ehrlichen Dokumentationsstatus für Wetter/Jahreszeiten/Tag-Nacht ohne Exportbeleg und ohne Export-CTY-Verweis. Originalartefakte und IDs erhalten. Hashes, unabhängige Pflichtkennungen, sämtliche offenen CTY-Zustände und fremde JSON-Wurzeln prüfen. Anschließend eigener Umsetzungs- und Reviewlauf; keine Produktabnahme ableiten.

## CITY-00-I05-P: Familienstammbaum

Offen ist CO-FTG-0026: bislang nur die Schaltfläche, keine Graphwirkung. Im bestehenden CITY00 Hamlet QA Bewohner Thawn Cobblekind über CITY00 Protected House öffnen, Relations ansehen und Family tree aufrufen. Sichtbare Namen und Eltern-/Geschwisterkanten gegen die bestehenden Relations-Belege vergleichen. Graphnavigation nur soweit sichtbare Controls sie anbieten; keine verborgenen Anwendungsdaten lesen. Screenshots und AX unter city00-i05-20261009 sichern. Versionsstand bleibt unbekannt. Ergebnis beschreibt ausschließlich Originalwirkung, nicht eigene Abnahme. Technische Umsetzung in CITY-06: ein gemeinsamer Personen-/Beziehungsgraph mit stabilen Personen-IDs, abgeleitete Stammbaumdarstellung und direkte Auswahl; keine zweite Familienkopie. Review prüft Kantenrichtung, Belegumfang und verbleibende Lücken; anschließend getrennte Aufräumplanung/-umsetzung/-review.

## CITY-00-I05-CP: Stammbaumbelege aufräumen

Originalframes unverändert lassen. CO-FTG-0026 bekommt explizite Grenzen: Adoption nur im Relations-Text belegt, Graphkarten oben teilweise angeschnitten, keine Aussage über Kantenbeschriftung. CITY-06 benötigt Beziehungen mit Art und Richtung als gemeinsame Datenreferenzen; die Baumansicht wird daraus abgeleitet und öffnet vorhandene Bewohnerdaten. Sichtbarer Originalgraph darf keine zweite Familien-Datenhaltung legitimieren. Umsetzungsbeleg und Aufräumreview prüfen Manifesthashes, Semantik und offenen Status.

## CITY-00-I06-P: Canvas-of-Kings-Testadapter

Nutzer hat den isolierten RFB/VNC-Steuerungsweg am 09.10. ausdrücklich erlaubt. Unter `tools/canvas-of-kings/` eigener Starter und Identitätswächter; vorhandenen generischen RFB-Protokolltransport importieren, nicht dessen Wonderdraft-Starter/Profil/PCK-Identität übernehmen. Steam-Demo 3122210 über Appmanifest, Installationspfad, gestreamten SHA-256 des 1,89-GB-Programms und beider Bibliotheken identifizieren; Steam-buildid ist kein semantischer Versionsnachweis. Privates HOME/XDG-Profil, Anzeige, D-Bus ohne Serviceaktivierung und nur lokale RFB-Bindung. Gemeinsame flock-Sperre während der gesamten Sitzung; keine fremden Prozesse beenden. Alle eigenen Prozesskennungen mit Startticks/realem Executable prüfen, nur eigene Kinder stoppen. Neue absolute Laufverzeichnisse unter externem QA-Root, keinerlei Installation im Vault oder Änderung des Steam-Bestands.

Offline-Review vor Start: ungültige App-/Manifest-/Profilpfade ablehnen, Identität und Speicherverhalten prüfen, bestehende RFB-Gesten unverändert wiederverwenden. Hardware-Rendering zunächst unverändert; ein notwendiger Rendering-Fallback wäre gesondert als Abweichung zu belegen. Basisprüfungen plus gezielter Lifecycle-/Identitätscheck. Native Probe erst nach freiem Kollegen-Slot und Sperrerwerb. Erster enger Lauf: tatsächlicher Startframe, sichtbare Versions-/Demo-Signale, neues QA-Dokument, Pfad-/Flächenwerkzeuge und Überblick/Detail; jeden nächsten Klick aus einem frischen Bild ableiten. Originalstartfehler und fehlende Funktionen bleiben offene Befunde; kein Dummy-Renderer und keine blinden Werkzeugfolgen. Review und getrennte Aufräumläufe folgen.

## CITY-00-I06-CP: Adapter-Sperrvertrag härten

R01/R02 vor Live-Probe schließen: Starter muss echte eigene FLOCK-WRITE-Sperre aus `/proc/<pid>/fdinfo` am eigenen offenen Lock-Deskriptor mit PID und Inode nachweisen, statt allein dem Reentry-Umgebungswert zu vertrauen. Manifest erhält Sperreigentümer-PID/Startticks/Executable. Wrapper prüft diesen Eigentümer und Sperre erneut sowie Anzeigeformat, Port=5900+Display, feste Framegröße und die vier Rollen. Bibliothekhashes bleiben unabhängig gestreamt; keine RFB-Eingabe bei ungültigem Vertrag. Offline-Test mit eigener temporärer flock-Datei (nicht gemeinsamer GUI-Sperre) belegt positive Sperre und zurückgewiesene unbelegte Reentry. Dann eigener Reparatur-/Aufräumreview vor Originalstart.

## CITY-00-I06-NI: direkte Demo-Kernwirkung

Demo0.4.06 (Steam-build16643264) startet mit eigenem HOME/XDG. Pfad aus zwei Punkten, dessen Kontrollpunktverschiebung, automatisch gefüllte Plot-Kontur und Eckverschiebung direkt belegt.25 Frames unter city00-cok-i06-20261009-01. Begrüßung nennt Funktions-/Inhaltsbegrenzung und automatisch reduzierte Grafikqualität: keine volle Grafikfreigabe. Save As erreichbar, aber zwei Pfad-Eingaben bestätigen keine Datei; Hypothese beendet, Exit/Do Not Save schließt den eigenen Testentwurf mit normalem Code0. Kein fremdes Dokument verändert.

Neue direkt sichtbare Pflichtkandidaten CO-COK-0006–0011: native Save/Open und Undo/Redo an gemeinsamer Atlas-Persistenz/History; Snapping/Kollision an topology/constraints; optionale Meterhöhe an Geometrie und Darstellung; benutzerdefinierte Assetdefinitionen/Editor und Community-Assetsuche an gemeinsamer Assetbibliothek. Die konkrete Steam-Workshop-Bindung, Demozugang und funktionale Tiefe sind vor Implementierung im Original zu prüfen; ein Menülabel ist kein Integrationsnachweis. Keine eigene History, doppelte Assethaltung oder Pixelhöhe. Höhenwerte benötigen Migration/Bounds in CITY-01 und Wirkung erst mit Detaildarstellung CITY-07.

## CITY-00-I06-NCP: Originalbeleg-Metadaten bereinigen

NR01: Neue CO-COK-0006–0011 auf tatsächlichen Demoquellbezug (Steam3122210) und protokollierten Sitzungszeitraum setzen. Die frühere offizielle Vollversions-Dokumentation als eigene Herkunft erhalten; keine Vollversionsprobe daraus machen. CO-COK-0001 ursprüngliche Dokumentsichtung ausdrücklich behalten und letzte direkte Beobachtung getrennt datieren. NR02: unklare aggregierte Ergebniszahl durch konkrete Referenzliste je Produkt mit Probeumfang, Manifest und verbleibender Galerieanforderung ersetzen. Artefakte/Historie/IDs unverändert,51 unabhängige offene Pflichten, CTY- und fremde Wurzeln prüfen. Keine zweite native Sitzung hierfür.

## CITY-00-I07-P: vollständige Save-As-Folge und benannte Presets

Neue Hypothese anhand I06-Frames019–022: Absolute Pfade im File-Feld deaktivieren OK. Nach Path-Eingabe/Enter ist File leer; der schmale Path-Text zeigt nur den Anfang `/home/a` und belegt kein Zurücksetzen. I06 hat keinen einfachen Dateinamen anschließend gesetzt und keinen Speicherabschluss geprüft. Deshalb keinen Produktfehler behaupten. Neue vollständige Folge im frischen privaten HOME: kleinen klar benannten Pfad/Plot erzeugen, Save As öffnen, Path auf ein eigens angelegtes privates `home/maps` setzen, Enter, File nur `CITY00-SAVE.mommap`, aktiviertes OK bedienen. Tatsächliche Datei/Hash erst nach sichtbarem Dialogschluss feststellen. Normaler Originalabschluss, dann neuer Prozess und frische Öffnung dieser unveränderten QA-Datei. Keine Instrumentierung oder Bearbeitung der Originalkartenstruktur; Dateidialoge ausschließlich im eigenen QA-Profil. Höchstens zwei erfolglose vollständige Folgen, dann entscheiden.

Preset-Inventar: Listenansicht/Tooltip aus sichtbaren Controls für Pfad-/Plot-Assets nutzen, echte Namen sichern, verfügbare Gebäudekategorien und Demo-/Vollversionsgrenzen trennen. Kein schneller Stadtgenerator oder individuell editierbare Ergebnisobjekte aus bloßer Plotwirkung ableiten. Erst der direkte Preset-/Korrekturablauf kann diese Tiefe belegen. Native Slotkoordination vor Start; bei belegtem Hex-Slot weiter Browser-/Offlinearbeit. Umsetzung, Originalreview und Aufräumplanung/-umsetzung/-review bleiben getrennte Läufe.

## CITY-00-I07-BP: FTG-Tageslicht während reserviertem Hex-Slot

COK-Neuöffnung bleibt als I07-I ausstehend, bis der Hex-Kollege die Farben-Session beendet. Unabhängige Browserprobe für CO-FTG-0019: bestehendes eigenes CITY00 Hamlet QA verwenden, Render settings/Shadows–Sun mit aktiviertem Day/night cycle dokumentieren. Sichtbare Uhr-/Weltparameter inventarisieren; wenn zugänglich 11-Uhr-Tag gegen Abend/Nacht aufnehmen und Renderwirkung bei identischer Uhrzeit mit Zyklus an/aus vergleichen. Vor jeder Mutation Ausgangswert sichern, Rendererpräferenz anschließend auf Ausgangswert zurückstellen. Keine fremde Siedlung oder Kontodaten. Wetter/Saison getrennt nur soweit echte Controls vorhanden sind. Keine Zeit-/Wetterwirkung aus Exportmenüs ableiten.

Zusätzlich entdeckte General-/Effects-Controls als eigenständige Pflichtkandidaten inventarisieren: Dachdarstellung, Dekorationsanteil, Materialvariation, Renderer-/Qualitätsoptionen und Bildeffekte. Sichtbare 3D-/Street-view-Option hat laut Original Einschränkungen; Umfang bleibt ausdrücklich offen und benötigt eigene Wirkung/Architekturprüfung vor Annahme einer zweiten Editoroberfläche. CITY-07/08 nutzen dieselben Meterdaten, Asset- und Kamerareferenzen; Darstellungsoptionen dürfen keine doppelte Karte/History erzeugen. Originalbelege werden unter city00-i07-browser-20261009 gesichert und separat reviewt/aufgeräumt.

## CITY-00-I07-BI: Wetter-/Nachtwirkung und Darstellungsinventar

26 Originalartefakte im externen Manifest city00-i07-browser-20261009. Schnee(clear) macht den Sommerboden weiß; Winter verändert Laubbäume und Saison-Sonnenvorgaben. 23 Uhr mit Zyklus an/aus/wieder an verändert die Helligkeit; alle Ergebnisframes zeigen250m. Uhr11Montag, Clear/Summer/Northern/East mit SaisonvorgabenHigh5/21 und aktivierter Zyklus wiederhergestellt. Version unbekannt, übrige Wetter-/Sonnenfälle und Bewohner-Zeitwirkung offen.

CO-FTG-0031–0042 erweitern die offenen Pflichten um Dachmodi, Dekorationssichtbarkeit, Texturen, Materialfarben, Feldkanten, Wasserwirkung, AA/FPS, Schattenauflösung, Bildeffekte, SVG-Gerätefallback, experimentelle3D/StreetView und Ruhetagüberschreibung. Controls belegen noch keine Wirkung. CITY-07: versionierte Renderpräferenzen und feste Weltzeit; Dachmesh aus derselben Meterkontur, Texturen/Materialfarben aus gemeinsamer Assetreferenz, deterministische saisonale Vegetation und Wetterpass; Bildeffekte nur Darstellung, keine Geometrieveränderung. Schatten/Feldfade/Wasser bleiben ableitbare Renderpässe. Ruhetagoverride gehört an Weltkalender/Simulation und dieselben Personen-IDs. CITY-08: gemeinsame Qualitätspräferenzen, getrennte gemessene Renderzeiten/FPS, sichtbar reduzierte Qualität bei Gerätefallback; SVG aus denselben Geometrien, keine zweite Datenhaltung. CITY-07/08:3D/StreetView benötigt vor Implementierung eine eigene Originalprobe und Architekturentscheidung für Perspektive/Navigation auf denselben Weltmeterdaten; keine zweite Editor-/Historybasis.

Bedienziel: Darstellungsänderung erhält Kamera, Zoomanker und Auswahl; Original-Render-Save setzt hier Kamera zurück. Bessere Bedienung bleibt durch gepaarte Aufgaben nachzuweisen. Keine Produktabnahme aus Referenzbildern.

## CITY-00-I07-BCP: Referenzmetadaten bereinigen

I07-BR01: CO-FTG-0039 um die direkt sichtbaren Color-effect-Optionen None/Greyscale/Sepia/Green tint erweitern; keine Wirkung behaupten. I07-BR02: externe Ergänzung zum unveränderten Rohmanifest mit den konkreten Rückstellungsframes sowie identischem Bildausschnitt für Helligkeitswerte erzeugen. Grauwertmittel ist nur eine Zusatzmessung des Originalbildes, keine Geometrie-/Bedienabnahme. Quelldateien unverändert erhalten, Hashes erneut prüfen. Eigener Umsetzungslauf BCI, danach BCR prüft beide Befunde und fremde JSON-Wurzeln.

## CITY-00-I08-P: FTG-3D und Street View

CO-FTG-0041 bislang nur sichtbarer Control. Eigene temporäre Siedlung: General-Ausgangswerte und Tageskarte sichern, ausschließlich3D-Unstable aktivieren, Save, tatsächliche Karte und neue Navigationscontrols prüfen. Street-View nur über sichtbare Originalcontrols aufrufen; Ablauf, Lage/Orientierung und Rückkehr dokumentieren. Keine Wirkung aus Hinweistext ableiten. Anschließend3D wieder ausschalten und Ausgangsuhr/Wetter/übrige Renderwerte erhalten; Kamera nach Save am gleichen Maßstab prüfen. Höchstens zwei erfolglose Folgen. Originalartefakte in city00-i08-browser-20261009; eigener Review und getrennte Aufräumläufe. COK-I07 bleibt bis Hex-Slotfreigabe ausstehend. Architekturfolgen erst aus tatsächlicher Probe ableiten und in ARCHITECTURE.md festhalten.

## CITY-00-I08-CP: Perspektivbelege und Vertragsgrenze bereinigen

Originaldateien unverändert erhalten. Externe Bereinigung ordnet General-Controlwerte vor/nach und den tatsächlich angewandten Rückkehrframe zu. StreetView-Einstieg ist Perspektivdarstellung, keine belegte Fortbewegung; keine Aussage über Kollision oder gespeicherte Kameraposition. Das optionale Darstellungsziel darf CTY-002.03/005.02 nicht verdrängen: Region/Stadt/Haus/Raum bleiben per Zoom im gemeinsamen Editor bearbeitbar. Perspektivnavigation benötigt denselben Placementgraph, dieselben Meterdaten und stabile Auswahl; zusätzlicher Editor, Datenduplikation oder eigene History erfüllen den Auftrag nicht. Diese Anforderungen präzisieren die künftige Planung, implementierte3D-APIs existieren noch nicht. CI ergänzt Belegzuordnung; CR prüft Hashes, Präferenzwerte, Quellenumfang und erhaltene Fremdwurzeln.

## CITY-00-I07-CP: RFB-Eingaben eindeutig halten

I07-R01: COK-Wrapper übergibt wiederholte Optionen an den generischen Parser; bei zwei --click bleibt nur das letzte. Eigener COK-Vorparser prüft unterstützte Stringoptionen und Parser-Tokens auf doppelte Namen, auch --click=Form, vor Dateilesen/Identitätsprüfung/Verbindung. Der generische Wonderdraft-Transport bleibt unangetastet. Ein CLI-Regressionstest mit absichtlich nicht existierender Session belegt den frühen Duplicate-Fehler; gültige Kombinationsaufrufe und Text mit Optionszeichen bleiben möglich. README verlangt einen Klick je Aufruf. check/test/build und separater Reparaturreview; Rohframes und gespeicherte Originalkarte unverändert. Normaler Originalexit0 trotz verfrüht geschlossenem Screenshottransport bleibt getrennt dokumentiert.

## CITY-00-I09-P: kleine Ergebnisgalerie und offene Umsetzungspflichten

Das bestehende CITY-00-Tor fordert eine kleine feste Galerie, nicht die vollständige Hostabnahme jedes späteren Features vor CITY-01. Galerie bündelt eigenes FTG-Dorf, Watabou-Mauer-/Hafenübersicht und Detail, zusätzlich ein kleines Watabou-Dorf/eine Binnen-Mauerstadt aus sichtbaren Originalcontrols sowie eine ausgearbeitete COK-Draufsicht. Offiziell veröffentlichte COK-Bilder dürfen als Ergebnisvorbild dienen, werden ausdrücklich als veröffentlichte Galerie statt eigener Vollversionsprobe bezeichnet; Datum, Quelle, unveränderte Bildbytes/Hash und Ausschnitt dokumentieren. Demo-Market-Kleinkarte bleibt eigener Wirkungsbeleg und ersetzt keine Gebäude-/Stadtgalerie. Kein Kauf oder Vollversionszugang wird vorausgesetzt.

63 funktionale Pflichten bleiben vollständig erhalten und nach Zielphase geordnet. Übersicht zeigt getrennt: Inventarquelle, direkte Originalwirkung, eigene Umsetzung, Hostvergleich und Bedienvergleich. Control-only bedeutet keine Funktionsfreigabe. Fehlende Details werden spätestens vor dem entsprechenden Produktpaket nachgemessen. Veraltete referenceGate-Formulierung gegen Werkzeuginventur im Review mit dem erweiterten Funktionsauftrag abgleichen; keine Originalgestenpflicht daraus machen. Nur wenn alle vier Galerieformen, Grenzen und Ergebniskriterien belegt sind, das Ergebnistor schließen; Vollinventur-/Paritätsabschluss und HEX-05 getrennt offenhalten. Artefakte unter city00-i09-gallery-20261009. Eigener Review, danach getrennte Aufräumplanung/-umsetzung/-review.

## CITY-00-I09-CP: Galerieabschluss und Metadaten bereinigen

I09-R01: Galerietor nur für die vier Ergebnisformen schließen; vollständiges Funktionsinventar, eigene Wirkung und bessere Bedienung ausdrücklich offen. Keine Originalgeste als Pflicht, aber Funktionsinventur erforderlich. I09-R02: aktuelle Referenz-/Galerieangaben auf das feste Manifest verweisen und den Demoquelltext mit erfolgreicher I07-Speicherung/Neuöffnung berichtigen; historische Beobachtungen und alle63 Kandidaten/24 CTY-Fälle unverändert erhalten. CITY-00 als Referenzpaket bleibt wegen voller Inventur offen, HEX-05 weiter eigenständige Voraussetzung. I09-R03: veröffentlichten Nahbildnamen auf bridge-detail berichtigen, Hash und Quellenumfang erhalten; AVIF-Banner aus der Ergebnisgalerie ausschließen. Eigener Umsetzungslauf mit JSON-Wurzelschutz; danach unabhängiger Review von Hashes, Ausschnitten, Gategrenzen und Pflichtstatus. Keine Produktcodeänderung für diese Metadatenphase.

## CITY-00-I10-P: frühe Bearbeitung und phasenbezogene Referenzlücken

Die abgeschlossene Ergebnisgalerie wird nicht erneut geprüft. Die63 offenen CO-Pflichten werden aus acceptance.cityPlans.functionalInventory nach Zielphase geordnet; kein dokumentierter Control wird dabei zur abgenommenen Funktion. Frühe CITY-01-Pflichten: CO-FTG-0015 manuelle Kartenbearbeitung, CO-COK-0006 Save/Open und CO-COK-0007 Undo/Redo. Save/Open ist im Original belegt, eigene Atlaspersistenz fehlt. COK-Undo wartet auf den ausdrücklich freigegebenen nativen Slot. FTG-Bearbeitung lässt sich im bestehenden eigenen temporären Dorf unabhängig vorziehen.

I10-I: FTG-Edit-map-Menü öffnen, verfügbare Geometriewerkzeuge und tatsächlichen Zugangsstatus dokumentieren. Eine kleine isolierte Änderung an einem klar sichtbaren Gebäude oder Straßenpunkt durchführen, Wirkung und Rücknahme über die angebotenen Originalcontrols prüfen. Keine geschützte Gebäudebeschreibung ändern, keine neue Siedlung erzeugen, kein Login/Kauf. Falls Originalzugang gesperrt ist, nur diese konkrete Zugangslücke belegen und nächste erreichbare frühe Funktion nehmen. Höchstens zwei erfolglose Folgen. Übersicht der63 Pflichten enthält Phase, Aufgabe, Quelle und genauen Originalprobe-Status; fehlende Wirkungen spätestens vor dem zugehörigen Umsetzungspaket messen. Die Übersicht ist abgeleitet, acceptance bleibt alleinige Statusquelle. Keine zweite Atlasbasis oder Produktimplementierung vor HEX-05. Umsetzung, Review, Reparatur und Aufräumplan/-umsetzung/-review getrennt.

## CITY-00-I10-CP: Wirkungsbelege und abgeleitete Übersicht bereinigen

I10-R01: Frame08 präzise als cancel-dialog benennen; Originalbytes und Hash bleiben unverändert, Frame09 zeigt erst den abgeschlossenen Abbruch. I10-R02: sieben Gebäudewerkzeuge insgesamt, sechs weitere neben Move; Anzahl in Manifest und aktuellem CO-FTG-0015 korrigieren. I10-R03: Lückenübersicht ausdrücklich als Snapshot des acceptance-Standes kennzeichnen, spätere Inventaränderung aktualisiert den Snapshot nur als zusammengehöriges Planpaket. Keine parallele Statuspflege. Referenzmanifest bekommt eine separate Bereinigungsergänzung, Rohmanifest bleibt als damalige Beobachtung erhalten. Danach Hash-/Kennungs-/Wurzelschutz und realen Ausgangsframe erneut prüfen; keine neue Wirkung oder Produktarchitektur als implementiert behaupten.

## CITY-00-I11-P: Straßenänderung und Layoutpersistenz im Original

Frühe CO-FTG-0015-/CTY-002.01-Referenz vervollständigen: eigenes temporäres Dorf benutzen, Ausgangsbild sichern und manuelles Roads-Werkzeug öffnen. Sichtbare Straßentypen/Zeichen-/Änderungs-/Entfernungsoptionen erfassen. Eine kleine eindeutig zusätzliche Straßenstrecke in freier Fläche zeichnen, tatsächliche Kontur prüfen und Save Layout ausführen. Frisches Browserladen muss genau diese Strecke erhalten; dies belegt temporäre Originalpersistenz, keine eigene Atlaspersistenz. Anschließend ausschließlich die selbst hinzugefügte Strecke entfernen, speichern und Ausgangsmaßstab/Beschriftung/Uhr wiederherstellen. Falls kein eindeutig begrenztes Entfernen möglich ist, keine bestehende Straße löschen; eigenen Versuch sichtbar stehen lassen und Rückstellungslücke benennen. Gebäude-/Bewohnerdaten nicht ändern. Höchstens zwei erfolglose Folgen. Native COK-Undo-Probe bleibt bis zum freigegebenen Kollegen-Slot ausstehend. Eigene Umsetzung, Review und Aufräumplan/-umsetzung/-review; Referenzartefakte extern, alle63 Pflichten bleiben offen.

## CITY-00-I11-CP: Quellenumfang und direkte Bearbeitungszuordnung bereinigen

I11-R01: CO-FTG-0015 hat eine direkte Teilprobe, nennt aber weiterhin nur die allgemeine Dokumentationsquelle und availability unknown. Die frühere Dokumentationsquelle separat erhalten, aktuelle Quelle auf das tatsächlich geprüfte eigene temporäre Original setzen und Zugänglichkeit ausdrücklich auf dessen geprüfte Werkzeuge begrenzen; Premium-/Vollumfang nicht dadurch freigeben. I11-R02: bestehende related CTY-003.01-Verknüpfung erhalten, zusätzlich CTY-002.01 undCTY-002.02 für unmittelbare Straßen-/Hausänderung zuordnen. CO bleibt eigenständige offene Pflicht, keine CTY-Abnahme daraus ableiten. Rohbilder/Manifest bleiben unverändert; separate Ergänzung dokumentiert die Metadatenkorrektur. Eigene Bereinigung und anschließender Hash-, Verweis-, Pflicht- und Wurzelschutzreview.

## CITY-00-I12-P: Generierungsvorgaben ohne Verlust der bestehenden Probe

Vorige Exportversuche I02/I04 sind nach zwei Downloadbeobachtungen unbestätigt; dieselbe Downloadhypothese nicht erneut versuchen. Bestehendes CITY00 Hamlet QA bleibt erhalten. Über den sichtbaren Create-new-Einstieg Formularzugang/Abbruch prüfen, ohne Generate auszuführen. Straßenlayout-/Bebauungsoptionen, benannte Presets und Namens-/Settings-Controls vollständig in ihren tatsächlich sichtbaren Abschnitten erfassen. Wenn eine Vorschau ohne ersetzende Generierung angeboten wird, deren direkten Wirkungsausschnitt belegen und abbrechen; sonst nur Controlumfang/Zugangslücke dokumentieren. Keine Kontoerstellung, kein Login/Kauf, keine neue temporäre Karte über die vorhandene schreiben. Anschließend zur vorhandenen Karte zurück, Namen/Uhr/Beschriftung/Maßstab prüfen. Erst aus zugänglichem Ablauf technische Parametergrenzen für CITY-02 präzisieren; keine Generatorwirkung aus Formularlabels ableiten. Umsetzung, Review sowie getrennte Aufräumplanung/-umsetzung/-review. COK-Undo bleibt nach nativer Slotfreigabe offen.

## CITY-02-Parameterpräzisierung aus I12

Originalentwurf Town(~4000): American-Stufe1 = Continue, Winkelwerte0/0, Segment50m, Verzweigungsintervalle3/3; Ringed-Stufe1 = Curve around origin,5/5,37m,2/5. Dies sind beobachtete Formularwerte, keine Kartenwirkung oder allgemeine Presetkonstante für jede Größe. CITY-02 benötigt geordnete versionierte Wachstumsstufen mit Flächenanteil, Straßenverzweigung, Segmentlänge, Intervallen, Mindestviertelfläche, begrenzter Hauptstraßenverzweigung, Gebäudeplatzierung und Material-/Maueroverride. Suburb ist Restanteil nach den Stufen (60/40 im Originalentwurf belegt); Parser normalisiert keine ungültigen Summen stillschweigend. Presetdefinition und Custom-Parameter gehören mit Generatorversion/Seed zum gespeicherten Auftrag; Ergebnis bleibt materialisierte editierbare Metergeometrie. Winkelmaße und Parametergrenzen vor Implementierung direkt klären. Keine neue Geometrie-/Historybasis.

CO-FTG-0022 umfasst Namensset-Referenzen pro Bewohnerart (12 sichtbare Sets, Mehrfachauswahl Generic+Old German belegt) sowie gespeicherte Generierungsvorgaben. CITY-02 speichert versionierte Vorgaben an der gemeinsamen Dokument-/Assetbibliothek; CITY-06 verwendet dieselben Referenzen deterministisch für Bewohnernamen. Kein Kopieren einer proprietären Namensdatenbank aus Originalinternas; konkrete kompatible Namenssammlungen und Bearbeitung/Import müssen vor Umsetzung geprüft werden. Gewichte der Arten und Stufenanteile sind getrennte Parameterarten; keine unbewiesene gemeinsame Prozentregel. Eigene Naming-Ausgabe, Import/Export und Gleichwertigkeit bleiben offen.

## CITY-00-I12-CP: Architekturauftrag und zweiphasige Namenszuordnung

I12-R01: ARCHITECTURE-Stadtabschnitt nennt weiterhin nur zwei Ergebnisvorbilder. Auf vollen Funktionsauftrag aller drei Programme präzisieren, Originalgesten weiterhin nicht zur Vorgabe machen. Geplante Stufen-/Namensbesitzregeln dort festhalten; dieser Plan bleibt konkrete Parameter-/Nachweiszuordnung, keine zweite Architekturquelle. I12-R02: CO-FTG-0022 besitzt CITY-02-Vorgabenspeicherung und CITY-06-Bewohnerausgabe; implementationPhases additiv explizit machen und den abgeleiteten Lückensnapshot entsprechend aktualisieren. Bestehende Kennungen und verwandte CTY-Verweise bleiben erhalten; keine vorhandene CTY-Anforderung künstlich auf Bevölkerung umdeuten. Alle Bild-/Textrohbelege unverändert, Quelle/Datum/Version und fehlende Generierung offen erhalten. Eigene Umsetzung, danach separater Hash-/JSON-/Mapping-/Architekturreview.

## CITY-00-I13-P: gespeicherte Generierungsvorgaben

CO-FTG-0022 Datei-/Speicherablauf gesondert prüfen: bestehendes eigenes Hamlet behalten, Create-Dialog öffnen und sichtbares Load saved settings bedienen. Tatsächliche Optionen, Zugriff und Speicherort aus Originalcontrols erfassen. Falls Save settings/Dateiausgabe für den aktuellen Entwurf angeboten wird, einmal dessen konkreten Ablauf prüfen; Einstellungsdatei ist eine andere Hypothese als die nach zwei unbestätigten Versuchen gestoppte Siedlungs-Datenausgabe. Original-Download nur über die angebotene Browserbeobachtung bestätigen; Menüschluss allein genügt nicht. Nur eine tatsächlich empfangene eigene QA-Vorgabe darf im eigenen Create-Entwurf wieder geladen werden. Bei Konto-/Premiumsperre oder fehlendem Filebeleg Zugangslücke erhalten, keinen Login/Kauf und keine erneute Stadt-Datenausgabe. Keine neue Stadt erzeugen. Anschließend eigenen Entwurf verwerfen und existierende Karte prüfen. Review, eventuelle Nachbesserung und Aufräumplan/-umsetzung/-review getrennt; Produkt-/Host-/Bedienfreigabe bleibt offen.

## CITY-00-I13-CP: Abschnittsweise Vorgaben als geplanter Vertrag

I13-R01: Dokumentation nennt lokale/Datei/Cloud-Vorgaben und ausgewählte Abschnitte; im temporären Formular ist nur eine leere Load-Liste direkt zugänglich. Keine Ursache als Premiumsperre unterstellen. CITY-02 plant ein versioniertes Vorgabedokument mit stabiler Kennung, Name, Generatorversion und expliziter Abschnittsmenge. Laden validiert und migriert zunächst vollständig, ersetzt nur enthaltene Abschnitte in einem gemeinsamen History-Befehl und erhält alle übrigen Werte. Ungültige/fehlende Referenzen werden vor dem Übernehmen angezeigt; keine teilweise Anwendung oder stille Umdeutung. Speichern/Export verwendet dieselbe kanonische Serialisierung wie die gemeinsame Vorgabenbibliothek. Cloud-Zugänglichkeit und Synchronisationsregeln bleiben vor Umsetzung gesondert zu prüfen. Keine zweite Stadt-/Personendatenhaltung.

Umsetzung dieses Aufräumpakets ist ausschließlich die Vertragspräzisierung in ARCHITECTURE und der Nachweiszuordnung. Eigene Produkt-API folgt nach HEX-05. Vor fachlicher Freigabe: tatsächliche Originalfolge mit zwei unterscheidbaren Abschnitten, eigenes Save/Reload/Datei-Roundtrip, atomarer Undo/Redo und Erhalt ausgelassener Abschnitte. Rohbelege bleiben unverändert. Anschließender Review prüft Kennungen, Wurzelschutz, Verweise/Hashes und klare Trennung von Dokumentation, Originalwirkung und geplanter Implementierung.

## CITY-00-I14-P: lokale Watabou-Verformung und Neugeneration

CO-WAT-0007/0008 bisher nur im Originalmenü erfasst. Eine neue Browser-Testkopie mit der aktuell beobachteten URL/Seed der eigenen New-River-Karte öffnen; Galerie- und Ausgangstabs erhalten. Ausgangsbild, tatsächliche Menüanweisungen und einen kleinen lokalen Geometriezug sichern. Nur sichtbare Originalcontrols verwenden. Nach Warp/gegebenenfalls lokaler Regeneration Wirkung, Reichweite und angebotene Rücknahme prüfen; keine beliebige Tastenkombination als Originalregel annehmen. Höchstens zwei erfolglose Folgen je Hypothese. URL-/Seed-Neuladen ist gegebenenfalls eine neue Generierung, kein Save/Open des bearbeiteten Zustands. Kein internes Appmodell oder proprietäre Daten extrahieren. Neue Testkopie danach schließen, Originalkarten erhalten.

Ergebnis präzisiert geplanten CITY-04-Befehl samt Konflikt mit geschützten/verlinkten Elementen, ohne Originaleffekte als eigene Abnahme zu werten. Eigener Wirkungsreview, gegebenenfalls Nachbesserung und getrennte Aufräumplanung/Umsetzung/Review; gemeinsame Atlasbasis weiterhin HEX-05.

## CITY-00-I14-CP: Verformung und Neugeneration getrennt zuordnen

I14-R01: CO-WAT-0008 führt Bloat, Displace, Equalize, Liquify, Measure, Pinch, Rotate und Relax als ausdrücklich offene Teilpflichten. Nur Displace hat eine direkte Teilwirkung; Measure ist zunächst Messfunktion, nicht unbelegt als Mutation behandeln. Vor Umsetzung jedes Werkzeugs tatsächliche Parameter, Radius-/Stärkewirkung, Eingabefolge, Übernahme und Abbruch messen. Keine gemeinsame unbewiesene Verformungsformel aus den Labels ableiten.

CITY-04 plant einen Geometrieänderungsbefehl getrennt vom Generatorersatz. Ein Entwurf hält vollständige Vorher-/Nachherwerte aller betroffenen stabilen Elemente; Apply ist ein gemeinsamer Atlas-History-Befehl, Cancel verliert keine Werte. Straßenknoten und Grundstück-/Gebäudekonturen bleiben konsistent; ungültige Überschneidungen werden vor Übernahme sichtbar geprüft. Manuelle Verformung erzeugt keine neuen Kennungen oder Personen/Keys. Dungeonbindungen folgen der abgeleiteten starren Gebäudeplatzierung; Raumkonturen werden nicht mit einem Stadt-Warp verzerrt. Automatische Neugeneration respektiert weiterhin den bestehenden Schutzvertrag. Save lädt materialisierte Endgeometrie ohne Wiederholung der Operation. Wirkungsvarianten, Transformbindung, Konflikt, Undo und frischer Host-Neustart bleiben jeweils erforderliche Abnahmen. Keine zweite Kamera/History/Geometriedatenhaltung.

Dieses Aufräumpaket ergänzt ausschließlich geplante Architektur und Teilpflicht-/Belegzuordnung. Originalframes bleiben unverändert; Stadtcode folgt nach HEX-05. Eigener Umsetzungs- und anschließender Reviewlauf prüfen diese Grenzen, die acht Werkzeuge, stabile Kennungen, Verweise und Wurzelschutz.

## CITY-00-I15-P: weitere Watabou-Warp-Werkzeuge direkt messen

CO-WAT-0008: Bloat, Equalize, Liquify, Measure, Pinch, Rotate und Relax bislang nur Controls. Neue eigene Browserkopie derselben beobachteten New-River-URL; für jedes Werkzeug vor der Folge neu laden, damit kein voriger Zug das Ergebnis beeinflusst. Sichtbares Warp-Menü und gewähltes Werkzeug sichern, kleinen lokalen Zug beziehungsweise angebotene Messfolge ausführen und tatsächliche sichtbare Wirkung erfassen. Kein Effekt wird aus seinem Namen abgeleitet. Bei fehlender Wirkung höchstens zwei kontrollierte Folgen, dann offene Eingabe-/Wirkungslücke erhalten. Apply/Discard nur auf dieser Testkopie; keine Galerie-/Ausgangskarte ändern. Seed-Neuladen ist Reset der Testbasis, kein bearbeiteter Save/Reload. Distanzanzeige, falls angeboten, als Messfunktion getrennt erfassen.

Alle sieben Teilpflichten bleiben offen bis eigener Umsetzung samt Ergebnis-/Host-/Bedienvergleich; Radius/Falloff, exakte Konturwerte, Schutz und Bindungen werden hier nicht aus Pixelbildern behauptet. Ergebnistabelle ordnet pro Werkzeug tatsächlich beobachtete Folge und offene Restfragen zu. Eigener Review und Aufräumplanung/Umsetzung/Review; keine Atlasimplementierung vor HEX-05.

## CITY-00-I15-CP: globale Drehung und Messung gesondert planen

I15-R01: Eine starre Gesamtdrehung nutzt die gemeinsame Stadtplatzierung als getrackten Atlasbefehl; die lokale Stadtgeometrie wird dafür nicht neu generiert. Gebundene Gebäude-/Dungeonplatzierungen folgen über die vorhandene Transformkette; Keys/Personen bleiben wertgleich. Drehpunkt und Winkelabbildung des Originalwerkzeugs sind weiter zu vermessen. Lokale Konturverformungen behalten den geplanten Vorher-/Nachher-Geometriebefehl. Die Messfunktion erzeugt ein vorübergehendes Overlay in derselben Kamera; Endpunkte liegen in gemeinsamen Meterkoordinaten, Anzeige folgt den gewählten Einheiten. Messung erzeugt keine Dokumentmutation oder History-Einträge. Prüfen: Rotation plus lokale Hausverschiebung/Undo, gebundener Dungeon, Save/Neustart, Messung bei mehreren Zoom-/Einheitenstufen ohne Dirty.

| Originalwerkzeug | Direkte I15-Teilprobe | Rest vor Abnahme |
|---|---|---|
| Bloat | Geometrie/Bebauung ändert sich sichtbar | Formel, Stärke, Radius, exakte Reichweite |
| Equalize | Rote Polygonpunkte und geänderte Geometrie/Bebauung | Gleichverteilungsregel, Zielumfang |
| Liquify | Pinsel/Kanten und geänderte Geometrie/Bebauung | Feld-/Konturregel, Einflussverlauf |
| Measure | Endpunktstrecke zeigt 96 m | Kalibrierung, Einheiten, Zoom, Overlaylebensdauer |
| Pinch | Pinsel/Kanten und geänderte Geometrie/Bebauung | Richtung/Stärke, Einflussverlauf |
| Rotate | Ganze Stadt samt Fluss/Küste dreht sich | Drehpunkt, Winkelabbildung, Bindung/Save |
| Relax | Pinsel/Kanten und geänderte Geometrie/Bebauung | Glättungsregel, Stärke, Einflussverlauf |

Ein kontrollierter Zug pro Werkzeug auf frischer Seedbasis; Discard geprüft. Kein Rohgeometrie-/Kennungsvergleich, keine vollständige Operationsformel und keine eigene Implementierung aus diesen Bildern ableiten. Nach Umsetzung der geplanten Rollenpräzisierung eigener Review auf Beleg-/Status-/Wurzelschutz.

## CITY-00-I16-P: tatsächliche Watabou-Ausgabedateien

CO-WAT-0005 bisher Exportmenü ohne empfangene Dateien. Separate Browserkopie der beobachteten eigenen New-River-URL öffnen, originale Auswahl-/Exportoptionen und Übersicht sichern. PNG, SVG und JSON je einmal über den angebotenen Downloadbeobachter versuchen; beobachtete Dateipfade sichern und nur tatsächlich vorhandene Dateien anhand Signatur, Parser, Umfang und Hash prüfen. Dateiformate nicht aus Menüschluss oder Extension allein ableiten. Kein verdeckter Appzustand, keine interne Implementierung und keine Netzwerkrouten als Ersatz abrufen. Bei fehlender Dateibestätigung konkrete Beobachtungslücke erhalten, keine Originalfehlfunktion behaupten. Die gestoppte FTG-Siedlungs-JSON-Hypothese wird nicht erneut versucht.

Falls JSON/SVG tatsächlich empfangen wird, öffentlich ausgegebene Geometriestruktur prüfen; nur daraus messbare Koordinaten/Einheiten/Mengen nennen, keine stabile Identitäts- oder Importfähigkeit erfinden. PNG/SVG-Darstellung gegen den gewählten Originalausschnitt prüfen. Eigene Datei unverändert archivieren; Testkopie schließen, Originaltabs erhalten. CITY-08-Plan präzisiert nötigen Format-/Geometrie-/Ausschnittvertrag, keine Produktimplementierung vor HEX-05. Separater Review, nötige Nachbesserung und Aufräumplan/Umsetzung/Review.

## CITY-00-I16-CP: PNG/JPEG/SVG/JSON ausdrücklich abdecken

I16-R01: CITY-08 benennt PNG/JPEG und die direkt belegten Watabou-SVG/JSON-Funktionen ausdrücklich. Alle Ausgaben stammen aus demselben unveränderlichen Szenen-/Dokumentstand; gewählter Weltmeter-Ausschnitt und Rasterauflösung sind getrennt von der aktuellen Kamera. SVG erhält echte Vektorpfade, Texte und Stil-/Schriftressourcen; keine unbelegte Offlinegleichheit aus XML-Parse. JSON erhält versioniertes Schema, dokumentierte Koordinatenachsen/Einheiten, materialisierte Geometrie und stabile eigene Element-/Bindungskennungen. Das originale JSON besitzt Kategoriekennungen und überwiegend direkte Geometrieobjekte; sein Wort FeatureCollection ersetzt keine Format-/Importprüfung. Exportmetadaten0.11.5 gelten nur für die empfangene Ausgabe, nicht rückwirkend für vorige Referenzläufe.

Formatprüfungen: tatsächliche Datei/Signatur/Parser, sichtbare Ausgabe, gleiche Geometrie/POIs im gemeinsamen Ausschnitt, fehlende Schriftressourcen sichtbar behandeln, metrische JSON-Werte nach eigener geplanter Importspezifikation zurücklesen. Raster/Pfad/Text und Datenausgabe getrennt messen. I16-PNG/SVG/JSON-Rohdateien/Downloads bleiben bytegleich erhalten; browserbedingt abgelehnte lokale SVG-Vorschau bleibt offen und wird nicht umgangen. Eigene geplante Exportpipeline, umfassende Formatvarianten und Host/Bedienung bleiben unimplementiert. Nach Planpräzisierung eigener Review.

## CITY-00-I17-P: COK Undo/Redo auf freigegebenem Testplatz

Kollege hat den nativen Slot ausdrücklich freigegeben; vier Sitzungen Exit0 und16 PID/Startkennungen aktuell weg geprüft. Nutzer-RFB-Freigabe bleibt gültig. CO-COK-0007 früh für CITY-01 direkt messen: neue isolierte Demo-Sitzung, frisches privates Profil und tatsächlicher gemeinsamer Lock. Original und Bibliotheken über vorhandenen COK-Starter prüfen. Voriges eigenes CITY00-SAVE.mommap nur bytegleich in den neuen QA-Lauf kopieren; Vorlage erhalten. Über sichtbaren Original-Open-Control öffnen, angebotene Undo/Redo-Bedienung lesen. Eine eindeutig begrenzte Pfadpunkt-/Geometrie- oder Parameteränderung durchführen. Vorher, Änderung, Undo und Redo in Screenshots sowie jeweils tatsächlich gespeicherten Kopien sichern, sofern die Demo diese Folge anbietet. History-Rücknahme muss den passenden Ausgangswert, Wiederherstellung den geänderten Wert reproduzieren; Save allein beweist kein Undo.

Kein blinder Shortcut; keine Vollversionsparität oder physische Bedienabnahme aus synthetischen Eingaben. Höchstens zwei erfolglose Folgen; konkrete Zugangslücke erhalten. Eigene Sitzung normal über Originaloberfläche beenden und Exitcode plus tatsächlichen Verlust aller eigenen PID/Startkennungen prüfen. Kollegen danach Slot ausdrücklich freigeben. Review und Aufräumplanung/Umsetzung/Review getrennt; gemeinsame Produktbasis weiterhin HEX-05.

## CITY-00-I17-CP: Belegnamen und Save-/History-Grenze

I17-R01: Historische Originalbilder unverändert erhalten. Separate Caption-Zuordnung benennt 007 als Recent-Path-Dropdown ohne geöffnetes Verzeichnis, 012 als Object Tool und 019/022 als Undo-Versuche ohne Rücknahme. Kein Screenshotdateiname ersetzt sichtbare Wirkung. I17-R02: Zwei erfolglose Post-Save-Versuche sind gestoppt. Eine spätere neue Hypothese prüft auf frisch geöffneter eigener Kopie zuerst eine ungespeicherte Änderung, dann Undo und Redo vor Save. Zwischenzustände sichtbar sichern; keine gespeicherten Zwischenstände behaupten, wenn Save die Probe beeinflussen könnte. Ein separater Save-/Reload-Vergleich bleibt erforderlich. Keine Produktentscheidung über Save-History aus der unbelegten Originalfolge ableiten.

Aufräumumsetzung ergänzt ausschließlich Captions und Grenzen am unveränderten Manifest; Rohdateien/Vorlage erhalten, keine erneute native Sitzung. Danach eigener Review von Hashes, Verweisen, getrennten Status-/Abnahmefeldern und fremden JSON-Wurzeln. HEX-05 und alle Stadtproduktabnahmen bleiben offen.

## CITY-00-I18-P: Bewohnerdetails ohne Ersatz der QA-Siedlung

Native COK-Pre-Save-History bleibt nach I17 offen und wird erst nach ausdrücklicher Slotabstimmung geprüft; Kollege nutzt aktuell N-I18. Der bestehende FTG-Testort besitzt einen geschützten bearbeiteten Hausnamen. Weitere Gesamtgenerierung wird zurückgestellt, weil die Oberfläche nur eine temporäre Siedlung anbietet und verlustfreie Wiederherstellung nicht belegt ist. Stattdessen CO-FTG-0014 direkt prüfen: Bewohnerliste öffnen, einen Bewohner über sichtbare UI auswählen, angebotene persönliche Eigenschaften, Wohn-/Arbeitsort, Familie/Beziehungen und Tagesablauf erfassen; vorhandene Links verfolgen und zur Ausgangsliste zurückkehren. Nur vorhandene sichtbare Felder/Linkeffekte als Originalfunktion belegen, keine verborgenen Appdaten lesen. Keine Personen-/Hausänderung, kein neuer Ort, kein Exportwiederholversuch.

Vorher-/Detail-/Link-/Rückkehrbilder samt UI-Text und URL sichern; Ausgangsname, Maßstab und geschützter Hausname anschließend über Originaloberfläche bestätigen. Laufversion nur nennen, wenn angezeigt. CO-FTG-0014 und alle eigenen Produkt-/Host-/Bediennachweise bleiben offen. Die Beziehung zwischen Datenkennungen, Orts-Key und Zeitmodell erst aus tatsächlichen Wirkungen planen. Eigener Review/Nachbesserung und separater Aufräumplan/Umsetzung/Review folgen. CITY-01 bleibt nach HEX-05.

## CITY-00-I18-CP: Zugriffsergebnis präzise erhalten

I18-R01: Das Manifest ordnet 03-house dem expliziten Netzwerkfehler und 04-house-retry/05-house-result/06-final-detail dem ungeklärten Ladezustand zu. Historische Rohdateien und Hashes bleiben erhalten; keine behauptete Bewohneransicht, kein zweiter bewiesener Netzwerkfehler. Schutz belegt nur beobachteten Hausnamen, Gebäudeliste, Titel, Zeit und Maßstab; keine unbelegte bytegleiche Geometrie. Keine dritte Wiederholung derselben Detailhypothese. Eigene Produktarchitektur wird aus diesem Zugangsfehler nicht verändert. Getrennte Aufräumumsetzung und Review prüfen Captions, Hashes und offene Fachabnahme; keine native Sitzung.

## CITY-00-I19-P: Watabou-Stilwirkung gegen gleiche Geometrie

HEX-05 ist aktuell nicht übergeben; Kollege verwendet den nativen Slot. CO-WAT-0009 enthält bisher nur ein sichtbares Stilmenü. Eigene Browserkopie der bekannten New-River-URL öffnen; Ausgangsdarstellung und tatsächlich empfangenes JSON sichern. Die sichtbaren Farb-/Stilvorgaben lesen und genau eine vorhandene Vorgabe anwenden. Darstellung, UI-Angaben und eine zweite tatsächliche JSON-Ausgabe sichern; Geometriegruppen und Werte nur aus den ausgegebenen Dateien vergleichen. Bei zusätzlicher Stiloption höchstens eine ausdrücklich gewählte weitere Darstellungsprobe, keine vollständige Variantenbehauptung. Kein interner Appzustand, kein Netzwerkersatzabruf.

Die I16-Metadatenversion0.11.5 gilt nicht automatisch für diesen Lauf; neue Metadaten gesondert lesen. Wenn Originalformat Stildaten nicht enthält, daraus keine fehlende Speicherung folgern. Gleiche URL allein beweist keine Geometriegleichheit. Stiländerung gegebenenfalls über sichtbaren Originalcontrol zurückstellen und Testkopie schließen; vorhandene Originaltabs erhalten. Bei fehlendem Dateiempfang Zugangsgrenze festhalten und zwei Versuche derselben Hypothese nicht überschreiten. Ein Fachreview und getrennte Aufräumplanung/Umsetzung/Review folgen; alle eigenen CITY-07-Produkt-/Host-/Bedienabnahmen bleiben offen.

## CITY-00-I19-CP: Gestaltungsvorgaben ohne Geometrieersatz

I19-R01: CITY-07 plant eine versionierte Gestaltungsvorgabe mit stabiler Kennung, zehn semantischen Farbrollen (Papier, Linien, Dächer, Wasser, Grün, Straßen, Mauern, Bäume, Beschriftung, Elemente), Tönungsmethode/-stärke und Verwitterung. Darstellungsflags wie Vierteltönung bleiben explizite Felder desselben Gestaltungszustands, nicht aus den Farbwerten erraten. Eigene Parameterbereiche werden vor Umsetzung aus Originalwirkungsproben hergeleitet; die Strings20/25 in der Originaldatei beweisen keine Einheit oder Grenzen. Vorgabendatei und Bibliothek verwenden denselben validierten Zustand; eine vollständige Validierung geht Apply voraus. Vorschau bleibt transient, Cancel erhält den gespeicherten Stand, Apply erzeugt einen gemeinsamen Atlasbefehl nur für Gestaltung. Geometrie, Kennungen, Generatorseed, Keys, Personen und Hausbindungen bleiben wertgleich; Renderer/Export lesen denselben Zustand. Save/Load und frischer Prozess benötigen eine eigene Probe.

I19-R02: Empfangene341B JSON-Datei im QA-Lauf zusätzlich unter vivid-colors.json bytegleich zuordnen; historische.txt-Datei, Download und Receipt unverändert erhalten. Manifest nennt Alias/Hash und offene Load-/Tints-/Weathering-/Presetvarianten. Architektur nur in ARCHITECTURE.md ergänzen; hier Prüfplan: Apply/Cancel, History, Save/Neustart, Formatvalidierung und unveränderte Geometrie/Keys/Bindungen. Keine Stadtproduktimplementierung vor HEX-05; eigener Aufräumreview folgt.

## CITY-00-I20-P: COK-History vor Save

Kollege hat den nativen Platz nach NI18 ausdrücklich freigegeben und wartet mit R02-Originalstart auf die Rückgabe. Vier PID/Startzeit-Identitäten aktuell gegen/proc verschwunden geprüft. Neue isolierte COK-Demo-Sitzung über geprüften Starter/Lock; vorherige eigene CITY00-SAVE.mommap bytegleich in frischen QA-Lauf kopieren und Vorlage hashen. Dieselbe Straße auswählen und einen Endpunkt verschieben. Dieses Mal vor Undo und Redo keinerlei Save ausführen: Änderung, Undo und Redo als sichtbare Zustände sichern. Nur erfolgreiche Rücknahme erlaubt Redo-Wirkungsbehauptung. Erst danach tatsächliches Save sichern und Rohwert gegen Ausgangsdatei vergleichen. Ein Save eines Zwischenzustands wird nicht als unbeeinflusste Historyprobe ausgegeben.

Höchstens zwei erfolglose Undo-Versuche der Pre-Save-Hypothese; I17-Post-Save bleibt gestoppt. Wenn keine Rücknahme erscheint, keine Originalfehlfunktion oder unterstützte Operation erfinden. Kein eigenes Produktverhalten aus unbelegter History ableiten. Normaler Exit über Originaloberfläche, Exitcode und Verlust eigener PID/Startkennungen prüfen; Kollegen anschließend Slot ausdrücklich zurückgeben. Eigener Fachreview und getrennte Aufräumplanung/Umsetzung/Review folgen. Demo-/synthetische Eingabegrenzen und HEX-05-Voraussetzung bleiben offen.

## CITY-00-I20-CP: manuelles Save und automatische Sicherung trennen

I20-R01: I20 steht ausschließlich für eine Folge vor dem ersten ausdrücklich betätigten Save. Welcome nennt automatische Sicherungen; eine vor manuellem Save wertgleiche Hauptdatei beweist weder deren Ausbleiben noch fehlende Historywirkung. Manifest/Captions nennen diese Grenze ausdrücklich. Zwischenzustände wurden nur sichtbar erfasst; keine Rohdaten aus einem ungespeicherten Zustand behaupten. I17-Post-Save und I20-vor-manuellem-Save haben je zwei erfolglose Undo-Versuche und bleiben gestoppt. Erneute gleiche Probe erst bei neuen konkreten Originalbelegen zu zugänglicher unterstützter Operation, Historycontrol oder Version; kein wiederholtes Raten von Shortcuts. Gemeinsames eigenes Undo/Redo bleibt Pflicht, kein eingeschränktes Ziel aus Demozugang ableiten.

Aufräumumsetzung ergänzt Scope/Captions und Stoppbedingungen am unveränderten Rohbestand; keine neue native Sitzung oder Produktarchitekturänderung. Eigener Review prüft Hashes, Quellen-/Prozessschutz und weiterhin offene Stadtpflichten. HEX-05 bleibt nächste Produktvoraussetzung.

## CITY-00-I21-P: Landmarke setzen und ausgegebenen Namen prüfen

HEX-05 weiterhin offen, nativer Platz beim Kollegen für R02. GitHub-DNS scheiterte einmal, zweiter begrenzter Fetch und Integration erfolgreich. CO-WAT-0006 enthält bislang nur sichtbares Menü. Neue eigene Browserkopie der bekannten New-River-URL öffnen, Ausgangsbild sichern. Über vorhandenes Add-landmark-Menü einen eindeutig benannten eigenen QA-Ort anlegen; sichtbare Bearbeitungs-/Positionsoptionen und tatsächliche Wirkung sichern. Nur vorhandene Controls bedienen, keine Shortcuts oder internen Datenzugriffe raten. Wenn möglich den eigenen Namen über sichtbare Optionen korrigieren oder verschieben; keine nicht beobachtete Funktion voraussetzen.

Über angebotene Originalausgabe eine tatsächliche Datei empfangen: bevorzugt SVG für ausgegebene Text-/Positionswerte, gegebenenfalls PNG zur visuellen Ausgabe. Empfangenes SVG nur als XML/Text lesen; die bestehende browserseitige lokale SVG-Vorschausperre bleibt unverändert, kein Ersatzrenderer/Umweg. Exportname und semantischer Ortslink sind getrennte Anforderungen; ohne Datenkennung/Dateireferenz keinen persistenten Orts-Key behaupten. Kein FTG-Downloadwiederholversuch, kein COK-Historyretry. Nach Probe eigene Kopie schließen, ursprüngliche Tabs erhalten. Version nur aus tatsächlich sichtbaren/ausgegebenen Metadaten. Eigener Review und Aufräumplanung/Umsetzung/Review folgen, alle eigenen CITY-06-Produkt-/Host-/Bediennachweise offen.


CITY-00-I21-I Ergebnis: Add-landmark-Dialog nimmt `CITY21 Beacon` an. Im anfänglichen Icon-Modus kein Pin identifiziert; das ist kein Fehlfunktionsnachweis. Style → Elements bietet Hidden/Icon/Legend. Legend zeigt den Namen direkt; tatsächlicher Download `/home/aaron/Downloads/new_river (1).svg` (355207 Bytes) enthält einen SVG-text-Knoten mit diesem Namen. Nur XML-Parse, kein Vorschau-Bypass. Position, Korrektur, Entfernen, Save/Reload und stabile Keys offen. Eigene Testkopie geschlossen; Originaltabs erhalten. Belege: `/home/aaron/.cache/dungeon-native-qa/city-plans/city00-i21-landmark-20261009/manifest.json`. Nächster getrennter Lauf I21-R, danach Aufräumen P/I/R.

CITY-00-I21-R Ergebnis: Manifest-Hashes, Download-Bytegleichheit und genau ein SVG-Textknoten unabhängig geprüft. Sichtnachweis `10-visible-legend.jpg` passt zum Namen. Pflichtlücken bleiben explizit offen; keine Produktänderung, keine Abnahme. Ein Aufräumbefund: abgeleiteter Referenzlücken-Snapshot steht noch auf I20/partial und ist aus aktuellem acceptance zu aktualisieren.

CITY-00-I21-CP Plan: Referenzlücken-Snapshot auf I21 und den belegten Legend-/SVG-Namensumfang bringen; acceptance bleibt maßgeblich. Rohbelege/Originaldownloads unverändert erhalten, Manifest-Verweise und alle 63 unabhängigen Pflichten prüfen. Keine neue Architektur aus ungeprüfter Pinposition; kein neues Statussystem. Danach eigener CI-Lauf und unabhängiger CR-Lauf.

CITY-00-I21-CR Ergebnis: Snapshot entspricht I21-Teilverweisen; Manifest-Hashes unverändert, 63 unabhängige Funktionspflichten offen. Aufräumumfang ohne weiteren Befund; keine technische Produktänderung und keine CITY-Freigabe. Nächster Lauf prüft den aktuellen HEX-05-Übergabestand für den Beginn der Stadtimplementierung.


## CITY-00-I22-P: Übergabe- und Startregel gegen aktuelle Quellen prüfen

Start: 2026-10-09T14:12:57.591718+00:00. Fokus: tatsächliche HEX-05-Voraussetzungen und widersprüchliche Stadt-Startformulierungen. Umsetzungslauf liest aktuellen Checkpoint und vorhandene Model-/Session-/Persistenzquellen, dokumentiert konkrete fehlende API-/Hostnachweise außerhalb des Vaults und berichtigt ausschließlich die pauschale CITY-00-Startregel: feste Galerie vor CITY-01, vollständige Detailwirkung spätestens vor zugehörigem Fachpaket, volle Inventur/Parität bleibt vor CITY-09 Pflicht. HEX-05 wird weder ersetzt noch als geliefert bewertet. Bestehende CLP-02-Übergabepflichten unverändert erhalten. Review prüft Originalauftrag, Roadmap und 63 CO-/24 CTY-Pflichten; anschließend getrenntes Aufräumen P/I/R für Verweis-/Fremdwurzelschutz.

CITY-00-I22-I Ergebnis: aktuelle gemeinsame Quellen und Checkpoint belegen keine gelieferte HEX-05-Schnittstelle. Bestehender Renderer/Command und auf Karte plus gleichwurzelige Markdown-Dateien begrenztes Speicherjournal erfüllen die geplante Atlasübergabe nicht. CLP-02 bleibt offen. Pauschale Startregel mit Roadmap/phasenspezifischer Referenzregel konsistent korrigiert; keine Pflicht reduziert und kein Produktstart freigegeben. Quellhashes und fünf Übergabelücken: `/home/aaron/.cache/dungeon-native-qa/city-plans/city00-i22-handoff-20261009/manifest.json`.

CITY-00-I22-R Ergebnis: fünf Übergabelücken korrekt als fehlende Lieferung statt behauptete Original-/Produktfehler geführt. Bestehende CLP-02-Pflichten unverändert; 63 CO- und 24 CTY-Fälle erhalten. Korrigierte Startregel passt zur festen Galerie und Detailproben vor jeweiliger Phase, voller Paritätsabschluss bleibt Pflicht. Kein weiterer Fachbefund. Aufräumen prüft historische Belege und aktuelle Verweise getrennt.

CITY-00-I22-CP Plan: Auditmanifest an benanntem Commit prüfen, seine Quellhashes gegen genau diesen Gitstand statt bewegtes HEAD validieren. Aktuelle Startregel/CLP-02-Verweise und übrige JSON-Wurzeln erhalten; keine historische Referenz löschen, keine künstliche API-Spezifikation oder zusätzliche Statusdatei erzeugen. CI sichert diesen Nachweis, CR prüft ihn unabhängig.

CITY-00-I22-CR Ergebnis: sechs Quellbelege am benannten Basiscommit und unverändertes Manifest bestätigt. CLP-02 und volle Inventur-/Paritätspflichten erhalten. Aufräumumfang ohne Restbefund. Bis HEX-05 weiter direkte Originalpflichten: nächster Planungslauf untersucht Landmarken-Korrektur/Position anhand sichtbar angebotener Controls; kein Persistenzanspruch aus Seed-Neuladen.


## CITY-00-I23-P: Landmarkenposition und Korrektur

Start 2026-10-09T14:16:25.053056+00:00. Neue eigene New-River-Browserkopie; Originalkarten erhalten. Einen eindeutig benannten QA-Ort innerhalb sichtbarer Stadtfläche über Add landmark anlegen. Sichtbare Markierung und angebotene direkte Auswahl-/Kontextaktionen untersuchen; nur tatsächlich angebotene Korrektur/Entfernung durchführen. Bei fehlender Wirkung höchstens zwei Folgen pro Hypothese, keine geratenen Shortcuts. Legend-Darstellung als bekannte Namensanzeige nutzen; tatsächliche SVG-Ausgaben vor/nach Korrektur als XML lesen, ohne lokale SVG-Vorschausperre zu umgehen. Sicht-/Ausgabewirkung getrennt von Speicherung, stabiler ID und eigener Umsetzung führen. Eigene Kopie danach schließen; Review und Aufräumen P/I/R getrennt. Nativer Slot bleibt beim Hex-Kollegen, HEX-05 weiterhin nicht geliefert.

CITY-00-I23-I Ergebnis: QA-Eintrag inline von CITY23 Market zu CITY23 Market Revised korrigiert; Kontext-Delete entfernt ihn. Zwei tatsächliche SVG-Downloads enthalten den korrigierten Namen beziehungsweise keinen CITY23-Text. Position Bottom-right/Auto betrifft gesamten Legendenkasten samt Kompassverteilung, keine belegte räumliche Pinbewegung. Initialer Name nur per Screenshot, kein Vorher-SVG. Legendenplatzierung Auto wiederhergestellt, eigene Kopie geschlossen. Manifest: `/home/aaron/.cache/dungeon-native-qa/city-plans/city00-i23-landmark-edit-20261009/manifest.json`. Geographische Position, Save/Reload, stabile Keys und eigene Umsetzung offen.

CITY-00-I23-R Ergebnis: Rawhashes und empfangene Dateien bestätigt. 03/05/09 zeigen Anlegen/Korrektur/Entfernung, 08 nur Legendenlayout. Kein Vorher-SVG und keine Pin-/Persistenzfreigabe behauptet. 63 CO-/24 CTY-Pflichten erhalten. Ein Aufräumbefund: abgeleiteter Lückensnapshot noch I21; Korrektur/Delete-Teilwirkung darin aktualisieren.

CITY-00-I23-CP Plan: I23-Teilwirkung aus acceptance in den abgeleiteten Snapshot übernehmen; Namenskorrektur/Delete von Legendenlayout und geographischer Position trennen. Rohbelege unverändert hashen und vorhandene Manifest-Verweise prüfen, keine neuen Pflichten/Freigaben/Statusdatenbanken. CI und CR separat.

CITY-00-I23-CR Ergebnis: Snapshot entspricht acceptance-Teilscope, Rohbelege unverändert, 63 CO-/24 CTY-Pflichten erhalten. Eigene Testkopie geschlossen, QA-Eintrag gelöscht und Legendenplatzierung Auto zurückgesetzt. Aufräumen ohne weiteren Befund. Nächste getrennte Originalprobe untersucht Gassen-/Straßennetzdarstellung; Atlasübergabe weiterhin erforderlich.


## CITY-00-I24-P: Gassenanzeige und tatsächliche Geometrieausgabe

Start 2026-10-09T14:22:26.418895+00:00. Eigene New-River-Browserkopie und Ausgangsbild; Show alleys unter Style/Misc vor jeder Änderung lesen. Tatsächliche JSON-Ausgabe vor und nach Aktivieren dieser angebotenen Anzeige empfangen, Dateien anhand Parser/Hashes und vollständigem Wertevergleich untersuchen. Sichtbare Gassenwirkung getrennt von topologischer Straßenbearbeitung behandeln; unveränderte Ausgabe wäre kein Nachweis persistenter Gassenobjekte. Keine internen Appdaten/Netzabrufe; bei fehlender Wirkung höchstens zwei Versuche. Ausgangsflag über sichtbares Control zurücksetzen und eigene Kopie schließen. Originaltabs erhalten, nativer Slot bleibt beim Kollegen; HEX-05 fehlt aktuell. Danach getrennter Review und Aufräumen P/I/R, alle Produktpflichten offen.

CITY-00-I24-I Ergebnis: Show alleys off/on/off direkt bestätigt. Tatsächliche JSON-Dateien 298842/320806 Bytes; nur roads geändert, 3→74 LineStrings, ursprüngliche3 enthalten, übrige13 Gruppen wertgleich. 71 zusätzliche Linien sind Ausgabeumfang, keine belegte interne Save-/Topologie-/ID-Wirkung. Eigene Kopie geschlossen, Ausgangsflag zurückgesetzt. Manifest `/home/aaron/.cache/dungeon-native-qa/city-plans/city00-i24-alleys-20261009/manifest.json`; eigene Implementierung/Host/Bedienung offen.

CITY-00-I24-R Ergebnis: Rohhashes, echte Downloadkopien und vollständiger Vergleich aller14 Gruppen bestätigt. Nur roads geändert; kein interner Zustand aus Dateieffekt abgeleitet. Off/on/off-Flags gesichert, räumliche Bearbeitung und Speicherung ausdrücklich offen. Aufräumbefund: abgeleiteter Lückensnapshot noch I23/partial für CO-WAT-0003; anhand acceptance aktualisieren.

CITY-00-I24-CP Plan: versionierten Snapshot auf I24/Gassenflag-Ausgabe bringen, sämtliche früheren Teilbelege erhalten. Rawhashes und Verweisziel prüfen, 63 CO-/24 CTY-Pflichten und fremde JSON-Wurzeln unverändert halten. Keine interne Geometrieänderung aus Export behaupten und keinen neuen Export-/Stadtspeicher erzeugen. CI/CR getrennt.

CITY-00-I24-CR Ergebnis: Snapshot/Manifest-Verweise stimmen, Rohbelege unverändert, 63 CO-/24 CTY-Pflichten erhalten. Ausgangsflag off wiederhergestellt und Testkopie geschlossen; Aufräumumfang ohne Restbefund. Aktueller Hex-Kollegenlauf weiter inProgress/R02, keine HEX-05-Lieferung. Nächste eigene Referenzplanung: Bäume/Umgebung und tatsächliche ausgegebene Geometrie, keine neue native Sitzung.


## CITY-00-I25-P: Baum-/Umgebungsdarstellung und ausgegebene Geometrie

Start 2026-10-09T14:27:52.797617+00:00. Eigene New-River-Browserkopie öffnen und Ausgangsflag Show trees/Show forests lesen. Tatsächliche JSON-Datei vor/nach genau einer angebotenen Baumdarstellungsänderung empfangen und vollständig vergleichen; sichtbare Wirkung samt Flag sichern. Deaktiviertes Show forests bleibt Zugangslücke, nicht als fehlende Originalfähigkeit ausgeben. Weitere angebotene Umgebungsparameter nur lesen, keine unkontrollierte Neugeneration oder dritte Wiederholung. Ausgabepunkte/-werte sind kein Nachweis stabiler Baumobjekte oder bearbeiteter Save-Datei. Ausgangsflag sichtbar zurücksetzen, eigene Kopie schließen, Originaltabs erhalten. Nativer Slot bleibt beim Hex-Kollegen; aktueller Livehandle inProgress, HEX-05 noch nicht geliefert. Review und Aufräumen P/I/R separat.

CITY-00-I25-I Ergebnis: Show trees off/on/off, sichtbare Baumkronen und tatsächliche JSON-Dateien 298842/299585 Bytes. Nur trees geändert, 0→13 Punkte; andere13 Gruppen wertgleich. Show forests zunächst deaktiviert, nach Show trees bedienbar; daher keine fortbestehende Zugangssperre behaupten, eigentliche Waldwirkung noch offen. Exportmetadata0.11.5 ist keine bestätigte UI-Laufversion. Ausgangsflag zurückgesetzt, eigene Kopie geschlossen. Manifest `/home/aaron/.cache/dungeon-native-qa/city-plans/city00-i25-trees-20261009/manifest.json`; eigene Implementierung/Host/Bedienung offen.

CITY-00-I25-R Ergebnis: tatsächliche Downloadkopien, Rawhashes und Vergleich aller14 Gruppen bestätigt. 02/03 belegen Forest-Aktivierung nach Show trees; keine aktuelle Zugangssperre oder Waldwirkungsabnahme behauptet. UI-Version und Save/Einzelobjekt-IDs offen. Aufräumbefund: CO-WAT-0004 im abgeleiteten Snapshot noch Dokumentationsumfang; anhand acceptance aktualisieren.

CITY-00-I25-CP Plan: Snapshot auf direkten Baum-/JSON-Nachweis aktualisieren; Forest-Controlabhängigkeit als Zugang, noch keine Wirkung markieren. Originalquelle und historische Belege erhalten, Rohhashes/Verweise und alle63 CO-/24 CTY-Pflichten prüfen. Keine neue Architektur-/Statusquelle; CI/CR separat.

CITY-00-I25-CR Ergebnis: Snapshot/Manifest-Verweise stimmen, Rohbelege unverändert, 63 CO-/24 CTY-Pflichten erhalten. Ausgangsflag off wiederhergestellt und eigene Kopie geschlossen; Aufräumumfang ohne Restbefund. Nativer Slot ausdrücklich vom Hex-Kollegen nach abgeschlossenen Original-/Hostprozessen zurückgegeben. Nächster Lauf plant neue COK-Objektauswahl/Gruppierungsprobe; keine Wiederholung gestoppter Undo-Hypothesen. Forest-Wirkungsprobe bleibt offen.


Der nächste neue Variantenvergleich folgt dem [COK-Variantenplan](ROADMAP-CITIES-CITY00-COK-VARIANTS-PLAN.md); frühere gestoppte Undo-Hypothesen bleiben gestoppt.

## CITY-00-I26-P: COK-Objektauswahl/Gruppierung

Start 2026-10-09T14:33:28.417478+00:00. Nativer Slot ausdrücklich vom Hex-Kollegen freigegeben. Vor Start Prozess-/Lockgrenzen über geprüften COK-Starter validieren; private Sitzung auf Basis tatsächlich installierter Demo, keine Vollversionsfreigabe. Eigene gespeicherte CITY00-Vorlage bytegleich kopieren und Originalhash sichern. Sichtbare Object-/Select-/Gruppencontrols lesen; höchstens zwei erfolglose Folgen pro Hypothese. Falls angeboten zwei eigene Props auswählen/zusammen bewegen, vor/nach sichtbare Wirkung und tatsächliche eigene Kartendatei sichern. Keine geratenen Gruppierungsshortcuts und keine Wiederholung der gestoppten Undo-Hypothesen. Nicht verfügbare Demo-/Gruppenfunktion bleibt Zugangslücke, keine Originalfehlfunktion behaupten. Normales Exit0 plus verschwundene PID/Startzeit-Identitäten aller eigenen Prozesse prüfen, erst dann nativen Slot zurückgeben. Eigener Review und Aufräumen P/I/R folgen; alle Produkt-/Host-/physischen Bedienpflichten offen.

CITY-00-I26-I Ergebnis: Eigene Hütte und Stumpf platziert; nur Hütte verschoben. Tatsächliche Saves ändern ausschließlich objects, Stumpf unverändert. Auto Combine vorhanden; geeigneter erhöhter Träger noch ungeprüft. Groups ist eigenständige Layer-Sicht-/Sperrfunktion und in Demo nicht verfügbar: zusätzliche Pflicht CO-COK-0012 für CITY-07, bestehende IDs erhalten. Geplante Umsetzung nutzt stabile Gruppenzuordnung und gemeinsame Atlas-Auswahl-/Sicht-/Sperrprojektion; keine zweite Kamera/History. Persistenz, Undo/Redo und gesperrte Trefferprüfung separat abnehmen. Nun 64 CO-/24 CTY-Pflichten offen. Manifest `/home/aaron/.cache/dungeon-native-qa/city-plans/city00-cok-i26-20261009-r01/manifest.json`. Normal Exit0, alle fünf Prozessidentitäten verschwunden, GUI-Platz sofort zurückgegeben. Setup-/Keyargumentfehler und zwei unzutreffende Screenshotnamen im Manifest berichtigt.

CITY-00-I26-R Start 2026-10-09T14:52:53.471490+00:00; Ergebnis: sämtliche Manifesthashes, beide tatsächlichen Saves, nur Hütte veränderte Position und unveränderten Stumpf geprüft. Objektkombination von Layer-Sicht/Sperre getrennt; kein Vollversions-, Gruppenbewegungs- oder Produktnachweis behauptet. 64 eindeutige CO-/24 CTY-Pflichten offen, fremde JSON-Wurzeln erhalten. Aufräumbefund: abgeleiteter Snapshot noch I25/63; auf I26 und neue Layerpflicht aktualisieren.

CITY-00-I26-CP Start 2026-10-09T14:53:12.962042+00:00; Plan: abgeleiteten Snapshot auf I26 aktualisieren. CO-COK-0003 als bodengleichen Versuch ohne gemeinsame Bewegung und CO-COK-0012 als Demo-gesperrte Layerfunktion getrennt führen. Aktuelle Anzahl64 von historischen63-Angaben unterscheiden, stabile Kennungen/alte Belege erhalten. Manifesthashes und vorhandene Verweisziele erneut prüfen, keine zusätzlichen Originalstarts oder neue Statusdateien. CI und CR separat.

CITY-00-I26-CI Start 2026-10-09T14:53:41.596934+00:00; Ergebnis: Snapshot aus acceptance auf64 Pflichten und getrennte CO-COK-0003/0012 aktualisiert. Keine Rawdatei oder historische Kennung verändert; Originalwirkung und sämtliche Produktabnahmen bleiben offen.

CITY-00-I26-CR Start 2026-10-09T14:54:14.332536+00:00; Ergebnis: Snapshot und acceptance stimmen für beide unabhängigen Fähigkeiten überein,64 CO-/24 CTY-Pflichten offen. Alle Manifesthashes und Inventarbelegziele geprüft; fremde JSON-Wurzeln erhalten. Keine verbleibende Lücke im Aufräumumfang. Normaler Prozessabschluss und GUI-Rückgabe verifiziert; eigener Stadtproduktcode wartet auf HEX-05. Nächste getrennte Planung untersucht angebotene Waldwirkung im Browser ohne native Sitzung.

## CITY-00-I27-P: Waldwirkung und reale Geometrieausgabe

Start 2026-10-09T14:54:59.446908+00:00. Eigene New-River-Kopie, aktuelle Show-trees/Show-forests-Flags lesen. Bekannten Zugang über Show trees aktivieren, echte JSON-Ausgabe bei Forest off/on empfangen und alle14 Gruppen vergleichen. Waldwirkung visuell und Dateiumfang getrennt sichern; keine internen Appdaten lesen. Bei fehlender Wirkung höchstens zwei Versuche. Beide eigenen Flags auf Ausgangswert zurücksetzen und eigene Kopie schließen; Originaltabs erhalten. Nativer Slot bleibt beim Kollegen. Separate I/R und Aufräumen P/I/R; CITY-01 weiterhin erst nach HEX-05.

CITY-00-I27-I Start 2026-10-09T14:58:03.394252+00:00; Ergebnis: Show trees aktiviert Show forests. Forest off/on/off verändert sichtbar zusammenhängende Außenwaldflächen. Tatsächliche JSON-Dateien beide299585 Bytes und bytegleich; alle14 Gruppen einschließlich trees13 identisch. Keine separate Waldgeometrieausgabe durch dieses Flag belegt. Exportmetadata0.11.5 ist keine bestätigte UI-Laufversion. Beide Flags off wiederhergestellt, eigene Kopie geschlossen. Manifest `/home/aaron/.cache/dungeon-native-qa/city-plans/city00-i27-forest-20261009/manifest.json`. Volle Parität und eigener Produktstand offen.

CITY-00-I27-R Start 2026-10-09T14:58:28.205444+00:00; Ergebnis: tatsächliche Downloadkopien, alle Rawhashes und Bytegleichheit der14 Exportgruppen geprüft. Screens03/04/05 zeigen Forest-Zugang und Flächenwirkung,06/07 Rücksetzung. Keine persistente Waldgeometrie aus Darstellung behauptet. Aufräumbefund: abgeleiteter Snapshot enthält noch allein Waldzugang ausI25; Waldwirkung und unveränderte Ausgabe ergänzen.

CITY-00-I27-CP Start 2026-10-09T14:58:45.971880+00:00; Plan: CO-WAT-0004 im abgeleiteten Snapshot um beobachtete Waldflächen und bytegleiche JSON-Ausgabe ergänzen. Frühere Baumdaten und offene Waldkonturbearbeitung/Persistenz erhalten. Rawhashes, vorhandene Belegziele,64 CO-/24 CTY-Pflichten und fremde JSON-Wurzeln kontrollieren. Keine neue Statusquelle oder Architekturbehauptung aus Original-Export ableiten. CI/CR separat.

CITY-00-I27-CI Start 2026-10-09T14:59:17.271931+00:00; Ergebnis: CO-WAT-0004-Snapshot enthält Waldwirkung und bytegleiche Ausgabe, frühere Baumwirkung erhalten. Keine persistente Waldgeometrie oder eigene Produktfreigabe behauptet.

CITY-00-I27-CR Start 2026-10-09T14:59:46.504135+00:00; Ergebnis: Snapshot/acceptance stimmen, Rohhashes und Manifestziele vorhanden,64 CO-/24 CTY-Pflichten erhalten. Flags wiederhergestellt, eigene Browserkopie geschlossen; Aufräumumfang ohne weiteren Befund. Kollege bestätigt Kern19d Save/Frischstart und hält nativen Slot für aktuellen Renderer-Kern und HEX-01. Nächste eigene getrennte Referenzplanung: Dächer/Vierteldarstellung, keine Wiederholung der gestoppten Undo-/Export-/Resident-Hypothesen.

## CITY-00-I28-P: Dachdetails und Vierteldarstellung

Start 2026-10-09T15:00:29.782588+00:00. Eigene New-River-Kopie öffnen; aktuelle sichtbare Buildings-/Graphics-/Elements-Vorgaben lesen. Je eine angebotene Dachdetail- und Vierteländerung mit vor/nach Screenshot prüfen; nur sichtbare Optionen verwenden. Eigene Flags/Parameter zurücksetzen, eigene Kopie schließen und Originaltabs erhalten. Keine interne Appgeometrie oder Persistenz aus Darstellung ableiten. Zwei erfolglose Versuche je Hypothese maximal; nur tatsächlich beobachtete Wirkung dokumentieren. Nativer Slot beim Hex-Kollegen. Danach I/R und Aufräumen P/I/R getrennt.

CITY-00-I28-I Ergebnis: Roofs Plain→Gable→Plain zeigt zusätzliche Dachfirst-/Teilflächenlinien. Display mode Lots→Block→Lots zeigt zusammengefasste Flächen statt Einzelgebäuden. Sichtbare Optionen Roofs Plain/Hip/Gable und Display Block/Lots/Complex/Hidden; Hip/Complex/Hidden-Wirkungen ungeprüft. Processing Offset und Raised/Solids unverändert. Keine Geometrie-/Save-/Exportwirkung geprüft. Eigene Vorgaben zurückgesetzt, Testkopie geschlossen. Manifest `/home/aaron/.cache/dungeon-native-qa/city-plans/city00-i28-roof-20261009/manifest.json`. CITY-07 plant Dach-/Aggregationsprojektionen auf gemeinsamer materialisierter Geometrie; jede Einzelgeometrie bleibt im selben Atlas bearbeitbar. Ein Darstellungsflag erzeugt keinen Editor-/Kontextwechsel. Full-Optionswirkung und eigener Produktvergleich bleiben offen.

CITY-00-I28-R Start 2026-10-09T15:03:37.480848+00:00; Neun Rawhashes und sichtbare Wirkung04/07 geprüft; Controls08 bestätigen Lots/Plain/Offset und unveränderte Raised/Solids. Blockdarstellung ist keine zusätzliche geographische Viertelbearbeitung. Andere Vorgaben und Save/Export ausdrücklich ungeprüft. Aufräumbefund: CO-WAT-0002-Snapshot noch unspezifisch partial.

CITY-00-I28-CP Start 2026-10-09T15:03:50.802170+00:00; Plan: Snapshot anhand acceptance um Gable-/Block-Teilwirkung ergänzen; Blockdarstellung von eigenständiger Vierteltopologie trennen. Historische I03-/I19-Belege erhalten, sämtliche Rawhashes/Verweise und64/24 offene Pflichten prüfen. CI/CR separat.

CITY-00-I28-CI Start 2026-10-09T15:04:03.424384+00:00; Snapshot auf I28, Gable-/Block-Sichtwirkung und offene weitere Vorgaben/Einzelbearbeitung/Persistenz aktualisiert; keine Rawdatei oder fremde Wurzel verändert.

CITY-00-I28-CR Start 2026-10-09T15:04:23.971472+00:00; Snapshot und acceptance stimmen, neun Rawhashes und alle Inventarbelegziele geprüft;64 CO-/24 CTY-Pflichten offen. Lots/Plain zurückgesetzt, eigene Kopie geschlossen. Aufräumumfang ohne Restbefund. Eigener Stadtproduktstart weiterhin nach HEX-05; nächste Teilprobe der übrigen angebotenen Gebäudedarstellungen gesondert planen.

## CITY-00-I29-P: weitere Dach-/Gebäudedarstellungen

Start 2026-10-09T15:05:16.163755+00:00. Eigene New-River-Kopie, aktuelle Ausgangsvorgaben lesen. Bekannte angebotene Roofs Hip und Display Complex/Hidden einzeln ändern, nach jeder Änderung Wirkungsbild sichern und Lots/Plain zurücksetzen. Angebotene Processing-Optionen nur lesen, Wirkung in eigenem Folgeumfang. Keine Geometrie-/Savewirkung oder stabile IDs aus Grafik ableiten. Bei unverändertem Ergebnis maximal zwei Versuche; keine geratenen Controls. Eigene Kopie schließen, Originaltabs erhalten, nativer Slot beim Hex-Kollegen. Anschließend getrennt Review und Aufräumen P/I/R.

CITY-00-I29-I Ergebnis: Hip zeigt zusätzliche diagonale Dachflächenlinien. Hidden blendet gewöhnliche Gebäude aus, Mauern/Fluss/Küste/Straßen und markante dunkle Gebäude bleiben sichtbar. Complex ausgewählt: zwei Beobachtungen zeigen nur Beschriftung/Grid/Kompass statt Kartenflächen; nach Lots-Rücksetzung Karte wieder sichtbar. Keine brauchbare Complex-Gebäudewirkung oder Originalursache belegt. Processing None/Offset als Optionen gelesen, Offset unverändert. Lots/Plain wiederhergestellt, eigene Testkopie geschlossen. Manifest `/home/aaron/.cache/dungeon-native-qa/city-plans/city00-i29-building-20261009/manifest.json`. Fehlende Complex-Kartenflächen bleiben ungeklärte Originalbeobachtung; keine reduzierte Complex-Anforderung oder persistente Löschung daraus ableiten.

CITY-00-I29-R Start 2026-10-09T15:09:20.895270+00:00; 15 Rawhashes und Controls14 gelesen; Lots/Plain/Offset/Raised/Solids entsprechen Ausgangsbild02. Hip/Hidden sichtbar, Complex nur ungeklärte fehlende Kartenflächen mit erfolgreicher Lots-Rücksetzung; zwei Beobachtungen sind kein bewiesener terminaler Fehler. Dateigeometrie und Löschung nicht behauptet. Aufräumbefund: Snapshot führt Hip/Complex/Hidden pauschal als ungeprüft.

CITY-00-I29-CP Start 2026-10-09T15:09:33.330639+00:00; Plan: Snapshot auf belegtes Hip/Hidden und ungeklärtes Complex differenzieren. Complex-Funktionspflicht nicht entfernen oder durch fehlende Kartenflächen ersetzen. Historische Belege erhalten;15 Rawhashes und64/24 offene Pflichten nachprüfen. CI/CR getrennt.

CITY-00-I29-CI Start 2026-10-09T15:09:50.045310+00:00; Snapshot enthält Hip/Hidden-Sichtwirkung und konkrete Complex-Teilbeobachtung; Processing/Raised/Solids und Persistenz offen. Alte Belege und IDs erhalten.

CITY-00-I29-CR Start 2026-10-09T15:10:06.384271+00:00; Snapshot/acceptance stimmen;15 Rawhashes und alle Inventarbelegziele geprüft,64 CO-/24 CTY-Pflichten offen. Eigene Vorgaben zurückgesetzt, Testkopie geschlossen. Aufräumumfang ohne Restbefund. Nächste begrenzte Referenzplanung Processing/Raised/Solids, während HEX-05-Handoff verfolgt wird.

## CITY-00-I30-P: Processing, Raised und Solids

Start 2026-10-09T15:10:57.743395+00:00. Eigene New-River-Kopie; aktuelle Lots/Plain/Offset/Raised/Solids ablesen. Processing Offset→None→Offset, Raised on→off→on und Solids on→off→on getrennt mit sichtbarem Vorher-/Nachherbild prüfen. Tatsächlicher Ausgangswert entscheidet Rücksetzung, kein geratener Shortcut. Höchstens zwei Versuche bei ausbleibender Wirkung. Keine Geometrie-/Save-/Persistenzbehauptung aus Darstellung; kein erneuter Complex-Versuch. Eigene Flags/Vorgaben zurücksetzen, eigene Kopie schließen, Originaltabs erhalten. Nativer Slot beim Hex-Kollegen. I/R und Aufräumen P/I/R separat; Stadtprodukt nach HEX-05.

CITY-00-I30-I Ergebnis: Processing Offset→None→Offset verändert angezeigte Gebäudeformen/Abstände. Raised on→off→on reduziert betonte versetzte Gebäudekanten. Solids on→off→on ersetzt dunkle Füllungen markanter Gebäude durch helle Darstellung. Lots/Plain unverändert; keine Geometrie-/Export-/Speicherwirkung geprüft. Eigene Vorgaben zurückgesetzt und Testkopie geschlossen; Manifest `/home/aaron/.cache/dungeon-native-qa/city-plans/city00-i30-processing-20261009/manifest.json`. Processing zeigt Formenwirkung, deren materialisierte Geometrie/ID-Erhalt und echter Dateiumfang noch zu prüfen sind. Keine Höheneinheit oder gespeicherte Extrusion aus Raised ableiten.

CITY-00-I30-R Start 2026-10-09T15:14:08.660483+00:00; Zehn Rawhashes, getrennte Controls03/05/07 und Rücksetzung09 geprüft. Sichtwirkung04/06/08 belegt; keine Processing-Dateigeometrie, Höheneinheiten, Extrusion oder Persistenz behauptet. Aufräumbefund: Snapshot führt Processing/Raised/Solids weiterhin pauschal offen.

CITY-00-I30-CP Start 2026-10-09T15:14:35.119600+00:00; Plan: CO-WAT-0002-Snapshot um drei visuelle Teilwirkungen ergänzen; Dateigeometrie/IDs/Persistenz weiterhin offen. Complex-Beobachtung und alle historischen Belege erhalten;10 Rawhashes, Verweisziele und64/24 offene Pflichten prüfen. CI/CR getrennt.

CITY-00-I30-CI Start 2026-10-09T15:14:47.857614+00:00; Snapshot enthält Processing/Raised/Solids-Sichtwirkung und getrennte Dateigeometrie-/Persistenzlücke; historische Belege und Complex-Grenze erhalten.

CITY-00-I30-CR Start 2026-10-09T15:15:05.214804+00:00; Snapshot und acceptance stimmen;10 Rawhashes und alle Belegziele geprüft.64 CO-/24 CTY-Pflichten erhalten, eigene Vorgaben zurückgesetzt und Kopie geschlossen. Aufräumumfang ohne Restbefund. Nächste Originalprobe plant tatsächliche Processing-Ausgabe vor/nach, keine weitere Complex-Wiederholung.

## CITY-00-I31-P: tatsächliche Processing-Ausgabe

Start 2026-10-09T15:15:56.893932+00:00. Eigene New-River-Kopie und aktuelle Lots/Plain/Offset/Flags ablesen. Echte JSON-Ausgaben bei Processing Offset und None über sichtbares Originalexportmenü empfangen und bytegleich in externen QA-Root kopieren. Vollständige Vergleichsmenge aller14 Gruppen, Anzahl/Geometrietypen und etwaige zusätzliche Kennungen prüfen; Wertgleichheit von nicht veränderten Gruppen belegen. Keine internen Appdaten lesen, keine Save-/ID-Erhaltung aus Export ableiten. Processing über Originalcontrol zurücksetzen, eigene Kopie schließen, Originaltabs erhalten. Höchstens zwei fehlgeschlagene Versuche; kein Complex-Versuch. Anschließend getrennt Review und Aufräumen P/I/R.

CITY-00-I31-I Ergebnis: Processing Offset/None: tatsächliche JSON298842/293445 Bytes; nur buildings geändert, MultiPolygon669→651. Andere13 Gruppen wertgleich; gleiche Gruppenkennung buildings ist kein Beleg stabiler Einzelobjekt-IDs. Exportversion0.11.5 keine bestätigte UI-Version. Eigener Processing-Wert zurückgesetzt, Testkopie geschlossen. Manifest `/home/aaron/.cache/dungeon-native-qa/city-plans/city00-i31-processing-output-20261009/manifest.json`. Interne Neugeneration nicht aus ausgegebenen Polygonen behaupten. Eigene CITY-07-Anwendung muss Kennungen/Orts-/Dungeonbindungen und manuelle Korrekturen unabhängig vom Rendering oder konstruierten Ausgabepolygonen erhalten; History/Persistenzprüfung weiterhin erforderlich.

CITY-00-I31-R Start 2026-10-09T15:19:32.364268+00:00; Tatsächliche Downloadkopien und alle Rawhashes bestätigt. Vollständiger14-Gruppenvergleich: buildings MultiPolygon669→651, andere13 wertgleich, übrige Rootwerte gleich. Keine interne Mutation, Neugeneration oder stabile Einzelobjekt-ID aus Export abgeleitet. Aufräumbefund: Snapshot nennt Processing-Dateigeometrie pauschal offen statt direkten Ausgabeteilbeleg.

CITY-00-I31-CP Start 2026-10-09T15:22:24.093531+00:00; Plan: Snapshot mit Processing-Ausgabe669→651 ergänzen und interne Mutation/ID-/Savewirkung weiterhin offen führen. Frühere Sichtbelege erhalten; Rawhashes/Verweise und64/24 offene Pflichten prüfen. CI/CR getrennt.

CITY-00-I31-CI Start 2026-10-09T15:22:35.068212+00:00; Snapshot enthält echte buildings-Ausgabewirkung669→651 sowie interne Geometrie-/ID-/Savegrenze; frühere Darstellungsbelege und Complex-Beobachtung erhalten.

CITY-00-I31-CR Start 2026-10-09T15:22:47.637875+00:00; Snapshot und acceptance stimmen, echte Downloadkopien/Rawhashes und sämtliche Inventarbelegziele geprüft;64 CO-/24 CTY-Pflichten offen. Eigener Wert wiederhergestellt und Kopie geschlossen. Aufräumumfang ohne Restbefund. Nächste Referenzplanung prüft frühe Generationsvorgaben auf eigener Karte; HEX-05-Handoff bleibt Voraussetzung für Stadtproduktstart.


CITY-00-I32-P Start 2026-10-09T15:23:32.148278+00:00; Fokus: frühe Generationsvorgaben statt weiterer Dachgestaltung. Eigene Kopie der bekannten New-River-URL mit Seed540139574/size25 und expliziten Features öffnen. Ausgangsbild und echte JSON-Datei sichern. Sichtbares Generate-/Settlement-Menü lesen; nur tatsächlich angebotene Grün-/Platz-/Mauer-Vorgabe gezielt ändern, Vorher/Nachher mit sichtbaren Controls, Karte und echter JSON-Ausgabe sichern. Alle14 Gruppen vergleichen; einen Generationswechsel nicht als lokale Erhaltung oder stabile Einzelobjekt-IDs werten. Keine bestehenden Referenzkarten oder FTG-Siedlung ändern. Eigene Kopie schließen, geteilte Anzeigevorgaben erhalten. Technischen CITY-02-Plan anhand tatsächlich belegter Wirkung präzisieren. I/R und CP/CI/CR getrennt; HEX-05 weiterhin Voraussetzung für Produktstart.

CITY-00-I32-I Start 2026-10-09T15:26:24.460939+00:00; Ergebnis: eigene URL-Karte New River und tatsächlicher Ausgangsexport gesichert. Generate zeigt River/Coast/Inner castle aus trotz URL-Werten1; Kontroll-Rebuild liefert Candlebloom mit URL-Werten0. Danach allein Greens aktiviert und Rebuild: Misthill, URL ausschließlich greens0→1 bei Seed540139574/size25 unverändert. Vollständiger13-Gruppenvergleich der zwei Kontrollausgaben: buildings499→544, fields4→7, districts7→8; andere10 wertgleich, greens0→0. Keine erfolgreiche Grünflächenwirkung oder stabile Einzelobjekterhaltung behauptet. Drei echte Downloads, neun Bilder, Vergleich und Rawhashmanifest extern gesichert. Greens-Control auf ursprünglichen Wert aus zurückgesetzt; eigene Kopie geschlossen, bestehende Referenzen erhalten.

CITY-02-Präzisierung aus I32: Generationsformular initialisiert sich aus den versionierten Vorgaben der aktuellen Stadt; Entwurf und materialisierte Karte sind ausdrücklich getrennte Zustände. Ein Vorschauauftrag erhält vollständige explizite Featurewerte samt Seed/Version statt versteckter globaler Defaults. Vor Apply werden geänderte Straßen, Viertel, Gebäude und Grünflächen mit ihrem tatsächlichen Ersatzumfang sichtbar; Cancel erhält Karte/Vorgaben/History. Grünflächen-Absicht darf nicht stillschweigend als erreichte Geometrie gelten: Vorschau zeigt tatsächlich entstandene Flächen und erklärt unerfüllte Vorgaben. Lokale Neugeneration schützt IDs/manuelle Eingriffe/Bindings gemäß bestehender Architektur; Original-I32 beweist diese Erhaltung nicht. Eigene Implementierung und Hostabnahme offen.

CITY-00-I32-R Start 2026-10-09T15:27:12.598540+00:00; Drei tatsächliche Downloadkopien und sämtliche Rawhashes bestätigt. Kontroll-Rebuild und Greens-Rebuild haben13 Gruppen, nicht14 wie ursprüngliche Küstenkarte. Nur buildings/fields/districts geändert; greens leer/wertgleich. Sichtbare Controls08 wieder aus, eigene Kopie geschlossen. Rebuild ist keine lokale Erhaltungsabnahme. Aufräumbefund: Snapshot CO-WAT-0001 noch unspezifisch partial.

CITY-00-I32-CP Start 2026-10-09T15:27:23.327234+00:00; Plan: abgeleiteten CO-WAT-0001-Snapshot mit kontrolliertem Rebuild-Umfang und leerer Greens-Gruppe ergänzen. Belege unverändert erhalten;13-Gruppenvergleich, Downloadkopien, Hashes,64/24 offene Pflichten und fremde JSON-Wurzeln prüfen. Keine eigene Umsetzung aus Originalprobe ableiten.

CITY-00-I32-CI Start 2026-10-09T15:27:34.360443+00:00; Snapshot auf I32 aktualisiert: ursprüngliche URL/Control-Differenz, Greens-Rebuild und leere Greens-Gruppe mit präziser Vergleichsgrenze dokumentiert.

CITY-00-I32-CR Start 2026-10-09T15:27:47.781532+00:00; Snapshot, acceptance und technische CITY-02-Präzisierung stimmen; Rawhashes, tatsächliche Downloadkopien und Inventarbelegziele bestätigt.64 CO-/24 CTY-Pflichten weiterhin offen. Aufräumumfang ohne Restbefund. Als nächstes frühe Roads-Generationsvorgaben direkt prüfen; HEX-05-Vertrag vor Produktstart.


CITY-00-I33-P Start 2026-10-09T15:28:38.930506+00:00; Fokus: kontrollierte Straßen-/Torvorgaben für CITY-02/CITY-05. Eigene bekannte New-River-URL öffnen; sichtbare Generate/Roads-Controls samt Werten und tatsächlichen Optionen lesen. Vor einem Wertewechsel Kontroll-Rebuild aus sichtbaren Features durchführen und aktuelle URL, Bild sowie echte JSON-Datei sichern (I32 zeigte URL/Formular-Differenz). Danach genau eine angebotene Tor-/Straßenzahl gezielt ändern, Rebuild durchführen, aktuelle URL/Bild/JSON sichern und sämtliche vorhandenen Ausgabegruppen vergleichen. Keine direkte Einzelstraßenbearbeitung oder intern stabile IDs aus Rebuild ableiten. Wenn Wertewahl nicht zugänglich ist, Zugang/konkrete Grenze dokumentieren; höchstens zwei erfolglose Versuche derselben Hypothese. Originale Referenzkarten erhalten; anfängliche geteilte Generationsvorgaben wiederherstellen, eigene Kopie schließen. Umsetzung, Review und Aufräum-P/I/R getrennt. HEX-05-Übergabe vor Produktstart bleibt offen.

CITY-00-I33-I Start 2026-10-09T15:31:15.126984+00:00; Ergebnis: Roads bietet Default number/Maximum number/Number. Eigener Kontroll-Rebuild Default, Number3 und Default zurück bei Seed540139574/size25: URL nur gates=-1→3→-1. Wirkungsvergleich13 Gruppen: roads5→4, walls geändert bei2 Geometrien, buildings544→528, fields7→8, districts8→7, übrige8 wertgleich. Wiederherstellungsdatei bytegleich zur Kontrollausgabe. Straßenlinienzahl ist nicht Torzahl; genaue Torzählung und Maximum-Wirkung ungeprüft. Number-Feld3 bleibt unter inaktivem Radiobutton erhalten; effektiver Default durch Rebuild angewendet. Zehn Bilder, drei echte Downloadkopien, Vergleich und Rawhashmanifest extern gesichert. Eigene Kopie geschlossen; bestehende Referenzkarten erhalten.

CITY-02/CITY-05-Präzisierung aus I33: Außenanschluss-/Torvorgabe als typisierte Wahl auto, maximal oder explizite Anzahl speichern; numerische Anzahl nicht mit gesamter Straßenlinienzahl verwechseln. Straßenenden verweisen bei Mauern auf tatsächliche Tor-Elemente; innere Straßenknoten und regionale Anschlussanker bleiben getrennte Entitäten mit stabilen Kennungen. Generatorvorschau zählt erreichte Außenanschlüsse und zeigt unerfüllte Vorgaben, ohne manuelle Bindungen zu ersetzen. Parameterbereich/Maximalregel vor Umsetzung weiter direkt klären. Semantikänderung betrifft Straße, Mauern und angrenzende Bebauung im gemeinsamen atomaren History-Befehl; I33-Rebuild beweist keine lokale ID-/Bindingerhaltung.

CITY-00-I33-R Start 2026-10-09T15:31:59.274072+00:00; Drei echte Downloadkopien, sämtliche Rawhashes und13-Gruppenvergleich bestätigt; Default-Rebuild-Wiederherstellung bytegleich. Maximum nur sichtbarer Control, genaue Torzählung offen. Aufräumbefunde: CO-WAT-0010-Snapshot partial; I32-OFF-Rückstellung nur ausstehender UI-Wert, I33-Neutab zeigt GreensON. Keine dauerhafte globale Wiederherstellung aus I32 ableiten.

CITY-00-I33-CP Start 2026-10-09T15:32:10.337178+00:00; Plan: CO-WAT-0010-Snapshot um Number3 und tatsächliche bytegleiche Default-Rückstellung ergänzen. I32-Restaurationsgrenze in acceptance/Plan ausdrücklich präzisieren und mit I33 belegen, unveränderte historische Rawdateien erhalten. Alle Verweise/Hashes und64/24 offene Pflichten prüfen; CI/CR getrennt.

CITY-00-I33-CI Start 2026-10-09T15:32:23.078589+00:00; Snapshot enthält kontrollierte Road-/Gate-Rebuild-Wirkung. I32-Beleg erklärt jetzt ausdrücklich nur unmittelbare ausstehende OFF-Control, keine dauerhafte Wiederherstellung; I33-Start zeigt GreensON. Effektives Default in I33 angewendet, inaktives Number-Feld3 erhalten.

CITY-00-I33-CR Start 2026-10-09T15:32:36.785913+00:00; Snapshot, acceptance und technische CITY-02/05-Präzisierung einschließlich I32-Restaurationsgrenze stimmen. Tatsächliche Kopien, Hashes und sämtliche Inventarbelegziele gültig;64/24 Pflichten offen. Aufräumumfang ohne Restbefund. Nächster Schritt prüft Maximum-Variante und erreichbare Anschlussanzahl, sofern HEX-05 noch nicht übergeben.


CITY-00-I34-P Start 2026-10-09T15:33:22.362976+00:00; Fokus: Maximum-Straßenvorgabe als verbleibende frühe Generatorparameterlücke. Eigene bekannte New-River-URL öffnen; aktuelle Features und Roads-Wahl lesen. Kontroll-Rebuild Default aus sichtbaren Vorgaben, echte JSON-Ausgabe/Bild/URL sichern. Nur Maximum number wählen, Rebuild und echte Ausgabe sichern; sämtliche vorhandenen Gruppen vergleichen und tatsächlich dargestellte Außenstraßen prüfen. Keine intern maximale Formel oder exakte Toranzahl allein aus Linienzahl folgern. Default zurück und Rebuild anwenden, echte Rückstellungsausgabe vergleichen; eigener Tab schließen, bestehende Referenzen erhalten. I/R und CP/CI/CR getrennt. Obergrenzen/Einzelstraßen-/Savewirkung bleiben ohne direkten Beleg offen; danach frühe Pflichtlücken statt späterer Gestaltungsoptionen priorisieren, HEX-05-Vertrag prüfen.

CITY-00-I34-I Start 2026-10-09T15:35:25.244762+00:00; Ergebnis: kontrolliertes Default→Maximum→Default-Rebuild bei Seed540139574/size25. Maximum ersetzt URL gates=-1 durch hub=1; sonstige Vorgaben gleich.13-Gruppenvergleich: roads5→10, walls/buildings/fields/districts geändert, übrige8 wertgleich. buildings544→541; fields7/districts8 bleiben Anzahlgleich bei geänderten Werten. Sichtbar zusätzliche Außenstraßen an mehreren Stadtseiten. Exakte Toranzahl und numerische Maximalformel nicht aus Linienzahl behauptet. Default-Rebuild-Ausgabe bytegleich zur Kontrollkarte. Acht Bilder, drei tatsächliche Downloadkopien, Vergleich/Rawhashmanifest extern gesichert, eigener Tab geschlossen.

CITY-02/CITY-05-Präzisierung aus I34: Maximum ist eine eigene Anschlussstrategie und keine fest beobachtete hohe Integerzahl. Gespeicherte diskriminierte Vorgabe auto/maximal/explizit verwendet nur beim expliziten Typ eine Anzahl; Vorschau zeigt tatsächliche erreichbare Anschlüsse und Konflikte mit Stadtgrenze/Mauern/Wasser sowie geschützten Elementen. Innere Straßenlinienzahl darf keine Torzählung ersetzen. Maximalstrategie soll verfügbare gültige Außenanker unter räumlichen Abständen nutzen; konkrete Grenzregel und Vergleichsabnahme noch offen, keine Originalformel als bekannt darstellen.

CITY-00-I34-R Start 2026-10-09T15:35:59.517218+00:00; Tatsächliche Downloadkopien, acht Bilder/Rawhashes und13-Gruppenvergleich bestätigt. Maximum erzeugt hub=1 ohne gates-Parameter, roads5→10, vier weitere Gruppen geändert; übrige8 gleich. Rückstellung bytegleich. Keine Original-Maximalformel oder Torzählung aus Linienanzahl abgeleitet. Aufräumbefund: Snapshot führt Maximum-Wirkung noch offen.

CITY-00-I34-CP Start 2026-10-09T15:36:12.128528+00:00; Plan: CO-WAT-0010-Snapshot um Maximum/hub und bytegleiche Rückstellung ergänzen, genaue Grenzregel/Torzählung weiterhin offen. Beide früheren Number3/I32-Beleggrenzen erhalten.13 Gruppen, Hashes, Belegziele und64/24 offene Pflichten prüfen. CI/CR getrennt.

CITY-00-I34-CI Start 2026-10-09T15:36:23.910998+00:00; Snapshot enthält Number3 sowie Maximum/hub mit tatsächlicher Straßenwirkung; unbekannte Maximalregel und Torzählung bleiben offen. Keine eigene Produktfreigabe.

CITY-00-I34-CR Start 2026-10-09T15:36:38.831611+00:00; Snapshot und acceptance stimmen; echte Downloadkopien, Rohhashes und Inventarbelegziele bestätigt.64 CO-/24 CTY-Pflichten offen. Eigener Tab geschlossen, Default angewendet/rückgestellte Datei bytegleich. Aufräumumfang ohne Restbefund. Als nächstes frühe Feature-/Größenpflichtlücken priorisieren oder nach geprüfter HEX-05-Übergabe CITY-01 beginnen.


CITY-00-I35-P Start 2026-10-09T15:37:40.456491+00:00; Fokus: tatsächliche Small-Größenwahl und Rückweg für frühen Stadtgenerator. Eigene bekannte New-River-URL öffnen, sichtbare Features/Größencontrols sichern. Kontroll-Rebuild aus sichtbaren Vorgaben und echte JSON/URL/Bild sichern. Sichtbares Small genau einmal anwenden; Ergebnis-URL auf Größe UND Seed sowie Featureänderungen prüfen, Bild/echte Ausgabe sichern und alle Gruppen vergleichen. Änderungen nicht pauschal nur der Größe zuordnen, wenn Seed mitwechselt. Sichtbaren Size- oder From-URL-Rückweg anhand frischer Oberfläche prüfen, ursprüngliche Vorgaben/Karte nur auf eigener Kopie wiederherstellen, tatsächlichen Rückstellungsumfang festhalten. Keine Größeinheit oder Dorf-Parität aus Buttonlabel ableiten. Bestehende Referenzen erhalten, eigener Tab schließen. Umsetzung/Review/Aufräum-P/I/R getrennt; HEX-05 weiterhin vor Produktstart.

CITY-00-I35-I Start 2026-10-09T15:40:10.557981+00:00; Ergebnis: eigener Small-Klick erzeugt size25→19 UND seed540139574→2039168945 bei sonst gleichen URL-Features.13 Gruppen verglichen:9 geändert,4 gleich; buildings544→252, greens0→2. Keine reine Größeneffektzuordnung und kein konstantes Small19 aus einer Probe. From URL öffnet Permalink-Dialog mit aktuellem Link; ursprünglichen Kontrolllink eingegeben und Generate angewendet. Wiederherstellungs-URL identisch, echte JSON-Datei bytegleich zur Kontrollkarte. Acht Bilder, drei tatsächliche Downloadkopien und Rawhashmanifest gesichert, eigener Tab geschlossen. Neue unabhängige Pflicht CO-WAT-0011 für reproduzierbare Generatorlinks ergänzt;65 CO-/24 CTY-Pflichten offen.

CITY-02/CITY-08-Präzisierung aus I35: Siedlungsgröße und Seed sind getrennte Vorgaben. Größenwahl erhält Seed standardmäßig, Neue Variante ändert ihn ausdrücklich; beide Änderungen bleiben in Vorschau/Undo sichtbar. Größenlabel benötigt definierte versionierte Werte/Bereiche, keine als bekannt unterstellte Original19-Konstante. Versioniertes teilbares Generationsrezept umfasst Generatorversion, Seed, vollständige Feature-/Anschluss-/Größenvorgaben, Flächen-/Umgebungsanker und Einheiten. Recipe-Import validiert vollständig und erzeugt einen neuen Vorschauauftrag; Netzwerkzugriff oder fremde URL-Ausführung ist dafür nicht nötig. Reproduktion wird gegen materialisierte Kontrollgeometrie geprüft. Normales Stadtöffnen lädt gespeicherte Geometrie und erzeugt niemals erneut; Rezept ist kein Ersatz für gespeicherte manuelle Eingriffe/Bindings/Keys. CO-WAT-0011 bleibt selbständige Funktions-/Host-/Bedienpflicht.

CITY-00-I35-R Start 2026-10-09T15:41:13.039067+00:00; Drei echte Downloadkopien, acht Bilder/Rawhashes und13-Gruppenvergleich bestätigt. Small ändert Seed UND Größe,9 Gruppen geändert/4 gleich; keine reine Größenwirkung behauptet. From-URL-Rückstellung bytegleich. CO-WAT-0011 eigenständige offene Recipepflicht mit Zuordnung vorhanden. Aufräumbefunde: Snapshot noch64/I34, neue Pflicht fehlt und Small-Umfang unspezifisch; Rezeptentscheidung noch in Architektur übernehmen.

CITY-00-I35-CP Start 2026-10-09T15:41:23.847706+00:00; Plan: Snapshot auf65/I35 aktualisieren, CO-WAT-0001 um gekoppelte Seed-/Größenwirkung ergänzen und CO-WAT-0011 mit eigenständigem offenen Umfang aufnehmen. Rezeptarchitektur als geplant festhalten: vollständige validierte Vorgaben, neue Vorschau, kein Neugenerieren beim normalen Laden. Alle alten IDs/Belege und fremde JSON-Wurzeln erhalten; CI/CR getrennt.

CITY-00-I35-CI Start 2026-10-09T15:41:36.407999+00:00; Snapshot enthält65 Pflichten einschließlich Permalink-Reproduktion und gekoppelte Small-Größen-/Seedwirkung. Architektur führt geplanten Recipevertrag und materialisiertes normales Laden getrennt; bestehende Kennungen/Belege erhalten.

CITY-00-I35-CR Start 2026-10-09T15:41:54.858122+00:00; Snapshot/acceptance/Plan/Architektur stimmen,65 CO-/24 CTY-Pflichten offen. Alle tatsächlichen Downloadkopien und Rawhashes sowie Inventarbelegziele gültig. Eigene Kopie geschlossen, Kontrollkarte über sichtbaren From-URL-Weg bytegleich wiederhergestellt. Aufräumumfang ohne Restbefund. Nächste frühe Referenz prüft benutzerdefinierte Größe bei gehaltenem Seed; nach geprüftem HEX-05-Handoff CITY-01 statt weiterer Vorproben.


CITY-00-I36-P Start 2026-10-09T15:42:36.090055+00:00; Fokus: explizite Size-Eingabe und Größenwirkung getrennt vom Small-Seedwechsel. Eigene bekannte URL öffnen, Kontroll-Rebuild aus sichtbaren Features, echte Ausgabe/URL/Bild sichern. Sichtbares Size-Feld mit kleinerem gültigen ganzzahligen Wert19 benutzen, ohne Seed bewusst zu ändern; tatsächlichen Seed/URL nach Anwendung prüfen. Vorher/Nachher vollständig vergleichen, keine Einheiten oder Parametergrenzen aus Einzelwert ableiten. Falls Eingabe direkt neu generiert/Seed ändert, tatsächliche Semantik dokumentieren. Kontrollkarte über den in I35 tatsächlich belegten From-URL/Permalink/Generate-Weg zurückstellen und echte Ausgabe vergleichen. Bestehende Referenzen erhalten, eigene Kopie schließen. I/R und CP/CI/CR getrennt; anschließend restliche frühe Featurepflichten priorisieren und HEX-05-Übergabe prüfen.

CITY-00-I36-I Start 2026-10-09T15:45:19.220002+00:00; Ergebnis: Size19 eingegeben, Rebuild hält size25/Seed540139574 im sichtbaren Ergebnis und URL; kein Dateinachweis zu diesem ersten Versuch. Frisch erneut Size19 mit normalem Enter bestätigt: size19/Seed1484653642, explizite Größe erzeugt neue Variante. Gehaltenen Seed über belegten From-URL-Dialog geprüft: nur size25→19 bei Seed540139574 und gleichen Features.13 Gruppen vollständig verglichen,8 geändert/5 gleich: buildings544→418, roads5→3, fields7→16, districts8→5. Kontrollkarte via From URL zurückgestellt, echte Datei bytegleich. Vier tatsächliche Downloadkopien, elf Bilder und Rawhashmanifest; Dateinamen03/04/05 bezeichnen Versuch, keine erfolgreiche Size19-Anwendung. Eigene Kopie geschlossen.

CITY-02-Präzisierung aus I36: Größenfeld bindet an validierten Entwurfszustand; Enter und sichtbarer Vorschauknopf verwenden denselben validierten Auftrag und verlieren keine noch fokussierte Eingabe. Seed bleibt bei gewöhnlicher Größenänderung erhalten; Neue Variante ist ausdrücklich getrennt. Größenwechsel ist ein neuer Vorschauauftrag, kein bloßes Skalieren materialisierter Straßengeometrie. Apply zeigt tatsächlichen Ersatzumfang und erhält geschützte Elemente/Keys gemäß gemeinsamer History; Save/Reload lädt Endgeometrie. I36 belegt Original-Größenwirkung bei gehaltenem Seed über Permalink, keine ID-/Bindingerhaltung oder eigene Umsetzung.

CITY-00-I36-R Start 2026-10-09T15:45:57.635904+00:00; Vier echte Downloadkopien, elf Bilder/Rawhashes und13-Gruppenvergleich bestätigt. Size+Rebuild-Versuch nur sichtbarer/URL-Nichteffekt; Enter erzeugt neuen Seed. Reiner Größenvergleich über From URL hält Seed,8 Gruppen geändert/5 gleich. Versuchsbilder03/04/05 korrekt begrenzt; Rückstellung bytegleich. Aufräumbefund: Snapshot nennt Customgröße noch offen.

CITY-00-I36-CP Start 2026-10-09T15:46:09.219407+00:00; Plan: CO-WAT-0001-Snapshot um direkten Customgrößen-/Seedumfang ergänzen, Einheiten/Bereiche weiter offen. Ursprüngliche Small- und Rebuild-Belege nicht umdeuten; Versuchsnamen nicht als erfolgreichen Size19-Apply behaupten. Hashes/Downloadkopien/Verweise und65/24 offene Pflichten prüfen. CI/CR getrennt.

CITY-00-I36-CI Start 2026-10-09T15:46:21.202296+00:00; Snapshot enthält Eingabesemantik Enter/neuer Seed sowie gehaltene Größe per From URL. Parametergrenzen, Einheiten, weitere Features und eigene Abnahme weiterhin offen. Historische Belege erhalten.

CITY-00-I36-CR Start 2026-10-09T15:46:35.647289+00:00; Snapshot/acceptance/Plan stimmen; vier tatsächliche Kopien und sämtliche Rawhashes/Inventarbelegziele gültig,65 CO-/24 CTY-Pflichten offen. Eigene Kopie geschlossen und Kontrollausgabe bytegleich restauriert. Aufräumumfang ohne Restbefund. Nächste frühe Originalprobe prüft Gewässerfeature aus kontrollierten Vorgaben; nach geprüftem HEX-05-Vertrag unmittelbar CITY-01.


CITY-00-I37-P Start 2026-10-09T15:47:23.617274+00:00; Fokus: Flussfeature und Stadt-/Straßenanpassung für CITY-02-Umgebungsanker. Eigene bekannte URL öffnen, sichtbare Features lesen und Kontroll-Rebuild aus aktuellem Formular durchführen. Ausgangsbild/URL/echte JSON sichern. Allein River aktivieren, Rebuild durchführen, Features und Karten-/Übergangswirkung sowie echte Datei/URL sichern. Vollständigen Gruppenvergleich durchführen; keine interne Fluss-/Brückentopologie oder Einheiten aus Darstellung/Exportgruppen behaupten. River aus zurückstellen UND Rebuild anwenden, tatsächlichen Rückstellungsexport vergleichen. Bestehende Referenzen und fremde Pfade erhalten, eigener Tab schließen. I/R und CP/CI/CR getrennt; frühere Feature/Seed-Belege erhalten; HEX-05 vor Stadtproduktstart.

CITY-00-I37-I Start 2026-10-09T15:49:43.476948+00:00; Ergebnis: River OFF→ON→OFF Rebuild bei gleichem Seed540139574/size25/anderen Flags.13 Gruppen vollständig verglichen: values/roads/rivers/buildings/fields/districts geändert, übrige7 gleich. rivers0→1; values ergänzt riverWidth41.038340289629225 ohne belegte Einheit. Straßen5 bleiben Anzahlgleich bei veränderter Geometrie, buildings544→417, fields7→11, districts8→7. Sichtbare Querungen außen an Nord/Ost; planks bleibt leer, keine exakte Brückentopologie aus Bild/Datei behauptet. OFF+Rebuild-Ausgabe bytegleich zum Kontrollzustand. Sieben Bilder/drei tatsächliche Downloads/Rawhashmanifest extern gesichert, eigene Kopie geschlossen. CO-WAT-0001 zusätzlich CTY-001.03 zugeordnet.

CITY-02/CITY-05-Präzisierung aus I37: Umgebungsauftrag enthält Flusskontur mit Breite und Ufer-/Bauabstand in gemeinsamen Metern statt bloß eines Darstellungsflags. Generator behandelt Wasser plus Abstand als Ausschlussfläche für normale Gebäude und Straßen; Straßenquerungen brauchen explizite Übergangselemente mit zwei gültigen Uferanschlüssen und stabiler Kennung. Vorschau prüft Straßen-/Übergangsverbund sowie nicht überbaute Wasserfläche und zeigt Konflikte. Vorhandene regionale Gewässer besitzen fremden Dokumentbesitz und werden durch Stadtgeneration nicht neu erzeugt/ersetzt; nur autorisierte neue Stadtgeometrie wird materialisiert übernommen. I37 belegt Original-Fluss-/Bebauungswirkung, keine exakten Originalabstände oder eigene Host-/Bindingabnahme.

CITY-00-I37-R Start 2026-10-09T15:50:32.573763+00:00; Drei echte Downloadkopien, sieben Bilder/Rawhashes und13-Gruppenvergleich bestätigt. rivers0→1 und Straßen-/Bebauungswirkung,6 Gruppen geändert/7 gleich; planks leer, keine unbewiesene Brückentopologie. Rückstellung bytegleich. CTY-001.03-Zuordnung vorhanden. Aufräumbefunde: Snapshot noch ohne River-Wirkung; geplante Umgebungs-/Übergangsentscheidung in Architektur ergänzen.

CITY-00-I37-CP Start 2026-10-09T15:50:44.965080+00:00; Plan: CO-WAT-0001-Snapshot um kontrollierte River-Wirkung und offene Übergangstopologie ergänzen. Geplante Wasser-Ausschlussflächen/Übergangselemente mit fremdem Umgebungsbesitz in ARCHITECTURE verankern. Historische Seed/Größen/Feature-Belege und sämtliche IDs erhalten; Hashes/Verweise/65/24 offene Pflichten prüfen; CI/CR getrennt.

CITY-00-I37-CI Start 2026-10-09T15:50:58.493229+00:00; Snapshot enthält River-Umgebungswirkung mit leerer planks-Gruppe und offener Topologie. Architektur führt geplante Wasser-/Uferabstände, explizite Übergänge und geschützten regionalen Dokumentbesitz; keine Produktabnahme aus Originalprobe.

CITY-00-I37-CR Start 2026-10-09T15:51:12.835377+00:00; Snapshot/acceptance/Plan/Architektur stimmen. Tatsächliche Downloadkopien, Rawhashes und Inventarbelegziele geprüft,65 CO-/24 CTY-Pflichten offen. Eigene Kopie geschlossen, ursprüngliches River aus angewendet, Kontrollausgabe bytegleich. Aufräumumfang ohne Restbefund. Nächste frühe Referenz prüft Küste/Hafen-Einfügung; nach überprüfter HEX-05-Übergabe unmittelbar CITY-01.


CITY-00-I38-P Start 2026-10-09T15:51:56.580605+00:00; Fokus: Küste/Hafen für CITY-02-Umgebung. Eigene bekannte URL, sichtbare Features und Kontroll-Rebuild aus Formular sichern; echte JSON-Ausgabe/URL/Bild. Allein Coast aktivieren, Rebuild und Ergebnis/echte Ausgabe sichern. Vollständigen Gruppenvergleich über Vereinigungsmenge durchführen, da Küste zusätzliche Wassergruppe erzeugen kann; neue/entfernte Gruppen nicht übergehen. Sichtbare Hafen-/Uferstruktur prüfen, keine interne Anlege-/Straßentopologie aus Exportnamen behaupten. Coast aus und Rebuild anwenden, tatsächlichen Rückstellungsexport vergleichen. Bestehende Referenzen erhalten, eigene Kopie schließen. I/R und CP/CI/CR getrennt; HEX-05 vor Produktstart.

CITY-00-I38-I Start 2026-10-09T15:54:09.203174+00:00; Ergebnis: Coast OFF→ON→OFF mit Seed540139574/size25. ON ergänzt zugleich sea0.2; keine bewiesene Bedeutung/Einheit daraus. Vollständige Gruppenvereinigung geprüft:13→14, water hinzugefügt, keine entfernt,10 gemeinsame Gruppen geändert/3 gleich. planks0→8, buildings544→537, roads5→4, districts8→6. Sichtbare Küstenkante/Anlegestege und veränderte Stadtbegrenzung; keine exakte interne Hafenanschlusstopologie oder individuelle Bearbeitung behauptet. OFF+Rebuild-Ausgabe bytegleich. Sieben Bilder, drei tatsächliche Downloadkopien und Rawhashmanifest gesichert, eigene Kopie geschlossen.

CITY-02/CITY-05-Präzisierung aus I38: Küstenwasser und Uferkante bilden Geometrieanker mit regionalem Dokumentbesitz. Hafenplanung erzeugt explizite Steg-/Kaielemente mit stabilem Landanschluss statt ungeprüfter normaler Gebäude im Wasser. Vorschau validiert Uferberührung, Straßen-/Fußweganschluss und Abstand zwischen Stegen; Länge/Breite/Ausrichtung sind editierbare Metergeometrie. Geänderte Küstenfläche ersetzt nicht stillschweigend Landschaft oder manuelle Hausbindungen. Hafenflächen und gewöhnliche Bauflächen sind getrennte Nutzungen desselben Viertel-/Grundstücksmodells. Original-I38 belegt Küsten-/Stegausgabe, keine exakten Grenzen oder eigene Produktabnahme.

CITY-00-I38-R Start 2026-10-09T15:54:53.712965+00:00; Drei echte Downloadkopien, sieben Bilder/Rawhashes und vollständige13→14-Gruppenvereinigung geprüft. water hinzugefügt,10 gemeinsame Gruppen geändert/3 gleich; planks0→8, Rückstellung bytegleich. sea0.2 bleibt ohne bewiesene Einheit. Exakte Hafenanschlusstopologie und eigene Abnahme nicht behauptet. Aufräumbefund: Snapshot führt Küstenwirkung noch unspezifisch als weitere Features offen.

CITY-00-I38-CP Start 2026-10-09T15:55:06.520420+00:00; Plan: CO-WAT-0001-Snapshot um Coast/water/planks und offene Hafen-/sea-Grenzen ergänzen. Vorige Fluss-/Größenbelege erhalten, zusätzliche Gruppe im Vergleich nicht übergehen. Rohhashes/Downloadkopien/Verweise und65/24 offene Pflichten prüfen; CI/CR getrennt.

CITY-00-I38-CI Start 2026-10-09T15:55:20.952772+00:00; Snapshot enthält Küstenwirkung mit zusätzlicher water-Gruppe und planks0→8; exakte Hafen-/Übergangstopologie und Einheiten weiterhin offen. Vorige Referenzumfänge erhalten.

CITY-00-I38-CR Start 2026-10-09T15:55:34.845432+00:00; Snapshot/acceptance/Plan stimmen. Echte Downloadkopien, Rawhashes und Inventarbelegziele gültig;65 CO-/24 CTY-Pflichten offen. Eigene Kopie geschlossen, Coast aus angewendet, Kontrollausgabe bytegleich. Aufräumumfang ohne Restbefund. Nächster Lauf prüft frühe Stadtpflichten und bereitet konkrete CITY-01-Schnittstellen nach Atlasstand vor; geprüfter HEX-05-Vertrag bleibt Starttor.


CITY-00-I39-P Start 2026-10-09T16:00:29.840385+00:00; Fokus: Quellprüfung und konkreter CITY-01-Anschlussplan. Auditumfang festgelegt: drei CITY-01-Pflichtfälle und ihre drei Originalzuordnungen gegen reale Kamera, Eingabe, Renderer, Dokumentparser, History und Speicher prüfen. Konkreten Anschlussplan mit vorhanden/geplant/fehlend, Besitzer und Hostnachweis liefern; keine erfundene HEX-05-API und keine zweite Editorbasis. Produktstart erst nach geprüfter HEX-05-Übergabe. Umsetzung liefert ROADMAP-CITIES-CITY01-INTEGRATION-PLAN.md und einen externen Quellhash-/Zuordnungsbeleg; Review und Aufräum-P/I/R getrennt.


CITY-00-I39-I Start 2026-10-09T16:03:34.427799+00:00; Neun reale Quellbereiche mit SHA-256/Zeilenankern geprüft; drei CTY- und drei CO-Zuordnungen vollständig in konkretem Anschlussplan. Detailprojektion/Router/Besitzer/History fehlen noch; .city plus Elternplatzierung braucht bereits CITY-01 gemeinsame Save/Recovery. Kollege bestätigt Transaktions-/Command-Basis in HEX-02 und geprüften HEX-05-Handoff. Keine Produkt- oder Hostfreigabe. Anschlussplan: [CITY-01 Integration](ROADMAP-CITIES-CITY01-INTEGRATION-PLAN.md). Audit: /home/aaron/.cache/dungeon-native-qa/city-plans/city00-i39-integration-20261009/source-audit.json. Review folgt getrennt.


CITY-00-I39-R Start 2026-10-09T16:04:44.446953+00:00; Plan vollständig gegen neun unveränderte Quellbereiche, drei CITY-01-Kriterien und drei Originalzuordnungen geprüft. Meter-/Dokumentbesitz, vollständige Hausaktionen, Abbruch, gemeinsame History, früh nötige Mehrdateispeicherung und Hostfehlerfolge abgedeckt.65 CO-/24 CTY-Pflichten bleiben offen. Aufräumbefund: bestehende Geometriehelfer und ihre Dungeon-/Einheitenkopplung im Anschlussplan noch nicht eingeordnet. Aufräum-P/I/R folgen getrennt.


CITY-00-I39-CP Start 2026-10-09T16:05:14.494999+00:00; Plan: Geometriehelfer aus src/geometry.ts im Plan einordnen: rectangle/inside/overlaps als punktbasierte Kandidaten, kein neuer Parallelbestand; Entity-/Portal-/Building-Helfer nicht ungeprüft auf Metergeometrie übernehmen. Polygon-Grenzsemantik und topologyEpsilon1e-9 benötigen bewusste Meterprüfung; BuildingEllipse hängt von Koordinatenspanne ab. Anschlussplan im vorderen Gesamtplan verlinken; ursprüngliches Quellaudit unverändert lassen und finalen Dokumenthash separat sichern. Umsetzung und Review getrennt.


CITY-00-I39-CI Start 2026-10-09T16:05:51.739005+00:00; Anschlussplan nennt vorhandene rectangle/inside/overlaps und deren Rand-/Bounding-Box-Grenzen; feste Topologietoleranz, BuildingEllipse-Segmentzahl und Dungeon-Entity-/Portalbindung ausdrücklich getrennt. Keine ungeprüfte Feld→Meter-Übernahme oder zweite Geometriebibliothek. Plan direkt im Gesamtplan verlinkt; ursprüngliche Evidenz unverändert. Abschließender Hash-/Quell-/Verweisreview folgt.


CITY-00-I39-CR Start 2026-10-09T16:06:44.885049+00:00; Originalquellaudit unverändert, historischer Planhash gegen Commit56b18a9 sowie finaler Plan-/Geometriehash bestätigt. Zehn Quellbereiche/Anker und sämtliche Planlinks gültig; drei CITY-01-Fälle und drei Originalzuordnungen erhalten. Wiederverwendung klar von Dungeon-Einheiten/Topologie getrennt, keine zweite Kamera/History/Statusdatei.65 CO-/24 CTY-Pflichten offen; Aufräumumfang ohne Restbefund. CITY-01 startet nach geprüfter HEX-05-Übergabe; bis dahin frühe manuelle Originalfunktionen gezielt vervollständigen. Nachweis: /home/aaron/.cache/dungeon-native-qa/city-plans/city00-i39-integration-20261009/cleanup-review.json.


CITY-00-I40-P Start 2026-10-09T16:08:13.049726+00:00; Fokus: FTG-Hausgeometrie für CITY-01. Eigenes CITY00 Hamlet QA im vorhandenen FTG-Tab: Ausgangsbild und sichtbaren Stand sichern, Manual edit/Buildings frisch lesen. Frühe Skalier-/Drehwirkung soweit tatsächlich angeboten an einem sichtbaren Haus als ungespeicherten Entwurf prüfen; geänderte Werte/Vorschau/Abschluss getrennt sichern. Keine Löschung, neue Siedlung oder erneute gestoppte Download-/Bewohnerhypothese. Cancel Edit/Yes verwirft Entwurf, sichtbares Haus sowie250m/Districts/11Monday prüfen. Stabile IDs, Save/Reload und Einzel-Undo aus Bildern nicht behaupten; maximal2 erfolglose Versuche je Hypothese. Nachher Originaltabs erhalten, P/I/R und Aufräum-P/I/R getrennt. Externe Belege: /home/aaron/.cache/dungeon-native-qa/city-plans/city00-i40-building-20261009/.


CITY-00-I40-I Start 2026-10-09T16:15:52.829607+00:00; FTG-Draw schließt eigene Vierpunktkontur; neu erzeugtes bekanntes Haus ausgewählt/verschoben/sichtbar gedreht. Zweite Platzierungsvorschau per Cancel entfernt, eine gedrehte Kontur bleibt; Gesamtentwurf per CancelEdit/Yes verworfen.CTRL-Mausrad-Skalierung direkt angeboten, Wirkung nicht geprüft. Zwei frühere Treffer ohne Auswahl gestoppt; neue bekannte Kontur ist eigener belegter Auswahlfall.250m/Districts/11Monday zurückgestellt; Originaltabs erhalten. Manifest: /home/aaron/.cache/dungeon-native-qa/city-plans/city00-i40-building-20261009/manifest.json. Keine Save-/ID-/Binding-/Undo-/Produktabnahme.

CITY-01-Präzisierung aus I40: Frei gezeichnete Hauskontur bleibt bis zum gültigen Schließen ein abbrechbarer Entwurf und wird als ein gemeinsamer Atlasbefehl übernommen. Bekannte Dokument-/Elementadresse bleibt bei Verschieben/Drehen erhalten; nach Abschluss bleibt das gewählte Werkzeug aktiv, keine automatische Einzelplatzierung. Maßstäbliche Griffe und numerische Meterwerte erlauben Skalierung unabhängig von einem zwingenden Modifier-Mausradweg. I40 belegt nur sichtbare Originalkontur/Platzierungswirkung und angebotene Skaliergeste, keine eigene bessere Bedienung.


CITY-00-I40-R Start 2026-10-09T16:16:48.611641+00:00; 27 Rohbelege/Hashes bestätigt; abgeschlossene Vierpunktkontur, neue bekannte Auswahl, sichtbare Dreh-/Verschiebewirkung und getrennt verworfene zweite Vorschau korrekt begrenzt.CTRLwheel nur angebotene Geste, keine Skalierabnahme. Zwei ältere Treffer ohne Auswahl gestoppt; neue Kontur belegt separates Ziel. Gesamtentwurf verworfen,250m/Satellite/Districts/11Monday gelesen. Aufräumbefund: Referenzsnapshot führt weiterhin nur I11-Straßenwirkung. Aufräum-P/I/R getrennt.


CITY-00-I40-CP Start 2026-10-09T16:17:09.830489+00:00; Plan: Snapshotkopf auf CITY-00-I40-I und CO-FTG-0015-Zeile um abgeschlossene Draw-Kontur, bekannte Hauspose und Entwurfsabbruch ergänzen. I10/I11-Straßen-/Savebelege erhalten; angeboteneCTRLwheel-Skalierung ausdrücklich ohne Wirkung. Zwei gestoppte Trefferversuche und stabile ID-/Save-/Undo-/Produktgrenzen behalten.27 Rawhashes/alle Inventarbelegziele/65und24 offene Pflichten prüfen; keine weitere UI-Mutation oder Statusdatei. CI/CR getrennt.


CITY-00-I40-CI Start 2026-10-09T16:18:12.594721+00:00; Snapshot enthält I11-Straßen-/Savefolge sowie I40-Draw/known-house-Pose/Entwurfsabbruch. Skaliergeste nur angeboten, keine Wirkung behauptet; gestoppte Auswahlversuche und unbekannte IDs/Bindings/Einzel-Undo bleiben erhalten. Historische Belege unverändert; kein eigener Produktcode oder neuer UI-Eingriff. Finaler Rawhash-/Verweisreview folgt.


CITY-00-I40-CR Start 2026-10-09T16:19:03.385325+00:00; Snapshot/acceptance/Anschlussplan stimmen: Draw-Kontur und bekannte Hauspose/Entwurfsabbruch belegt,CTRLwheelScale nur angeboten.27 Rawhashes und alle Inventarbelegziele gültig; I10/I11 sowie gestoppte Trefferversuche erhalten,65 CO-/24 CTY-Pflichten offen. Originaltabs erhalten, Gesamtentwurf verworfen und250m/Districts/11Monday bestätigt. Keine Restlücke im Aufräumumfang. Nächste frühe Probe klärt dokumentierte Skalierbedienung; CITY-01 wartet weiter auf geprüften HEX-05-Vertrag.


CITY-01-PREP-P01 Start 2026-10-09T16:25:35.193204+00:00; Hex-Besitzer bestätigt reine CITY-Modell-/Codec-Vorbereitung ohne gemeinsame Schnittstellenänderung. Natives Meterformat, stabileIDs/Graphreferenzen, Hauspose/Polygone/Grundstücke/Viertel und strikte verlustfreie Prüfung konkret geplant. Formaler CITY01-Hostanschluss bleibt nach HEX05; I41-Skalierwirkung wegen fehlendem dokumentierten Modifier-Scrollweg zurückgestellt, weiterhin offen. Plan: ROADMAP-CITIES-CITY01-MODEL-PLAN.md. I/R und Aufräum-P/I/R folgen getrennt.


CITY-01-PREP-I01 Start 2026-10-09T16:28:02.695114+00:00; Abschluss 2026-10-09T16:35:46.547763+00:00; Reines natives CityDocument/Codec implementiert: lokale Meter, stabileIDs, Straßenknoten/-verlauf, Platz/Grundstück/Viertel, Grundriss/Innenhof/Hauspose und strikte Referenz-/Geometrieprüfung. Keine fremde Eingabemutation, keine unbekannten Feldverluste; gemeinsame Typen/Topologie wiederverwendet. Typprüfung,269Tests einschließlich10 gezielter City-Fälle und Build grün. Kein Atlasadapter, keine History-/Dateiaktion oder Host-/Paritätsfreigabe; Fachreview folgt. Nachweis: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-model-20261009/implementation.json.


CITY-01-PREP-R01 Start 2026-10-09T16:39:42.180Z; Zwei konkrete Reviewlücken belegt: Listen-Zusatzfelder gehen im Serializer verloren (CITY-MODEL-R01-01); sparse Listen führen zu unverständlichem TypeError statt Formatfehler (CITY-MODEL-R01-02). Gegen strikten Datenvertrag ist damit Nachbesserung nötig. Bestehende Meter-/Graph-/Posefälle bleiben belegt, keine Host-/Paritätsfreigabe. N01: gemeinsame list-Prüfung auf dichte native Arrays, unbekannte Zusatzfelder und berechnete Indizes erweitern; gezielte Regressionen. Danach R02, Aufräum-P/I/R. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-model-20261009/review-probe.json.


CITY-01-PREP-N01 Start 2026-10-09T16:40:57.836912+00:00; Abschluss 2026-10-09T16:42:58.872325+00:00; Gemeinsame Listenprüfung lehnt Zusatzfelder, Sparse-Arrays, berechnete Indizes und Array-Unterklassen kontrolliert ab. Beide R01-Lücken behoben; Regression umfasst alle sechs Sammlungen, verschachtelte Konturen, Getter und Zusatzfeld statt fehlendem Index. Typprüfung,276Tests (11 City-Fälle) und Build grün; keine gemeinsame Atlasquelle verändert. R02 folgt. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-model-20261009/repair.json.


CITY-01-PREP-R02 Start 2026-10-09T16:44:07.400Z; Beide R01-Gegenfälle erneut am reparierten Codec kontrolliert abgelehnt; kanonischer Roundtrip unverändert.276Tests einschließlich11 City-Fällen, Typprüfung und Build an unveränderten geprüften Quellen bestätigt. Modellvertrag ohne weitere Fachlücke im begrenzten Vorbereitungsumfang. Aufräumreste: dimensionslose Skalierung im Typ kommentieren, pauschal geplante Modulpfade im Gesamtplan korrigieren und dichte Listen in Architektur dokumentieren. Alle Host-/Atlas-/Paritätspflichten bleiben offen. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-model-20261009/r02-review.json. Aufräum-P/I/R folgen getrennt.


CITY-01-PREP-CLEAN-P01 Start 2026-10-09T16:46:15.720458+00:00; Plan: Nur drei R02-Reste bereinigen: dimensionslose Achsenskalierung direkt am Modelltyp kommentieren; Gesamtplan trennt existierende Modell-/Codec-APIs von geplanten Modulen; Architektur nennt dichte native Listen ohne Zusatz-/Accessorfelder. Kein Laufzeitumbau/Geometriekopie/öffentlicher API-Zuwachs. Generierten JS-Code vor/nach Kommentar vergleichen; frühere Rawbelege erhalten und abschließend CTY/CO/Verweise/Quellgrenzen prüfen. CI/CR getrennt.


CITY-01-PREP-CLEAN-I01 Start 2026-10-09T16:47:08.177038+00:00; Dimensionslose Skalierung am Modelltyp gekennzeichnet; existierende Modell-/Codec-APIs von geplanten Stadtmodulen getrennt; Architektur dokumentiert dichte native Listen und kontrollierte Ablehnung. Keine ausführbare Änderung oder neue öffentliche Schnittstelle. JS-/Typquellgleichheit und abschließender Review folgen.


CITY-01-PREP-CLEAN-R01 Start 2026-10-09T16:48:58.646070+00:00; Alle drei Aufräumreste erledigt: Skalierung korrekt dimensionslos kommentiert, vorhandene APIs im Gesamtplan erkennbar, dichte Listen in Architektur festgehalten. Ausschließlich Kommentaränderung am Modelltyp; exakte Typquelle nach Kommentarentfernung und erzeugtes JS identisch. Codec/Tests/gemeinsame Quellen unverändert gegenüber276grünenTests/Typprüfung/Build. Modellvorbereitung reviewt ohne Restbefund;24CTY/65CO-Fachpflichten und Atlas-/Host-/Saveintegration offen. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-model-20261009/cleanup-review.json. Nächster Lauf plant reine Stadtbefehle auf der inzwischen gelieferten gemeinsamen AtlasHistory; mit HEX-Besitzer abgleichen, keine eigene Historie oder Hostvorgriff.


CITY-01-PREP-P02 Start 2026-10-09T16:53:43.876966+00:00; Fokus: reine Stadtbefehle auf tatsächlich gelieferter AtlasHistory. Owner=stabile CityDocument.id, Target=document, initiale Codecprüfung vor Registrierung/JSON-Konversion, keine zweite mutable Quelle. Reiner Vorher/Nachher-Change hält Gestenanfangsstand und ermöglicht atomare City-/Terrainbefehle. Echte Mehrbesitzer-, Stale-, No-op-/Redo- und Eingabegrenzprüfungen geplant; HEX-Besitzer bestätigt API. Plan: ROADMAP-CITIES-CITY01-COMMANDS-PLAN.md. Keine Produkt-/Hostfreigabe; Plan-Aufräum-P/I/R folgen getrennt.


CITY-01-PREP-PLAN-CLEAN-P02 Start 2026-10-09T16:54:08.160940+00:00; Plan-Aufräumfokus: Befehlsplan gegen tatsächliche AtlasHistory/TerrainSource, bestehende immutable-Hilfe und CTY/HEX05-Grenzen prüfen. Geplante Snapshots müssen vorhandene Tiefkopiehilfe verwenden; register/hydrate ohne unregister erfordert einmalige Quelle je Besitzerlebensdauer. Diese beiden Implementierungsdetails explizit ergänzen, Verweise/JSON/fremde Roots prüfen; danach getrennt CI/CR.


CITY-01-PREP-PLAN-CLEAN-I02 Start 2026-10-09T16:54:33.124584+00:00; Befehlsplan verwendet ausdrücklich die bestehende generic immutable-Hilfe auf frisch aufgebautem Change. Fehlendes unregister wird als einmalige Quelle je Stadt-/Historylebensdauer beschrieben; weitere Verbraucher teilen die Quelle, erneute Konstruktion kollidiert kontrolliert. Keine Registry, zweite History oder Hostcodeänderung. Abschließender Quellen-/Verweis-/JSONreview folgt.


CITY-01-PREP-PLAN-CLEAN-R02 Start 2026-10-09T16:55:07.020488+00:00; Befehlsplan gegen tatsächliche AtlasHistory/TerrainSource, Codec/Modell und vorhandene immutable-Hilfe geprüft. Owner=document-ID/Target=document, einmalige Registrierung, ausschließlich History als Stand, strikte Eingabeprüfung vor JSON und festgehaltener Gestenbeginn stimmen. Mehrbesitzer-Stale/Formatfehler, gemeinsame Undo/Redo sowie No-op/Redo ausdrücklich geplant; lokale Verweise und JSON gültig,24 CTY-Pflichten weiter offen. Keine ausführbare Änderung oder Hostfreigabe. Plan-Aufräumen ohne Restbefund. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-commands-20261009/plan-review.json. Nächster Lauf CITY-01-PREP-I02 implementiert nur commands.ts und gezielte Tests.


CITY-01-PREP-I02 Start 2026-10-09T16:55:47.454518+00:00; Abschluss 2026-10-09T16:57:39.605029+00:00; CitySource und reiner cityDocumentChange implementiert. Stabile Owner-ID/Target=document, strikte Codecprüfung vor JSON, einmalige Hydrierung, ausschließlich gemeinsame AtlasHistory als Stand. Sechs gezielte Regressionen mit echten City-/TerrainSource-Dokumenten: gemeinsames Undo/Redo, atomare Konflikt-/Formatablehnung, No-op/Redo, Eingabegrenze und unabhängige Besitzer. Typprüfung,282Tests und Build grün. Keine Host-/Atlasplatzierungs-/Speicher-/Bedienfreigabe; R03 folgt getrennt. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-commands-20261009/implementation.json.


CITY-01-PREP-R03 Start 2026-10-09T16:58:10.229Z; Separate gebündelte Modulgegenprobe bestätigt echte Terrain-/Cityowner: gemeinsames Undo, falsche Besitzer-ID verhindert jede Mutation und erhält Redo, stale Gesten abgelehnt, Metadaten vor JSON abgelehnt, Snapshots tief gefroren. Quellen exakt wie bei282grünenTests/Typprüfung/Build. Keine Fachlücke im reinen Befehlsumfang. Aufräumreste: vorhandene Befehls-/Ownergrenze in Architektur, Gesamt- und Anschlussplan kenntlich machen. CTY-/CO-/Host-/Savepflichten weiter offen. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-commands-20261009/review.json.


CITY-01-PREP-COMMAND-CLEAN-P02 Start 2026-10-09T16:58:46.360612+00:00; Plan: vorhandene CitySource/cityDocumentChange und Owner-/JSONgrenze in ARCHITECTURE ergänzen, vorhandene Befehlsvorbereitung von geplanter UI-/Speicherintegration im Gesamt- und Anschlussplan trennen. Snapshotkopien und Wiederprüfung bleiben als bewusste Grenzvalidierung bestehen; kein unbelegter Performanceumbau. Keine Laufzeitänderung. Abschließend Quellenhashes, JSON/Links/fremde Roots und offene Abnahmen prüfen; CI/CR getrennt.


CITY-01-PREP-COMMAND-CLEAN-I02 Start 2026-10-09T16:59:36.296592+00:00; Architektur beschreibt vorhandene CitySource/cityDocumentChange mit einmaligem Owner, ausschließlich gemeinsamer History, strikter Konversion und Gestenanfangsstand. Gesamt-/Anschlussplan trennen diesen Code von noch geplanten Werkzeugen/Host/Save. Keine zusätzliche Cityrevision behauptet; Quellen/Kopien unverändert. Eingehendes HEX-I01b erweitert TerrainSource nur um ensureVisible; gemeinsame API unverändert, aktuelle Basisprüfungen vor Abschluss erneut ausführen. CR folgt.


CITY-01-PREP-COMMAND-CLEAN-R02 Start 2026-10-09T17:00:39.825702+00:00; Architektur und Pläne trennen vorhandene CitySource/cityDocumentChange von geplanter UI-/Host-/Saveintegration. Keine zweite Stadtquelle, zusätzliche Revision, History oder Freezeimplementierung. Cityquellen/Tests/Codec/History unverändert; integriertes HEX-I01b mit aktueller Typprüfung,282Tests und Build bestätigt. Lokale Links/JSON/fremde Roots geprüft;24CTY-/65CO-Pflichten weiter offen. Aufräumumfang ohne Restbefund. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-commands-20261009/cleanup-review.json. Nächster Lauf plant reine Straßen-/Haus-Fachaktionen auf dieser Befehlsbasis, Hostanschluss weiterhin nach HEX05.


CITY-01-PREP-P03 Start 2026-10-09T17:02:42.690100+00:00; Konkreter Plan für editCity/CityEdit: Straße ergänzen/Knoten ziehen/Kante ersetzen oder entfernen, Hauspose/Grundriss/Entfernung, erster Platz. Vollständiger geprüfter Anfangsstand, strikte Operationsgrenze und abschließende Paketvalidierung ermöglichen abhängige Referenzänderungen ohne Zwischencommit. Caller-IDs, unbeteiligte Daten und lokale Einheiten bleiben erhalten; ein gemeinsamer CityDocumentchange, keine History-/Host-/Speicheränderung. Plan: ROADMAP-CITIES-CITY01-EDIT-PLAN.md. Plan-Aufräum-P/I/R folgt.


CITY-01-PREP-EDIT-PLAN-CLEAN-P03 Start 2026-10-09T17:03:46.375318+00:00; Planreview findet Paketgrenze: finale Codecprüfung allein könnte durch add/remove oder mehrfaches Ersetzen eine ungültige Payload oder Kennungswiederverwendung unsichtbar machen. Plan präzisieren: jedes Element höchstens einmal als Schreibziel je Paket; neue Kennungen gegen gesamte Anfangsstadt reservieren, inklusive explizit entfernter Elemente. Referenzänderung unterschiedlicher Ziele weiter gemeinsam zulassen. Operationen besitzen keine persistente Transaktion oder fremde Bindungen. CI/CR getrennt; Hex-Besitzer bestätigt kollisionsfreien Fachaktionsumfang.


CITY-01-PREP-EDIT-PLAN-CLEAN-I03 Start 2026-10-09T17:04:23.285947+00:00; Plan ergänzt einmaliges Schreibziel je Element, reservierte Anfangskennungen und separate Regressionen für add/remove, remove/add sowie typübergreifende IDwiederverwendung. Verschiedene Kanten-/Knotenziele können weiter einen gültigen Endzustand gemeinsam bilden; keine Zwischenvalidierung der Referenzen oder duplizierte Geometrieprüfung. Rein vorbereitende Dokumentation, keine Laufzeitänderung; CR folgt.


CITY-01-PREP-EDIT-PLAN-CLEAN-R03 Start 2026-10-09T17:04:51.540191+00:00; Zehn reine Fachaktionen gegen vorhandene CityDocumentfelder, Codec und gemeinsame History geprüft. Anfangs-/Endprüfung, einmalige Schreibziele, reservierte IDs, unterschiedliche Referenzänderungen im Paket und fremde Kopien eindeutig festgelegt. Regressionen decken verbundene Straßen, Hauspose/-kontur, ersten Platz und gemeinsame Undo-/Stalefälle ab. Planlinks/JSON gültig, Quellen unverändert;24CTY/65CO offen. Kein Restbefund im Plan-Aufräumen. Nachweis: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-edit-20261009/plan-review.json. I03 implementiert den geprüften Plan; Host weiterhin hinter HEX05.


CITY-01-PREP-I03 Start 2026-10-09T17:06:09.576602+00:00; Abschluss 2026-10-09T17:08:44.239285+00:00; editCity/CityEdit implementiert zehn reine Fachaktionen. Gemeinsame Knoten, Straße ergänzen/ersetzen/entfernen, Hauspose/Grundriss/Entfernung und erster Platz; Anfangsstand strikt geprüft, neue IDs reserviert, ein Schreibziel je Element, finale Referenz-/Geometrieprüfung ohne Zwischencommit. Sieben gezielte Graph-/Haus-/Paket-/Historyregressionen bestanden; Typprüfung,294Tests und Build grün. Kein Host-/Werkzeug-/Speichernachweis. R04 folgt getrennt. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-edit-20261009/implementation.json.


CITY-01-PREP-R04 Start 2026-10-09T17:09:21.880Z; Separate Modulgegenproben bestätigen finale Referenzprüfung im Paket, Schutz ungültiger Anfangsdaten vor Löschung, keine IDwiederverwendung, Nodearray-Metadaten abgelehnt, IDgetter nicht aufgerufen, ungültiges Loch abgelehnt und exaktes Undo. Quellen unverändert gegenüber294Tests/Typprüfung/Build. Keine Pflichtlücke im reinen Fachaktionsumfang. Aufräumen: reine Aktionen in Architektur/Plänen von UI trennen und unbelegte Codec-Pfadvalidierung im Anschlussplan korrigieren. Fach-/Hostabnahmen weiter offen. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-edit-20261009/review.json.


CITY-01-PREP-EDIT-CLEAN-P03 Start 2026-10-09T17:10:19.775367+00:00; Plan: existierende editCity/CityEdit mit einmaligen Schreibzielen, reservierten AnfangsIDs und finalem Codecvertrag in ARCHITECTURE dokumentieren. Gesamt-/Anschlussplan unterscheiden reinen Fachcode von fehlenden Gesten/Host/Save; Codec-Pfadprüfung entfernen, da heutiges Cityschema keine Pfadfelder besitzt. Private Aktions-/Listenprüfung ist Eingabegrenze, Geometrie/Referenzen bleiben ausschließlich Codec; kein Umbau ohne Bedarf. Keine ausführbare Änderung. Danach JSON/Links/Quellhashes und offene Pflichten prüfen; CI/CR getrennt.


CITY-01-PREP-EDIT-CLEAN-I03 Start 2026-10-09T17:10:49.725727+00:00; Architektur führt editCity/CityEdit samt Paket-/Identitätsschutz, Codeceigentum und unveränderlichen Kopien. Gesamt-/Anschlussplan kennzeichnen vorhandene Fachaktionen, UI/Bindungen/Host/Save bleiben geplant. Falsche Behauptung über City-Dokumentpfadprüfung korrigiert; Schema hat keine solchen Felder. Keine Laufzeit-/APIänderung. Quellen-/JSON-/Verweisreview folgt.


CITY-01-PREP-EDIT-CLEAN-R03 Start 2026-10-09T17:11:26.813059+00:00; Aufgeräumte Fachaktionsarchitektur/Pläne stimmen: reiner Fachcode vorhanden, Gesten/Renderer/Host/Save weiter offen. Codec-Pfadbehauptung korrigiert. Keine ausführbare Änderung; sämtliche geprüften Quell-/Test-/Build-/Abhängigkeitshashes unverändert gegenüber294Tests/Typprüfung/Build. JSON/Links/fremde Roots geprüft,24CTY und65CO-Inventarpflichten erhalten. Kein Restbefund im Aufräumumfang. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-edit-20261009/cleanup-review.json. Nächster Lauf prüft aktuellen Atlasstand und plant Darstellung/Trefferprüfung am gemeinsamen Renderer ohne eigene Kamera oder Hostvorgriff.


CITY-01-PREP-P04 Start 2026-10-09T17:15:00.503300+00:00; Quellaudit bestätigt gemeinsame Kamera/detailLayer, aber keine Stadtzeichnung/Platzierungs-API; Overworld.placements=never[], Fit nurTerrain. Plan ROADMAP-CITIES-CITY01-SCENE-PLAN.md: lokale CityScene/Hitgeometrie, gemeinsame Hauspose mit Codec, punktbasierten Segmentabstand aus bestehenden Dungeonhelfern extrahieren. Feste Zeichen-/Trefferfolge, Loch-/Randsemantik, echte Meterbreiten/Bounds und gezielte Dungeonregressionen. Kein eigener Welttransform/Renderer/Hostvorgriff. Hex-Thread liveinProgress, laufendI01c; Modulgrenzen vorI04 abstimmen. Plan-Aufräum-P/I/R folgt.


CITY-01-PREP-SCENE-PLAN-CLEAN-P04 Start 2026-10-09T17:15:54.932937+00:00; Planreview: Hex-Besitzer bestätigt reine CitySceneCore mit aufrufergeliefertem project/unproject, kein Placementvertrag. Präzisieren: callbacks nur Anschlussgrenze, P04-Core bleibt lokal; Bounds als finite min/max statt potenziell überlaufender Breite/Höhe; kontrollierte Ablehnung nicht darstellbarer gepufferter Ausdehnung. Gemeinsamer Streckenumbau benötigt Baselinegegenprobe für Dungeonaddresses/Gleichstände und gezielte lange Strecken, keine ungeprüfte bitweise Gleichheit. Dungeonbesitzer zur Kollision angefragt. CI/CR getrennt.


CITY-01-PREP-SCENE-PLAN-CLEAN-I04 Start 2026-10-09T17:16:54.491334+00:00; Szenenplan nennt bestätigte aufrufergelieferte project/unproject-Grenze ohne Placementkopie; Core bleibt lokal. Finite Min/Maxbounds samt kontrollierter Szenenfehlergrenze festgelegt. Gemeinsamer Streckenumbau bekommt externe Vorherbaseline, exakte Adressen/Gleichstandsfolge, toleranten Zahlenvergleich und analytischen Langstreckenfall. Dungeonbesitzer über aktuell entdeckten durable-Host informiert; keine Laufzeitänderung. CR folgt.


CITY-01-PREP-SCENE-PLAN-CLEAN-R04 Start 2026-10-09T17:17:42.773613+00:00; Finaler Plan gegen acht tatsächliche Quellbereiche geprüft: eine Kamera/detailLayer, unsupportedplacements, reale Geometrie-/Posehelfer. Bestätigte Callback-Anschlussgrenze, keine Placementkopie; lokale CityScene/Hitadressen, Ebenen-/Rand-/Loch-/Straßenbreitensemantik und finite Bounds klar. Extraktion vermeidet neue Pose-/Streckenkopie, bestehende Dungeonaddresses über externe Baseline/Regressionsprüfungen geschützt. JSON/Links/fremde Roots gültig,24CTY/65CO erhalten. Keine Laufzeit-/Hostfreigabe; Plan-Aufräumumfang ohne Restbefund. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-scene-20261009/plan-review.json. NächsterI04 setzt den reinen Core um, nach Abgleich möglicher gemeinsamer geometry.ts-Arbeit.


CITY-01-PREP-I04 Start 2026-10-09T17:19:57.078Z; Abschluss 2026-10-09T17:27:09.391975+00:00; Lokale CityScene/hitCity, gemeinsame Cityhauspose mit Codec und punktbasierter Streckenhelper implementiert. Reale Meterbreiten, referenzierte Endpunkte, Innenhöfe/Ränder, feste Ebenenfolge, optionale sichtbare Knotenhandles, finite Min/Maxbounds; keine Kamera/History/Hostaktion. Acht neue Szene-/Segment-/Dungeon-/Kameragegenfälle plus gesamte Typprüfung,308Tests und Build bestanden. Baseline7525Vergleiche: Adressen exakt, maximaler Zahlenfehler3.553e-15 beiToleranz1e-9. Zunächst gefundene Eckenadressabweichung durch ursprüngliche Residualarithmetik repariert und Regression ergänzt. Langstrecke1e200 korrekt statt Nennerüberlauf. R05 folgt getrennt. Kein nativer Host-/Grafik-/Save-/Paritätsnachweis. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-scene-20261009/implementation.json.


CITY-01-PREP-R05 Start 2026-10-09T17:28:14.444Z; Separate Modulprobe bestätigt Loch-/Randfallthrough, echte gemeinsame Straßenendpunkte, eigene gefrorene Geometrie und exakte analytische Langstrecke. Gemeinsame Dungeonquelle außerhalb des extrahierten Blocks bytegleich zur gesicherten Baseline.7525Baselinevergleiche mit exakten Adressen. Nach eingehenden Katalog-Abhängigkeiten npmci aus unverändert übernommenem Lock; integrierte Typprüfung,310Tests und Build bestanden. Keine Pflichtlücke im lokalen Core. Aufräumen dokumentiert vorhandene Szene/Helper und ausdrücklich noch fehlenden nativen Dungeon-/Atlasnachtest. Kein Host-/Platzierungs-/Grafik-/Save-/Paritätsabschluss. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-scene-20261009/review.json.


CITY-01-PREP-SCENE-CLEAN-P04 Start 2026-10-09T17:31:07.162885+00:00; Plan: vorhandene lokale CityScene/hitCity und gemeinsame Hauspose/Streckenprimitive in ARCHITECTURE kennzeichnen. Gesamt-/Anschlussplan unterscheiden Core von noch fehlender Pixidarstellung, Gesten, Platzierung und Host/Save; Szenenplan auf vorbereiteten Code verweisen. Lokale Checks/Baseline sind keine native Dungeon-/Atlasabnahme; exklusiven Hex-Hostbesitzer um aktuellen Nachtest bitten. Kopien/Validierung bleiben bewusste Eingabe-/Ownershipgrenzen, kein unbelegter Performanceumbau. Keine Laufzeitänderung; CI/CR getrennt.


CITY-01-PREP-SCENE-CLEAN-I04 Start 2026-10-09T17:32:05.019677+00:00; Architektur und Pläne unterscheiden vorhandene lokale Szene/Treffer, gemeinsame Hauspose und Streckenprimitive von fehlender Pixizeichnung/Gesten/Platzierung/Host/Save. Dungeonbaseline und Residualtie-Fix dokumentiert, tatsächlicher nativer Dungeon-/Atlasnachtest bleibt ausdrücklich offen. Keine API-/Laufzeitänderung oder unnötige Cache-/Kopienoptimierung; CR folgt.


CITY-01-PREP-SCENE-CLEAN-R04 Start 2026-10-09T17:32:52.031176+00:00; Architektur/Pläne stimmen mit lokalem Szenen-/Treffercore, gemeinsamer Hauspose und extrahierter Streckenprimitive. Keine weitere API-/Laufzeitänderung; alle geprüften Produkt-/Test-/Abhängigkeitshashes unverändert gegenüber310Tests/Typprüfung/Build.7525Dungeonbaselinevergleiche und separate Szenenprobe erhalten. JSON/Links/fremde Roots geprüft,24CTY/65CO erhalten. Tatsächlicher nativer Dungeon-/Atlasnachtest, Grafik/Gesten/Platzierung/Save weiter offen; keine Restlücke im Aufräumumfang. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-scene-20261009/cleanup-review.json. Nächster Plan bereitet transiente Stadtwerkzeugzüge am bestätigten project/unproject- und gemeinsamen Historyvertrag vor.


CITY-01-PREP-P05 Start 2026-10-09T17:35:42.174Z; Konkreter CityDraft-Plan: unveränderlicher Gestenanfangsstand, genau eine vollständig geprüfte document/scene-Vorschau, clearPreview für unvollständige Konturen, Cancel ohne Rückschreibung und ein gemeinsamer Apply-Befehl. Invalid-/failed-/closed-Zustände und kein Retry/Rebase festgelegt. Reproduzierte History-Lücke CITY-HISTORY-P05-01: Subscriberfehler nach Commit lässt execute werfen und weitere Listener ausfallen; private Isolation mit Hex-Besitzer koordiniert, vorI05 Besitzerstand prüfen. Plan ROADMAP-CITIES-CITY01-DRAFT-PLAN.md und konkrete echte History-/Terrain-/Cityregressionen. Keine UI-/Host-/Dateiaktion. Plan-Aufräum-P/I/R folgt.


CITY-01-PREP-DRAFT-PLAN-CLEAN-P05 Start 2026-10-09T17:40:53.561548+00:00; Planreview: Hex-Besitzer bestätigt notify-Reparatur im I05-Paket, keine Dateikollision. Präzisieren: Sync-Observerfehler werden isoliert; unveränderte öffentliche subscribe-/History-API. preview=null bedeutet aktueller Sourcezustand ohne Draftoverlay, nie restaurierter before. Router gibt terminale Draftreferenz frei, Klasse besitzt keine Listener. closed-Zustandsfehler dürfen keine erneute invalid-Mutation bewirken. CI/CR getrennt; reine Dokumentationsarbeit.


CITY-01-PREP-DRAFT-PLAN-CLEAN-I05 Start 2026-10-09T17:41:43.653837+00:00; Plan führt bestätigte begrenzte Sync-Subscriberreparatur ohne öffentliche API-/Reihenfolgenänderung. nullPreview entfernt nur Overlay und liest aktuellen Source, never beforeRestore. Bearbeitbarkeitsprüfung vor Updatecatch erhält terminale Zustände; Router gibt terminale Draftreferenz frei, Core hat keine Listener/Timer/Capture. Keine Laufzeitänderung; finaler Planreview folgt.


CITY-01-PREP-DRAFT-PLAN-CLEAN-R05 Start 2026-10-09T17:42:37.244058+00:00; Finaler Draftplan gegen fünf aktuelle Quellen und konkrete Postcommit-Observerprobe geprüft. Einmaliger before, eine validierte document/scene-Vorschau, clearPreview/unvollständige Kontur, terminale Zustände, Cancel ohne Restore und ein History-Apply eindeutig. Hex-Besitzer bestätigt notify-Reparatur im I05-Paket; keine parallele Dateiarbeit. Sync-Fehlerdiagnose und weitere Subscriber sowie echte Terrain-/Cityfälle geplant. JSON/Links/fremde Roots gültig,24CTY/65CO erhalten. Kein Restbefund im Plan-Aufräumen; Observerlücke noch nicht repariert, keine Produkt-/Hostfreigabe. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-gestures-20261009/plan-review.json. I05 implementiert nun den abgestimmten Draft-/Observervertrag.


CITY-01-PREP-I05 Start 2026-10-09T17:45:40.580305+00:00; CityDraft mit festem Anfangsstand, eigener geprüfter document/scene-Vorschau, clearPreview, Cancel ohne Restore und einem Apply implementiert. Geschlossene Zustände bleiben geschlossen; echte Stalekonflikte schließen failed ohne Retry. Private AtlasHistory-notify isoliert synchrone Subscriberfehler und defekten Diagnosesink nach Commit, andere Subscriber laufen weiter. Acht neue Draft-/History-/Terrainregressionen; Typprüfung,319Tests und Build bestanden. Separate R06 und Aufräum-P/I/R folgen. Kein sichtbarer Atlas-/Save-/Host-/Paritätsnachweis. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-gestures-20261009/implementation.json.


CITY-01-PREP-R06 Start 2026-10-09T17:49:00.752Z; Quellreview gegen P05 plus unabhängige Modulproben: Straßen-/Hausanlage ein Undo/Redo, codecgültiger Szenenboundsüberlauf verwirft alte Vorschau und bleibt ohne Commit. Keine Laufzeitlücke gefunden; CITY-DRAFT-R06-01 fordert beide Gegenfälle als dauerhafte Regressionen. I05-Quellenhashes einschließlich Abhängigkeiten unverändert;319Tests/check/build gelten für diesen Stand. Host/UI/Save offen. Erst Aufräum-P/I/R, dann gezielte N05-Testnachbesserung und R07. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-gestures-20261009/review.json.


CITY-01-PREP-DRAFT-CLEAN-R05 Start 2026-10-09T17:50:53.039000+00:00; Getrennte Aufräumplanung und Umsetzung dokumentieren vorhandenen Draft und reparierten historischen Observerbefund. Eigene Planlinks/JSON und unveränderte Runtimehashes geprüft;24CTY offen, kein Runtimeumbau. Eine alte fremde externe Dungeon-QA-Verknüpfung ist lokal nicht vorhanden und gehört nicht zum Stadtpaket. Keine Restlücke im Architektur-Aufräumen; CITY-DRAFT-R06-01 bleibt für N05/R07. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-gestures-20261009/cleanup-review.json.


CITY-01-PREP-N05 Start 2026-10-09T19:50:28.278387+02:00; CITY-DRAFT-R06-01: vollständige Straßen-/Hausanlage einschließlich clearPreview/Apply/Undo/Redo sowie codecgültiger Szenenboundsfehler mit Verwerfen alter Vorschau und erfolgreicher Korrektur dauerhaft getestet. Kein Runtime-/Historyumbau. Eingehende Raumsuche integriert; erneutes check,327Tests/build bestanden. R07 prüft getrennt. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-gestures-20261009/refinement.json.


CITY-01-PREP-R07 Start 2026-10-09T17:52:11.677389+00:00; Beide N05-Regressionen gegen R06-Originalproben reviewt: Anlage bis ausdrücklichem Apply ohne Mutation, ein exaktes Undo/Redo; editCity akzeptiert Überlaufkandidaten, erst Szenenbounds lehnen ihn ab und löschen Vorschau, danach gültige Korrektur. Quellenhashes unverändert zum integrierten grünen Stand; CITY-DRAFT-R06-01 geschlossen. Keine weitere Pflichtlücke im Draftcore; keine Host-/Atlas-/Savefreigabe. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-gestures-20261009/refinement-review.json. Aufräum-P/I/R folgt.


CITY-01-PREP-N05-CLEAN-R05 Start 2026-10-09T17:53:44.038473+00:00; Separate Aufräumplanung/Umsetzung haben Gesamt-/Anschlussplan mit dem vorhandenen reviewten Draft abgeglichen. Neue Verweise/JSON und sämtliche N05-Quellenhashes geprüft;327Tests/check/build unverändert, kein zusätzlicher Runtime-/Fixtureumbau. CITY-DRAFT-R06-01 geschlossen, keine Restlücke im Draftcore.24CTY und echte Host/Gesten/Save/Atlasabnahmen bleiben offen. NächsterP06 plant den Werkzeugadapter an der bestätigten aufrufergelieferten Projektion, mit Hexbesitzeranschluss. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-gestures-20261009/refinement-cleanup-review.json.


CITY-01-PREP-P06 Start 2026-10-09T17:55:18.088804+00:00; Konkreter [Werkzeugadapterplan](ROADMAP-CITIES-CITY01-GESTURES-PLAN.md): einmal gebundene Owner-/Elementadresse, CityDraft, lokale Anfangspunkte; Haus/Knoten/Via bewegen, pivotfeste Drehung/Achsgriffe aus Anfangspose. Vorwärts/inverse Cityposepunkte gemeinsam extrahieren, keine Atlas-/Dungeonwurzeländerung. Rechenfehler entfernen alte Vorschau; geschlossene Zustände bleiben geschlossen. Aktueller Terrain-only-Router und fehlender Detail-Lifecycle auditiert; Host-/Zeichnen-/Placement-/Savepflichten erhalten. Plan-Aufräum-P/I/R vorI06. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-tools-20261009/source-audit.json.


CITY-01-PREP-GESTURES-PLAN-CLEAN-R06 Start 2026-10-09T17:59:39.900617+00:00; Getrennte CP/CI präzisieren Originalpose-No-op und externe Outlinebaseline. Finaler Plan gegen aktuelle Atlas-/Cityquellen und echte Pivotarithmetik geprüft: unnötige Rückrechnung erzeugt Rundungsreste, deshalb unveränderte Pose früh behalten. Eine Draftzustandsquelle, clearPreview vor Rechenfehler, gemeinsame Punktpose, keine Dungeonwurzel-/Atlasdateiänderung; Host/Zeichnung/Placement/Savepflichten erhalten. Links/JSON gültig,24CTY offen, keine Runtime-/Hostfreigabe. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-tools-20261009/plan-review.json. I06 folgt.


CITY-01-PREP-I06 Start 2026-10-09T18:00:16.650006+00:00; CityGesture bewegt Haus/Knoten/Via und dreht/skaliert Häuser an festem Konturpivot; Anfangsadresse/-pose einmal gebunden, einzig CityDraft für Vorschau/Apply/Cancel. Rechen-/Punktfehler entfernen alte Vorschau vor Rechnung; terminal bleibt terminal. Gemeinsame Vorwärts/inverse Cityposepunkte und schmale native Ziel-/Punktprüfung in city/input.ts; keine Atlas-/Dungeonwurzeländerung. Neun bedeutungsvolle neue Regressionen einschließlich gedrehter Achsgriffe, Hof, T-Knoten, Source-/Terrainkonflikt, unveränderte Pose/Redo und testseitiger aktueller Kamera.144Konturvorhervergleiche exakt; inverse Rundungsgrenze im QA-Bericht ausdrücklich erfasst. check,336Tests und Build bestanden. R08 und Aufräum-P/I/R folgen separat. Keine sichtbare Host-/Placement-/Save-/Paritätsabnahme. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-tools-20261009/implementation.json.


CITY-01-PREP-R08 Start 2026-10-09T18:06:15.198040+00:00; Separater Review reproduziert CITY-GESTURE-R08-01:6von8 gedrehten Achsgriffen ändern Pose/History bei ausschließlich ungewählter Achse (Größenordnung1e-15). Quellenhashes unverändert zuI06. Gegenprobe: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-tools-20261009/r08-axis-probe.json; Review: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-tools-20261009/review.json. N06 führt aus Double-Rundung/Koordinatengröße abgeleitete Fehlergrenze ein, erhält echte kleine Änderungen und lehnt Spiegelung/Nullhebel weiterhin ab. Kein Coreabschluss oder Hostnachweis.


CITY-01-PREP-GESTURES-CLEAN-R06 Start 2026-10-09T18:08:26.898821+00:00; Getrennte CP/CI dokumentieren realen Gesturekern und offene R08-Lücke. Konkrete N06-Precision-Regel aus EPS-gewichteten Eingabe-/Posekoordinaten, ohne feste Meter-/Pixelklemmung. Quellhashes/Links/JSON geprüft, keine Runtimeänderung. Befund bleibt offen fürN06. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-tools-20261009/cleanup-review.json.


CITY-01-PREP-N06 Start 2026-10-09T18:09:28.846154+00:00; CITY-GESTURE-R08-01 repariert: gemeinsame cityBuildingLocalPrecision schätzt inverse Double-Rundung aus Pointer/Poseposition und Anfangsskala, keine feste Meterklemmung. Unauflösbarer Anfangshebel abgewiesen; Null/Spiegelung vor No-op-Regel geprüft. Originalskala bleibt bei nichtauflösbarer relevanter Achsdifferenz exakt. Zwei neue Regressionen mit32gedrehten Achsfällen/Redo, großen Lagen, negativer Hebelseite und echter Kleinständerung am Millimeterhaus. Unabhängige Original8Gegenfälle jetzt0Fehlcommits statt6;144Vorherkonturen exakt. check,338Tests/build bestanden. R09 folgt separat;Host/Atlas offen. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city01-tools-20261009/refinement.json.


Stadt-Team-Check-in 2026-10-09T18:12:38.814082+00:00: an sicherer N06-Grenze auf beide Integrationsanfragen in Issue1 geantwortet, Kommentar6086617328. Besitz/IDs/lesende CityScene und AtlasHistory-Befehlsgrenze bestätigt; keine LiveScene/SceneClock/Focus/Split/Rejoin/Travel-/Zeit-/Placement-/Router-API geliefert. Keine neue gemeinsame API vor Teamabgleich voraussetzen. Ausstehender bestehender N06-Review R09 bleibt erhalten, neues Feature-/Anschlusspaket erst nach konsolidierter Rückmeldung. Produktstand9f9e188 geprüft/gepusht;338Tests/check/build und Originalgegenproben, keine Hostabnahme.


CITY-01-PREP-R09 Start 2026-10-09T18:14:21.267514+00:00; Quellenhashes unverändert zum grünen N06. Ursprüngliche8Achs-No-ops repariert; unabhängige Gegenprobe findet CITY-GESTURE-R09-01:unrotierte X-Kleinständerung wird bei großem ungewähltem Y wegen ungewichteter Precision verworfen. Keine neue Schnittstelle; bestehendes Paket braucht N07 mit Koeffizientengewichtung. Teamabgleich weiter ohne bestätigte neue API-Freigabe. Beleg:/home/aaron/.cache/dungeon-native-qa/city-plans/city01-tools-20261009/refinement-review.json.


CITY-01-PREP-N06-REVIEW-CLEAN-P06 Start 2026-10-09T18:15:49.061830+00:00; Rotationsgewichtung der X-/Y-Fehleranteile und Regressionen festgelegt; vorhandenes Paket wird sicher abgeschlossen. Fokus:Bestehenden Precisionbefund ohne neue API bereinigen. Keine neue gemeinsame API, bestehendes Reparaturpaket.


CITY-01-PREP-N06-REVIEW-CLEAN-I06 Start 2026-10-09T18:15:52.557951+00:00; Plan nennt Gewichtung mit abs(cos/sin); Architektur trennt reparierten R08 vom offenen R09. Keine Runtimeänderung. Fokus:Dokumentation und konkrete Gewichtung ergänzen. Keine neue gemeinsame API, bestehendes Reparaturpaket.


CITY-01-PREP-N06-REVIEW-CLEAN-R06 Start 2026-10-09T18:15:56.309331+00:00; Eigene Links/JSON und N06-Quellenhashes geprüft. Bestehende Signatur unverändert; R09 offen für gezielte N07. Fokus:Finale Reviewbereinigung gegen Quellen prüfen. Keine neue gemeinsame API, bestehendes Reparaturpaket.


CITY-01-PREP-N07 Start 2026-10-09T18:16:37.056677+00:00; CITY-GESTURE-R09-01 repariert: EPS-gewichtete X-/Y-Eingabefehler tragen gemäß tatsächlichen abs(cos/sin)-Koeffizienten zur inversen Achse bei; unabhängige Achse ohne Koeffizient vergrößert ihre Fehlergrenze nicht. Vorhandene Signatur unverändert, keine neue Schnittstelle oder Atlas-/Hoständerung. Dauerhafte X/Y-Kleinständerungen trotz großer ungewählter Achse mit Undo/Redo; separate2echte Änderungen und8No-ops bestehen. HEX-02-I01c-Speicherpaket424f45b vor Checks integriert;check,347Tests/build bestanden. R10 und anschließendes Aufräumen stehen noch aus; neuer Anschluss erst Teamabgleich. Beleg:/home/aaron/.cache/dungeon-native-qa/city-plans/city01-tools-20261009/n07-refinement.json.


CITY-01-PREP-R10 Start 2026-10-09T18:19:16.853758+00:00; Quellreview und Originalgegenproben schließen CITY-GESTURE-R08-01/R09-01 im lokalen Scope. Neue unabhängige144Konturvergleiche exakt;2304Inverse-Achsfehler unter konservativer gewichteter Schätzung (maximal0.176×Schätzung in diesen Fixtures, kein universeller Floatbeweis). Quellenhashes unverändert zum geprüften347Tests/check/build-Stand. Kein weiterer lokaler Pflichtbefund; Host/Placement/Save/physische Bedienung/volleParität offen. Beleg:/home/aaron/.cache/dungeon-native-qa/city-plans/city01-tools-20261009/n07-review.json. Separates finales Aufräum-P/I/R folgt; kein neues Feature-/Schnittstellenpaket vor Teamabgleich.


CITY-01-PREP-GESTURES-FINAL-CLEAN-P06 Start 2026-10-09T18:21:30.760216+00:00; Kein unnötiger Runtimeumbau; Architektur/Anschluss/Gesamtplan um reviewten CityGesture und geschlossene Präzisionsbefunde ergänzen. Fokus:Lokalen Werkzeugabschluss und fehlende Hostverträge bereinigen. Bestehendes Werkzeugpaket, kein neues Schnittstellen-/Featurepaket.


CITY-01-PREP-GESTURES-FINAL-CLEAN-I06 Start 2026-10-09T18:21:34.376981+00:00; CityGesture/gewichtete Precision als lokal reviewt dokumentiert; R08/R09 geschlossen. Sichtbare Griffe/Router/Placement/Save offen; keine Runtimeänderung. Fokus:Gesturekern und Grenzen konsistent dokumentieren. Bestehendes Werkzeugpaket, kein neues Schnittstellen-/Featurepaket.


CITY-01-PREP-GESTURES-FINAL-CLEAN-R06 Start 2026-10-09T18:21:38.668055+00:00; Planlinks/JSON/Quellenhashes geprüft;347Tests/check/build unverändert.24CTY/volleHostpflichten offen, kein Restbefund im lokalen Werkzeugkern. Fokus:Finales Werkzeug-Aufräumen mit aktuellen Quellen abschließen. Bestehendes Werkzeugpaket, kein neues Schnittstellen-/Featurepaket.


Stadt-Besitzerfeedback 2026-10-09T18:23:09.537136+00:00: exakten Root-Kandidaten934eba515308674447c24d85d15190af132be366 lesend geprüft. Cityzeile/Begriffstrennung/kein Travel-Direktzugriff stimmen mit tatsächlicher Source/Historygrenze überein. Rückmeldung in Issue1/6086779942 bestätigt nur vorhandenen Besitz; unabhängiger Architekturreview und erneute Ownerbestätigung des endgültigenSHA fehlen, keine Implementierungsfreigabe. R10 ist lokaler Quellenreview mit unabhängigen Modulgegenproben, kein fremder Reviewer. Kein neues Featurepaket, alle24CTY offen.


CITY-01-PREP-P07 Start 2026-10-09T18:27:36.073378+00:00; ROADMAP-CITIES-CITY01-RENDERER-PLAN.md konkretisiert den bestätigten City-Szenenbeitrag, affine Meterbreiten, transparente Mehrhöfe, atomare GraphicsContexts und gezielte Kern-/Hostgrenzen. Pixi cut-Mehrfachaufrufrisiko durch einen gemeinsamen Lochpfad berücksichtigt. Keine Runtimeänderung. Aufräum-P/I/R folgt vor I07.

CITY-01-PREP-RENDERER-PLAN-CLEAN-P07 Start 2026-10-09T18:32:56.440371+00:00; Fokus: Rendererplan ohne neue Statusdatenbank auffindbar machen und überholte pauschale Teamwartepflicht berichtigen. Umsetzung: ein Gesamtplanlink, präziser bestätigter City-Scope im vorhandenen Koordinationsobjekt; gemeinsame SMR-/HEX-Frameverträge bleiben gesondert gated. Review: Links, fremde JSON-Wurzeln, offene CTY-Fälle und keine Runtimeänderung prüfen.

CITY-01-PREP-RENDERER-PLAN-CLEAN-I07 Start 2026-10-09T18:33:16.307329+00:00; Rendererplan im Gesamtplan verlinkt; bestätigter City-Scope und fehlender Framevertrag im bestehenden checkpoint festgehalten. Pauschale Teamwartepflicht gemäß neuer Governance präzisiert; SMR-Kandidatenreview bleibt offen. Keine Runtimeänderung.

CITY-01-PREP-RENDERER-PLAN-CLEAN-R07 Start 2026-10-09T18:33:39.873774+00:00; Links, tatsächlicher detailLayer, installierte Pixi cut/setTransform-API, bestätigter Scope und unveränderte Produktquellen geprüft. Kein verbleibender lokaler Planbefund. Alle CTY-/Hostpflichten und echter HEX04/05-Frameanschluss offen. Beleg:/home/aaron/.cache/dungeon-native-qa/city-plans/city01-renderer-20261009/p07-cleanup-review.json. Nächster eigener Lauf I07, danach R11 und getrenntes Aufräumen.

CITY-01-PREP-I07; erster Testabschluss 2026-10-09T18:37:19.017802+00:00; CityRenderer/5Regressionen implementiert. Affine Meterstraßen, Mehrhofcut, Auswahl/5pxKnoten, atomarer Frameaufbau/Dispose; keine Atlasänderung. Testfixture-Ladefehler korrigiert; check,352Tests/build bestanden. c47443d nur fremde JSONnachweise vor Veröffentlichung integriert. Beleg:/home/aaron/.cache/dungeon-native-qa/city-plans/city01-renderer-20261009/implementation.json. Aufräum-P/I/R vor R11; sichtbare Abnahme offen.

CITY-01-PREP-RENDERER-CLEAN-P07 Start 2026-10-09T18:38:55.737758+00:00; Fokus: Ressourcen und Architekturgrenze nach I07 bereinigen. Plan: vorhandene schmale Zeichenhelfer behalten, keine zweite Render-/Stateabstraktion; Architektur um tatsächlichen CityRenderer ergänzen und ältere Aussage „sichtbare Stadtzeichnung fehlt“ auf Hostanschluss präzisieren. Review: Quellenhashes gegen352Tests, Link-/JSONschutz und keine CTY-Freigabe.

CITY-01-PREP-RENDERER-CLEAN-I07 Start 2026-10-09T18:39:17.782163+00:00; Architektur um tatsächlichen CityRenderer/Ressourcenbesitz ergänzt; ältere Zeichnungsaussage auf Host-/Pointerintegration präzisiert. Keine Runtimeänderung, kein neuer Port.

CITY-01-PREP-RENDERER-CLEAN-R07 Start 2026-10-09T18:39:43.051047+00:00; Runtimehashes identisch zum352Tests/check/build-Beleg; Architektur/Planlink und24offeneCTY geprüft. Ressourcen sind eng begrenzt, kein unnötiger technischer Umbau. Implementierungs-Aufräumen abgeschlossen; separater R11 folgt. Beleg:/home/aaron/.cache/dungeon-native-qa/city-plans/city01-renderer-20261009/i07-cleanup-review.json.

CITY-01-PREP-R11 Start 2026-10-09T18:40:26Z; unabhängige Quell-/Modulgegenprobe findet CITY-RENDERER-R11-01: Radius bei10^16lokalenMetern vor Projektion weggerundet, erwartete5px werden inX0px. Darstellbare Projektionsproben und Bildschirmoffsets als N08 geplant. Kein Pass/CTY-Abschluss; Review-Aufräum-P/I/R folgt vor Nachbesserung.

CITY-01-PREP-RENDERER-REVIEW-CLEAN-P07 Start 2026-10-09T18:41:31.652212+00:00; Fokus:Reviewbefund statt veralteter offenerR11-Darstellung dokumentieren. Plan:Architektur auf geprüften Pflichtbefund und geplante N08 aktualisieren; Belegquelle/Runtimehash binden, keine Runtimeänderung im Aufräumen.

CITY-01-PREP-RENDERER-REVIEW-CLEAN-I07 Start 2026-10-09T18:41:45.685386+00:00; Architektur nennt jetzt den tatsächlich reproduzierten R11-Befund und geplante numerische Korrektur; zuvor offenerReview-Verweis bereinigt. Keine Runtime-/Abnahmeänderung.

CITY-01-PREP-RENDERER-REVIEW-CLEAN-R07 Start 2026-10-09T18:42:07.715397+00:00; Befundgegenprobe und unveränderte352Tests-Runtimehashes geprüft; eingehende5832001nurJSON integriert. Alle24CTYoffen. Review-Aufräumen abgeschlossen; CITY-RENDERER-R11-01 bleibt Pflicht für N08/R12.

CITY-01-PREP-N08 Start 2026-10-09T18:42:26Z; darstellbare affine Proben verwenden tatsächlichen Meterdelta, Radius-/Normaloffsets erst im Screen. Gleiche Callback-API, keine Atlasdatei/Placementkopie.2neueRegressionen mit9Großkoordinaten-/Matrixfällen undMAX_VALUE-Gegenrichtung; Originalgegenprobe jetzt5/5px statt0/5px. Testvergleich für-0/0 numerisch präzisiert. check,354Tests/build bestanden. Incoming6133b43docs-only integriert. Beleg:/home/aaron/.cache/dungeon-native-qa/city-plans/city01-renderer-20261009/n08-refinement.json. Aufräum-P/I/R vorR12.

CITY-01-PREP-N08-CLEAN-P08 Start 2026-10-09T18:44:52.815629+00:00; Fokus:radiusVector als schmalen Renderhelfer behalten, veraltete Radiusaddition im Plan präzisieren und tatsächlichen N08Stand in Architektur/Nachweisen ergänzen. Kein zweiter allgemeiner Transformdienst. Review prüft354Tests-Quellenhashes/JSON/Fremdwurzeln; R12 bleibt offen.

CITY-01-PREP-N08-CLEAN-I08 Start 2026-10-09T18:45:18.215839+00:00; tatsächliche Probeformel/Failuregrenze undR12offen inPlan/Architektur festgehalten, vorhandenenCITY01Nachweis ergänzt. Keine Runtimeänderung oderCTYFreigabe.

CITY-01-PREP-N08-CLEAN-R08 Start 2026-10-09T18:45:39.756178+00:00; Quellenhashes identisch zum354Tests/check/buildStand; JSON/Planlink/24offeneCTY geprüft. Keine Pflichtlücke imN08Aufräumen. SeparaterR12 gegen unabhängige affine Sollwerte folgt; Befundabschluss erst dort.

CITY-01-PREP-R12 Start 2026-10-09T18:46:16Z; Quellreview und540unabhängigeaffineSollfälle bestehen, maximalerPixelabweichung3.638e-12.4Mehrhofebenen korrekt,100Zeichenläufe/200Kontexte vollständigfreigegeben. Geprüfte354Tests/check/buildQuellenhashes unverändert. R11-01 im lokalenRendererScope geschlossen, kein weiterer Pflichtbefund dort. Kein fremderReviewer/universellerFloat-/Pixel-/Hostbeweis. SeparatesReview-AufräumenP/I/R folgt. Beleg:/home/aaron/.cache/dungeon-native-qa/city-plans/city01-renderer-20261009/r12-review.json.

CITY-01-PREP-RENDERER-FINAL-CLEAN-P08 Start 2026-10-09T18:47:37.838763+00:00; Fokus: lokalenRendererabschluss konsistent dokumentieren und nächsten Original-/Integrationsschritt koordinieren. Plan:Architektur/Rendererplan/Gesamtplan aufR12lokalenPass aktualisieren, vorhandenenCITY01Nachweis ergänzen; kein weitererRuntimeumbau. Alle24CTY und echteHEX05-/Hostpflichten bleibenoffen.

CITY-01-PREP-RENDERER-FINAL-CLEAN-I08 Start 2026-10-09T18:48:01.491889+00:00; reviewterCityRenderer/R11-01lokalgeschlossen inArchitektur/Plan/Gesamtplan aktualisiert. VorhandenerCITY01Nachweis ergänzt;Host/CTY unverändertoffen. KeineRuntimeänderung.

CITY-01-PREP-RENDERER-FINAL-CLEAN-R08 Start 2026-10-09T18:48:25.008135+00:00; Planlinks/JSON/R12Beleg und354Tests-Quellenhashes geprüft. LokalerRendererkern ohne offenenPflichtbefund; alle24CTY/volleParität/Host offen. Kein weitererRuntimeumbau. NächsteArbeit: verbliebeneOriginal-Funktionsinventur; COKerstnachkonkreterGUI-Freigabe, FTG/Watabou-Browserlücken sonst vorziehen; echteAtlasintegration gemäßHEX05. Beleg:/home/aaron/.cache/dungeon-native-qa/city-plans/city01-renderer-20261009/final-cleanup-review.json.

CITY-00-I42-I Start 2026-10-09T18:49:04Z; eigeneFTG-Testkarte, WyddisCobblekind beiMontag11h:Farmworking→RestdayResidenceRelaxing→NoneFarmworking. Personen-/Wohn-/Arbeitsreferenzen bleiben sichtbar. None-Hilfetext behauptetOverrideerhalt, tatsächlichegleicheDatum-Übernahme entferntRestflag; Ursacheoffen, keinBugalsAnforderung. CO-FTG-0042/0018 umWirkung ergänzt, alle24CTY/65COweiteropen. CITY07benötigt explizite Kalender-/Overridepolitik, abgeleiteteAktivität aufstabilenPerson/Gebäudereferenzen; gemeinsamZeitport erstOwner+Review. KeineProprietärdaten/Produktänderung. Beleg:/home/aaron/.cache/dungeon-native-qa/city-plans/city00-i42-time-20261009/manifest.json. Implementierungs-Aufräum-P/I/R vorseparatemReview.

CITY-00-I42-CLEAN-P42 Start 2026-10-09T18:52:25.376327+00:00; Originalframes unverändert erhalten; technischeZuordnung mitexpliziterKalenderpolitik undgemeinsamemZeitbesitz präzisieren. Tooltipabweichung alsEinzelprobe/ungeklärteSemantik, keinegewollteBugparität; Originalzustandrestauriert, keineproduktweiteEvidenz ausReferenz. ReviewprüftFramehashes und24CTY/65COKennungen.

CITY-00-I42-CLEAN-I42 Start 2026-10-09T18:52:43.417488+00:00; CO42ordnetKalender-/Overridepolitik explizitdergemeinsamenZeitgrenzezu. SichtbarePersonen-/Gebäudereferenzen sindkeineserialisiertenIDs. TooltipabweichungnurEinzelprobe, Version/Persistenzweiteroffen; keineeigeneSceneClockoderProduktänderung.

CITY-00-I42-CLEAN-R42 Start 2026-10-09T18:53:16.493790+00:00; Originalframehashes, AXWorking/Resting/WorkingbeigleichemMontag11h undrestaurierterStatus geprüft;Screenshot04visuellbestätigt.24CTY/65COopen/unveränderteKennungen. Cleanupabgeschlossen, separaterAnforderungsreviewR42stehtaus; tatsächlicheGUIFreigabevomAtlasbesitzer liegtvor, isolierterCOKStart erstnachdiesemReferenzreview. IncomingCatalogdatenC54nichtalsneugetesteterProduktbuildbehauptet.

CITY-00-I42-R42 Start 2026-10-09T18:54:16.074861+00:00; gleicherbenannterBewohner/Montag11h undWohn-/Arbeitsreferenzen inallen3Frames; Ausgangs-/Rückkehrscreenshotbytegleich. TooltipabweichungkorrektalsEinzelprobegeführt, keinintentionalerBug/Versions-/IDs-/Persistenznachweis. LokalerReferenzevidenzreviewohnePflichtbefund, volleFunktionweiterpartial/offen. Beleg:/home/aaron/.cache/dungeon-native-qa/city-plans/city00-i42-time-20261009/review.json. Aufräum-P/I/R folgt.

CITY-00-I42-REVIEW-CLEAN-P42 Start 2026-10-09T18:54:30.807584+00:00; Plan:explizitfesthalten,dassI42wederNone-clearnochNone-preservealsgewollteeigeneSemantikbestätigt; lediglichKalender-/OverridepolitikundWohn-/ArbeitsreferenzenPflicht. BestehendeEvidenzreviewverknüpfen,Originalhashes/65CO/24CTYprüfen. KeineProduktänderung.

CITY-00-I42-REVIEW-CLEAN-I42 Start 2026-10-09T18:54:46.255992+00:00; bestehenderCO42ProbehatReviewverweisundexpliziteSemantikgrenze:keineNone-clear/-preserveProduktentscheidungausEinzelprobe. Originalframesunverändert, keinezusätzlicheDatenbank/API.

CITY-00-I42-REVIEW-CLEAN-R42 Start 2026-10-09T18:55:03.984815+00:00; unveränderteRawhashes/Reviewlink/24CTY+65COopen/fremdeWurzeln geprüft. KeinRestbefund imI42Aufräumen. NächstePlanung:frischfreigegebenerisolierterCOKVariantenvergleich,keineUndoRetry.

CITY-00-I43-P43 Start 2026-10-09T18:55:59.348181+00:00; ROADMAP-CITIES-CITY00-COK-VARIANTS-PLAN.md plant neueCOKKategorie-/Variantenwirkungsprobe aufeigenerQA-Kopie, freigegebenerSlot, keineUndoRetry/Versionsübertreibung. Cleanup-P/I/R vorI43.

CITY-00-I43-PLAN-CLEAN-P43 Start 2026-10-09T18:56:33.932996+00:00; Plan: neuenVariantenplan imbestehendenReferenzabschnittverlinken; eigeneQA-Originalkopie/Demo-/Slotgrenzen verifizieren. KeinRuntimeumbau. ReviewprüftLink/Originalhashschutz und65CO/24CTYopen.

CITY-00-I43-PLAN-CLEAN-I43 Start 2026-10-09T18:56:37.168600+00:00; Planlink imCOKReferenzabschnitt gesetzt; neueVariantenhypothesevonvorigerUndo-/Gruppenprobegetrennt. KeineRaw-/Original-/Produktänderung.

CITY-00-I43-PLAN-CLEAN-R43 Start 2026-10-09T18:56:40.178738+00:00; Planlink/JSON/65CO+24CTYopen undeigenergesicherterInput geprüft. Plan-Aufräumen abgeschlossen. I43 startetjetztübergeprüftenStarter/nachöffentlichemStartcheckin; keineGUIinstanzbisher.

CITY-00-I43-I Start 2026-10-09T18:57:07.640Z; installierteDemo/privatesProfil/Lock:gleicheBaumkategorie, automatische/TabRefresh-Vorschauund2Platzierungenbeobachtet. TatsächlicheSaveändertnurobjects;alteObjekteunverändert,neuewo_tree_c/ac,Scale.82/1.12/Rotation42/-82. Originalgrafikautoreduziert,keineRange-/Seed-/Vollversions-/Reload-/Produktabnahme. NormalUIExit0/5Prozessidentitätenverschwunden,GUIexplizitzurückgegeben,Issue1/6087458629. CO-COK-0002vonDokuaufpartielleWirkungaktualisiert;65CO/24CTYopen. Beleg:/home/aaron/.cache/dungeon-native-qa/city-plans/city00-cok-i43-20261009-r01/manifest.json. GetrenntesImplementierungs-AufräumenP/I/R vorR43.

CITY-00-I43-CLEAN-P43 Start 2026-10-09T19:08:06.372374+00:00; Plan:Originalframes/Savehashes schützen; explizittrennen,dassKategorieassetvariationbelegtist,RandomizeScale/RotationaberzusammenaktivwarenundkeineeigenenRangesisoliertwurden. PrimärAssets/Posematerialisiert; keinGeneratorredoausReferenz. ReviewNormalExit/Slot/65CO+24CTY.

CITY-00-I43-CLEAN-I43 Start 2026-10-09T19:08:09.607626+00:00; CO2trenntbeideaktivierteControls/keineisoliertenRanges,PlatzierungsfolgeVorschauüberlagerungvsEscapeEndstand,ArtefaktassetpfadevsöffentlicheAPI. Originaldateien/Rohframesunverändert.

CITY-00-I43-CLEAN-R43 Start 2026-10-09T19:08:13.588421+00:00; Manifest-/Frame-/Savehashes,Exit0/5verschwundeneProzessidentitäten/Slotrückgabeund65CO+24CTYopengeprüft. KeinRestbefundimAufräumen, separaterReferenzreviewR43folgt;keineerneuteGUIgeplant.

CITY-00-I43-R43 Start 2026-10-09T19:12:50.494468+00:00; unabhängige Neuberechnung des Save-Diffs und aller 47 Rawhashes: nur objects geändert, zwei alte Objekte unverändert, zwei neue Kategorieassets mit unterschiedlichen Posen. Frame017 zeigt Endstand ohne Vorschauüberlagerung. Lokaler Referenzreview ohne Pflichtbefund in diesem Scope; kein fremder Reviewer, keine Neuöffnung/isolierten Randomize-Parameter und keine eigene Produktabnahme. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city00-cok-i43-20261009-r01/review.json. Getrenntes Aufräum-P/I/R folgt.

CITY-00-I43-REVIEW-CLEAN-P43 Start 2026-10-09T19:13:05.334816+00:00; Plan: den CO2-Techniktext lesbar machen und die eigene Persistenzpolitik als Umsetzungspflicht kennzeichnen. Originaldateien/Frames nicht ändern; Review verknüpfen, Kennungen und fremde JSON-Wurzeln erhalten. Cleanup-Review prüft Hashes und offene Produktabnahmen.

CITY-00-I43-REVIEW-CLEAN-I43 Start 2026-10-09T19:13:16.936175+00:00; CO2-Technikplan lesbar präzisiert: geplante eigene stabile IDs/Apply/Persistenz sind vom Original-Teilbeleg getrennt. Originaldaten unverändert; keine neue Runtime oder Schnittstelle.

CITY-00-I43-REVIEW-CLEAN-R43 Start 2026-10-09T19:13:33.598213+00:00; alle 47 Rawhashes, Referenzreviewlink und unverändert offene 65 CO/24 CTY geprüft. Kein Restbefund in dieser Aufräumphase. Nächster Lauf: FTG-Inventar auf veraltete Beschreibung/Belegzuordnung prüfen, bevor weitere Originaltests geplant werden. Keine neue GUI.

CITY-00-I44-P44 Start 2026-10-09T19:15:28.500297+00:00; Drei Fehlzuordnungen identifiziert; konkreter Korrekturplan neben Roadmap, unveränderter Vorherkatalog extern gesichert.

CITY-00-I44-PLAN-CLEAN-P44 Start 2026-10-09T19:15:37.485866+00:00; Aufräumplan: aktuelle Plan-/Reviewlinks konsolidieren, Rohbelege und Kennungen erhalten; keine Runtimeänderung.

I44-Korrekturplan: [FTG-Evidenzzuordnung](ROADMAP-CITIES-CITY00-FTG-MAPPING-PLAN.md).

CITY-00-I44-PLAN-CLEAN-I44 Start 2026-10-09T19:15:41.046066+00:00; Links und Scopegrenzen konsolidiert; Rohbelege unverändert, keine weitere fachliche Datenhaltung.

CITY-00-I44-PLAN-CLEAN-R44 Start 2026-10-09T19:15:44.532950+00:00; Aufräumreview bestanden: I02-Rawhashes, Links, 65 offene CO und 24 offene CTY sowie fremde JSON-Wurzeln unverändert.

CITY-00-I44-I44 Start 2026-10-09T19:15:52.464620+00:00; Falsche Personen-/Zeitbelege zu CO14/18 korrigiert; CO13/17 ohne unbewiesene Wirkung, I18-Historie erhalten. Alle Anforderungen offen.

CITY-00-I44-IMPL-CLEAN-P44 Start 2026-10-09T19:16:04.867958+00:00; Aufräumplan: aktuelle Plan-/Reviewlinks konsolidieren, Rohbelege und Kennungen erhalten; keine Runtimeänderung.

CITY-00-I44-IMPL-CLEAN-I44 Start 2026-10-09T19:16:08.585729+00:00; Links und Scopegrenzen konsolidiert; Rohbelege unverändert, keine weitere fachliche Datenhaltung.

CITY-00-I44-IMPL-CLEAN-R44 Start 2026-10-09T19:16:12.773682+00:00; Aufräumreview bestanden: I02-Rawhashes, Links, 65 offene CO und 24 offene CTY sowie fremde JSON-Wurzeln unverändert.

CITY-00-I44-R44 Start 2026-10-09T19:16:20.862788+00:00; Zuordnungsreview bestanden: Profil/Beziehungen und Uhrzeit aus AX bestätigt; I18 erhalten, Scope/IDs/Produktabnahmen unverändert.

CITY-00-I44-REVIEW-CLEAN-P44 Start 2026-10-09T19:16:32.577778+00:00; Aufräumplan: aktuelle Plan-/Reviewlinks konsolidieren, Rohbelege und Kennungen erhalten; keine Runtimeänderung.

CITY-00-I44-REVIEW-CLEAN-I44 Start 2026-10-09T19:16:36.415502+00:00; Links und Scopegrenzen konsolidiert; Rohbelege unverändert, keine weitere fachliche Datenhaltung.

CITY-00-I44-REVIEW-CLEAN-R44 Start 2026-10-09T19:16:39.897987+00:00; Aufräumreview bestanden: I02-Rawhashes, Links, 65 offene CO und 24 offene CTY sowie fremde JSON-Wurzeln unverändert.

CITY-00-I45-P45 Start 2026-10-09T19:18:26.813586+00:00; Eigener Formularentwurf und Originalparameterprobe geplant, bestehende QA-Karte geschützt; Ergebniswirkung ausdrücklich getrennt.

CITY-00-I45-PLAN-CLEAN-P45 Start 2026-10-09T19:18:29.410523+00:00; Aufräumplan: neuen Plan verlinken, Referenz-/Produktgrenzen und neue Tabisolation prüfen.

I45-Originalplan: [FTG-Gebäudebedarfe und Anzahlgrenzen](ROADMAP-CITIES-CITY00-FTG-BUILDING-LIMITS-PLAN.md).

CITY-00-I45-PLAN-CLEAN-I45 Start 2026-10-09T19:18:31.866072+00:00; Plan neben Roadmap verlinkt; eigene Formularprobe getrennt von alter QA-Karte und paralleler nativer GUI.

CITY-00-I45-PLAN-CLEAN-R45 Start 2026-10-09T19:18:34.697707+00:00; Planlink/JSON/Fremdwurzeln geprüft; keine Produktabnahme. Originalformularprobe kann im Hintergrundtab beginnen.

CITY-00-I45-I45 Start 2026-10-09T19:18:45.432Z; Originalparameter vermessen: Initialzahl2/Limit1 und Per-population-Auswahl im Entwurf; deklarierte Ausnahmen identifiziert, keine Ergebnisgenerierung. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city00-i45-building-limits-20261009/manifest.json.

CITY-00-I45-CLEAN-P45 Start 2026-10-09T19:21:01.574661+00:00; Aufräumplan: vorschnelle strikte Limitregel durch explizite Original-Ausnahmen ersetzen, Formzustand von Ergebniswirkung trennen; Rohhashes erhalten. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city00-i45-building-limits-20261009/manifest.json.

CITY-00-I45-CLEAN-I45 Start 2026-10-09T19:21:04.729675+00:00; Technikplan unterstützt deklarierte Initial-/Fraktions-/Arbeitsplatzausnahmen; Erzeugungsbedarfe getrennt von Simulationsressourcen. Keine Runtimeänderung. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city00-i45-building-limits-20261009/manifest.json.

CITY-00-I45-CLEAN-R45 Start 2026-10-09T19:21:07.610814+00:00; Rohhashes/Planlinks/Entwurfgrenze geprüft; neuer Tab geschlossen, alte QA-Karte sichtbar erhalten. Anforderungsreview R45 noch offen. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city00-i45-building-limits-20261009/manifest.json.

CITY-00-I45-R45 Start 2026-10-09T19:22:35.160257+00:00; Parameterteilbelege bestanden; CITY-REF-R45-01 verlangt vollständige Übersichtssnapshots statt No-change-Diffs.

CITY-00-I45-REVIEW-CLEAN-P45 Start 2026-10-09T19:22:38.455169+00:00; Aufräumplan: Reviewbefund verknüpfen, Nachbesserung auf frische Vollaufnahmen ohne Generierung begrenzen.

CITY-00-I45-REVIEW-CLEAN-I45 Start 2026-10-09T19:22:41.063781+00:00; Reviewbefund und präziser Vollaufnahmeplan verknüpft; alte Rawdateien geschützt.

CITY-00-I45-REVIEW-CLEAN-R45 Start 2026-10-09T19:22:44.655023+00:00; R45-Befund/Planlinks/Rawhashes geprüft, keine vorweggenommene Freigabe. N45 ergänzt jetzt Originalübersichten.

CITY-00-I45-N45 Start 2026-10-09T19:22:59.620Z; Fehlende Vollaufnahmen ergänzt: Formularhinweis, UI-Listen209/80, alte Karte/Wyddis/Montag11h sichtbar erhalten. Kein Katalogvolltest oder Ergebnisgenerator.

CITY-00-I45-N45-CLEAN-P45 Start 2026-10-09T19:24:01.688789+00:00; Aufräumplan: genaue Zählgrenze UI-Gesamtzahl vs geladene Einträge dokumentieren; Originaldaten/IDs schützen.

CITY-00-I45-N45-CLEAN-I45 Start 2026-10-09T19:24:04.673654+00:00; Zähl-/Erhaltungsgrenzen lesbar präzisiert; keine Runtime- oder Rohdatenänderung.

CITY-00-I45-N45-CLEAN-R45 Start 2026-10-09T19:24:07.611554+00:00; Aufräumreview bestanden: neue/alte Hashes, Scopegrenzen, Links und offene Stadtanforderungen erhalten.

CITY-00-I45-R46 Start 2026-10-09T19:24:15.145266+00:00; R46 schließt CITY-REF-R45-01: Vollaufnahmen und alte Rawhashes bestätigt. Formularteilbeleg bestanden, Generierungs-/Produktabnahme offen.

CITY-00-I45-R46-CLEAN-P45 Start 2026-10-09T19:24:18.883021+00:00; Aufräumplan: genaue Zählgrenze UI-Gesamtzahl vs geladene Einträge dokumentieren; Originaldaten/IDs schützen.

CITY-00-I45-R46-CLEAN-I45 Start 2026-10-09T19:24:21.769458+00:00; Zähl-/Erhaltungsgrenzen lesbar präzisiert; keine Runtime- oder Rohdatenänderung.

CITY-00-I45-R46-CLEAN-R45 Start 2026-10-09T19:24:24.773063+00:00; Aufräumreview bestanden: neue/alte Hashes, Scopegrenzen, Links und offene Stadtanforderungen erhalten.

CITY-01-INTEGRATION-P01 Start 2026-10-09T19:25:50.379517+00:00; Quellenbasierter Vorschlag mit Pre-render-Zeitpunkt, gemeinsamem Pointer/History und noch fehlender Citypersistenz vorgelegt; keine API ratifiziert.

CITY-01-INTEGRATION-CLEAN-P01 Start 2026-10-09T19:25:53.821846+00:00; Aufräumplan: Plan verlinken und bestehende Hooks strikt von noch zu vereinbarender Persistenz/Placementgrenze trennen.

Atlasbesitzer angefragter [CITY-01-Integrationsvorschlag](ROADMAP-CITIES-ATLAS-INTEGRATION-PROPOSAL.md): vor Render zeichnen, Source einmal registrieren, gemeinsame Gesten/Persistenz; keine API vorweggenommen.

CITY-01-INTEGRATION-CLEAN-I01 Start 2026-10-09T19:25:56.754856+00:00; Vorschlag im Stadtplan verlinkt; HEX05-Voraussetzung und offene Owner-/Persistenzentscheidungen erhalten.

CITY-01-INTEGRATION-CLEAN-R01 Start 2026-10-09T19:25:59.973810+00:00; Verweise und zentrale Quellgrenzen geprüft: changed nach Render, Draft terrain-only, CitySource gemeinsame History. Vorschlag bereit zur konkreten HEX04/05-Abstimmung.

CITY-01-INTEGRATION-R01 Start 2026-10-09T19:28:12.125763+00:00; Drei Planbefunde: precision-komposition, striktes Placement/Draftschema und Terrain-only Fit. Anschlussvorschlag muss nachgebessert werden.

CITY-01-INTEGRATION-R01-CLEAN-P01 Start 2026-10-09T19:28:15.623485+00:00; Aufräumplan: Befunde und reine Vorschlagsgrenzen lesbar halten, Quellen-/Gegenbelege unverändert erhalten.

CITY-01-INTEGRATION-R01-CLEAN-I01 Start 2026-10-09T19:28:18.561382+00:00; Belegpfad und Vorschlagsscope konsolidiert; kein vorweggenommener Vertrag oder Produktpass.

CITY-01-INTEGRATION-R01-CLEAN-R01 Start 2026-10-09T19:28:21.042352+00:00; Planlinks/JSON/Gegenbeleg vorhanden, fremde JSON-Wurzeln erhalten; Scope bleibt Vorschlag.

CITY-01-INTEGRATION-N01 Start 2026-10-09T19:28:35.030662+00:00; Drei Befunde in konkrete Anschluss-/Abnahmepflichten übersetzt: relative Vorwärts/Rückabbildung, neues Placement/Draftschema, gemeinsames Fit.

CITY-01-INTEGRATION-N01-CLEAN-P01 Start 2026-10-09T19:28:38.312911+00:00; Aufräumplan: Befunde und reine Vorschlagsgrenzen lesbar halten, Quellen-/Gegenbelege unverändert erhalten.

CITY-01-INTEGRATION-N01-CLEAN-I01 Start 2026-10-09T19:28:41.330934+00:00; Belegpfad und Vorschlagsscope konsolidiert; kein vorweggenommener Vertrag oder Produktpass.

CITY-01-INTEGRATION-N01-CLEAN-R01 Start 2026-10-09T19:28:43.984353+00:00; Planlinks/JSON/Gegenbeleg vorhanden, fremde JSON-Wurzeln erhalten; Scope bleibt Vorschlag.

CITY-01-INTEGRATION-R02 Start 2026-10-09T19:29:00.630020+00:00; R02: alle drei Befunde im Vorschlag vollständig adressiert. Vertrag, Implementierung und Hostabnahme bleiben offen.

CITY-01-INTEGRATION-R02-CLEAN-P01 Start 2026-10-09T19:29:03.471755+00:00; Aufräumplan: Befunde und reine Vorschlagsgrenzen lesbar halten, Quellen-/Gegenbelege unverändert erhalten.

CITY-01-INTEGRATION-R02-CLEAN-I01 Start 2026-10-09T19:29:06.203947+00:00; Belegpfad und Vorschlagsscope konsolidiert; kein vorweggenommener Vertrag oder Produktpass.

CITY-01-INTEGRATION-R02-CLEAN-R01 Start 2026-10-09T19:29:09.073297+00:00; Planlinks/JSON/Gegenbeleg vorhanden, fremde JSON-Wurzeln erhalten; Scope bleibt Vorschlag.

CITY-00-I46-P46 Start 2026-10-09T19:30:30.593778+00:00; Konkrete Originalprobe für Mehrfachauswahl/Editor geplant, Schreibprobe nur mit gelesenen reversiblen Beforewerten.

CITY-00-I46-PLAN-CLEAN-P46 Start 2026-10-09T19:30:33.307996+00:00; Aufräumplan: eigenen Bewohner-/Rawschutz und Planlink prüfen; keine unbestätigte Massenwirkung.

I46-Plan: [FTG-Bewohner-Massenbearbeitung](ROADMAP-CITIES-CITY00-FTG-BULK-EDIT-PLAN.md).

CITY-00-I46-PLAN-CLEAN-I46 Start 2026-10-09T19:30:36.312160+00:00; Originalprobe mit vorhandener QA-Karte und Field-before-Schutz verlinkt.

CITY-00-I46-PLAN-CLEAN-R46 Start 2026-10-09T19:30:39.201603+00:00; Planlink/JSON und klar begrenzter Bewohner-/Tabschutz geprüft. Originalprobe kann beginnen.

CITY-00-I46-I46 Start 2026-10-09T19:30:56.956Z; CO17 von Dokumentationskandidat zu echter Teilwirkung: zwei Bewohner gemeinsam umbenannt, Cancel geprüft und ursprüngliche Namen sichtbar wiederhergestellt. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city00-i46-bulk-20261009/manifest.json.

CITY-00-I46-CLEAN-P46 Start 2026-10-09T19:36:02.852129+00:00; Aufräumplan: Auswahl-Save von Daten-Apply und sichtbare Wiederherstellung von voller Dateninvarianz trennen; Rawhashes schützen. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city00-i46-bulk-20261009/manifest.json.

CITY-00-I46-CLEAN-I46 Start 2026-10-09T19:36:05.837607+00:00; Auswahl vs Apply und sichtbare Rücksetzung vs Dateninvarianz präzisiert; keine neuen APIs/Produktdatenhaltung. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city00-i46-bulk-20261009/manifest.json.

CITY-00-I46-CLEAN-R46 Start 2026-10-09T19:36:08.707285+00:00; Hash-/Plan-/Scopeprüfung bestanden: originale sichtbare Namen wiederhergestellt, Produktabnahmen offen; getrenntes R46 folgt. Beleg: /home/aaron/.cache/dungeon-native-qa/city-plans/city00-i46-bulk-20261009/manifest.json.

CITY-00-I46-R46 Start 2026-10-09T19:38:18.497531+00:00; R46 bestanden: Zweierauswahl/Cancel/Apply/Rücksetzung, 18 Rawhashes und identisches sichtbares Wyddis-Profil. Ganze Daten-/Hostparität offen.

CITY-00-I46-REVIEW-CLEAN-P46 Start 2026-10-09T19:38:22.320998+00:00; Aufräumplan: sichtbares Profilgleichheitsmaß von serialisierten IDs/Persistenz trennen; Reviewlink und Rohbelege erhalten.

CITY-00-I46-REVIEW-CLEAN-I46 Start 2026-10-09T19:38:24.745516+00:00; Reviewumfang und Profilgleichheitsgrenze lesbar ergänzt; keine Produktdaten-/APIänderung.

CITY-00-I46-REVIEW-CLEAN-R46 Start 2026-10-09T19:38:27.357923+00:00; Aufräumen nach Review abgeschlossen: Rawhashes, Link und offene eigene Abnahmen erhalten. Nächste offene COK-Licht-/Wetterfunktion konkret planen.

CITY-00-I47-P47 Start 2026-10-09T19:40:11.874000+00:00; Konkrete Demo-Licht/Wetterprobe auf geschützter eigener QA-Kopie geplant; frischer GUI-Slot angefragt, keine Instanz gestartet.

CITY-00-I47-PLAN-CLEAN-P47 Start 2026-10-09T19:40:15.479130+00:00; Aufräumplan: Slot-/Rawschutz und Atmosphäre-gegen-Geometrie-Grenze prüfen; Planlink und vorige Reviewlaufbezeichnung konsolidieren.

I47-Plan: [COK-Licht und Wetter](ROADMAP-CITIES-CITY00-COK-ATMOSPHERE-PLAN.md). Alte C46-Laufbezeichnung auf R46 konsolidiert; Startzeit/Ergebnis unverändert, veröffentlichter Gitverlauf erhalten.

CITY-00-I47-PLAN-CLEAN-I47 Start 2026-10-09T19:40:17.946273+00:00; Plan verlinkt; vorige Reviewbezeichnung konsolidiert, Geometrie-/Kopien-/Slotgrenzen unverändert.

CITY-00-I47-PLAN-CLEAN-R47 Start 2026-10-09T19:40:20.566144+00:00; Plan/JSON/QA-Input und offene Produktabnahmen geprüft. I47 bereit; Start erst nach konkreter GUI-Slotantwort, bis dahin unabhängige Originalarbeit möglich.

CITY-HEX03-OWNER-R01 Start 2026-10-09T19:42:25.334736+00:00; Exakter cb869951-HEX03-Plan aus Citysicht ohne Pflichtlücke: drei Anschlussauflagen, frühe native Folge, vollständige Copy/Discard/Recovery enthalten. Keine Produkt/API-Freigabe.

CITY-HEX03-OWNER-CLEAN-P01 Start 2026-10-09T19:42:29.373434+00:00; Aufräumplan: exakten Peerreviewbeleg verlinken, fachliche Planpass-Grenze von Produkt-/Vertragsabnahme trennen.

CITY-HEX03-OWNER-CLEAN-I01 Start 2026-10-09T19:42:32.185182+00:00; Quellengebundenen Peerreview im Cityvorschlag verlinkt; noch fehlende konkrete Transform-/Router-/Citypersistenz-Implementierung offen gehalten.

CITY-HEX03-OWNER-CLEAN-C01 Start 2026-10-09T19:42:35.161597+00:00; Peerreviewlink/Quellpin/JSON/Fremdwurzeln geprüft. COK I47-Originalprobe bleibt nächster Umsetzungslauf nach GUI-Koordination.

CITY-00-I47 Start 2026-10-09T19:43:35.514Z; Originalwirkung Schatten230→34/Schnee0→0.6 und Save nur environment belegt; Schnee0 nur sichtbar zurückgestellt, finale Datei weiterhin0.6, Schattenrestauration nicht gelungen. Normal Exit0/5 Prozesse weg, GUI zurückgegeben. R47 offen.

CITY-00-I47-CLEAN-P47 Start 2026-10-09T19:55:16.507511+00:00; Aufräumplan: Rawhashes/Kopien/Prozessende, partielle Wiederherstellung und fehlende Vorlagen-/Fresh-Reopen-Abnahme prüfen; eigenes Evidenzformat konsolidieren ohne APIs.

CITY-00-I47-CLEAN-I47 Start 2026-10-09T19:55:27.486404+00:00; Plan mit begrenzter Reglerwirkung und offenen Vorlagen-/Wiederherstellungs-/Reopen-Grenzen ergänzt; externe Rohdaten geschützt, kein neuer Produkt-/APIstand.

CITY-00-I47-CLEAN-R47 Start 2026-10-09T19:55:37.671020+00:00; Rawhashes, geschützte Quelle, ausschließlicher environment-Diff und partielle Restauration geprüft; 24CTY/65CO offen, 5 eigene Prozesse weg. Team-Handshake vor neuen Claims; R47 folgt per Heartbeat.

CITY-00-R47 Start 2026-10-09T20:39:04.076618+00:00; R47:43 Hashes/19 Frames, sichtbare Schatten-/Schneeregler und nur environment-Save bestätigt; Quelle/5 Prozessidentitäten geschützt. PASS nur begrenzte Wirkung; Vorlagen/Reopen/eigenes Produkt offen.

CITY-00-R47-CLEAN-P47 Start 2026-10-09T20:39:15.687903+00:00; Aufräumplan: irreführenden Raw-Bildnamen018 ausdrücklich einordnen, veraltete Plan-/Koordinationsaussagen konsolidieren, tatsächlichen20min-Heartbeat und Issue7 im eigenen Checkpoint abbilden; Rawdaten unverändert.

CITY-00-R47-CLEAN-I47 Start 2026-10-09T20:39:26.928811+00:00; Rawname018 ohne Umbenennen als bloße Kennung geklärt; Plan-Ausgangsstand datiert; Issue7/11 und tatsächlicher20min-Heartbeat konsolidiert. Keine API-/Produktänderung.

CITY-00-R47-CLEAN-R47 Start 2026-10-09T20:39:40.200319+00:00; Aufräumreview PASS:43 Rawhashes/Reviewlink/JSON/Quellschutz und24CTY/65CO offen; keine fremde Wurzel verändert. Nächster Schritt Vorlagenlücke konkret planen, keine neue GUI bis Slotabsprache.

CITY-00-P48 Start 2026-10-09T20:59:29.030065+00:00; Zwei getrennte Originalfolgen I48a Vorlage/Map-Save und I48b frischer Prozess mit getrennten Dialog-/Datei-/Section-/Prozessorakeln geplant. Keine GUI gestartet.

CITY-00-P48-CLEAN-P48 Start 2026-10-09T20:59:41.165724+00:00; Aufräumplan: Planverweise, Start-/Copyreihenfolge und echte Reopen-Grenze prüfen; alten R47-Ausstehend-Satz aktualisieren, offene eigene Abnahmen und fremde Wurzeln erhalten.

P48-Folgeplan: [COK-Vorlagen/Reopen](ROADMAP-CITIES-CITY00-COK-TEMPLATE-REOPEN-PLAN.md).

CITY-00-P48-CLEAN-I48 Start 2026-10-09T20:59:52.329422+00:00; P48 neben Roadmap verlinkt; überholten R47-Ausstehend-Satz konsolidiert. Rawdaten/Kopien bleiben unverändert, kein neues Produkt/API.

CITY-00-P48-CLEAN-R48 Start 2026-10-09T21:00:03.993621+00:00; Plan-/Link-/JSON-/Quellhashprüfung PASS; getrennte Vorlagen-/Map-/Neustartbelege und Slotgrenzen erhalten,24CTY/65CO offen. Bereit für I48a nach konkreter GUI-Slotfreigabe.

CITY-00-I48a Start 2026-10-09T21:05:00.623Z; Eigene momenv geschrieben, Open sofort Light/Weather34/0.6→230/0, Cancel sichtbar erhalten; finaler Menu/Save bytegleich Quelle. Normal Exit0/5 Prozesse weg/GUI zurück. I48b/R48 offen.

CITY-00-I48a-CLEAN-P48 Start 2026-10-09T21:16:18.825990+00:00; Aufräumplan: Templateumfang gegen gemessene2Regler trennen, Cancel nur visuell/finale Bytegleichheit präzisieren, Rawschutz/Prozessende prüfen und Reopeninput eindeutig verlinken.

CITY-00-I48a-CLEAN-I48 Start 2026-10-09T21:16:32.775761+00:00; Gemessene2Regler vs vollständige Vorlagenfelder sowie visueller Cancel getrennt dokumentiert; genaue I48b-Quellkopien verlinkt, keine API-/Produktänderung.

CITY-00-I48a-CLEAN-R48 Start 2026-10-09T21:16:51.071531+00:00; Rawhashes/Quelle/finale Bytegleichheit/Templateumfang/5 Prozessende geprüft,24CTY/65CO offen. I48b eigener nächster Prozesslauf nach erneuter Slotabsprache; R48 folgt danach.

## HOST-RECEIPT-P01 – Ergebnis bei fehlgeschlagenem Prozessabschluss erhalten

Eigenständiger technischer Plan von Stadt. Nutzerziel: Eine fehlgeschlagene native Stadt-/Atlasprobe bleibt diagnostizierbar, auch wenn das Beenden des QA-Prozesses fehlschlägt. Kein Produkt-, GUI- oder Paritäts-PASS aus einem geschriebenen Receipt.

Befund auf Shared `321a41c`: Der abschließende Workflow in `tools/host-test.cjs` wartet ungeschützt auf `shutdown()`. Eine dort geworfene Ausnahme überspringt die gesamte `result.json`-Erzeugung. PR17/bd7f428 enthält bereits unabhängig geprüfte main()-Fehlerfelder, schützt aber diese Abschlussgrenze ausdrücklich nicht. Kein erneuter Review dieses geschlossenen Scopes.

Umsetzung als nächster getrennter Lauf:

1. Vor Quellenänderung den vorhandenen Atlas-QA-Owner in PR17 über die ergänzende Grenze informieren und dessen aktuellen Kandidaten konsumieren; keine konkurrierende Umgestaltung des Runners. Veränderliche Grenze ausschließlich Workflowabschluss, gezielte selbständige Node-Gegenproben; keine Produktdateien, Fixturebytes oder GUI-Ressourcen.
2. Hauptfehler und Shutdownfehler getrennt erfassen. Shutdown weiterhin genau einmal versuchen. Unabhängig von einer geworfenen Shutdownausnahme anschließend das Receipt schreiben, sofern das Ausgabeverzeichnis beschreibbar ist. Kein automatischer Prozessneustart und keine Behauptung normalen Prozessendes.
3. Vorhandene Receiptfelder erhalten; Hauptfehler bleibt primäre Ursache. Eigenes additives shutdownFailure-Feld enthält nur Name/Meldung/Stack, keine zyklischen Editorobjekte. Jeder Shutdownfehler erzwingt passed:false und Exitcode1; Hauptfehler+Shutdownfehler bleiben beide sichtbar.
4. Fehler des Receipt-Schreibens separat am Terminal melden und Exitcode1 erhalten. Nicht behaupten, dass bei defektem Dateisystem ein persistiertes Receipt garantiert werden kann.

Abnahme: kontrollierte Node-Proben ohne Obsidian für Erfolg, Hauptfehler, Shutdownfehler, beide Fehler, Nicht-Error-Würfe und nicht beschreibbares Ausgabeziel. Tatsächlichen Workflowabschluss aus dem Kandidaten ausführen, keine bloße Nachbildung seiner Bedingungen. Anzahl der Shutdownaufrufe und Exitcode/Dateiinhalt prüfen; keine Sleeps oder nativen Wiederholungen. Syntax-/Diffprüfung sowie Repository-Basisgates vor Produktkandidatenveröffentlichung. Anschließend unabhängiger enger Review; native E2E-Abnahme bleibt separat.

Aufräumplan nach Fachabschluss: eigene temporäre Node-Proben/Logs inventarisieren; notwendige Regressionsproben im Repository behalten, Rohlogs außerhalb des Vaults. Aufräumumsetzung und Review getrennt; fremde QA-Artefakte nicht entfernen.

Planabschluss: nur diese Planung veröffentlicht. Umsetzung, Gegenproben, unabhängiger Review und Aufräum-P/I/R sind noch offen.

HOST-RECEIPT-I01: Umsetzung abgeschlossen. PR17-Eingang regulär konsumiert; Hauptfehler und Abschlussfehler bleiben getrennt. Auch falsy Nicht-Error-Würfe bleiben fehlgeschlagen; Ausgabefehler erzwingen Exit1. Elf gezielte Proben führen den tatsächlichen Workflowabschluss in einer Node-VM aus, ohne GUI-Bootstrap. Typprüfung, vollständige Suite 454/454, Syntax und Diffprüfung bestanden. Build bestanden auf Arbeitsstand; sauberer Commitbuild folgt bei Veröffentlichung. Unabhängiger Review und getrenntes Aufräumen bleiben offen.

HOST-RECEIPT-CLEAN-P01: unabhängiger Fachreview auf d94d41b PASS ohne Pflichtbefund ([direkter Review](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/47#issuecomment-6099483690)). Aufräumplan unter `/home/aaron/.cache/dungeon-native-qa/city-host-shutdown-cleanup/plan.json`, SHA256 `ffa179f163ad13f554ab4c9743653c794ccbc285ebb4ed29e1c0624d58032457`. Vier eigene Owner-/Integrationslogs und drei Produkt-/Test-/Suiteblobs inventarisiert; Delete-Liste leer, weil beide Logs direkte Prüfevidenz sind. Nächster eigener Lauf konsolidiert die Nachweisverweise und prüft Hashgleichheit; fremde QA-/Build-/Dependencywurzeln und Vault bleiben unberührt. Danach getrennte Cleanupreview; keine neue Produktprüfung oder GUI-Probe aus dieser Planung.

Der vor Veröffentlichung neu eingegangene Shared-Repositorycheck ist regulär integriert; package.json enthält sowohl Shutdownregressionen als auch die neuen Strukturtests. Fremde Checkpointwurzeln und reviewte QA-Quellen bytegleich. Repositorycheck, Typprüfung, vollständige neue Suite und Build bestanden; der Testlistenkonflikt ist gezielt auf beide Testgruppen aufgelöst. Kein neuer Host-PASS.

HOST-RECEIPT-CLEAN-I01: Nachweise in `/home/aaron/.cache/dungeon-native-qa/city-host-shutdown-cleanup/implementation.json` konsolidiert, SHA256 `a82b059380da40bd891c48619c8b77ef9048863c2e5d9b89a72c459c3be6d2d6`. Alle vier Logs und drei geschützten Blobs stimmen mit dem Plan überein; keine Löschung, kein GUI-Lauf. CI auf c293d51 PASS; unabhängiger Fachreview bleibt auf d94d41b gebunden. Nächster getrennter Lauf ist Cleanupreview der unveränderten Bytes und Verweise.

HOST-RECEIPT-CLEAN-R01: Planbindung, vier Original-Loghashes und bytegleiche unabhängig reviewte Runner-/Testquellen geprüft: PASS ohne Befund. Neue Shared-Testliste separat auf exakt eigene Zusatzprobe plus unveränderten Sharedbestand geprüft; aktuelle fremde Checkpointwurzeln gleich Shared. Review `/home/aaron/.cache/dungeon-native-qa/city-host-shutdown-cleanup/review.json`, SHA256 `9884cea70599ed8c0806876fdea74cbee1c21a0bc61c83434e06d86b7e2273d9`. Repositorycheck,18 Struktur-/Contexttests und11 Shutdownproben PASS. Aufräum-P/I/R fertig; unabhängige endgültige Kompositionsentscheidung bleibt offen.
